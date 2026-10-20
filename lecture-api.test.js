import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('background HTTP upload accepts quickly, exposes progress/result and supports deletion',{timeout:15000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'lecture-api-'));let child;
 try{
  const preload=`globalThis.fetch=async()=>{await new Promise(r=>setTimeout(r,100));return {ok:true,json:async()=>({choices:[{message:{content:'# Background notes\\nImportant ideas'}}]})};};`;
  child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),'server.js'],{env:{...process.env,PORT:'0',LECTURE_JOBS_DIR:root,AI_PROVIDER:'groq',GROQ_API_KEY:'test-placeholder'},stdio:['ignore','pipe','pipe']});
  const port=await new Promise((resolve,reject)=>{let output='';child.stdout.on('data',chunk=>{output+=chunk;const found=output.match(/listening on port (\d+)/);if(found)resolve(found[1]);});child.once('error',reject);child.once('exit',()=>reject(Error('Server exited')));});
  const base=`http://127.0.0.1:${port}`,form=new FormData();form.append('lecture',new Blob(['A detailed lecture on memory and retrieval.']),'lecture.txt');
  const response=await fetch(base+'/api/jobs',{method:'POST',body:form});assert.equal(response.status,202);const initial=await response.json();assert.ok(initial.id);assert.ok(!initial.result);
  let result;for(let i=0;i<100;i++){result=await (await fetch(base+'/api/jobs/'+initial.id)).json();if(['completed','failed'].includes(result.status))break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(result.status,'completed');assert.match(result.result.notes,/Background notes/);assert.equal(result.files,undefined);
  assert.equal((await fetch(base+'/api/jobs/'+initial.id+'/retry',{method:'POST'})).status,409);
  assert.equal((await fetch(base+'/api/jobs/not-a-job')).status,404);
  assert.equal((await fetch(base+'/api/jobs/'+initial.id,{method:'DELETE'})).status,200);
  assert.equal((await fetch(base+'/api/jobs/'+initial.id)).status,404);
 }finally{if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}await rm(root,{recursive:true,force:true});}
});

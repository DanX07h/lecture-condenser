import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import JSZip from 'jszip';
const run=promisify(execFile);
let available=true;try{await run('ffmpeg',['-version']);}catch{available=false;}
test('uploads compress media, consolidate multiple decks, reject invalid decks and clean up',{skip:!available,timeout:30000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'lecture-upload-test-'));
 let child;
 try {
  const path=join(root,'original.wav');
  await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=500:sample_rate=48000','-t','150','-ac','2',path]);
  const preload=`globalThis.fetch=async(url,options)=>{
    if(url.endsWith('/audio/transcriptions')) {
      const file=options.body.get('file');
      if(file.size>=24*1024*1024 || file.name!=='lecture-speech.mp3') throw Error('Expected compressed audio');
      return {ok:true,json:async()=>({text:'Practice retrieval to strengthen memory.'})};
    }
    if(url.endsWith('/chat/completions')) {
      const payload=JSON.parse(options.body);
      if(payload.messages[0].content.includes('Consolidate all supplied')) {
        const source=payload.messages[1].content;
        if(!source.includes('SOURCE 1: first.pptx') || !source.includes('SOURCE 2: second.pptx') || !source.includes('Slide 10') || !source.includes('Encoding') || !source.includes('Retrieval')) throw Error('Missing deck content or slide references');
        return {ok:true,json:async()=>({choices:[{message:{content:'# Consolidated memory notes'}}]})};
      }
      return {ok:true,json:async()=>({choices:[{message:{content:'# Memory\\n\\n**Retrieval** improves retention.'}}]})};
    }
    throw Error('Unexpected provider endpoint');
  };`;
  child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),'server.js'],{env:{...process.env,PORT:'0',TMPDIR:root,LECTURE_JOBS_DIR:join(root,'jobs'),AI_PROVIDER:'groq',GROQ_API_KEY:'test-placeholder'},stdio:['ignore','pipe','pipe']});
  const port=await new Promise((resolve,reject)=>{
    let log='';child.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/listening on port (\d+)/);if(match)resolve(match[1]);});
    child.once('error',reject);child.once('exit',()=>reject(Error('Server exited before readiness')));
  });
  const form=new FormData();form.append('lecture',new Blob([await readFile(path)]),'lecture.wav');
  const response=await fetch(`http://127.0.0.1:${port}/api/notes`,{method:'POST',body:form});
  const result=await response.json();assert.equal(response.status,200);assert.equal(result.compressedFiles,1);assert.match(result.notes,/Retrieval/);
  const decks=new FormData();
  for(const [name,number,text] of [['first.pptx',1,'Encoding'],['second.pptx',10,'Retrieval']]) {
    const zip=new JSZip();zip.file(`ppt/slides/slide${number}.xml`,`<a:t>${text}</a:t>`);
    decks.append('decks',new Blob([await zip.generateAsync({type:'nodebuffer'})]),name);
  }
  const consolidated=await fetch(`http://127.0.0.1:${port}/api/slides`,{method:'POST',body:decks});
  assert.equal(consolidated.status,200);assert.match((await consolidated.json()).notes,/Consolidated/);
  const invalid=new FormData();invalid.append('decks',new Blob(['bad']),'lecture.mp3');
  const rejected=await fetch(`http://127.0.0.1:${port}/api/slides`,{method:'POST',body:invalid});
  assert.equal(rejected.status,400);assert.match((await rejected.json()).error,/PPTX or PDF/);
  const tooMany=new FormData();for(let i=0;i<6;i++)tooMany.append('decks',new Blob(['bad']),`deck${i}.pptx`);
  const excess=await fetch(`http://127.0.0.1:${port}/api/slides`,{method:'POST',body:tooMany});
  assert.equal(excess.status,413);assert.match((await excess.json()).error,/five slide decks/);
  for(let i=0;i<50;i++){
    if(!(await readdir(root)).some(name=>name.startsWith('lecture-condenser-'))) break;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.deepEqual((await readdir(root)).sort(),['jobs','original.wav']);
 } finally {
  if(child && child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}
  await rm(root,{recursive:true,force:true});
 }
});

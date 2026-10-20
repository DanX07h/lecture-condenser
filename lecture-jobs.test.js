import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LectureJobs} from './lecture-jobs.js';
async function until(check){for(let i=0;i<500;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Job did not reach expected state');}
async function fixture(fn){const dir=await mkdtemp(join(tmpdir(),'lecture-jobs-test-'));try{const path=join(dir,'source.txt');await writeFile(path,'Lecture content');await fn(dir,{path,originalname:'source.txt',size:15});}finally{await rm(dir,{recursive:true,force:true});}}
test('failed background jobs persist and can retry after restart; successful jobs remove source/checkpoint files',()=>fixture(async(dir,file)=>{
 let failed=true,calls=0;let jobs;
 const runner=async(_job,path,{update})=>{calls++;await update({stage:'summarising',message:'Summarising section 2.',completedSections:1,totalSections:2});await writeFile(join(path,'checkpoint.json'),'retained');if(failed)throw Error('Quota reached');return {notes:'# Finished lecture'};};
 try{
 jobs=await new LectureJobs(join(dir,'jobs'),{runner}).init();const created=await jobs.create([file]);await until(()=>jobs.public(created.id).status==='failed');assert.equal(jobs.public(created.id).completedSections,1);assert.equal(jobs.public(created.id).files,undefined);
 assert.equal(await readFile(join(dir,'jobs',created.id,'input-0'),'utf8'),'Lecture content');
 await jobs.shutdown();failed=false;jobs=await new LectureJobs(join(dir,'jobs'),{runner}).init();assert.equal(jobs.public(created.id).status,'failed');await jobs.retry(created.id);await until(()=>!jobs.running);
 assert.equal(jobs.public(created.id).status,'completed');assert.equal(calls,2);assert.equal(jobs.public(created.id).result.notes,'# Finished lecture');assert.deepEqual(await readdir(join(dir,'jobs',created.id)),['job.json']);
 await assert.rejects(()=>jobs.retry(created.id),/Only failed/);assert.throws(()=>jobs.public('../private'),/not found/);
 }finally{await jobs?.shutdown();}
}));
test('server shutdown checkpoints an active job and resumes it on next startup',()=>fixture(async(dir,file)=>{
 let jobs,started=false,resumed=false;
 try{
 jobs=await new LectureJobs(join(dir,'jobs'),{runner:async(_job,path,{signal,update})=>{
  await writeFile(join(path,'checkpoint.json'),'completed-section');await update({stage:'transcribing',completedChunks:1,totalChunks:3});started=true;
  await new Promise((_resolve,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
 }}).init();const created=await jobs.create([file]);await until(()=>started);await jobs.shutdown();
 jobs=await new LectureJobs(join(dir,'jobs'),{runner:async(_job,path)=>{assert.equal(await readFile(join(path,'checkpoint.json'),'utf8'),'completed-section');resumed=true;return {notes:'# Recovered'};}}).init();
 await until(()=>!jobs.running);assert.equal(resumed,true);assert.equal(jobs.public(created.id).status,'completed');
 }finally{await jobs?.shutdown();}
}));
test('cancel removes only the requested job and a second worker is rejected',()=>fixture(async(dir,file)=>{
 let jobs,started=false;
 try{
 jobs=await new LectureJobs(join(dir,'jobs'),{runner:async(_job,_path,{signal})=>{started=true;await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}).init();
 await assert.rejects(()=>new LectureJobs(join(dir,'jobs')).init(),/Another Lecture Condenser/);
 const first=await jobs.create([file]);await until(()=>started);const second=await jobs.create([file]);await jobs.remove(second.id);assert.throws(()=>jobs.get(second.id),/not found/);
 await jobs.remove(first.id);await until(()=>!jobs.running);assert.throws(()=>jobs.get(first.id),/not found/);assert.deepEqual(await readdir(join(dir,'jobs')),['worker.lock']);
 }finally{await jobs?.shutdown();}
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {planChunks,splitText,retryTransient,runLectureJob} from './lecture-pipeline.js';
import {aiConfig} from './processing.js';
const run=promisify(execFile),config=aiConfig({AI_PROVIDER:'groq',GROQ_API_KEY:'test-placeholder'});
let available=true;try{await run('ffmpeg',['-version']);await run('ffprobe',['-version']);}catch{available=false;}
test('two-hour audio plan covers the whole recording with ten-second overlaps',()=>{
 const chunks=planChunks(7200);assert.equal(chunks.length,13);assert.equal(chunks[0].start,0);assert.equal(chunks.at(-1).end,7200);
 for(let i=1;i<chunks.length;i++)assert.equal(chunks[i-1].end-chunks[i].start,10);
 const text='paragraph\n'.repeat(4000);const parts=splitText(text);assert.equal(parts.join(''),text);assert.ok(parts.every(p=>p.length<=12000));
});
test('transient retries are bounded, honour Retry-After, and do not retry credentials or exhausted quota',async()=>{
 let calls=0;const waits=[];
 const result=await retryTransient(async()=>{calls++;if(calls<3)throw Object.assign(Error('Busy'),{status:429,retryAfterMs:5000});return 'ok';},{wait:async ms=>waits.push(ms)});
 assert.equal(result,'ok');assert.equal(calls,3);assert.deepEqual(waits,[5000,5000]);
 calls=0;await assert.rejects(()=>retryTransient(async()=>{calls++;throw Object.assign(Error('Quota'),{status:429,code:'insufficient_quota'});},{wait:async()=>assert.fail('No retry expected')}),/Quota/);assert.equal(calls,1);
 await assert.rejects(()=>retryTransient(async()=>{throw Object.assign(Error('Key'),{status:401});},{wait:async()=>assert.fail('No retry expected')}),/Key/);
});
test('real two-hour recording is split, transcribed section by section, and fully represented in final coverage',{skip:!available,timeout:120000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'two-hour-lecture-'));
 try{
  await run('ffmpeg',['-v','error','-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t','7200','-c:a','pcm_s16le','-f','wav',join(dir,'input-0')],{timeout:60000});
  let transcribed=0,summarised=0;const updates=[];
  const request=async(path,body)=>{
    if(path==='audio/transcriptions'){transcribed++;assert.ok(body.get('file').size<2*1024*1024);return {text:`Distinct concept ${transcribed}. A definition and worked example for this section.`};}
    const source=body.messages[1].content;
    if(body.messages[0].content.startsWith('Create detailed topic notes')){summarised++;return {choices:[{message:{content:source}}]};}
    assert.match(source,/Distinct concept 1\./);assert.match(source,/Distinct concept 13\./);return {choices:[{message:{content:'# Complete lecture\nAll main concepts are combined.'}}]};
  };
  const result=await runLectureJob({files:[{originalname:'two-hours.wav',storedName:'input-0'}]},dir,{config,request,signal:new AbortController().signal,update:async patch=>updates.push(patch)});
  assert.equal(transcribed,13);assert.equal(summarised,13);assert.equal(result.totalChunks,13);assert.match(result.notes,/01:58:00–02:00:00/);
  assert.ok(updates.some(p=>p.completedChunks===13));assert.ok(updates.some(p=>p.stage==='consolidating'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('failed summarisation resumes its checkpoints without retranscribing or repeating completed summaries',{skip:!available,timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lecture-resume-'));
 try{
  await run('ffmpeg',['-v','error','-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t','620','-c:a','pcm_s16le','-f','wav',join(dir,'input-0')]);
  let transcribed=0,summaries=0,fail=true;
  const request=async(path,body)=>{
    if(path==='audio/transcriptions'){transcribed++;return {text:`Section concept ${transcribed}`};}
    if(body.messages[0].content.startsWith('Create detailed topic notes')){summaries++;if(fail&&summaries===2)throw Object.assign(Error('Account limit'),{status:401});return {choices:[{message:{content:body.messages[1].content}}]};}
    return {choices:[{message:{content:'# Resumed notes'}}]};
  };
  const job={files:[{originalname:'lecture.wav',storedName:'input-0'}]},options={config,request,signal:new AbortController().signal,update:async()=>{}};
  await assert.rejects(()=>runLectureJob(job,dir,options),/Account limit/);assert.equal(transcribed,2);assert.equal(summaries,2);
  const checkpoint=JSON.parse(await readFile(join(dir,'checkpoint.json'),'utf8'));assert.ok(checkpoint['transcript:0:0']);assert.ok(checkpoint['summary:audio:0:0:0']);
  fail=false;const result=await runLectureJob(job,dir,options);assert.equal(transcribed,2);assert.equal(summaries,3);assert.match(result.notes,/Resumed notes/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('large document material is split before summarising rather than truncated',{timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lecture-text-'));
 try{
  const content=('A useful concept and explanation.\n').repeat(7000)+'FINAL UNIQUE POINT';await writeFile(join(dir,'input-0'),content);
  let sawLast=false,calls=0;
  const request=async(_path,body)=>{calls++;assert.ok(body.messages[1].content.length<31000);if(body.messages[1].content.includes('FINAL UNIQUE POINT'))sawLast=true;return {choices:[{message:{content:body.messages[1].content.includes('FINAL UNIQUE POINT')?'# Notes\nFINAL UNIQUE POINT':'# Notes\nA useful concept'}}]};};
  const result=await runLectureJob({files:[{originalname:'notes.txt',storedName:'input-0'}]},dir,{config,request,signal:new AbortController().signal,update:async()=>{}});
  assert.ok(calls>10);assert.ok(sawLast);assert.ok(result.totalSections>10);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('hierarchical consolidation bounds requests and carries every section into the final pass',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lecture-merge-'));
 try{
  await writeFile(join(dir,'input-0'),'x'.repeat(12000*20));let merges=0;
  const request=async(_path,body)=>{
    const prompt=body.messages[0].content,source=body.messages[1].content;assert.ok(source.length<=18000);
    if(prompt.startsWith('Create detailed topic notes')){
      const number=source.match(/text section (\d+)/)[1];return {choices:[{message:{content:`MARKER_${number}_ `+'detail '.repeat(220)}}]};
    }
    if(prompt.startsWith('Merge these section notes')){merges++;return {choices:[{message:{content:[...new Set(source.match(/MARKER_\d+_/g))].join('\n')}}]};}
    for(let i=1;i<=20;i++)assert.ok(source.includes(`MARKER_${i}_`),`Section ${i} missing`);
    return {choices:[{message:{content:'# Consolidated lecture'}}]};
  };
  const result=await runLectureJob({files:[{originalname:'large.txt',storedName:'input-0'}]},dir,{config,request,signal:new AbortController().signal,update:async()=>{}});
  assert.ok(merges>=2);assert.equal(result.totalSections,20);assert.match(result.notes,/text section 20/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

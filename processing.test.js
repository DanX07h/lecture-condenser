import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {extract} from './processing.js';
test('extracts plain lecture text',async()=>assert.equal(await extract({originalname:'lecture.txt',buffer:Buffer.from('Retrieval practice improves retention.')}),'Retrieval practice improves retention.'));
test('extracts PowerPoint slides in numeric order',async()=>{const zip=new JSZip();zip.file('ppt/slides/slide10.xml','<a:t>Later &amp; last</a:t>');zip.file('ppt/slides/slide2.xml','<a:t>First concept</a:t>');const text=await extract({originalname:'slides.pptx',buffer:await zip.generateAsync({type:'nodebuffer'})});assert.ok(text.indexOf('First concept')<text.indexOf('Later & last'));});
test('rejects unsupported file formats',async()=>assert.rejects(()=>extract({originalname:'legacy.doc',buffer:Buffer.from('')}),/Unsupported/));

import {aiConfig,aiRequest} from './processing.js';
test('Groq selects its own endpoint, key and models',()=>{
 const config=aiConfig({GROQ_API_KEY:'test-placeholder',OPENAI_API_KEY:'other-placeholder'});
 assert.equal(config.provider,'groq');assert.equal(config.base,'https://api.groq.com/openai/v1');assert.equal(config.key,'test-placeholder');assert.equal(config.transcriptionModel,'whisper-large-v3-turbo');assert.equal(config.notesModel,'llama-3.3-70b-versatile');
 assert.equal(aiConfig({AI_PROVIDER:'openai',GROQ_API_KEY:'test-placeholder'}).provider,'openai');
});
test('sends transcription form unchanged and explains rate limits without leaking provider content',async()=>{
 const original=globalThis.fetch;
 try {
 const form=new FormData();form.append('model','whisper-large-v3-turbo');
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.groq.com/openai/v1/audio/transcriptions');assert.equal(options.body,form);assert.equal(options.headers['Content-Type'],undefined);return {ok:true,json:async()=>({text:'Lecture transcript'})};};
 assert.deepEqual(await aiRequest('audio/transcriptions',form,true,aiConfig({GROQ_API_KEY:'test-placeholder'})),{text:'Lecture transcript'});
 globalThis.fetch=async()=>({ok:false,status:429,json:async()=>({error:{message:'Sensitive provider content',code:'rate_limit_exceeded'}})});
 await assert.rejects(()=>aiRequest('chat/completions',{},false,aiConfig({GROQ_API_KEY:'test-placeholder'})),error=>error.message.includes('Rate or quota limit')&&!error.message.includes('Sensitive'));
 } finally {globalThis.fetch=original;}
});

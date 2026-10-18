import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareAudio,PROVIDER_FILE_LIMIT} from './media.js';
const run=promisify(execFile);
let ffmpegAvailable=true;
try {await run('ffmpeg',['-version']);await run('ffprobe',['-version']);}catch{ffmpegAvailable=false;}
async function fixture(fn){const dir=await mkdtemp(join(tmpdir(),'lecture-media-test-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('compresses an audio upload above the actual provider limit without truncating it',{skip:!ffmpegAvailable},()=>fixture(async dir=>{
 const path=join(dir,'recording');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=500:sample_rate=48000','-t','150','-ac','2','-f','wav',path]);
 const originalSize=(await stat(path)).size;
 assert.ok(originalSize>PROVIDER_FILE_LIMIT);
 const result=await prepareAudio({path,originalname:'lecture.wav'});
 assert.equal(result.compressed,true);
 assert.ok((await stat(result.path)).size<PROVIDER_FILE_LIMIT);
 assert.equal((await stat(path)).size,originalSize);
 const {stdout}=await run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,channels,sample_rate','-of','json',result.path]);
 const info=JSON.parse(stdout);
 assert.equal(info.streams[0].codec_name,'mp3');assert.equal(info.streams[0].channels,1);assert.equal(info.streams[0].sample_rate,'16000');
 assert.ok(Math.abs(Number(info.format.duration)-150)<1);
}));
test('extracts audio from video and leaves small audio unchanged',{skip:!ffmpegAvailable},()=>fixture(async dir=>{
 const path=join(dir,'video');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=64x64:r=1','-f','lavfi','-i','sine=frequency=500','-t','2','-c:v','mpeg4','-c:a','aac','-f','mp4',path]);
 const result=await prepareAudio({path,originalname:'lecture.mp4'});
 assert.equal(result.compressed,true);
 const small=await prepareAudio({path:result.path,originalname:'lecture.mp3'});
 assert.equal(small.compressed,false);assert.equal(small.path,result.path);
}));
test('rejects damaged media and compressed output that still exceeds the limit',{skip:!ffmpegAvailable},()=>fixture(async dir=>{
 const path=join(dir,'bad');await writeFile(path,'not a recording');
 await assert.rejects(()=>prepareAudio({path,originalname:'bad.mp4'}),/Could not extract speech audio/);
 const valid=join(dir,'valid');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=500','-t','1','-f','wav',valid]);
 await assert.rejects(()=>prepareAudio({path:valid,originalname:'lecture.wav'},1),/still too large after compression/);
}));

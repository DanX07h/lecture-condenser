import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {stat} from 'node:fs/promises';
import {extension} from './processing.js';
const run=promisify(execFile);
export const PROVIDER_FILE_LIMIT=24*1024*1024;
export const UPLOAD_FILE_LIMIT=500*1024*1024;
const videoExtensions=new Set(['mp4','webm','mov','mkv']);

export async function prepareAudio(file, limit=PROVIDER_FILE_LIMIT) {
  const size=(await stat(file.path)).size;
  if(size<=limit && !videoExtensions.has(extension(file.originalname))) {
    return {path:file.path,name:file.originalname,compressed:false};
  }
  const output=file.path+'.speech.mp3';
  try {
    await run('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y',
      '-protocol_whitelist','file,pipe','-i',file.path,'-map','0:a:0',
      '-vn','-ac','1','-ar','16000','-c:a','libmp3lame','-b:a','24k',output],
      {timeout:10*60*1000,maxBuffer:1024*1024});
  } catch(error) {
    if(error.code==='ENOENT') throw new Error('Automatic audio compression needs FFmpeg. On your Mac, run brew install ffmpeg, then restart the app.');
    if(error.killed) throw new Error('Audio compression took too long. Try a shorter recording.');
    throw new Error('Could not extract speech audio. Check the recording has a playable audio track and is not damaged or protected.');
  }
  if((await stat(output)).size>limit) throw new Error('The recording is still too large after compression. Split it into shorter recordings and try again. Nothing was cut off automatically.');
  return {path:output,name:'lecture-speech.mp3',compressed:true};
}

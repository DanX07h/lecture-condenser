import {aiConfig} from './processing.js';
// Read only: no recording upload, note generation, or credential output.
try {
  const config=aiConfig();
  if(!config.key) throw new Error('No API key configured. Set the selected provider key in your private .env file.');
  const response=await fetch(`${config.base}/models`,{headers:{Authorization:`Bearer ${config.key}`},signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`Model lookup returned HTTP ${response.status}. Check account access in your provider console.`);
  const result=await response.json();
  if(!Array.isArray(result.data)) throw new Error('Model lookup returned an unexpected response.');
  const available=new Set(result.data.map(model=>model.id));
  console.log(`Provider: ${config.provider}`);
  for(const [label,model] of [['Transcription',config.transcriptionModel],['Notes',config.notesModel]]) {
    const safeModel=String(model).replace(/[^a-zA-Z0-9/_.-]/g,'').slice(0,100);
    console.log(`${label}: ${safeModel} — ${available.has(model)?'listed for this account':'NOT LISTED; choose a supported model in your provider console'}`);
  }
  console.log('This checks model listing only, not transcription or generation. No API key was printed.');
} catch(error) {
  console.error(error instanceof TypeError ? 'Could not reach provider model listing. Check network connectivity.' : error.message);
  process.exitCode=1;
}

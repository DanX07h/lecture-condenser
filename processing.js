import mammoth from 'mammoth';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import JSZip from 'jszip';
export const audioExtensions = new Set(['mp3','mp4','m4a','wav','webm','mpeg','mpga','mov','mkv']);
export function extension(name) { return name.split('.').pop().toLowerCase(); }
export async function extract(file) {
  const ext = extension(file.originalname);
  if (ext === 'txt') return file.buffer.toString('utf8');
  if (ext === 'pdf') return (await pdf(file.buffer)).text;
  if (ext === 'docx') return (await mammoth.extractRawText({buffer:file.buffer})).value;
  if (ext === 'pptx') {
    const zip = await JSZip.loadAsync(file.buffer);
    const slides = Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
    return (await Promise.all(slides.map(async p=>{
      const xml=await zip.file(p).async('string');
      const text=(xml.match(/<a:t(?:\s[^>]*)?>[^]*?<\/a:t>/g) || []).map(t=>t.replace(/<[^>]+>/g,'').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&amp;','&')).join('\n').trim();
      return text ? `Slide ${Number(p.match(/slide(\d+)/)[1])}\n${text}` : '';
    }))).filter(Boolean).join('\n\n');
  }
  throw new Error('Unsupported document type. Use PDF, DOCX, PPTX or TXT.');
}
export function aiConfig(env=process.env) {
  const provider = env.AI_PROVIDER || (env.GROQ_API_KEY ? 'groq' : 'openai');
  if (!['groq','openai'].includes(provider)) throw new Error('AI_PROVIDER must be groq or openai.');
  const groq = provider === 'groq';
  return {provider, key:groq ? env.GROQ_API_KEY : env.OPENAI_API_KEY,
    base:groq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1',
    transcriptionModel:env.TRANSCRIPTION_MODEL || (groq ? 'whisper-large-v3-turbo' : 'whisper-1'),
    notesModel:env.NOTES_MODEL || (groq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini')};
}
export async function aiRequest(path, body, isForm=false, config=aiConfig(), options={}) {
  const response = await fetch(`${config.base}/${path}`, {method:'POST',headers:{Authorization:`Bearer ${config.key}`,...(!isForm?{'Content-Type':'application/json'}:{})},body:isForm?body:JSON.stringify(body),signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000)});
  if (!response.ok) {
    let code;
    try { const data=await response.json(); code=data.error?.code; } catch {}
    const reason = response.status === 429
      ? (code === 'insufficient_quota' ? 'API quota exhausted. Check provider billing and usage limits.' : 'Rate or quota limit reached. Try a shorter recording, wait before retrying, and check provider usage limits. Free tiers have limited capacity.')
      : response.status === 401 ? 'API key rejected. Check your private .env file and restart the server.'
      : response.status === 413 ? 'Material exceeds the provider request limit. Try a shorter recording or document.'
      : 'Check the provider model availability and uploaded file format.';
    const model = isForm ? body.get('model') : body.model;
    const stage = path === 'audio/transcriptions' ? 'transcription' : 'note generation';
    const safeCode = typeof code === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(code) ? ` Code: ${code}.` : '';
    const details = response.status === 404
      ? `The requested model may be unavailable for this account. Run npm run check:ai to check model access. ${reason}`
      : reason;
    const error=new Error(`${config.provider} ${stage} failed (${response.status}), model ${String(model).replace(/[^a-zA-Z0-9/_.-]/g, '').slice(0,100)}.${safeCode} ${details}`);
    error.status=response.status;error.code=code;
    const retryAfter=response.headers?.get('retry-after');
    error.retryAfterMs=retryAfter ? (Number.isFinite(Number(retryAfter))?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-Date.now())) : 0;
    throw error;
  }
  return response.json();
}

import mammoth from 'mammoth';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import JSZip from 'jszip';
export const audioExtensions = new Set(['mp3','mp4','m4a','wav','webm','mpeg','mpga']);
export function extension(name) { return name.split('.').pop().toLowerCase(); }
export async function extract(file) {
  const ext = extension(file.originalname);
  if (ext === 'txt') return file.buffer.toString('utf8');
  if (ext === 'pdf') return (await pdf(file.buffer)).text;
  if (ext === 'docx') return (await mammoth.extractRawText({buffer:file.buffer})).value;
  if (ext === 'pptx') {
    const zip = await JSZip.loadAsync(file.buffer);
    const slides = Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
    return (await Promise.all(slides.map(async(p,i)=>`Slide ${i+1}\n`+(await zip.file(p).async('string')).match(/<a:t>[^]*?<\/a:t>/g)?.map(t=>t.replace(/<[^>]+>/g,'').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')).join('\n')))).join('\n\n');
  }
  throw new Error('Unsupported document type. Use PDF, DOCX, PPTX or TXT.');
}
export async function openai(path, body, isForm=false) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,...(!isForm?{'Content-Type':'application/json'}:{})},body:isForm?body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  if (!response.ok) throw new Error(`AI service request failed (${response.status}). Check the server API key, quota and file format.`);
  return response.json();
}

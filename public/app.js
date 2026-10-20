import {setupLectureJobs} from './lecture-jobs.js';
import {setupGeneration} from './generation.js';
import {setupQuiz} from './quiz.js';
import {setupDashboard} from './dashboard.js';
import {setupLibrary} from './library.js';
import {renderNotes} from './notes.js';
const form=document.querySelector('#form'), status=document.querySelector('#status'), output=document.querySelector('#notes'), download=document.querySelector('#download'), generate=document.querySelector('#generate');
const dashboard=setupDashboard();
const generation=setupGeneration();
let notes='';
let libraryUI;
let lectureActive=false,shownJob=null,jobLoading=null;
function setLectureBusy(busy){lectureActive=busy;generate.disabled=busy;consolidate.disabled=busy;}
function displayJob(job){
  dashboard.navigate('library/note');
  if(job.status==='completed'){show(job.result.notes);status.textContent='Lecture notes ready. Review and save them to a folder.';shownJob=job.id;return;}
  generation.start({files:job.fileNames||[],createdAt:job.createdAt});jobLoading=job.id;
  output.hidden=true;download.hidden=true;document.querySelector('#empty').hidden=true;
  if(job.status==='failed'){generation.fail(job.error||job.message);status.textContent='Lecture job paused. Use Retry unfinished step above to continue.';}
  else {generation.update(job);status.textContent='Your lecture is being processed in the background.';}
}
const lectureJobs=setupLectureJobs({
  onUpdate(job){
    setLectureBusy(['queued','running','failed'].includes(job.status));
    if(!jobLoading&&!notes&&job.createdAt&&window.location.hash==='#library/note'&&['queued','running','failed'].includes(job.status))displayJob(job);
    if(window.location.hash==='#library/note'&&jobLoading===job.id&&['queued','running'].includes(job.status)){if(document.querySelector('#generation-panel').classList.contains('generation-error'))generation.start({files:job.fileNames||[],createdAt:job.createdAt});generation.update(job);}
  },
  onComplete(job){setLectureBusy(false);if(window.location.hash==='#library/note'&&(jobLoading===job.id||!notes)&&shownJob!==job.id){show(job.result.notes);shownJob=job.id;status.textContent='Complete lecture notes ready. Check key details and save to a folder.';}},
  onFailure(job){if(window.location.hash==='#library/note'&&jobLoading===job.id){generation.fail(job.error);status.textContent='Job paused. Retry resumes completed sections from saved checkpoints.';}},
  onOpen:displayJob,
  onClear(){setLectureBusy(false);jobLoading=null;generation.hide();if(notes){output.hidden=false;download.hidden=false;}else document.querySelector('#empty').hidden=false;status.textContent='Lecture job closed. Saved notes are kept in My notes.';}
});
function show(text){jobLoading=null;generation.hide();dashboard.navigate('library/note');notes=text;output.innerHTML=renderNotes(text);output.hidden=false;document.querySelector('#empty').hidden=true;download.hidden=false;libraryUI?.newNotes(text);}
document.querySelector('#sample').onclick=()=>{status.textContent='Sample notes — illustrative content, not generated from your files.';show("# Introduction to memory\n\n## Overview\nMemory involves **encoding**, **storing** and **retrieving** information. Effective study supports all three processes.\n\n## Key takeaways\n> - **Working memory is limited:** break complex material into meaningful units.\n> - **Space your practice** across multiple study sessions.\n> - **Test yourself:** retrieval practice helps strengthen learning.\n\n## Main topics\n### Working memory\nWorking memory holds information temporarily while you use it. Group related ideas to reduce the load of a complex task.\n\n### Retention and practice\n- **Spaced practice:** revisit material across separate sessions.\n- **Active retrieval:** try recalling an idea before checking your notes.\n\n## Key terms\n- **Encoding:** converting information into a form that can be stored.\n- **Retrieval:** accessing previously learned information.\n\n## Examples\nAfter a lecture, close your notes and explain **three main ideas** in your own words. Revisit those ideas in a later study session.\n\n## Review questions\n1. What are the three main memory processes?\n2. How could you combine spacing and retrieval in your study routine?\n\n## Uncertainties\nThis is a handcrafted interface sample, with no uploaded source.");};
const slidesForm=document.querySelector('#slides-form');
const consolidate=document.querySelector('#consolidate');
const decks=document.querySelector('#decks');
decks.onchange=()=>{
  const files=[...decks.files];
  document.querySelector('#deck-selection').textContent=files.length
    ? `${files.length} deck${files.length===1?'':'s'} selected: ${files.map(file=>file.name).join(', ')}`
    : 'Select one or more PPTX or PDF decks, up to five files.';
};
async function createNotes(selectedForm,slidesMode=false) {
  dashboard.navigate('library/note');
  const data=new FormData(selectedForm);
  const files=[...data.values()].filter(file=>file.size);
  if(!files.length){status.textContent='Please choose at least one file.';return;}
  if(slidesMode && files.length>5){status.textContent='Choose up to five slide decks at a time.';return;}
  for(const [name,file] of [...data]) {
    if(!file.size){data.delete(name);continue;}
    if(slidesMode && !/\.(pptx|pdf)$/i.test(file.name)){status.textContent='Slides to notes accepts PPTX or PDF files.';return;}
    const media=!slidesMode && /\.(mp3|mp4|m4a|wav|webm|mpeg|mpga|mov|mkv)$/i.test(file.name);
    if(file.size>(media?500:24)*1024*1024){status.textContent=media?'Recordings must be 500 MB or smaller.':'Documents must be 24 MB or smaller.';return;}
  }
  if(lectureActive){status.textContent='A lecture job is already active. Use View progress, Retry or Cancel job above.';return;}
  let backgroundStarted=false;
  generation.start({slidesMode,files:files.map(file=>file.name)});
  generate.disabled=true;consolidate.disabled=true;document.querySelector('#sample').disabled=true;
  download.hidden=true;output.hidden=true;document.querySelector('#save-note').disabled=true;document.querySelector('#empty').hidden=true;
  status.textContent=slidesMode
    ? 'Reading your decks and consolidating topics… Keep this page open.'
    : 'Uploading and processing… Videos and large audio files are automatically compressed to speech audio. This may take several minutes. Keep this page open.';
  try {
    const response=await fetch(slidesMode?'/api/slides':'/api/jobs',{method:'POST',body:data});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    if(!slidesMode){backgroundStarted=true;lectureJobs.attach(result);displayJob(result);return;}
    show(result.notes);
    status.textContent=(result.compressedFiles?'Recording compressed successfully. ':'')+(slidesMode?'Consolidated notes ready. Check key points against your slides.':'Notes ready. Check key details against your source material.');
  }catch(error){status.textContent='Note generation failed.';generation.fail(error.message,slidesMode);if(notes){output.hidden=false;download.hidden=false;document.querySelector('#save-form').hidden=false;status.textContent='Generation failed. Your previous notes are shown below.';}}
  finally{generate.disabled=lectureActive;consolidate.disabled=lectureActive;document.querySelector('#sample').disabled=false;document.querySelector('#save-note').disabled=backgroundStarted||!notes;}
}
form.onsubmit=event=>{event.preventDefault();createNotes(form);};
slidesForm.onsubmit=event=>{event.preventDefault();createNotes(slidesForm,true);};
download.onclick=()=>{const url=URL.createObjectURL(new Blob([notes],{type:'text/markdown'}));const link=document.createElement('a');link.href=url;link.download='lecture-notes.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

libraryUI=setupLibrary({onOpen:show,getCurrent:()=>notes});

setupQuiz();

lectureJobs.restore();

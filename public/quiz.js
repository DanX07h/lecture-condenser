import {NoteLibrary} from './library-store.js';
export function selectQuestions(data,source,folderIds){
  const selected=new Set(folderIds);
  const items=source==='notes'?data.notes:data.flashcards;
  return items.filter(item=>selected.has(item.folderId===null?'unfiled':item.folderId));
}
export function setupQuiz(){
  const $=id=>document.getElementById(id);
  const library=new NoteLibrary(window.localStorage);
  let questions=[],index=0,missed=[],known=0,controller=null;
  function folders(){
    try{
      const data=library.read(),source=$('quiz-source').value;
      const list=source==='notes'?data.folders:data.flashcardFolders;
      const target=$('quiz-folder-options');target.replaceChildren();
      for(const folder of [{id:'unfiled',name:'Unfiled'},...list]){
        const count=selectQuestions(data,source,[folder.id]).length;
        const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.value=folder.id;input.disabled=!count;
        label.append(input,document.createTextNode(`${folder.name} (${count})`));target.append(label);
      }
      $('quiz-cost').textContent=source==='notes'?'Selected notes are sent to your AI provider to generate up to 10 questions. Provider limits and charges may apply.':'This test uses your saved flashcards. No AI request or credits are needed.';
    }catch(error){$('quiz-status').textContent=error.message;}
  }
  function reset(){
    controller?.abort();controller=null;
    $('quiz-setup').hidden=false;$('quiz-session').hidden=true;$('quiz-results').hidden=true;
    $('start-test').disabled=false;$('quiz-source').disabled=false;$('quiz-folders').disabled=false;$('quiz-status').textContent='';folders();
  }
  function mode(test){
    if(!test)reset();
    $('card-browser').hidden=test;$('quiz-workspace').hidden=!test;
    $('browse-cards').setAttribute('aria-pressed',String(!test));$('open-test').setAttribute('aria-pressed',String(test));
    if(test)reset();
  }
  function show(){
    $('quiz-progress').textContent=`Question ${index+1} of ${questions.length}`;
    $('quiz-question').textContent=questions[index].question;$('quiz-answer').textContent=questions[index].answer;
    $('quiz-source-title').textContent=`Source: ${questions[index].source||'Personal flashcard'}`;
    $('quiz-response').value='';$('quiz-reveal').hidden=true;$('reveal-test-answer').hidden=false;
  }
  function begin(items){
    questions=items.map(item=>({...item}));
    for(let i=questions.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[questions[i],questions[j]]=[questions[j],questions[i]];}
    index=0;missed=[];known=0;
    $('quiz-setup').hidden=true;$('quiz-results').hidden=true;$('quiz-session').hidden=false;$('quiz-status').textContent='';show();
  }
  function rate(knew){
    if($('quiz-reveal').hidden)return;
    if(knew)known++;else missed.push(questions[index]);
    index++;
    if(index<questions.length)show();else {
      $('quiz-session').hidden=true;$('quiz-results').hidden=false;
      $('quiz-score').textContent=`You marked ${known} of ${questions.length} as known. ${missed.length} need more practice.`;
      $('review-missed').hidden=!missed.length;
    }
  }
  $('browse-cards').onclick=()=>mode(false);$('open-test').onclick=()=>mode(true);
  $('quiz-source').onchange=()=>{$('quiz-status').textContent='';folders();};
  $('start-test').onclick=async()=>{
    const selected=[...$('quiz-folder-options').querySelectorAll('input:checked')].map(input=>input.value);
    if(!selected.length){$('quiz-status').textContent='Select at least one folder containing notes or flashcards.';return;}
    try{
      const data=library.read(),source=$('quiz-source').value,items=selectQuestions(data,source,selected);
      if(!items.length)throw Error('Those folders are empty. Select another folder.');
      if(source==='flashcards'){begin(items.map(card=>({...card,source:data.flashcardFolders.find(f=>f.id===card.folderId)?.name||'Unfiled flashcards'})));return;}
      if(items.length>50)throw Error('Choose fewer folders: a test supports up to 50 notes.');
      controller=new AbortController();
      $('start-test').disabled=true;$('quiz-source').disabled=true;$('quiz-folders').disabled=true;$('quiz-status').textContent='Creating questions from your selected notes…';
      const response=await fetch('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:items.map(n=>({title:n.title,content:n.content}))}),signal:controller.signal});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Could not create the test.');begin(result.questions);
    }catch(error){if(error.name!=='AbortError')$('quiz-status').textContent=error.message;}
    finally{$('start-test').disabled=false;$('quiz-source').disabled=false;$('quiz-folders').disabled=false;}
  };
  $('reveal-test-answer').onclick=()=>{$('quiz-reveal').hidden=false;$('reveal-test-answer').hidden=true;};
  $('quiz-knew').onclick=()=>rate(true);$('quiz-again').onclick=()=>rate(false);
  $('review-missed').onclick=()=>begin(missed);
  $('new-test').onclick=reset;
  $('end-test').onclick=()=>{if(window.confirm('End this test and choose folders again?'))reset();};
}

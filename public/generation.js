export function setupGeneration(){
  const $=id=>document.getElementById(id);
  let timer=null;
  function stop(){if(timer!==null)clearInterval(timer);timer=null;$('notes').setAttribute('aria-busy','false');}
  function hide(){stop();$('generation-panel').hidden=true;$('save-form').hidden=false;}
  function start({slidesMode=false,files=[],createdAt=null}={}){
    stop();
    $('generation-panel').hidden=false;$('generation-panel').classList.remove('generation-error');
    $('generation-spinner').hidden=false;$('generation-error-actions').hidden=true;
    $('save-form').hidden=true;$('notes').setAttribute('aria-busy','true');
    $('generation-title').textContent=slidesMode?'Turning your slides into study notes…':'Creating your lecture notes…';
    $('generation-detail').textContent=slidesMode
      ? 'Your decks are being read and consolidated into one clear study guide.'
      : 'Your file is being uploaded and processed. Videos and large audio may also need compression before transcription.';
    $('generation-files').textContent=files.join(' · ');
    $('generation-elapsed').hidden=false;
    const started=createdAt?new Date(createdAt).getTime():Date.now();
    const tick=()=>{const seconds=Math.floor((Date.now()-started)/1000);$('generation-elapsed').textContent=`Time elapsed: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
    tick();timer=setInterval(tick,1000);
    if($('generation-stage-progress'))$('generation-stage-progress').hidden=true;
    $('generation-tip').textContent='This can take several minutes. Keep this tab open; your notes will appear here automatically.';
  }
  function fail(message,slidesMode=false){
    stop();$('generation-panel').hidden=false;$('generation-panel').classList.add('generation-error');
    $('generation-spinner').hidden=true;$('generation-elapsed').hidden=true;$('generation-error-actions').hidden=false;
    $('generation-title').textContent='We couldn’t create your notes';$('generation-detail').textContent=message;
    $('generation-tip').textContent='Your source files have not been changed. Return to your upload and try again.';
    $('generation-return').href=slidesMode?'#slides':'#lectures';
    $('save-form').hidden=true;
  }
  function update(job){
    $('generation-detail').textContent=job.message;
    $('generation-tip').textContent='Your job is saved on this computer. You may switch sections or reload this page; keep the app server running. Provider limits still apply.';
    const bar=$('generation-stage-progress'),label=$('generation-stage-label');
    const total=job.stage==='transcribing'?job.totalChunks:job.stage==='summarising'?job.totalSections:0;
    const completed=job.stage==='transcribing'?job.completedChunks:job.completedSections;
    if(bar){bar.hidden=!total;if(total){bar.max=total;bar.value=completed||0;label.textContent=`${job.stage==='transcribing'?'Audio sections transcribed':'Section notes written'}: ${completed||0} of ${total}`;}else label.textContent='';}
  }
  return {start,hide,fail,update};
}

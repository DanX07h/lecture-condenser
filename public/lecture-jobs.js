const KEY='lecture-condenser.active-job';
export function setupLectureJobs({onUpdate,onComplete,onOpen,onFailure,onClear}){
  const $=id=>document.getElementById(id);let id=null,job=null,timer=null,version=0;
  const remember=()=>{try{if(id)localStorage.setItem(KEY,id);else localStorage.removeItem(KEY);}catch{/* Current-page polling still works when browser storage is unavailable. */}};
  function render(){
    $('lecture-job-banner').hidden=!job;if(!job)return;
    $('lecture-job-message').textContent=job.status==='completed'?'Your lecture notes are ready.':job.status==='failed'?`Lecture paused: ${job.error}`:job.message;
    $('retry-lecture-job').hidden=job.status!=='failed';$('discard-lecture-job').textContent=['queued','running'].includes(job.status)?'Cancel job':'Dismiss job';
    $('open-lecture-job').textContent=job.status==='completed'?'Open notes':'View progress';
  }
  function schedule(token,delay=2000){clearTimeout(timer);timer=setTimeout(()=>poll(token),delay);}
  async function poll(token){
    try{
      const response=await fetch(`/api/jobs/${id}`,{cache:'no-store'});
      if(token!==version)return;
      if(response.status===404){clear();return;}
      const result=await response.json();if(!response.ok)throw Error(result.error||'Could not read job progress.');
      if(token!==version)return;job=result;render();onUpdate(job);
      if(job.status==='completed'){onComplete(job);return;}
      if(job.status==='failed'){onFailure(job);return;}
      schedule(token);
    }catch(error){if(token!==version)return;$('lecture-job-banner').hidden=false;$('lecture-job-message').textContent='Connection interrupted. Reconnecting to your saved lecture job…';schedule(token,5000);}
  }
  function attach(result){clearTimeout(timer);version++;id=result.id;job=result;remember();render();onUpdate(job);poll(version);}
  function clear(){clearTimeout(timer);version++;id=null;job=null;remember();render();onClear();}
  $('open-lecture-job').onclick=()=>{if(job)onOpen(job);};
  $('retry-lecture-job').onclick=async()=>{
    const token=version;$('retry-lecture-job').disabled=true;
    try{const response=await fetch(`/api/jobs/${id}/retry`,{method:'POST'});const result=await response.json();if(token!==version)return;if(!response.ok)throw Error(result.error);attach(result);}
    catch(error){$('lecture-job-message').textContent=error.message;}
    finally{$('retry-lecture-job').disabled=false;}
  };
  $('discard-lecture-job').onclick=async()=>{
    if(!window.confirm('Cancel/dismiss this lecture job and delete its server-side files? Notes you already saved in My notes will be kept.'))return;
    const token=version;
    try{const response=await fetch(`/api/jobs/${id}`,{method:'DELETE'});if(token!==version)return;if(!response.ok&&response.status!==404)throw Error('Could not cancel the job. Try again.');clear();}
    catch(error){$('lecture-job-message').textContent=error.message;}
  };
  function restore(){let saved;try{saved=localStorage.getItem(KEY);}catch{}if(saved){id=saved;job={id,status:'queued',message:'Reconnecting to your saved lecture job…'};render();onUpdate(job);poll(++version);}}
  return {attach,restore,get current(){return job;}};
}

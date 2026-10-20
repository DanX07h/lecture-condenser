const clamp=(value,min,max)=>Math.min(Math.max(value,min),max);
export function fitWindow(rect,viewport){
  const margin=8,availableWidth=Math.max(1,viewport.width-margin*2),availableHeight=Math.max(1,viewport.height-margin*2);
  const width=clamp(rect.width,Math.min(280,availableWidth),availableWidth);
  const height=clamp(rect.height,Math.min(240,availableHeight),availableHeight);
  return {left:clamp(rect.left,margin,Math.max(margin,viewport.width-margin-width)),top:clamp(rect.top,margin,Math.max(margin,viewport.height-margin-height)),width,height};
}
export function adjustWindow(rect,dx,dy,direction,viewport){
  const base=fitWindow(rect,viewport);
  if(direction==='move')return fitWindow({...base,left:base.left+dx,top:base.top+dy},viewport);
  const minWidth=Math.min(280,viewport.width-16),minHeight=Math.min(240,viewport.height-16);
  let left=base.left,top=base.top,right=left+base.width,bottom=top+base.height;
  if(direction.includes('w'))left=clamp(left+dx,8,right-minWidth);
  if(direction.includes('e'))right=clamp(right+dx,left+minWidth,viewport.width-8);
  if(direction.includes('n'))top=clamp(top+dy,8,bottom-minHeight);
  if(direction.includes('s'))bottom=clamp(bottom+dy,top+minHeight,viewport.height-8);
  return {left,top,width:right-left,height:bottom-top};
}
export function setupFloatingWindow(dialog){
  const header=dialog.querySelector('[data-window-drag]');let gesture=null;
  const viewport=()=>({width:window.innerWidth,height:window.innerHeight});
  function apply(rect){Object.assign(dialog.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',right:'auto',bottom:'auto'});}
  function refresh(){if(!dialog.open)return;const rect=dialog.getBoundingClientRect();if(rect.width>0&&rect.height>0)apply(fitWindow(rect,viewport()));}
  for(const target of [header,...dialog.querySelectorAll('[data-window-resize]')]){
    const direction=target.dataset.windowResize||'move';
    target.addEventListener('pointerdown',event=>{
      if(event.button!==0||(direction==='move'&&event.target.closest('button,input,textarea,select,a')))return;
      event.preventDefault();refresh();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,rect:dialog.getBoundingClientRect(),direction,target};
      target.setPointerCapture(event.pointerId);dialog.classList.add('window-adjusting');
    });
    target.addEventListener('pointermove',event=>{
      if(!gesture||event.pointerId!==gesture.id)return;
      apply(adjustWindow(gesture.rect,event.clientX-gesture.x,event.clientY-gesture.y,gesture.direction,viewport()));
    });
    const finish=()=>{gesture=null;dialog.classList.remove('window-adjusting');};
    target.addEventListener('pointerup',finish);target.addEventListener('pointercancel',finish);target.addEventListener('lostpointercapture',finish);
    target.addEventListener('keydown',event=>{
      if(event.target!==target||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();refresh();const step=event.shiftKey?30:10;
      const dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;
      const dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
      apply(adjustWindow(dialog.getBoundingClientRect(),dx,dy,direction,viewport()));
    });
  }
  dialog.addEventListener('close',()=>{gesture=null;dialog.classList.remove('window-adjusting');});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close();}});
  window.addEventListener('resize',refresh);
  return {refresh};
}

import {setupFloatingWindow} from './floating-window.js';
import {NoteLibrary,LIBRARY_KEY} from './library-store.js';
export function setupLibrary({onOpen,getCurrent}) {
  const $=id=>document.getElementById(id);
  const floatingWindow=setupFloatingWindow($('flashcard-editor'));
  let library,active='all',currentId=null,editingCard=null,cardActive='all';
  const tell=text=>{$('library-status').textContent=text;};
  function attempt(action){try{return action();}catch(error){tell(error.name==='QuotaExceededError'?'Browser storage is full. Download your notes before removing older saved notes. Nothing new was saved.':`Could not update your library: ${error.message}`);return null;}}
  function option(value,text){const el=document.createElement('option');el.value=value;el.textContent=text;return el;}
  function button(text,handler,selected=false){const el=document.createElement('button');el.type='button';el.textContent=text;el.className='plain'+(selected?' selected':'');el.onclick=handler;return el;}
  function render(){
    const data=library.read();
    for(const [id,count] of [['stat-notes',data.notes.length],['stat-folders',data.folders.length],['stat-cards',data.flashcards.length]])if($(id))$(id).textContent=String(count);
    if(!['all','unfiled'].includes(active)&&!data.folders.some(f=>f.id===active))active='all';
    const folders=$('folder-list');folders.replaceChildren();
    for(const [id,name] of [['all','All notes'],['unfiled','Unfiled'],...data.folders.map(f=>[f.id,f.name])]) {
      const count=data.notes.filter(n=>id==='all'||(id==='unfiled'?n.folderId===null:n.folderId===id)).length;
      folders.append(button(`${name} (${count})`,()=>{active=id;attempt(render);},active===id));
    }
    for(const id of ['save-folder','manual-folder']){
      const select=$(id),previous=select.value;select.replaceChildren(option('','Unfiled'),...data.folders.map(f=>option(f.id,f.name)));
      select.value=data.folders.some(f=>f.id===previous)?previous:'';
    }
    const cardSelect=$('flashcard-folder'),previousCardFolder=cardSelect.value;
    cardSelect.replaceChildren(option('','Unfiled'),...data.flashcardFolders.map(f=>option(f.id,f.name)));
    cardSelect.value=data.flashcardFolders.some(f=>f.id===previousCardFolder)?previousCardFolder:'';
    if(!['all','unfiled'].includes(cardActive)&&!data.flashcardFolders.some(f=>f.id===cardActive))cardActive='all';
    if($('review-folder')){
      $('review-folder').replaceChildren(option('all','All folders'),option('unfiled','Unfiled'),...data.flashcardFolders.map(f=>option(f.id,f.name)));
      $('review-folder').value=cardActive;
    }
    const selected=data.folders.find(f=>f.id===active);
    $('folder-title').textContent=selected?selected.name:active==='unfiled'?'Unfiled':'All notes';
    $('rename-folder').hidden=!selected;$('delete-folder').hidden=!selected;
    const list=$('saved-note-list');list.replaceChildren();
    const notes=data.notes.filter(n=>active==='all'||(active==='unfiled'?n.folderId===null:n.folderId===active));
    if(!notes.length){const p=document.createElement('p');p.textContent='No notes here yet. Save generated notes or write your own below.';list.append(p);}
    for(const note of notes){
      const card=document.createElement('div');card.className='saved-note';
      const open=button(note.title,()=>{onOpen(note.content);currentId=note.id;$('save-title').value=note.title;$('save-folder').value=note.folderId||'';$('save-note').textContent='Update saved note';tell(`Opened “${note.title}”. Choose another folder above and save to move it.`);$('notes').scrollIntoView({behavior:'smooth',block:'start'});});open.classList.add('note-title');
      const label=document.createElement('span');label.textContent=data.folders.find(f=>f.id===note.folderId)?.name || 'Unfiled';
      const remove=button('Delete',()=>{if(!window.confirm(`Delete “${note.title}”? This cannot be undone.`))return;attempt(()=>{library.deleteNote(note.id);if(currentId===note.id){currentId=null;$('save-note').textContent='Save notes to folder';}render();tell('Note deleted.');});});
      card.append(open,label,remove);list.append(card);
    }
    const cards=$('saved-flashcard-list');cards.replaceChildren();
    const filtered=data.flashcards.filter(c=>cardActive==='all'||(cardActive==='unfiled'?c.folderId===null:c.folderId===cardActive));
    $('rename-card-folder').hidden=['all','unfiled'].includes(cardActive);$('delete-card-folder').hidden=['all','unfiled'].includes(cardActive);
    $('flashcard-count').textContent=`Flashcards (${filtered.length})`;
    if(!filtered.length){const p=document.createElement('p');p.textContent='No flashcards here yet. Create one while reading your notes.';cards.append(p);}
    for(const card of filtered){
      const item=document.createElement('div');item.className='study-card';
      const question=document.createElement('h4');question.textContent=card.question;
      const answer=document.createElement('p');answer.className='flashcard-answer';answer.textContent=card.answer;answer.hidden=true;answer.id='answer-'+card.id;
      const flip=button('Show answer',()=>{answer.hidden=!answer.hidden;flip.textContent=answer.hidden?'Show answer':'Hide answer';flip.setAttribute('aria-expanded',String(!answer.hidden));});flip.setAttribute('aria-expanded','false');flip.setAttribute('aria-controls',answer.id);
      const label=document.createElement('span');label.className='card-folder';label.textContent=data.flashcardFolders.find(f=>f.id===card.folderId)?.name||'Unfiled';
      const edit=button('Edit / move',()=>openCard(card));
      const remove=button('Delete',()=>{if(!window.confirm('Delete this flashcard? This cannot be undone.'))return;attempt(()=>{library.deleteFlashcard(card.id);render();tell('Flashcard deleted.');});});
      const actions=document.createElement('div');actions.className='flashcard-actions';actions.append(flip,edit,remove);
      item.append(label,question,answer,actions);cards.append(item);
    }
  }
  function openCard(card=null){
    editingCard=card?.id||null;
    const selection=window.getSelection();
    const selected=selection?.anchorNode && $('notes').contains(selection.anchorNode) && $('notes').contains(selection.focusNode) ? selection.toString().slice(0,10000) : '';
    $('flashcard-question').value=card?.question||'';
    $('flashcard-answer').value=card?.answer||selected;
    if(card)$('flashcard-folder').value=card.folderId||'';
    else $('flashcard-folder').value=['all','unfiled'].includes(cardActive)?'':cardActive;
    $('flashcard-editor-heading').textContent=card?'Edit flashcard':'Create a personal flashcard';
    $('flashcard-feedback').textContent='';
    $('flashcard-editor').show();floatingWindow.refresh();
    $('flashcard-question').focus();
  }
  $('create-flashcard').onclick=()=>openCard();
  for(const action of document.querySelectorAll('[data-new-card]'))action.onclick=()=>openCard();
  if($('review-folder'))$('review-folder').onchange=()=>{cardActive=$('review-folder').value;attempt(render);};
  $('close-flashcard').onclick=()=>$('flashcard-editor').close();
  $('flashcard-form').onsubmit=event=>{
    event.preventDefault();
    try {
      library.saveFlashcard({id:editingCard,question:$('flashcard-question').value,answer:$('flashcard-answer').value,folderId:$('flashcard-folder').value||null});
      render();$('flashcard-editor').close();tell('Flashcard saved. Open Flashcards to review it.');
    } catch(error){$('flashcard-feedback').textContent=error.name==='QuotaExceededError'?'Browser storage is full. The flashcard was not saved.':error.message;}
  };
  attempt(()=>{library=new NoteLibrary(window.localStorage);render();});
  $('folder-form').onsubmit=event=>{event.preventDefault();attempt(()=>{active=library.createFolder($('folder-name').value);$('folder-name').value='';render();$('save-folder').value=active;$('manual-folder').value=active;tell('Folder created.');});};
  function closeSaveFolder(){
    $('save-folder-editor').hidden=true;$('new-save-folder').setAttribute('aria-expanded','false');$('save-folder-name').value='';$('save-folder-feedback').textContent='';$('new-save-folder').focus();
  }
  $('new-save-folder').onclick=()=>{
    $('save-folder-editor').hidden=false;$('new-save-folder').setAttribute('aria-expanded','true');$('save-folder-feedback').textContent='';$('save-folder-name').focus();
  };
  $('cancel-save-folder').onclick=closeSaveFolder;
  $('create-save-folder').onclick=()=>{
    try{
      const name=$('save-folder-name').value.trim();
      const id=library.createFolder(name);
      render();$('save-folder').value=id;closeSaveFolder();
      $('save-folder-feedback').textContent=`Folder “${name}” created and selected. Click Save notes to folder to save your notes.`;
    }catch(error){$('save-folder-feedback').textContent=error.name==='QuotaExceededError'?'Browser storage is full. The folder was not created.':error.message;}
  };
  $('save-folder-name').onkeydown=event=>{
    if(event.key==='Enter'){event.preventDefault();$('create-save-folder').click();}
    if(event.key==='Escape'){event.preventDefault();closeSaveFolder();}
  };
  $('save-form').onsubmit=event=>{event.preventDefault();attempt(()=>{const content=getCurrent();if(!content)throw Error('Generate or open notes first.');currentId=library.saveNote({id:currentId,title:$('save-title').value,content,folderId:$('save-folder').value||null});render();$('save-note').textContent='Update saved note';tell('Notes saved in this browser.');$('save-hint').textContent='Saved successfully. Find these notes in My notes.';});};
  $('manual-form').onsubmit=event=>{event.preventDefault();attempt(()=>{library.saveNote({title:$('manual-title').value,content:$('manual-content').value,folderId:$('manual-folder').value||null});$('manual-title').value='';$('manual-content').value='';render();tell('Your note was saved.');});};
  $('rename-folder').onclick=()=>{attempt(()=>{const folder=library.read().folders.find(f=>f.id===active);const name=window.prompt('Folder name',folder.name);if(name===null)return;library.renameFolder(active,name);render();tell('Folder renamed.');});};
  $('delete-folder').onclick=()=>{if(!window.confirm('Delete this folder? Its notes will be kept in Unfiled.'))return;attempt(()=>{library.deleteFolder(active);active='unfiled';render();tell('Notes folder deleted. Notes kept in Unfiled.');});};
  $('card-folder-form').onsubmit=event=>{event.preventDefault();attempt(()=>{cardActive=library.createFolder($('card-folder-name').value,'flashcards');$('card-folder-name').value='';render();$('flashcard-folder').value=cardActive;tell('Flashcard folder created.');});};
  $('rename-card-folder').onclick=()=>attempt(()=>{const folder=library.read().flashcardFolders.find(f=>f.id===cardActive);const name=window.prompt('Flashcard folder name',folder.name);if(name===null)return;library.renameFolder(cardActive,name,'flashcards');render();});
  $('delete-card-folder').onclick=()=>{if(!window.confirm('Delete this flashcard folder? Cards will be kept in Unfiled.'))return;attempt(()=>{library.deleteFolder(cardActive,'flashcards');cardActive='unfiled';render();tell('Flashcard folder deleted. Notes folders are unchanged.');});};
  window.addEventListener('storage',event=>{if(event.key===LIBRARY_KEY||event.key===null)attempt(render);});
  return {newNotes(text){currentId=null;$('save-note').disabled=false;$('save-title').disabled=false;$('save-hint').textContent='Choose a topic folder, then save. Your notes will appear in My notes.';$('save-title').value=(text.match(/^#\s+(.+)$/m)?.[1]||'Untitled notes').slice(0,160);$('save-note').textContent='Save notes to folder';attempt(render);}};
}

export const LIBRARY_KEY='lecture-condenser.library.v1';
export class NoteLibrary {
  constructor(storage){this.storage=storage;}
  read(){
    const raw=this.storage.getItem(LIBRARY_KEY);
    if(raw===null)return {version:1,folders:[],notes:[],flashcards:[],flashcardFolders:[]};
    const data=JSON.parse(raw);
    if(data.version!==1 || !Array.isArray(data.folders) || !Array.isArray(data.notes))throw Error('Saved library format is not recognised. Existing data has been preserved.');
    const ids=new Set();
    for(const folder of data.folders){if(typeof folder.id!=='string'||typeof folder.name!=='string'||ids.has(folder.id))throw Error('Saved folder data is invalid.');ids.add(folder.id);}
    const noteIds=new Set();
    for(const note of data.notes){if(typeof note.id!=='string'||typeof note.title!=='string'||typeof note.content!=='string'||!(note.folderId===null||ids.has(note.folderId))||noteIds.has(note.id))throw Error('Saved note data is invalid.');noteIds.add(note.id);}
    if(!Object.hasOwn(data,'flashcards'))data.flashcards=[];
    if(!Array.isArray(data.flashcards))throw Error('Saved flashcard format is invalid.');
    // Old versions shared folder IDs. Copy names/IDs once; future edits are independent.
    if(!Object.hasOwn(data,'flashcardFolders'))data.flashcardFolders=data.folders.map(folder=>({...folder}));
    if(!Array.isArray(data.flashcardFolders))throw Error('Saved flashcard folders are invalid.');
    const cardFolderIds=new Set();
    for(const folder of data.flashcardFolders){if(typeof folder.id!=='string'||typeof folder.name!=='string'||cardFolderIds.has(folder.id))throw Error('Saved flashcard folders are invalid.');cardFolderIds.add(folder.id);}
    const cardIds=new Set();
    for(const card of data.flashcards){if(typeof card.id!=='string'||typeof card.question!=='string'||typeof card.answer!=='string'||!(card.folderId===null||cardFolderIds.has(card.folderId))||cardIds.has(card.id))throw Error('Saved flashcard data is invalid.');cardIds.add(card.id);}
    return data;
  }
  change(action){
    const data=this.read();const result=action(data);
    // Persist before reporting success. A full/blocked browser store leaves old data intact.
    this.storage.setItem(LIBRARY_KEY,JSON.stringify(data));return result;
  }
  createFolder(name,kind='notes'){
    name=name.trim();if(!name || name.length>80)throw Error('Use a folder name between 1 and 80 characters.');
    return this.change(data=>{const folders=kind==='flashcards'?data.flashcardFolders:data.folders;if(folders.some(f=>f.name.toLowerCase()===name.toLowerCase()))throw Error('A folder with that name already exists.');const folder={id:crypto.randomUUID(),name};folders.push(folder);return folder.id;});
  }
  saveNote({id=null,title,content,folderId=null}){
    title=title.trim();if(!title||title.length>160||!content.trim())throw Error('Enter a title (up to 160 characters) and some notes.');
    return this.change(data=>{
      if(folderId!==null&&!data.folders.some(f=>f.id===folderId))throw Error('That folder no longer exists. Choose another folder.');
      let note=id?data.notes.find(n=>n.id===id):null;
      if(id&&!note)throw Error('That note no longer exists. Save it as a new note.');
      if(!note){note={id:crypto.randomUUID(),createdAt:new Date().toISOString()};data.notes.unshift(note);}
      Object.assign(note,{title,content,folderId,updatedAt:new Date().toISOString()});return note.id;
    });
  }
  saveFlashcard({id=null,question,answer,folderId=null}){
    question=question.trim();answer=answer.trim();
    if(!question||!answer||question.length>1000||answer.length>10000)throw Error('Enter a question (up to 1,000 characters) and answer (up to 10,000 characters).');
    return this.change(data=>{
      if(folderId!==null&&!data.flashcardFolders.some(f=>f.id===folderId))throw Error('That folder no longer exists. Choose another folder.');
      let card=id?data.flashcards.find(c=>c.id===id):null;
      if(id&&!card)throw Error('That flashcard no longer exists.');
      if(!card){card={id:crypto.randomUUID(),createdAt:new Date().toISOString()};data.flashcards.unshift(card);}
      Object.assign(card,{question,answer,folderId,updatedAt:new Date().toISOString()});return card.id;
    });
  }
  deleteFlashcard(id){this.change(data=>{data.flashcards=data.flashcards.filter(card=>card.id!==id);});}
  renameFolder(id,name,kind='notes'){
    name=name.trim();if(!name||name.length>80)throw Error('Use a folder name between 1 and 80 characters.');
    this.change(data=>{const folders=kind==='flashcards'?data.flashcardFolders:data.folders;const folder=folders.find(f=>f.id===id);if(!folder)throw Error('Folder not found.');if(folders.some(f=>f.id!==id&&f.name.toLowerCase()===name.toLowerCase()))throw Error('A folder with that name already exists.');folder.name=name;});
  }
  deleteFolder(id,kind='notes'){this.change(data=>{const key=kind==='flashcards'?'flashcardFolders':'folders';data[key]=data[key].filter(f=>f.id!==id);for(const item of (kind==='flashcards'?data.flashcards:data.notes))if(item.folderId===id)item.folderId=null;});}
  deleteNote(id){this.change(data=>{data.notes=data.notes.filter(note=>note.id!==id);});}
}

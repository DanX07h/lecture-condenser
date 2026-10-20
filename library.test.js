import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {NoteLibrary,LIBRARY_KEY} from './public/library-store.js';
import {setupLibrary} from './public/library.js';
function storage(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
test('notes survive reload, move between topics and remain after folder deletion',()=>{
 const disk=storage(),library=new NoteLibrary(disk);const first=library.createFolder('Biology'),second=library.createFolder('Chemistry');
 const id=library.saveNote({title:'Cells',content:'# Cells\n**Membranes** control transport.',folderId:first});
 const reloaded=new NoteLibrary(disk);assert.equal(reloaded.read().notes[0].title,'Cells');
 reloaded.saveNote({id,title:'Cell structure',content:'Updated content',folderId:second});
 assert.equal(reloaded.read().notes.length,1);assert.equal(reloaded.read().notes[0].folderId,second);
 reloaded.renameFolder(second,'Biochemistry');assert.equal(reloaded.read().folders[1].name,'Biochemistry');
 reloaded.deleteFolder(second);assert.equal(reloaded.read().notes[0].folderId,null);
 reloaded.deleteNote(id);assert.equal(reloaded.read().notes.length,0);
});
test('duplicate folders, missing folders and invalid saves leave persisted data unchanged',()=>{
 const disk=storage(),library=new NoteLibrary(disk);library.createFolder('Biology');const before=disk.getItem(LIBRARY_KEY);
 assert.throws(()=>library.createFolder(' biology '),/already exists/);
 assert.throws(()=>library.saveNote({title:'Notes',content:'Text',folderId:'missing'}),/no longer exists/);
 assert.throws(()=>library.saveNote({title:'',content:'Text'}),/Enter a title/);
 assert.equal(disk.getItem(LIBRARY_KEY),before);
});
test('storage failures and corrupt data do not overwrite existing notes',()=>{
 const disk=storage(),library=new NoteLibrary(disk);library.saveNote({title:'Important',content:'Keep this'});const before=disk.getItem(LIBRARY_KEY);
 disk.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};
 assert.throws(()=>library.createFolder('New'));assert.equal(disk.getItem(LIBRARY_KEY),before);
 const corrupt={getItem:()=>'{broken',setItem:()=>assert.fail('Must not overwrite corrupt data')};
 assert.throws(()=>new NoteLibrary(corrupt).createFolder('New'));
});
test('library UI saves, reopens and moves a note without duplicating it; handles titles safely',async()=>{
 const dom=new JSDOM(await readFile(new URL('./public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 const $=id=>document.getElementById(id);let current='# Topic\nSome useful notes.';let ui;
 $('notes').scrollIntoView=()=>{};window.confirm=()=>true;
 ui=setupLibrary({onOpen:text=>{current=text;ui.newNotes(text);},getCurrent:()=>current});
 ui.newNotes(current);$('folder-name').value='Biology';$('folder-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 const library=new NoteLibrary(window.localStorage),folderId=library.read().folders[0].id;
 $('save-title').value='<img src=x onerror=alert(1)>';$('save-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 assert.equal(library.read().notes.length,1);assert.equal(document.querySelector('.saved-note img'),null);
 document.querySelector('.note-title').click();$('save-folder').value='';$('save-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 assert.equal(library.read().notes.length,1);assert.equal(library.read().notes[0].folderId,null);
 $('manual-title').value='My own note';$('manual-content').value='A personal definition';$('manual-folder').value=folderId;$('manual-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 assert.equal(library.read().notes.length,2);
 dom.window.close();
});
test('main page exposes folder creation and save panel before notes exist',async()=>{
 const dom=new JSDOM(await readFile(new URL('./public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 const $=id=>document.getElementById(id);let content='';
 const ui=setupLibrary({onOpen:()=>{},getCurrent:()=>content});
 assert.equal($('save-form').hidden,false);assert.equal($('save-note').disabled,true);
 assert.equal(document.querySelectorAll('#folder-form').length,1);
 assert.ok(document.querySelector('.organiser-banner #folder-form'));
 $('folder-name').value='Psychology';$('folder-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 assert.equal($('save-folder').selectedOptions[0].textContent,'Psychology');
 content='# Memory\nMemory notes';ui.newNotes(content);
 assert.equal($('save-note').disabled,false);assert.equal($('save-title').disabled,false);
 $('save-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 assert.equal(new NoteLibrary(window.localStorage).read().notes[0].title,'Memory');
 assert.match($('save-hint').textContent,/Saved successfully/);
 dom.window.close();
});

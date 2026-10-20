import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {NoteLibrary,LIBRARY_KEY} from './public/library-store.js';
import {setupQuiz,selectQuestions} from './public/quiz.js';
import {generateQuiz} from './quiz-provider.js';
import {aiConfig} from './processing.js';
test('existing shared folders split without losing notes, cards or associations',()=>{
 const map=new Map([[LIBRARY_KEY,JSON.stringify({version:1,folders:[{id:'shared',name:'Biology'}],notes:[{id:'note',title:'Cells',content:'Membranes',folderId:'shared'}],flashcards:[{id:'card',question:'Cell boundary?',answer:'Membrane',folderId:'shared'}]})]]);
 const library=new NoteLibrary({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)});
 assert.equal(library.read().flashcardFolders[0].id,'shared');library.renameFolder('shared','Lecture notes');
 assert.equal(library.read().flashcardFolders[0].name,'Biology');
 library.deleteFolder('shared');assert.equal(library.read().notes[0].folderId,null);assert.equal(library.read().flashcards[0].folderId,'shared');
 library.renameFolder('shared','Biology revision','flashcards');library.deleteFolder('shared','flashcards');assert.equal(library.read().flashcards[0].folderId,null);
});
test('multi-folder selection isolates notes and cards and includes Unfiled',()=>{
 const data={notes:[{id:1,folderId:'a'},{id:2,folderId:'b'},{id:3,folderId:'c'}],flashcards:[{id:4,folderId:'a'},{id:5,folderId:null}]};
 assert.deepEqual(selectQuestions(data,'notes',['a','b']).map(n=>n.id),[1,2]);assert.deepEqual(selectQuestions(data,'flashcards',['a','unfiled']).map(n=>n.id),[4,5]);
});
test('note quiz validates sources and AI response; sends selected material only',async()=>{
 const original=globalThis.fetch;
 const config=aiConfig({AI_PROVIDER:'groq',GROQ_API_KEY:'test-placeholder'});
 try{
   globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.response_format.type,'json_object');assert.match(body.messages[1].content,/SOURCE 2: Chemistry/);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({questions:[{question:'What surrounds a cell?',answer:'A membrane',source:1},{question:'What is an atom?',answer:'A unit of an element',source:2}]})}}]})};};
   const result=await generateQuiz([{title:'Biology',content:'Cells have membranes.'},{title:'Chemistry',content:'Atoms are units of elements.'}],config);assert.equal(result.length,2);assert.equal(result[0].source,'Biology');
   await assert.rejects(()=>generateQuiz([null],config),/Choose folders/);
   await assert.rejects(()=>generateQuiz([{title:'Large',content:'a'.repeat(180001)}],config),/Too much material/);
   globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"questions":[{"question":"Q","answer":"A","source":9}]}'}}]})});
   await assert.rejects(()=>generateQuiz([{title:'Only',content:'Text'}],config),/incomplete test/);
 }finally{globalThis.fetch=original;}
});
test('flashcard test covers selected folders, hides answers, records self-assessment and retries missed cards',async()=>{
 const dom=new JSDOM(await readFile(new URL('./public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});globalThis.window=dom.window;globalThis.document=dom.window.document;
 const $=id=>document.getElementById(id);const library=new NoteLibrary(window.localStorage);
 const a=library.createFolder('A','flashcards'),b=library.createFolder('B','flashcards'),other=library.createFolder('Other','flashcards');
 library.saveFlashcard({question:'Question A',answer:'Answer A',folderId:a});library.saveFlashcard({question:'Question B',answer:'Answer B',folderId:b});library.saveFlashcard({question:'Excluded',answer:'Excluded',folderId:other});
 setupQuiz();$('open-test').click();$('quiz-source').value='flashcards';$('quiz-source').dispatchEvent(new window.Event('change'));
 $('start-test').click();assert.match($('quiz-status').textContent,/Select at least one/);
 for(const input of $('quiz-folder-options').querySelectorAll('input'))input.checked=[a,b].includes(input.value);
 $('start-test').click();assert.equal($('quiz-session').hidden,false);assert.equal($('quiz-reveal').hidden,true);assert.match($('quiz-progress').textContent,/1 of 2/);assert.ok(!$('quiz-question').textContent.includes('Excluded'));
 $('reveal-test-answer').click();$('quiz-knew').click();assert.match($('quiz-progress').textContent,/2 of 2/);assert.equal($('quiz-reveal').hidden,true);
 $('reveal-test-answer').click();$('quiz-again').click();assert.equal($('quiz-results').hidden,false);assert.match($('quiz-score').textContent,/1 of 2/);
 $('review-missed').click();assert.match($('quiz-progress').textContent,/1 of 1/);assert.equal($('quiz-reveal').hidden,true);
 dom.window.close();
});

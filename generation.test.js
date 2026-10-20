import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {setupGeneration} from './public/generation.js';
async function page(){const dom=new JSDOM(await readFile(new URL('./public/index.html',import.meta.url),'utf8'));globalThis.document=dom.window.document;return dom;}
test('generation loading panel shows processing context and resets on success',async()=>{
 const dom=await page();const $=id=>document.getElementById(id);const ui=setupGeneration();
 try{
 ui.start({files:['lecture.mp4']});assert.equal($('generation-panel').hidden,false);assert.equal($('save-form').hidden,true);assert.equal($('notes').getAttribute('aria-busy'),'true');assert.match($('generation-title').textContent,/lecture notes/);assert.equal($('generation-files').textContent,'lecture.mp4');assert.match($('generation-elapsed').textContent,/0:00/);
 ui.hide();assert.equal($('generation-panel').hidden,true);assert.equal($('save-form').hidden,false);assert.equal($('notes').getAttribute('aria-busy'),'false');
 ui.start({slidesMode:true,files:['week1.pptx','week2.pptx']});assert.match($('generation-title').textContent,/slides/);assert.match($('generation-files').textContent,/week2/);
 }finally{ui.hide();dom.window.close();}
});
test('failed generation removes spinner and presents safe error feedback with the correct return link',async()=>{
 const dom=await page();const $=id=>document.getElementById(id);const ui=setupGeneration();
 try{
 ui.start({slidesMode:true});ui.fail('<img src=x onerror=alert(1)> Provider rate limit',true);
 assert.equal($('generation-panel').hidden,false);assert.equal($('generation-spinner').hidden,true);assert.equal($('generation-elapsed').hidden,true);assert.equal($('generation-error-actions').hidden,false);assert.equal($('notes').getAttribute('aria-busy'),'false');assert.equal($('generation-return').getAttribute('href'),'#slides');assert.equal($('generation-detail').querySelector('img'),null);assert.match($('generation-detail').textContent,/Provider rate limit/);
 ui.start();assert.equal($('generation-panel').classList.contains('generation-error'),false);assert.equal($('generation-spinner').hidden,false);
 }finally{ui.hide();dom.window.close();}
});

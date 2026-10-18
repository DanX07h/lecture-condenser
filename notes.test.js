import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {marked} from 'marked';
import createDOMPurify from 'dompurify';
import {renderNotes} from './public/notes.js';
const window=new JSDOM('').window;
globalThis.marked=marked;
globalThis.DOMPurify=createDOMPurify(window);
test('renders study structure, key points and comparisons',()=>{
 const doc=new JSDOM(renderNotes('# Memory\n\n## Key takeaways\n> - **Recall** improves retention.\n\n## Review questions\n1. What is recall?\n\n| Term | Definition |\n| --- | --- |\n| Recall | Retrieval |')).window.document;
 assert.equal(doc.querySelector('h1').textContent,'Memory');
 assert.equal(doc.querySelector('blockquote strong').textContent,'Recall');
 assert.equal(doc.querySelectorAll('ol li').length,1);
 assert.equal(doc.querySelector('tbody td').textContent,'Recall');
});
test('removes executable HTML, remote media and unsafe links from generated notes',()=>{
 const html=renderNotes('# Safe heading\n\n<script>alert(1)</script>\n\n<img src="https://example.com/tracker" onerror="alert(1)">\n\n[click](javascript:alert%281%29)\n\n<iframe src="https://example.com"></iframe>\n\n<strong onclick="alert(1)">Important</strong>');
 const doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelector('h1').textContent,'Safe heading');
 assert.equal(doc.querySelector('strong').textContent,'Important');
 assert.equal(doc.querySelector('script,img,iframe,a,[onclick],[onerror]'),null);
});

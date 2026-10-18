import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {extract} from './processing.js';
test('extracts plain lecture text',async()=>assert.equal(await extract({originalname:'lecture.txt',buffer:Buffer.from('Retrieval practice improves retention.')}),'Retrieval practice improves retention.'));
test('extracts PowerPoint slides in numeric order',async()=>{const zip=new JSZip();zip.file('ppt/slides/slide10.xml','<a:t>Later &amp; last</a:t>');zip.file('ppt/slides/slide2.xml','<a:t>First concept</a:t>');const text=await extract({originalname:'slides.pptx',buffer:await zip.generateAsync({type:'nodebuffer'})});assert.ok(text.indexOf('First concept')<text.indexOf('Later & last'));});
test('rejects unsupported file formats',async()=>assert.rejects(()=>extract({originalname:'legacy.doc',buffer:Buffer.from('')}),/Unsupported/));

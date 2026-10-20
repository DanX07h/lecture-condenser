import test from 'node:test';
import assert from 'node:assert/strict';
import {fitWindow,adjustWindow} from './public/floating-window.js';
test('dragging is bounded so the window and close control remain on screen',()=>{
 const viewport={width:1200,height:800},rect={left:700,top:100,width:380,height:500};
 assert.deepEqual(adjustWindow(rect,-200,50,'move',viewport),{left:500,top:150,width:380,height:500});
 assert.deepEqual(adjustWindow(rect,9999,-9999,'move',viewport),{left:812,top:8,width:380,height:500});
});
test('top-left resizing grows or shrinks around the opposite corner with minimum sizes',()=>{
 const viewport={width:1200,height:800},rect={left:700,top:100,width:380,height:500};
 assert.deepEqual(adjustWindow(rect,-100,-50,'nw',viewport),{left:600,top:50,width:480,height:550});
 assert.deepEqual(adjustWindow(rect,9999,9999,'nw',viewport),{left:800,top:360,width:280,height:240});
 assert.deepEqual(adjustWindow(rect,-50,-100,'se',viewport),{left:700,top:100,width:330,height:400});
});
test('viewport changes fit an existing window on a small screen',()=>{
 const rect=fitWindow({left:1000,top:800,width:600,height:700},{width:390,height:500});
 assert.deepEqual(rect,{left:8,top:8,width:374,height:484});
});

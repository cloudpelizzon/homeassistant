import assert from 'node:assert/strict';
import {contentBounds736,fitPrintSnapshot736} from './printCapture736.js';
const width=600,height=200,data=new Uint8ClampedArray(width*height*4);
for(let i=0;i<data.length;i+=4)data.set([216,222,218,255],i);
const pixel=(x,y)=>data.set([0,90,180,255],(y*width+x)*4);
// Main house and two distant cars must all stay in the crop.
for(let y=50;y<150;y++)for(let x=220;x<330;x++)pixel(x,y);
pixel(380,140);pixel(405,155);
const before=data.slice(),box=contentBounds736(data,width,height);
assert.ok(box.x<220&&box.y<50&&box.x+box.width>405&&box.y+box.height>155);
assert.ok(box.width<250&&box.height<160);assert.deepEqual(data,before);
pixel(0,0);assert.equal(contentBounds736(data,width,height),null,'nonuniform corners must not be cropped');
const original={image:'invalid',width:1,height:1,camera:{yaw:20}};assert.equal(await fitPrintSnapshot736(original),original);
console.log('PASS: empty margins removed; complete house and both separated cars included; padding, source immutability and conservative fallback verified.');

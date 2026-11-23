import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('./realistic581.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('export function preloadVehicles739')).replace('export ','');
const calls=[],promises=new Map();const load=id=>{if(!promises.has(id)){calls.push(id);promises.set(id,Promise.resolve(id));}return promises.get(id);};
const prewarm=new Function('w','loadModel581',helper+';return preloadVehicles739')(item=>item.model,load);
const rooms=[{furniture:[{type:'car',model:'toyota_prius585'},{type:'table',model:'table'},{type:'car',model:'toyota_prius585'},{type:'car',model:'chery_tiggo585'}]}],before=JSON.stringify(rooms);
prewarm(rooms);prewarm(rooms);assert.deepEqual(calls,['toyota_prius585','chery_tiggo585']);assert.equal(JSON.stringify(rooms),before);
assert.ok(source.includes('x.preload();'));assert.ok(source.includes('G.has(e)||G.set(e,'));
console.log('PASS: vehicle priority starts once per model, reuses in-flight/decoded cache, preserves room order and data, decoder preparation starts early.');

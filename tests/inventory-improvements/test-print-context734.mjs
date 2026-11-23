import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./mapPrint592.js',import.meta.url),'utf8');
const expression=source.match(/l=(\{\.\.\.s,.*?graph:p\.document\})/)[1];
class Panel { async ws(operation,args){ assert.equal(this,owner); calls.push([operation,args]); return {ok:true}; } }
const calls=[],owner=new Panel();owner.data={settings:{house:{}}};
const topology={document:{nodes:[]}},context=new Function('s','p','return '+expression)(owner,topology);
await context.ws('catalog.model',{id:'toyota_prius585'});
await context.ws('catalog.photo',{id:'wall'});
assert.equal(calls.length,2);assert.equal(context.topologyData,topology);assert.equal(context.graph,topology.document);assert.equal(context.data,owner.data);
console.log('PASS: inherited panel model/photo requests retain original owner; saved data unchanged');

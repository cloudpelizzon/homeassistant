import assert from 'node:assert/strict';
import {prepareReport,reportHtml,buildWorkbook} from './reports.js';
import {loadReportInputs} from './moreCharts724.js';
import {createRequire} from 'node:module';
const Excel=createRequire(import.meta.url)('./exceljs-4.4.0.min.js');
const devices={filename:'devices.csv',columns:['Nome','Tipo','Fabricante','Modelo','IP / serviço','Situação do endereço','Ambiente','Responsável','Última observação'],rows:[['TV','Televisão','Samsung','Q60','','','Sala','Admin',1],['Sensor','Sensor','Tuya','X','','','Sala','Admin',1]]};
const assets=[{id:'tv',name:'TV',attributes:{warranty_until:'2027-01-01',purchase_value:1000}},{id:'sensor',name:'Sensor',attributes:{}}];
const relations={filename:'relations.csv',columns:['Origem','Destino','Relação','Confiança','Fonte','Observada em'],rows:[['Nextcloud','TrueNAS','hosted_on','manual','manual',1],['Roteador','DNS','connected_to','inferred','manual_placement',2]]};
const events=[{id:1,at:1,event:'device_edited',asset_id:'tv',detail:{audit:{actor:{name:'Admin'},device:{name:'TV'},changes:[{field:'location',before:null,after:'Sala'},{field:'owner',before:null,after:'Admin'}]}}},{id:2,at:2,event:'device_edited',asset_id:'sensor',asset_name:'Sensor',detail:{fields:['location','model']}},{id:3,at:3,event:'map.link',detail:{}}];
const history={filename:'history.csv',columns:[],rows:[[],[],[]],audit_events:events};
const reports=[prepareReport(devices,{devices,assets}),prepareReport(relations,{kind:'relations',devices,assets}),prepareReport(history,{kind:'history',devices,assets})];
assert.deepEqual(reports.map(r=>r.charts.length),[8,6,6]);
const titles=reports.map(r=>new Set(r.charts.map(c=>c.title)));for(let a=0;a<titles.length;a++)for(let b=a+1;b<titles.length;b++)assert(![...titles[a]].some(t=>titles[b].has(t)));
for(const r of reports.slice(1)){assert(!r.assetDetails);assert(!/Garantias|Valor de compra|Fabricantes|Sem área/.test(JSON.stringify(r.kpis)));assert(!/Lista completa de garantias|Equipamentos por fabricante|Equipamentos por área/.test(reportHtml(r)))}
assert.equal(reports[1].kpis[0][1],2);assert.equal(reports[1].charts.find(c=>c.title==='Sistemas hospedados por servidor').items[0][1],1);
const h=reports[2];assert.equal(h.kpis[0][1],3);assert.equal(h.kpis.find(k=>k[0]==='Com usuário registrado')[1],1);
const fields=h.charts.find(c=>c.title==='Campos com alterações comprovadas').items;
assert.deepEqual(fields.map(r=>r[0]).sort(),['Responsável','Área / cômodo'].sort());assert(!fields.some(r=>r[0]==='Modelo'));
assert.deepEqual(h.charts.find(c=>c.title==='Detalhamento das edições de cadastro').items.map(r=>r[1]),[1,0,1]);assert.equal(h.rows.length,4);
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9kAAAAASUVORK5CYII=';
for(const r of reports){const book=await buildWorkbook(r,Excel,async()=>png);assert.equal(book.getWorksheet('Resumo').getImages().length,r.charts.length+1);assert.equal(!!book.getWorksheet('Garantias e valores'),r.kind==='devices');assert.equal(book.getWorksheet('Detalhamento').rowCount,r.rows.length+4);}
for(const [kind,raw] of [['relations',relations],['history',history]]){let calls=[];const panel={_hass:{user:{id:'admin'}},isConnected:true,ws:async(op,args)=>{calls.push([op,args]);assert.equal(op,'report');assert.equal(args.kind,kind);return raw},snapshotCompatible710:()=>{throw Error('Unrelated device data requested')}};
 const loaded=await loadReportInputs(panel,kind);assert.equal(loaded.assets.length,0);assert.equal(calls.length,1);}
console.log('PASS: exclusive charts/KPIs across all three reports; no financial/warranty leakage; actual changed fields only; event-vs-field counts; matching workbook tabs/images; relation/history exports avoid unrelated device reads.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {reportHeader,HEADER_STYLES,TAGLINE,emissionText} from './reportHeader732.js';
import {mapReportDocument733} from './mapDocument733.js';
import {document3D593} from './print3D593.js';
import {prepareReport,reportHtml,buildWorkbook} from './reports.js';
const generated=new Date('2026-11-23T14:00:00Z'),head=reportHeader('Equipamentos',{generated});
assert(head.includes('Emissão: 23/11/2026, 11:00'));assert(!head.includes('Brasília'));assert(head.includes(TAGLINE));assert(head.includes('Logo oficial CloudPelizzon'));
assert(reportHeader('<script>x</script>').includes('&lt;script&gt;'));assert(HEADER_STYLES.includes('flex:0 0 auto'));assert(HEADER_STYLES.includes('white-space:nowrap'));
const data={filename:'devices.csv',columns:['Nome','Tipo','Fabricante','Modelo','IP / serviço','Situação do endereço','Ambiente','Responsável','Última observação'],rows:[['TV','Televisão','Samsung','Q60','','','Sala','Admin',1]]};
const assets=[{id:'tv',name:'TV',attributes:{location:'Sala'}}];
const devices=prepareReport(data,{assets}),relations=prepareReport({filename:'relations.csv',columns:['Origem','Destino','Relação','Confiança','Fonte','Observada em'],rows:[['Nextcloud','Servidor','hosted_on','manual','manual',1]]},{kind:'relations'}),history=prepareReport({filename:'history.csv',columns:[],rows:[[]],audit_events:[{id:1,at:1,event:'map.link',detail:{}}]},{kind:'history'});
for(const r of [devices,relations,history]){r.generated=generated;const html=reportHtml(r);assert.equal((html.match(/<header class="cp-report-header732">/g)||[]).length,1);assert(!html.includes('Horário de Brasília'));assert(!html.includes('11:00 · Brasília'));assert(html.includes('cp-report-tagline732'));}
const pages=[{title:'Mapa de redes',subtitle:'Recorte completo',body:'<svg id="network"><rect width="100" height="80"/></svg>'},{title:'Planta 2D - 1º andar',subtitle:'Medidas em metros',body:'<svg id="floor"><text>Ambientes salvos</text></svg>'}];
const map=mapReportDocument733(pages,{paper:'A4',showDevices:false,showFurniture:true,generated});
assert.equal((map.match(/<header class="cp-report-header732">/g)||[]).length,2);assert(map.includes('id="network"'));assert(map.includes('id="floor"'));assert(map.includes('display:none!important'));assert(map.includes('size:A4 landscape'));assert(map.includes('página 2/2'));assert(!map.includes('Horário de Brasília'));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9kAAAAASUVORK5CYII=';
const three=document3D593({image:png,width:1,height:1},{title:'Planta 3D',paper:'A3',note:'Câmera preservada'});
assert(three.includes('<header class="cp-report-header732">'));assert(three.includes('scene-print593'));assert(three.includes('size:A3 landscape'));assert(!three.includes('Horário de Brasília'));
const Excel=createRequire(import.meta.url)('./exceljs-4.4.0.min.js');
for(const r of [devices,relations,history]){
 const b=await buildWorkbook(r,Excel,async()=>png);const s=b.getWorksheet('Resumo');
 assert(s.getCell('A3').value===TAGLINE);assert(s.getCell('E1').value===r.title);assert(s.getCell('E2').value.startsWith('Emissão: '));assert(!s.getCell('E2').value.includes('Brasília'));
 assert.deepEqual(s.getCell('A1').fill.stops.map(v=>v.color.argb),['FF061A29','FF082A42']);assert.equal(s.getCell('E1').fill.stops.at(-1).color.argb,'FF0A3554');
 assert.equal(b.getWorksheet('Detalhamento').rowCount,r.rows.length+4);
}
fs.writeFileSync(new URL('./approved-institutional-preview.html',import.meta.url),reportHtml(devices));
fs.writeFileSync(new URL('./approved-map-preview.html',import.meta.url),map);
fs.writeFileSync(new URL('./approved-3d-preview.html',import.meta.url),three);
console.log('PASS: one approved header in every report family; right-light gradient; official logo; no timezone phrase in emission; shared Excel composition; A4/A3 map pages and full scene preserved.');

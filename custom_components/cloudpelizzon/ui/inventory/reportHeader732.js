import {LOGO} from './brand726.js?v=d1c63c4592a162fdce62d87717465cb0a30465420039ec10b972b7640c9f10ac';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const TAGLINE='CP-INVENTÁRIO - INFORMAÇÃO PARA CUIDAR DA SUA INSTALAÇÃO';
export function emissionText(value=new Date()){return new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
export const HEADER_STYLES=`
.cp-report-header732{position:relative;isolation:isolate;flex:0 0 auto;border:1px solid #296582;border-radius:16px;overflow:hidden;margin:0 0 10px;background:#061A29;print-color-adjust:exact;-webkit-print-color-adjust:exact;font-family:Arial,sans-serif}
.cp-report-top732{position:relative;display:grid;grid-template-columns:240px minmax(0,1fr);gap:24px;align-items:center;padding:14px 22px;min-height:108px;color:#fff}
.cp-report-bg732{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
.cp-report-logo732{display:block;width:240px;height:auto;max-height:82px;object-fit:contain;margin:0}
.cp-report-title732{min-width:0;text-align:right}
.cp-report-title732 h1{font-size:30px;font-weight:700;line-height:1.15;margin:0 0 8px;color:#fff;overflow-wrap:anywhere}
.cp-report-title732 p{font-size:11.5px;font-weight:500;line-height:1.3;margin:0;color:#DDEFFC}
.cp-report-tagline732{display:block;margin:0;padding:9px 22px;background:#F3F8FC;color:#163248;font-size:11.5px;font-weight:700;line-height:1.3;white-space:nowrap;border-bottom:3px solid #0080FC}
@media screen and (max-width:600px){.cp-report-top732{grid-template-columns:180px minmax(0,1fr);gap:12px;padding:12px}.cp-report-logo732{width:180px}.cp-report-title732 h1{font-size:22px}.cp-report-tagline732{font-size:9px;padding:8px 12px}}
@media print{.cp-report-header732{break-inside:avoid}.cp-report-top732{grid-template-columns:240px minmax(0,1fr);gap:24px}.cp-report-title732 h1{font-size:30px}.cp-report-tagline732{font-size:11.5px}}
`;
export function reportHeader(title,{generated=new Date()}={}){
 return '<header class="cp-report-header732"><div class="cp-report-top732"><svg class="cp-report-bg732" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 300" preserveAspectRatio="none"><defs><linearGradient id="cp-institutional732" gradientUnits="userSpaceOnUse" x1="825" y1="-175" x2="175" y2="475"><stop offset="0" stop-color="#0A3554"/><stop offset=".65" stop-color="#082A42"/><stop offset="1" stop-color="#061A29"/></linearGradient><radialGradient id="cp-institutional-glow732" gradientUnits="userSpaceOnUse" cx="830" cy="30" r="480"><stop offset="0" stop-color="#1F8EE7" stop-opacity=".26"/><stop offset="1" stop-color="#1F8EE7" stop-opacity="0"/></radialGradient></defs><rect width="1000" height="300" fill="url(#cp-institutional732)"/><rect width="1000" height="300" fill="url(#cp-institutional-glow732)"/></svg><img class="cp-report-logo732" src="'+LOGO+'" alt="Logo oficial CloudPelizzon"><div class="cp-report-title732"><h1>'+esc(title)+'</h1><p>Emissão: '+esc(emissionText(generated))+'</p></div></div><div class="cp-report-tagline732">'+TAGLINE+'</div></header>';
}
export function institutionalFill(side='right'){
 return {type:'gradient',gradient:'angle',degree:0,stops:side==='left'?[{position:0,color:{argb:'FF061A29'}},{position:1,color:{argb:'FF082A42'}}]:[{position:0,color:{argb:'FF082A42'}},{position:.7,color:{argb:'FF10466B'}},{position:1,color:{argb:'FF0A3554'}}]};
}
export function excelInstitutionalHeader(sheet,logoId,title,{columns=12,split=5,generated=new Date()}={}){
 columns=Math.max(2,columns);const leftEnd=Math.max(1,Math.min(columns-1,split-1));

 sheet.mergeCells(1,1,2,leftEnd);sheet.mergeCells(1,leftEnd+1,1,columns);sheet.mergeCells(2,leftEnd+1,2,columns);sheet.mergeCells(3,1,3,columns);
 sheet.getRow(1).height=46;sheet.getRow(2).height=24;sheet.getRow(3).height=25;
 const left=sheet.getCell(1,1),heading=sheet.getCell(1,leftEnd+1),date=sheet.getCell(2,leftEnd+1),tag=sheet.getCell(3,1);
 left.fill=institutionalFill('left');for(const c of [heading,date]){c.fill=institutionalFill();c.alignment={horizontal:'right',vertical:'middle',wrapText:true};}
 heading.value=title;heading.font={name:'Arial',size:24,bold:true,color:{argb:'FFFFFFFF'}};
 date.value='Emissão: '+emissionText(generated);date.font={name:'Arial',size:11,color:{argb:'FFDDEFFC'}};
 tag.value=TAGLINE;tag.font={name:'Arial',size:11,bold:true,color:{argb:'FF163248'}};tag.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F8FC'}};tag.alignment={vertical:'middle',wrapText:false};
 sheet.addImage(logoId,{tl:{col:.15,row:.1},ext:{width:240,height:80.2}});
}

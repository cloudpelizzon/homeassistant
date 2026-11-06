/* Local exports, using the already reviewed Excel writer shipped by CloudPelizzon. */
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function writer(){
 if(globalThis.ExcelJS)return globalThis.ExcelJS;
 if(!globalThis.__CPInventoryExcel506)globalThis.__CPInventoryExcel506=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/cloudpelizzon-maintenance/frontend/exceljs-4.4.0.min.js';
  script.onload=()=>globalThis.ExcelJS?resolve(globalThis.ExcelJS):reject(Error('local_excel_unavailable'));
  script.onerror=()=>{globalThis.__CPInventoryExcel506=null;reject(Error('local_excel_unavailable'));};document.head.append(script);
 });
 return globalThis.__CPInventoryExcel506;
}
export async function saveXlsx(report){
 const Excel=await writer(),book=new Excel.Workbook();book.creator='CloudPelizzon';book.created=new Date();
 const sheet=book.addWorksheet('Inventário',{views:[{state:'frozen',ySplit:1}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
 sheet.columns=report.columns.map((header,index)=>({header,key:'c'+index,width:index===0?35:25}));
 for(const values of report.rows){const row=sheet.addRow(values.map((v,i)=>typeof v==='number'&&['Data','Última observação','Observada em'].includes(report.columns[i])?new Date(v*1000):v));row.eachCell(cell=>{cell.alignment={vertical:'top',wrapText:true};if(cell.value instanceof Date)cell.numFmt='dd/mm/yyyy hh:mm';});}
 sheet.getRow(1).height=27;sheet.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'},size:11};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123D55'}};cell.alignment={vertical:'middle'};});
 sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:report.columns.length}};
 const data=await book.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');link.href=url;link.download=report.filename.replace(/\.csv$/i,'.xlsx');link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function printReport(report){
 const old=document.querySelector('iframe[data-cp-inventory-print]');old?.remove();
 const frame=document.createElement('iframe');frame.dataset.cpInventoryPrint='true';frame.title='Impressão do relatório CP-Inventário';frame.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0';
 frame.srcdoc=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${escape(report.filename.replace('.csv',''))}</title><style>@page{size:A4 landscape;margin:14mm}body{font:10px Arial;color:#163248}h1{font-size:22px;margin-bottom:4px}p{color:#577282}table{border-collapse:collapse;width:100%;margin-top:20px}thead{display:table-header-group}tr{break-inside:avoid}th{background:#123d55;color:white}th,td{text-align:left;padding:8px;border:1px solid #c9d8e2;overflow-wrap:anywhere}footer{margin-top:20px;color:#617b8d;font-size:9px}</style><h1>CloudPelizzon · CP-Inventário</h1><p>Relatório local · ${escape(new Date().toLocaleString('pt-BR'))}</p><table><thead><tr>${report.columns.map(c=>`<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${report.rows.map(row=>`<tr>${row.map((v,i)=>`<td>${escape(typeof v==='number'&&['Data','Última observação','Observada em'].includes(report.columns[i])?new Date(v*1000).toLocaleString('pt-BR'):v)}</td>`).join('')}</tr>`).join('')}</tbody></table><footer>Dados do inventário da instalação. A última observação não comprova disponibilidade atual.</footer></html>`;
 frame.onload=()=>{frame.contentWindow.focus();frame.contentWindow.print();};document.body.append(frame);
}

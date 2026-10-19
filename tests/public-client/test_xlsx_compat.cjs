const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const ExcelJS=require(path.resolve(process.argv[2])),zip=require(path.resolve(process.argv[3]));
const ctx={Date,console,TextDecoder,TextEncoder};vm.createContext(ctx);vm.runInContext(fs.readFileSync(process.argv[4],'utf8').replace(/^export /gm,''),ctx);
const cells=n=>Array.from({length:n},(_,i)=>({text:i===n-1?'R$ 100,00':'Campo '+i,span:1}));
const model={title:'Relatório de teste',identity:'Dados fictícios',meta:'2026',kind:'Lançamentos realizados',kpis:[{label:'Economia',value:'R$ 100,00'}],sections:[{title:'Lançamentos realizados',rows:[{kind:'head',cells:cells(12)},{kind:'body',cells:cells(12)}]}],footer:'Teste'};
(async()=>{
 const book=ctx.buildWorkbook(model,ExcelJS),raw=await book.xlsx.writeBuffer(),original=zip.unzipSync(new Uint8Array(raw));
 const fixed=ctx.normalizeXlsx(raw,zip),files=zip.unzipSync(fixed),xml=zip.strFromU8(files['xl/worksheets/sheet1.xml']);
 assert(!xml.includes('defaultColWidth'));assert(!xml.includes('dyDescent'));
 assert.equal((xml.match(/<col /g)||[]).length,12);
 for(let i=1;i<=12;i++)assert(xml.includes(`min="${i}" max="${i}"`));
 const styles=zip.strFromU8(files['xl/styles.xml']);assert(!styles.includes('knownFonts'));
 assert(/<cellStyle name="Normal" xfId="0" builtinId="0"\/>/.test(styles));
 assert(!styles.includes('Calibri'));assert(!/<scheme\b/.test(styles));
 assert(!xml.includes('4294967295'));
 const read=new ExcelJS.Workbook();await read.xlsx.load(fixed);assert.equal(read.worksheets[0].getCell('L13').value,100);
 read.eachSheet(s=>s.eachRow(r=>r.eachCell(c=>assert.equal(c.font.name,'Arial'))));
 assert(read.worksheets[0].model.merges.includes('A1:L1'));assert.equal(read.worksheets[0].pageSetup.orientation,'landscape');
 for(const name of Object.keys(original)){
   if(/^xl\/worksheets\/sheet\d+\.xml$/.test(name)){
     const data=s=>zip.strFromU8(s).match(/<sheetData>[\s\S]*?<\/sheetData>/)[0].replace(/ x14ac:dyDescent="[^"]*"/g,'');
     assert.equal(data(original[name]),data(files[name]));
   }else if(name!=='xl/styles.xml')assert.deepEqual(original[name],files[name]);
 }
 const synthetic='<worksheet><sheetFormatPr defaultColWidth="18" defaultRowHeight="22"/><cols><col min="1" max="12" width="18" customWidth="1"/></cols><sheetData/></worksheet>';
 const normalized=ctx.normalizeWorksheetXML(synthetic);assert(!normalized.includes('defaultColWidth'));assert.equal((normalized.match(/<col /g)||[]).length,12);
 fs.writeFileSync(process.argv[5],fixed);
 console.log(JSON.stringify({explicit_columns:12,no_global_width:true,values_unchanged:true,merges_preserved:true,print_preserved:true,opaque_zip_parts_unchanged:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

/* Finance XLSX: use the same report content as the printable PDF. */
const BASE='/cloudpelizzon-maintenance/frontend';
let libraryPromise;
export async function excelLibrary(){
  if(window.ExcelJS?.Workbook)return window.ExcelJS;
  if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=BASE+'/exceljs-4.4.0.min.js?v=7e49da68588e';
    script.onload=()=>window.ExcelJS?.Workbook?resolve(window.ExcelJS):reject(Error('Gerador Excel indisponível.'));
    script.onerror=()=>reject(Error('Não foi possível carregar o gerador Excel.'));
    document.head.append(script);
  }).catch(error=>{libraryPromise=null;throw error});
  return libraryPromise;
}
let zipPromise;
async function zipLibrary(){
  if(window.fflate?.unzipSync)return window.fflate;
  if(!zipPromise)zipPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=BASE+'/fflate-0.8.3.min.js?v=119';
    script.onload=()=>window.fflate?.zipSync?resolve(window.fflate):reject(Error('Conversor Excel indisponível.'));
    script.onerror=()=>reject(Error('Não foi possível carregar o conversor Excel.'));
    document.head.append(script);
  }).catch(error=>{zipPromise=null;throw error});
  return zipPromise;
}
export function normalizeWorksheetXML(xml){
  // Emit explicit per-column widths, matching the compatible workbook that
  // renders correctly in the independent workbook preview.
  xml=xml.replace(/<sheetFormatPr\b[^>]*\/>/,tag=>tag
    .replace(/ (?:defaultColWidth|outlineLevelRow|outlineLevelCol|customHeight|x14ac:dyDescent)="[^"]*"/g,''));
  xml=xml.replace(/<cols>([\s\S]*?)<\/cols>/,(_,columns)=>'<cols>'+columns.replace(/<col\b[^>]*\/>/g,tag=>{
    const min=Number(/\bmin="(\d+)"/.exec(tag)?.[1]),max=Number(/\bmax="(\d+)"/.exec(tag)?.[1]);
    if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max<min||max>12)throw Error('Colunas inválidas no relatório Excel.');
    const attributes=tag.replace(/<col\b|\/>/g,'').replace(/\s(?:min|max|hidden)="[^"]*"/g,'');
    return Array.from({length:max-min+1},(_,i)=>`<col min="${min+i}" max="${min+i}"${attributes} hidden="0"/>`).join('');
  })+'</cols>');
  return xml.replace(/ x14ac:dyDescent="[^"]*"/g,'')
    .replace(/ (?:horizontalDpi|verticalDpi)="4294967295"/g,'');
}
export function normalizeXlsx(buffer,zip){
  const files=zip.unzipSync(new Uint8Array(buffer)),decoder=new TextDecoder(),encoder=new TextEncoder();
  let count=0;
  for(const name of Object.keys(files)){
    if(/^xl\/worksheets\/sheet\d+\.xml$/.test(name)){
      files[name]=encoder.encode(normalizeWorksheetXML(decoder.decode(files[name])));count++;
    }else if(name==='xl/styles.xml'){
      let xml=decoder.decode(files[name]).replace(/ x14ac:knownFonts="[^"]*"/g,'');
      // Match font-property order and alignment from the workbook writer whose
      // output rendered correctly in the independent workbook preview.
      const order=['b','i','u','strike','outline','shadow','condense','extend','sz','color','name','family','charset','scheme','vertAlign'];
      xml=xml.replace(/<font>([\s\S]*?)<\/font>/g,(_,body)=>{
        const children=body.match(/<\w+\b[^>]*\/>/g)||[];
        if(children.join('')!==body)throw Error('Fonte inválida no relatório Excel.');
        children.sort((a,b)=>order.indexOf(/^<(\w+)/.exec(a)[1])-order.indexOf(/^<(\w+)/.exec(b)[1]));
        return '<font>'+children.join('')+'</font>';
      }).replace(/ indent="1"/g,'');
      // Native Excel verification of report 119 confirmed this explicit font
      // policy. Do not leave the Normal style dependent on the theme font.
      xml=xml.replace(/<font>([\s\S]*?)<\/font>/g,(_,body)=>
        '<font>'+body.replace(/<name val="[^"]*"\/>/,'<name val="Arial"/>')
          .replace(/<scheme\b[^>]*\/>/g,'')+'</font>');
      files[name]=encoder.encode(xml);
    }
  }
  if(!count)throw Error('O arquivo Excel não contém planilhas.');
  return zip.zipSync(files,{level:6});
}

const text=node=>(node?.textContent||'').replace(/\u00a0/g,' ').trim();
export function reportModel(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  return {title:text(doc.querySelector('h1')),identity:text(doc.querySelector('.brand-details>small')),
    meta:text(doc.querySelector('.meta')),kind:text(doc.querySelector('.report-kind')),
    logo:doc.querySelector('.report-logo img')?.getAttribute('src')||'',
    kpis:[...doc.querySelectorAll('.kpis>div')].map(n=>({label:text(n.querySelector('small')),value:text(n.querySelector('b'))})),
    sections:[...doc.querySelectorAll('section.report-section')].map(section=>({title:text(section.querySelector('h2')),
      rows:[...section.querySelectorAll('table tr')].map(row=>({kind:row.closest('thead')?'head':row.closest('tfoot')?'total':'body',
        cells:[...row.children].map(c=>({text:text(c),span:Number(c.getAttribute('colspan')||1),signal:c.className||''}))}))})),
    footer:text(doc.querySelector('footer'))};
}
function cellValue(value){
  const match=/^([+-]?)R\$\s*([\d.,]+)$/.exec(value);
  if(!match)return value;
  const number=Number(match[2].replace(/\./g,'').replace(',','.'));
  return Number.isFinite(number)?(match[1]==='-'?-number:number):value;
}
const MONEY='"R$" #,##0.00;[Red]-"R$" #,##0.00';
const COLORS=['FFFFF1F1','FFEEFCF4','FFEDF8FF','FFF6F0FF','FFFFF7EA','FFFFFBE8'];
const EDGES=['FFDC6B72','FF55AD7A','FF55A9D8','FF9270C7','FFD69B52','FFCFB333'];
export function buildWorkbook(inputModel,ExcelJS,logoData=null,extraModels=[]){
  const model=inputModel;
  if(!model?.title||!model.sections?.length)throw Error('O relatório não contém seções para exportar.');
  const book=new ExcelJS.Workbook();book.creator='CloudPelizzon';book.created=new Date();
  const names={'Lançamentos realizados':'Lançamentos','Fechamento mensal':'Fechamento Mensal','Resumo financeiro por categoria':'Por Categoria','Comparativo das últimas manutenções':'Comparativo','Comparativo por empresa / profissional':'Empresas','Provisão no período selecionado':'Provisão','Histórico financeiro detalhado':'Histórico'};
  const layouts=[{name:model.kind==='Relatório completo'?'Resumo':names[model.kind]||'Relatório',model}];
  if(model.kind==='Relatório completo'){
    const order=['Lançamentos','Fechamento Mensal','Por Categoria','Comparativo','Empresas','Provisão','Histórico'];
    const individual=model.sections.map(section=>({name:names[section.title]||section.title.slice(0,31),model:{...model,kind:section.title,sections:[section]}}));
    for(const extra of extraModels)individual.push({name:names[extra.kind]||extra.kind.slice(0,31),model:extra});
    individual.sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name));layouts.push(...individual);
  }
  for(const layout of layouts){
  const model=layout.model;
  const sheet=book.addWorksheet(layout.name,{properties:{defaultRowHeight:22},
    views:[{state:'normal',showGridLines:false,zoomScale:85}],
    pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,
      margins:{left:.25,right:.25,top:.35,bottom:.35,header:.1,footer:.15}}});
  for(let c=1;c<=12;c++)sheet.getColumn(c).width=18;
  const fill=color=>({type:'pattern',pattern:'solid',fgColor:{argb:color}});
  function merged(row,left,right,value,options={}){
    if(right>left)sheet.mergeCells(row,left,row,right);
    const cell=sheet.getCell(row,left);cell.value=cellValue(String(value??''));
    cell.font={name:'Arial',family:2,size:options.size||11,bold:!!options.bold,color:{argb:'FF17202A'}};
    cell.alignment={vertical:'middle',horizontal:typeof cell.value==='number'?'right':'left',wrapText:true,indent:1};
    if(typeof cell.value==='number')cell.numFmt=String(value).startsWith('+')?'+'+MONEY:MONEY;
    if(options.fill)cell.fill=fill(options.fill);
    if(options.border)cell.border=options.border;
    return cell;
  }
  const first=logoData?2:1;
  merged(1,first,12,model.title,{size:20,bold:true});sheet.getRow(1).height=36;
  merged(2,first,12,model.identity,{size:10});
  merged(3,first,12,model.meta,{size:10});
  merged(4,first,12,model.kind,{fill:'FFEEF8F2',bold:true});
  if(logoData){
    const image=book.addImage({base64:logoData,extension:'png'});
    sheet.addImage(image,{tl:{col:0,row:0},br:{col:1,row:3},editAs:'oneCell'});
  }
  merged(5,1,12,'',{border:{bottom:{style:'medium',color:{argb:'FF149454'}}}});sheet.getRow(5).height=12;
  model.kpis.slice(0,6).forEach((k,i)=>{
    const left=i*2+1,right=left+1,border={left:{style:'thick',color:{argb:EDGES[i]}}};
    merged(7,left,right,k.label,{size:10,fill:COLORS[i],border});
    merged(8,left,right,k.value,{size:14,bold:true,fill:COLORS[i],border});
  });sheet.getRow(7).height=22;sheet.getRow(8).height=30;
  let row=10;
  for(const section of model.sections){
    merged(row,1,12,section.title,{size:16,bold:true,border:{bottom:{style:'medium',color:{argb:'FF149454'}}}});
    sheet.getRow(row).height=32;row+=2;
    const header=section.rows.find(r=>r.kind==='head');
    const columns=header?.cells||[];if(!columns.length)continue;
    const weights=columns.map(c=>Math.max(9,Math.min(28,c.text.length+3)));
    if(columns.length>12)throw Error('O relatório excede o limite de 12 colunas.');
    // Keep every report field in a conventional Excel column; distribute spare
    // columns by the largest fractional remainder so merged ranges never overlap.
    const sum=weights.reduce((a,b)=>a+b,0),spare=12-columns.length;
    const shares=weights.map(w=>w*spare/sum),sizes=shares.map(w=>1+Math.floor(w));
    const ranked=shares.map((w,i)=>({i,fraction:w-Math.floor(w)})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
    for(let left=12-sizes.reduce((a,b)=>a+b,0),i=0;left>0;left--,i++)sizes[ranked[i].i]++;
    const boundaries=[1];for(const width of sizes)boundaries.push(boundaries.at(-1)+width);
    for(const data of section.rows){
      let logical=0,height=28;
      for(const value of data.cells){
        const next=Math.min(logical+value.span,sizes.length),left=boundaries[logical],right=boundaries[next]-1;
        if(!left||right<left)continue;
        const background=data.kind==='head'?'FFEEF4F6':data.kind==='total'?'FFEAF4EF':
          String(value.signal||'').includes('signal-up')?'FFFFF4F1':String(value.signal||'').includes('signal-down')?'FFF1FAF5':String(value.signal||'').includes('signal-stable')?'FFFFFBEA':null;
        merged(row,left,right,value.text,{bold:data.kind!=='body',fill:background,
          border:data.kind==='total'?{top:{style:'thin',color:{argb:'FF79A98D'}}}:{bottom:{style:'hair',color:{argb:'FFDCE3E8'}}}});
        height=Math.max(height,Math.ceil(value.text.length/Math.max(8,(right-left+1)*17))*15+8);
        logical=next;
      }
      sheet.getRow(row).height=Math.min(120,height);row++;
    }
    row+=2;
  }
  merged(row,1,12,model.footer,{size:10});sheet.getRow(row).height=30;
  sheet.pageSetup.printArea=`A1:L${row}`;
  sheet.headerFooter.oddFooter='&CCloudPelizzon — Página &P de &N';
  }
  return book;
}
async function logoPng(source){
  if(!source)return null;
  try{
    const image=new Image();image.crossOrigin='anonymous';
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=source});
    const canvas=document.createElement('canvas');const ratio=Math.min(200/image.naturalWidth,200/image.naturalHeight,1);
    canvas.width=200;canvas.height=200;
    const width=image.naturalWidth*ratio,height=image.naturalHeight*ratio;
    canvas.getContext('2d').drawImage(image,(200-width)/2,(200-height)/2,width,height);return canvas.toDataURL('image/png');
  }catch{return null;}
}
export async function exportReport(html,filename,extraReports=[]){
  const model=reportModel(html),ExcelJS=await excelLibrary();
  const book=buildWorkbook(model,ExcelJS,await logoPng(model.logo),extraReports.map(reportModel));
  const buffer=normalizeXlsx(await book.xlsx.writeBuffer(),await zipLibrary());
  const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}


// Automation inventory uses the same local Excel writer and compatibility normalization.
export async function exportInventory151(rows,filename){
  const ExcelJS=await excelLibrary(),book=new ExcelJS.Workbook();
  book.creator='CloudPelizzon';const sheet=book.addWorksheet('Automações',{views:[{state:'frozen',ySplit:4}]});
  sheet.columns=[18,64,26,22,18,28].map(width=>({width}));
  sheet.mergeCells('A1:F1');sheet.getCell('A1').value='CloudPelizzon · Inventário de automações';
  sheet.mergeCells('A2:F2');sheet.getCell('A2').value='Exportado em '+new Date().toLocaleString('pt-BR');
  sheet.getRow(1).height=34;sheet.getRow(2).height=24;
  rows.forEach((values,i)=>{const row=sheet.getRow(i+4);row.values=values.map(v=>String(v??''));row.height=i?42:30;
    row.eachCell(cell=>{cell.font={name:'Arial',size:11,bold:!i,color:{argb:i?'FF183349':'FFFFFFFF'}};
      cell.alignment={vertical:'middle',wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:i?(i%2?'FFF0F6F8':'FFFFFFFF'):'FF087B83'}};
      cell.border={bottom:{style:'thin',color:{argb:'FFDCE3E8'}}};});
  });
  sheet.getCell('A1').font={name:'Arial',size:18,bold:true,color:{argb:'FF087B83'}};
  sheet.getCell('A2').font={name:'Arial',size:11,color:{argb:'FF536474'}};
  sheet.autoFilter={from:{row:4,column:1},to:{row:4,column:6}};
  sheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:4'};
  const buffer=normalizeXlsx(await book.xlsx.writeBuffer(),await zipLibrary());
  const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

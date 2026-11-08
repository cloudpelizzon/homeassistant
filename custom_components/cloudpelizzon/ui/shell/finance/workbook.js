'use strict';

// Inline strings keep descriptions literal in Excel, including text beginning with "=".
function financeWorkbook(sheets) {
  const encode = new TextEncoder();
  const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = new Map();
  const add = (path, contents) => files.set(path, encode.encode(declaration + contents));
  const relationships = items => '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    items.map(([type, target], i) => '<Relationship Id="rId'+(i+1)+'" Type="'+rel+'/'+type+'" Target="'+target+'"/>').join('') + '</Relationships>';
  const targets = sheets.map((_, i) => 'worksheets/sheet'+(i+1)+'.xml');
  const drawings = sheets.map((sheet, i) => sheet.chart &&
    sheet.rows.slice(sheet.header+1).some(row=>row.slice(1).some(Number.isFinite)) ? i+1 : 0).filter(Boolean);
  const override = (path,type) => '<Override PartName="/xl/'+path+'" ContentType="application/vnd.openxmlformats-officedocument.'+type+'+xml"/>';
  add('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    override('workbook.xml','spreadsheetml.sheet.main') + override('styles.xml','spreadsheetml.styles') +
    targets.map(path => override(path,'spreadsheetml.worksheet')).join('') +
    drawings.map(n => override('drawings/drawing'+n+'.xml','drawing') +
      override('charts/chart'+n+'.xml','drawingml.chart')).join('') + '</Types>');
  add('_rels/.rels', relationships([['officeDocument', 'xl/workbook.xml']]));
  add('xl/_rels/workbook.xml.rels', relationships([...targets.map(path => ['worksheet', path]),['styles','styles.xml']]));
  add('xl/styles.xml', financeWorkbookStyles(ns));
  add('xl/workbook.xml', '<workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><bookViews><workbookView/></bookViews><sheets>' +
    sheets.map((sheet, i) => '<sheet name="'+xml(sheet.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('') + '</sheets></workbook>');
  function column(index) {
    let name = '';
    for (let n = index+1; n > 0; n = Math.floor((n-1)/26)) name = String.fromCharCode(65+(n-1)%26) + name;
    return name;
  }
  sheets.forEach((sheet, i) => {
    const n = i+1;
    const widths = sheet.widths;
    const last = column(widths.length-1);
    const rows = sheet.rows.map((row, r) => {
      const title = r === 0, header = r === sheet.header || r === sheet.section;
      const note = sheet.merges.includes(r) && !title && !header;
      const lines = Math.max(1,...row.map((value,c)=>typeof value==='string'
        ? value.split('\n').reduce((count,line)=>count+Math.max(1,Math.ceil(line.length/Math.max(8,widths[c]-4))),0) : 1));
      const height = title ? 36 : header ? 25 : note ? 32 : Math.min(140,Math.max(23,lines*15+7));
      return '<row r="'+(r+1)+'" ht="'+height+'" customHeight="1">'+
        Array.from({length:title||header ? widths.length : row.length},(_,c) => {
      const value = row[c];
      const ref = column(c)+(r+1);
      const amount = sheet.currency?.(r,c);
      const date = sheet.dates?.includes(c) && r > sheet.header && /^\d{4}-\d{2}-\d{2}$/.test(value);
      const serial = date ? (Date.parse(value)-Date.UTC(1899,11,30))/86400000 : null;
      const style = title ? 1 : header ? 2 : note ? 3 : (date ? 8 : amount ? 6 : 4)+(r%2);
      if (date && Number.isFinite(serial)) return '<c r="'+ref+'" s="'+style+'"><v>'+serial+'</v></c>';
      if (typeof value === 'number' && Number.isFinite(value)) return '<c r="'+ref+'" s="'+style+'"><v>'+value+'</v></c>';
      if (value === undefined || value === null) return '<c r="'+ref+'" s="'+style+'"/>';
      return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
    }).join('')+'</row>';
    }).join('');
    const filter = sheet.filter ? '<autoFilter ref="A'+(sheet.header+1)+':'+last+sheet.rows.length+'"/>' : '';
    const merges = sheet.merges.map(r => '<mergeCell ref="A'+(r+1)+':'+last+(r+1)+'"/>').join('');
    const drawing = drawings.includes(n);
    add('xl/'+targets[i], '<worksheet xmlns="'+ns+'" xmlns:r="'+rel+'"><sheetViews><sheetView showGridLines="0" workbookViewId="0">'+
      '<pane ySplit="'+(sheet.header+1)+'" topLeftCell="A'+(sheet.header+2)+'" activePane="bottomLeft" state="frozen"/>'+
      '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="23"/><cols>'+
      widths.map((width,c)=>'<col min="'+(c+1)+'" max="'+(c+1)+'" width="'+width+'" customWidth="1"/>').join('')+
      '</cols><sheetData>'+rows+'</sheetData>'+filter+'<mergeCells count="'+sheet.merges.length+'">'+merges+'</mergeCells>'+
      (drawing ? '<drawing r:id="rId1"/>' : '')+'</worksheet>');
    if (drawing) {
      add('xl/worksheets/_rels/sheet'+n+'.xml.rels',relationships([['drawing','../drawings/drawing'+n+'.xml']]));
      add('xl/drawings/_rels/drawing'+n+'.xml.rels',relationships([['chart','../charts/chart'+n+'.xml']]));
      add('xl/drawings/drawing'+n+'.xml',financeChartDrawing(n,widths.length,rel));
      add('xl/charts/chart'+n+'.xml',financeChartXml(sheet,column,xml));
    }
  });
  return financeZip(files, encode);
}

function financeWorkbookStyles(ns) {
  const colors = ['0B2238','116883','E6F3FB','FFFFFF','F1F7FC'];
  const fills = ['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',
    ...colors.map(color=>'<fill><patternFill patternType="solid"><fgColor rgb="FF'+color+'"/><bgColor indexed="64"/></patternFill></fill>')];
  const fonts = [[11,'173650',false],[20,'FFFFFF',true],[11,'FFFFFF',true],[10,'345871',false]];
  const formats = [[0,0,0],[1,2,0],[2,3,0],[3,4,0],[0,5,0],[0,6,0],[0,5,164],[0,6,164],[0,5,165],[0,6,165]];
  return '<styleSheet xmlns="'+ns+'"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00"/>'+
    '<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="'+fonts.length+'">'+fonts.map(([size,color,bold])=>
      '<font><name val="Calibri"/><sz val="'+size+'"/><color rgb="FF'+color+'"/>'+(bold?'<b/>':'')+'</font>').join('')+
    '</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="'+formats.length+'">'+formats.map(([font,fill,number])=>'<xf numFmtId="'+number+'" fontId="'+font+'" fillId="'+fill+
      '" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf>').join('')+
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

function financeChartDrawing(id, start, rel) {
  const anchor = (tag, col, row) => '<xdr:'+tag+'><xdr:col>'+col+'</xdr:col><xdr:colOff>90000</xdr:colOff>'+
    '<xdr:row>'+row+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:'+tag+'>';
  return '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="'+rel+'">'+
    '<xdr:twoCellAnchor>'+anchor('from',start,1)+anchor('to',start+9,18)+
    '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="'+id+'" name="Gráfico CloudPelizzon"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'+
    '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'+
    '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame>'+
    '<xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>';
}

function financeChartXml(sheet,column,xml) {
  const pie = sheet.chart === 'doughnut', line = sheet.chart === 'line';
  const type = pie ? 'doughnutChart' : line ? 'lineChart' : 'barChart';
  const first = sheet.header+2, last = sheet.rows.length;
  const prefix = "'"+sheet.name.replaceAll("'","''")+"'!$";
  const colors = ['0E8A81','356BC4','B76C24','805BC8','CB5676','167E9D'];
  const categories = sheet.rows.slice(first-1).map(row=>row[0]);
  const reference = (tag,formula,values) => '<c:'+tag+'Ref><c:f>'+xml(formula)+'</c:f><c:'+tag+'Cache>'+
    (tag==='num' ? '<c:formatCode>General</c:formatCode>' : '')+'<c:ptCount val="'+values.length+'"/>'+
    values.map((value,i)=>value===null ? '' : '<c:pt idx="'+i+'"><c:v>'+xml(value)+'</c:v></c:pt>').join('')+'</c:'+tag+'Cache></c:'+tag+'Ref>';
  const series = sheet.rows[sheet.header].slice(1,pie?2:undefined).map((label,i) => {
    const col = column(i+1), paint = '<a:solidFill><a:srgbClr val="'+colors[i%colors.length]+'"/></a:solidFill>';
    const shape = line ? '<a:ln w="28575">'+paint+'</a:ln>' : paint;
    const points = pie ? categories.map((_,j)=>'<c:dPt><c:idx val="'+j+'"/><c:spPr><a:solidFill><a:srgbClr val="'+
      colors[j%colors.length]+'"/></a:solidFill></c:spPr></c:dPt>').join('') : '';
    return '<c:ser><c:idx val="'+i+'"/><c:order val="'+i+'"/><c:tx>'+
      reference('str',prefix+col+'$'+(sheet.header+1),[label])+'</c:tx><c:spPr>'+shape+'</c:spPr>'+points+
      '<c:cat>'+reference('str',prefix+'A$'+first+':$A$'+last,categories)+'</c:cat><c:val>'+
      reference('num',prefix+col+'$'+first+':$'+col+'$'+last,
        sheet.rows.slice(first-1).map(row=>typeof row[i+1]==='number'?row[i+1]:null))+'</c:val></c:ser>';
  }).join('');
  const currency = sheet.widths.slice(1).some((_,i)=>sheet.currency?.(first-1,i+1));
  const axis = (tag,id,cross,pos) => '<c:'+tag+'><c:axId val="'+id+'"/><c:scaling><c:orientation val="minMax"/></c:scaling>'+
    '<c:axPos val="'+pos+'"/>'+(tag==='valAx'&&currency ? '<c:numFmt formatCode="&quot;R$&quot; #,##0.00" sourceLinked="0"/>' : '')+
    '<c:crossAx val="'+cross+'"/><c:crosses val="autoZero"/></c:'+tag+'>';
  return '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart>'+
    '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>'+xml(sheet.rows[0][0])+'</a:t></a:r></a:p></c:rich></c:tx></c:title>'+
    '<c:plotArea><c:'+type+'>'+(pie?'<c:varyColors val="1"/>':(line?'':'<c:barDir val="col"/>')+'<c:grouping val="'+(line?'standard':'clustered')+'"/>')+
    series+(pie?'<c:holeSize val="55"/>':'<c:axId val="10"/><c:axId val="20"/>')+'</c:'+type+'>'+
    (pie?'':axis('catAx',10,20,'b')+axis('valAx',20,10,'l'))+'</c:plotArea>'+
    '<c:legend><c:legendPos val="b"/></c:legend><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
}

function financeZip(files, encode) {
  const crcTable = Uint32Array.from({length:256}, (_, n) => {
    for (let bit = 0; bit < 8; bit++) n = (n & 1 ? 0xedb88320 : 0) ^ (n >>> 1);
    return n;
  });
  const chunks = [], directory = [];
  let offset = 0, directorySize = 0;
  const header = (length, fields) => {
    const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
    for (const [at, value, wide] of fields) {
      if (wide) view.setUint32(at, value, true);
      else view.setUint16(at, value, true);
    }
    return bytes;
  };
  for (const [path, data] of files) {
    const name = encode.encode(path);
    let crc = 0xffffffff;
    for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc ^= 0xffffffff;
    const local = header(30, [[0,0x04034b50,true],[4,20],[12,33],[14,crc,true],
      [18,data.length,true],[22,data.length,true],[26,name.length]]);
    const entry = header(46, [[0,0x02014b50,true],[4,20],[6,20],[14,33],[16,crc,true],
      [20,data.length,true],[24,data.length,true],[28,name.length],[42,offset,true]]);
    chunks.push(local, name, data);
    directory.push(entry, name);
    offset += local.length + name.length + data.length;
    directorySize += entry.length + name.length;
  }
  const end = header(22, [[0,0x06054b50,true],[8,files.size],[10,files.size],
    [12,directorySize,true],[16,offset,true]]);
  return new Blob([...chunks, ...directory, end], {
    type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

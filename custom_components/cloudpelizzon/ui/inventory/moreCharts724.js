/* Complete report charts from authorized, paginated Inventory reads. */
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const missing=v=>v===null||v===undefined||String(v).trim()===''||['nao informado','nao definida','nao definido','unknown','unassigned','-'].includes(norm(v));
const field=(columns,names)=>columns.findIndex(c=>names.some(n=>norm(c)===norm(n)));
const counts=(rows,index,empty)=>{const out=new Map();for(const row of rows){const raw=row[index],label=missing(raw)?empty:String(raw).trim();out.set(label,(out.get(label)||0)+1)}return [...out].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'))};
const limited=items=>items.length<=10?items:[...items.slice(0,9),['Outros',items.slice(9).reduce((s,r)=>s+r[1],0)]];
const chart=(title,items,description='',unit='count')=>({title,items,description,unit});
const money=v=>{if(typeof v==='number')return Number.isFinite(v)&&v>=0?v:null;if(typeof v==='string'&&v.trim()){const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}return null};
const todayKey=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const validDay=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return null;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:null};
export function moreCharts(report,rawDevices,assets=[],now=new Date()){
 const rows=rawDevices.rows||[],cols=rawDevices.columns||[],idx=names=>field(cols,names);
 const type=idx(['Tipo','Tipo de equipamento']),owner=idx(['Responsável']),area=idx(['Ambiente','Área / cômodo']),brand=idx(['Fabricante','Marca']),model=idx(['Modelo']),address=idx(['IP / serviço','Endereços informados']);
 report.charts.push(chart('Equipamentos por tipo',limited(counts(rows,type,'Tipo não informado'))),
 chart('Equipamentos por responsável',limited(counts(rows,owner,'Responsável não informado'))));
 const gaps=[['Sem área / cômodo',area],['Sem fabricante',brand],['Sem modelo',model],['Sem responsável',owner]].map(([label,i])=>[label,rows.filter(r=>missing(r[i])).length]);
 report.charts.push(chart('Pendências do cadastro',gaps,'Um equipamento pode ter várias pendências; as barras não devem ser somadas como total de equipamentos.'));
 report.charts.push(chart('Endereços de rede informados',[
 ['Com endereço informado',rows.filter(r=>!missing(r[address])).length],
 ['Sem endereço informado',rows.filter(r=>missing(r[address])).length]
 ],'Ter endereço cadastrado não comprova que o equipamento esteja online.'));
 const today=validDay(todayKey(now)),cutoff=new Date(today+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()+30);const limit=cutoff.toISOString().slice(0,10);
 const warranty=new Map([['Vencida',0],['Vence em até 30 dias',0],['Válida por mais de 30 dias',0],['Não informada',0],['Data inválida',0]]);
 const values=new Map();let known=0,total=0;
 for(const a of assets){const attrs=a.attributes||{},end=validDay(attrs.warranty_until);const label=missing(attrs.warranty_until)?'Não informada':!end?'Data inválida':end<today?'Vencida':end<=limit?'Vence em até 30 dias':'Válida por mais de 30 dias';warranty.set(label,warranty.get(label)+1);
 const n=money(attrs.purchase_value);if(n!==null){known++;total+=n;const name=attrs.location||attrs.ha_area_name||'Área não informada';values.set(name,(values.get(name)||0)+n)}}
 report.charts.push(chart('Situação das garantias',[...warranty],'Classificação pela data final cadastrada, na data de emissão. Garantia com vencimento hoje ainda é considerada válida.'));
 const grouped=[...values].sort((a,b)=>b[1]-a[1]);
 report.charts.push(chart('Valor de compra por área (R$)',limited(grouped),known+' de '+assets.length+' equipamentos têm valor de compra válido informado. Valores ausentes não entram na soma; este gráfico não estima o valor atual.','currency'));
 report.kpis.push(['Garantias vencidas',warranty.get('Vencida')],['Com valor de compra',known],['Valor de compra informado',total,'currency']);
 report.assetDetails=assets.map(a=>{const v=a.attributes||{};return [a.name,v.location||v.ha_area_name||'Não informada',v.warranty_until||'Não informada',money(v.purchase_value)]});
 report.note+=' As pendências podem se sobrepor. Endereço informado não confirma disponibilidade. Garantias e valores usam somente o cadastro, sem estimativas.';
 return report;
}
export function relationshipCharts(report,raw){
 const idx=names=>field(raw.columns,names),kind=idx(['Relação','Tipo de vínculo']),target=idx(['Destino','Relacionado a']),origin=idx(['Origem','Equipamento']),source=idx(['Fonte','Origem da informação']),confirmation=idx(['Confiança','Como foi confirmado']),at=idx(['Observada em','Última observação']);
 const hosted=raw.rows.filter(r=>r[kind]==='hosted_on');
 report.kpis=[['Vínculos no relatório',raw.rows.length],['Origens identificadas',new Set(raw.rows.map(r=>r[origin]).filter(v=>!missing(v))).size],['Destinos identificados',new Set(raw.rows.map(r=>r[target]).filter(v=>!missing(v))).size],['Sem data de observação',raw.rows.filter(r=>missing(r[at])).length]];
 report.charts=[
 chart('Tipos de vínculo registrados',limited(counts(report.rows,2,'Tipo não informado')),'Conta os relacionamentos incluídos nesta exportação; não é a quantidade total de equipamentos.'),
 chart('Sistemas hospedados por servidor',limited(counts(hosted,target,'Servidor não informado')),'Cada barra conta vínculos de hospedagem; um sistema pode possuir mais de um vínculo.'),
 chart('Origem das informações dos vínculos',limited(counts(report.rows,5,'Origem não registrada'))),
 chart('Como os vínculos foram confirmados',limited(counts(report.rows,4,'Confirmação não registrada'))),
 chart('Destinos com mais vínculos',limited(counts(report.rows,1,'Destino não informado')),'Um mesmo destino pode receber vínculos de rede, hospedagem ou outros tipos.'),
 chart('Vínculos por data de observação',periodCounts(raw.rows.map(r=>r[at]),v=>{if(v instanceof Date)return v;if(typeof v==='number')return new Date(v<1e12?v*1000:v);return v?new Date(v):null}),'Data registrada na fonte. Não indica que o vínculo esteja ativo agora.')
 ];
 report.note='Este relatório analisa somente os '+raw.rows.length+' vínculos retornados pela exportação, que pode ter escopo diferente da topologia. Origens e destinos são contados pelos nomes registrados. Hospedagem de sistemas indica onde um programa ou máquina virtual funciona, como Nextcloud hospedado no TrueNAS. Vínculos informados ou calculados não comprovam ligação física por cabo ou disponibilidade atual. Horários de Brasília.';
}
function periodCounts(values,date){
 const days=new Map();for(const value of values){const d=date(value);if(!d||!Number.isFinite(d.getTime()))continue;const key=todayKey(d);days.set(key,(days.get(key)||0)+1)}
 let items=[...days].sort((a,b)=>a[0].localeCompare(b[0]));
 if(items.length>10){const months=new Map();for(const [day,n] of items){const month=day.slice(0,7);months.set(month,(months.get(month)||0)+n)}items=[...months]}
 if(items.length>10){const width=Math.ceil(items.length/10),bins=[];for(let i=0;i<items.length;i+=width){const group=items.slice(i,i+width);bins.push([group[0][0]+' a '+group.at(-1)[0],group.reduce((sum,row)=>sum+row[1],0)])}items=bins}
 return items;
}
export function activityCharts(report,events,date,eventView=e=>({action:e.event,name:e.asset_name,actor:e.detail?.audit?.actor?.name||'Não registrado',changes:[]})){
 const views=events.map(e=>eventView(e)),edits=events.filter(e=>['device_edited','device.edit'].includes(e.event)),named=events.filter(e=>e.asset_id);

 // Changes are grouped using the shared translated view, never the submitted legacy field list.
 const translated=edits.flatMap(e=>eventView(e).changes.map(c=>[c.field]));
 const withChanges=edits.filter(e=>Array.isArray(e.detail?.audit?.changes)&&e.detail.audit.changes.length).length;
 const noChange=edits.filter(e=>Array.isArray(e.detail?.audit?.changes)&&!e.detail.audit.changes.length).length;
 report.kpis=[['Atividades no relatório',events.length],['Edições de cadastro',edits.length],['Equipamentos identificados',new Set(named.map(e=>e.asset_id)).size],['Com usuário registrado',views.filter(v=>v.actor&&v.actor!=='Não registrado').length]];
 report.charts=[
 chart('Atividades por período',periodCounts(events.map(e=>e.at),date),'Somente os eventos exportados, em Brasília. Períodos longos são agrupados por mês ou faixa de meses. Eventos sem data válida ficam fora deste gráfico. Datas sem evento não são mostradas.'),
 chart('Tipos de atividade no histórico',limited(counts(views.map(v=>[v.action]),0,'Outra atividade'))),
 chart('Equipamentos com mais atividades',limited(counts(named.map(e=>[eventView(e).name]),0,'Equipamento sem nome no registro')),'Inclui somente eventos com identificação de equipamento. Atividades gerais do sistema ficam fora deste gráfico.'),
 chart('Campos com alterações comprovadas',limited(counts(translated,0,'Campo não identificado')),'Somente diferenças anteriores/atuais efetivamente registradas. A lista de campos enviada em registros antigos não comprova alteração.'),
 chart('Usuários registrados nas atividades',limited(counts(views.map(v=>[v.actor]),0,'Não registrado')),'Não registrado significa que o evento não armazenou a autoria; nenhum usuário foi presumido.'),
 chart('Detalhamento das edições de cadastro',[['Com valores anteriores e atuais',withChanges],['Salvas sem mudança acompanhada',noChange],['Sem comparação registrada',edits.length-withChanges-noChange]],'O total deste gráfico corresponde somente às edições de cadastro, e não a todas as atividades.')
 ];
 report.note='Histórico limitado aos '+events.length+' eventos incluídos nesta exportação. Cada evento é contado uma vez nos indicadores de atividades; uma edição pode gerar várias linhas de campos no detalhamento. Registros sem autoria ou valores anteriores permanecem como Não registrado. Horários de Brasília.';
}

export async function loadReportInputs(panel,kind){
 const actor=panel._hass?.user?.id,check=()=>{if(!panel.isConnected||actor!==panel._hass?.user?.id)throw Error('Sessão alterada. Gere o relatório novamente.')};
 const raw=await panel.ws('report',{kind});check();
 if(kind!=='devices'){
  const events=kind==='history'?(raw.audit_events||await panel.ws('history')):[];check();
  if(kind==='history'&&!raw.audit_events&&events.length!==(raw.rows||[]).length)throw Error('Histórico incompleto. Atualize a integração antes de exportar.');
  return {raw,events,assets:[],devices:{columns:[],rows:[]}};
 }

 const devices=kind==='devices'?raw:await panel.ws('report',{kind:'devices'});check();
 let assets=[],expected=null,page=0;
 do{const s=await panel.snapshotCompatible710({query:'',category:'',page,candidate_page:0,candidate_page_size:1});check();
 const count=Number(s.filtered_count);if(!Number.isInteger(count)||count<0)throw Error('Não foi possível conferir a lista completa do inventário.');
 if(expected===null)expected=count;else if(expected!==count)throw Error('O inventário mudou durante a exportação. Tente novamente.');
 const batch=s.devices||[];if(!batch.length&&assets.length<expected)throw Error('A lista de equipamentos está incompleta. Tente novamente.');
 assets.push(...batch);page++;if(page>10000)throw Error('O inventário excedeu o limite seguro de paginação.');
 }while(assets.length<expected);
 if(new Set(assets.map(a=>a.id)).size!==expected||assets.length!==expected||devices.rows.length!==expected)throw Error('O inventário mudou durante a exportação. Tente novamente.');
 const names=items=>items.reduce((m,n)=>(m.set(n,(m.get(n)||0)+1),m),new Map());
 const aNames=names(assets.map(a=>a.name)),rNames=names(devices.rows.map(r=>r[0]));
 if(aNames.size!==rNames.size||[...aNames].some(([name,n])=>rNames.get(name)!==n))throw Error('O inventário mudou durante a exportação. Tente novamente.');
 const events=kind==='history'?(raw.audit_events||await panel.ws('history')):[];check();
 return {raw,devices,assets,events};
}

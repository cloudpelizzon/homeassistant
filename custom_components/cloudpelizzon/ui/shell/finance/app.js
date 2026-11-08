'use strict';
const $ = (s, root = document) => root.querySelector(s);
const main = $('#main');
let state, overview, csrf, route = 'overview', privateValues = false, submitForm;
const BRL = new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'});
const money = n => Number.isFinite(n) ? BRL.format(n / 100) : 'Indisponível';
const humanDate = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado';
const names = {
  overview:'Visão geral',reports:'Relatórios',transactions:'Lançamentos',accounts:'Contas',cards:'Cartões',calendar:'Calendário',budgets:'Orçamentos',subscriptions:'Assinaturas',goals:'Metas',projects:'Projetos e reformas',properties:'Imóveis',categories:'Categorias',assets:'Patrimônio da casa',maintenance:'Manutenção em números',utilities:'Consumo e mobilidade',investments:'Investimentos',quotes:'Cotações',trades:'Operações',documents:'Documentos',imports:'Importar extrato',recurrences:'Recorrências',requests:'Aprovações',reimbursements:'Divisões e reembolsos',users:'Pessoas e permissões',settings:'Preferências',audit:'Histórico de alterações',connections:'Integrações'
};
const groups = [
  ['PAINÉIS',['overview',...Object.keys(hubNames),'reports']],
  ['SEU DINHEIRO',['transactions','accounts','cards','calendar']],
  ['SEUS PLANOS',['budgets','subscriptions','goals','projects','investments']],
  ['SUA CASA',['properties','assets','maintenance','utilities','contracts']],
  ['ORGANIZAÇÃO',['recurrences','requests','reimbursements','documents','imports','categories']],
  ['GESTÃO',['users','settings','audit','connections']]
];
names.contracts='Seguros e contratos';
Object.assign(names,hubNames);
const symbols=['◈','↗','▤','▣','◷','▥','↻','◎','⌂','◉'];
const descriptions = {
  reports:'Combine indicadores, gráficos e lançamentos do período para consultar, imprimir ou exportar.',
  transactions:'Receitas, despesas e transferências com rastreabilidade. Rascunhos aguardam sua conferência.',
  accounts:'Separe o dinheiro do dia a dia, a reserva da casa e os compromissos do cartão.',
  subscriptions:'Antecipe renovações, aumentos e o fim das promoções.',
  assets:'Valores de aquisição e depreciação anual vinculados aos equipamentos.',
  maintenance:'Compare gastos e referências documentadas. Economia estimada fica separada do dinheiro em conta.',
  utilities:'Relacione consumo, tarifas e custo de uso da casa ou do veículo. Premissas sempre visíveis.',
  investments:'Acompanhe suas posições e consulte as cotações de referência disponíveis.',
  projects:'Planeje sua reforma e acompanhe o que foi orçado, comprometido e realizado.',
  documents:'Guarde e visualize recibos, contas e contratos junto dos respectivos cadastros.',
  users:'Administrador e gestor organizam; lançador propõe; consulta acompanha somente as contas autorizadas.'
};
function node(tag, cls, text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function append(parent,...children){children.forEach(c=>parent.append(c));return parent;}
function button(text,fn,cls=''){const b=node('button',cls,text);b.type='button';b.addEventListener('click',()=>Promise.resolve().then(fn).catch(error));return b;}
function error(e){toast(e.message || String(e),true);}
function toast(text,bad=false){const t=$('#toast');t.textContent=text;t.hidden=false;t.classList.toggle('danger',bad);clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,6000);}
async function api(operation,payload={}){return await window.financeHA651(operation,payload);}
async function load(){
 state=await api('state');
 state.records.categories?.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
 const scoped=['entry','reader'].includes(state.user.role);
 overview=scoped?null:await api('overview');
 document.body.classList.toggle('finance-scoped',scoped);
 $('#quick').hidden=scoped&&(state.user.role==='reader'||!state.accounts.length);
}
function labelFor(id){for(const a of state.accounts)if(a.id===id)return a.name;for(const list of Object.values(state.records))for(const r of list)if(r.id===id)return r.name;return id || 'Não informado';}
function titlePage(key,action){const head=node('div','page-head');const title=node('div');append(title,node('span','section-label','FINANÇAS / '+(key==='overview'?'A VIDA EM EQUILÍBRIO':'ORGANIZAÇÃO LOCAL')),node('h1','',names[key] || key),node('p','',descriptions[key] || 'Organize os dados da sua família e acompanhe cada decisão.'));append(head,title);if(action)head.append(action);main.append(head);}
function panel(title,parent=main){const p=node('section','panel');p.append(node('h2','',title));parent.append(p);return p;}
function stats(items,parent=main){const grid=node('div','stats');for(const [label,value,hint,color] of items){const c=node('div','stat '+(color||''));append(c,node('span','label',label),node('strong','amount',typeof value==='number'?money(value):value),node('em','',hint||''));grid.append(c);}parent.append(grid);}
function notice(text,parent=main){parent.append(node('div','notice',text));}
function empty(parent,text='Nenhum registro por aqui. Comece pelo botão de adicionar.'){parent.append(node('div','empty',text));}
function table(parent,columns,rows,action){
 const wrap=node('div','table-wrap'),t=node('table'),thead=node('thead'),tr=node('tr');columns.forEach(([label])=>tr.append(node('th','',label)));if(action)tr.append(node('th','','Ações'));thead.append(tr);t.append(thead);const body=node('tbody');
 for(const row of rows){const r=node('tr');for(const [,key,format] of columns){const cell=node('td');const val=typeof key==='function'?key(row):row[key];cell.textContent=format?format(val,row):(val??'—');if(format===money||['purchase_cents','amount_cents','estimate','bill','price_cents','low_52','high_52'].includes(key))cell.classList.add('amount');r.append(cell);}if(action){const td=node('td','actions');action(row,td);r.append(td);}body.append(r);}t.append(body);wrap.append(t);parent.append(wrap);if(!rows.length)empty(parent);return wrap;
}
function bars(parent,items){if(!items.length)return empty(parent,'Ainda não há despesas confirmadas neste período.');const max=Math.max(...items.map(i=>i[1]),1);for(const [name,value]of items){const row=node('div','bar-row'),label=node('div','bar-label');append(label,node('span','',name),node('strong','amount',money(value)));const track=node('div','bar-track'),fill=node('div','bar-fill');fill.style.setProperty('--w',Math.round(value/max*100)+'%');track.append(fill);append(row,label,track);parent.append(row);}}
function renderOverview(){
 titlePage('overview');showPeopleReminder();const themes=node('div','theme-shortcuts');for(const [id,label]of Object.entries(hubNames)){const a=node('a','theme-shortcut',label);a.href='#'+id;themes.append(a);}main.append(themes);stats([['Disponível nas contas',overview.cash_cents,'Saldo confirmado até hoje','green'],['Despesas do mês',overview.expense_cents,'Cartão conta na compra'],['Patrimônio cadastrado',overview.assets_cents,'Depreciação por aniversário','gold'],['Resultado do mês',overview.net_cents,'Receitas menos despesas']]);
 const cols=node('div','two-col');main.append(cols);cashProjection(cols);
 const expenses=panel('Para onde vai o dinheiro',cols);bars(expenses,Object.entries(overview.by_category).map(([id,v])=>[labelFor(id),v]));
 const cols2=node('div','two-col');main.append(cols2);const events=panel('Próximos compromissos',cols2);const upcoming=state.transactions.filter(t=>t.status==='draft').sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,5);table(events,[['Compromisso','description'],['Vencimento','due_date',humanDate],['Valor','amount_cents',money]],upcoming);
 const insights=panel('Informação que ajuda a decidir',cols2);for(const a of overview.alerts){const card=node('article','insight');append(card,node('strong','',a.title),node('p','',Object.entries(a.calculation).map(([k,v])=>(k.includes('cents')?money(v):v)).join(' → ')),node('small','','Fonte: '+labelFor(a.source)));card.append(button('Dispensar nesta visualização',()=>card.remove(),'small'));insights.append(card);}if(!overview.alerts.length)empty(insights,'Nenhum ponto de atenção nas regras avaliadas.');
}
const enums={
 kind:{bank:'Conta bancária',cash:'Dinheiro',card:'Cartão de crédito',savings:'Reserva'},
 transactionKind:{expense:'Despesa',income:'Receita',transfer:'Transferência / pagamento de fatura'},
 status:{draft:'Rascunho · aguarda conferência',posted:'Confirmado',void:'Cancelado'},
 frequency:{monthly:'Mensal',yearly:'Anual',weekly:'Semanal'},
 role:{admin:'Administrador',manager:'Gestor',entry:'Lançador · precisa de aprovação',reader:'Somente consulta'},
 reference_kind:{documented:'Referência documentada',estimate:'Estimativa identificada'},
 value_mode:{automatic:'Depreciação anual',manual:'Valor informado manualmente'},
 tradeKind:{buy:'Compra',sell:'Venda',dividend:'Provento'},
 utilityKind:{electricity:'Energia elétrica',solar:'Geração solar',water:'Água',gas:'Gás',ev:'Recarga de veículo'},
 asset_class:{stock:'Ação',fund:'Fundo / FII',etf:'ETF',fixed_income:'Renda fixa',other:'Outro'}
};
// [field, Portuguese label, type, relation or enum]. All actual validation lives in the engine.
const nameField=['name','Nome','text'];
const configs={
 properties:[nameField,['purpose','Finalidade','text']],
 categories:[nameField,['kind','Natureza','enum','transactionKind']],
 projects:[nameField,['property_id','Imóvel','relation','properties'],['budget_cents','Orçamento (R$)','money'],['deadline','Previsão de conclusão','date']],
 budgets:[nameField,['category_id','Categoria','relation','categories'],['period','Mês de referência','month'],['limit_cents','Limite planejado (R$)','money']],
 goals:[nameField,['target_cents','Meta (R$)','money'],['saved_cents','Reservado para a meta (R$)','money'],['deadline','Prazo','date']],
 subscriptions:[nameField,['amount_cents','Valor atual (R$)','money'],['new_amount_cents','Valor após promoção (R$)','money'],['account_id','Conta','relation','accounts'],['category_id','Categoria','relation','categories'],['renewal_date','Renovação','date'],['promo_end','Fim da promoção','date']],
 recurrences:[nameField,['kind','Natureza','enum','transactionKind'],['amount_cents','Valor (R$)','money'],['account_id','Conta de origem','relation','accounts'],['to_account_id','Conta de destino · transferências','relation','accounts'],['category_id','Categoria','relation','categories'],['property_id','Imóvel','relation','properties'],['project_id','Projeto','relation','projects'],['frequency','Frequência','enum','frequency'],['next_date','Próximo vencimento','date'],['end_date','Último vencimento · opcional','date']],
 assets:[nameField,['property_id','Imóvel','relation','properties'],['room','Cômodo · área do Home Assistant','ha-area'],['purchase_cents','Valor de aquisição (R$)','money'],['purchase_date','Data de aquisição','date'],['annual_depreciation','Depreciação anual (%)','number'],['value_mode','Definição do valor','enum','value_mode'],['current_cents','Valor atual manual (R$)','money'],['replacement_cents','Custo de substituição (R$)','money'],['warranty_end','Garantia até','date']],
 maintenance:[nameField,['asset_id','Equipamento','relation','assets'],['property_id','Imóvel','relation','properties'],['room','Cômodo','text'],['date','Data','date'],['amount_cents','Custo (R$)','money'],['reference_cents','Referência comparativa (R$)','money'],['reference_kind','Tipo de comparação','enum','reference_kind'],['reference_note','Origem da referência / premissas','textarea'],['account_id','Conta para o rascunho integrado','relation','accounts'],['completed','Manutenção concluída','checkbox']],
 investments:[nameField,['ticker','Código do ativo','text'],['asset_class','Classe','enum','asset_class'],['currency','Moeda · BRL nesta etapa','text']],
 quotes:[nameField,['investment_id','Investimento','relation','investments'],['price_cents','Cotação unitária (R$)','money'],['as_of','Data da cotação','date'],['source','Fonte da cotação','text']],
 trades:[nameField,['investment_id','Investimento','relation','investments'],['kind','Operação','enum','tradeKind'],['quantity','Quantidade','number'],['price_cents','Preço unitário (R$)','money'],['fee_cents','Custos (R$)','money'],['date','Data','date']],
 utilities:[nameField,['property_id','Imóvel','relation','properties'],['room','Cômodo','text'],['period','Mês','month'],['kind','Medição','enum','utilityKind'],['quantity','Quantidade consumida / gerada','number'],['unit','Unidade · kWh, m³...','text'],['tariff_cents','Tarifa unitária (R$)','money'],['actual_cents','Fatura paga (R$)','money'],['baseline_quantity','Quantidade de referência','number'],['assumption','Premissas para comparação','textarea'],['distance_km','Distância percorrida · veículo (km)','number']],
 contracts:[nameField,['property_id','Imóvel','relation','properties'],['asset_id','Equipamento','relation','assets'],['renewal_date','Renovação','date'],['amount_cents','Valor contratado (R$)','money'],['deductible_cents','Franquia (R$)','money'],['notes','Cobertura / observações','textarea']],
 requests:[nameField,['amount_cents','Valor solicitado (R$)','money'],['account_id','Conta','relation','accounts'],['category_id','Categoria','relation','categories'],['due_date','Data prevista','date'],['note','Justificativa','textarea']],
 reimbursements:[nameField,['person','Pessoa','text'],['amount_cents','Valor a receber (R$)','money'],['settled_cents','Já recebido (R$)','money'],['due_date','Prazo','date'],['transaction_id','Lançamento relacionado','relation','transactions']],
 settings:[nameField,['mobile_enabled','Preparar lembretes no celular','checkbox'],['alexa_enabled','Preparar avisos na Alexa','checkbox'],['alexa_amounts','Autorizar valores falados na Alexa','checkbox'],['reminder_days','Antecedência do lembrete (dias)','integer'],['weekly_enabled','Resumo semanal · adaptador pendente','checkbox']],
 account:[nameField,['kind','Tipo de conta','enum','kind'],['opening_cents','Saldo inicial (R$) · cartão negativo se houver dívida','money'],['closing_day','Dia de fechamento · cartão','integer'],['due_day','Dia de vencimento · cartão','integer'],['credit_limit_cents','Limite do cartão (R$)','money']],
 transaction:[['description','Descrição','text'],['kind','Natureza','enum','transactionKind'],['amount_cents','Valor total (R$)','money'],['account_id','Conta de origem','relation','accounts'],['to_account_id','Conta de destino · transferências','relation','accounts'],['date','Data','date'],['due_date','Vencimento','date'],['category_id','Categoria','relation','categories'],['property_id','Imóvel','relation','properties'],['room','Cômodo','text'],['project_id','Projeto','relation','projects'],['installments','Número de parcelas','integer'],['status','Situação','enum','status']],
 user:[['role','Perfil financeiro','enum','role'],['accounts','Contas autorizadas · selecione na lista','multi','accounts'],['enabled','Habilitar acesso financeiro','checkbox']]
};
function showForm(title,fields,initial,save,help='Os valores permanecem locais. Confira os dados antes de salvar.'){
 const dialog=$('#editor');$('#edit-title').textContent=title;$('#edit-help').textContent=help;$('#edit-error').textContent='';$('#fields').replaceChildren();
 for(const [key,label,type,rel]of fields){const l=node('label',type==='textarea'?'wide':'',label);let input;
 if(type==='readonly'){input=node('input');input.readOnly=true;}
 else if(type==='multi'){input=node('select');input.multiple=true;input.size=5;for(const row of state[rel])input.append(new Option(row.name,row.id,false,(initial[key]||[]).includes(row.id)));}
 else if(type==='ha-area'&&Array.isArray(state.ha_areas)){
  input=node('select');input.append(new Option('Sem área',''));
  const names=[...state.ha_areas].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  for(const name of names)input.append(new Option(name,name));
  const current=initial[key];
  if(current&&!names.includes(current))input.append(new Option(current+' (valor salvo)',current));
  if(!names.length)l.append(node('small','muted','Nenhuma área cadastrada no Home Assistant.'));
 }
 else if(type==='enum'||type==='relation'){input=node('select');if(type==='relation'){input.append(new Option('Não informado',''));const rows=state[rel]||state.records[rel]||[];for(const r of rows)input.append(new Option(r.name||r.description,r.id));}else for(const [value,text]of Object.entries(enums[rel]))input.append(new Option(text,value));}
 else{input=node(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type==='money'||type==='number'||type==='integer'?'number':type==='ha-area'?'text':type;}
 input.name=key;input.dataset.kind=type;if(type==='money'){input.step='.01';if(key!=='opening_cents')input.min=0;}if(type==='number')input.step='any';if(type==='integer')input.step='1';if(type==='checkbox')input.checked=Boolean(initial[key]);else if(type!=='multi'&&initial[key]!==undefined)input.value=type==='money'?initial[key]/100:initial[key];else if(['date','due_date','next_date','as_of'].includes(key))input.value=state.today;else if(type==='month')input.value=state.today.slice(0,7);if(['name','description'].includes(key))input.required=true;l.append(input);$('#fields').append(l);}
 submitForm=async()=>{const data={};for(const input of $('#fields').querySelectorAll('input,select,textarea')){let v=input.value;const t=input.dataset.kind;if(t==='readonly')continue;if(t==='checkbox')v=input.checked;else if(t==='multi')v=[...input.selectedOptions].map(option=>option.value);else if(v===''&&t!=='ha-area')continue;else if(t==='money')v=Math.round(Number(v)*100);else if(t==='integer')v=Number(v);else if(t==='number')v=input.name==='annual_depreciation'?Number(v):v;data[input.name]=v;}await save(data);dialog.close();await refresh();toast('Salvo. Dados conferidos pelo motor local.');};dialog.showModal();
}
function editRecord(collection,record){
 const initial={...record};if(collection==='investments'&&!initial.currency)initial.currency='BRL';
 const plan=collection==='maintenance'&&record&&!record.completed;
 const latest=plan?state.maintenance_latest?.[record.id]:null;
 const forecast=plan?state.maintenance_forecast?.[record.id]:null;
 const fields=[...configs[collection]];
 let costIndex=fields.findIndex(([key])=>key==='amount_cents')+1;
 if(latest){
  fields.splice(costIndex++,0,['last_completed_cost','Último custo realizado · '+humanDate(latest.date),'readonly']);
  initial.last_completed_cost=latest.amount_cents==null?'Custo não confirmado':money(latest.amount_cents);
 }
 if(forecast!=null){
  fields.splice(costIndex,0,['next_forecast','Previsão da próxima manutenção','readonly']);
  initial.next_forecast=money(forecast);
 }
 showForm((record?'Editar · ':'Adicionar · ')+names[collection],fields,initial,async data=>{const payload={collection,data:{...record,...data}};delete payload.data.id;delete payload.data.revision;if(record){payload.id=record.id;payload.revision=record.revision;}await api('save_record',payload);});
}
function newTransaction(){showForm('Novo lançamento',configs.transaction,{installments:1,status:'draft',date:state.today,due_date:state.today},data=>api('transaction',data),'Compras no cartão são despesas. Pagar a fatura é uma transferência para o cartão. O valor total é dividido entre as parcelas.');}
function recordColumns(collection){const fields=configs[collection].filter(f=>f[2]!=='checkbox'&&f[2]!=='textarea').slice(0,5);return fields.map(([key,label,type])=>[label,key,type==='money'?money:type==='relation'?labelFor:type==='date'?humanDate:undefined]);}
function renderRecords(collection){
 titlePage(collection,button('+ Adicionar',()=>editRecord(collection),'primary'));let rows=state.records[collection]||[];
 if(collection==='maintenance')stats([['Gasto realizado',overview.maintenance.cost_cents,'No mês selecionado'],['Economia documentada',overview.maintenance.documented_savings_cents,'Comparação com referência','green'],['Economia estimada',overview.maintenance.estimated_savings_cents,'Premissas identificadas','gold'],['Serviços cadastrados',String(rows.filter(r=>!r.completed).length),rows.filter(r=>r.completed).length+' execução(ões) registrada(s)']]);
 if(collection==='projects')rows=overview.projects;
 if(collection==='budgets'){const p=panel('Planejado e realizado');bars(p,overview.budgets.map(b=>[b.name+' · limite '+money(b.limit_cents),b.actual_cents]));}
 if(collection==='assets'){
  const valued=rows.filter(r=>r.purchase_cents!=null||r.current_cents!=null).length;
  notice(valued+' de '+rows.length+' equipamentos com valor informado. Equipamentos sem valor também aparecem no cadastro.');
 }
 if(collection==='utilities'){
  const p=panel('Leituras, estimativa e fatura');
  const quantities=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
  const readings=rows.map(r=>({...r,
    reading:r.quantity!=null?quantities.format(Number(r.quantity))+' '+(r.unit||''):'Sem leitura',
    source:state.utility_costs?.[r.id]?.source||'—',
    estimate:money(state.utility_costs?.[r.id]?.estimated_cents),
    bill:r.actual_cents==null?'Não informada':money(r.actual_cents)
  })).sort((a,b)=>String(b.period).localeCompare(String(a.period)));
  table(p,[['Medição','name'],['Categoria','kind',v=>enums.utilityKind[v]||v],['Mês','period'],['Leitura','reading'],['Custo estimado','estimate'],['Fonte do custo no HA','source'],['Fatura','bill']],readings);
  notice('O custo estimado é exibido quando fornecido pelo backend. A fatura fica separada.',p);
 }
 const actions=(r,td)=>{td.append(button('Editar',()=>editRecord(collection,r),'small'));if(collection==='requests'&&(r.status||'pending')==='pending')td.append(button('Aprovar',async()=>{await api('approve',{id:r.id});await refresh();},'small'));td.append(button('Excluir',async()=>{if(confirm('Excluir este cadastro? Vínculos e histórico financeiro impedem exclusão.')){await api('delete_record',{id:r.id,revision:r.revision});await refresh();}},'small danger'));};
 const columns=recordColumns(collection);
 if(collection==='categories')columns.find(column=>column[1]==='kind')[2]=value=>enums.transactionKind[value]??value??'—';
 if(collection==='assets'){
  const value=columns.find(column=>column[1]==='purchase_cents');
  value[2]=v=>v==null?'Não informado':money(v);
 }
 if(collection==='maintenance'){
  columns.splice(1,0,['Situação','completed',v=>v?'Executada':'Cadastro']);
  columns.push(['Custo','amount_cents',v=>v==null?'Não informado':money(v)]);
  const history=panel('Histórico de execuções');
  table(history,columns,rows.filter(r=>r.completed),actions);
  rows=rows.filter(r=>!r.completed);
 }
 const p=panel('Cadastros');const input=node('input');input.placeholder='Buscar nesta lista';const tool=node('div','toolbar');tool.append(input);p.append(tool);const target=node('div');p.append(target);
 const render=()=>{target.replaceChildren();const filtered=rows.filter(r=>JSON.stringify(r).toLocaleLowerCase().includes(input.value.toLocaleLowerCase()));table(target,columns,filtered,actions);};input.addEventListener('input',render);render();
 if(collection==='goals')for(const r of rows){const p=panel(r.name);bars(p,[['Reservado · meta '+money(r.target_cents),r.saved_cents]]);}
 if(collection==='settings')notice('Configure seus canais e preferências. Os envios dependem dos serviços conectados e das permissões concedidas.');
}
function renderTransactions(){titlePage('transactions',button('+ Lançamento',newTransaction,'primary'));const p=panel('Movimentações');const filter=node('input');filter.placeholder='Buscar descrição, conta ou situação';const tools=node('div','toolbar');tools.append(filter);p.append(tools);const container=node('div');p.append(container);const render=()=>{container.replaceChildren();table(container,[['Descrição','description'],['Data','date',humanDate],['Conta','account_id',labelFor],['Natureza','kind',v=>enums.transactionKind[v]],['Valor','amount_cents',money],['Situação','status',v=>enums.status[v]]],state.transactions.filter(t=>(t.description+' '+labelFor(t.account_id)+' '+t.status).toLowerCase().includes(filter.value.toLowerCase())),(t,td)=>{if(t.status==='draft'){td.append(button('Conferir',()=>showForm('Conciliar rascunho',configs.transaction.filter(f=>['kind','description','to_account_id','category_id','property_id','project_id','room','due_date'].includes(f[0])),t,data=>api('reconcile',{id:t.id,expected:{kind:t.kind,description:t.description,status:t.status,due_date:t.due_date},changes:data})),'small'));td.append(button('Confirmar',async()=>{await api('post',{id:t.id});await refresh();},'small'));}if(t.status!=='void')td.append(button('Cancelar',async()=>{const reason=prompt('Motivo do cancelamento:');if(reason){await api('void',{id:t.id,reason});await refresh();}},'small danger'));});};filter.addEventListener('input',render);render();}
function renderAccounts(cards=false){titlePage(cards?'cards':'accounts',button('+ Conta ou cartão',()=>showForm('Nova conta',configs.account,{},data=>api('account',data)),'primary'));const grid=node('div','grid-cards');main.append(grid);for(const a of state.accounts.filter(a=>!cards||a.kind==='card')){const p=panel(a.name,grid);p.classList.add('account-card');append(p,node('span','pill',enums.kind[a.kind]),node('strong','amount',money(a.balance_cents)));if(a.kind==='card'){p.append(node('p','','Fechamento: dia '+a.closing_day+' · Vencimento: dia '+a.due_day));p.append(button('Conferir fatura',async()=>{const statement=await api('card_statement',{account_id:a.id,month:state.today.slice(0,7)});showForm('Fatura · '+a.name,[],{},async()=>{},'Período '+humanDate(statement.start)+' a '+humanDate(statement.end)+' · total '+money(statement.total_cents)+' · vencimento '+humanDate(statement.due_date)+'. '+statement.note);}));}}if(cards)notice('Parcelas usam datas futuras e a fatura agrupa as compras por ciclo. O pagamento precisa ser cadastrado como transferência; não existe débito automático nesta versão.');}
function renderCalendar(){titlePage('calendar');const p=panel('Compromissos de '+new Date(state.today+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}));const scroll=node('div','table-wrap'),grid=node('div','calendar');const [year,month]=state.today.split('-').map(Number);const total=new Date(year,month,0).getDate();for(let d=1;d<=total;d++){const ds=state.today.slice(0,8)+String(d).padStart(2,'0'),cell=node('div','calendar-day'+(ds===state.today?' today':''));cell.append(node('strong','',d));for(const t of state.transactions.filter(t=>t.due_date===ds&&t.status!=='void'))cell.append(node('div','calendar-event',t.description+' · '+money(t.amount_cents)));grid.append(cell);}scroll.append(grid);p.append(scroll);notice('O calendário mostra lançamentos cadastrados. Gere as recorrências vencidas para incluí-las.');}
function renderInvestments(){titlePage('investments',button('+ Investimento',()=>editRecord('investments'),'primary'));const tools=node('div','toolbar');tools.append(button('+ Operação',()=>editRecord('trades')),button('+ Cotação manual',()=>editRecord('quotes')),button('Ver operações',()=>location.hash='trades'),button('Ver cotações',()=>location.hash='quotes'));main.append(tools);const p=panel('Sua carteira');table(p,[['Ativo','name'],['Quantidade','quantity'],['Custo','cost_cents',money],['Valor de mercado','current_cents',v=>v===null?'Sem cotação':money(v)],['Resultado realizado','realized_cents',money],['Proventos','dividends_cents',money]],overview.investments,(r,td)=>td.append(button('Editar ativo',()=>editRecord('investments',state.records.investments.find(i=>i.id===r.id)),'small')));if(!Object.hasOwn(state,'market_quotes'))return;
 renderMarketCenter();
}
function renderMarketCenter(){
 const market=panel('Central de Mercado');
 const automatic=new Map((state.market_quotes||[]).map(row=>[row.ticker,row]));
 // Optional market_display rows are resolved by the backend, including source precedence.
 const resolved=new Map((state.market_display||[]).map(row=>[row.ticker,row]));
 const rows=(state.market_catalog||[]).map(asset=>{
  const quote=resolved.get(asset.ticker)||automatic.get(asset.ticker);
  return {...asset,...quote,history:Array.isArray(quote?.history)?quote.history:[],
   historySource:quote?.historySource||quote?.source||'Indisponível',
   source:quote?.source||'Cotação indisponível no backend'};
 });
 const moneyFor=(value,row)=>value==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:row.currency}).format(value/100);
 const percent=value=>value==null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,signDisplay:'exceptZero'}).format(value)+'%';
 const search=node('input');search.placeholder='Empresa, código, setor ou bolsa';search.setAttribute('aria-label',search.placeholder);
 const controls=node('div','toolbar'), exchange=node('select'), coverage=node('select');
 exchange.setAttribute('aria-label','Bolsa');exchange.append(new Option('Todas as bolsas',''));
 for(const name of [...new Set(rows.map(row=>row.exchange))].sort())exchange.append(new Option(name,name));
 coverage.setAttribute('aria-label','Disponibilidade de preços');
 for(const [label,value] of [['Todos os ativos',''],['Com preço disponível','priced'],['Cotação automática','automatic'],['Importação por CSV','manual']])coverage.append(new Option(label,value));
 const pager=node('div','toolbar'), status=node('span','muted');
 let page=0;
 controls.append(search,exchange,coverage);
 market.append(node('p','muted',rows.length+' ativos no catálogo · '+rows.filter(row=>row.price_cents!=null).length+' com preço disponível'),controls);
 const selected=new Set(), listing=node('div','market-list'), comparison=panel('Comparar ativos',market);
 market.insertBefore(pager,comparison);market.insertBefore(listing,comparison);
 const folded=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 function drawComparison(){
  comparison.replaceChildren(node('h2','','Comparar ativos'));
  const subset=rows.filter(row=>selected.has(row.ticker));
  if(subset.length<2){comparison.append(node('p','muted','Marque de dois a quatro ativos na lista.'));return;}
  const result=(state.market_comparisons||[]).find(result=>Array.isArray(result.tickers)&&
   result.tickers.length===subset.length&&new Set(result.tickers).size===subset.length&&result.tickers.every(ticker=>selected.has(ticker)));
  table(comparison,[['Empresa','company'],['Ativo','ticker'],['Moeda','currency'],['Cotação','price_cents',moneyFor],
   ['Variação no recorte','variation',percent],['Dispersão dos retornos','dispersion',percent],['Histórico','historySource']],
   subset.map(row=>({...row,variation:result?.metrics?.[row.ticker]?.variation??null,dispersion:result?.metrics?.[row.ticker]?.dispersion??null})));
  if(!result){notice('Comparação indisponível no backend para os ativos selecionados.',comparison);return;}
  if(result.note)notice(result.note,comparison);
  if(Array.isArray(result.days)&&Array.isArray(result.series)&&result.series.length===subset.length&&
   new Set(result.series.map(series=>series.name)).size===subset.length&&
   result.series.every(series=>selected.has(series.name)&&Array.isArray(series.values)&&series.values.length===result.days.length)){
   xyChart(comparison,'Evolução dos fechamentos · base 100',result.days.map(humanDate),result.series,
    'line',{money:false,axisBase:100,maxXLabels:5,markers:false,xLabel:'Data',note:result.note||'Valores fornecidos pelo backend.'});
  }else notice('Evolução comparativa indisponível no backend.',comparison);

 }
 function drawListing(){
  listing.replaceChildren();
  const query=folded(search.value.trim());
  const filtered=rows.filter(row=>(!exchange.value||row.exchange===exchange.value)
   && (!coverage.value||(coverage.value==='priced'?row.price_cents!=null:coverage.value==='automatic'?row.automatic:!row.automatic))
   && folded([row.ticker,row.company,row.sector,row.exchange].join(' ')).includes(query));
  const pageSize=12, pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  page=Math.min(page,pages-1);
  status.textContent=filtered.length+' resultado(s) · página '+(page+1)+' de '+pages+' · '+selected.size+' selecionado(s)';
  const prev=button('Anterior',()=>{page--;drawListing();});
  const next=button('Próxima',()=>{page++;drawListing();});
  prev.disabled=page===0;next.disabled=page===pages-1;
  pager.replaceChildren(prev,status,next);
  table(listing,[['Empresa','company'],['Ativo','ticker'],['Setor','sector'],['Bolsa','exchange'],['Cotação','price_cents',moneyFor],
   ['Variação','change_percent',(v,row)=>percent(v)+(v!=null&&row.fromCsv?' · 2 fech.':'')],['Volume','volume',v=>v==null?'—':v.toLocaleString('pt-BR')],
   ['Mínima 52 sem.','low_52',moneyFor],['Máxima 52 sem.','high_52',moneyFor],['Pregão / consulta','as_of',(v,row)=>v?humanDate(v):row.observed_at?'Consulta '+humanDate(row.observed_at.slice(0,10)):'—'],['Fonte','source']],
   filtered.slice(page*pageSize,(page+1)*pageSize),(row,td)=>{
    const check=node('input');check.type='checkbox';check.checked=selected.has(row.ticker);check.setAttribute('aria-label','Comparar '+row.ticker);
    check.onchange=()=>{
     if(check.checked&&selected.size>=4){check.checked=false;toast('Selecione até quatro ativos.',true);return;}
     if(check.checked)selected.add(row.ticker);else selected.delete(row.ticker);
     status.textContent=filtered.length+' resultado(s) · página '+(page+1)+' de '+pages+' · '+selected.size+' selecionado(s)';
     drawComparison();
    };
    td.append(check);
   });
 }
 for(const input of [search,exchange,coverage])input.addEventListener('input',()=>{page=0;drawListing();});
 drawListing();drawComparison();
 if(state.market_status?.status==='falha')notice('A última coleta falhou. Confira a data das cotações exibidas.',market);
 notice('Confira a fonte e a data de cada cotação. Históricos consolidados, variações e comparações são exibidos somente quando fornecidos pelo backend.',market);
 const sources=node('p','muted','Consultar demonstrações financeiras ');
 for(const [label,url] of [['CVM · Brasil','https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr'],['SEC · EUA','https://www.sec.gov/edgar/search/']]){
  const link=node('a','',label);link.href=url;link.target='_blank';link.rel='noopener noreferrer';sources.append(' · ',link);
 }
 market.append(sources);
 const importer=panel('Importar histórico de preços',market);
 const steps=node('ol');
 for(const step of [
  'Exporte os preços históricos do seu provedor ou corretora. Use o preço de fechamento por unidade, sem quantidade, saldo ou dados da sua conta.',
  'Marque os ativos e baixe o modelo. Ele já traz código e moeda, além dos dois últimos fechamentos quando houver histórico. Complete as linhas em branco ou acrescente uma linha por ativo e pregão, com data AAAA-MM-DD e preço unitário.',
  'Salve em CSV, selecione o arquivo e clique em Conferir arquivo. Revise o código, a moeda, o período e o total de fechamentos antes de confirmar.',
  'Depois de confirmar, volte ao catálogo. Cotações consolidadas e comparações dependem dos resultados fornecidos pelo backend.'
 ])steps.append(node('li','',step));
 const file=node('input');file.type='file';file.accept='.csv,text/csv';file.setAttribute('aria-label','CSV de fechamentos');
 const preview=node('div');preview.setAttribute('aria-live','polite');
 let generation=0;
 file.addEventListener('change',()=>{generation++;preview.replaceChildren();});
 const check=button('Conferir arquivo',async()=>{
  const selectedFile=file.files[0], token=++generation;
  preview.replaceChildren();
  check.disabled=true;
  try{
   if(!selectedFile)throw Error('Selecione um CSV de fechamentos.');
   if(selectedFile.size>600000)throw Error('Arquivo muito grande.');
   const content=await selectedFile.text();
   const result=await api('market_history_preview',{text:content});
   if(token!==generation)return;
   preview.append(node('h3','','Prévia · '+result.count+' fechamento(s)'));
   table(preview,[['Empresa','company'],['Código','ticker'],['Moeda','currency'],['Datas','count'],['De','from',humanDate],['Até','to',humanDate],['Último fechamento','price_cents',moneyFor]],result.assets);
   const confirm=button('Confirmar importação',async()=>{
    if(token!==generation)return;
    confirm.disabled=true;
    try{
     const response=await api('market_history_import',{text:content});
     await refresh();
     toast(response.updated+' fechamento(s) atualizado(s).');
    }catch(error){notice(error.message,preview);confirm.disabled=false;}
   },'primary');
   preview.append(confirm);
  }catch(error){if(token===generation)notice(error.message,preview);}
  finally{check.disabled=false;}
 });
 const importTools=node('div','toolbar');
 importTools.append(button('Baixar modelo CSV',()=>{
  if(!selected.size){toast('Marque os ativos que deseja incluir no modelo.',true);return;}
  const template=rows.filter(row=>selected.has(row.ticker)).flatMap(row=>{
   const closes=row.history.slice(-2);
   const lines=closes.map(([day,price])=>[row.ticker,day,row.currency,(price/100).toFixed(2).replace('.',',')]);
   while(lines.length<2)lines.push([row.ticker,'',row.currency,'']);
   return lines;
  });
  csvDownload('modelo-fechamentos',['codigo','data','moeda','fechamento'],template);
 }),file,check);
 importer.append(steps,importTools,preview);
 notice('A importação mantém até 250 datas por ativo. Reimportar o mesmo código e data atualiza o fechamento correspondente. Os dados ficam no histórico de referência, separado das operações e do saldo da carteira.',importer);
}
function renderDocuments(){titlePage('documents');const p=panel('Anexar documento');const f=node('form','fields');const label=node('label','','Vincular a');const select=node('select');for(const r of [...state.transactions,...Object.values(state.records).flat()])select.append(new Option(r.description||r.name,r.id));label.append(select);const label2=node('label','','Documento · PDF, JPG ou PNG · até 5 MB');const file=node('input');file.type='file';file.accept='.pdf,.png,.jpg,.jpeg';label2.append(file);append(f,label,label2);const upload=node('button','primary','Anexar documento');upload.type='submit';f.append(upload);f.addEventListener('submit',async e=>{e.preventDefault();try{const selected=file.files[0];if(!selected)throw Error('Selecione um documento');if(selected.size>5000000)throw Error('O limite é 5 MB');const bytes=new Uint8Array(await selected.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));await api('document_add',{owner_id:select.value,name:selected.name,mime:selected.type,base64:btoa(binary)});await refresh();toast('Documento anexado.');}catch(err){error(err);}});p.append(f);const list=panel('Documentos guardados');table(list,[['Arquivo','name'],['Vinculado a','owner_id',labelFor],['Tamanho','size',v=>Math.round(v/1024)+' KB']],state.documents,(r,td)=>{td.append(button('Visualizar',async()=>{try{const frame=$('#preview iframe');if(frame.src.startsWith('blob:'))URL.revokeObjectURL(frame.src);frame.src=await window.financeDocument651(r.id);$('#preview').showModal();}catch(err){error(err);}},'small'));td.append(button('Remover',async()=>{if(confirm('Remover este documento?')){await api('document_remove',{id:r.id});await refresh();}},'small danger'));});}
function renderImport(){
 titlePage('imports');
 const p=panel('Extrato para conferência');
 const account=node('select');
 account.append(new Option('Selecione a conta de destino',''));
 state.accounts.forEach(a=>account.append(new Option(a.name,a.id)));
 if(state.accounts.length===1)account.value=state.accounts[0].id;
 const format=node('select');format.append(new Option('CSV','csv'),new Option('OFX','ofx'));
 const text=node('textarea');text.rows=9;
 text.placeholder='Data,Valor,Identificador,Descrição\n01/11/2026,-120.50,identificador-do-banco,Compra';
 const file=node('input');file.type='file';file.accept='.csv,.ofx';
 file.addEventListener('change',async()=>{
  const selected=file.files[0];if(!selected)return;
  format.value=selected.name.toLowerCase().endsWith('.ofx')?'ofx':'csv';
  if(selected.size>8_000_000){notice('Extrato muito grande.',result);return;}
  const bytes=await selected.arrayBuffer();
  try{text.value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{text.value=new TextDecoder('windows-1252').decode(bytes);}
  text.dispatchEvent(new Event('input'));
 });
 const tool=node('div','toolbar');append(tool,account,format,file);append(p,tool,text);
 const result=node('div');result.setAttribute('aria-live','polite');
 let validated=null;
 const preview=button('Conferir importação',async()=>{
  validated=null;result.replaceChildren();
  const payload={account_id:account.value,format:format.value,text:text.value};
  preview.disabled=true;
  try{
   if(!payload.account_id)throw Error('Selecione a conta de destino. Cadastre uma em Contas, se necessário.');
   if(!payload.text.trim())throw Error('Selecione um arquivo ou cole o conteúdo do extrato.');
   const response=await api('import_preview',payload);
   if(payload.text!==text.value||payload.account_id!==account.value||payload.format!==format.value)return;
   validated=payload;
   table(result,[['Descrição','description'],['Data','date',humanDate],['Valor','amount_cents',(v,r)=>money(r.kind==='expense'?-v:v)],['Repetido','duplicate',v=>v?'Sim · ignorar':'Não']],response.rows);
   result.append(node('p','',response.note),button('Importar como rascunhos',async()=>{
    if(!validated)throw Error('Confira o extrato novamente');
    const r=await api('import_confirm',validated);
    toast(r.imported+' lançamentos importados como rascunhos');await refresh();
   },'primary'));
  }catch(err){notice(err.message||String(err),result);}
  finally{preview.disabled=false;}
 },'primary');
 for(const e of [text,account,format])e.addEventListener('input',()=>{validated=null;result.replaceChildren();});
 append(p,preview,result);
 notice('O CSV do Nubank é aceito. Valores negativos indicam saídas. Revise faturas e transferências antes de confirmar os lançamentos.');
}
async function renderAudit(){
 titlePage('audit');
 const p=panel('Rastreabilidade');
 table(p,[['Data','at',s=>new Date(s).toLocaleString('pt-BR')],['Pessoa',r=>r.actor_name||state.users.find(u=>u.id===r.actor)?.name||r.actor],['Operação','action'],['Registro','object_id']],await api('audit'));
}
function peoplePending(){
 return state.users.filter(person=>person.ha_active===true&&!person.enabled&&person.role==='reader'&&JSON.parse(person.accounts).length===0).length;
}
function showPeopleReminder(){
 const count=peoplePending();
 if(!count)return;
 const box=node('div','notice');
 box.append(node('strong','',count===1?'Uma pessoa aguarda revisão no Finanças.':count+' pessoas aguardam revisão no Finanças.'),document.createTextNode(' Acesso financeiro bloqueado até a configuração. '));
 const link=node('a','','Revisar permissões →');link.href='#users';box.append(link);
 main.append(box);
}
function renderUsers(){
 titlePage('users',state.ha_directory?button('Sincronizar usuários do HA',async()=>{await refresh();toast('Cadastro do Home Assistant conferido.');},'primary'):undefined);
 if(state.user.role!=='admin'){notice('A administração de usuários exige o perfil Administrador do Finanças.');return;}
 showPeopleReminder();
 notice(state.ha_directory
  ? 'O Finanças cadastra automaticamente as pessoas ativas do Home Assistant com o acesso financeiro bloqueado. Escolha o perfil e as contas antes de habilitar cada pessoa.'
  : 'A consulta ao cadastro do Home Assistant requer também permissão de administrador do HA.');
 const p=panel('Pessoas e acessos');
 table(p,[['Pessoa','name'],['Perfil','role',value=>enums.role[value]],
  ['Home Assistant',person=>person.ha_active===false?'Inativo ou removido':person.ha_active?'Ativo':'—'],
  ['Acesso financeiro',person=>person.ha_active===false?'Bloqueado pelo HA':person.enabled?'Habilitado':'Bloqueado'],
  ['Contas',person=>['admin','manager'].includes(person.role)&&person.enabled?'Todas':JSON.parse(person.accounts).map(labelFor).join(', ')||'Nenhuma']],
  state.users,(person,td)=>td.append(button('Editar',()=>showForm('Permissões · '+person.name,configs.user,
   {...person,accounts:JSON.parse(person.accounts),enabled:Boolean(person.enabled)},
   data=>api('user',{id:person.id,name:person.name,...data}),
   'Consulta e Lançador enxergam somente as contas selecionadas. Administrador e Gestor têm acesso a todas as contas.'),'small')));
}
function renderScopedFinance(){
 titlePage('transactions',state.user.role==='entry'&&state.accounts.length?button('+ Lançamento',newTransaction,'primary'):undefined);
 notice(state.accounts.length?'Exibindo somente as contas autorizadas pelo administrador.':'Nenhuma conta financeira foi atribuída ao seu perfil. Solicite a liberação ao administrador.');
 if(!state.accounts.length)return;
 table(panel('Contas autorizadas'),[['Conta','name'],['Tipo','kind',v=>enums.kind[v]],['Saldo','balance_cents',money]],state.accounts);
 table(panel('Lançamentos autorizados'),[['Descrição','description'],['Data','date',humanDate],['Conta','account_id',labelFor],['Tipo','kind',v=>enums.transactionKind[v]],['Situação','status',v=>enums.status[v]],['Valor','amount_cents',money]],state.transactions);
}
function renderConnections(){
 titlePage('connections');
 financeIntegrationPanel();
 const grid=node('div','grid-cards');main.append(grid);
 const links=[
  ['Inventário','Sincronização local','Importa ativos com valor cadastrado e mantém o vínculo pelo equipamento de origem.','assets','Ver ativos'],
  ['Manutenção','Sincronização local','Atualiza os custos de serviços concluídos. O histórico financeiro continua separado dos lançamentos bancários.','maintenance','Ver manutenções'],
  ['Home Assistant','Medidores mensais','Consumo e mobilidade mostra as leituras e os custos de fontes compatíveis. Deixe a tarifa em branco para buscar o custo no Home Assistant.','utilities','Ver medições'],
  ['Bolsa e corretoras','Sandbox gratuito','Na homologação, cadastre PETR4, VALE3, ITUB4 ou MGLU3 em Investimentos e execute a sincronização. A cotação traz data e fonte. Para os demais ativos, use o cadastro manual.','investments','Abrir investimentos'],
  ['Bancos','Importação de extratos','Crie a conta e importe CSV ou OFX. Revise a prévia antes de confirmar os rascunhos.','imports','Importar extrato']
 ];
 for(const [name,status,text,id,action] of links){
  const p=panel(name,grid);
  const link=node('a','hub-tab',action+' →');link.href='#'+id;
  append(p,node('span','pill gold',status),node('p','',text),link);
 }
}
async function render(){main.replaceChildren();if(!overview&&state){$('#breadcrumb').textContent=names.transactions;renderScopedFinance();return;}$('#breadcrumb').textContent=names[route]||'Visão geral';document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.hash==='#'+route);if(a.hash==='#'+route&&a.closest('details'))a.closest('details').open=true;});document.body.classList.toggle('report-view',route==='reports');if(route==='reports')await renderReports();else if(hubNames[route])await renderHub(route);else if(route==='overview')renderOverview();else if(route==='transactions')renderTransactions();else if(route==='accounts'||route==='cards')renderAccounts(route==='cards');else if(route==='calendar')renderCalendar();else if(route==='investments')renderInvestments();else if(route==='documents')renderDocuments();else if(route==='imports')renderImport();else if(route==='audit')await renderAudit();else if(route==='users')renderUsers();else if(route==='connections')renderConnections();else if(configs[route])renderRecords(route);else renderOverview();}
async function refresh(){await load();await render();}
for(const [group,items]of groups){let target=$('#nav');if(group==='PAINÉIS')target.append(node('div','group',group));else{const details=node('details','nav-section');details.append(node('summary','',group));target.append(details);target=details;}items.forEach((id,index)=>{const link=node('a');link.href='#'+id;append(link,node('span','symbol',symbols[index%symbols.length]),node('span','',names[id]));target.append(link);});}
document.querySelectorAll('dialog .close').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('#edit-form').addEventListener('submit',async e=>{e.preventDefault();const b=$('button[type=submit]',$('#editor'));try{b.disabled=true;await submitForm();}catch(err){$('#edit-error').textContent=err.message;}finally{b.disabled=false;}});
$('#privacy').addEventListener('click',()=>{privateValues=!privateValues;document.body.classList.toggle('privacy',privateValues);$('#privacy').textContent=privateValues?'Mostrar valores':'Ocultar valores';});$('#quick').addEventListener('click',newTransaction);
window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'overview';render().then(()=>window.scrollTo({top:0,behavior:'instant'})).catch(error);});
(async()=>{route=location.hash.slice(1)||'overview';await refresh();})().catch(error);

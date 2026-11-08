'use strict';
// Offline synthetic fixtures only. No licenses, HA commands, network or real ledger.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../../custom_components/cloudpelizzon/ui/shell/finance');
const dashboards=fs.readFileSync(path.join(root,'dashboards.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
new vm.Script(dashboards);new vm.Script(app);
class Element{
 constructor(){this.children=[];this.classList={add(){},toggle(){}};this.style={setProperty(){}};this.value='';this.isConnected=true;}
 append(...items){this.children.push(...items);} prepend(...items){this.children.unshift(...items);}
 insertBefore(item){this.children.push(item);} replaceChildren(...items){this.children=items;}
 setAttribute(){} addEventListener(){} remove(){} querySelector(){return new Element();}
}
const charts=[],tables=[],notices=[],emptyStates=[],statsCalls=[];
const context=vm.createContext({console,Intl,Option:class extends Element{},document:{querySelector:()=>new Element()},window:{},reportChartData:new Map()});
vm.runInContext(dashboards,context);
// Do not execute browser bootstrap: no state API / mutation operation is called.
vm.runInContext(app.slice(0,app.indexOf("for(const [group,items]of groups)")),context);
Object.assign(context,{charts,tables,notices,emptyStates,statsCalls,Element});
vm.runInContext(`
 node=()=>new Element();panel=()=>new Element();button=()=>new Element();
 xyChart=(...args)=>{charts.push(args);return new Element();};
 table=(parent,columns,rows,actions)=>{tables.push({columns,rows,actions});};
 notice=(text)=>notices.push(text);empty=(parent,text)=>emptyStates.push(text);
 stats=(items)=>statsCalls.push(items);titlePage=()=>{};hubLinks=()=>{};
 state={today:'2026-01-01',records:{},user:{role:'admin'}};
`,context);
const run=s=>vm.runInContext(s,context);
assert.equal(run('money(null)'),'Indisponível');assert.equal(run('money(undefined)'),'Indisponível');assert.equal(run('money(NaN)'),'Indisponível');assert.notEqual(run('money(0)'),'Indisponível');
assert.equal(run('financialValue(undefined)'),'Indisponível');assert.equal(run('financialValue(0)'),0);
run(`overview={cash_cents:919,projections:[{days:30,cash_cents:123,maintenance_forecast_cents:17,cash_with_maintenance_cents:99}]};cashProjection(new Element());`);
assert.equal(charts[0][3][1].values[1],99,'backend scenario is preserved even if unlike local subtraction');
charts.length=0;
run(`cashProjection(new Element(),{rows:[{date:'2026-01-02',amount_cents:500}]});`);
assert.equal(charts.length,0);assert.match(emptyStates.at(-1),/indisponível/);
run(`cashProjection(new Element(),{cash_projection:overview});`);assert.equal(charts[0][3][1].values[1],99);
run(`fixture={from:'2026-01-01',to:'2026-06-30',months:['2026-01'],values:[888],rows:[{date:'2026-01-05',equipment_id:'synthetic',amount_cents:77}],cash_projection:overview};`);
assert.equal(run(`filterMaintenanceForecast(fixture,fixture.from,fixture.to,'','Todos').values[0]`),888);
assert.equal(run(`filterMaintenanceForecast(fixture,fixture.from,fixture.to,'synthetic','Fixture').values`),null);
assert.equal(run(`filterMaintenanceForecast(fixture,fixture.from,'2026-01-31','','Todos').cash_projection`),null);
run(`maintenanceForecast(new Element(),filterMaintenanceForecast(fixture,fixture.from,fixture.to,'synthetic','Fixture'));`);
assert.equal(tables.at(-1).rows[0].amount_cents,77);
assert.match(emptyStates.at(-1),/Totais indisponíveis/);
// Existing cost contract: state.utility_costs[id].estimated_cents. No tariff fallback.
run(`state.records.utilities=[{id:'synthetic',quantity:25,tariff_cents:100,period:'2026-01'}];state.utility_costs={};renderRecords('utilities');`);
assert.equal(tables.find(t=>t.columns.some(c=>c[1]==='estimate')).rows[0].estimate,'Indisponível');
tables.length=0;
run(`state.utility_costs.synthetic={estimated_cents:321};renderRecords('utilities');`);
assert.equal(tables.find(t=>t.columns.some(c=>c[1]==='estimate')).rows[0].estimate,run('money(321)'));
// Market source consolidation and comparison are optional backend contracts:
// state.market_display[]: resolved ticker, quote, history, source, change_percent.
// state.market_comparisons[]: exact tickers[], metrics[ticker].variation/dispersion,
// days[], series[{name: ticker, values: base100[]}], optional note.
function market(comparisons){
 charts.length=0;tables.length=0;notices.length=0;
 context.comparisons=comparisons;
 run(`state.market_catalog=[{ticker:'SYN1',company:'Synthetic one',currency:'BRL'},{ticker:'SYN2',company:'Synthetic two',currency:'BRL'}];
 state.market_quotes=[{ticker:'SYN1',price_cents:123,history:[['2026-01-01',200],['2026-01-02',300]]}];
 state.market_imports={SYN1:[['2026-01-02',999]]};state.market_b3_history={SYN1:[['2026-01-02',777]]};state.market_comparisons=comparisons;renderMarketCenter();`);
 const listing=tables.find(t=>t.actions);
 assert.equal(listing.rows[0].price_cents,123);
 assert.equal(listing.rows[0].history.at(-1)[1],300,'no history source precedence in client');
 assert.equal(listing.rows[1].change_percent,undefined,'no invented change');
 for(const row of listing.rows){const td=new Element();listing.actions(row,td);td.children[0].checked=true;td.children[0].onchange();}
}
market([]);assert.match(notices.at(-1),/Comparação indisponível/);assert.equal(charts.length,0);
market([{tickers:['SYN1','SYN2'],metrics:{SYN1:{variation:42,dispersion:7}},days:['2026-01-01','2026-01-02'],series:[{name:'SYN1',values:[100,456]},{name:'SYN2',values:[100,789]}]}]);
assert.equal(charts.at(-1)[3][0].values[1],456);
assert.equal(tables.at(-1).rows[0].variation,42);
market([{tickers:['SYN1','OTHER'],days:[],series:[]}]);assert.equal(charts.length,0);
// Optional dashboard totals contracts (missing fields render as unavailable):
// planning.totals: budget_cents, actual_cents, saved_cents, subscriptions_cents;
// cards.totals: spent_cents, debt_cents, future_cents, credit_limit_cents;
// cards.items[].debt_cents; home.variation_cents;
// consumption_totals: estimated_cents, actual_cents, solar_cents;
// family.totals: amount_cents, settled_cents, outstanding_cents.
for(const pattern of [/quantity\|\|0\).*tariff_cents/,/P\.projects\.reduce/,/C\.items\.reduce/,/F\.reimbursements\.reduce/,/H\.current-H\.acquisition/,/Math\.sqrt/,/returns\.reduce/,/forecast\.rows\.reduce/,/buckets\.set/])assert.ok(!pattern.test(app+dashboards),pattern.toString());
console.log('finance presentation 7.0.7: syntax and synthetic backend-only boundary checks passed');
// Exercise the real presentation functions, not source-pattern assertions.
// Optional backend fields on budgets/goals/reimbursements/card items:
// utilization_percent (finite number), utilization_status ('warning' for highlight).
const rendered=[];
context.rendered=rendered;
run(`node=(tag,cls,text)=>{const e=new Element();e.tag=tag;e.text=text;rendered.push(e);return e;};
 svgNode=(tag,attrs,text)=>{const e=new Element();e.tag=tag;e.attrs=attrs;e.text=text;rendered.push(e);return e;};
 graphPanel=()=>new Element();`);
function checkPercent(kind,actual,limit,presentation={}){
 rendered.length=0;emptyStates.length=0;
 Object.assign(context,{actual,limit,presentation});
 run(kind==='bullet'?`bullets(new Element(),'Synthetic',[{name:'Synthetic',actual,limit,...presentation}]);`:
  `gauge(new Element(),'Synthetic',actual,limit,presentation);`);
 return {texts:rendered.map(e=>e.text).filter(t=>typeof t==='string'),
  fills:rendered.filter(e=>e.tag==='rect'&&e.attrs?.rx===5).map(e=>e.attrs.fill),
  arcs:rendered.filter(e=>e.tag==='path'&&e.attrs.pathLength===100)};
}
for(const kind of ['bullet','gauge']){
 for(const [actual,limit] of [[10,100],[99,100],[200,100],[0,0]]){
  const result=checkPercent(kind,actual,limit);
  assert.ok(!result.texts.some(t=>t.includes('%')),'no inferred percentage');
  assert.ok(!result.fills.includes('#e8a6b1'),'no inferred budget warning');
  assert.equal(result.arcs.length,0,'no inferred utilization arc');
  assert.ok(result.texts.some(t=>t.includes('Percentual indisponível'))||emptyStates.some(t=>t.includes('Percentual indisponível')));
 }
 for(const percentage of [0,7,99]){
  const result=checkPercent(kind,200,100,{utilization_percent:percentage});
  assert.ok(result.texts.includes(percentage+'% do limite'),'backend percentage wins over money ratio');
  assert.ok(!result.fills.includes('#e8a6b1'));
  for(const arc of result.arcs)assert.equal(arc.attrs.stroke,'#0e8a70','no client threshold even at 99 percent');
 }
 const warning=checkPercent(kind,1,100,{utilization_percent:7,utilization_status:'warning'});
 if(kind==='bullet')assert.ok(warning.fills.includes('#e8a6b1'));
 else assert.equal(warning.arcs[0].attrs.stroke,'#c5496a');
}
console.log('finance presentation 7.0.7: backend-only percentage and warning behavior checks passed');
(async()=>{
 run(`bullets=()=>{};ranking=()=>{};donut=()=>{};waterfall=()=>{};gauge=()=>{};
 state.records.properties=[];state.accounts=[];state.users=[];
 fixtureDashboard={meta:{months:['2026-01'],from:'2026-01-01',to:'2026-01-31'},notes:[],
 money:{expenses:100,monthly_expenses:[100],by_room:[]},
 planning:{projects:[{budget_cents:999,actual:888}],goals:[{saved_cents:777}],subscriptions:[{amount_cents:666}],budgets:[],monthly_commitments:[]},
 cards:{items:[],by_category:[],installment_months:[],installments:[]},
 home:{assets:[],by_property:[],by_room:[],history:[],acquisition:500,current:600},
 consumption:[],family:{reimbursements:[{amount_cents:900,settled_cents:300}],by_person:[],requests:[]}};
 api=async()=>fixtureDashboard;`);
 for(const hub of ['planning_hub','cards_hub','consumption_hub','family_hub','home_hub']){
  context.hub=hub;
  await run(`route=hub;renderHub(hub)`);
  const values=statsCalls.at(-1).map(row=>row[1]);
  const indexes=hub==='family_hub'?[1,2,3]:hub==='home_hub'?[2]:hub==='consumption_hub'?[0,1,2]:[0,1,2,3];
  for(const i of indexes)assert.equal(values[i],'Indisponível',`${hub} must not infer missing KPI ${i}`);
 }
 run(`fixtureDashboard.planning.totals={budget_cents:1,actual_cents:2,saved_cents:0,subscriptions_cents:4};route='planning_hub';`);
 await run(`renderHub(route)`);
 assert.deepEqual(Array.from(statsCalls.at(-1),row=>row[1]),[1,2,0,4]);
 console.log('finance presentation 7.0.7: dashboard missing/zero/backend totals checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

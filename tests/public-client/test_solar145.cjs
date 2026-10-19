const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const classes=new Map(),ctx={HTMLElement:class{attachShadow(){return this.shadowRoot={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]}}},customElements:{define:(n,c)=>classes.set(n,c),get:n=>classes.get(n)},window:{customCards:[]},console,Date,setTimeout,clearTimeout,setInterval,clearInterval};
vm.createContext(ctx);const source=fs.readFileSync(process.argv[2],'utf8');vm.runInContext(source,ctx);
const card=new (classes.get('casa-pelizzon-energy-ops-card'))();card._config={grid_provider:'Enel & Energia <teste>'};
const markup='<p>Copel · SALDO COPEL</p><img src="/assets/copel-tower.png" alt="Copel"><span>sensor.copel_energy</span>';
const result=card._providerText145(markup);assert(result.includes('Enel &amp; Energia &lt;teste&gt;'));assert(!result.includes('SALDO COPEL'));assert(result.includes('src="/assets/copel-tower.png"'));assert(result.includes('sensor.copel_energy'));assert(!result.includes('<teste>'));
card._config.grid_provider='';assert(card._providerText145('<b>Copel</b>').includes('Concessionária'));
card._config.grid_provider='COPEL';assert.equal(card._providerText145('<b>COPEL</b>'),'<b>COPEL</b>');
const p={house:10,solar:20,imp:4,exp:14,balance:10,importPeak:{value:100,time:0},exportPeak:{value:100,time:0},qd1Devices:[],qd2Devices:[]};card._monitoredLoads144=()=>[];
assert(card._analytics({},p).includes('6,00 kWh'));assert(card._analytics({},p).includes('Energia solar usada na casa'));
for(const [imp,exp] of [[100,0],[0,100],[0,0]]){const html=card._grid({imp,exp},p);assert.equal(/import active flow-now145/.test(html),imp>5);assert.equal(/export active flow-now145/.test(html),exp>5);assert(html.includes('←'));assert(html.includes('→'));}
const css=card._css();assert(css.includes('@keyframes flowImport145{from{left:calc(100% - 32px)}to{left:14px}}'));assert(css.includes('@keyframes flowExport145{from{left:14px}to{left:calc(100% - 32px)}}'));assert(css.includes('prefers-reduced-motion:reduce'));
const panel=fs.readFileSync(process.argv[3],'utf8');assert(panel.includes('grid_provider:String(cfg.site?.grid_provider'));assert(panel.includes('Nome da concessionária de energia'));assert(panel.includes('maxlength="80"'));
console.log('SOLAR145=provider_escaped; identifiers_unchanged; direct_solar_correct; live_flow_direction_and_idle_checked');


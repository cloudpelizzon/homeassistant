const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const classes=new Map(),ctx={HTMLElement:class{attachShadow(){return {}}},customElements:{define:(n,c)=>classes.set(n,c),get:n=>classes.get(n)},window:{customCards:[]},console,Date,setTimeout,clearTimeout,setInterval,clearInterval};vm.createContext(ctx);vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),ctx);
const card=new (classes.get('casa-pelizzon-energy-ops-card'))(),svg={innerHTML:''};let factor=1;
const positions={'.v26-inverter':[195,220],'.v26-micro':[195,650],'.v26-solar-total':[325,445],'.v26-grid-meter.import':[795,300],'.v26-grid-meter.export':[795,700]};
const scene={getBoundingClientRect:()=>({x:10,y:20,width:1000*factor,height:500*factor}),querySelector:q=>q==='.flow146'?svg:q==='.v26-shield'?{getBoundingClientRect:()=>({x:410*factor+10,y:120*factor+20,width:300*factor,height:300*factor})}:positions[q]?{getBoundingClientRect:()=>({x:10+(positions[q][0]-50)*factor,y:20+(positions[q][1]/2-20)*factor,width:100*factor,height:40*factor})}:null};
card.shadowRoot={querySelector:()=>scene};card._live=()=>({sofar:100,deye:0,solar:100,imp:300,exp:0});card._syncFlow146();const first=svg.innerHTML;
for(const [x,y] of Object.values(positions))assert(first.includes(x+' '+y),'missing actual card centre');assert.equal((first.match(/data-flow=/g)||[]).length,5);assert(first.includes('motion146 import active'));assert(first.includes('motion146 export idle'));assert(first.includes('motion146 solar idle'));
factor=.67;card._syncFlow146();const normal=s=>s.replace(/-?\d+(?:\.\d+)?/g,n=>Number(Number(n).toFixed(6)));assert.equal(normal(svg.innerHTML),normal(first),'scale changes must preserve normalised anchors');
const panel=fs.readFileSync(process.argv[3],'utf8');assert(panel.includes('_displayScale150'));assert(panel.includes('window.innerHeight-top-3)/scale'));assert(card._css().includes('flow146Move'));assert(card._css().includes('prefers-reduced-motion:reduce'));
console.log('SOLAR146=exact_67_percent_scale; five_card_anchors; resize_invariant_routes; active_flow_only');



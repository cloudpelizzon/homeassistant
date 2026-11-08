'use strict';
// UI effects only: coordinates and amounts are never changed by animation.
(()=>{
 const ns='http://www.w3.org/2000/svg';let serial=0,pending=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function signal(head){
  if(head.querySelector('.finance-signal'))return;
  const visual=el('svg',{viewBox:'0 0 270 82',class:'finance-signal','aria-hidden':'true'});
  const curve='M3 59 C32 59 40 32 59 32 S90 53 113 44 S148 23 167 31 S195 64 215 49 S246 27 267 38';
  for(const y of [18,42,66])visual.append(el('path',{d:'M0 '+y+' H270',class:'signal-grid'}));
  visual.append(el('path',{d:curve+' V82 H3 Z',class:'signal-fill'}),el('path',{d:curve,class:'signal-trace'}));
  visual.append(el('path',{d:curve,class:'signal-flow',pathLength:100}),el('circle',{r:4.5,cx:267,cy:38,class:'signal-beacon'}));
  head.append(visual);
 }
 const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n;};
 function decorate(svg){if(svg.dataset.aurora)return;svg.dataset.aurora='true';const defs=el('defs',{});svg.prepend(defs);const id='aurora-'+(++serial);let counter=0;
  function gradient(color,area=false){const key=id+'-'+counter++;const g=el('linearGradient',{id:key,x1:0,y1:0,x2:0,y2:1});g.append(el('stop',{offset:'0%', 'stop-color':color,'stop-opacity':area?.55:1}),el('stop',{offset:'100%','stop-color':color,'stop-opacity':area?0:.64}));defs.append(g);return 'url(#'+key+')';}
  svg.querySelectorAll('polyline').forEach(line=>{const coords=(line.getAttribute('points')||'').trim().split(/\s+/).map(p=>p.split(',').map(Number));if(!coords.length||coords.some(p=>p.length!==2||p.some(n=>!Number.isFinite(n))))return;let d='M '+coords[0].join(' ');for(let i=1;i<coords.length;i++){const a=coords[i-1],b=coords[i],mid=(a[0]+b[0])/2;d+=' C '+mid+' '+a[1]+' '+mid+' '+b[1]+' '+b.join(' ');}const path=el('path',{d,fill:'none',stroke:line.getAttribute('stroke')||'#72e3bd',class:'modern-line','stroke-width':3.2});if(line.hasAttribute('stroke-dasharray'))path.setAttribute('stroke-dasharray',line.getAttribute('stroke-dasharray'));line.replaceWith(path);if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.body.classList.contains('motion-off')&&!path.hasAttribute('stroke-dasharray')){const len=path.getTotalLength();path.animate([{strokeDasharray:String(len),strokeDashoffset:String(len)},{strokeDasharray:String(len),strokeDashoffset:'0'}],{duration:950,easing:'cubic-bezier(.16,1,.3,1)'});}});
  svg.querySelectorAll('rect[fill]').forEach(r=>{const color=r.getAttribute('fill');if(color?.startsWith('#')&&Number(r.getAttribute('height'))>16){r.setAttribute('fill',gradient(color));r.classList.add('modern-bar');}});
  svg.querySelectorAll('polygon[fill]').forEach(p=>{const color=p.getAttribute('fill');if(color?.startsWith('#')){p.setAttribute('fill',gradient(color,true));p.classList.add('modern-area');p.setAttribute('opacity','.38');}});
  svg.querySelectorAll('circle').forEach(c=>{if(Number(c.getAttribute('r'))<12)c.classList.add('modern-point');else if(c.hasAttribute('stroke-dasharray'))c.classList.add('modern-arc');});
 }
 function scan(){
  pending=false;
  const head=document.querySelector('main .page-head');if(head)signal(head);
  document.querySelectorAll('main svg:not([data-aurora]):not(.finance-signal)').forEach(decorate);
 }
 const start=()=>{const main=document.querySelector('main');new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(scan);}}).observe(main,{childList:true,subtree:true});scan();
  const theme=node('button','','');theme.type='button';theme.id='theme-toggle';
  const daylight=document.getElementById('finance-daylight');
  let dark=localStorage.getItem('cp-finance-theme')==='dark';
  function paintTheme(){
   document.documentElement.dataset.theme=dark?'dark':'light';
   daylight.media=dark?'print':'all';
   theme.textContent=dark?'☾ Escuro':'☀ Claro';
   theme.setAttribute('aria-label','Tema escuro');
   theme.setAttribute('aria-pressed',String(dark));
  }
  paintTheme();theme.onclick=()=>{dark=!dark;localStorage.setItem('cp-finance-theme',dark?'dark':'light');paintTheme();};
  const toggle=node('button');toggle.id='motion-toggle';toggle.type='button';
  let enabled=localStorage.getItem('cp-finance-motion')!=='off';
  function paint(){
   const active=enabled&&!reduced.matches;
   document.body.classList.toggle('motion-off',!active);
   toggle.textContent=active?'✦ Efeitos ativos':reduced.matches?'Movimento reduzido':'Efeitos pausados';
   toggle.setAttribute('aria-pressed',String(active));
   toggle.disabled=reduced.matches;
   if(!active)main.querySelectorAll('.modern-line').forEach(path=>path.getAnimations().forEach(animation=>animation.cancel()));
  }
  paint();toggle.onclick=()=>{enabled=!enabled;localStorage.setItem('cp-finance-motion',enabled?'on':'off');paint();};
  reduced.addEventListener('change',paint);
  document.querySelector('.header-actions').prepend(theme,toggle);
  let tooltip;const hide=()=>{tooltip?.remove();tooltip=null;};main.addEventListener('pointerover',event=>{const target=event.target.closest('svg circle,svg rect,svg path');const title=target?.querySelector('title')?.textContent;if(!title||document.body.classList.contains('privacy'))return;hide();tooltip=document.createElement('div');tooltip.className='modern-tooltip';tooltip.textContent=title;tooltip.setAttribute('role','tooltip');document.body.append(tooltip);const box=target.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(innerWidth-330,box.x+box.width/2))+'px';tooltip.style.top=Math.max(8,box.y-48)+'px';});main.addEventListener('pointerout',hide);window.addEventListener('scroll',hide,{passive:true});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

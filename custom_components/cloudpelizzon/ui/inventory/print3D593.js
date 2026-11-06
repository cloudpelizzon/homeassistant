const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function rendererForPrint593(host){
 const end=Date.now()+20000;
 while(!host._architect577){
  if(!host.isConnected)throw Error('A visualização 3D foi fechada.');
  if(['compatibility','unavailable'].includes(host.dataset.renderer577)||Date.now()>end)throw Error('A impressão 3D precisa da visualização WebGL disponível.');
  await new Promise(resolve=>setTimeout(resolve,60));
 }
 if(typeof host._architect577.capture593!=='function')throw Error('Atualize a página para carregar a impressão 3D.');
 return host._architect577;
}
export function imageForPrint593(snapshot){
 if(!snapshot?.image?.startsWith('data:image/png;base64,'))throw Error('A captura da cena 3D não foi concluída.');
 return `<img class="scene-print593" src="${snapshot.image}" alt="Captura da visualização 3D" width="${snapshot.width}" height="${snapshot.height}">`;
}
export function document3D593(snapshot,{title,paper='A4',note=''}){
 return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>CloudPelizzon · ${esc(title)}</title><style>@page{size:${paper==='A3'?'A3':'A4'} landscape;margin:10mm}*{box-sizing:border-box}html,body{margin:0;background:white;color:#173849;font:12px Arial}body{print-color-adjust:exact;-webkit-print-color-adjust:exact;padding:3mm;height:${paper==='A3'?275:188}mm;display:flex;flex-direction:column}h1{font-size:19px;margin:0 0 6px}p{font-size:11px;margin:5px 0}.scene-print593{display:block;width:100%;height:0;min-height:0;flex:1 1 0;object-fit:contain}h1,p,footer{flex-shrink:0}footer{font-size:9px;margin-top:6px;color:#526c7c}</style><h1>CloudPelizzon · ${esc(title)}</h1><p>${esc(note||'Câmera, objetos e pavimentos visíveis da visualização atual.')}</p>${imageForPrint593(snapshot)}<footer>Inventário local · ${esc(new Date().toLocaleString('pt-BR'))} · representação ilustrativa.</footer></html>`;
}
export async function loadPrintFrame593(frame,document){
 const ready=new Promise(resolve=>frame.addEventListener('load',async()=>{await Promise.allSettled([...frame.contentDocument.images].map(i=>i.decode()));await frame.contentDocument.fonts?.ready;resolve();},{once:true}));
 frame.srcdoc=document;await ready;
}
export async function openCurrent3DPrint593(owner,host,title,note=''){
 const modal=owner.dialog(`<h2>Imprimir 3D · ${esc(title)}</h2><p>${esc(note||'A imagem preserva o ângulo e os objetos da visualização atual.')}</p><div class="actions"><label>Papel<select data-current-paper593><option value="A4">A4 · paisagem</option><option value="A3">A3 · paisagem</option></select></label><button data-current-print593 disabled>Imprimir / salvar PDF</button><button class="secondary" data-current-close593>Fechar</button></div><p data-current-status593 role="status">Preparando os modelos e a imagem 3D…</p><div data-current-host593></div>`);
 modal.classList.add('print3d593');const status=modal.querySelector('[data-current-status593]');let snapshot,frame;
 modal.querySelector('[data-current-close593]').onclick=()=>modal.close();
 const show=async()=>{modal.querySelector('[data-current-print593]').disabled=true;frame?.remove();frame=document.createElement('iframe');frame.className='map-print-frame592';frame.title='Pré-visualização de impressão 3D';modal.querySelector('[data-current-host593]').append(frame);await loadPrintFrame593(frame,document3D593(snapshot,{title,paper:modal.querySelector('[data-current-paper593]').value,note}));if(!modal.isConnected)return;status.textContent='Imagem 3D pronta. Confira antes de imprimir.';modal.querySelector('[data-current-print593]').disabled=false;};
 modal.querySelector('[data-current-paper593]').onchange=async()=>{if(snapshot)await show();};
 modal.querySelector('[data-current-print593]').onclick=()=>{frame.contentWindow.focus();frame.contentWindow.print();};
 try{const api=await rendererForPrint593(host);snapshot=await api.capture593();if(modal.isConnected)await show();}
 catch(e){status.textContent=e.message;}
 return modal;
}

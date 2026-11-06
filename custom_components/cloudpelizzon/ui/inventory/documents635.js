import {sha256635} from './sha256635.js?v=0dda40874687bd90fa7d64414d9c93fc32ef8a6a0ceddd073d13306f03d08581';
const LIMIT635=10*1024*1024;
const M635={invalid_document_size:'Use um arquivo de até 10 MB.',invalid_document_format:'Arquivo inválido. Use PDF, JPG ou PNG; para NF-e, também é aceito XML.',invalid_invoice_xml:'O XML deve ser uma NF-e válida, sem conteúdo externo.',document_storage_limit:'O limite local de anexos foi atingido. Revise os documentos antes de enviar outro.',document_changed_review_again:'O anexo mudou em outra janela. Confira os arquivos e tente novamente.',document_changed_or_missing:'O documento foi substituído ou removido. Atualize a lista.',document_upload_expired:'O envio expirou. Escolha o arquivo e tente novamente.',document_upload_busy:'Há outros envios em andamento. Aguarde e tente novamente.',licensed_feature_required:'Os documentos de compra e garantia fazem parte da versão completa.'};
const size635=n=>n<1048576?`${Math.ceil(n/1024)} KB`:`${(n/1048576).toFixed(1)} MB`;
function base635(bytes){let value='';for(let at=0;at<bytes.length;at+=8192)value+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(value);}
function unbase635(text){return Uint8Array.from(atob(text),x=>x.charCodeAt(0));}
customElements.whenDefined('cloudpelizzon-inventory-panel').then(()=>{
 const P=customElements.get('cloudpelizzon-inventory-panel');if(P.prototype.documents635Installed)return;P.prototype.documents635Installed=true;
 const original=P.prototype.deviceForm;
 P.prototype.deviceForm=async function(id,duplicate=false){
  const result=await original.call(this,id,duplicate),dialog=[...this.shadowRoot.querySelectorAll('dialog')].reverse().find(x=>x.open&&x.querySelector('#device-form'));
  if(!dialog||dialog.dataset.documents635)return result;dialog.dataset.documents635='1';
  const page=dialog.querySelector('[data-cmdb-page="purchase"] .cmdb-fields')||dialog.querySelector('[data-cmdb-page="purchase"]');if(!page)return result;
  const block=document.createElement('section');block.dataset.documents635='1';block.style.cssText='grid-column:1/-1;min-width:0;border-top:1px solid var(--atlas-border,#546071);padding-top:18px;margin-top:10px;';
  block.innerHTML='<h3>Documentos de compra e garantia</h3><p>Guarde os arquivos junto ao equipamento. Os anexos são salvos ao concluir o envio, independentemente de “Salvar cadastro”.</p><div data-doc-slots635></div><p data-doc-status635 role="status" aria-live="polite"></p><small>Até 10 MB por arquivo. Armazenamento privado na instalação; os anexos não são enviados ao Portal.</small><small data-doc-storage635 style="display:block;margin-top:6px"></small>';
  page.append(block);const slots=block.querySelector('[data-doc-slots635]'),status=block.querySelector('[data-doc-status635]');
  const actor=this.hass?.user||this._hass?.user,paid=this.data?.capabilities?.mode!=='free'&&this.data?.capabilities?.features?.advanced_map!==false;
  if(!id||duplicate||!paid||!actor?.is_admin){
   status.textContent=!paid?'Disponível na versão completa.':!actor?.is_admin?'Documentos disponíveis somente para administradores.':duplicate?'Os documentos da compra original não são duplicados. Salve o novo equipamento para anexar seus documentos.':'Salve o equipamento antes de anexar os documentos.';
   for(const [kind,label]of [['invoice','Nota fiscal'],['warranty','Documento de garantia']]){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='file';input.disabled=true;input.setAttribute('aria-label',label);l.append(input);slots.append(l);}return result;
  }
  let list=[],busy=false,token='',closed=false;const panel=this,active=()=>!closed&&dialog.isConnected&&dialog.open&&(panel.hass?.user||panel._hass?.user)===actor;
  const say=text=>{if(active())status.textContent=text;};
  const failure=e=>{const raw=String(e?.message||e?.code||e||'');return Object.entries(M635).find(([k])=>raw.includes(k))?.[1]||'Não foi possível concluir. O documento anterior foi preservado; confira sua conexão e permissão.';};
  const call=(operation,args={})=>panel.ws(operation,{id,...args});
  const storage=r=>{if(active())block.querySelector('[data-doc-storage635]').textContent=`Espaço de anexos: ${size635(r.storage_bytes||0)} de ${size635(r.storage_limit||536870912)}.`;};
  const refresh=async()=>{const r=await call('documents.list');if(active()){list=r.documents||[];storage(r);draw();}};
  const failed=async e=>{if(active())await refresh().catch(()=>{});say(failure(e));};
  dialog.querySelector('#device-form').addEventListener('submit',e=>{if(busy){e.preventDefault();e.stopImmediatePropagation();say('Aguarde a operação do documento terminar antes de salvar o cadastro.');}},true);
  dialog.addEventListener('close',()=>{closed=true;if(token)call('documents.abort',{upload_id:token}).catch(()=>{});},{once:true});
  function draw(){
   slots.replaceChildren();slots.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:14px;';
   for(const [kind,title]of [['invoice','Nota fiscal'],['warranty','Documento de garantia']]){
    const row=list.find(x=>x.kind===kind),card=document.createElement('fieldset');card.style.cssText='min-width:0;margin:0;padding:14px;border:1px solid var(--atlas-border,#546071);border-radius:9px;';const legend=document.createElement('legend');legend.textContent=title;card.append(legend);
    const info=document.createElement('p');info.style.cssText='overflow-wrap:anywhere';info.textContent=row?`${row.filename} · ${size635(row.size)} · ${new Date(row.uploaded_at*1000).toLocaleDateString('pt-BR')}`:'Nenhum documento anexado.';card.append(info);
    const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;';card.append(actions);
    const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=busy;b.onclick=fn;actions.append(b);return b;};
    if(row){button('Visualizar',()=>download(row,true));button('Baixar',()=>download(row));button('Remover',async()=>{if(!confirm(`Remover ${title.toLowerCase()} deste equipamento?`))return;busy=true;draw();try{await call('documents.remove',{kind,expected:row.id});await refresh();say('Documento removido.');}catch(e){await failed(e);}finally{busy=false;if(active())draw();}});}
    const label=document.createElement('label');label.textContent=row?'Substituir arquivo':'Selecionar arquivo';label.style.cssText='display:block;margin-top:12px';const input=document.createElement('input');input.type='file';input.accept=kind==='invoice'?'.pdf,.jpg,.jpeg,.png,.xml':'.pdf,.jpg,.jpeg,.png';input.disabled=busy;input.setAttribute('aria-label',title);label.append(input);card.append(label);
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;if(file.size<=0||file.size>LIMIT635){say(M635.invalid_document_size);input.value='';return;}if(row&&!confirm(`Substituir ${row.filename}? O arquivo anterior será mantido até o novo envio terminar.`)){input.value='';return;}await upload(kind,file,row?.id||'');};
    const hint=document.createElement('small');hint.textContent=kind==='invoice'?'PDF, JPG, PNG ou XML da NF-e.':'PDF, JPG ou PNG.';card.append(hint);slots.append(card);
   }
  }
  async function upload(kind,file,expected){
   if(busy||!active())return;busy=true;draw();say('Conferindo o arquivo…');
   try{
    const bytes=new Uint8Array(await file.arrayBuffer()),sha=await sha256635(bytes);if(!active())return;
    const r=await call('documents.begin',{kind,filename:file.name,size:bytes.length,sha256:sha,expected});token=r.upload_id;
    for(let offset=0;offset<bytes.length;offset+=r.chunk_bytes){if(!active())return;await call('documents.chunk',{upload_id:token,offset,data:base635(bytes.subarray(offset,offset+r.chunk_bytes))});say(`Enviando ${Math.min(100,Math.round((offset+r.chunk_bytes)/bytes.length*100))}%…`);}
    if(!active())return;const saved=await call('documents.finish',{upload_id:token});token='';if(active()){list=saved.documents;storage(saved);draw();say('Documento anexado e salvo.');}
   }catch(e){await failed(e);}
   finally{if(token){const abort=token;token='';await call('documents.abort',{upload_id:abort}).catch(()=>{});}busy=false;if(active())draw();}
  }
  async function download(row,preview=false){
   if(busy||!active())return;busy=true;draw();say(preview?'Preparando a visualização…':'Preparando o download…');
   try{
    const parts=[];let offset=0;
    while(offset<row.size){if(!active())return;const part=await call('documents.read',{document_id:row.id,offset});if(part.id!==row.id||part.offset!==offset||part.size!==row.size||part.sha256!==row.sha256)throw new Error('document_changed_or_missing');const bytes=unbase635(part.data);if(!bytes.length)throw new Error('document_changed_or_missing');parts.push(bytes);offset+=bytes.length;}
    const bytes=new Uint8Array(row.size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}if(await sha256635(bytes)!==row.sha256)throw new Error('document_changed_or_missing');if(!active())return;
    if(preview){
     const viewer=panel.dialog('<header><h2></h2><button type="button" data-close637>Fechar visualização</button></header>');viewer.classList.add('document-preview637');viewer.querySelector('h2').textContent=row.filename;viewer.querySelector('[data-close637]').onclick=()=>viewer.close();
     let url='';
     if(row.mime==='application/pdf'){url=URL.createObjectURL(new Blob([bytes],{type:row.mime}));const frame=document.createElement('iframe');frame.title='Visualização de '+row.filename;frame.referrerPolicy='no-referrer';frame.src=url;viewer.append(frame);}
     else if(['image/jpeg','image/png'].includes(row.mime)){url=URL.createObjectURL(new Blob([bytes],{type:row.mime}));const img=document.createElement('img');img.alt=row.filename;img.src=url;viewer.append(img);}
     else{const pre=document.createElement('pre');pre.textContent=new TextDecoder().decode(bytes);viewer.append(pre);}
     const clean=()=>{if(url){URL.revokeObjectURL(url);url='';}};viewer.addEventListener('close',clean,{once:true});dialog.addEventListener('close',()=>{if(viewer.open)viewer.close();clean();},{once:true});say('Documento aberto para visualização.');return;
    }
    const url=URL.createObjectURL(new Blob([bytes],{type:row.mime})),a=document.createElement('a');a.href=url;a.download=row.filename;a.rel='noopener';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);say('Arquivo conferido e enviado para download.');
   }catch(e){await failed(e);}finally{busy=false;if(active())draw();}
  }
  draw();refresh().catch(e=>say(failure(e)));return result;
 };
});

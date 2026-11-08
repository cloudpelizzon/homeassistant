// Same-origin RPC through the authenticated CloudPelizzon HA panel.
window.financeHA651=(operation,payload={})=>new Promise((resolve,reject)=>{
  if(parent===window){reject(Error('Abra o Finanças pelo painel CloudPelizzon no Home Assistant.'));return;}
  const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('A conexão demorou. Confira o estado do módulo antes de repetir a operação.'));},60000);
  function receive(event){
    if(event.origin!==location.origin||event.source!==parent||event.data?.channel!=='cp-finance651'||event.data.id!==id)return;
    clearTimeout(timer);window.removeEventListener('message',receive);
    if(event.data.error)reject(Error(event.data.error));else resolve(event.data.result);
  }
  window.addEventListener('message',receive);
  parent.postMessage({channel:'cp-finance651',kind:'execute',id,operation,payload},location.origin);
});
window.financeDocument651=async id=>{
  const document=await window.financeHA651('document_get',{id});
  const bytes=Uint8Array.from(atob(document.base64),c=>c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes],{type:document.mime}));
};

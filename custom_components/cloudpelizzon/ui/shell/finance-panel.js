// Public presentation bridge. HA credentials never enter the financial iframe.
class CloudPelizzonFinance651 extends HTMLElement {
  connectedCallback(){if(this._hass)this.mount();}
  mount(){
    if(this.frame)return;
    this.style.cssText='display:block;height:100dvh';
    this.fit=()=>{
      if(!this.getClientRects().length)return;
      const top=this.getBoundingClientRect().top;
      const viewport=window.visualViewport;
      const bottom=viewport?viewport.height+viewport.offsetTop:document.documentElement.clientHeight;
      const height=Math.max(1,Math.floor(bottom-Math.max(0,top)))+'px';
      if(this.style.height!==height)this.style.height=height;
    };
    this.sizeObserver=new ResizeObserver(this.fit);
    this.sizeObserver.observe(this);
    window.addEventListener('resize',this.fit);
    window.visualViewport?.addEventListener('resize',this.fit);
    this.frame=document.createElement('iframe');
    this.frame.src='/cloudpelizzon/frontend/finance/index.html?v=99affc6de521daad1530b518acef44e986ddd902575165377da003dbc774997d';
    this.frame.title='CloudPelizzon Finanças';
    this.frame.style.cssText='display:block;width:100%;height:100%;border:0';
    this.append(this.frame);
    this.fit();
    this.receive=async event=>{
      if(event.origin!==location.origin||event.source!==this.frame.contentWindow)return;
      const msg=event.data;
      if(!msg||msg.channel!=='cp-finance651'||typeof msg.id!=='string'||msg.id.length>80)return;
      if(msg.kind!=='execute'||typeof msg.operation!=='string'||!msg.payload||typeof msg.payload!=='object')return;
      const reply={channel:'cp-finance651',id:msg.id};
      try{
        if(!this._hass)throw Error('Aguardando conexão com o Home Assistant.');
        reply.result=await this._hass.callWS({type:'cloudpelizzon/finance/execute',operation:msg.operation,payload:msg.payload});
      }catch(error){reply.error=error.message||'Operação não concluída.';}
      if(this.isConnected&&event.source===this.frame.contentWindow)event.source.postMessage(reply,location.origin);
    };
    window.addEventListener('message',this.receive);
  }
  disconnectedCallback(){
    this.sizeObserver?.disconnect();
    if(this.fit){window.removeEventListener('resize',this.fit);window.visualViewport?.removeEventListener('resize',this.fit);}
    window.removeEventListener('message',this.receive);this.frame?.remove();this.frame=null;
  }
  set hass(value){this._hass=value;if(value&&this.isConnected&&!this.frame)this.mount();}
}
if(!customElements.get('cloudpelizzon-finance-panel'))customElements.define('cloudpelizzon-finance-panel',CloudPelizzonFinance651);

const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
export function annualPreview631(price,percent,purchased,today=new Date()){
 if(!price||percent===''||!/^\d{4}-\d{2}-\d{2}$/.test(purchased))return '';
 const p=Number(price.replace(',','.')),d=Number(percent.replace(',','.')),[y,m,day]=purchased.split('-').map(Number);
 const acquired=new Date(y,m-1,day);if(acquired.getFullYear()!==y||acquired.getMonth()!==m-1||acquired.getDate()!==day)return '';
 if(!Number.isFinite(p)||p<0||p>1e9||!Number.isFinite(d)||d<0||d>100)return '';
 const anniversary=new Date(today.getFullYear(),m-1,Math.min(day,new Date(today.getFullYear(),m,0).getDate()));
 const years=Math.max(0,today.getFullYear()-y-(new Date(today.getFullYear(),today.getMonth(),today.getDate())<anniversary?1:0));
 const amount=years===0?p:p*Math.pow(1-d/100,years);return (Math.round((amount+Number.EPSILON)*100)/100).toFixed(2);
}
export function financeFields620(a){return `<label>Depreciação anual (%)<input name="depreciation_percent" inputmode="decimal" value="${escape(a.depreciation_percent||'')}" placeholder="Ex.: 10" maxlength="8"><small>De 0 a 100% ao ano, sobre o saldo. Aplicada em cada aniversário da aquisição.</small></label><label>Definição do valor atual<select name="current_value_mode"><option value="calculated" ${a.current_value_mode!=='manual'?'selected':''}>Calcular pela depreciação anual</option><option value="manual" ${a.current_value_mode==='manual'?'selected':''}>Informar valor manualmente</option></select></label><label>Valor atual (R$)<input name="current_value" inputmode="decimal" value="${escape(a.current_value||'')}" placeholder="Informe valor, data de aquisição e taxa anual" maxlength="20"><small>Atualização automática por anos completos desde a aquisição. A prévia é confirmada pelo motor ao salvar.</small></label>`;}
export function bindFinance620(dialog){
 const find=n=>dialog.querySelector(`[name="${n}"]`),price=find('purchase_value'),percent=find('depreciation_percent'),date=find('purchase_date'),value=find('current_value'),mode=find('current_value_mode');
 if(!price||!percent||!date||!value||!mode)return;
 function refresh(){value.readOnly=mode.value==='calculated';if(value.readOnly)value.value=annualPreview631(price.value,percent.value,date.value);}
 for(const field of [price,percent,date,mode])for(const event of ['input','change'])field.addEventListener(event,refresh);
 refresh();
}

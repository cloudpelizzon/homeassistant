'use strict';

// Keep feedback if the user leaves Integrations and returns during the request.
const financeSyncStatus651={running:false,text:'',tone:'',revision:0,results:null,update:null};

async function financeIntegrationPanel() {
  const host=panel('Sincronização automática');
  host.prepend(node('p','muted','Inventário e Manutenção são consultados automaticamente a cada 10 minutos quando habilitados. Confira o resultado da última execução abaixo.'));
  let result;
  try { result=await api('integrations_get'); }
  catch(error) {
    if(host.isConnected)notice('A configuração das fontes exige um administrador no Finanças e no Home Assistant.',host);
    return;
  }
  if(!host.isConnected)return;
  const {config,choices,last}=result;
  const form=node('form');
  const fields=node('div','fields');form.append(fields);
  const field=(parent,text,input)=>{
    const label=node('label','',text);label.append(input);parent.append(label);return input;
  };
  const check=(key,label)=>{
    const input=node('input');input.type='checkbox';input.checked=config[key];
    return field(fields,label,input);
  };
  const select=(options,value,blank)=>{
    const input=node('select');
    if(blank)input.append(new Option(blank,''));
    for(const [id,label] of options)input.append(new Option(label,id));
    if(value&&!options.some(([id])=>id===value))input.append(new Option('Indisponível · '+value,value));
    input.value=value;return input;
  };
  const integer=(label,value,min,max)=>{
    const input=node('input');input.type='number';input.min=min;input.max=max;input.required=true;input.value=value;
    return field(fields,label,input);
  };
  const inventory=check('inventory','Sincronizar equipamentos e valores do Inventário');
  const maintenance=check('maintenance','Sincronizar cadastros e execuções da Manutenção');
  const quotes=check('quotes','Consultar cotações da B3 e fechamentos dos EUA');
  const mobile=field(fields,'Celular · serviço do Home Assistant',select(choices.mobile.map(id=>[id,id]),config.mobile,'Sem destino ativo'));
  const alexa=field(fields,'Alexa · destino de anúncio',select(choices.alexa.map(row=>[row.id,row.label]),config.alexa,'Sem destino ativo'));
  const hour=integer('Hora local a partir da qual o lembrete pode sair',config.hour,0,23);
  const days=integer('Dias de antecedência do vencimento',config.days,0,30);
  form.append(node('p','muted','O lembrete é genérico, sem valores. A rotina verifica os compromissos de hora em hora e envia no máximo um aviso diário por canal.'));
  const sensorBox=node('fieldset','panel');
  sensorBox.append(node('legend','','Medições mensais do Home Assistant'));
  sensorBox.append(node('p','muted','Use medidores que acumulam o mês atual. Deixe a tarifa em branco para buscar o custo ou uma tarifa compatível no Home Assistant. A fatura é registrada separadamente.'));
  const sensorRows=node('div');
  const available=choices.sensors.filter(row=>row.monthly).map(row=>[row.id,row.label+' · '+row.unit]);
  function addSensor(link={id:'',kind:'electricity',tariff:''}){
    if(sensorRows.children.length>=12)return;
    const row=node('div','toolbar');
    const sensor=field(row,'Medidor',select(available,link.id,'Escolha um medidor'));
    sensor.dataset.sensor='id';
    const kind=field(row,'Categoria',select(Object.entries(enums.utilityKind),link.kind));
    kind.dataset.sensor='kind';
    const tariff=node('input');tariff.type='number';tariff.step='0.01';tariff.min=0;tariff.value=link.tariff;
    tariff.placeholder='Automática pelo HA';
    field(row,'Tarifa manual opcional (R$)',tariff).dataset.sensor='tariff';
    row.append(button('Retirar',()=>row.remove(),'small'));sensorRows.append(row);
  }
  config.sensors.forEach(addSensor);
  sensorBox.append(sensorRows,button('+ Vincular medidor',()=>addSensor(),'small'));
  form.append(sensorBox);
  const controls=node('div','toolbar'),save=node('button','primary','Salvar integrações');
  save.type='submit';
  const syncStatus=financeSyncStatus651;
  const feedback=node('div','finance-sync-feedback651');
  feedback.setAttribute('role','status');
  feedback.setAttribute('aria-live','polite');
  feedback.setAttribute('aria-atomic','true');
  const spinner=node('span','finance-sync-spinner651');
  spinner.setAttribute('aria-hidden','true');
  const message=node('span');
  feedback.append(spinner,message);
  const sync=button('Sincronizar agora',async()=>{
    if(syncStatus.running)return;
    syncStatus.running=true;
    syncStatus.tone='running';
    syncStatus.text='Sincronização em andamento…';
    syncStatus.update?.();
    try{
      const response=await api('integrations_run');
      const latest=response.last||{};
      const ran=Object.entries(latest).filter(([key,row])=>row.at!==displayed[key]?.at);
      syncStatus.results=latest;
      syncStatus.revision++;
      const failures=ran.filter(([,row])=>row.status!=='ok').length;
      syncStatus.tone=failures?'warning':'success';
      syncStatus.text=failures?'Sincronização concluída com falhas. Confira o resultado por fonte.':
        ran.length?'Sincronização concluída. Confira o resultado por fonte.':'Nenhuma fonte foi executada. Confira as fontes habilitadas.';
      // Reload the dashboard data without replacing the integration form or losing unsaved selections.
      load().catch(error);
    }catch(err){
      syncStatus.tone='warning';
      syncStatus.text='Não foi possível confirmar a sincronização. Confira o histórico antes de tentar novamente.';
    }finally{
      syncStatus.running=false;
      syncStatus.update?.();
    }
  });
  controls.append(save,sync);

  for(const [channel,label] of [['mobile','Testar celular'],['alexa','Testar Alexa']]){
    const test=button(label,async()=>{
      await api('integrations_test',{channel});
      toast('O Home Assistant aceitou o envio. Confira o destino.');
    },'small');
    test.disabled=!config[channel];
    controls.append(test);
  }
  form.append(controls,feedback);
  form.onsubmit=async event=>{
    event.preventDefault();save.disabled=true;
    const sensors=[...sensorRows.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-sensor]')]
      .map(input=>[input.dataset.sensor,input.value]))).filter(row=>row.id);
    try {
      await api('integrations_save',{inventory:inventory.checked,maintenance:maintenance.checked,quotes:quotes.checked,
        sensors,mobile:mobile.value,alexa:alexa.value,hour:Number(hour.value),days:Number(days.value)});
      await refresh();
      toast('Integrações salvas. Os destinos já podem ser testados.');
    } catch(err){error(err);}
    finally{save.disabled=false;}
  };
  host.append(form);
  const sourceNames={inventory:'Inventário',maintenance:'Manutenção',sensors:'Medidores do HA',quotes:'Bolsa',reminders:'Lembretes'};
  const resultHost=node('div');
  host.append(resultHost);
  let displayed=last, renderedRevision=syncStatus.revision;
  const renderResults=rows=>{
    const details=Object.entries(rows).map(([key,value])=>({
      name:sourceNames[key]||key,time:new Date(value.at).toLocaleString('pt-BR'),
      result:value.status==='ok'?value.count+' registro(s) alterado(s)'+(value.detail?' · '+value.detail:''):'Falha · '+value.reason
    }));
    resultHost.replaceChildren();
    table(resultHost,[['Fonte','name'],['Última tentativa','time'],['Resultado','result']],details);
  };
  renderResults(last);
  syncStatus.update=()=>{
    if(!host.isConnected)return;
    sync.disabled=syncStatus.running;
    sync.textContent=syncStatus.running?'Sincronizando…':'Sincronizar agora';
    resultHost.setAttribute('aria-busy',String(syncStatus.running));
    feedback.dataset.state=syncStatus.tone;
    spinner.hidden=!syncStatus.running;
    message.textContent=syncStatus.text;
    if(renderedRevision!==syncStatus.revision&&syncStatus.results){
      displayed=syncStatus.results;
      renderedRevision=syncStatus.revision;
      renderResults(displayed);
    }
  };
  syncStatus.update();

}

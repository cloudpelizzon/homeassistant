'use strict';

const reportChartData = new WeakMap();
const reportViews = Object.keys(hubNames);
let selectedReport = 'money_hub';
let reportStatus = '';

function renderReports() {
  titlePage('reports');
  const menu = node('div','report-controls');
  const label = node('label','','Visão do relatório');
  const select = node('select');
  for (const id of reportViews) select.append(new Option(hubNames[id], id));
  select.value = selectedReport;
  select.onchange = () => {
    selectedReport = select.value;
    render().catch(error);
  };
  label.append(select);
  menu.append(label);
  main.append(menu);
  const pending = node('p','report-loading','Carregando os dados do relatório…');
  pending.setAttribute('role','status');
  menu.append(pending);
  return renderHub(selectedReport, (data, filters) => {
    pending.remove();
    finishReport(data, filters, menu);
  }).catch(err => {
    pending.textContent = err.message || 'Não foi possível carregar o relatório.';
  });
}

function reportMaintenance(parent, forecast, planning) {
  const section = node('section','report-maintenance');
  parent.append(section);
  section.append(node('h2','','Previsões de manutenção'));
  const content = node('div','forecast-report-content');
  let sheet;
  const validate = maintenanceForecastFilters(section,forecast,filtered=>{
    content.replaceChildren();
    sheet = reportMaintenanceDetails(content,filtered,planning);
  });
  section.append(content);
  return {validate, sheet:()=>sheet};
}

function reportMaintenanceDetails(section, forecast, planning) {
  const note = forecast.scope+' · valores estimados, separados dos gastos realizados e dos lançamentos.';
  section.append(node('p','muted',note));
  const chart = maintenanceForecast(section,forecast,{detail:false});
  chart.dataset.reportSheet = 'Gráfico de previsões';
  const columns = ['Equipamento','Manutenção','Data prevista','Valor previsto (R$)'];
  const rows = forecast.rows.map(r=>[r.equipment||'Não identificado',r.name,r.date,r.amount_cents/100]);
  const detail = node('section','panel report-chart-data');
  detail.append(node('h3','','Detalhamento por equipamento e data'));
  table(detail,columns.map((name,i)=>[name,i,i===2?humanDate:i===3?v=>money(Math.round(v*100)):undefined]),rows);
  section.append(detail);
  if(planning){
    const cash=node('div','dashboard-grid');section.append(cash);cashProjection(cash,forecast);
  }
  return {name:'Previsões de manutenção',header:3,merges:[0,1,2],filter:true,dates:[2],
    currency:(_,c)=>c===3,widths:[29,55,18,21],
    rows:[['CloudPelizzon | Previsões de manutenção'],[note],[rows.length+' manutenção(ões) prevista(s)'],columns,...rows]};
}

function finishReport(data, filters, menu) {
  const title = hubNames[selectedReport];
  const period = humanDate(data.meta.from)+' a '+humanDate(data.meta.to);
  const scope = [
    filters.property_id && 'Imóvel: '+labelFor(filters.property_id),
    filters.account_id && 'Conta: '+labelFor(filters.account_id)
  ].filter(Boolean).join(' · ') || 'Sem filtro adicional de imóvel ou conta';
  main.querySelector('.period-caption').append(document.createTextNode(' · '+scope));
  const forecast = data.maintenance_forecast;
  const maintenance = forecast?.months?.length && ['care_hub','planning_hub','money_hub'].includes(selectedReport)
    ? reportMaintenance(main,forecast,selectedReport==='planning_hub') : null;
  const getCharts = (includeForecast=true) => [...main.querySelectorAll('.chart-panel, .report-chart')].flatMap(panel => {
    if(!includeForecast&&panel.closest('.report-maintenance'))return [];
    const chart = reportChartData.get(panel);
    return chart ? [{...chart,sheetName:panel.dataset.reportSheet}] : [];
  });
  const indicators = [...main.querySelectorAll('.stat')].map(card =>
    ['.label','strong','em'].map(selector => card.querySelector(selector).textContent));
  const columns = ['Competência','Vencimento','Descrição','Tipo','Situação','Conta','Destino',
    'Categoria','Imóvel','Ambiente','Projeto','Parcela','Valor (R$)'];
  const statuses = {posted:'Confirmado',draft:'Rascunho',void:'Cancelado'};
  const ledger = state.transactions.filter(tx =>
    tx.date >= data.meta.from && tx.date <= data.meta.to &&
    (!filters.property_id || tx.property_id === filters.property_id) &&
    (!filters.account_id || [tx.account_id,tx.to_account_id].includes(filters.account_id)) &&
    (selectedReport !== 'cards_hub' || state.accounts.some(a => a.id === tx.account_id && a.kind === 'card')));
  const detail = panel('Lançamentos do recorte');
  const explanation = 'Linhas por data de competência. Os gráficos seguem os critérios de cada visão; o filtro de situação vale apenas para a tabela.';
  detail.append(node('p','muted',explanation));
  const label = node('label','report-status','Situação dos lançamentos');
  const status = node('select');
  status.append(new Option('Todas as situações',''));
  for (const [key, name] of Object.entries(statuses)) status.append(new Option(name,key));
  status.value = reportStatus;
  label.append(status);
  const count = node('p','report-count');
  const entries = node('div','report-entries');
  const chartTables = node('section','report-chart-tables');
  chartTables.append(node('h2','','Detalhamento dos gráficos'));
  const historicalCharts=getCharts(false);
  for (const chart of historicalCharts) {
    const group = node('section','report-chart-data');
    group.append(node('h3','',chart.title),node('p','muted',chart.note));
    table(group,chart.columns.map((name,i)=>[name,i]),chart.rows);
    chartTables.append(group);
  }
  if (historicalCharts.length) main.insertBefore(chartTables, detail);
  detail.append(label,count,entries);

  let rows = [];
  const name = id => id ? labelFor(id) : '';
  function update() {
    reportStatus = status.value;
    rows = ledger.filter(tx => !reportStatus || tx.status === reportStatus).map(tx => [
      tx.date,tx.due_date,tx.description,enums.transactionKind[tx.kind] || tx.kind,
      statuses[tx.status] || tx.status,name(tx.account_id),name(tx.to_account_id),
      name(tx.category_id),name(tx.property_id),tx.room || '',name(tx.project_id),
      tx.installment_count > 1 ? tx.installment_number+'/'+tx.installment_count : '',
      tx.amount_cents / 100
    ]);
    count.textContent = rows.length+' lançamento(s) · '+status.selectedOptions[0].text;
    entries.replaceChildren();
    table(entries,columns.map((title,i)=>[title,i,i<2 ? humanDate : i===12 ? value=>money(Math.round(value*100)) : undefined]),rows);
  }
  status.onchange = update;
  update();

  function allowExport() {
    if (!privateValues) return !maintenance||maintenance.validate();
    toast('Mostre os valores para exportar ou imprimir o relatório.',true);
    return false;
  }
  const exportButton = button('Exportar Excel', () => {
    if (!allowExport()) return;
    const forecastSheet=maintenance?.sheet();
    const sheets = [
      {name:'Resumo',header:6,section:12,merges:[0,1,12,...data.notes.map((_,i)=>13+i)],
        widths:[34,56,50],currency:(r,c)=>c===1&&String(indicators[r-7]?.[1]).includes('R$'),
        rows:[['CloudPelizzon | Finanças'],[title],['Período',period],['Escopo',scope],
        ['Situação dos lançamentos',status.selectedOptions[0].text],[],['Indicador','Valor','Critério'],
        ...indicators.map(([key,value,note])=>[key,reportNumber(value),note]),[],['Critérios'],...data.notes.map(note=>[note])]},
      {name:'Lançamentos',header:3,merges:[0,1,2],filter:true,dates:[0,1],currency:(_,c)=>c===12,
        widths:[17,17,52,19,19,24,24,23,23,20,24,14,19],
        rows:[['CloudPelizzon | Lançamentos'],[title+' · '+period],[count.textContent+' · '+scope],columns,...rows]},
      ...(forecastSheet?[forecastSheet]:[]),
      ...getCharts().map((chart,i)=>{
        const currency = chart.columns.map((_,c)=>c>0&&chart.rows.some(row=>String(row[c]).includes('R$')));
        return {
          name:chart.sheetName||'Gráfico '+(i+1),header:2,merges:[0,1],chart:chart.kind || 'bar',
          widths:chart.columns.map((column,index)=>index===0 ? 40 : Math.min(40,Math.max(20,column.length+5))),
          currency:(_,c)=>currency[c],
          rows:[[chart.title],[chart.rows.length ? chart.note : 'Sem dados no período selecionado.'],
            chart.columns,...chart.rows.map(row=>row.map((value,index)=>index ? reportNumber(value) : value))]
        };
      })
    ];
    const url = URL.createObjectURL(financeWorkbook(sheets));
    const download = node('a');
    download.href = url;
    download.download = 'financas-'+selectedReport.replace('_hub','')+'-'+data.meta.to+'.xlsx';
    download.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }, 'primary');
  menu.append(exportButton,button('Imprimir / salvar PDF',()=>{if(allowExport())window.print();}));
}

function reportNumber(value) {
  const compact = String(value).replace(/\s/g,'').replace('R$','');
  return /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(compact)
    ? Number(compact.replaceAll('.','').replace(',','.')) : value;
}

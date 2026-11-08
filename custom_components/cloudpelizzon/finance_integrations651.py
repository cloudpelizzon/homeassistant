"""Local integrations for the signed Finanças transport."""
import asyncio
import csv
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import io
import json
import re
import unicodedata
from uuid import NAMESPACE_URL, uuid4, uuid5
from zoneinfo import ZoneInfo

import aiohttp
from homeassistant.core import Context
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import Store


SANDBOX = ('PETR4', 'VALE3', 'ITUB4', 'MGLU3')
MARKET_ASSETS = {
    'PETR3': ('Petrobras','B3','BRL','Petróleo e gás'),
    'PETR4': ('Petrobras','B3','BRL','Petróleo e gás'),
    'BBAS3': ('Banco do Brasil','B3','BRL','Financeiro'),
    'ITUB4': ('Itaú Unibanco','B3','BRL','Financeiro'),
    'VALE3': ('Vale','B3','BRL','Mineração'),
    'MGLU3': ('Magazine Luiza','B3','BRL','Varejo'),
    'NU': ('Nu Holdings','NYSE','USD','Financeiro'),
    'AAPL': ('Apple','Nasdaq','USD','Tecnologia'),
    'MSFT': ('Microsoft','Nasdaq','USD','Tecnologia'),
    'ABEV3': ('Ambev','B3','BRL','Bebidas'),
    'B3SA3': ('B3','B3','BRL','Financeiro'),
    'BBSE3': ('BB Seguridade','B3','BRL','Seguros'),
    'BBDC4': ('Bradesco','B3','BRL','Financeiro'),
    'BPAC11': ('BTG Pactual','B3','BRL','Financeiro'),
    'SANB11': ('Santander Brasil','B3','BRL','Financeiro'),
    'WEGE3': ('WEG','B3','BRL','Indústria'),
    'CPFE3': ('CPFL Energia','B3','BRL','Energia elétrica'),
    'EGIE3': ('Engie Brasil Energia','B3','BRL','Energia elétrica'),
    'ENEV3': ('Eneva','B3','BRL','Energia elétrica'),
    'SBSP3': ('Sabesp','B3','BRL','Saneamento'),
    'RDOR3': ('Rede D’Or','B3','BRL','Saúde'),
    'SUZB3': ('Suzano','B3','BRL','Papel e celulose'),
    'KLBN11': ('Klabin','B3','BRL','Papel e celulose'),
    'VIVT3': ('Telefônica Brasil','B3','BRL','Telecomunicações'),
    'TIMS3': ('TIM Brasil','B3','BRL','Telecomunicações'),
    'LREN3': ('Lojas Renner','B3','BRL','Varejo'),
    'CYRE3': ('Cyrela','B3','BRL','Construção'),
    'TEND3': ('Tenda','B3','BRL','Construção'),
    'BOVA11': ('iShares Ibovespa','B3','BRL','ETF · Ibovespa'),
    'IVVB11': ('iShares S&P 500','B3','BRL','ETF · S&P 500'),
    'SMAL11': ('iShares Small Cap','B3','BRL','ETF · Small caps'),
    'NASD11': ('Trend Nasdaq 100','B3','BRL','ETF · Nasdaq 100'),
    'GOLD11': ('Trend ETF LBMA Ouro','B3','BRL','ETF · Ouro'),
    'LFTB11': ('Investo Tesouro Selic','B3','BRL','ETF · Renda fixa'),
    'HGLG11': ('Pátria Log','B3','BRL','FII · Logística'),
    'KNCR11': ('Kinea Rendimentos Imobiliários','B3','BRL','FII · Recebíveis'),
    'MXRF11': ('Maxi Renda','B3','BRL','FII · Recebíveis'),
    'XPML11': ('XP Malls','B3','BRL','FII · Shoppings'),
    'ROXO34': ('Nu Holdings','B3','BRL','BDR · Financeiro'),
    'XPBR31': ('XP Inc.','B3','BRL','BDR · Financeiro'),
    'MELI34': ('Mercado Livre','B3','BRL','BDR · Comércio eletrônico'),
    'NVDC34': ('Nvidia','B3','BRL','BDR · Tecnologia'),
    'TSLA34': ('Tesla','B3','BRL','BDR · Automotivo'),
    'NVDA': ('Nvidia','Nasdaq','USD','Tecnologia'),
    'AMZN': ('Amazon','Nasdaq','USD','Comércio eletrônico'),
    'GOOGL': ('Alphabet','Nasdaq','USD','Tecnologia'),
    'META': ('Meta Platforms','Nasdaq','USD','Tecnologia'),
    'TSLA': ('Tesla','Nasdaq','USD','Automotivo'),
    'AVGO': ('Broadcom','Nasdaq','USD','Tecnologia'),
    'AMD': ('AMD','Nasdaq','USD','Tecnologia'),
    'ADBE': ('Adobe','Nasdaq','USD','Tecnologia'),
    'COST': ('Costco','Nasdaq','USD','Varejo'),
    'NFLX': ('Netflix','Nasdaq','USD','Entretenimento'),
    'PEP': ('PepsiCo','Nasdaq','USD','Alimentos e bebidas'),
}
US_TICKERS = tuple(ticker for ticker, asset in MARKET_ASSETS.items() if asset[1] in ('NYSE', 'Nasdaq'))
B3_HISTORY_TICKERS = tuple(ticker for ticker, asset in MARKET_ASSETS.items() if asset[1]=='B3' and ticker not in SANDBOX)
UNITS = {'electricity': {'Wh', 'kWh', 'MWh'}, 'solar': {'Wh', 'kWh', 'MWh'},
         'ev': {'Wh', 'kWh', 'MWh'}, 'water': {'L', 'm³'}, 'gas': {'m³'}}
DEFAULT = {'inventory': True, 'maintenance': True, 'quotes': True, 'sensors': [],
           'mobile': '', 'alexa': '', 'hour': 9, 'days': 3}
BASE_UNITS = {'wh': Decimal('0.001'), 'kwh': Decimal(1), 'mwh': Decimal(1000),
              'l': Decimal('0.001'), 'm3': Decimal(1)}
KNOWN_TARIFF = {'electricity':'input_number.valor_kwh_energia','water':'input_number.valor_m3_agua'}
MODULE_SOURCES = frozenset({'inventory','maintenance'})
HOURLY_SOURCES = frozenset({'sensors','quotes','reminders'})


def normalized_unit(value):
    return str(value or '').lower().replace('³','3').replace(' ','')


def number(value):
    try:
        parsed = Decimal(str(value).replace(',', '.'))
    except InvalidOperation:
        return None
    return parsed if parsed.is_finite() and 0 <= parsed <= 1_000_000_000 else None


def cents(value):
    parsed = number(value)
    return int((parsed * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP)) if parsed is not None else None


def iso_day(value):
    try:
        return date.fromisoformat(value).isoformat()
    except (TypeError, ValueError):
        return None


def parse_market_csv(content, today):
    if not isinstance(content,str) or not content.strip() or len(content)>150_000:
        raise ValueError('Selecione um CSV de até 150 mil caracteres')
    content = content.lstrip('\ufeff')
    reader = csv.DictReader(io.StringIO(content),delimiter=';' if ';' in content.partition('\n')[0] else ',',strict=True)
    points = {}
    try:
        fields = [''.join(ch for ch in unicodedata.normalize('NFKD',name.strip().lower())
                          if not unicodedata.combining(ch)) for name in (reader.fieldnames or [])]
        if fields != ['codigo','data','moeda','fechamento']:
            raise ValueError('Use o cabeçalho codigo;data;moeda;fechamento')
        reader.fieldnames = fields
        for row in reader:
            ticker = (row.get('codigo') or '').strip().upper()
            raw_day = (row.get('data') or '').strip()
            try:
                day = datetime.strptime(raw_day,'%d/%m/%Y').date().isoformat() if '/' in raw_day else iso_day(raw_day)
            except ValueError:
                day = None
            price = cents(row.get('fechamento'))
            asset = MARKET_ASSETS.get(ticker)
            if (None in row or not asset or (row.get('moeda') or '').strip().upper()!=asset[2]
                or not day or day>today.isoformat() or not price):
                raise ValueError(f'Confira o ativo do catálogo, a data, a moeda e o fechamento na linha {reader.line_num}')
            key = (ticker,day)
            if key in points and points[key]!=price:
                raise ValueError(f'Fechamentos diferentes para o mesmo ativo e dia na linha {reader.line_num}')
            points[key] = price
    except csv.Error:
        raise ValueError(f'CSV inválido perto da linha {reader.line_num}') from None
    if not points or len(points)>2250:
        raise ValueError('Importe de 1 a 2.250 fechamentos')
    return points


def linked_ha_room(row, devices, entity_areas, areas, observed_areas):
    fields = {**row, **(row.get('attributes') or {})}
    mode = fields.get('location_mode')
    manual = fields.get('location')
    if mode in ('manual', None, '') and isinstance(manual, str) and manual.strip():
        if mode == 'manual' or not fields.get('ha_area_name'):
            return manual.strip()
    if mode == 'ha_area':
        selected = areas.get(fields.get('location_area_id'))
        if selected:
            return selected
        # The Inventory can resolve a selected area from a linked HA not in this registry.
        if isinstance(manual, str) and manual.strip():
            return manual.strip()
    ids = {item['value'] for item in row.get('identifiers', [])
           if item.get('kind') == 'ha_device' and item.get('value')}
    if len(ids) != 1:
        return None
    device_id = next(iter(ids))
    device = devices.get(device_id)
    if device is None or device.disabled_by is not None:
        return None
    if device.area_id:
        return areas.get(device.area_id)
    inferred = entity_areas.get(device_id, set())
    if inferred:
        return areas.get(next(iter(inferred))) if len(inferred) == 1 else None
    return observed_areas.get(device_id)


def inventory_rows(rows, room_for=lambda _: None):
    for row in rows:
        if row.get('archived') or not row.get('managed',True) or not row.get('id') or not row.get('name'):
            continue
        fields = {**row, **row.get('attributes', {})}
        purchase, current = cents(fields.get('purchase_value')), cents(fields.get('current_value'))
        rate = number(fields.get('depreciation_percent'))
        item = {'name': row['name']}
        room = room_for(row)
        if room:
            item['room'] = room
        if purchase is not None or current is not None:
            item['value_mode'] = ('manual' if current is not None and
                                  (purchase is None or fields.get('current_value_mode')=='manual') else 'automatic')
        for key, value in [('purchase_cents',purchase),('current_cents',current),('purchase_date',iso_day(fields.get('purchase_date'))),
                           ('annual_depreciation',str(rate) if rate is not None and rate <= 100 else None),
                           ('warranty_end',iso_day(fields.get('warranty_until')))]:
            if value is not None:
                item[key] = value
        yield str(row['id']), item


def maintenance_rows(snapshot):
    for row in snapshot.get('maintenances', []):
        if row.get('id') and row.get('name'):
            yield 'plan:'+str(row['id']), {'name':row['name'],'completed':False}

    executions = [(row, iso_day(row.get('date'))) for row in snapshot.get('executions', [])
                  if row.get('id')]
    execution_counts = Counter((str(row['maintenance_id']), day) for row, day in executions
                               if row.get('maintenance_id') and day)
    payments = defaultdict(list)
    for row in snapshot.get('finance_records', []):
        item_id = row.get('maintenance_id')
        if not item_id:
            item = str(row.get('itemEntity') or '')
            date_entity = str(row.get('dateEntity') or '')
            if item.startswith('local_maintenance.'):
                item_id = item.removeprefix('local_maintenance.')
            elif date_entity.startswith('local_datetime.'):
                item_id = date_entity.removeprefix('local_datetime.')
        day = iso_day(row.get('date'))
        if item_id and day:
            payments[str(item_id), day].append(cents(row.get('paid')))

    for row, day in executions:
        if not day:
            continue
        cost = cents(row.get('total_cost'))
        parts = [number(row.get(field)) for field in ('material_cost', 'labor_cost')]
        if not cost and any(part is not None for part in parts):
            component_cost = cents(sum(part for part in parts if part is not None))
            if component_cost is not None:
                cost = component_cost
        key = (str(row.get('maintenance_id') or ''), day)
        # The legacy payment has no execution ID. A shared date alone cannot
        # distinguish multiple executions or multiple payments for one item.
        if not cost and execution_counts[key] == 1 and len(payments.get(key, ())) == 1:
            paid = payments[key][0]
            if paid is not None:
                cost = paid
        data = {'name':row.get('maintenance_name') or 'Manutenção concluída','date':day,'completed':True}
        if cost is not None:
            data['amount_cents'] = cost
        yield str(row['id']), data


class FinanceIntegrations:
    def __init__(self, runtime):
        self.runtime = runtime
        self.hass = runtime.hass
        self.store = Store(self.hass, 1, 'cloudpelizzon_finance651_integrations', private=True)
        self.saved = {}
        self.stop = None
        self.stop_modules = None
        self.stop_initial = None

    async def start(self):
        self.saved = await self.store.async_load() or {}
        self.stop = async_track_time_interval(self.hass, self.scheduled_hourly, timedelta(hours=1))
        self.stop_modules = async_track_time_interval(self.hass, self.scheduled_modules, timedelta(minutes=10))
        if self.saved.get('actor'):
            self.stop_initial = async_call_later(self.hass, 30, self.initial_sync)

    async def initial_sync(self, now):
        self.stop_initial = None
        await self.scheduled(now)

    async def scheduled_hourly(self, now):
        await self.scheduled(now,sources=HOURLY_SOURCES)

    async def scheduled_modules(self, now):
        await self.scheduled(now,sources=MODULE_SOURCES)

    def close(self):
        if self.stop:
            self.stop()
        if self.stop_modules:
            self.stop_modules()
        if self.stop_initial:
            self.stop_initial()

    def choices(self):
        services = self.hass.services.async_services().get('notify', {})
        mobile = sorted(name for name in services if name.startswith('mobile_app_'))
        alexa = [{'id':'notify.'+name,'label':name.removeprefix('alexa_media_').replace('_',' ')}
                 for name in services if name.startswith('alexa_media_')]
        sensors = []
        for row in self.hass.states.async_all():
            entity_id, attrs = row.entity_id, row.attributes
            label = attrs.get('friendly_name', entity_id)
            if entity_id.startswith('notify.') and (entity_id.endswith(('_speak','_announce')) or 'alexa' in entity_id):
                alexa.append({'id':entity_id,'label':label})
            if entity_id.startswith('sensor.') and attrs.get('unit_of_measurement') in set().union(*UNITS.values()):
                monthly = bool(re.search(r'mensal|monthly|(?:^|[_\s])(?:m[eê]s|month)(?:[_\s]|$)', entity_id+' '+str(label), re.I))
                sensors.append({'id':entity_id,'label':label,'unit':attrs['unit_of_measurement'],'monthly':monthly})
        return {'mobile':mobile,'alexa':alexa,'sensors':sorted(sensors,key=lambda row:(not row['monthly'],row['label']))}

    def config(self):
        return {**DEFAULT, **self.saved.get('config', {})}

    def view(self):
        return {'config':self.config(),'choices':self.choices(),'last':self.saved.get('last',{}),
                'scheduled':bool(self.saved.get('actor'))}

    def suggested(self):
        choices = self.choices()
        available = {row['id']:row for row in choices['sensors'] if row['monthly']}
        sensors = []
        for entity_id, kind in (('sensor.copel_importacao_mes','electricity'),
                                ('sensor.solar_total_mes','solar'),
                                ('sensor.custo_agua_consumo_mes_m3','water')):
            if entity_id in available and available[entity_id]['unit'] in UNITS[kind]:
                sensors.append({'id':entity_id,'kind':kind,'tariff':''})
        mobile = 'mobile_app_iphone' if 'mobile_app_iphone' in choices['mobile'] else ''
        echoes = [row['id'] for row in choices['alexa'] if re.search(r'echo_show_10.*sala',row['id'])]
        alexa = next((eid for eid in echoes if eid.endswith('_announce')), echoes[0] if len(echoes)==1 else '')
        return {**DEFAULT,'sensors':sensors,'mobile':mobile,'alexa':alexa}

    async def configure(self, actor, values):
        if set(values) != set(DEFAULT) or any(type(values[key]) is not bool for key in ('inventory','maintenance','quotes')):
            raise ValueError('Configuração de fontes inválida')
        if type(values['hour']) is not int or not 0 <= values['hour'] <= 23 or type(values['days']) is not int or not 0 <= values['days'] <= 30:
            raise ValueError('Informe hora entre 0 e 23 e antecedência entre 0 e 30 dias')
        choices = self.choices()
        if (values['mobile'] and values['mobile'] not in choices['mobile']) or (values['alexa'] and values['alexa'] not in {row['id'] for row in choices['alexa']}):
            raise ValueError('Selecione um destino disponível no Home Assistant')
        sensors = {row['id']:row['unit'] for row in choices['sensors'] if row['monthly']}
        links = values['sensors']
        if not isinstance(links,list) or len(links)>12:
            raise ValueError('Vincule até 12 sensores mensais')
        seen = set()
        for link in links:
            if (not isinstance(link,dict) or set(link)!={'id','kind','tariff'} or link['kind'] not in UNITS or
                sensors.get(link['id']) not in UNITS[link['kind']] or link['id'] in seen or
                (link['tariff']!='' and number(link['tariff']) is None)):
                raise ValueError('Selecione medidores mensais distintos com unidade compatível e confira a tarifa')
            seen.add(link['id'])
        self.saved.update(actor=actor,config=values,energy_cost_setup=True)
        await self.store.async_save(self.saved)
        return self.view()

    async def scheduled(self, _now, *, sources=None):
        actor = self.saved.get('actor')
        if not actor or self.runtime.closed:
            return
        user = await self.hass.auth.async_get_user(actor)
        if not user or not user.is_active or not user.is_admin or user.system_generated:
            return
        def active():
            return not self.runtime.closed and user.is_active and user.is_admin
        async with self.runtime.lock:
            if not active() or self.saved.get('actor') != actor:
                return
            async def command(name,args):
                return await self.hass.async_add_executor_job(
                    lambda:self.runtime.service.execute(actor,name,args,active_guard=active))
            try:
                state = await command('state', {})
                if state['user']['role']=='admin':
                    await self.run(actor,state,command,active,scheduled=True,sources=sources)
            except (PermissionError,ValueError):
                return

    async def sync_records(self, command, existing, source, rows):
        index = {row['external_id']:row for row in existing if row.get('source')==source and row.get('external_id')}
        count = 0
        for external_id, values in rows:
            previous = index.get(external_id, {})
            if source=='inventory' and (previous.get('room') or '').strip():
                values = {k:v for k,v in values.items() if k!='room'}
            if all(previous.get(key)==value for key,value in values.items()):
                continue
            data = {key:value for key,value in previous.items() if key not in {'id','revision','source','external_id'}}
            data.update(values)
            # Maintenance sync tracks the completed cost. It cannot create or rewrite an expense.
            if source=='maintenance':
                data.pop('account_id',None)
            await command('integration',{'source':source,'external_id':external_id,'data':data})
            count += 1
        return count

    async def inventory(self, command, state):
        source = self.hass.data.get('cloudpelizzon_inventory506')
        if source is None or not (await source.work(source.engine.entitlement)).paid:
            raise PermissionError('Inventário completo indisponível')
        records = []
        for page in range(40):
            batch = await source.command('snapshot',{'page':page})
            records.extend(batch['devices'])
            if len(records)>=batch['filtered_count'] or not batch['devices']:
                break
        from homeassistant.helpers import area_registry, device_registry, entity_registry
        areas = {a.id:a.name for a in area_registry.async_get(self.hass).async_list_areas() if a.name}
        devices = device_registry.async_get(self.hass).devices
        entity_areas = defaultdict(set)
        for entity in entity_registry.async_get(self.hass).entities.values():
            if entity.device_id and entity.area_id and entity.disabled_by is None:
                entity_areas[entity.device_id].add(entity.area_id)
        observed = defaultdict(set)
        for mirror in self.hass.data.get('cloudpelizzon_homolog_mirror', {}).values():
            for device_id, area in getattr(mirror,'inventory_locations',{}).items():
                if area.get('id') and area.get('name'):
                    observed[device_id].add((area['id'],area['name']))
        observed_areas = {key:next(iter(values))[1] for key,values in observed.items() if len(values)==1}
        rows = list(inventory_rows(records, lambda row: linked_ha_room(row,devices,entity_areas,areas,observed_areas)))
        count = await self.sync_records(command,state['records']['assets'],'inventory',rows)
        valued = sum('purchase_cents' in data or 'current_cents' in data for _,data in rows)
        return count, f'{len(rows)} equipamentos na origem · {valued} com valor informado'

    async def maintenance(self, command, state):
        local = self.hass.data.get('cloudpelizzon_compiled628_active')
        if local is None or not local.ready('CP-MAINTENANCE'):
            raise PermissionError('Manutenção local indisponível')
        runtime = local.runtimes['CP-MAINTENANCE']
        catalog = await self.hass.async_add_executor_job(runtime.execute,'maintenance.records.read',{},uuid4().hex)
        history = await self.hass.async_add_executor_job(runtime.execute,'maintenance.compat.snapshot.read',{},uuid4().hex)
        if not isinstance(catalog.get('maintenances'),list) or not isinstance(history.get('executions'),list):
            raise ValueError('Formato incompatível na integração com Manutenção')
        payments = history.get('financeRecords', catalog.get('finance_records'))
        rows = list(maintenance_rows({'maintenances':catalog['maintenances'],'executions':history['executions'],
                                      'finance_records':payments if isinstance(payments,list) else []}))
        count = await self.sync_records(command,state['records']['maintenance'],'maintenance',rows)
        execution_data = dict(rows)
        latest = {}
        for execution in history['executions']:
            item_id = execution.get('maintenance_id')
            row = execution_data.get(str(execution.get('id')))
            if not item_id or not row:
                continue
            key = 'plan:' + str(item_id)
            day = row['date']
            current = latest.get(key)
            if current is None or day > current['date']:
                latest[key] = {'date': day, 'amount_cents': row.get('amount_cents')}
            elif day == current['date']:
                latest[key] = {'date': day, 'amount_cents': None}
        self.saved['maintenance_latest'] = latest
        estimates = history.get('financeEstimates', catalog.get('finance_estimates'))
        estimates = estimates if isinstance(estimates, dict) else {}
        forecast, schedule = {}, {}
        for plan in catalog['maintenances']:
            if not plan.get('id'):
                continue
            item_id = str(plan['id'])
            stored = estimates.get('local_maintenance.' + item_id) or estimates.get('local_datetime.' + item_id)
            explicit = isinstance(stored, dict) and any(stored.get(key) is not None for key in ('material', 'labor'))
            stored = stored if explicit else {}
            material = number(stored.get('material', plan.get('estimated_material')))
            labor = number(stored.get('labor', plan.get('estimated_labor')))
            if explicit or material or labor:
                amount = cents((material or 0) + (labor or 0))
                if amount is not None:
                    key = 'plan:' + item_id
                    forecast[key] = amount
                    if plan.get('enabled', True):
                        due = iso_day(plan.get('next_execution'))
                        last = iso_day(plan.get('last_execution'))
                        observed = latest.get(key, {}).get('date')
                        last = max(filter(None, (last, observed)), default=None)
                        cycle = plan.get('cycle_days')
                        if last and isinstance(cycle, int) and not isinstance(cycle, bool) and 0 < cycle <= 36500:
                            due = due or (date.fromisoformat(last) + timedelta(days=cycle)).isoformat()
                        schedule[key] = {'date': due, 'amount_cents': amount}
        self.saved['maintenance_forecast'] = forecast
        self.saved['maintenance_schedule'] = schedule

        plans = sum(not data['completed'] for _,data in rows)
        return count, f'{plans} cadastros · {len(rows)-plans} execuções na origem'

    def maintenance_projection(self, result, state, operation, args):
        today = date.fromisoformat(state['today'])
        schedule = self.saved.get('maintenance_schedule', {})
        records = state['records']
        property_id = args.get('property_id')
        assets = {r['id']: r for r in records.get('assets', [])}
        scoped_assets = {key for key,r in assets.items() if r.get('property_id') == property_id}
        by_name = defaultdict(list)
        for asset in assets.values():
            if asset.get('name'):
                by_name[asset['name'].strip().casefold()].append(asset)
        # A draft explicitly tied to this plan already belongs to the base projection.
        cash_accounts = {r['id'] for r in state.get('accounts', []) if r.get('kind') != 'card'}
        included = {(t.get('external_key'), t.get('due_date') if t['status'] == 'draft' else t.get('date'))
                    for t in state.get('transactions', [])
                    if t.get('kind') == 'expense' and t.get('status') in {'draft', 'posted'}
                    and t.get('account_id') in cash_accounts
                    and (not property_id or t.get('property_id') == property_id)}
        rows = []
        for record in records.get('maintenance', []):
            key = record.get('external_id')
            if record.get('source') != 'maintenance' or record.get('completed') or key not in schedule:
                continue
            if property_id and record.get('property_id') != property_id and record.get('asset_id') not in scoped_assets:
                continue
            if ('maintenance:' + key, schedule[key]['date']) in included:
                continue
            name = record['name']
            linked = assets.get(record.get('asset_id'))
            # Inventário labels rules as "maintenance · equipment". Only use the
            # name from a unique, exact match in the visible equipment register.
            hint = name.rsplit(' · ', 1)[-1].strip().casefold()
            candidates = by_name.get(hint, []) if not record.get('asset_id') else []
            equipment = linked or (candidates[0] if len(candidates) == 1 else {})
            rows.append({'name': name, 'equipment': equipment.get('name'),
                         'equipment_id': equipment.get('id'), **schedule[key]})
        rows.sort(key=lambda row: (row['date'] or '9999-12-31', row['name']))
        future = [r for r in rows if r['date'] and r['date'] >= today.isoformat()]
        if operation == 'overview':
            for row in result['projections']:
                limit = (today + timedelta(days=row['days'])).isoformat()
                amount = sum(r['amount_cents'] for r in future if r['date'] <= limit)
                row['maintenance_forecast_cents'] = amount
                row['cash_with_maintenance_cents'] = row['cash_cents'] - amount
        elif not args.get('account_id'):
            months = [f'{today.year + (today.month-1+i)//12:04d}-{(today.month-1+i)%12+1:02d}' for i in range(6)]
            current = [r for r in future if r['date'][:7] in months]
            end_index = today.month - 1 + len(months)
            end = date(today.year + end_index//12, end_index%12+1, 1) - timedelta(days=1)
            result['maintenance_forecast'] = {
                'from': today.isoformat(), 'to': end.isoformat(), 'upcoming': future,
                'months': months,
                'values': [sum(r['amount_cents'] for r in current if r['date'][:7] == month) for month in months],
                'rows': current,
                'without_date': sum(not r['date'] for r in rows),
                'past_due': sum(bool(r['date']) and r['date'] < today.isoformat() for r in rows),
            }
        return result

    @staticmethod
    async def put(command, existing, collection, key, values):
        record_id = uuid5(NAMESPACE_URL,'cloudpelizzon-finance:'+key).hex
        previous = next((row for row in existing if row['id']==record_id),None)
        if previous and all(previous.get(key)==value for key,value in values.items()):
            return 0
        data = {k:v for k,v in (previous or {}).items() if k not in {'id','revision'}}
        data.update(values)
        await command('save_record',{'collection':collection,'id':record_id,'data':data,
                                      **({'revision':previous['revision']} if previous else {})})
        return 1

    async def sensors(self, config, command, state, now):
        count = valid = 0
        resolved = []
        costs = self.saved.setdefault('utility_costs', {})
        period = now.strftime('%Y-%m')
        direct_water = next((link['id'] for link in config['sensors'] if link['id']=='sensor.custo_agua_consumo_mes_m3'), None)
        for link in config['sensors']:
            row = self.hass.states.get(link['id'])
            unit = row.attributes.get('unit_of_measurement') if row else None
            if unit not in UNITS[link['kind']]:
                continue
            quantity = number(row.state)
            if quantity is None:
                continue
            valid += 1
            key = link['id']+':'+period
            record_id = uuid5(NAMESPACE_URL,'cloudpelizzon-finance:'+key).hex
            values = {'name':row.name,'kind':link['kind'],'period':period,'unit':unit,'quantity':str(quantity),
                      'assumption':'Medidor mensal do HA · '+link['id']}
            cost = None
            if link['tariff']!='':
                values['tariff_cents']=cents(link['tariff'])
            else:
                values['tariff_cents']=0
                cost = self.sensor_cost(link,unit,quantity,direct_water)
                values['assumption']+=(' · custo informado pelo HA: '+cost['source'] if cost else ' · tarifa não informada')
            count += await self.put(command,state['records']['utilities'],'utilities',key,values)
            if cost:
                costs[record_id] = cost
                resolved.append(cost['source'])
            else:
                costs.pop(record_id,None)
        detail = f'{valid}/{len(config["sensors"])} medidores com leitura válida'
        if resolved:
            detail += ' · custo automático: '+', '.join(dict.fromkeys(resolved))
        return count, detail

    def sensor_cost(self, link, unit, quantity, direct_water):
        kind = link['kind']
        if kind not in {'electricity','water'}:
            return None
        if link['id']==direct_water:
            total = self.hass.states.get('sensor.custo_agua_mes')
            if total and normalized_unit(total.attributes.get('unit_of_measurement')) in {'r$','brl'}:
                value = cents(total.state)
                if value is not None:
                    return {'estimated_cents':value,'source':total.entity_id}
        allowed = {normalized_unit(item) for item in UNITS[kind]}
        candidates = []
        for source in self.hass.states.async_all():
            if not source.entity_id.startswith(('sensor.','input_number.')):
                continue
            match = re.fullmatch(r'(?:brl|r\$)/(.+)',normalized_unit(source.attributes.get('unit_of_measurement')))
            if not match or match[1] not in allowed:
                continue
            if re.search(r'solar|injec|injet|export|credito|economia|recarga|esgoto|gas', source.entity_id):
                continue
            if not re.search(r'tarif|preco|price|unitari|valor_(?:[km]?wh|m3|litro)', source.entity_id):
                continue
            rate = number(source.state)
            if rate is not None:
                candidates.append((source,match[1],rate))
        selected = next((item for item in candidates if item[0].entity_id==KNOWN_TARIFF[kind]), None)
        if selected is None and len(candidates)!=1:
            return None
        source, tariff_unit, rate = selected or candidates[0]
        total = quantity * BASE_UNITS[normalized_unit(unit)] / BASE_UNITS[tariff_unit] * rate
        return {'estimated_cents':cents(total),'source':source.entity_id} if cents(total) is not None else None

    def consumption_costs(self, result, records):
        costs = self.saved.get('utility_costs',{})
        months = result['meta']['months']
        property_id = result['meta'].get('property_id')
        for series in result['consumption']:
            for row in records:
                cost = costs.get(row['id'])
                if not cost or (row.get('kind'),row.get('unit'))!=(series['kind'],series['unit']):
                    continue
                if row.get('period') not in months or (property_id and row.get('property_id')!=property_id):
                    continue
                index = months.index(row['period'])
                previous = int((Decimal(str(row['quantity']))*row.get('tariff_cents',0)).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
                series['estimated'][index] = (series['estimated'][index] or 0) - previous + cost['estimated_cents']
        return result

    async def quotes(self, command, state, now):
        investments = [row for row in state['records']['investments'] if row.get('ticker','').strip().upper() in SANDBOX]
        session = async_get_clientsession(self.hass)
        count = 0
        market = {row['ticker']:row for row in self.saved.get('market_quotes',[])}
        failures = []
        for ticker in SANDBOX:
            try:
                quote = await self.fetch_quote(session,ticker,now)
            except (aiohttp.ClientError, TimeoutError, ValueError, TypeError, KeyError, IndexError):
                failures.append(ticker)
                continue
            market[ticker] = quote
            as_of,price = quote['as_of'],quote['price_cents']
            for item in investments:
                if item['ticker'].strip().upper()==ticker:
                    count += await self.put(command,state['records']['quotes'],'quotes','brapi:'+item['id']+':'+as_of,
                                           {'name':ticker,'investment_id':item['id'],'price_cents':price,
                                            'as_of':as_of,'source':'brapi · sandbox'})
        try:
            listed = await self.fetch_market_list(session,now)
        except (aiohttp.ClientError, TimeoutError, ValueError, TypeError, KeyError):
            listed = {}
        market.update(listed)
        us_limit = asyncio.Semaphore(3)

        async def us_quote(ticker):
            async with us_limit:
                try:
                    return await self.fetch_us_quote(session, ticker, now)
                except (aiohttp.ClientError, TimeoutError, ValueError):
                    return None

        us_quotes = [quote for quote in await asyncio.gather(*(us_quote(ticker) for ticker in US_TICKERS)) if quote]
        for quote in us_quotes:
            ticker = quote['ticker']
            previous = market.get(ticker, {})
            if quote['as_of'] >= previous.get('as_of', ''):
                history = dict(previous.get('history', []))
                history.update(quote['history'])
                market[ticker] = {**quote, 'history':sorted(history.items())[-100:]}
        self.saved['market_quotes'] = list(market.values())
        b3_history = await self.sync_b3_history(session, now)
        if len(failures)==len(SANDBOX) and not listed and not us_quotes:
            raise ValueError('Nenhuma cotação recebida da fonte')
        detail = f'{len(SANDBOX)-len(failures)}/{len(SANDBOX)} históricos consultados · {len(listed)} preços de referência adicionais'
        detail += f' · {len(us_quotes)}/{len(US_TICKERS)} fechamentos dos EUA recebidos'
        detail += f' · {len(b3_history)}/{len(B3_HISTORY_TICKERS)} séries adicionais da B3 disponíveis'
        if failures:
            detail += ' · indisponíveis nesta coleta: '+', '.join(failures)
        return count, detail

    async def sync_b3_history(self, session, now):
        today = now.astimezone(ZoneInfo('America/Sao_Paulo')).date()
        cached = self.saved.get('market_b3_history', {})
        if self.saved.get('market_b3_history_attempt') == today.isoformat():
            return cached
        limit = asyncio.Semaphore(3)

        async def fetch(ticker):
            async with limit:
                try:
                    return await self.fetch_b3_history(session, ticker, today)
                except (aiohttp.ClientError, TimeoutError, ValueError):
                    return []

        results = await asyncio.gather(*(fetch(ticker) for ticker in B3_HISTORY_TICKERS))
        for ticker, series in zip(B3_HISTORY_TICKERS, results):
            previous = cached.get(ticker)
            if len(series)>=2 and (not previous or series[-1][0]>=previous[-1][0]):
                cached[ticker] = series
        self.saved.update(market_b3_history=cached, market_b3_history_attempt=today.isoformat())
        return cached

    @staticmethod
    async def fetch_b3_history(session, ticker, today):
        first = today - timedelta(days=115)
        url = f'https://www.okanebox.com.br/api/acoes/hist/{ticker}/{first:%Y%m%d}/{today:%Y%m%d}/'
        async with session.get(url, allow_redirects=False, timeout=aiohttp.ClientTimeout(total=8)) as response:
            response.raise_for_status()
            payload = bytearray()
            async for chunk in response.content.iter_chunked(8192):
                payload.extend(chunk)
                if len(payload)>192_000:
                    raise ValueError('Resposta de histórico acima do limite')
        rows = json.loads(payload)
        if not isinstance(rows, list):
            return []
        history = {}
        for row in rows:
            if not isinstance(row, dict) or not isinstance(stamp := row.get('DATPRG'), str):
                continue
            try:
                day = date.fromisoformat(stamp[:10])
            except ValueError:
                continue
            if first<=day<=today and (price := cents(row.get('PREULT'))):
                history[day.isoformat()] = price
        return sorted(history.items())

    @staticmethod
    async def fetch_us_quote(session, ticker, now):
        url = f'https://getmarkethistory.com/api/v1/bars/stocks/us/{ticker}/1h'
        async with session.get(url, allow_redirects=False, timeout=aiohttp.ClientTimeout(total=6)) as response:
            response.raise_for_status()
            payload = bytearray()
            async for chunk in response.content.iter_chunked(8192):
                payload.extend(chunk)
                if len(payload) > 128_000:
                    raise ValueError('Resposta de mercado acima do limite')
        history = {}
        eastern = ZoneInfo('America/New_York')
        for line in payload.splitlines():
            row = json.loads(line)
            if not isinstance(row, dict) or row.get('symbol') != ticker or row.get('is_gap'):
                continue
            stamp = row.get('timestamp')
            if not isinstance(stamp, str):
                continue
            start = datetime.fromisoformat(stamp.replace('Z', '+00:00'))
            if start.tzinfo is None or start + timedelta(hours=1) > now:
                continue
            local = start.astimezone(eastern)
            # The 15:00–16:00 ET bar ends with the regular full session.
            if local.weekday() < 5 and (local.hour, local.minute, local.second) == (15, 0, 0):
                if price := cents(row.get('close')):
                    history[local.date().isoformat()] = price
        days = sorted(history.items())
        if len(days) < 2:
            return None
        as_of, price = days[-1]
        change = 100 * (price / days[-2][1] - 1)
        return {'ticker':ticker, 'as_of':as_of, 'price_cents':price, 'change_percent':change,
                'source':'Market History · fechamento EUA', 'history':days}

    @staticmethod
    async def fetch_market_list(session, now):
        matches = {}
        wanted = {ticker for ticker,asset in MARKET_ASSETS.items() if asset[1]=='B3' and ticker not in SANDBOX}
        for page in (1,2):
            async with session.get('https://brapi.dev/api/quote/list',params={'limit':1500,'page':page},
                                   allow_redirects=False,timeout=aiohttp.ClientTimeout(total=6)) as response:
                response.raise_for_status()
                result = await response.json()
            for row in result['stocks']:
                ticker = row.get('stock')
                if ticker not in wanted:
                    continue
                price = cents(row.get('close'))
                change = row.get('change')
                volume = number(row.get('volume'))
                if price:
                    matches[ticker] = {'ticker':ticker,'price_cents':price,
                                       'change_percent':change if type(change) in (float,int) and abs(change)<10_000 else None,
                                       'volume':int(volume) if volume is not None else None,
                                       'observed_at':now.isoformat(),'source':'brapi · lista B3'}
            if wanted<=matches.keys() or not result.get('hasNextPage'):
                break
        return matches

    @staticmethod
    async def fetch_quote(session, ticker, now):
        async with session.get('https://brapi.dev/api/quote/'+ticker,params={'range':'3mo','interval':'1d'},allow_redirects=False,
                               timeout=aiohttp.ClientTimeout(total=5)) as response:
            response.raise_for_status()
            result = (await response.json())['results'][0]
        if result.get('symbol')!=ticker or result.get('currency')!='BRL':
            raise ValueError('Cotação incompatível')
        stamp = datetime.fromisoformat(result['regularMarketTime'].replace('Z','+00:00'))
        if stamp.tzinfo is None or stamp>now+timedelta(minutes=5):
            raise ValueError('Data da cotação inválida')
        as_of = stamp.astimezone(now.tzinfo).date().isoformat()
        price = cents(result.get('regularMarketPrice'))
        if not price:
            raise ValueError('Cotação indisponível')
        history = {}
        for row in (result.get('historicalDataPrice') or [])[-100:]:
            try:
                day = datetime.fromtimestamp(row['date'],tz=ZoneInfo('America/Sao_Paulo')).date().isoformat()
                close = cents(row.get('close'))
            except (KeyError,TypeError,ValueError,OverflowError,OSError):
                continue
            if close and day<=as_of:
                history[day] = close
        change = result.get('regularMarketChangePercent')
        return {'ticker':ticker,'as_of':as_of,'price_cents':price,'source':'brapi · sandbox',
                'change_percent':change if type(change) in (int,float) and abs(change)<10_000 else None,
                'volume':int(volume) if (volume:=number(result.get('regularMarketVolume'))) is not None else None,
                'low_52':cents(result.get('fiftyTwoWeekLow')),'high_52':cents(result.get('fiftyTwoWeekHigh')),
                'history':sorted(history.items())}

    async def import_market_csv(self, content, *, preview=False):
        today = datetime.now(ZoneInfo(self.hass.config.time_zone)).date()
        points = parse_market_csv(content,today)
        if preview:
            grouped = {}
            for (ticker,day),price in points.items():
                grouped.setdefault(ticker,[]).append((day,price))
            return {'count':len(points),'assets':[
                {'ticker':ticker,'company':MARKET_ASSETS[ticker][0],'currency':MARKET_ASSETS[ticker][2],
                 'count':len(rows),'from':min(rows)[0],'to':max(rows)[0],'price_cents':max(rows)[1]}
                for ticker,rows in sorted(grouped.items())]}
        history = {ticker:dict(rows) for ticker,rows in self.saved.get('market_imports',{}).items()}
        for (ticker,day),price in points.items():
            history.setdefault(ticker,{})[day]=price
        previous = self.saved.get('market_imports',{})
        updated = {ticker:sorted(rows.items())[-250:] for ticker,rows in history.items()}
        await self.store.async_save({**self.saved,'market_imports':updated})
        self.saved['market_imports'] = updated
        count = sum(price!=dict(previous.get(ticker,[])).get(day) for ticker,rows in updated.items() for day,price in rows)
        return {'updated':count}

    async def notify(self, actor, channel, target, message, active):
        if not active():
            raise PermissionError('Sessão alterada')
        context = Context(user_id=actor)
        if channel=='mobile' and re.fullmatch(r'mobile_app_[a-z0-9_]+',target) and self.hass.services.has_service('notify',target):
            await self.hass.services.async_call('notify',target,{'title':'CloudPelizzon Finanças','message':message},blocking=True,context=context)
        elif channel=='alexa' and target.startswith('notify.alexa_media_') and self.hass.services.has_service('notify',target[7:]):
            await self.hass.services.async_call('notify',target[7:],{'message':message,'data':{'type':'announce'}},blocking=True,context=context)
        elif channel=='alexa' and re.fullmatch(r'notify\.[a-z0-9_]+',target) and self.hass.states.get(target):
            await self.hass.services.async_call('notify','send_message',{'entity_id':target,'message':message},blocking=True,context=context)
        else:
            raise ValueError('Destino de lembrete indisponível')

    async def test(self, actor, channel, active):
        if channel not in {'mobile','alexa'} or not self.config()[channel]:
            raise ValueError('Salve um destino antes de testar')
        await self.notify(actor,channel,self.config()[channel],'Este é um teste de lembrete do CloudPelizzon Finanças.',active)
        return {'accepted':True}

    async def reminders(self, actor, config, state, active, now):
        if now.hour<config['hour']:
            return 0
        today, limit = now.date(), now.date()+timedelta(days=config['days'])
        due = [row for row in state['transactions'] if row.get('kind')=='expense' and row.get('status')=='draft'
               and today.isoformat()<=row.get('due_date','')<=limit.isoformat()]
        if not due:
            return 0
        sent = self.saved.setdefault('reminder_day',{})
        count = 0
        for channel in ('mobile','alexa'):
            if not config[channel] or sent.get(channel)==today.isoformat():
                continue
            # Claim before the external effect. A timeout can still mean delivered.
            sent[channel]=today.isoformat()
            await self.store.async_save(self.saved)
            await self.notify(actor,channel,config[channel],'Você tem compromissos financeiros a conferir no CloudPelizzon Finanças.',active)
            count += 1
        return count

    async def run(self, actor, state, command, active, *, scheduled=False, sources=None):
        now = datetime.now(ZoneInfo(self.hass.config.time_zone))
        config = self.config()
        if (sources is None or 'sensors' in sources) and not self.saved.get('energy_cost_setup') and not any(link['kind']=='electricity' for link in config['sensors']):
            candidates = {row['id']:row for row in self.choices()['sensors'] if row['monthly'] and row['unit']=='kWh'}
            primary = 'sensor.copel_importacao_mes'
            ids = [primary] if primary in candidates else [eid for eid in ('sensor.qd1_energia_mes','sensor.qd2_energia_mes') if eid in candidates]
            if ids and len(config['sensors'])+len(ids)<=12:
                config['sensors'] = [*config['sensors'],*({'id':eid,'kind':'electricity','tariff':''} for eid in ids)]
                self.saved.update(config=config,energy_cost_setup=True)
        last = self.saved.setdefault('last', {})
        for key, enabled, work in (
            ('inventory',config['inventory'],lambda:self.inventory(command,state)),
            ('maintenance',config['maintenance'],lambda:self.maintenance(command,state)),
            ('sensors',config['sensors'],lambda:self.sensors(config,command,state,now)),
            ('quotes',config['quotes'],lambda:self.quotes(command,state,now)),
            ('reminders',config['mobile'] or config['alexa'],lambda:self.reminders(actor,config,state,active,now))):
            if not enabled or (sources is not None and key not in sources) or not active():
                continue
            revision = {'quotes':5,'maintenance':3,'inventory':2}.get(key,1)
            if scheduled and key=='quotes' and last.get(key,{}).get('at') and last[key].get('detail') and last[key].get('revision',1)==revision:
                if now-datetime.fromisoformat(last[key]['at'])<timedelta(hours=6):
                    continue
            try:
                result = await work()
            except Exception as error:
                last[key]={'at':now.isoformat(),'status':'falha','reason':type(error).__name__}
            else:
                count, detail = result if isinstance(result,tuple) else (result,'')
                last[key]={'at':now.isoformat(),'status':'ok','count':count,'detail':detail,'revision':revision}
        await self.store.async_save(self.saved)
        return self.view()

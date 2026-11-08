"""Public HA transport; financial rules live only in the signed native library."""
import asyncio
import base64
import csv
from datetime import date, datetime
import io
import json
import logging
import time
import unicodedata
from pathlib import Path
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.helpers import area_registry
from .finance_loader651 import Namespace, package_folder
from .compiled_release628 import PUBLIC_KEY

KEY='cloudpelizzon_finance651_runtime'
LOGGER = logging.getLogger(__name__)
OPERATIONS={'state','dashboards','save_record','delete_record','account','user','transaction','post','void','reconcile','approve','overview','tick','import_preview','import_confirm','integration','document_add','document_get','document_remove','audit','card_statement'}
INTEGRATIONS={'integrations_get','integrations_save','integrations_run','integrations_test','market_history_import','market_history_preview'}

def normalize_statement(args):
    text = args.get('text')
    if args.get('format','csv') != 'csv' or not isinstance(text,str) or not text:
        return args
    if len(text) > 2_000_000:
        raise ValueError('Extrato muito grande')
    aliases = {'data':'date','descricao':'description','valor':'amount','identificador':'external_id'}
    text = text.lstrip('\ufeff')
    if not text.strip():
        raise ValueError('Selecione um extrato com lançamentos')
    delimiter = ';' if ';' in text.splitlines()[0] else ','
    output = io.StringIO(newline='')
    writer = csv.writer(output, delimiter=';')
    try:
        reader = csv.reader(io.StringIO(text,newline=''), delimiter=delimiter, strict=True)
        header = [''.join(c for c in unicodedata.normalize('NFKD',v.strip().lower())
                          if not unicodedata.combining(c)) for v in next(reader,[])]
        columns = [aliases.get(v,v) for v in header]
        required = ('date','description','amount')
        if any(columns.count(k)!=1 for k in required) or columns.count('external_id')>1:
            raise ValueError('CSV precisa das colunas Data, Descrição e Valor. Identificador é opcional.')
        writer.writerow((*required,'external_id'))
        for fields in reader:
            if not fields or not any(v.strip() for v in fields):
                continue
            if len(fields)>len(columns) and columns==['date','amount','external_id','description']:
                fields = [*fields[:len(columns)-1], delimiter.join(fields[len(columns)-1:])]
            if len(fields)!=len(columns):
                raise ValueError(f'Confira as colunas do CSV na linha {reader.line_num}.')
            row = dict(zip(columns,fields))
            raw_day = row['date'].strip()
            try:
                day = datetime.strptime(raw_day,'%d/%m/%Y').date() if '/' in raw_day else date.fromisoformat(raw_day)
            except ValueError:
                raise ValueError(f'Data inválida no CSV na linha {reader.line_num}.') from None
            writer.writerow((day.isoformat(),row['description'],row['amount'].strip(),row.get('external_id','').strip()))
    except csv.Error:
        raise ValueError(f'Confira as aspas e colunas do CSV perto da linha {reader.line_num}.') from None
    return {**args,'text':output.getvalue()}

class LocalFinance:
    def __init__(self,hass,context):
        self.hass=hass;self.context=context;self.closed=False;self.lock=asyncio.Lock()
        self.namespace=None;self.service=None;self.integrations=None
    def _load(self):
        root=Path(self.hass.config.path('.storage/cloudpelizzon_compiled627'))
        package=package_folder(root,public_key=PUBLIC_KEY)
        namespace=Namespace(package,sku='CP-FINANCE',public_key=PUBLIC_KEY,state_root=root)
        dbroot=Path(self.hass.config.path('.storage/cloudpelizzon_finance651'))
        dbroot.mkdir(mode=0o700,exist_ok=True)
        self.namespace=namespace
        self.service=namespace.module.Service(dbroot/'finance.sqlite',self.context['core_id'])
    async def execute(self,connection,operation,args):
        if self.closed:raise PermissionError('finance_closed')
        actor=connection.user.id
        user=await self.hass.auth.async_get_user(actor)
        if not user or not user.is_active:raise PermissionError('active_HA_user_required')
        if {'actor_id','installation_id'} & args.keys() or ('role' in args and operation!='user'):
            raise PermissionError('trusted_HA_identity_required')
        args=json.loads(json.dumps(args,allow_nan=False))
        if operation in {'import_preview','import_confirm'}:
            args=normalize_statement(args)
        if operation=='document_add':
            encoded=args.pop('base64',None)
            if not isinstance(encoded,str) or len(encoded)>6_666_668:raise ValueError('Documento deve ter até 5 MB')
            try:args['content']=base64.b64decode(encoded,validate=True)
            except ValueError:raise ValueError('Documento inválido') from None
        async with self.lock:
            if self.closed:raise PermissionError('finance_closed')
            if self.service is None:await self.hass.async_add_executor_job(self._load)
            # Only the actual HA owner may claim an empty financial database.
            if user.is_owner:
                await self.hass.async_add_executor_job(lambda:self.service.bootstrap_owner(actor,is_ha_owner=True))
            generation=(user.is_active,user.is_owner,user.is_admin)
            def active():
                return not self.closed and connection.user is user and (user.is_active,user.is_owner,user.is_admin)==generation
            if not active():raise PermissionError('HA_session_changed')
            async def command(name,payload):
                return await self.hass.async_add_executor_job(
                    lambda:self.service.execute(actor,name,payload,active_guard=active))

            if operation in INTEGRATIONS:
                state=await command('state',{})
                if operation in {'market_history_import','market_history_preview'}:
                    if state['user']['role'] not in {'admin','manager'} or not active():
                        raise PermissionError('finance_market_manage_required')
                    return await self.integrations.import_market_csv(args.get('text'),preview=operation=='market_history_preview')
                if not user.is_admin or state['user']['role']!='admin' or not active():
                    raise PermissionError('finance_integrations_admin_required')
                if operation=='integrations_get':
                    if not self.integrations.saved.get('actor'):
                        await self.integrations.configure(actor,self.integrations.suggested())
                        self.hass.async_create_task(self.integrations.scheduled(None))
                    return self.integrations.view()
                if operation=='integrations_save':
                    return await self.integrations.configure(actor,args)
                if operation=='integrations_test':
                    return await self.integrations.test(actor,args.get('channel'),active)
                return await self.integrations.run(actor,state,command,active)

            if operation=='user':
                if (await command('state',{}))['user']['role']!='admin':
                    raise PermissionError('finance_admin_required')
                target_id=args.get('id')
                if not isinstance(target_id,str) or not target_id:
                    raise ValueError('Selecione uma pessoa do Home Assistant')
                target=await self.hass.auth.async_get_user(target_id)
                if not target or target.system_generated or (not target.is_active and args.get('enabled',True)):
                    raise ValueError('Selecione uma pessoa ativa no Home Assistant para habilitar o acesso')
                args['name']=target.name or 'Usuário do Home Assistant'

            result=await command(operation,args)
            if operation=='state' and self.integrations and result['user']['role'] in {'admin','manager'}:
                from .finance_integrations651 import MARKET_ASSETS
                result={**result,'market_quotes':self.integrations.saved.get('market_quotes',[]),
                        'market_b3_history':self.integrations.saved.get('market_b3_history',{}),
                        'market_status':self.integrations.saved.get('last',{}).get('quotes',{}),
                        'market_catalog':[{'ticker':ticker,'company':company,'exchange':exchange,'currency':currency,
                                           'sector':sector,'automatic':exchange in ('B3','NYSE','Nasdaq')}
                                          for ticker,(company,exchange,currency,sector) in MARKET_ASSETS.items()],
                        'market_imports':self.integrations.saved.get('market_imports',{}),
                        'maintenance_forecast':{row['id']:self.integrations.saved['maintenance_forecast'][row['external_id']]
                                                for row in result['records']['maintenance']
                                                if row.get('source')=='maintenance' and not row.get('completed')
                                                and row.get('external_id') in self.integrations.saved.get('maintenance_forecast',{})},
                        'maintenance_latest':{row['id']:self.integrations.saved['maintenance_latest'][row['external_id']]
                                              for row in result['records']['maintenance']
                                              if row.get('source')=='maintenance' and not row.get('completed')
                                              and row.get('external_id') in self.integrations.saved.get('maintenance_latest',{})},
                        'utility_costs':{row['id']:self.integrations.saved['utility_costs'][row['id']]
                                         for row in result['records']['utilities']
                                         if row['id'] in self.integrations.saved.get('utility_costs',{})}}
            if operation in {'overview','dashboards'} and self.integrations:
                state=await command('state',{})
                if state['user']['role'] in {'admin','manager'}:
                    if self.integrations.saved.get('config',{}).get('maintenance',True):
                        result=self.integrations.maintenance_projection(result,state,operation,args)
                    if operation=='dashboards' and self.integrations.saved.get('utility_costs'):
                        result=self.integrations.consumption_costs(result,state['records']['utilities'])
            if operation=='state' and user.is_admin and result['user']['role']=='admin':
                directory={person.id:person for person in await self.hass.auth.async_get_users()
                           if person.is_active and not person.system_generated}
                existing={person['id'] for person in result['users']}
                for person in directory.values():
                    if person.id not in existing and person.is_active:
                        await command('user',{'id':person.id,'name':person.name or 'Usuário do Home Assistant',
                                              'role':'reader','accounts':[],'enabled':False})
                if directory.keys()-existing:
                    result=await command('state',{})
                result={**result,'ha_directory':True,'users':[
                    {**person,'ha_active':person['id'] in directory,
                     'name':(directory[person['id']].name or person['name']) if person['id'] in directory else person['name']}
                    for person in result['users']]}
            elif operation=='state' and result['user']['role'] in {'entry','reader'}:
                # Only expose the catalog labels required for entering an authorized transaction.
                fields={'categories','properties','projects'} if result['user']['role']=='entry' else set()
                result={**result,'records':{key:rows for key,rows in result['records'].items() if key in fields}}
            if operation=='state' and result['user']['role'] in {'admin','manager'}:
                areas = area_registry.async_get(self.hass).async_list_areas()
                result['ha_areas'] = sorted({area.name for area in areas if area.name}, key=str.casefold)
            if operation=='audit':
                names={}
                for actor_id in {record['actor'] for record in result}:
                    person=await self.hass.auth.async_get_user(actor_id)
                    if person and not person.system_generated and person.name:
                        names[actor_id]=person.name
                result=[{**record,'actor_name':names.get(record['actor'])} for record in result]
            current=await self.hass.auth.async_get_user(actor)
            if current is not user or not active():raise PermissionError('HA_session_changed')
            if operation=='document_get':
                result={**result,'base64':base64.b64encode(result['content']).decode()}
                result.pop('content',None)
            return result
    def close(self):
        self.closed=True
        if self.integrations:
            self.integrations.close()
        # Let an in-flight operation finish/roll back before closing SQLite.
        async def close_service():
            async with self.lock:
                if self.service:await self.hass.async_add_executor_job(self.service.close)
                if self.namespace:self.namespace.close()
        self.hass.async_create_task(close_service())

async def register(hass,context,bridge):
    from .finance_integrations651 import FinanceIntegrations
    runtime=LocalFinance(hass,context)
    if KEY in hass.data:raise RuntimeError('finance_already_registered')
    await hass.async_add_executor_job(runtime._load)
    runtime.integrations=FinanceIntegrations(runtime)
    try:
        await runtime.integrations.start()
    except Exception:
        runtime.close()
        raise
    original_handle = bridge.handle

    async def catalog_handle(command, args=None, *, active=False):
        result = await original_handle(command, args, active=active)
        if command != 'cloudpelizzon/core/status' or runtime.closed:
            return result
        try:
            entitlement = await hass.async_add_executor_job(runtime.namespace.guard.verify, 'CP-FINANCE')
        except (PermissionError, OSError, ValueError):
            return result
        modules = [module for module in result['modules'] if module['sku'] != 'CP-FINANCE']
        return {**result, 'modules': [*modules, {
            'sku': 'CP-FINANCE', 'name': 'Finanças', 'path': '/cloudpelizzon/finance',
            'description': 'Organize seu orçamento, contas e investimentos em um só lugar.',
            'installed': True, 'local_installed': True, 'lifecycle': 'developed',
            'license': {
                'allowed': True, 'status': 'trial' if entitlement.get('trial') else 'licensed',
                'local_verified_until': min(entitlement.get('expires_at') or int(time.time()) + 120, int(time.time()) + 120),
            },
        }]}
    hass.data[KEY]=runtime
    if not hass.data.get(KEY+'_command'):
        @websocket_api.websocket_command({vol.Required('type'):'cloudpelizzon/finance/execute',vol.Required('operation'):vol.In(OPERATIONS|INTEGRATIONS),vol.Optional('payload',default={}):dict})
        @websocket_api.async_response
        async def execute(hass,connection,msg):
            active=hass.data.get(KEY)
            if active is None or active.closed:
                connection.send_error(msg['id'],'not_available','Finanças indisponível nesta instalação.');return
            try:
                result=await active.execute(connection,msg['operation'],msg['payload'])
            except PermissionError:
                connection.send_error(msg['id'],'not_allowed','Confira a autorização do módulo e as permissões do usuário.')
            except ValueError as exc:
                connection.send_error(msg['id'],'invalid_input',str(exc)[:180])
            except Exception:
                connection.send_error(msg['id'],'operation_failed','Não foi possível concluir a operação. Consulte o diagnóstico local.')
            else:connection.send_result(msg['id'],result)
        websocket_api.async_register_command(hass,execute)
        hass.data[KEY+'_command']=True
    LOGGER.warning('CP-FINANCE651: motor assinado carregado e WebSocket registrado epoch=%d', int(time.time()))
    bridge.handle = catalog_handle
    def close():
        if bridge.handle is catalog_handle:
            bridge.handle = original_handle
        if hass.data.get(KEY) is runtime:hass.data.pop(KEY,None)
        runtime.close()
    return close

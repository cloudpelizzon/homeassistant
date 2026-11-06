"""Limited public HA registry adapter. No network discovery or commercial engine."""
import asyncio,copy,ipaddress,time,uuid,json
from collections.abc import Mapping
from homeassistant.components import websocket_api
from homeassistant.helpers import device_registry as dr,area_registry as ar
from homeassistant.helpers.storage import Store
import voluptuous as vol

KEY='cloudpelizzon_inventory_free632';COMMAND='cloudpelizzon/inventory/command';LIMIT=10
FIELDS={'name','category','manufacturer','model','primary_ip','serial','notes'}
FEATURES=('advanced_map','history','reports','scheduled_discovery','maintenance_rules','portal_map','connectors','backups')

class LimitedInventory:
 def __init__(self,hass):
  self.hass=hass;self.closed=False;self.lock=asyncio.Lock();self.store=Store(hass,1,KEY,private=True,atomic_writes=True);self.assets={};self.handler=None
 async def load(self):
  data=await self.store.async_load()
  if data is not None:
   if not isinstance(data,dict) or data.get('schema')!=1 or not isinstance(data.get('assets'),dict) or len(data['assets'])>LIMIT:raise ValueError('free_inventory_store_invalid')
   self.assets=data['assets']
 def capabilities(self):return {'sku':'CP-INVENTORY','mode':'free','paid':False,'max_devices':LIMIT,'features':{k:False for k in FEATURES},'licensed_features':[{'id':k,'name':v} for k,v in zip(FEATURES,('Diagrama de rede e plantas 2D/3D','Histórico detalhado','Relatórios e impressão','Descoberta e atualização automática','Integração com Manutenção','Réplica no Portal','Conectores de infraestrutura','Backup e recuperação'))],'trial_available':False}
 def candidates(self):
  result=[]
  entries=dr.async_get(self.hass).devices
  for d in (entries.values() if isinstance(entries,Mapping) else entries):
   if getattr(d,'disabled_by',None):continue
   aid=uuid.uuid5(uuid.NAMESPACE_URL,'ha-device:'+d.id).hex
   if aid in self.assets:continue
   result.append({'id':aid,'name':d.name_by_user or d.name or 'Dispositivo do HA','category':'unknown','manufacturer':d.manufacturer or '', 'model':d.model or '', 'attributes':{'ha_device_id':d.id},'addresses':[],'sources':['ha'],'managed':False,'available':None,'last_seen':0})
  return sorted(result,key=lambda d:(d['name'].casefold(),d['id']))
 def snapshot(self,args):
  devices=list(copy.deepcopy(self.assets).values());candidates=self.candidates();query=str(args.get('query','')).casefold();devices=[d for d in devices if not query or query in d['name'].casefold()]
  settings={'portal_sync616':{},'automation612':{'mode':'interval','times':[],'days':list(range(7)),'auto_add':'off','update_ip':False,'update_areas':False,'update_fields':False,'diagnostic_minutes':60},'device_highlight':True,'networks':[],'active_discovery_enabled':False,'schedule_minutes':0,'scheduled_sources':['ha'],'portal_map_consent':False,'house_undo_count':0,'house':{'floors':[],'rooms':[]},'retention_days':90,'connector_targets':[],'topology_orientation':'vertical','topology_can_undo':False}
  return {'schema':'cp.inventory.snapshot.v1','capabilities':self.capabilities(),'summary':{'managed':len(self.assets),'frozen':0,'candidates':len(candidates),'relations':0,'relationships':0,'conflicts':0,'recent':0,'observed_available':0,'classified':sum(d.get('category')!='unknown' for d in devices)},'devices':devices,'filtered_count':len(devices),'page':0,'candidates':candidates[:50],'candidate_filtered_count':len(candidates),'candidate_page':0,'discovery_summary':{'equipment':len(candidates),'software':0,'group':0,'protocols':{}},'device_types':[],'device_type_groups':[],'categories':['unknown','router','switch','computer','server','television','sensor','actuator','other'],'connectors':{},'runs':[],'relations':[],'conflicts':[],'settings':settings,'limits':{'devices':LIMIT}}
 def topology(self):
  # An empty observation is not a fabricated network or inferred relationship.
  nodes=[{'id':d['id'],'label':d['name'],'category':d.get('category','unknown'),'available':None} for d in self.assets.values()]
  doc={'schema':'cp.inventory.graph.v1','core_id':'','nodes':nodes,'edges':[]}
  return {'document':doc,'positions':{},'routes':[],'rooms':[],'presentation':{},'width':1000,'height':700,'unresolved':[],'detected_networks':[],'discovered_ids':[],'virtual_ids':[],'room_device_nodes':nodes,'actual_devices':len(nodes),'logical_stats':{},'summary':{'devices':len(nodes),'links':0,'confirmed':0,'inferred':0,'manual':0},'placement_is_not_evidence':True}
 def clean(self,values):
  if not isinstance(values,dict):raise ValueError('invalid_device_fields')
  result={}
  for k,v in values.items():
   if k not in FIELDS:continue
   if not isinstance(v,str) or len(v)> (2000 if k=='notes' else 160):raise ValueError('invalid_device_fields')
   result[k]=v.strip()
  if result.get('primary_ip'):ipaddress.ip_address(result['primary_ip'])
  return result
 async def command(self,op,args,authorize=None):
  if not isinstance(args,dict) or len(json.dumps(args).encode())>65536:raise ValueError('invalid_request')
  if op=='capabilities':return self.capabilities()
  if op=='snapshot':return self.snapshot(args)
  if op in ('topology','graph'):return self.topology()
  if op=='locations':return [{'id':a.id,'name':a.name} for a in ar.async_get(self.hass).areas.values()]
  if op=='types.list':return []
  if op=='device.get':
   d=copy.deepcopy(self.assets.get(args.get('id')))
   if d is None:raise ValueError('device_not_found')
   return {**d,'manual_addresses':[],'identifiers':[],'photo':'','icon_image':''}
  if op not in ('device.create','device.edit','device.archive','device.unmanage_many','device.promote','device.promote_many'):raise PermissionError('inventory_full_license_required')
  async with self.lock:
   if authorize is not None:await authorize()
   saved=copy.deepcopy(self.assets)
   try:
    if op=='device.create':
     if len(self.assets)>=LIMIT:raise PermissionError('device_limit_reached')
     v=self.clean(args.get('device',{}));name=v.pop('name','');category=v.pop('category','other')
     if not name:raise ValueError('name_required')
     aid=uuid.uuid4().hex;self.assets[aid]={'id':aid,'name':name,'category':category,'manufacturer':v.pop('manufacturer',''),'model':v.pop('model',''),'attributes':v,'addresses':[v['primary_ip']] if v.get('primary_ip') else [],'sources':['manual'],'managed':True,'available':None,'last_seen':0};result={'asset_id':aid}
    elif op.startswith('device.promote'):
     ids=args.get('ids',[args.get('id')]);available={d['id']:d for d in self.candidates()}
     if not isinstance(ids,list) or not ids or len(ids)>LIMIT or len(set(ids)|set(self.assets))>LIMIT:raise PermissionError('device_limit_reached')
     if any(i not in available and i not in self.assets for i in ids):raise ValueError('device_not_found')
     for aid in ids:
      if aid in available:self.assets[aid]={**available[aid],'managed':True}
     result={'ids':ids}
    elif op=='device.edit':
     aid=args.get('id')
     if aid not in self.assets:raise ValueError('device_not_found')
     v=self.clean(args.get('values',{}));d=self.assets[aid]
     for k in ('name','category','manufacturer','model'):
      if k in v:d[k]=v.pop(k)
     d['attributes'].update(v)
     if 'primary_ip' in v:d['addresses']=[v['primary_ip']] if v['primary_ip'] else []
     result={'asset_id':aid}
    else:
     ids=args.get('ids',[args.get('id')])
     if not isinstance(ids,list) or len(ids)>LIMIT:raise ValueError('invalid_device_selection')
     for aid in ids:self.assets.pop(aid,None)
     result={'ids':ids}
    if self.closed:raise PermissionError('inventory_unloaded')
    if authorize is not None:await authorize()
    await self.store.async_save({'schema':1,'assets':self.assets});return result
   except BaseException:self.assets=saved;raise

async def register(hass,entry,context):
 registry=hass.data.get(websocket_api.DOMAIN,{})
 if COMMAND in registry:raise ValueError('inventory_handler_already_registered')
 state=LimitedInventory(hass);await state.load()
 async def handler(hass,connection,msg):
  actor=connection.user
  if actor is None or not actor.is_active or not actor.is_admin:connection.send_error(msg['id'],'unauthorized','Acesso administrativo necessário.');return
  current=await hass.auth.async_get_user(actor.id)
  if state.closed or connection.user is not actor or current is None or not current.is_active or not current.is_admin:connection.send_error(msg['id'],'unauthorized','Sessão encerrada.');return
  async def authorize():
   current=await hass.auth.async_get_user(actor.id)
   if state.closed or connection.user is not actor or current is None or not current.is_active or not current.is_admin:raise PermissionError('inventory_session_changed')
  try:result=await state.command(msg['operation'],msg.get('args',{}),authorize=authorize)
  except PermissionError:connection.send_error(msg['id'],'inventory_full_license_required','Recurso disponível na versão completa. O gratuito permite até dez equipamentos.');return
  except Exception:connection.send_error(msg['id'],'inventory_request_invalid','Confira os dados e o limite de dez equipamentos.');return
  current=await hass.auth.async_get_user(actor.id)
  if state.closed or connection.user is not actor or current is None or not current.is_active or not current.is_admin:connection.send_error(msg['id'],'unauthorized','Sessão encerrada.');return
  connection.send_result(msg['id'],result)
 fn=websocket_api.websocket_command({vol.Required('type'):COMMAND,vol.Required('operation'):str,vol.Optional('args',default={}):dict})(websocket_api.async_response(handler));state.handler=fn
 websocket_api.async_register_command(hass,fn);hass.data[KEY]=state
 def close():
  state.closed=True
  if hass.data.get(KEY) is state:hass.data.pop(KEY,None)
  reg=hass.data.get(websocket_api.DOMAIN,{})
  if reg.get(COMMAND,(None,))[0] is fn:reg.pop(COMMAND)
 return close


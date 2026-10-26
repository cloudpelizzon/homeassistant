"""HA metadata synchronization through existing authenticated signed operations."""
import asyncio,hashlib,re,secrets,unicodedata
from datetime import datetime,timezone

KEY='cloudpelizzon_lighting_sync239'
ROOM=re.compile(r'[A-Za-z0-9_-]{1,128}\Z')
LIGHT=re.compile(r'light\.[a-z0-9_]{1,128}\Z')

def normalized(v):return unicodedata.normalize('NFKC',v).casefold()
def label(v,fallback):
 if not isinstance(v,str) or not v.strip() or any(unicodedata.category(c).startswith('C') for c in v):v=fallback
 v=v.strip()
 return v if len(v)<=80 else v[:70]+'… '+hashlib.sha256(v.encode()).hexdigest()[:8]

def source_lights(rows,entities,devices,areas,states):
 """No registry writes or service calls; only native light entities are eligible."""
 found=[];ignored={'switches':0,'sensors':0,'groups_or_hidden':0}
 for row in rows:
  eid=row['entity_id']
  if eid.startswith('switch.'):ignored['switches']+=1;continue
  if not LIGHT.fullmatch(eid):ignored['sensors']+=1;continue
  entry=entities.get(eid);state=states.get(eid)
  attrs=getattr(state,'attributes',{}) or {}
  if (getattr(entry,'disabled_by',None) is not None or getattr(entry,'hidden_by',None) is not None
      or getattr(entry,'platform',None)=='group' or isinstance(attrs.get('entity_id'),(list,tuple))):
   ignored['groups_or_hidden']+=1;continue
  area_id=getattr(entry,'area_id',None)
  if not area_id:
   device=devices.get(getattr(entry,'device_id',None)) if entry is not None else None
   area_id=getattr(device,'area_id',None)
  area=areas.get(area_id) if isinstance(area_id,str) else None
  found.append({'entity_id':eid,'name':label(row['name'],eid),
   'area_id':area_id if area is not None else None,
   'area_name':label(area.name,area_id) if area is not None else None})
 return sorted(found,key=lambda x:x['entity_id']),ignored

def plan(source,configuration):
 existing={v['entity_id']:v for v in configuration['items']}
 rooms={v['id']:v for v in configuration['rooms']}
 names={normalized(v['name']):v['id'] for v in rooms.values()}
 planned={};room_actions=[];entity_actions=[]
 for row in source:
  old=existing.get(row['entity_id'])
  # Never overwrite an existing assignment, name, icon, or visibility choice.
  if old is not None and old['room_id'] is not None:continue
  room_id=None
  if row['area_id'] is not None:
   key=normalized(row['area_name']);room_id=names.get(key)
   if room_id is None:
    room_id='ha_'+hashlib.sha256(row['area_id'].encode()).hexdigest()[:24]
    if room_id in rooms and normalized(rooms[room_id]['name'])!=key:raise ValueError('room_identity_conflict')
    if room_id not in rooms and room_id not in planned:
     if len(rooms)+len(planned)>=200:raise ValueError('native_room_limit')
     planned[room_id]=row['area_name'];names[key]=room_id
     room_actions.append({'operation':'lighting.room.create','parameters':{'room_id':room_id,'name':row['area_name']}})
   if room_id in planned:names[key]=room_id
  if old is None:
   entity_actions.append({'operation':'lighting.entity.bind','parameters':{'entity_id':row['entity_id'],'room_id':room_id,'name':row['name'],'icon':'bulb','confirm_light':False}})
  elif old['room_id'] is None and room_id is not None:
   entity_actions.append({'operation':'lighting.entities.assign_room','parameters':{'entity_ids':[row['entity_id']],'room_id':room_id}})
 return room_actions+entity_actions

def applied(action,config):
 op=action['operation'];p=action['parameters']
 if op=='lighting.room.create':return any(r['id']==p['room_id'] and r['name']==p['name'] for r in config['rooms'])
 if op=='lighting.entity.bind':return any(r['entity_id']==p['entity_id'] and r['room_id']==p['room_id'] and r['name']==p['name'] for r in config['items'])
 if op=='lighting.entities.assign_room':return all(any(r['entity_id']==eid and r['room_id']==p['room_id'] for r in config['items']) for eid in p['entity_ids'])
 return False

class Sync:
 def __init__(self,hass):
  from homeassistant.helpers.storage import Store
  self.hass=hass;self.lock=asyncio.Lock();self.store=Store(hass,1,'cloudpelizzon_lighting_sync239.backup');self.closed=False
 async def current(self,connection,transport,user,iid):
  current=await transport._current(connection,user)
  if self.closed or not current.is_admin or getattr(current,'system_generated',False) or transport.port.installation_id()!=iid:raise PermissionError('sync_session_changed')
 async def configuration(self,connection,transport,user,iid):
  from .public_lighting.native_scope import _validated_page
  reference=None;items=[]
  for _ in range(20):
   await self.current(connection,transport,user,iid)
   offset=len(items)
   page=await transport.port.read_page(iid,user.id,{'offset':offset,'limit':100},secrets.token_hex(16))
   await self.current(connection,transport,user,iid)
   value=_validated_page(page,offset,reference);reference=value['marker'];items.extend(value['items'])
   if len(items)==reference[1]:break
  if reference is None or len(items)!=reference[1] or len({r['entity_id'] for r in items})!=len(items):raise PermissionError('native_configuration_incomplete')
  return {'revision':reference[0],'rooms':reference[2],'items':items,'total':reference[1],'preferences':reference[3]}
 async def inspect(self,connection,transport,user,iid):
  from homeassistant.helpers import area_registry as ar,device_registry as dr,entity_registry as er
  await self.current(connection,transport,user,iid)
  rows=await transport.uplink.inventory.collect(connection)
  await self.current(connection,transport,user,iid)
  entities=er.async_get(self.hass);devices=dr.async_get(self.hass);areas=ar.async_get(self.hass)
  source,ignored=source_lights(rows,entities.entities,devices.devices,areas.areas,self.hass.states)
  config=await self.configuration(connection,transport,user,iid)
  await self.current(connection,transport,user,iid)
  return source,ignored,config,plan(source,config)
 async def run(self,connection,*,mutate=False):
  user=getattr(connection,'user',None)
  if user is None or not user.is_active or not user.is_admin or getattr(user,'system_generated',False):raise PermissionError('admin_required')
  if self.lock.locked():return {'state':'busy','device_commands':0}
  async with self.lock:
   transport=self.hass.data.get('cloudpelizzon_lighting_native_v1')
   if transport is None or transport.closed or transport.uplink is None or not transport.port.registration_ready():raise PermissionError('native_transport_required')
   iid=transport.port.installation_id();source,ignored,config,actions=await self.inspect(connection,transport,user,iid)
   report={'state':'pending' if actions else 'complete','pending':len(actions),'eligible_lights':len(source),
    'configured_lights':len([r for r in config['items'] if r['kind']=='light']),
    'rooms':len(config['rooms']),'switches_for_individual_review':ignored['switches'],
    'groups_or_hidden_skipped':ignored['groups_or_hidden'],'device_commands':0,'trials_altered':False,'licenses_altered':False}
   record=await self.store.async_load()
   if record is not None and record.get('installation_id')!=iid:raise PermissionError('backup_installation_changed')
   if record and record.get('in_flight'):
    if not applied(record['in_flight'],config):return {**report,'state':'review_required','message':'Uma operação anterior ficou sem confirmação. Atualize a leitura e solicite revisão; ela não será reenviada automaticamente.'}
    record={**record,'in_flight':None};await self.store.async_save(record)
   if not mutate or not actions:return report
   if record is None:
    record={'installation_id':iid,'created_at':datetime.now(timezone.utc).isoformat(),'original_configuration':config,'in_flight':None}
    await self.store.async_save(record)
   action=actions[0];rid=secrets.token_hex(16)
   record={**record,'in_flight':{**action,'request_id':rid,'starting_revision':config['revision']}}
   await self.store.async_save(record)
   await self.current(connection,transport,user,iid)
   try:
    result=await transport.run(connection,{'type':'cloudpelizzon/lighting/v1/operation','id':1,
     'operation':action['operation'],'parameters':{'revision':config['revision'],**action['parameters']},'request_id':rid})
    await self.current(connection,transport,user,iid)
    if result.get('saved') is not True or result.get('revision')!=config['revision']+1:raise PermissionError('native_commit_not_confirmed')
    record={**record,'in_flight':None,'last_confirmed_revision':result['revision']};await self.store.async_save(record)
   except asyncio.CancelledError:raise
   except Exception:
    return {**report,'state':'review_required','message':'A sincronização parou. Os vínculos já confirmados foram preservados; não houve reenvio da operação sem confirmação.'}
   return {**report,'state':'pending','operation_confirmed':action['operation'],'pending':max(0,len(actions)-1),'backup_saved':True}

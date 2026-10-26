"""Bounded source reads and explicitly enabled, signed-relay-only service delivery."""
import asyncio,re,json,time
from contextvars import ContextVar
STATE_VERIFY_SECONDS=8
DELIVERY_CHECK=ContextVar('cp_source_delivery_check',default=None)
from datetime import datetime
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from .policy import DOMAIN,check_peer

def observer(hass):
 values=list(hass.data.get(DOMAIN,{}).values())
 if len(values)!=1 or values[0].stopping:raise PermissionError('production_observer_unavailable')
 return values[0]

async def request(mirror,kind,**payload):
 """One authenticated connection, one request; mutations are never retried."""
 if kind not in {'call_service','get_config','logbook/get_events','cloudpelizzon/energy/config/get','history/history_during_period'}:raise PermissionError('source_operation_denied')
 if kind=='call_service' and not mirror.forward_commands:raise PermissionError('production_commands_disabled')
 async with asyncio.timeout(20):
  async with async_get_clientsession(mirror.hass).ws_connect(mirror.source,heartbeat=30,max_msg_size=16777216) as ws:
   check_peer(str(ws._response.url),mirror.source)
   if (await ws.receive_json()).get('type')!='auth_required':raise PermissionError('source_protocol')
   await ws.send_json({'type':'auth','access_token':mirror.token})
   if (await ws.receive_json()).get('type')!='auth_ok':raise PermissionError('source_authentication')
   if mirror.stopping or observer(mirror.hass) is not mirror:raise PermissionError('source_changed')
   if kind=='call_service' and not mirror.forward_commands:raise PermissionError('production_commands_disabled')
   if kind=='call_service':
    check=DELIVERY_CHECK.get()
    if check is None:raise PermissionError('signed_delivery_context_required')
    check()
   await ws.send_json({'id':1,'type':kind,**payload})
   result=await ws.receive_json()
   if result.get('id')!=1 or result.get('type')!='result' or result.get('success') is not True:raise PermissionError('source_operation_unconfirmed_no_retry')
   if mirror.stopping or observer(mirror.hass) is not mirror:raise PermissionError('source_changed')
   return result.get('result')

async def forward(hass,domain,service,data):
 """Called only after the existing module relay has verified its signed grant."""
 targets=data.get('entity_id',[]);targets=[targets] if isinstance(targets,str) else targets
 mirrored=[eid for eid in targets if (hass.states.get(eid) and hass.states.get(eid).attributes.get('mirror_source')=='production_observer')]
 if not mirrored:return False
 from ..public_security.wire126 import permitted
 mirror=observer(hass)
 if (not mirror.forward_commands or len(mirrored)!=len(targets) or len(targets)!=1
     or targets[0] not in mirror.owned or not permitted(domain,service,targets[0])):raise PermissionError('production_target_not_authorized')
 if set(data)&{'area_id','device_id','label_id','target'}:raise PermissionError('expanded_target_denied')
 target=targets[0];expected=expected_states(service,data)
 mirror.last_command={'entity_id':target,'service':domain+'.'+service,'source':mirror.source.split('/api/')[0],'outcome':'checking','at':time.time()}
 before=await source_state(mirror,target)
 if service=='toggle':expected={'off' if before['state']=='on' else 'on'}
 if before.get('attributes',{}).get('mirror_source')=='production_observer':raise PermissionError('production_source_is_another_mirror')
 if before['state'] in {'unknown','unavailable'}:
  mirror.last_command.update(outcome='source_unavailable',before=before['state'],after=before['state']);mirror.status('connected')
  raise PermissionError('production_entity_unavailable')
 mirror.last_command['before']=before['state']
 already=bool(expected and before['state'] in expected)
 mirror.last_command['transport']='ha_service_rest'
 await post_service(mirror,domain,service,data)
 mirror.commands_forwarded+=1;mirror.last_command['outcome']='accepted_not_verified';mirror.status('connected')
 # An accepted HA service call can match zero entities. Verify telemetry instead
 # of displaying success based solely on its acknowledgement. Never resend.
 until=time.monotonic()+STATE_VERIFY_SECONDS
 while True:
  after=await source_state(mirror,target);mirror.apply(after);mirror.last_command['after']=after['state']
  if expected and after['state'] in expected:
   mirror.last_command['outcome']='arming' if after['state']=='arming' else 'already_in_state' if already else 'state_verified';mirror.status('connected');return True
  if time.monotonic()>=until:break
  await asyncio.sleep(.5)
 mirror.last_command['outcome']='no_state_change';mirror.status('connected')
 raise PermissionError('production_state_not_confirmed_no_retry')

async def post_service(mirror,domain,service,data):
 """Use HA's native services endpoint, once, after the signed dispatch check."""
 from ..public_security.wire126 import permitted
 if (not mirror.forward_commands or mirror.stopping or observer(mirror.hass) is not mirror
     or not permitted(domain,service,data.get('entity_id',''))):raise PermissionError('production_dispatch_not_authorized')
 check=DELIVERY_CHECK.get()
 if check is None:raise PermissionError('signed_delivery_context_required')
 check()
 async with asyncio.timeout(5):
  async with async_get_clientsession(mirror.hass).post(mirror.source.split('/api/')[0]+'/api/services/'+domain+'/'+service,json=dict(data),headers={'Authorization':'Bearer '+mirror.token},allow_redirects=False) as response:
   if response.status!=200:
    mirror.last_command.update(outcome='source_rejected',http_status=response.status);mirror.status('connected')
    raise PermissionError('production_service_rejected_no_retry')
   content=bytearray()
   async for chunk in response.content.iter_chunked(8192):
    content.extend(chunk)
    if len(content)>2097152:raise ValueError('source_service_response_limit')
   if not isinstance(json.loads(content),list):raise ValueError('source_service_response_invalid')

def expected_states(service,data):
 if service=='turn_on':return {'on'}
 if service=='turn_off':return {'off'}
 if service=='select_option':return {data['option']} if isinstance(data.get('option'),str) else set()
 return {'alarm_disarm':{'disarmed'},'alarm_arm_home':{'armed_home','arming'},'alarm_arm_away':{'armed_away','arming'},'alarm_arm_night':{'armed_night','arming'},'alarm_trigger':{'triggered'},'open_cover':{'open','opening'},'close_cover':{'closed','closing'},'stop_cover':{'open','closed'}}.get(service,set())

async def source_state(mirror,eid):
 if not re.fullmatch(r'[a-z_]+\.[a-z0-9_]+',eid):raise ValueError('source_entity_invalid')
 async with asyncio.timeout(6):
  async with async_get_clientsession(mirror.hass).get(mirror.source.split('/api/')[0]+'/api/states/'+eid,headers={'Authorization':'Bearer '+mirror.token},allow_redirects=False) as response:
   if response.status!=200:raise PermissionError('source_entity_not_available')
   content=bytearray()
   async for chunk in response.content.iter_chunked(8192):
    content.extend(chunk)
    if len(content)>65536:raise ValueError('source_state_limit')
   value=json.loads(content)
 if mirror.stopping or observer(mirror.hass) is not mirror:raise PermissionError('source_changed')
 if not isinstance(value,dict) or value.get('entity_id')!=eid or not isinstance(value.get('state'),str):raise ValueError('source_state_binding')
 return value
 return True

def count_events(rows,ids,start,end,tz):
 counts,hours,_=execution_events(rows,ids,start,end,tz)
 return counts,hours

def execution_events(rows,ids,start,end,tz):
 if not isinstance(rows,list) or len(rows)>100000:raise ValueError('logbook_response_limit')
 counts={eid:0 for eid in ids};hours=[0]*24;by_entity={eid:[0]*24 for eid in ids};seen=set()
 for row in rows:
  if not isinstance(row,dict):continue
  eid=row.get('entity_id');when=row.get('when');message=row.get('message','')
  if row.get('domain')!='automation' or eid not in counts or not isinstance(when,(int,float)) or not start.timestamp()<=when<end.timestamp() or not isinstance(message,str) or not (message=='triggered' or message.startswith('triggered by ')):continue
  context=row.get('context_id')
  if not isinstance(context,str) or not context:continue
  key=(eid,context)
  if key in seen:continue
  seen.add(key);counts[eid]+=1;hour=datetime.fromtimestamp(when,tz).hour;hours[hour]+=1;by_entity[eid][hour]+=1
 return counts,hours,by_entity

async def daily(hass):
 from zoneinfo import ZoneInfo
 from homeassistant.util import dt as dt_util
 mirror=observer(hass)
 config=await request(mirror,'get_config')
 zone=config.get('time_zone') if isinstance(config,dict) else None
 if not isinstance(zone,str):raise ValueError('source_timezone_unavailable')
 tz=ZoneInfo(zone);now=dt_util.utcnow().astimezone(tz);start=now.replace(hour=0,minute=0,second=0,microsecond=0)
 ids=sorted(eid for eid in mirror.owned if eid.startswith('automation.'))
 cached=getattr(mirror,'daily_cache',None)
 key=(start.isoformat(),tuple(ids))
 if cached and cached[0]==key and (now-cached[1]).total_seconds()<60:return cached[2]
 counts={};hours=[0]*24;by_entity={}
 for offset in range(0,len(ids),40):
  batch=ids[offset:offset+40]
  rows=await request(mirror,'logbook/get_events',start_time=start.isoformat(),end_time=now.isoformat(),entity_ids=batch)
  c,h,entity_hours=execution_events(rows,batch,start,now,tz);counts.update(c);hours=[a+b for a,b in zip(hours,h)];by_entity.update(entity_hours)
 result={'day':start.date().isoformat(),'time_zone':zone,'start_time':start.isoformat(),'end_time':now.isoformat(),'counts':counts,'hours':hours,'entity_hours':by_entity,'complete':True,'source':'production_logbook_unique_contexts'}
 mirror.daily_cache=(key,now,result)
 return result

def measurement_config(document):
 """Copy measurement fields only: never identities, grants or credentials."""
 config=document.get('config') if isinstance(document,dict) else None
 if not isinstance(config,dict):raise ValueError('source_config_invalid')
 fields={
  'site':{'name','grid_provider','phases','house_power_entity','house_energy_entity','generation_energy_entity'},
  'grid':{'mode','net_power_entity','net_sign','import_power_entity','export_power_entity','import_energy_entity','export_energy_entity'},
  'generation':{'id','kind','name','manufacturer','model','power_entity','energy_entity','power_transform'},
  'boards':{'id','name','power_entity','energy_entity','power_transform','loads'},
 }
 def row(value,allowed):
  if not isinstance(value,dict):raise ValueError('source_config_shape')
  out={}
  for k,v in value.items():
   if k not in allowed:continue
   if k=='loads':
    if not isinstance(v,list) or len(v)>100:raise ValueError('source_load_limit')
    out[k]=[row(x,{'id','name','power_entity','energy_entity','power_transform'}) for x in v]
   elif type(v) in (str,int,float,bool) and (not isinstance(v,str) or len(v)<=256):out[k]=v
  return out
 out={'configured':True}
 for section,allowed in fields.items():
  value=config.get(section,[] if section in {'boards','generation'} else {})
  if section in {'boards','generation'}:
   if not isinstance(value,list) or len(value)>100:raise ValueError('source_config_limit')
   out[section]=[row(x,allowed) for x in value]
  else:out[section]=row(value,allowed)
 return out

async def energy_history(hass,args,allowed):
 ids=args['entity_ids'];start=datetime.fromisoformat(args['start_time'].replace('Z','+00:00'));end=datetime.fromisoformat(args['end_time'].replace('Z','+00:00'))
 if (not isinstance(ids,list) or not 1<=len(ids)<=150 or any(not isinstance(eid,str) or eid not in allowed for eid in ids)
     or start.tzinfo is None or end.tzinfo is None or not 0<(end-start).total_seconds()<=32*86400):raise ValueError('energy_history_scope')
 value=await request(observer(hass),'history/history_during_period',start_time=start.isoformat(),end_time=end.isoformat(),entity_ids=ids,minimal_response=True,no_attributes=True,significant_changes_only=False,include_start_time_state=True)
 if not isinstance(value,dict) or not set(value)<=set(ids):raise ValueError('energy_history_response')
 return value

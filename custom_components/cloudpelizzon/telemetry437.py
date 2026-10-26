"""Aggregate HA observations. Never reads secrets, entity values or calls services."""
import time,sys
from collections import Counter,defaultdict
from homeassistant.helpers import device_registry as dr,entity_registry as er

def state_name(entry):
 value=getattr(entry,'state',None)
 return str(getattr(value,'value',value)).lower()

def counts(entries):
 result={'loaded':0,'failed':0,'pending':0}
 for entry in entries:
  if getattr(entry,'disabled_by',None):continue
  state=state_name(entry)
  if state=='loaded':result['loaded']+=1
  elif state in ('setup_error','setup_retry','migration_error','failed_unload'):result['failed']+=1
  else:result['pending']+=1
 return result

def collect(hass):
 devices=dr.async_get(hass).devices
 entities=er.async_get(hass).entities
 grouped=defaultdict(list);ec=Counter(total=0,available=0,unavailable=0,unknown=0,assumed=0)
 for e in entities.values():
  device=devices.get(e.device_id) if e.device_id else None
  if e.disabled_by or (device and device.disabled_by):continue
  observed=hass.states.get(e.entity_id)
  if observed is None or observed.state=='unknown':category='unknown'
  elif observed.attributes.get('assumed_state') is True:category='unknown';ec['assumed']+=1
  elif observed.state=='unavailable':category='unavailable'
  else:category='available'
  ec['total']+=1;ec[category]+=1
  if device:grouped[device.id].append(category)
 dc=Counter(total=0,available=0,partial=0,unavailable=0,unknown=0,disabled=0)
 for device in devices.values():
  if device.disabled_by:dc['disabled']+=1;continue
  dc['total']+=1;values=grouped.get(device.id,[])
  if not values or all(v=='unknown' for v in values):dc['unknown']+=1
  elif all(v=='available' for v in values):dc['available']+=1
  elif all(v=='unavailable' for v in values):dc['unavailable']+=1
  else:dc['partial']+=1
 all_entries=hass.config_entries.async_entries()
 cp=counts(e for e in all_entries if e.domain=='cloudpelizzon')
 runtime=hass.data.get('cloudpelizzon',{})
 # A loaded connector is not evidence that all of its operations are working.
 cp['connectors']=[sku for key,sku in (('energy','CP-SOLAR'),('maintenance','CP-MAINTENANCE')) if isinstance(runtime,dict) and isinstance(runtime.get(key),dict)]
 # Module imports are evidence of installed components, not proof of engine operation.
 prefix=__package__ or 'custom_components.cloudpelizzon'
 definitions=(('CP-SOLAR',('adapters.solar',),'energy'),('CP-MAINTENANCE',('adapters.maintenance',),'maintenance'),('CP-SECURITY',('security','public_security'),None),('CP-AUTOMATION',('public_automation',),None),('CP-LIGHTING',('lighting','adapters.lighting','public_lighting','lighting_controls240'),None))
 inventory=[]
 for sku,paths,key in definitions:
  imported=any(prefix+'.'+path in sys.modules for path in paths)
  running=bool(key and isinstance(runtime,dict) and isinstance(runtime.get(key),dict) and cp['loaded'] and not cp['failed'] and not cp['pending'])
  interface=bool((sku in ('CP-SECURITY','CP-AUTOMATION') or sku=='CP-LIGHTING' and lighting_interface461(hass,prefix)) and imported and cp['loaded'] and not cp['failed'] and not cp['pending'])
  inventory.append({'sku':sku,'imported':imported,'state':'runtime_loaded' if running else 'interface_loaded' if interface else 'not_observed'})
 return {'schema':'cp.ha.telemetry437.v1','measured_at':int(time.time()),'ha_running':bool(hass.is_running),'entries':counts(all_entries),'cloudpelizzon':cp,'entities':dict(ec),'devices':dict(dc),'module_inventory443':inventory,'usage444':collect_usage(hass,devices,entities),'details447':collect_details447(hass,devices,entities)}

"""Classify usage independently of availability. Read-only registry metadata."""
from collections import Counter,defaultdict
import re

CONTROLS={'light','switch','cover','climate','fan','lock','alarm_control_panel','valve','humidifier','water_heater','media_player','camera','vacuum','lawn_mower','siren'}
SENSORS={'sensor','binary_sensor'}

def classify(entry,device,include_id=None,exclude_id=None):
    labels=set(getattr(entry,'labels',()) or ())|set(getattr(device,'labels',()) or ())
    if exclude_id and exclude_id in labels:return 'excluded_label'
    if include_id and include_id in labels:return 'monitored'
    category=getattr(entry,'entity_category',None)
    category=str(getattr(category,'value',category) or '')
    if category=='diagnostic':return 'diagnostic'
    if category=='config':return 'configuration'
    domain=entry.entity_id.partition('.')[0]
    if domain in CONTROLS:return 'monitored'
    if domain in SENSORS:
        return 'monitored' if getattr(entry,'area_id',None) or getattr(device,'area_id',None) else 'review'
    return 'auxiliary'

def collect_usage(hass,devices,entities):
    from homeassistant.helpers import label_registry as lr
    registry=lr.async_get(hass)
    include=registry.async_get_label_by_name('CP Monitorar')
    exclude=registry.async_get_label_by_name('CP Ignorar')
    include_id=include.label_id if include else None
    exclude_id=exclude.label_id if exclude else None
    totals=Counter(monitored=0,diagnostic=0,configuration=0,excluded_label=0,review=0,auxiliary=0)
    counts=Counter(total=0,available=0,unavailable=0,unknown=0)
    integrations=defaultdict(lambda:Counter(total=0,available=0,unavailable=0,unknown=0))
    for entity in entities.values():
        device=devices.get(entity.device_id) if entity.device_id else None
        if entity.disabled_by or (device and device.disabled_by):continue
        reason=classify(entity,device,include_id,exclude_id);totals[reason]+=1
        if reason!='monitored':continue
        # Unknown/unavailable entities remain in the denominator.
        state=hass.states.get(entity.entity_id)
        if state is None or state.state=='unknown' or state.attributes.get('assumed_state') is True:status='unknown'
        elif state.state=='unavailable':status='unavailable'
        else:status='available'
        counts['total']+=1;counts[status]+=1
        platform=getattr(entity,'platform','other')
        if not isinstance(platform,str) or not re.fullmatch('[a-z0-9_]{1,64}',platform) or platform=='remaining_444':platform='other'
        integrations[platform]['total']+=1;integrations[platform][status]+=1
    # Bound groups, retaining a disjoint partition of all selected entities.
    groups=sorted(integrations.items(),key=lambda r:(-(r[1]['unavailable']+r[1]['unknown']),r[0]))
    if len(groups)>20:
        rest=Counter(total=0,available=0,unavailable=0,unknown=0)
        for _,group in groups[19:]:rest.update(group)
        groups=groups[:19]+[('remaining_444',rest)]
    return {'schema':'cp.usage444.v1','policy':'operational_v1','selection':dict(totals),'entities':dict(counts),'integrations':[{'domain':domain,**dict(group)} for domain,group in groups]}

"""Technical IDs, availability counts and Backup integration timestamps only."""
from datetime import datetime

def collect_details447(hass,devices,entities):
    from homeassistant.helpers import label_registry as lr
    labels=lr.async_get(hass);include=labels.async_get_label_by_name('CP Monitorar');exclude=labels.async_get_label_by_name('CP Ignorar')
    groups=defaultdict(lambda:Counter(total=0,available=0,unavailable=0,unknown=0));issues=[];review=[]
    backup={'last_success_at':None,'last_attempt_at':None,'observed':False}
    for entry in sorted(entities.values(),key=lambda e:e.entity_id):
        device=devices.get(entry.device_id) if entry.device_id else None
        if entry.disabled_by or (device and device.disabled_by):continue
        state=hass.states.get(entry.entity_id)
        # Use registry platform + unique ID, so renaming entities is supported.
        if getattr(entry,'platform',None)=='backup' and state is not None:
            key={'last_successful_automatic_backup':'last_success_at','last_attempted_automatic_backup':'last_attempt_at'}.get(getattr(entry,'unique_id',None))
            if key:
                backup['observed']=True
                try:
                    dt=datetime.fromisoformat(state.state.replace('Z','+00:00'))
                    if dt.tzinfo is not None and 946684800<=dt.timestamp()<=time.time()+30:backup[key]=int(dt.timestamp())
                except (ValueError,TypeError,OverflowError):pass
        reason=classify(entry,device,include.label_id if include else None,exclude.label_id if exclude else None)
        if reason=='review' and len(review)<50:review.append(entry.entity_id)
        if reason!='monitored':continue
        status='unknown' if state is None or state.state=='unknown' or state.attributes.get('assumed_state') is True else 'unavailable' if state.state=='unavailable' else 'available'
        domain=entry.entity_id.partition('.')[0];groups[domain]['total']+=1;groups[domain][status]+=1
        origin=getattr(entry,'platform','other')
        if not isinstance(origin,str) or not re.fullmatch('[a-z0-9_]{1,64}',origin):origin='other'
        if status!='available' and len(issues)<200:issues.append({'entity_id':entry.entity_id,'origin':origin,'status':status})
    return {'schema':'cp.details447.v1','kinds':[{'domain':domain,**dict(group)} for domain,group in sorted(groups.items())],'issues':issues,'review_examples':review,'backup':backup}

# CP_LIGHTING461: observe registered API only; never call a control handler.
def lighting_interface461(hass,prefix):
 from homeassistant.components import websocket_api
 registry=hass.data.get(websocket_api.DOMAIN,{})
 handler=registry.get('cloudpelizzon/lighting/control240') if isinstance(registry,dict) else None
 return prefix+'.lighting_controls240' in sys.modules and isinstance(handler,(tuple,list)) and bool(handler) and callable(handler[0])

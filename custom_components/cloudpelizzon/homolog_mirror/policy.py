"""Bounded production-state sanitization; no HA or network dependency."""
import re
STORE='cloudpelizzon_homolog_mirror130'
DOMAIN='cloudpelizzon_homolog_mirror'
SOURCE_CONTROL_ENTITIES={'alarm_control_panel.cloudpelizzon_security'}
ALLOWED={'sensor','binary_sensor','automation','person','device_tracker','zone','group','light','switch','cover','alarm_control_panel','siren','camera','climate','fan','input_boolean','input_number','input_select','input_text','input_datetime','sun','weather','number','select'}
ATTRS={'friendly_name','icon','device_class','state_class','unit_of_measurement','supported_features','options','min','max','step','mode','last_triggered','latitude','longitude','gps_accuracy','source_type','radius','persons','entity_id','battery_level','temperature','current_temperature','humidity','brightness','color_mode','color_temp_kelvin','percentage','current_position','hvac_modes','preset_modes','attribution','code_format','code_arm_required'}
def valid_id(eid):
 return isinstance(eid,str) and len(eid)<256 and bool(re.fullmatch(r'[a-z_]+\.[a-z0-9_]+',eid)) and eid.split('.')[0] in ALLOWED and (eid in SOURCE_CONTROL_ENTITIES or not any(x in eid.lower() for x in ('cloudpelizzon','cp_license','cp_trial','cp_core')))
def clean(row):
 if not isinstance(row,dict) or not valid_id(row.get('entity_id')):return None
 value=row.get('state');attrs=row.get('attributes',{})
 if not isinstance(value,str) or len(value)>255 or not isinstance(attrs,dict) or attrs.get('cloudpelizzon_read_only') is True:return None
 out={}
 for k,v in attrs.items():
  if k not in ATTRS:continue
  if isinstance(v,(str,int,float,bool)) or v is None:
   if not isinstance(v,str) or len(v)<=1000:out[k]=v
  elif isinstance(v,list) and len(v)<=256 and all(isinstance(x,(str,int,float,bool)) and len(str(x))<256 for x in v):out[k]=v
 out.update(cloudpelizzon_read_only=True,mirror_source='production_observer',mirror_original_entity_id=row['entity_id'])
 return row['entity_id'],value,out

def outgoing(kind,**kw):
 """The only application-level messages permitted on the source connection."""
 if kind=='auth':return {'type':'auth','access_token':kw['token']}
 if kind not in {'get_states','subscribe_events','config/device_registry/list','config/entity_registry/list'}:raise ValueError('production_write_denied')
 out={'id':kw['id'],'type':kind}
 if kind=='subscribe_events':out['event_type']='state_changed'
 return out

def source_url(value):
 from urllib.parse import urlsplit
 import ipaddress
 peer=urlsplit(value.strip())
 if peer.scheme not in {'http','https'} or peer.username or peer.password or peer.query or peer.fragment or peer.path not in {'','/'}:raise ValueError('invalid_source')
 ip=ipaddress.ip_address(peer.hostname)
 if ip.version!=4 or not ip.is_private or ip.is_loopback or ip.is_multicast or ip.is_unspecified:raise ValueError('private_source_required')
 port=peer.port or (443 if peer.scheme=='https' else 80)
 return f'{peer.scheme}://{ip}:{port}/api/websocket'
def check_peer(url,expected):
 from urllib.parse import urlsplit
 peer=urlsplit(url);wanted=urlsplit(expected)
 if peer.hostname!=wanted.hostname or peer.port!=wanted.port or peer.scheme!=wanted.scheme or peer.path!='/api/websocket':raise ValueError('source_redirect_denied')

def deny_read_only_targets(hass,data):
 targets=data.get('entity_id',[])
 if isinstance(targets,str):targets=[targets]
 for eid in targets or []:
  state=hass.states.get(eid)
  if state is not None and state.attributes.get('cloudpelizzon_read_only') is True:raise PermissionError('production_mirror_read_only')

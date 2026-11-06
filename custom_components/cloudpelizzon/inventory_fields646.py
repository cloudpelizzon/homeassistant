"""Public registration validation; no discovery, architecture or paid engine."""
import base64,datetime,ipaddress,re
from decimal import Decimal,InvalidOperation,ROUND_HALF_UP
from zoneinfo import ZoneInfo

CATEGORIES={'unknown':'Não definido','router':'Roteador','switch':'Switch','access_point':'Ponto Wi-Fi','computer':'Computador','server':'Servidor','storage':'Armazenamento','bridge':'Coordenador','television':'Televisão','camera':'Câmera','printer':'Impressora','phone':'Telefone','speaker':'Áudio','sensor':'Sensor','actuator':'Atuador','ups':'Nobreak','virtual_machine':'Máquina virtual','container':'Contêiner','other':'Outro'}
TEXT=set('name manufacturer model serial notes device_type connection_protocol service_host mac asset_tag supplier supplier_contact invoice site location location_mode location_area_id rack owner department hostname operating_system firmware vlan lifecycle criticality ip_mode612 icon_key primary_ip purchase_date warranty_start warranty_until support_until current_value_mode'.split())
DATE_FIELDS={'purchase_date','warranty_start','warranty_until','support_until'}
ENUMS={'connection_protocol':{'','wifi','wired','zigbee','zwave','matter','thread','bluetooth','fiber','virtual'},'ip_mode612':{'auto','manual'},'location_mode':{'ha','ha_area','manual'},'lifecycle':{'in_service','stock','maintenance','retired'},'criticality':{'low','normal','high','critical'},'current_value_mode':{'calculated','manual'}}

def image(value,maximum):
 if value=='':return ''
 if not isinstance(value,str) or len(value)>maximum:raise ValueError('invalid_asset_photo')
 match=re.fullmatch(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)',value)
 if not match:raise ValueError('invalid_asset_photo')
 try:raw=base64.b64decode(match[2],validate=True)
 except Exception as exc:raise ValueError('invalid_asset_photo') from exc
 if not ((match[1]=='png' and raw.startswith(b'\x89PNG\r\n\x1a\n')) or (match[1]=='jpeg' and raw.startswith(b'\xff\xd8\xff')) or (match[1]=='webp' and raw.startswith(b'RIFF') and raw[8:12]==b'WEBP')):raise ValueError('invalid_asset_photo')
 return value

def clean(values):
 if not isinstance(values,dict):raise ValueError('invalid_device_fields')
 result={}
 for key,value in values.items():
  if key in TEXT:
   maximum=2000 if key=='notes' else 253 if key=='service_host' else 160
   if not isinstance(value,str) or len(value)>maximum:raise ValueError('invalid_device_fields')
   result[key]=value.strip()
   if key in DATE_FIELDS and value:datetime.date.fromisoformat(value)
   if key in ENUMS and value and value not in ENUMS[key]:raise ValueError('invalid_device_fields')
  elif key=='category':
   if value not in CATEGORIES:raise ValueError('invalid_category')
   result[key]=value
  elif key in ('purchase_value','current_value','depreciation_percent'):
   if value=='':result[key]='';continue
   try:amount=Decimal(str(value).replace(',','.'))
   except InvalidOperation as exc:raise ValueError('invalid_'+key) from exc
   if not amount.is_finite() or not 0<=amount<=(100 if key=='depreciation_percent' else 1000000000):raise ValueError('invalid_'+key)
   result[key]=str(amount.quantize(Decimal('.01'),rounding=ROUND_HALF_UP))
  elif key in ('service_port','port_count'):
   if value=='':result[key]='';continue
   if isinstance(value,bool) or not re.fullmatch(r'[0-9]{1,5}',str(value)) or not 1<=int(value)<=(65535 if key=='service_port' else 1024):raise ValueError('invalid_'+key)
   result[key]=str(int(value))
  elif key=='ip_addresses':
   if not isinstance(value,list) or len(value)>32:raise ValueError('invalid_asset_addresses')
   result[key]=list(dict.fromkeys(str(ipaddress.ip_address(v)) for v in value))
  elif key in ('photo','icon_image'):result[key]=image(value,174790 if key=='photo' else 65000)
  else:raise ValueError('invalid_device_fields')
 if 'name' in result and not result['name']:raise ValueError('name_required')
 if result.get('primary_ip'):result['primary_ip']=str(ipaddress.ip_address(result['primary_ip']))
 if result.get('mac'):
  mac=re.sub('[:-]','',result['mac']).lower()
  if not re.fullmatch('[0-9a-f]{12}',mac):raise ValueError('invalid_mac')
  result['mac']=':'.join(mac[i:i+2] for i in range(0,12,2))
 if result.get('service_host') and (re.search(r'[\s/<>"\x00-\x1f]',result['service_host']) or '://' in result['service_host']):raise ValueError('invalid_service_host')
 return result

def validate_complete(attrs):
 if attrs.get('service_port') and not attrs.get('service_host'):raise ValueError('service_host_required')

def current_value(attrs,today):
 if attrs.get('current_value_mode','calculated')=='manual':return attrs.get('current_value','')
 if any(attrs.get(k,'')=='' for k in ('purchase_value','depreciation_percent','purchase_date')):return ''
 acquired=datetime.date.fromisoformat(attrs['purchase_date']);day=min(acquired.day,28) if acquired.month==2 and acquired.day==29 and not (today.year%4==0 and (today.year%100!=0 or today.year%400==0)) else acquired.day
 anniversary=datetime.date(today.year,acquired.month,day);years=max(0,today.year-acquired.year-(today<anniversary))
 amount=Decimal(attrs['purchase_value'])*(1-Decimal(attrs['depreciation_percent'])/100)**years
 return str(amount.quantize(Decimal('.01'),rounding=ROUND_HALF_UP))

def today(hass):
 try:return datetime.datetime.now(ZoneInfo(hass.config.time_zone)).date()
 except (AttributeError,TypeError):return datetime.date.today()

def classify(device,entities):
 """Prefer explicit HA entities; use names only when no useful class exists."""
 rows=[e for e in entities if not getattr(e,'disabled_by',None)];domains={e.entity_id.split('.')[0] for e in rows};classes={getattr(e,'device_class',None) or getattr(e,'original_device_class',None) for e in rows}
 for domain,category,icon in [('camera','camera','camera'),('climate','actuator','air_conditioner'),('light','actuator','bulb'),('cover','actuator','zigbee_curtain'),('media_player','speaker','speaker'),('switch','actuator','wifi_relay')]:
  if domain in domains:
   label=' '.join(str(getattr(device,k,'') or '') for k in ('name_by_user','name','manufacturer','model')).casefold()
   if domain=='media_player' and any(v in label for v in ('tv','television','televis','series')):return 'television','television'
   if domain=='cover' and (classes&{'garage','gate'} or any(v in label for v in ('portão','portao','garagem','garage'))):return 'actuator','gate'
   return category,icon
 for names,category,icon in [(('pbs','backup server'),'server','pbs'),(('proxmox','pve'),'server','proxmox'),(('server','servidor'),'server','server'),(('truenas','nas'),'storage','nas'),(('router','roteador'),'router','router'),(('switch','comutador'),'switch','switch_24'),(('camera','câmera'),'camera','camera'),(('notebook','laptop'),'computer','laptop'),(('television','televis','samsung tv'),'television','television'),(('impressora','printer'),'printer','printer'),(('nobreak','ups'),'ups','ups'),(('toalheiro',),'actuator','towel_warmer'),(('nível da caixa','nivel da caixa','water level'),'sensor','water_level')]:
  label=' '.join(str(getattr(device,k,'') or '') for k in ('name_by_user','name','manufacturer','model')).casefold()
  if any(n in label for n in names):return category,icon
 for kinds,icon in [({'temperature','humidity'},'zigbee_temperature'),({'moisture'},'zigbee_leak'),({'smoke'},'zigbee_smoke'),({'door','window','opening'},'zigbee_contact'),({'motion','occupancy','presence'},'motion')]:
  if classes&kinds:return 'sensor',icon
 if domains&{'sensor','binary_sensor'}:return 'sensor','motion'
 return 'unknown','iot'

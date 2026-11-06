"""Shared Free workspace round trips and hostile/boundary cases."""
from pathlib import Path
import runpy,asyncio,copy,types,datetime,base64
fixture=runpy.run_path(str(Path(__file__).with_name('test_inventory_free632.py')));m=fixture['m']
from free_fixture646.inventory_fields646 import classify,current_value

async def run():
 s=m.LimitedInventory(None);await s.load()
 values={'name':'Câmera do exemplo','category':'camera','manufacturer':'Fabricante','model':'Modelo','primary_ip':'192.0.2.30','mac':'aa-bb-cc-dd-ee-ff','ip_addresses':['192.0.2.31'],'serial':'S1','supplier':'Fornecedor','supplier_contact':'Contato','invoice':'NF-100','purchase_value':'1000,00','depreciation_percent':'10','current_value_mode':'calculated','purchase_date':'2024-01-01','warranty_until':'2028-01-01','site':'Casa','location':'Sala','location_mode':'manual','owner':'Responsável','department':'Residencial','hostname':'camera','operating_system':'Embarcado','firmware':'1.0','vlan':'20','criticality':'high','lifecycle':'in_service','service_host':'192.0.2.30','service_port':'443','port_count':'1','icon_key':'camera','notes':'Observação'}
 aid=(await s.command('device.create',{'device':values}))['asset_id'];d=await s.command('device.get',{'id':aid});a=d['attributes'];assert a['mac']=='aa:bb:cc:dd:ee:ff' and a['asset_tag']=='CP-EQ-0001' and d['primary_ip']=='192.0.2.30' and a['supplier']=='Fornecedor' and d['manual_addresses']==['192.0.2.31']
 assert current_value(a,datetime.date(2026,1,1))=='810.00'
 house={'floors':[{'id':'f','name':'Andar','width_m':8}],'rooms':[{'area_id':'plan-'+str(i),'name':'Cômodo '+str(i),'floor_id':'f','width_m':4,'depth_m':4,'x':i,'y':0,'furniture':[{'id':'sofa','type':'sofa','x':.4,'y':.4,'width_m':2,'depth_m':.8,'rotation':0}],'device_positions':{aid:{'x':.2,'y':.2,'surface':'top','height_m':2.4}} if i==0 else {}} for i in range(2)]}
 async def write(op,args):return await s.command(op,{**args,'free_revision':s.revision})
 await write('settings.save',{'settings':{'house':house}});assert s.snapshot({})['settings']['house']==house
 for invalid in [{**house,'rooms':house['rooms']+[dict(house['rooms'][0],area_id='plan-third')]},{**house,'rooms':[dict(house['rooms'][0],device_positions={'foreign':{}})]}]:
  before=copy.deepcopy(s.workspace.data)
  try:await write('settings.save',{'settings':{'house':invalid}})
  except ValueError:pass
  else:raise AssertionError('room quota/foreign asset bypass')
  assert s.workspace.data==before
 second=(await s.command('device.create',{'device':{'name':'TV do exemplo','category':'television'}}))['asset_id']
 await write('map.link',{'parent':aid,'child':second,'medium':'wifi'});assert s.topology()['summary']['links']==1
 await write('map.node.position',{'id':aid,'x':-200,'y':500});assert s.topology()['positions'][aid]['x']==-200
 await write('map.undo',{});assert s.topology()['positions'][aid]['x']!=-200
 for op in ('documents.upload.start','documents.list','scan.start','maintenance.rule','map.sync','report'):
  try:await s.command(op,{})
  except PermissionError:pass
  else:raise AssertionError('paid operation accepted: '+op)
 for bad in [{'photo':'data:image/svg+xml;base64,PHN2Zz4='},{'purchase_value':'NaN'},{'mac':'invalid'},{'asset_tag':'CP-EQ-0099'}]:
  previous=copy.deepcopy(s.assets)
  try:await s.command('device.edit',{'id':aid,'values':bad})
  except ValueError:pass
  else:raise AssertionError('invalid registration accepted')
  assert s.assets==previous
 s.store.fail=True;before=copy.deepcopy(s.workspace.data)
 try:await write('settings.save',{'settings':{'house':dict(house,rooms=[])}})
 except OSError:pass
 else:raise AssertionError('failed house write accepted')
 assert s.workspace.data==before
 s.store.fail=False;restored=m.LimitedInventory(None);restored.store.value=copy.deepcopy(s.store.value);await restored.load();assert restored.workspace.data==s.workspace.data
 import gzip
 model=await s.command('catalog.model',{'id':'renault_duster585'});assert model['format']=='glb' and gzip.decompress(base64.b64decode(model['gzip'])).startswith(b'glTF')
 legacy=copy.deepcopy(s.store.value);legacy.pop('workspace646');legacy['map']['rooms']=[{'id':'old-'+str(i),'name':'Ambiente antigo '+str(i),'width':3,'depth':4} for i in range(3)];legacy['map']['placements']={aid:{'room':'old-0','x':20,'y':30}}
 migrated=m.LimitedInventory(None);migrated.store.value=legacy;await migrated.load();assert len(migrated.workspace.data['house']['rooms'])==2 and len(migrated.workspace.data['retained_rooms'])==1 and len(migrated.assets)==2
 assert migrated.workspace.data['house']['rooms'][0]['device_positions'][aid]['x']==.2
 device=types.SimpleNamespace(name='Smart Camera',name_by_user=None,manufacturer='Tuya',model='Camera')
 assert classify(device,[types.SimpleNamespace(entity_id='camera.example',device_class=None,original_device_class=None,disabled_by=None)])==('camera','camera')
 for name,category in [('Roteador','router'),('Switch da sala','switch'),('Proxmox PVE','server'),('Notebook','computer')]:assert classify(types.SimpleNamespace(name=name),[])[0]==category

asyncio.run(run());print('WORKSPACE646=PASS: complete registration, two rooms, shared map persistence, icon evidence, paid documents blocked')

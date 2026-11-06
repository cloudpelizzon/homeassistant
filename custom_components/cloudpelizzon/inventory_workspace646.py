"""Bounded storage for the shared Inventory UI, without commercial engines."""
import copy,json,math,uuid,re
from .inventory_fields646 import CATEGORIES,clean,current_value,today,validate_complete

class Workspace:
 reads={'types.list','catalog.photos','catalog.photo','catalog.model'}
 writes={'settings.save','types.save','device.duplicate','device.reparent','map.link','map.links.batch','map.edge.remove','map.edge.medium','map.node.position','map.nodes.position','map.position','topology.layout','topology.hub.layout','topology.undo','map.undo','catalog.photo.upload'}
 def __init__(self,state):self.owner=state;self.data={'house':{'floors':[],'rooms':[]},'undo':[],'map_undo':[],'types':[],'photos':[]}
 def load(self,value):
  if 'workspace646' in value:
   self.data=copy.deepcopy(value['workspace646'])
   if len(self.data['house']['rooms'])>2:self.data['retained_rooms']=self.data.get('retained_rooms',[])+self.data['house']['rooms'][2:];self.data['house']['rooms']=self.data['house']['rooms'][:2]
   self.house(self.data['house']);return
  old=self.owner.map
  if old['rooms']:
   self.data['house']['floors']=[{'id':'free-floor','name':'1º andar','width_m':12,'orientation':'vertical','order':0}]
   for i,r in enumerate(old['rooms']):
    aid='plan-free-'+r['id'];positions={k:{'x':p['x']/100,'y':p['y']/100,'surface':'floor','height_m':.75} for k,p in old['placements'].items() if p['room']==r['id']}
    self.data['house']['rooms'].append({'area_id':aid,'name':r['name'],'label':r['name'],'floor_id':'free-floor','kind':'living','x':i,'y':0,'x_m':i*5,'y_m':0,'width_m':r['width'],'depth_m':r['depth'],'area_m2':r['width']*r['depth'],'height_m':2.6,'device_positions':positions,'furniture':[],'openings':[]})
    for did in positions:self.owner.assets[did]['attributes'].update(location_mode='manual',location=r['name'],free_room646=aid)
   if len(self.data['house']['rooms'])>2:self.data['retained_rooms']=self.data['house']['rooms'][2:];self.data['house']['rooms']=self.data['house']['rooms'][:2]
 def house(self,value):
  if not isinstance(value,dict) or not isinstance(value.get('rooms'),list) or not isinstance(value.get('floors'),list) or len(value['rooms'])>2 or len(value['floors'])>3:raise ValueError('free_room_limit')
  def safe(v,depth=0):
   if depth>14:raise ValueError('invalid_house_configuration')
   if isinstance(v,dict):
    if len(v)>100:raise ValueError('invalid_house_configuration')
    for k,x in v.items():
     if not isinstance(k,str) or len(k)>80 or k in ('__proto__','constructor','prototype'):raise ValueError('invalid_house_configuration')
     safe(x,depth+1)
   elif isinstance(v,list):
    if len(v)>100:raise ValueError('invalid_house_configuration')
    for x in v:safe(x,depth+1)
   elif isinstance(v,str):
    if v.startswith('data:image/'):
     from .inventory_fields646 import image
     image(v,174790)
    elif len(v)>2000 or '<script' in v.lower():raise ValueError('invalid_house_configuration')
   elif isinstance(v,(int,float)) and not isinstance(v,bool):
    if not math.isfinite(v) or abs(v)>100000:raise ValueError('invalid_house_configuration')
   elif v is not None and not isinstance(v,bool):raise ValueError('invalid_house_configuration')
  safe(value);floors={f.get('id') for f in value['floors'] if isinstance(f,dict)};rooms=set()
  if len(floors)!=len(value['floors']) or any(not isinstance(k,str) or not k for k in floors):raise ValueError('invalid_house_configuration')
  for r in value['rooms']:
   aid=r.get('area_id')
   if not isinstance(aid,str) or not aid or aid in rooms or r.get('floor_id') not in floors:raise ValueError('invalid_house_room')
   rooms.add(aid)
   for k in ('width_m','depth_m'):
    if not isinstance(r.get(k),(float,int)) or not .2<=r[k]<=100:raise ValueError('invalid_room_dimensions')
   if len(r.get('furniture',[]))>80 or len(r.get('openings',[]))>32:raise ValueError('invalid_house_room')
   if set(r.get('device_positions',{}))-set(self.owner.assets):raise ValueError('invalid_room_device_position')
  return copy.deepcopy(value)
 def types(self):return [{'id':k,'name':v,'category':k,'group':'Equipamentos','protocol':''} for k,v in CATEGORIES.items()]+self.data['types']
 def finalize(self):
  tags={};macs={};self.data.setdefault('used_tags',[]);owners=self.data.setdefault('tag_owners',{});sequence=self.data.get('sequence',0)
  for d in self.owner.assets.values():
   a=d['attributes'];tag=a.get('asset_tag','')
   if not tag and d.get('category') not in ('virtual_machine','container','unknown'):
    while True:
     sequence+=1
     if sequence>9999:raise ValueError('asset_sequence_exhausted')
     tag='CP-EQ-'+str(sequence).zfill(4)
     if tag not in self.data['used_tags']:break
    a['asset_tag']=tag
   if tag:
    if tag in tags or tag in owners and owners[tag]!=d['id']:raise ValueError('asset_tag_already_used')
    tags[tag]=d['id']
    owners[tag]=d['id']
    if tag not in self.data['used_tags']:self.data['used_tags'].append(tag)
   mac=a.get('mac')
   if mac and mac in macs:raise ValueError('identity_conflict')
   if mac:macs[mac]=d['id']
   d['addresses']=list(dict.fromkeys(([a['primary_ip']] if a.get('primary_ip') else [])+a.get('ip_addresses',[])))
  self.data['sequence']=sequence
  active=set(self.owner.assets)
  for room in self.data['house']['rooms']:room['device_positions']={k:v for k,v in room.get('device_positions',{}).items() if k in active}
 def present(self,d):
  d=copy.deepcopy(d);a=d.setdefault('attributes',{});d.update(primary_ip=a.get('primary_ip',''),manual_addresses=a.get('ip_addresses',[]),identifiers=[{'kind':'mac','value':a['mac']}] if a.get('mac') else [],photo=a.get('photo',''),icon_image=a.get('icon_image',''))
  if d.get('category')=='unknown' and not a.get('icon_key'):
   from .inventory_fields646 import classify
   from types import SimpleNamespace
   category,icon=classify(SimpleNamespace(**d),[]);d['category']=category;a['icon_key']=icon;a['device_type']=category
  a['current_value']=current_value(a,today(self.owner.hass));return d
 def snapshot(self,result):
  result['devices']=[self.present(d) for d in result['devices']];result['device_types']=self.types();result['device_type_groups']=['Equipamentos','Personalizados'];result['free_revision']=self.owner.revision
  result['settings'].update(house=copy.deepcopy(self.data['house']),house_undo_count=len(self.data['undo']),topology_can_undo=bool(self.data['map_undo']),free_revision=self.owner.revision)
  return result
 def topology(self):
  s=self.owner;nodes=[{'id':d['id'],'label':d['name'],'category':d.get('category','unknown'),'observed':d.get('available'),'last_seen':d.get('last_seen',0),'position':None} for d in s.assets.values()];edges=[{**e,'id':'free-'+str(i),'kind':'connected_to','confidence':'manual'} for i,e in enumerate(s.map['links'])];positions={d['id']:s.map['positions'].get(d['id'],{'x':150+i%4*240,'y':120+i//4*230}) for i,d in enumerate(nodes)}
  meta={d['id']:{'component':0,'depth':0,'degree':sum(d['id'] in (e['source'],e['target']) for e in edges),'root':not any(e['source']==d['id'] for e in edges)} for d in nodes}
  presentation={d['id']:{'icon_key':d['attributes'].get('icon_key',''),'icon_image':d['attributes'].get('icon_image',''),'port_count':d['attributes'].get('port_count',''),'display_name':d['name'],'primary_ip':d['attributes'].get('primary_ip',''),'ip_addresses':d.get('addresses',[]),'service_address':d['attributes'].get('service_host',''),'link_protocols':[d['attributes']['connection_protocol']] if d['attributes'].get('connection_protocol') else [],'device_type_label':CATEGORIES.get(d.get('category'),'Equipamento')} for d in map(self.present,s.assets.values())}
  rooms=[];assigned=set()
  for r in self.data['house']['rooms']:
   ids=[d['id'] for d in s.assets.values() if d['id'] in r.get('device_positions',{}) or d['attributes'].get('free_room646')==r['area_id'] or d['attributes'].get('location_area_id')==r['area_id'] or d['attributes'].get('location') in (r.get('name'),r.get('label'))]
   assigned.update(ids)
   # Plan-only rooms are added by the shared renderer, so include occupied rooms here.
   rooms.append({'id':r['area_id'],'name':r.get('label') or r.get('name') or 'Cômodo','floor_id':r['floor_id'],'floor_name':'','source':'manual','devices':ids})
  # Plan-only rooms are supplied through settings.house; avoid duplicate IDs in the renderer.
  if nodes:rooms.append({'id':'unassigned','name':'Sem cômodo definido','floor_id':'','floor_name':'','source':'unassigned','devices':[d['id'] for d in nodes if d['id'] not in assigned]})
  return {'schema':'cp.inventory.topology.v1','free_revision':s.revision,'document':{'schema':'cp.inventory.graph.v1','core_id':'','generated_at':0,'nodes':nodes,'edges':edges},'orientation':'vertical','positions':positions,'nodes':meta,'routes':[],'components':[{'id':0,'nodes':[n['id'] for n in nodes],'roots':[k for k,v in meta.items() if v['root']],'levels':1,'isolated':not edges,'x':0,'y':0,'width':1100}],'summary':{'devices':len(nodes),'links':len(edges),'components':1 if nodes else 0,'isolated':sum(not v['degree'] for v in meta.values()),'coverage':100 if edges else 0,'confirmed':0,'inferred':0,'manual':len(edges)},'hubs':[],'placement_is_not_evidence':True,'discovered_ids':[],'virtual_ids':[],'actual_devices':len(nodes),'view_kind':'observed','detected_networks':[],'logical_stats':{},'presentation':presentation,'edge_media':{e['id']:('wired' if e['medium']=='ethernet' else e['medium']) for e in edges},'edge_medium_modes':{},'mesh_edge_ids544':[],'hidden_map_nodes':[],'map_undo_count':len(self.data['map_undo']),'room_device_nodes':nodes,'rooms':rooms,'width':1100,'height':850}
 async def read(self,op,args):
  if op=='catalog.model':
   from pathlib import Path
   key=args.get('id')
   allowed={'renault_duster585','chevrolet_equinox585','vw_tcross585','vw_golf585','renault_logan585','chevrolet_s10585','byd_dolphin585','byd_seal585','chery_tiggo585','toyota_prius585'}
   if key not in allowed:raise PermissionError('inventory_full_license_required')
   def load():
    raw=(Path(__file__).parent/'ui/inventory/assets646'/(key+'.js')).read_text(encoding='utf8')
    if not raw.startswith('export default ') or not raw.endswith(';\n'):raise ValueError('invalid_public_model')
    return json.loads(raw[15:-2])
   if self.owner.hass is not None and hasattr(self.owner.hass,'async_add_executor_job'):return await self.owner.hass.async_add_executor_job(load)
   return load()
  if op=='types.list':return self.types()
  if op=='catalog.photos':return [{k:v for k,v in p.items() if k!='image'} for p in self.data['photos']]
  if op=='catalog.photo':
   p=next((p for p in self.data['photos'] if p['id']==args.get('id')),None)
   if p is None:raise ValueError('photo_not_found')
   return {**copy.deepcopy(p),'src':p['image']}
 async def write(self,op,args):
  s=self.owner
  if op=='settings.save' and (not isinstance(args.get('settings'),dict) or not args['settings'] or set(args['settings'])-{'house','house_undo'}):raise PermissionError('inventory_full_license_required')
  if type(args.get('free_revision')) is not int or args['free_revision']!=s.revision:raise ValueError('inventory_revision_changed')
  if op=='settings.save':
   values=args.get('settings',{})
   if set(values)-{'house','house_undo'} or not values:raise PermissionError('inventory_full_license_required')
   if args.get('free_revision')!=s.revision:raise ValueError('inventory_revision_changed')
   if values.get('house_undo'):
    if not self.data['undo']:raise ValueError('map_undo_empty')
    self.data['house']=self.data['undo'].pop()
   else:
    house=self.house(values.get('house'));self.data['undo']=(self.data['undo']+[copy.deepcopy(self.data['house'])])[-5:];self.data['house']=house
   return {'house':copy.deepcopy(self.data['house']),'house_undo_count':len(self.data['undo'])}
  if op=='types.save':
   v=args.get('device_type',{});name=v.get('name','');category=v.get('category')
   if not isinstance(name,str) or not 1<=len(name.strip())<=80 or category not in CATEGORIES or len(self.data['types'])>=30:raise ValueError('invalid_device_type')
   item={'id':'custom-'+uuid.uuid4().hex,'name':name.strip(),'category':category,'group':'Personalizados','protocol':str(v.get('protocol',''))[:20]};self.data['types'].append(item);return {'id':item['id'],'types':self.types(),'groups':['Equipamentos','Personalizados']}
  if op=='device.duplicate':
   if len(s.assets)>=10:raise PermissionError('device_limit_reached')
   original=s.assets.get(args.get('id'))
   if original is None:raise ValueError('device_not_found')
   values=clean(args.get('values',{}));d=copy.deepcopy(original);d['id']=uuid.uuid4().hex;d['name']=values.pop('name',d['name']+' · cópia')
   for field in ('category','manufacturer','model'):
    if field in values:d[field]=values.pop(field)
   d['attributes']={k:v for k,v in d['attributes'].items() if k not in ('mac','primary_ip','asset_tag','ip_addresses','ha_device_id','free_room646')};d['attributes'].update(values);d['addresses']=[];d['sources']=['manual'];s.assets[d['id']]=d;return {'asset_id':d['id']}
  if op=='catalog.photo.upload':
   from .inventory_fields646 import image
   p=args.get('photo',{});data=image(p.get('image'),174790)
   width,height=float(p.get('width_m',1)),float(p.get('height_m',1))
   if not data or any(not math.isfinite(v) or not .01<=v<=50 for v in (width,height)):raise ValueError('invalid_asset_photo')
   if len(self.data['photos'])>=30:raise ValueError('photo_limit')
   row={'id':'photo-'+uuid.uuid4().hex,'label':str(p.get('label','Foto do objeto'))[:80],'width_m':width,'height_m':height,'image':data};self.data['photos'].append(row);return {'id':row['id']}
  if op in ('topology.undo','map.undo'):
   if not self.data['map_undo']:raise ValueError('map_undo_empty')
   s.map=self.data['map_undo'].pop();return self.topology()
  self.data['map_undo']=(self.data['map_undo']+[copy.deepcopy(s.map)])[-5:]
  if op in ('map.node.position','map.position','map.nodes.position'):
   rows=args.get('positions',[args])
   if not isinstance(rows,list) or len(rows)>10:raise ValueError('invalid_position')
   for p in rows:
    if p.get('id') not in s.assets:raise ValueError('device_not_found')
    x,y=p.get('x'),p.get('y')
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or abs(v)>10000 for v in (x,y)):raise ValueError('invalid_position')
    s.map['positions'][p['id']]={'x':x,'y':y}
  elif op in ('topology.layout','topology.hub.layout'):
   s.map['positions']={aid:{'x':150+i%4*240,'y':120+i//4*230} for i,aid in enumerate(s.assets)}
  elif op in ('map.link','device.reparent','map.links.batch'):
   parent=args.get('parent');children=args.get('children',[args.get('child') or args.get('id')]);medium=args.get('medium','unknown');medium='ethernet' if medium=='wired' else 'unknown' if medium=='auto' else medium
   if not isinstance(children,list) or len(children)>10:raise ValueError('invalid_link')
   if medium not in ('ethernet','wifi','zigbee','zwave','matter','thread','bluetooth','fiber','virtual','logical','unknown'):raise ValueError('invalid_link')
   for child in children:
    if parent not in s.assets or child not in s.assets or parent==child:raise ValueError('invalid_link')
    s.map['links']=[e for e in s.map['links'] if {e['source'],e['target']}!={child,parent}];s.map['links'].append({'source':child,'target':parent,'medium':medium})
   if len(s.map['links'])>45:raise ValueError('invalid_link')
  elif op in ('map.edge.remove','map.edge.medium'):
   match=re.fullmatch(r'free-([0-9]+)',str(args.get('id','')));index=int(match[1]) if match else -1
   if not 0<=index<len(s.map['links']):raise ValueError('invalid_link')
   if op=='map.edge.remove':s.map['links'].pop(index)
   else:
    medium=args.get('medium');medium='ethernet' if medium=='wired' else medium
    if medium not in ('ethernet','wifi','zigbee','unknown'):raise ValueError('invalid_link')
    s.map['links'][index]['medium']=medium
  else:raise PermissionError('inventory_full_license_required')
  return self.topology()

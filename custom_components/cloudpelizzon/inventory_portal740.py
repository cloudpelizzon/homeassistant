"""Normalize derived link IDs only in the authorized visual export."""
import copy,hashlib,re

_ID=re.compile(r'[0-9a-f]{32}')
def normalize_topology(value):
    result=copy.deepcopy(value)
    edges=result.get('document',{}).get('edges',[])
    originals=[e['id'] for e in edges]
    if len(originals)!=len(set(originals)):
        raise ValueError('duplicate_export_edge_id')
    mapping={key:hashlib.sha256(('cp.inventory.export.edge.v1:'+key).encode()).hexdigest()[:32] for key in originals if isinstance(key,str) and not _ID.fullmatch(key)}
    if len(set(mapping.values())|{key for key in originals if key not in mapping})!=len(originals):
        raise ValueError('export_edge_id_collision')
    def walk(item,field=''):
        if isinstance(item,dict):
            return {mapping.get(key,key):walk(child,key) for key,child in item.items()}
        if isinstance(item,list):
            return [walk(child,field) for child in item]
        if isinstance(item,str) and field in {'id','edge_id','edge','edge_ids','mesh_edge_ids544'}:
            return mapping.get(item,item)
        return item
    return walk(result)

class ExportView:
    def __init__(self,engine):self.engine=engine
    def __getattr__(self,name):return getattr(self.engine,name)
    def topology_result(self,*args,**kwargs):return normalize_topology(self.engine.topology_result(*args,**kwargs))

def install(runtime,namespace):
    engine=runtime.engine
    if getattr(engine,'_portal740',False):return
    visual=namespace.load('cp_inventory/visual618.py')
    from .inventory_brand748 import validate_brands,add_brands
    original_validate=visual.validate
    visual.validate=lambda document:validate_brands(document,original_validate)
    view=ExportView(engine)
    def export(aliases=None):
        # The signed builder and outbox still verify license, consent and full schema.
        document=add_brands(visual.build(view),engine.store)
        return {'sequence':engine.maps.enqueue(document),'map':document}
    engine.map_export=export
    engine._portal740=True

class MapSigningClient:
    """Keep local execution; expose only the existing map-delivery signature."""
    def __init__(self,local,signer,core):self.local=local;self.signer=signer;self.core=core
    def __getattr__(self,name):return getattr(self.local,name)
    def _sign(self,body,domain,field):
        expected={'schema','core_id','sequence','timestamp','nonce','map'}
        if domain!=b'CP-INVENTORY-MAP-V1\n' or field!='map_signature' or not isinstance(body,dict) or set(body)!=expected or body.get('schema')!='cp.inventory.map.delivery.v1' or body.get('core_id')!=self.core or not isinstance(body.get('map'),dict) or body['map'].get('core_id')!=self.core:
            raise PermissionError('inventory_map_signature_scope')
        return self.signer._sign(body,domain,field)

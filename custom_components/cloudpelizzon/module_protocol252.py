"""Common HA download/migration client. Does not activate a module or devices."""
import base64,hashlib,http.client,json,os,re,secrets,time,uuid
from pathlib import Path
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
if __package__:
 from . import module_package243 as package,tenant_migration246 as migration
 from .local_authorization246 import binding
else:
 import module_package243 as package,tenant_migration246 as migration
 from local_authorization246 import binding

PREFIX=b'CP-MODULE-TRANSFER251\n';CHUNK=262144
READ_OPERATIONS={'CP-MAINTENANCE':'maintenance.records.read','CP-SOLAR':'solar.config.read','CP-AUTOMATION':'automation.rules.read','CP-SECURITY':'security.config.read','CP-LIGHTING':'lighting.config.read'}
def need(ok,code):
 if not ok:raise PermissionError(code)
def arguments(action,data):return {'purpose':'local_module_delivery251','action':action,'data':data}
def post(value):
 c=http.client.HTTPSConnection('portal.cloudpelizzon.com.br',timeout=95)
 try:
  c.request('POST','/custom/cloudpelizzon/module_delivery251.php',package.canonical(value),{'Content-Type':'application/json'})
  r=c.getresponse();raw=r.read(1048577)
  need(r.status==200 and len(raw)<=1048576,'authenticated_module_transfer_unavailable')
  return json.loads(raw)
 finally:c.close()
def write_new(path,raw):
 fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600)
 with os.fdopen(fd,'wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
class Client:
 def __init__(self,native,sku,*,transport=post,guard=lambda:None,module_spec=None):
  # The five legacy entries remain compatible. New modules supply the validated
  # common-registry descriptor; native authority still decides every grant.
  op=READ_OPERATIONS.get(sku) if module_spec is None else getattr(module_spec,'read_operation',None)
  need(module_spec is None or getattr(module_spec,'sku',None)==sku,'module_descriptor_binding_required')
  need(type(sku) is str and re.fullmatch(r'CP-[A-Z0-9-]{2,80}',sku) and type(op) is str and re.fullmatch(r'[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,8}',op),'approved_module_required')
  self.native=native;self.sku=sku;self.read_operation=op;self.transport=transport;self.guard=guard;self.cap=None;self.cap_at=0
 def request(self,action,data):
  self.guard();op=self.read_operation;rid=uuid.uuid4().hex
  if self.cap is None or time.monotonic()-self.cap_at>=10:
   self.cap,_=self.native._control('capability',{'sku':self.sku,'operation':op});self.cap_at=time.monotonic()
  need(type(self.cap) is dict and self.cap.get('ok') is True and self.cap.get('operation')==op
       and isinstance(self.cap.get('token'),str) and self.cap['token'].startswith('cpp1.'),'commercial_module_license_required')
  proof=self.native._sign({'installation_id':self.native._iid,'sku':self.sku,'operation':op,
   'challenge':secrets.token_hex(32),'args_sha256':binding(self.native._iid,self.sku,op,arguments(action,data),rid),
   'token':self.cap['token'],'nonce':secrets.token_hex(32),'timestamp':int(time.time())})
  result=self.transport({'action':action,'data':data,'request_id':rid,'proof':proof});self.guard();return result
 def release(self):
  value=self.request('release',{})
  need(type(value) is dict and set(value)=={'package','archive_size','chunk_size'} and type(value['archive_size']) is int
       and 0<value['archive_size']<=package.MAX_ARCHIVE and value['chunk_size']==CHUNK,'bounded_private_package_required')
  return value
 def stage(self,folder,*,core_id,publisher_pin,allowed_operations,schema,progress=lambda *args:None):
  need(schema.sku==self.sku,'matching_migration_adapter_required')
  folder=migration.safe(folder);need(not folder.exists(),'new_private_staging_folder_required')
  folder.mkdir(mode=0o700)
  release=self.release();packet=release['package'];archive=bytearray();offset=0
  # The release is still untrusted until verify() below; all reads are bounded.
  need(type(packet) is dict and type(packet.get('manifest')) is dict,'signed_module_manifest_required')
  digest=package.sha(package.canonical(packet['manifest']))
  while offset<release['archive_size']:
   size=min(CHUNK,release['archive_size']-offset)
   chunk=self.request('archive_chunk',{'manifest_sha256':digest,'offset':offset,'size':size})
   raw=base64.b64decode(chunk['data'],validate=True)
   need(chunk['manifest_sha256']==digest and chunk['offset']==offset and len(raw)==size,'complete_package_chunk_required')
   archive.extend(raw);offset+=size;progress('Baixando o módulo',offset,release['archive_size'])
  archive=bytes(archive)
  manifest,_=package.verify(packet,archive,sku=self.sku,signer_sha256=publisher_pin,core_id=core_id,allowed_operations=allowed_operations)
  need(manifest['migration_contract']=='cp.'+self.sku[3:].lower()+'.migration.v1','approved_migration_contract_required')
  self.guard();write_new(folder/'package.json',package.canonical(packet));write_new(folder/'module.tar',archive)
  tid=uuid.uuid4().hex;transfer=self.request('prepare',{'transfer_id':tid,'manifest_sha256':digest})
  meta=verify_transfer(transfer,core_id=core_id,signed_id=self.native._iid,sku=self.sku,publisher_pin=publisher_pin,release=digest,tid=tid,schema=schema)
  snapshot=folder/'snapshot.sqlite3';fd=os.open(snapshot,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600);offset=0
  with os.fdopen(fd,'wb') as stream:
   while offset<meta['size']:
    size=min(CHUNK,meta['size']-offset);chunk=self.request('snapshot_chunk',{'transfer_id':tid,'offset':offset,'size':size})
    raw=base64.b64decode(chunk['data'],validate=True)
    need(chunk['transfer_id']==tid and chunk['offset']==offset and len(raw)==size,'complete_migration_chunk_required')
    stream.write(raw);offset+=size;progress('Preservando configuração e histórico',offset,meta['size'])
   stream.flush();os.fsync(stream.fileno())
  self.guard();write_new(folder/'transfer.json',package.canonical(transfer))
  result=migration.install(snapshot,folder/'local.sqlite3',schema=schema,verified_metadata=meta['migration']);self.guard()
  return {'packet':packet,'archive':archive,'manifest':manifest,'database':folder/'local.sqlite3','migration_counts':result['counts'],'folder':folder}

def verify_transfer(packet,*,core_id,signed_id,sku,publisher_pin,release,tid,schema,now=None):
 now=time.time() if now is None else now
 need(type(packet) is dict and set(packet)=={'transfer','public_key','signature'},'signed_transfer_required')
 public=base64.b64decode(packet['public_key'],validate=True);need(package.sha(public)==publisher_pin,'pinned_migration_publisher_required')
 serialization.load_der_public_key(public).verify(base64.b64decode(packet['signature'],validate=True),PREFIX+package.canonical(packet['transfer']),padding.PKCS1v15(),hashes.SHA256())
 meta=packet['transfer'];need(type(meta) is dict and set(meta)=={'schema','migration','transfer_id','size','chunk_size','created_at'}
  and meta['schema']=='cp.module.transfer251.v1' and meta['transfer_id']==tid,'transfer_contract_required')
 m=meta['migration'];need(type(m) is dict and set(m)=={'schema','core_id','signed_id','sku','package_manifest_sha256','sha256','counts'}
  and m['schema']=='cp.tenant.migration246.v1' and m['core_id']==core_id and m['signed_id']==signed_id and m['sku']==sku
  and m['package_manifest_sha256']==release,'transfer_installation_binding_required')
 need(type(meta['size']) is int and 0<meta['size']<=migration.MAX_BYTES and meta['chunk_size']==CHUNK
  and type(meta['created_at']) is int and -5<=now-meta['created_at']<900
  and type(m['sha256']) is str and re.fullmatch('[a-f0-9]{64}',m['sha256']),'bounded_fresh_transfer_required')
 need(type(m['counts']) is dict and set(m['counts'])=={t.name for t in schema.tables}
  and all(type(v) is int and 0<=v<=2000000 for v in m['counts'].values()),'approved_snapshot_tables_required')
 return meta

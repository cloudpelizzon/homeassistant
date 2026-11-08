"""Public activation client/installer. Binary download requires native paid proof."""
import base64,hashlib,http.client,io,json,os,re,secrets,tarfile,time,uuid,sysconfig,platform,threading,ssl
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from .compiled_loader627 import canonical,DOMAIN,ENTITLEMENT,ENTRIES,safe
from .finance_access653 import validate_finance_access

def write(path,data):
 path=safe(path);temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.new')
 fd=os.open(temp,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600)
 try:
  with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.replace(temp,path)
 finally:
  if temp.exists():temp.unlink()

class ActivationClient:
 def __init__(self,native,transport):self.native=native;self.transport=transport
 def request(self,sku,*,read_operation,public_key,manifest_sha256,abi=None,architecture=None):
  # This is the only online path. The installed engines never call this client.
  data={'sku':sku,'installation_public_key':public_key,'abi':abi or sysconfig.get_config_var('SOABI'),'architecture':architecture or platform.machine(),'manifest_sha256':manifest_sha256}
  rid=uuid.uuid4().hex;args={'purpose':'compiled_activation627','data':data}
  cap,_=self.native._control('capability',{'sku':sku,'operation':read_operation})
  if cap.get('ok') is not True or not str(cap.get('token','')).startswith('cpp1.'):raise PermissionError('paid_activation_required')
  body={'installation_id':self.native._iid,'sku':sku,'operation':read_operation,'challenge':secrets.token_hex(32),'args_sha256':hashlib.sha256(canonical({'protocol':'cp.cloud.online.v1','installation_id':self.native._iid,'sku':sku,'operation':read_operation,'args':args,'request_id':rid})).hexdigest(),'token':cap['token'],'nonce':secrets.token_hex(32),'timestamp':int(time.time())}
  proof=self.native._sign(body)
  return self.transport({'proof':proof,'request_id':rid,'data':data})

INSTALL_LOCK=threading.RLock()

class HTTPSActivation:
 def __init__(self,hostname,*,port=443,path="/v1/compiled627/activate"):
  if not re.fullmatch(r'[A-Za-z0-9.-]+',hostname):raise ValueError('activation_hostname')
  self.hostname=hostname;self.port=port;self.path=path
 def __call__(self,request):
  connection=http.client.HTTPSConnection(self.hostname,self.port,context=ssl.create_default_context(),timeout=45)
  try:
   raw=canonical(request)
   if len(raw)>65536:raise PermissionError('activation_request_limit')
   connection.request('POST',self.path,raw,{'Content-Type':'application/json','Cache-Control':'no-store'})
   response=connection.getresponse();body=response.read(90000001)
   if response.status!=200 or len(body)>90000000:raise PermissionError('activation_delivery_denied')
   result=json.loads(body);archive=base64.b64decode(result.pop('archive_base64'),validate=True)
   return {'response':result,'archive':archive}
  finally:connection.close()

def install(response,archive,**options):
 with INSTALL_LOCK:
  recover_pending(options['root'])
  return _install(response,archive,**options)

def _install(response,archive,*,root,sku,public_key,core_id,iid,allow_test=False):
 """Immutable version folders + atomic commit. Does not load code or restart HA."""
 root=safe(root);root.mkdir(mode=0o700,parents=True,exist_ok=True)
 packet=response['package'];manifest=packet['manifest'];pub=Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key))
 pub.verify(base64.b64decode(packet['signature'],validate=True),DOMAIN+canonical(manifest))
 if manifest['schema']!='cp.native.package627.v1' or manifest['sku']!=sku or manifest['entry']!=ENTRIES[sku] or manifest['abi']!=sysconfig.get_config_var('SOABI') or manifest['architecture']!=platform.machine():raise PermissionError('activation_binary_compatibility')
 if manifest['test_only'] and not allow_test:raise PermissionError('test_activation_rejected')
 if len(archive)>67108864 or hashlib.sha256(archive).hexdigest()!=manifest['archive_sha256']:raise PermissionError('activation_archive_integrity')
 grant=response['license'];pub.verify(base64.b64decode(grant['signature'],validate=True),ENTITLEMENT+canonical(grant['claims']))
 c=grant['claims']
 if c['schema']!='cp.compiled.entitlement627.v1' or c['sku']!=sku or c['core_id']!=core_id or c['installation_id']!=iid:raise PermissionError('activation_entitlement_binding')
 if sku=='CP-FINANCE':
  validate_finance_access(c,int(time.time()))
  previous=safe(root/sku/'license.json')
  if c['trial'] is True and previous.is_file():
   existing=json.loads(previous.read_bytes())
   pub.verify(base64.b64decode(existing['signature'],validate=True),ENTITLEMENT+canonical(existing['claims']))
   before=existing['claims']
   if before.get('trial') is not True or any(before.get(k)!=c[k] for k in ('sku','core_id','installation_id','license_id','expires_at')):
    raise PermissionError('finance_trial_cannot_replace_existing_license')
 elif c['edition']!='full' or c['trial'] is not False:raise PermissionError('activation_entitlement_binding')
 if type(c['issued_at']) is not int or c['issued_at']>time.time()+30 or type(c['not_before']) is not int or c['not_before']>time.time():raise PermissionError('activation_entitlement_time')
 if c['expires_at'] is not None and time.time()>=c['expires_at']:raise PermissionError('activation_expired')
 # No customer identities or key are replaced by an installation response.
 identity=json.loads((root/'identity.json').read_bytes())
 if identity!={'core_id':core_id,'installation_id':iid}:raise PermissionError('activation_existing_identity')
 from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
 from cryptography.hazmat.primitives import serialization
 own=Ed25519PrivateKey.from_private_bytes((root/'installation.key').read_bytes()).public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()
 if own!=c['installation_public_key']:raise PermissionError('activation_installation_key')
 if sku=='CP-INVENTORY':
  child=response['inventory_entitlement'];pub.verify(base64.b64decode(child['signature'],validate=True),b'CP-INVENTORY-ENTITLEMENT-V1\n'+canonical(child['claims']))
  b=child['claims']
  if child['key_id']!='merchant627' or b['core_id']!=core_id or b['license_id']!=c['license_id'] or b['expires_at']!=c['expires_at'] or b['max_devices']!=c['product']['max_devices'] or b['features']!=c['product']['features']:raise PermissionError('activation_inventory_terms')
 library={}
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as tar:
  for member in tar:
   name=member.name
   if not member.isfile() or member.size>268435456 or Path(name).name!=name or not name.endswith('.so') or name in library or name not in manifest['files']:raise PermissionError('activation_archive_path')
   raw=tar.extractfile(member).read()
   if raw[:4]!=b'\x7fELF' or hashlib.sha256(raw).hexdigest()!=manifest['files'][name]:raise PermissionError('activation_native_file')
   library[name]=raw
 if len(library)!=1 or set(library)!=set(manifest['files']):raise PermissionError('activation_archive_files')
 version=hashlib.sha256(canonical(manifest)).hexdigest();destination=safe(root/'libraries'/sku/version);destination.mkdir(parents=True,mode=0o700,exist_ok=True)
 for name,raw in library.items():
  target=destination/name
  if target.exists() and target.read_bytes()!=raw:raise PermissionError('immutable_library_changed')
  if not target.exists():write(target,raw)
 write(destination/'manifest.json',canonical(packet))
 state=root/sku;state.mkdir(mode=0o700,exist_ok=True)
 marker=root/'installed627.json';old=json.loads(marker.read_bytes()) if marker.exists() else {'schema':'cp.native.installed627.v1','modules':{}}
 prior={n:(state/n).read_bytes().hex() if (state/n).exists() else None for n in ('license.json','inventory-entitlement.json')}
 journal=root/('activation-journal-'+sku+'.json');write(journal,canonical({'old_marker':old,'old_state':prior,'sku':sku,'target':version}))
 try:
  write(state/'license.json',canonical(grant))
  if sku=='CP-INVENTORY':write(state/'inventory-entitlement.json',canonical(response['inventory_entitlement']))
  updated=json.loads(canonical(old));updated['modules'][sku]={'folder':str(destination),'version':version,'public_key':public_key,'test_only':manifest['test_only']}
  write(marker,canonical(updated))
 except BaseException:
  write(marker,canonical(old))
  for name,raw in prior.items():
   if raw is not None:write(state/name,bytes.fromhex(raw))
   elif (state/name).exists():(state/name).unlink()
  raise
 finally:
  if journal.exists():journal.unlink()
 return {'installed':True,'sku':sku,'version':version,'core_restart_required':True,'existing_identity_preserved':True,'existing_data_untouched':True}

def recover_pending(root):
 root=safe(root);recovered=[]
 for path in root.glob('activation-journal-CP-*.json'):
  journal=json.loads(path.read_bytes());sku=journal['sku']
  if sku not in ENTRIES or set(journal['old_state'])!={'license.json','inventory-entitlement.json'}:raise PermissionError('activation_recovery_journal')
  write(root/'installed627.json',canonical(journal['old_marker']))
  for name,raw in journal['old_state'].items():
   target=root/sku/name
   if raw is not None:write(target,bytes.fromhex(raw))
   elif target.exists():target.unlink()
  path.unlink();recovered.append(sku)
 return recovered

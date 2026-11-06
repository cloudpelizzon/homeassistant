"""Paid native cutover. Existing identities/data and HA permission ports remain.

Activation contacts the authority only for the initial installation or renewal.
Valid signed local entitlements allow a completely offline Core restart.
"""
import asyncio,base64,hashlib,json,os,sqlite3,time,re,traceback
from pathlib import Path
from functools import partial
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey,Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from .compiled_activation627 import ActivationClient,HTTPSActivation,install,write
from .compiled_loader627 import canonical,ENTITLEMENT
from .compiled_registration627 import Registration
from .compiled_release628 import PUBLIC_KEY,RELEASES,READ_OPERATIONS

KEY='cloudpelizzon_compiled628_active'
async def enabled(hass):
 return await hass.async_add_executor_job(lambda:Path(hass.config.path('.storage/cloudpelizzon_compiled627/deployment628.json')).is_file())

def provision(root,context,*,force=None):
 root=Path(root);root.mkdir(mode=0o700,parents=True,exist_ok=True)
 wanted={'core_id':context['core_id'],'installation_id':context['trial_id']}
 marker=root/'installed627.json';identity=root/'identity.json';keyfile=root/'installation.key'
 if identity.exists():
  if json.loads(identity.read_bytes())!=wanted:raise PermissionError('existing_identity_preserved')
 else:
  if marker.exists():raise PermissionError('restore_existing_compiled_identity')
  write(identity,canonical(wanted))
 if not keyfile.exists():
  if marker.exists():raise PermissionError('restore_existing_compiled_key')
  key=Ed25519PrivateKey.generate()
  write(keyfile,key.private_bytes(serialization.Encoding.Raw,serialization.PrivateFormat.Raw,serialization.NoEncryption()))
 else:key=Ed25519PrivateKey.from_private_bytes(keyfile.read_bytes())
 public=key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()
 authority=Ed25519PublicKey.from_public_bytes(bytes.fromhex(PUBLIC_KEY))
 client=ActivationClient(context['client'],HTTPSActivation('portal.cloudpelizzon.com.br',path='/custom/cloudpelizzon/compiled_activation628.php'))
 installed=json.loads(marker.read_bytes())['modules'] if marker.exists() else {}
 for sku,release in RELEASES.items():
  if force is not None and sku!=force:continue
  current=installed.get(sku);license_path=root/sku/'license.json'
  if current and current['version']==release and license_path.is_file() and force is None:
   packet=json.loads(license_path.read_bytes());c=packet['claims']
   authority.verify(base64.b64decode(packet['signature'],validate=True),ENTITLEMENT+canonical(c))
   if c['core_id']!=wanted['core_id'] or c['installation_id']!=wanted['installation_id'] or c['installation_public_key']!=public or c['sku']!=sku or c['edition']!='full' or c['trial'] is not False:raise PermissionError('compiled_local_entitlement_binding')
   if c['expires_at'] is None or time.time()<c['expires_at']:continue
  delivered=client.request(sku,read_operation=READ_OPERATIONS[sku],public_key=public,manifest_sha256=release)
  response=delivered['response'];archive=delivered['archive']
  if hashlib.sha256(canonical(response['package']['manifest'])).hexdigest()!=release:raise PermissionError('reviewed_native_release_required')
  install(response,archive,root=root,sku=sku,public_key=PUBLIC_KEY,core_id=wanted['core_id'],iid=wanted['installation_id'])
 write(root/'activation-complete628.json',canonical({'complete':True,'modules':sorted(RELEASES),'paid_only':True,'test_issuer':False}))

def fingerprint(database,table,columns):
 with sqlite3.connect(Path(database).as_uri()+'?mode=ro',uri=True) as db:
  rows=db.execute('SELECT '+','.join('"'+c+'"' for c in columns)+' FROM "'+table+'" ORDER BY 1,2').fetchall()
 return hashlib.sha256(canonical(rows)).hexdigest()

async def register(hass,entry,context):
 if not await enabled(hass):
  from .module_registration298 import register as legacy
  return await legacy(hass,entry,context)
 root=Path(hass.config.path('.storage/cloudpelizzon_compiled627'));registration=None;close_admin=None;bridge=None;ready=None;old_ready=None
 try:
  async def checkpoint(stage):
   await hass.async_add_executor_job(write,root/'startup628.json',canonical({'stage':stage,'at':int(time.time())}))
  await checkpoint('before_local_entitlement_validation')
  await hass.async_add_executor_job(provision,root,context)
  await checkpoint('before_native_registration')
  def baseline_for_this_startup():
   plan=json.loads((root/'data627.json').read_bytes())
   expected={sku:row['configuration_fingerprint'] for sku,row in plan.items()}
   map_digest=json.loads((root/'deployment628.json').read_bytes())['inventory_map_fingerprint']
   confirmation=root/'cutover-result628.json'
   # The first migration must match its stopped-source baseline. Later starts
   # preserve legitimate saved user edits instead of comparing forever to day one.
   if confirmation.is_file() and json.loads(confirmation.read_bytes()).get('deployed') is True:
    expected={sku:fingerprint(row['database'],row['configuration_table'],row['configuration_columns']) for sku,row in plan.items()}
    database=Path(hass.config.path('.storage/cloudpelizzon_inventory/inventory.sqlite3'))
    with sqlite3.connect(database.as_uri()+'?mode=ro',uri=True) as db:
     values=db.execute("SELECT key,value FROM settings WHERE key IN ('house','map_edits513','topology_orientation') ORDER BY key").fetchall()
    map_digest=hashlib.sha256(canonical(values)).hexdigest()
   return expected,map_digest
  expected_configuration,expected_map=await hass.async_add_executor_job(baseline_for_this_startup)
  registration=Registration(hass,context,root,PUBLIC_KEY)
  modules=await registration.load();await checkpoint('native_libraries_and_services_loaded')
  await registration.attach(entry,modules);await checkpoint('original_HA_ports_attached')
  hass.data[KEY]=registration
  bridge=hass.data['cloudpelizzon']['core']['status_transport'];old_ready=bridge.local_ready
  def ready():return set(registration.runtimes)|{'CP-INVENTORY'} if not registration.closed else set()
  bridge.local_ready=ready
  from .compiled_admin628 import attach
  close_admin=attach(hass,entry,context,registration,root)
  def health():
   plan=json.loads((root/'data627.json').read_bytes());checks={}
   for sku,runtime in registration.runtimes.items():
    runtime.namespace.guard.verify(sku,runtime.iid)
    before=expected_configuration[sku]
    after=fingerprint(plan[sku]['database'],plan[sku]['configuration_table'],plan[sku]['configuration_columns'])
    if before!=after:raise PermissionError('configuration_changed_during_native_cutover')
    checks[sku]={'compiled':True,'paid_verified':True,'configuration_preserved':True}
   inv=hass.data['cloudpelizzon_inventory506'];e=inv.engine.entitlement()
   if not e.paid:raise PermissionError('inventory_full_entitlement_required')
   with inv.engine.store.connect() as db:
    values=db.execute("SELECT key,value FROM settings WHERE key IN ('house','map_edits513','topology_orientation') ORDER BY key").fetchall()
   expected=expected_map
   if hashlib.sha256(canonical(values)).hexdigest()!=expected:raise PermissionError('inventory_map_changed_during_cutover')
   checks['CP-INVENTORY']={'compiled':True,'paid_verified':True,'map_preserved':True,'max_devices':e.max_devices}
   write(root/'health628.json',canonical({'ready':True,'modules':checks,'commercial_signing':True,'test_only':False,'HA_permissions_preserved':True,'checked_at':int(time.time())}))
  await hass.async_add_executor_job(health)
  await checkpoint('native_health_confirmed')
  catalog=await bridge.handle('cloudpelizzon/core/status',{},active=True)
  public_rows=[{'sku':m['sku'],'name':m.get('name'),'installed':m.get('installed') is True,'local_installed':m.get('local_installed') is True,'paid':m.get('license',{}).get('allowed') is True,'status':m.get('license',{}).get('status')} for m in catalog.get('modules',[]) if m.get('sku') in RELEASES]
  await hass.async_add_executor_job(write,root/'catalog629.json',canonical({'modules':public_rows,'at':int(time.time()),'display_only':True}))
  def close():
   close_admin();registration.close()
   if hass.data.get(KEY) is registration:hass.data.pop(KEY,None)
   if bridge.local_ready is ready:bridge.local_ready=old_ready
  return close
 except BaseException as error:
  if close_admin:close_admin()
  if registration:registration.close()
  if registration is not None and hass.data.get(KEY) is registration:hass.data.pop(KEY,None)
  if bridge is not None and ready is not None and bridge.local_ready is ready:bridge.local_ready=old_ready
  await hass.async_add_executor_job(write,root/'health628.json',canonical({'ready':False,'error_type':type(error).__name__,'stage':'native_cutover628','error_code':str(error) if re.fullmatch('[A-Za-z0-9_]{1,100}',str(error)) else 'redacted','frames':[(Path(f.filename).name,f.lineno,f.name) for f in traceback.extract_tb(error.__traceback__) if 'cloudpelizzon' in f.filename]}))
  raise

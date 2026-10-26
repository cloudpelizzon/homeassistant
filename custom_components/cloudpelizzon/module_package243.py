"""One private package contract for every SKU. No module execution or DB export."""
import base64,hashlib,io,json,re,tarfile
from pathlib import PurePosixPath
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import padding,rsa

PREFIX=b'CP-PRIVATE-MODULE243\n'
SCHEMA='cp.private.module243.v1'
MAX_ARCHIVE=16*1024*1024;MAX_FILES=256;MAX_EXPANDED=64*1024*1024
def need(value,code):
 if not value:raise ValueError(code)
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def sha(raw):return hashlib.sha256(raw).hexdigest()
def path(name):
 need(isinstance(name,str) and len(name)<=200 and '\\' not in name and '\x00' not in name,'package_path_required')
 p=PurePosixPath(name)
 need(not p.is_absolute() and str(p)==name and p.parts and all(re.fullmatch('[a-zA-Z0-9_.-]{1,80}',v) and v not in ('.','..') for v in p.parts),'package_path_required')
 need(all(v not in ('__pycache__','.git','.storage') for v in p.parts)
  and p.suffix in ('.py','.json','.js','.css','.svg','.webp','.png','.html','.sql','.md'), 'package_source_file_required')
 return name
def pack(files):
 need(type(files) is dict and 1<=len(files)<=MAX_FILES and all(type(v) is bytes for v in files.values()),'bounded_source_files_required')
 need(sum(map(len,files.values()))<=MAX_EXPANDED,'package_expanded_limit')
 stream=io.BytesIO()
 # Stable unsigned archive. Manifest and signature are delivered separately.
 with tarfile.open(fileobj=stream,mode='w',format=tarfile.USTAR_FORMAT) as tar:
  for name,raw in sorted(files.items()):
   path(name);info=tarfile.TarInfo(name);info.size=len(raw);info.mode=0o600;info.mtime=0
   tar.addfile(info,io.BytesIO(raw))
 raw=stream.getvalue();need(len(raw)<=MAX_ARCHIVE,'package_archive_limit');return raw
def build(*,sku,version,entrypoint,migration_contract,operations,files,installation_scope='licensed_installations'):
 need(re.fullmatch(r'CP-[A-Z0-9-]{2,80}',sku) is not None,'approved_sku_required')
 need(re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:[-.][a-zA-Z0-9.-]+)?',version) is not None,'module_version_required')
 need(entrypoint in files and entrypoint.endswith('.py'),'native_entrypoint_required')
 need(type(operations) is list and 1<=len(operations)<=100 and len(set(operations))==len(operations)
  and all(re.fullmatch(r'[a-z][a-z0-9_.]{2,100}',v) for v in operations),'approved_module_operations_required')
 need(re.fullmatch(r'cp\.[a-z0-9_.]+\.v[1-9][0-9]*',migration_contract) is not None,'migration_contract_required')
 need(installation_scope=='licensed_installations' or re.fullmatch(r'[a-f0-9]{32}',installation_scope),'package_installation_scope_required')
 archive=pack(files)
 manifest={'schema':SCHEMA,'sku':sku,'version':version,'mode':'private_engine_inside_HA',
  'installation_scope':installation_scope,'installer_contract':'cp.module.install243.v1',
  'entrypoint':entrypoint,'migration_contract':migration_contract,'operations':sorted(operations),
  'files':{name:sha(raw) for name,raw in sorted(files.items())},'archive_sha256':sha(archive),'archive_size':len(archive)}
 return manifest,archive
def sign(manifest,key):
 need(isinstance(key,rsa.RSAPrivateKey) and key.key_size>=2048,'existing_native_RSA_signer_required')
 public=key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)
 return {'manifest':manifest,'public_key':base64.b64encode(public).decode(),
  'signature':base64.b64encode(key.sign(PREFIX+canonical(manifest),padding.PKCS1v15(),hashes.SHA256())).decode()}
def verify(packet,archive,*,sku,signer_sha256,core_id,allowed_operations):
 need(type(packet) is dict and set(packet)=={'manifest','public_key','signature'},'signed_manifest_required')
 public=base64.b64decode(packet['public_key'],validate=True)
 need(sha(public)==signer_sha256,'pinned_package_publisher_required')
 key=serialization.load_der_public_key(public);need(isinstance(key,rsa.RSAPublicKey) and key.key_size>=2048,'native_RSA_public_key_required')
 key.verify(base64.b64decode(packet['signature'],validate=True),PREFIX+canonical(packet['manifest']),padding.PKCS1v15(),hashes.SHA256())
 m=packet['manifest']
 need(type(m) is dict and set(m)=={'schema','sku','version','mode','installation_scope','installer_contract','entrypoint','migration_contract','operations','files','archive_sha256','archive_size'},'module_manifest_fields_required')
 need(m['schema']==SCHEMA and m['sku']==sku and m['mode']=='private_engine_inside_HA'
  and m['installer_contract']=='cp.module.install243.v1' and re.fullmatch(r'[a-f0-9]{32}',core_id) is not None
  and m['installation_scope'] in ('licensed_installations',core_id),'module_installation_binding_required')
 need(type(m['operations']) is list and m['operations'] and len(set(m['operations']))==len(m['operations'])
  and set(m['operations'])<=set(allowed_operations),'signed_catalog_operations_required')
 need(type(m['files']) is dict and 1<=len(m['files'])<=MAX_FILES and m['entrypoint'] in m['files'],'native_entrypoint_required')
 need(type(archive) is bytes and len(archive)<=MAX_ARCHIVE and m['archive_size']==len(archive) and sha(archive)==m['archive_sha256'],'package_archive_hash_required')
 out={};expanded=0
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:') as tar:
  for member in tar:
   need(member.isfile() and not member.pax_headers and member.name not in out and member.name in m['files'],'exact_package_file_required')
   name=path(member.name);expanded+=member.size
   need(0<=member.size<=MAX_EXPANDED and expanded<=MAX_EXPANDED,'package_expanded_limit')
   raw=tar.extractfile(member).read(member.size+1)
   need(len(raw)==member.size and sha(raw)==m['files'][name],'private_file_hash_required');out[name]=raw
 need(set(out)==set(m['files']),'complete_package_required')
 # Verified bytes only. Caller still checks current license, HA compatibility,
 # approved migration adapter, rollback and health before activation.
 return m,out

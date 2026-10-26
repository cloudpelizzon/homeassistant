"""Common tenant-only migration. Schemas are approved code, never transfer SQL.

Caller authenticates the paid installation and verifies signed transfer metadata.
This layer only copies data for that installation; it does not issue rights.
"""
import hashlib,os,re,sqlite3,uuid
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

MAX_BYTES=512*1024*1024
@dataclass(frozen=True)
class Table:
 name:str
 columns:tuple
 tenant_column:str
 ddl:str
 source_name:str=''
@dataclass(frozen=True)
class Schema:
 sku:str
 tables:tuple

MAINTENANCE=Schema('CP-MAINTENANCE',(
 Table('maintenance_state',('installation','document'),'installation','CREATE TABLE maintenance_state(installation TEXT PRIMARY KEY,document TEXT NOT NULL)'),
 Table('maintenance_requests',('installation','request_id','digest','result'),'installation','CREATE TABLE maintenance_requests(installation TEXT NOT NULL,request_id TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(installation,request_id))')))

def need(ok,code):
 if not ok:raise RuntimeError(code)
def identity(schema,core,signed,release):
 need(re.fullmatch(r'CP-[A-Z0-9-]{2,80}',schema.sku) and re.fullmatch(r'[a-f0-9]{32}',core)
  and re.fullmatch(r'cp-ha-[a-f0-9]{64}',signed) and re.fullmatch(r'[a-f0-9]{64}',release),'migration_binding_required')
 for t in schema.tables:
  need(re.fullmatch(r'[a-z][a-z0-9_]*',t.name) and t.tenant_column in t.columns
   and (not t.source_name or re.fullmatch(r'[a-z][a-z0-9_]*',t.source_name))
   and all(re.fullmatch(r'[a-z][a-z0-9_]*',c) for c in t.columns),'approved_schema_required')
def safe(path):
 p=Path(path);need(not any(v.is_symlink() for v in (p,*p.parents)),'migration_path_alias');return p
def ro(path):
 p=safe(path);need(p.is_file(),'migration_source_required')
 con=sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True,timeout=10)
 con.execute('PRAGMA query_only=ON');con.execute('PRAGMA trusted_schema=OFF');return con
def file_hash(path):
 digest=hashlib.sha256()
 with Path(path).open('rb') as f:
  for raw in iter(lambda:f.read(1048576),b''):digest.update(raw)
 return digest.hexdigest()
def create(dest,schema,core,signed,release):
 for table in schema.tables:dest.execute(table.ddl)
 dest.execute('CREATE TABLE migration_identity246(core_id TEXT,signed_id TEXT,sku TEXT,package_manifest_sha256 TEXT)')
 dest.execute('INSERT INTO migration_identity246 VALUES(?,?,?,?)',(core,signed,schema.sku,release))
def copy(source,dest,schema,signed,*,transfer=False):
 counts={}
 for t in schema.tables:
  origin=t.name if transfer else t.source_name or t.name
  actual=tuple(r[1] for r in source.execute('PRAGMA table_info('+origin+')'))
  need(actual==t.columns,'source_schema_changed_'+t.name)
  if transfer:need(source.execute('SELECT COUNT(*) FROM '+t.name+' WHERE '+t.tenant_column+' IS NULL OR '+t.tenant_column+'<>?',(signed,)).fetchone()[0]==0,'snapshot_contains_another_installation')
  query=source.execute('SELECT '+','.join(t.columns)+' FROM '+origin+' WHERE '+t.tenant_column+'=?',(signed,))
  count=0
  while True:
   batch=query.fetchmany(1000)
   if not batch:break
   dest.executemany('INSERT INTO '+t.name+' VALUES('+','.join('?' for _ in t.columns)+')',batch);count+=len(batch)
   need(count<=2000000 and dest.execute('PRAGMA page_count').fetchone()[0]*dest.execute('PRAGMA page_size').fetchone()[0]<=MAX_BYTES,'migration_size_limit')
  counts[t.name]=count
 return counts
def export(source,destination,*,schema,core,signed,release):
 identity(schema,core,signed,release);target=safe(destination);need(not target.exists(),'new_snapshot_required')
 fd=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600);os.close(fd)
 try:
  with closing(ro(source)) as src,closing(sqlite3.connect(target)) as dst:
   src.execute('BEGIN');dst.execute('BEGIN IMMEDIATE')
   create(dst,schema,core,signed,release);counts=copy(src,dst,schema,signed);dst.commit()
   need(dst.execute('PRAGMA integrity_check').fetchone()[0]=='ok','snapshot_integrity_required')
  return {'schema':'cp.tenant.migration246.v1','core_id':core,'signed_id':signed,'sku':schema.sku,
   'package_manifest_sha256':release,'sha256':file_hash(target),'counts':counts}
 except BaseException:target.unlink(missing_ok=True);raise
def install(snapshot,destination,*,schema,verified_metadata):
 m=verified_metadata;identity(schema,m['core_id'],m['signed_id'],m['package_manifest_sha256'])
 need(m.get('schema')=='cp.tenant.migration246.v1' and m.get('sku')==schema.sku and file_hash(snapshot)==m.get('sha256'),'signed_snapshot_binding_required')
 target=safe(destination);need(not target.exists(),'existing_local_data_preserved')
 stage=target.with_name('.'+target.name+'.migration-'+uuid.uuid4().hex)
 fd=os.open(stage,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600);os.close(fd)
 try:
  with closing(ro(snapshot)) as src,closing(sqlite3.connect(stage)) as dst:
   src.execute('BEGIN')
   objects=src.execute("SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetchall()
   need({name for kind,name in objects if kind=='table'}=={t.name for t in schema.tables}|{'migration_identity246'}
    and all(kind in ('table','index') for kind,name in objects),'snapshot_schema_required')
   need(src.execute('SELECT core_id,signed_id,sku,package_manifest_sha256 FROM migration_identity246').fetchall()==[(m['core_id'],m['signed_id'],schema.sku,m['package_manifest_sha256'])],'snapshot_identity_required')
   dst.execute('BEGIN IMMEDIATE');create(dst,schema,m['core_id'],m['signed_id'],m['package_manifest_sha256'])
   counts=copy(src,dst,schema,m['signed_id'],transfer=True)
   need(counts==m['counts'],'snapshot_counts_required');dst.commit()
   need(dst.execute('PRAGMA integrity_check').fetchone()[0]=='ok','local_integrity_required')
  # Publish a complete DB atomically; never replace existing local configuration.
  os.link(stage,target);return {'installed':True,'sku':schema.sku,'counts':counts}
 finally:stage.unlink(missing_ok=True)

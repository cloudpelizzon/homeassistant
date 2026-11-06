"""Explicit SQLite migration; retain original and use SQLite's consistent backup.

No automatic choice between similarly named customer databases. The deployment
plan must specify the previously verified database and installation identity.
"""
import hashlib,json,os,sqlite3,uuid
from contextlib import closing
from pathlib import Path
from .compiled_activation627 import write
from .compiled_loader627 import ENTRIES,safe,canonical

def prepare(root,sku,*,source=None,new_installation=False):
 root=safe(root)
 if sku not in ENTRIES or sku=='CP-INVENTORY':raise PermissionError('inventory_uses_existing_native_adapter_database')
 identity=json.loads((root/'identity.json').read_bytes())
 if set(identity)!={'core_id','installation_id'}:raise PermissionError('migration_identity_required')
 if type(new_installation) is not bool or (source is None)!=(new_installation is True):raise PermissionError('explicit_existing_or_new_database_required')
 folder=safe(root/sku/'data');folder.mkdir(parents=True,mode=0o700,exist_ok=True)
 destination=folder/'engine.sqlite';marker=root/'data627.json'
 if destination.exists():raise PermissionError('existing_native_database_never_overwritten')
 temp=folder/(uuid.uuid4().hex+'.sqlite')
 try:
  if source is not None:
   source=safe(source)
   if not source.is_file() or source==destination:raise PermissionError('existing_database_required')
   with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as src,closing(sqlite3.connect(temp)) as dst:
    if src.execute('PRAGMA quick_check').fetchall()!=[('ok',)]:raise PermissionError('source_database_integrity')
    tables={r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    required={'CP-LIGHTING':'config','CP-MAINTENANCE':'maintenance_state','CP-SOLAR':'solar_config','CP-AUTOMATION':'automation_tenants','CP-SECURITY':'native134'}[sku]
    if required not in tables:raise PermissionError('explicit_native_schema_migration_required')
    for table in tables:
     quoted='"'+table.replace('"','""')+'"'
     columns={r[1] for r in src.execute('PRAGMA table_info('+quoted+')')}
     for column in columns&{'iid','installation','installation_id','core_id'}:
      rows=src.execute('SELECT DISTINCT "'+column+'" FROM '+quoted).fetchall()
      if any(row[0] not in identity.values() for row in rows):raise PermissionError('foreign_tenant_database_denied')
    src.backup(dst)
  else:
   with closing(sqlite3.connect(temp)) as db:db.execute('PRAGMA user_version=0')
  with closing(sqlite3.connect(temp)) as db:
   if db.execute('PRAGMA integrity_check').fetchall()!=[('ok',)]:raise PermissionError('copied_database_integrity')
  os.chmod(temp,0o600);os.replace(temp,destination)
  old=json.loads(marker.read_bytes()) if marker.exists() else {}
  old[sku]={'database':str(destination),'source':str(source) if source else None,'original_retained':True,'sqlite_backup_verified':True,'core_id':identity['core_id'],'installation_id':identity['installation_id']}
  write(marker,canonical(old));return old[sku]
 except BaseException:
  # Keep an already copied database for review if marker commit failed.
  if temp.exists():temp.unlink()
  raise

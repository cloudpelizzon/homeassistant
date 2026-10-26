"""Restore configuration into a NEW migrated Security database, never live state.

The verified package's Kernel and controller module are injected by the private
loader. Consent, sensor baselines, execution queues and armed state stay empty.
This adapter does not authorize an operation or start an executor.
"""
import copy,json,sqlite3
from contextlib import closing

def restore_configuration(database,*,iid,core_id,release,kernel,controller,now):
 with closing(sqlite3.connect(database)) as db,db:
  db.execute('BEGIN IMMEDIATE')
  identity=db.execute('SELECT core_id,signed_id,sku,package_manifest_sha256 FROM migration_identity246').fetchall()
  if identity!=[(core_id,iid,'CP-SECURITY',release)]:raise PermissionError('matching_security_migration_required')
  tables={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
  if not {'archive_session250','archive_native250','sessions126','native134','queue126','timers68'}<=tables:raise PermissionError('security_migration_tables_required')
  for table in ('archive_session250','archive_native250','sessions126','native134','queue126','timers68'):
   if db.execute('SELECT COUNT(*) FROM '+table+' WHERE iid IS NULL OR iid<>?',(iid,)).fetchone()[0]:raise PermissionError('foreign_security_tenant')
  db.execute('CREATE TABLE IF NOT EXISTS local_security_bootstrap287(iid TEXT PRIMARY KEY,release TEXT NOT NULL)')
  previous=db.execute('SELECT release FROM local_security_bootstrap287 WHERE iid=?',(iid,)).fetchone()
  if previous:
   if previous!=(release,):raise PermissionError('security_bootstrap_release_conflict')
   return {'configuration_restored':False,'already_prepared':True}
  # Never reset an initialized executor or overwrite work completed locally.
  for table in ('sessions126','native134','queue126','timers68'):
   if db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]:raise PermissionError('new_security_runtime_required')
  session=db.execute('SELECT config FROM archive_session250 WHERE iid=?',(iid,)).fetchone()
  native=db.execute('SELECT document FROM archive_native250 WHERE iid=?',(iid,)).fetchone()
  state=kernel.state(db,iid)
  if session:
   config=json.loads(session[0])
   if type(config) is not dict:raise ValueError('archived_security_config_required')
   # Preserve preferences exactly. No authorization is inferred from enabled.
   db.execute('UPDATE sessions126 SET config=? WHERE iid=?',(json.dumps(config,ensure_ascii=False),iid))
  doc=controller.fresh(now)
  if native:
   old=json.loads(native[0])
   if type(old) is not dict or type(old.get('config')) is not dict:raise ValueError('archived_native_config_required')
   doc['config']=copy.deepcopy(old['config'])
  db.execute('INSERT INTO native134 VALUES(?,?)',(iid,json.dumps(doc,ensure_ascii=False)))
  db.execute('INSERT INTO local_security_bootstrap287 VALUES(?,?)',(iid,release))
  return {'configuration_restored':bool(session or native),'already_prepared':False,
          'alarm':'disarmed','session_ready':False,'execution_consent_restored':False,
          'queued_commands_restored':0,'timers_restored':0}

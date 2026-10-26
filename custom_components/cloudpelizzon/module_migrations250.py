"""Trusted migration staging contracts from the operator's schema audit249.

Snapshots preserve configuration and history. Runtime ownership, command queues,
timers and signed authorizations are not transferable execution permission.
An archive_* table is deliberately invisible to native execution code; the HA
adapter must complete a fresh handoff before restoring any activation intent.
"""
if __package__:
 from .tenant_migration246 import Schema,Table,MAINTENANCE
else:
 from tenant_migration246 import Schema,Table,MAINTENANCE

AUTOMATION=Schema('CP-AUTOMATION',(
 Table('automation_tenants',('iid','next_code','settings'),'iid','CREATE TABLE automation_tenants(iid TEXT PRIMARY KEY,next_code INTEGER NOT NULL,settings TEXT NOT NULL)'),
 Table('automation_rules',('iid','code','revision','document','updated_at'),'iid','CREATE TABLE automation_rules(iid TEXT NOT NULL,code TEXT NOT NULL,revision INTEGER NOT NULL,document TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(iid,code))'),
 Table('automation_requests',('iid','rid','digest','result'),'iid','CREATE TABLE automation_requests(iid TEXT NOT NULL,rid TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(iid,rid))'),
 Table('archive_activation250',('iid','code','revision','generation','enabled'),'iid','CREATE TABLE archive_activation250(iid TEXT NOT NULL,code TEXT NOT NULL,revision INTEGER NOT NULL,generation INTEGER NOT NULL,enabled INTEGER NOT NULL,PRIMARY KEY(iid,code))',source_name='automation_activation84'),
))

LIGHTING=Schema('CP-LIGHTING',(
 Table('config',('iid','document'),'iid','CREATE TABLE config(iid TEXT PRIMARY KEY,document TEXT NOT NULL)'),
 Table('requests',('iid','uid','rid','digest','result'),'iid','CREATE TABLE requests(iid TEXT NOT NULL,uid TEXT NOT NULL,rid TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(iid,uid,rid))'),
))

SECURITY=Schema('CP-SECURITY',(
 Table('engines64',('iid','document'),'iid','CREATE TABLE engines64(iid TEXT PRIMARY KEY,document TEXT NOT NULL)'),
 Table('requests64',('iid','rid','digest','result'),'iid','CREATE TABLE requests64(iid TEXT,rid TEXT,digest TEXT,result TEXT,PRIMARY KEY(iid,rid))'),
 Table('logs126',('id','iid','code','created','title','result'),'iid','CREATE TABLE logs126(id INTEGER PRIMARY KEY,iid TEXT,code TEXT,created TEXT,title TEXT,result TEXT)'),
 Table('requests126',('iid','rid','digest','result','created','kind'),'iid','CREATE TABLE requests126(iid TEXT,rid TEXT,digest TEXT,result TEXT,created REAL,kind TEXT,PRIMARY KEY(iid,rid))'),
 Table('requests68',('iid','rid','digest','result'),'iid','CREATE TABLE requests68(iid TEXT,rid TEXT,digest TEXT,result TEXT,PRIMARY KEY(iid,rid))'),
 Table('revision68',('iid','revision'),'iid','CREATE TABLE revision68(iid TEXT PRIMARY KEY,revision INTEGER NOT NULL)'),
 Table('archive_native250',('iid','document'),'iid','CREATE TABLE archive_native250(iid TEXT PRIMARY KEY,document TEXT NOT NULL)',source_name='native134'),
 Table('archive_session250',('iid','policy','config','revision','states','last_feed','last_minute','clock'),'iid','CREATE TABLE archive_session250(iid TEXT PRIMARY KEY,policy TEXT,config TEXT,revision INTEGER,states TEXT,last_feed REAL,last_minute TEXT,clock REAL)',source_name='sessions126'),
))

SCHEMAS={s.sku:s for s in (MAINTENANCE,AUTOMATION,SECURITY,LIGHTING)}
SOURCES={
 'CP-MAINTENANCE':'/var/lib/cloudpelizzon-gateway-staging/runtime/maintenance.sqlite3',
 'CP-AUTOMATION':'/var/lib/cloudpelizzon-gateway-staging/runtime/automation25.sqlite3',
 'CP-SECURITY':'/var/lib/cloudpelizzon-gateway-staging/runtime/security126.sqlite3',
 'CP-LIGHTING':'/var/lib/cloudpelizzon-gateway-staging/runtime/lighting-config.sqlite3',
}
NOT_TRANSFERRED_AS_ACTIVE={
 'CP-MAINTENANCE':(),
 'CP-AUTOMATION':('automation_activation84','automation_workers85','queue','queue_decisions33','queue_native85','relay_clock33','rules','worker124_policy'),
 'CP-SECURITY':('native134','sessions126','queue126','timers68','clock68'),
 'CP-LIGHTING':(),
}

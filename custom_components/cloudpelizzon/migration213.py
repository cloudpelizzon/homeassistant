"""Tenant-scoped Solar migration. Caller verifies paid identity and signed transfer metadata.

No customer registry, installation key, Trial or commercial record is rewritten.
Source remains read-only. SQL identifiers and schemas are never taken from a transfer.
"""
import hashlib,json,os,re,sqlite3,uuid
from contextlib import closing
from pathlib import Path

SCHEMA={
 'solar_config':('iid','document'),
 'solar_metric_state':('iid','metric','total','last_at','last_power','config_hash'),
 'solar_metric_samples':('iid','metric','observed','power','energy'),
}
DDL='''CREATE TABLE solar_config(iid TEXT PRIMARY KEY,document TEXT NOT NULL);
CREATE TABLE solar_metric_state(iid TEXT,metric TEXT,total REAL NOT NULL,last_at INTEGER,last_power REAL,config_hash TEXT,PRIMARY KEY(iid,metric));
CREATE TABLE solar_metric_samples(iid TEXT,metric TEXT,observed INTEGER,power REAL,energy REAL,PRIMARY KEY(iid,metric,observed));
CREATE TABLE migration_identity213(core_id TEXT,signed_id TEXT,sku TEXT);
'''
def require(ok,code):
    if not ok:raise RuntimeError(code)
def file_hash(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
def ro(path):
    p=Path(path)
    require(p.is_file() and not any(v.is_symlink() for v in (p,*p.parents)),'migration_source_path_invalid')
    con=sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True,timeout=10)
    con.execute('PRAGMA query_only=ON');con.execute('PRAGMA trusted_schema=OFF');return con
def binding(core,signed,sku):
    require(isinstance(core,str) and re.fullmatch('[a-f0-9]{32}',core)
        and isinstance(signed,str) and re.fullmatch('cp-ha-[a-f0-9]{64}',signed)
        and sku=='CP-SOLAR','migration_identity_required')
def copy_rows(source,dest,signed):
    counts={}
    for table,columns in SCHEMA.items():
        actual=source.execute('PRAGMA table_info('+table+')').fetchall()
        require(tuple(r[1] for r in actual)==columns,'migration_schema_changed_'+table)
        count=0;cursor=source.execute('SELECT '+','.join(columns)+' FROM '+table+' WHERE iid=?',(signed,))
        while True:
            batch=cursor.fetchmany(1000)
            if not batch:break
            dest.executemany('INSERT INTO '+table+' VALUES('+','.join('?' for _ in columns)+')',batch);count+=len(batch)
            require(dest.execute('PRAGMA page_count').fetchone()[0]*dest.execute('PRAGMA page_size').fetchone()[0]<=512*1024*1024,
                'migration_snapshot_size_requires_review')
        counts[table]=count
    require(counts['solar_config']<=1,'migration_config_ambiguous')
    return counts
def export_snapshot(source,destination,*,core,signed,sku):
    """Private server call only, after authenticating THIS source installation."""
    binding(core,signed,sku);target=Path(destination)
    require(not target.exists() and not any(p.is_symlink() for p in (target,*target.parents)),'migration_destination_required')
    fd=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
    try:
        with closing(ro(source)) as src,closing(sqlite3.connect(target)) as dst:
            src.execute('BEGIN') # One consistent SQLite snapshot; other tenants are not copied.
            dst.executescript(DDL)
            with dst:
                counts=copy_rows(src,dst,signed)
                dst.execute('INSERT INTO migration_identity213 VALUES(?,?,?)',(core,signed,sku))
            require(dst.execute('PRAGMA integrity_check').fetchone()[0]=='ok','migration_snapshot_invalid')
        return {'core_id':core,'signed_id':signed,'sku':sku,'sha256':file_hash(target),'counts':counts}
    except BaseException:
        target.unlink(missing_ok=True);raise
def import_snapshot(snapshot,destination,*,expected):
    """Expected metadata MUST come from the authenticated, signed migration response."""
    binding(expected['core_id'],expected['signed_id'],expected['sku'])
    require(file_hash(snapshot)==expected['sha256'],'migration_snapshot_hash_mismatch')
    target=Path(destination)
    require(not target.exists() and not any(p.is_symlink() for p in (target,*target.parents)),
        'existing_local_data_must_not_be_overwritten')
    stage=target.with_name('.'+target.name+'.migration-'+uuid.uuid4().hex)
    try:
        with closing(ro(snapshot)) as src:
            src.execute('BEGIN')
            tables={r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            require(tables==set(SCHEMA)|{'migration_identity213'},'migration_snapshot_tables_invalid')
            identity=src.execute('SELECT core_id,signed_id,sku FROM migration_identity213').fetchall()
            require(identity==[(expected['core_id'],expected['signed_id'],expected['sku'])],'migration_snapshot_identity_mismatch')
            for table in SCHEMA:
                require(src.execute('SELECT count(*) FROM '+table+' WHERE iid<>? OR iid IS NULL',(expected['signed_id'],)).fetchone()[0]==0,
                    'migration_contains_another_installation')
            fd=os.open(stage,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
            with closing(sqlite3.connect(stage)) as dst:
                dst.executescript(DDL)
                with dst:
                    counts=copy_rows(src,dst,expected['signed_id'])
                    require(counts==expected['counts'],'migration_row_count_mismatch')
                    # Totals/history survive, but never integrate energy across the cutover/offline gap.
                    dst.execute('UPDATE solar_metric_state SET last_at=NULL,last_power=NULL,config_hash=NULL')
                    dst.execute('INSERT INTO migration_identity213 VALUES(?,?,?)',identity[0])
                require(dst.execute('PRAGMA integrity_check').fetchone()[0]=='ok','local_migration_integrity_failed')
        # Atomic, no-clobber publication. An existing database is never replaced.
        os.link(stage,target)
        return {'migrated':True,'counts':counts,'source_preserved':True,'identities_preserved':True}
    finally:stage.unlink(missing_ok=True)

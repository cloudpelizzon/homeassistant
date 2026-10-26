"""Public loader template. Private engine is downloaded only after paid authorization.

SIGNER_SHA256 and MANIFEST_SHA256 must be filled from the PVE 212 signed release
report before installation. This template alone grants no access.
"""
import base64,hashlib,importlib,io,json,os,secrets,sqlite3,tarfile,time,uuid
from contextlib import closing
from datetime import datetime,timezone
from pathlib import Path
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import padding

SIGNER_SHA256='fdcc00c16286059bb9d7d9a5dcbe047ba5a5e93891c22870aaac2f82490be5be'
MANIFEST_SHA256='aef43066e69b5dd42fc25cfdbc65390b983abfd38a820ac9eb4d8759d212b523'
FILES={'__init__.py','common.py','manager.py','service.py','snapshot.py','solar_metrics.py','storage.py','descriptors.py','local.py'}
READY_KEY='cloudpelizzon_private_local_ready216'
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def envelope(raw,core,signed):
    if hashlib.sha256(raw).hexdigest()!=MANIFEST_SHA256:raise PermissionError('private_manifest_changed')
    obj=json.loads(raw);der=base64.b64decode(obj['public_key'],validate=True)
    if hashlib.sha256(der).hexdigest()!=SIGNER_SHA256:raise PermissionError('private_publisher_changed')
    m=obj['manifest']
    serialization.load_der_public_key(der).verify(base64.b64decode(obj['signature'],validate=True),
        b'CP-PRIVATE-MODULE212\n'+canonical(m),padding.PKCS1v15(),hashes.SHA256())
    if m.get('schema')!='cp.private.module212.v1' or m.get('sku')!='CP-SOLAR' or m.get('mode')!='private_engine_inside_HA':
        raise PermissionError('private_package_type_invalid')
    if m['core_id']!=core or m['signed_id']!=signed or set(m['files'])!=FILES:
        raise PermissionError('private_installation_binding_invalid')
    return m
def archive(raw,core,signed):
    if len(raw)>524288:raise PermissionError('private_package_too_large')
    out={}
    with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as tar:
        size=0
        for member in tar:
            name=member.name.removeprefix('modules/solar/')
            if not member.isfile() or member.name!='modules/solar/'+name or name not in FILES|{'manifest.json'} or name in out:
                raise PermissionError('private_archive_path_invalid')
            size+=member.size
            if member.size<0 or size>524288:raise PermissionError('private_archive_size_invalid')
            out[name]=tar.extractfile(member).read(member.size+1)
            if len(out[name])!=member.size:raise PermissionError('private_archive_truncated')
    if set(out)!=FILES|{'manifest.json'}:raise PermissionError('private_archive_files_invalid')
    m=envelope(out['manifest.json'],core,signed)
    if any(hashlib.sha256(out[k]).hexdigest()!=v for k,v in m['files'].items()):raise PermissionError('private_archive_hash_invalid')
    return out
def checked(folder,core,signed):
    if any(p.is_symlink() for p in (folder,*folder.parents)):raise PermissionError('private_package_symlink')
    m=envelope((folder/'manifest.json').read_bytes(),core,signed)
    for name,digest in m['files'].items():
        p=folder/name
        if p.is_symlink() or not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=digest:
            raise PermissionError('private_installed_source_changed')
    return m
def installed_database(folder,core,signed):
    db=folder/'solar.sqlite3'
    if not db.is_file() or any(p.is_symlink() for p in (db,*db.parents)):
        raise PermissionError('migrated_local_database_required')
    with closing(sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)) as con:
        con.execute('PRAGMA query_only=ON');con.execute('PRAGMA trusted_schema=OFF')
        rows=con.execute('SELECT core_id,signed_id,sku FROM migration_identity213').fetchall()
        if rows!=[(core,signed,'CP-SOLAR')]:raise PermissionError('local_database_identity_invalid')
        for table in ('solar_config','solar_metric_state','solar_metric_samples'):
            if con.execute('SELECT count(*) FROM '+table+' WHERE iid<>? OR iid IS NULL',(signed,)).fetchone()[0]:
                raise PermissionError('local_database_contains_another_installation')
def ensure(client,core,root):
    # Download never sends HA entities or user configuration; the signature binds the release.
    root=Path(root);parent=root/'_paid_modules';folder=parent/'solar'
    if folder.exists():return checked(folder,core,client._iid)
    import http.client
    rid=uuid.uuid4().hex;operation='solar.config.read'
    args={'purpose':'private_module_download212','manifest_sha256':MANIFEST_SHA256}
    cap,_=client._control('capability',{'sku':'CP-SOLAR','operation':operation})
    if cap.get('ok') is not True or cap.get('operation')!=operation or not str(cap.get('token','')).startswith('cpp1.'):
        raise PermissionError('commercial_license_required_for_private_package')
    binding=hashlib.sha256(canonical(dict(protocol='cp.cloud.online.v1',installation_id=client._iid,
        sku='CP-SOLAR',operation=operation,args=args,request_id=rid))).hexdigest()
    proof=client._sign(dict(installation_id=client._iid,sku='CP-SOLAR',operation=operation,
        challenge=secrets.token_hex(32),args_sha256=binding,token=cap['token'],nonce=secrets.token_hex(32),timestamp=int(time.time())))
    c=http.client.HTTPSConnection('portal.cloudpelizzon.com.br',timeout=20)
    try:
        c.request('POST','/custom/cloudpelizzon/paid_module212.php',canonical({'action':'download','proof':proof,'request_id':rid}),{'Content-Type':'application/json'})
        r=c.getresponse();raw=r.read(1048577)
        if r.status!=200 or len(raw)>1048576:raise PermissionError('private_download_denied')
        response=json.loads(raw)
    finally:c.close()
    packet=response['receipt'];claim=packet['claims']
    # Same pinned paid authority as the existing SDK; never accept Trial as payment.
    client._authority.verify(bytes.fromhex(packet['signature']),canonical(claim))
    start=datetime.fromisoformat(claim['issued_at']);end=datetime.fromisoformat(claim['expires_at'])
    if claim['schema']!='cp.paid.effect206.v1' or claim['entitlement_type']!='paid' or claim['decision']!='allow' or not start<=datetime.now(timezone.utc)<end or not 0<(end-start).total_seconds()<=5:
        raise PermissionError('paid_download_receipt_invalid')
    if any(claim[k]!=proof[k] for k in ('installation_id','sku','operation','challenge','args_sha256')):raise PermissionError('download_binding_invalid')
    files=archive(base64.b64decode(response['archive'],validate=True),core,client._iid)
    parent.mkdir(mode=0o700,exist_ok=True)
    if parent.is_symlink():raise PermissionError('private_package_symlink')
    init=parent/'__init__.py'
    if not init.exists():init.write_bytes(b'')
    if init.is_symlink() or init.read_bytes()!=b'':raise PermissionError('private_package_namespace_changed')
    stage=parent/('.solar-'+uuid.uuid4().hex);stage.mkdir(mode=0o700)
    try:
        for name,content in files.items():
            fd=os.open(stage/name,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
            with os.fdopen(fd,'wb') as f:f.write(content);f.flush();os.fsync(f.fileno())
        checked(stage,core,client._iid)
        stage.rename(folder)
    finally:
        if stage.exists():
            for p in stage.iterdir():p.unlink()
            stage.rmdir()
    importlib.invalidate_caches()
    return checked(folder,core,client._iid)
async def async_prepare(hass):
    # Startup never opts a customer into local installation. Only a completed,
    # explicit installation/migration transaction selects the local engine.
    from .runtime import load_context
    context=await load_context(hass)
    folder=Path(hass.config.path()).resolve()/'.storage/cloudpelizzon_paid212'
    def check():
        if not (folder/'committed.json').exists():return None
        marker=json.loads((folder/'committed.json').read_bytes())
        if marker.get('core_id')!=context['core_id'] or marker.get('signed_id')!=context['trial_id'] or marker.get('migration_verified') is not True:
            raise PermissionError('private_activation_binding_invalid')
        checked(Path(__file__).resolve().parent/'_paid_modules/solar',context['core_id'],context['trial_id'])
        installed_database(folder,context['core_id'],context['trial_id'])
        from ._paid_modules.solar.local import LocalExecutor
        return {'core_id':context['core_id'],'signed_id':context['trial_id'],'executor_type':LocalExecutor,'folder':folder}
    ready=await hass.async_add_executor_job(check)
    if ready is None:hass.data.pop(READY_KEY,None);return False
    hass.data[READY_KEY]=ready;return True
async def async_install(hass,*,confirmed=False,migrate=None):
    # Native admin-only WS handler supplies the reviewed migration coordinator.
    # An absent migration path must never become a clean/empty installation.
    if confirmed is not True or not callable(migrate):raise PermissionError('explicit_install_and_migration_required')
    from .runtime import load_context
    context=await load_context(hass)
    await hass.async_add_executor_job(ensure,context['client'],context['core_id'],Path(__file__).resolve().parent)
    folder=Path(hass.config.path()).resolve()/'.storage/cloudpelizzon_paid212'
    def make():
        folder.mkdir(mode=0o700,exist_ok=True)
        if folder.is_symlink():raise PermissionError('private_state_symlink')
    await hass.async_add_executor_job(make)
    receipt=await migrate(context,folder)
    if not isinstance(receipt,dict) or receipt.get('migrated') is not True or receipt.get('source_preserved') is not True or receipt.get('identities_preserved') is not True:
        raise PermissionError('verified_migration_required_before_local_activation')
    def commit():
        installed_database(folder,context['core_id'],context['trial_id'])
        value={'core_id':context['core_id'],'signed_id':context['trial_id'],'migration_verified':True,
            'manifest_sha256':MANIFEST_SHA256,'counts':receipt['counts']}
        temp=folder/('.committed-'+uuid.uuid4().hex)
        fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as f:f.write(canonical(value));f.flush();os.fsync(f.fileno())
        temp.replace(folder/'committed.json')
    await hass.async_add_executor_job(commit)
    return {'installed':True,'engine_mode':'local','restart_required':True,'data_preserved':True}
def select_executor(hass,client):
    # File/hash/SQLite verification and module import run in an executor during
    # startup or cutover. This synchronous HA factory never scans history.
    ready=hass.data.get(READY_KEY)
    if ready is None:return client.execute,lambda:None
    if ready['signed_id']!=client._iid:raise PermissionError('private_state_identity_invalid')
    local=ready['executor_type'](client,ready['folder']/'solar.sqlite3')
    def execute(sku,operation,args,*,request_id):
        if sku!='CP-SOLAR':raise PermissionError('wrong_private_module')
        return local.execute(operation,args,request_id)
    return execute,local.close

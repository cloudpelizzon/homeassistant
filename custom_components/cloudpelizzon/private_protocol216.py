"""HA transport for paid-only package and signed migration. No private engine."""
import base64,hashlib,http.client,json,os,re,secrets,time,uuid
from contextlib import closing
from datetime import datetime,timezone
from pathlib import Path
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
from .ha_private212 import SIGNER_SHA256,MANIFEST_SHA256
from .migration213 import import_snapshot

def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def require(ok,code):
    if not ok:raise PermissionError(code)
def post(path,value):
    c=http.client.HTTPSConnection('portal.cloudpelizzon.com.br',timeout=95)
    try:
        c.request('POST',path,canonical(value),{'Content-Type':'application/json'})
        r=c.getresponse();raw=r.read(1048577)
        require(r.status==200 and len(raw)<=1048576,'private_transfer_unavailable')
        return json.loads(raw)
    finally:c.close()
def proof(client,args,rid,cache=None):
    op='solar.config.read'
    cap=None
    if cache is not None and time.monotonic()-cache.get('at',-100)<10:cap=cache.get('cap')
    if cap is None:
        cap,_=client._control('capability',{'sku':'CP-SOLAR','operation':op})
        if cache is not None:cache.update(cap=cap,at=time.monotonic())
    require(cap.get('ok') is True and cap.get('operation')==op and isinstance(cap.get('token'),str)
        and cap['token'].startswith('cpp1.'),'commercial_license_required')
    digest=hashlib.sha256(canonical(dict(protocol='cp.cloud.online.v1',installation_id=client._iid,
        sku='CP-SOLAR',operation=op,args=args,request_id=rid))).hexdigest()
    return client._sign(dict(installation_id=client._iid,sku='CP-SOLAR',operation=op,challenge=secrets.token_hex(32),
        args_sha256=digest,token=cap['token'],nonce=secrets.token_hex(32),timestamp=int(time.time())))
def paid_check(client):
    rid=uuid.uuid4().hex;p=proof(client,{'purpose':'private_install_status216','manifest_sha256':MANIFEST_SHA256},rid)
    packet=post('/custom/cloudpelizzon/paid_module212.php',{'action':'authorize','proof':p})['receipt'];c=packet['claims']
    client._authority.verify(bytes.fromhex(packet['signature']),canonical(c))
    require(c.get('schema')=='cp.paid.effect206.v1' and c.get('entitlement_type')=='paid' and c.get('decision')=='allow','paid_receipt_required')
    require(all(c.get(k)==p[k] for k in ('installation_id','sku','operation','challenge','args_sha256')),'paid_receipt_binding_invalid')
    start=datetime.fromisoformat(c['issued_at']);end=datetime.fromisoformat(c['expires_at'])
    require(start<=datetime.now(timezone.utc)<end and 0<(end-start).total_seconds()<=5,'paid_receipt_expired')
    return c
def migration_request(client,action,data,cache=None):
    rid=uuid.uuid4().hex
    args={'purpose':'private_module_migration216','manifest_sha256':MANIFEST_SHA256,'action':action,'data':data}
    p=proof(client,args,rid,cache)
    return post('/custom/cloudpelizzon/private_install216.php',{'action':action,'data':data,'request_id':rid,'proof':p})
def verify_migration(packet,context,tid):
    require(isinstance(packet,dict) and set(packet)=={'migration','signature','public_key'},'migration_envelope_invalid')
    der=base64.b64decode(packet['public_key'],validate=True)
    require(hashlib.sha256(der).hexdigest()==SIGNER_SHA256,'migration_publisher_changed')
    m=packet['migration'];serialization.load_der_public_key(der).verify(base64.b64decode(packet['signature'],validate=True),
        b'CP-PRIVATE-MIGRATION216\n'+canonical(m),padding.PKCS1v15(),hashes.SHA256())
    require(m.get('schema')=='cp.private.migration216.v1' and m.get('core_id')==context['core_id'] and m.get('signed_id')==context['trial_id']
        and m.get('sku')=='CP-SOLAR' and m.get('transfer_id')==tid and m.get('manifest_sha256')==MANIFEST_SHA256,
        'migration_installation_binding_invalid')
    require(type(m.get('size')) is int and 0<m['size']<=512*1024*1024 and m.get('chunk_size')==262144
        and isinstance(m.get('sha256'),str) and re.fullmatch('[a-f0-9]{64}',m['sha256'])
        and type(m.get('created_at')) is int and -5<=time.time()-m['created_at']<900,'migration_limits_invalid')
    counts=m.get('counts');require(isinstance(counts,dict) and set(counts)=={'solar_config','solar_metric_state','solar_metric_samples'}
        and all(type(v) is int and v>=0 for v in counts.values()) and counts['solar_config']<=1,'migration_counts_invalid')
    return m
def migrate(context,folder,guard,progress):
    guard();tid=uuid.uuid4().hex;client=context['client'];folder=Path(folder);cache={}
    packet=migration_request(client,'prepare',{'transfer_id':tid},cache);guard()
    m=verify_migration(packet,context,tid);snapshot=folder/(tid+'.backup.sqlite3');meta=folder/(tid+'.backup.json')
    fd=os.open(snapshot,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
    digest=hashlib.sha256();offset=0
    with os.fdopen(fd,'wb') as stream:
        while offset<m['size']:
            guard();size=min(m['chunk_size'],m['size']-offset)
            chunk=migration_request(client,'chunk',{'transfer_id':tid,'offset':offset,'size':size},cache)
            raw=base64.b64decode(chunk['data'],validate=True)
            require(chunk['transfer_id']==tid and chunk['offset']==offset and len(raw)==size,'migration_chunk_corrupted')
            stream.write(raw);digest.update(raw);offset+=len(raw);progress('Migrando dados',offset,m['size'])
        stream.flush();os.fsync(stream.fileno())
    require(digest.hexdigest()==m['sha256'],'migration_transfer_hash_mismatch');guard()
    fd=os.open(meta,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as f:f.write(canonical(packet));f.flush();os.fsync(f.fileno())
    result=import_snapshot(snapshot,folder/'solar.sqlite3',expected=m)
    guard();return result

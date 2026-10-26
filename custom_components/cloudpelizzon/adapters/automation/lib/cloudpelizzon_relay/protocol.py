"""Public command validation and receipt verification; no module engine."""

# CP_COMMON_ACCESS207
from ..... import commercial_access207 as _cp_access207
import hashlib,json,os,re,stat
from datetime import datetime,timedelta,timezone
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
OP='automation.rules.execute';SKU='CP-AUTOMATION'
AUTHORITY=bytes.fromhex('3c6f1bfb75285e2077b95c421d18cf34c54d4714bce29e871f74e42b7d53e24b')
SAFE=frozenset(('light.turn_on','light.turn_off','light.toggle','switch.turn_on','switch.turn_off','switch.toggle',
               'input_boolean.turn_on','input_boolean.turn_off'))
FIELDS={'installation_id','code','revision','event_id','sequence','service','data'}
CLAIMS={'schema','installation_id','sku','operation','challenge','args_sha256','decision','entitlement_type',
        'issued_at','expires_at','blocks_at','trial_id'}
def encode(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def detach(value):return json.loads(encode(value))
def digest(value):return hashlib.sha256(encode(value)).hexdigest()
def ident(value,pattern):return isinstance(value,str) and re.fullmatch(pattern,value) is not None
def instant(value):
    value=datetime.fromisoformat(value.replace('Z','+00:00'))
    if value.tzinfo is None:raise ValueError('timezone_required')
    return value.astimezone(timezone.utc)
def binding(iid,args,rid):return digest({'protocol':'cp.cloud.online.v1','installation_id':iid,'sku':SKU,'operation':OP,'args':args,'request_id':rid})
def command(value,iid,allowed):
    value=detach(value)
    if (not isinstance(value,dict) or set(value)!=FIELDS or value['installation_id']!=iid
        or not ident(value['code'],'CUS-[0-9]{8}') or type(value['revision']) is not int or value['revision']<1
        or not ident(value['event_id'],'[A-Za-z0-9_-]{16,128}') or type(value['sequence']) is not int or not 0<=value['sequence']<50
        or value['service'] not in SAFE or not isinstance(value['data'],dict) or len(encode(value))>8192):raise ValueError('command_invalid')
    data=value['data'];targets=data.get('entity_id');targets=[targets] if isinstance(targets,str) else targets
    if (set(data)&{'area_id','device_id','label_id'} or not isinstance(targets,list) or not targets or len(targets)>100
        or any(not isinstance(t,str) or t not in allowed or t.split('.')[0]!=value['service'].split('.')[0] for t in targets)):
        raise PermissionError('command_target_denied')
    return value
def secure_db(path):
    path=Path(path).absolute()
    if path.resolve()!=path:raise ValueError('database_alias')
    parent=path.parent.stat()
    if os.name=='posix' and (parent.st_uid!=os.geteuid() or parent.st_mode&0o022):raise ValueError('database_parent_untrusted')
    try:
        fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600);os.close(fd)
    except FileExistsError:pass
    info=path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1:raise ValueError('database_type')
    if os.name=='posix' and (info.st_uid!=os.geteuid() or info.st_mode&0o077):raise ValueError('database_permissions')
    return str(path)
def verify_receipt(packet, iid, args, rid, now, public=AUTHORITY):
    try:
        if not isinstance(packet, dict) or set(packet) != {'claims', 'signature'}:
            return False
        c = packet['claims']
        if not isinstance(c, dict) or not _cp_access207.valid_receipt_fields(c):
            return False
        Ed25519PublicKey.from_public_bytes(public).verify(bytes.fromhex(packet['signature']), encode(c))
        if not _cp_access207.valid_receipt_kind(c) or c['decision'] != 'allow' or (not _cp_access207.valid_receipt_kind(c)) or (c['installation_id'] != iid) or (c['sku'] != SKU) or (c['operation'] != OP) or (c['args_sha256'] != binding(iid, args, rid)) or (not ident(c['challenge'], '[a-f0-9]{64}')) or (not isinstance(_cp_access207.entitlement_id(c), str)) or (not _cp_access207.entitlement_id(c)):
            return False
        issued, expires, blocks = (instant(_cp_access207.receipt_value(c, k)) for k in ('issued_at', 'expires_at', 'blocks_at'))
        return issued <= now < expires <= blocks and expires <= issued + timedelta(seconds=5)
    except Exception:
        return False

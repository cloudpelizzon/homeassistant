"""Public receipt verification only; no rules, signer or private module engine."""

# CP_COMMON_ACCESS207
from .... import commercial_access207 as _cp_access207
from datetime import datetime,timedelta,timezone
import hashlib,json,re

FIELDS={'schema','installation_id','sku','operation','challenge','args_sha256','decision','entitlement_type',
 'issued_at','expires_at','blocks_at','trial_id'}
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def instant(value):
    if type(value) is not str or len(value)>64:raise ValueError('receipt_time')
    out=datetime.fromisoformat(value.replace('Z','+00:00'))
    if out.tzinfo is None or out.utcoffset() is None:raise ValueError('receipt_timezone')
    return out.astimezone(timezone.utc)
def binding(iid,args,rid):
    return hashlib.sha256(canonical({'protocol':'cp.cloud.online.v1','installation_id':iid,'sku':'CP-AUTOMATION',
        'operation':'automation.rules.execute','args':args,'request_id':rid})).hexdigest()
def verify(packet, iid, args, rid, now, public, challenge=None):
    if type(packet) is not dict or set(packet) != {'claims', 'signature'}:
        raise PermissionError('native_receipt_shape')
    c = packet['claims']
    if type(c) is not dict or not _cp_access207.valid_receipt_fields(c) or (not _cp_access207.valid_receipt_kind(c)) or (c['installation_id'] != iid) or (c['sku'] != 'CP-AUTOMATION') or (c['operation'] != 'automation.rules.execute') or (c['decision'] != 'allow') or (not _cp_access207.valid_receipt_kind(c)) or (c['args_sha256'] != binding(iid, args, rid)) or (type(c['challenge']) is not str) or (not re.fullmatch('[a-f0-9]{64}', c['challenge'])) or (challenge is not None and c['challenge'] != challenge) or (type(_cp_access207.entitlement_id(c)) is not str) or (not _cp_access207.entitlement_id(c)) or (type(packet['signature']) is not str) or (not re.fullmatch('[a-f0-9]{128}', packet['signature'])):
        raise PermissionError('native_receipt_binding')
    public.verify(bytes.fromhex(packet['signature']), canonical(c))
    issued, expires, blocks = (instant(_cp_access207.receipt_value(c, k)) for k in ('issued_at', 'expires_at', 'blocks_at'))
    if not issued <= now < expires <= blocks or expires > issued + timedelta(seconds=5):
        raise PermissionError('native_receipt_expired')
    return json.loads(canonical(c))

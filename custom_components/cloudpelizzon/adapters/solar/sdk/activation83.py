"""Public wire receipt checks only. No enrollment, signer or module engine."""
from datetime import datetime,timedelta,timezone
import json
import re

FIELDS={'schema','installation_id','customer_id','sku','profile','trial_id',
        'activated_at','blocks_at','removal_due_at','phase','issued_at','expires_at','nonce'}


def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()


def instant(value):
    if type(value) is not str or len(value)>64:raise ValueError('invalid_receipt_time')
    result=datetime.fromisoformat(value.replace('Z','+00:00'))
    if result.tzinfo is None or result.utcoffset() is None:raise ValueError('aware_receipt_time_required')
    return result.astimezone(timezone.utc)


def verify_activation(packet,request,now,public):
    if (type(packet) is not dict or set(packet)!={'claims','signature','first_activation'}
        or type(packet['first_activation']) is not bool):raise ValueError('activation_receipt_shape')
    claim=packet['claims']
    if (type(claim) is not dict or set(claim)!=FIELDS
        or claim['schema']!='cp.v2.individual-trial-receipt.v1'
        or claim['installation_id']!=request['installation_id'] or claim['sku']!=request['sku']
        or claim['nonce']!=request['nonce'] or claim['profile']!='production-7d-3d'
        or claim['phase']!='trial_active'
        or type(claim['customer_id']) is not str or not 1<=len(claim['customer_id'])<=160
        or type(claim['trial_id']) is not str or not re.fullmatch('TRIAL-V2-[A-F0-9]{32}',claim['trial_id'])
        or type(packet['signature']) is not str or not re.fullmatch('[a-f0-9]{128}',packet['signature'])):
        raise ValueError('activation_receipt_binding')
    public.verify(bytes.fromhex(packet['signature']),canonical(claim))
    issued,expires,activated,blocks,removal=(instant(claim[k]) for k in
        ('issued_at','expires_at','activated_at','blocks_at','removal_due_at'))
    if (now.tzinfo is None or now.utcoffset() is None or not issued<expires<=issued+timedelta(seconds=5)
        or not timedelta(seconds=-2)<=now-issued<timedelta(seconds=5) or not now<expires
        or not activated<=now+timedelta(seconds=2)<blocks
        or blocks-activated!=timedelta(days=7) or removal-blocks!=timedelta(days=3)):
        raise ValueError('activation_receipt_expired_or_wrong_deadline')
    return json.loads(canonical(claim))

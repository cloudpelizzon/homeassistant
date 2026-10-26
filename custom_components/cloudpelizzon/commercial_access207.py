"""Shared public entitlement contract. No license grants or business engines."""
import re
TRIAL_FIELDS=frozenset({'schema','installation_id','sku','operation','challenge','args_sha256','decision',
    'entitlement_type','issued_at','expires_at','blocks_at','trial_id'})
PAID_FIELDS=frozenset({'schema','installation_id','sku','operation','challenge','args_sha256','decision',
    'entitlement_type','issued_at','expires_at','license_id','license_revision'})

def valid_module_sku(v):return type(v) is str and re.fullmatch('CP-[A-Z0-9-]{2,80}',v) is not None
def valid_capability_token(v):return type(v) is str and len(v)<=8192 and v.startswith(('cpt1.','cpp1.'))
def valid_status_modules(v):return type(v) is dict and len(v)<=128 and all(valid_module_sku(k) for k in v)
def valid_receipt_kind(c):
    if type(c) is not dict:return False
    if c.get('schema')=='cp.trial.effect.v1':
        return c.get('entitlement_type')=='trial' and type(c.get('trial_id')) is str and bool(c['trial_id'])
    if c.get('schema')=='cp.paid.effect206.v1':
        return (c.get('entitlement_type')=='paid' and type(c.get('license_id')) is str and bool(c['license_id'])
            and type(c.get('license_revision')) is int and c['license_revision']>0)
    return False
def valid_receipt_fields(c):
    return (valid_receipt_kind(c) and valid_module_sku(c.get('sku'))
        and set(c)==(PAID_FIELDS if c['entitlement_type']=='paid' else TRIAL_FIELDS))
def entitlement_id(c):return c['license_id'] if c.get('entitlement_type')=='paid' else c['trial_id']
def receipt_value(c,k):
    # Paid receipts have their own signed expiration, not a Trial deadline.
    return c['expires_at'] if k=='blocks_at' and c.get('entitlement_type')=='paid' else c[k]

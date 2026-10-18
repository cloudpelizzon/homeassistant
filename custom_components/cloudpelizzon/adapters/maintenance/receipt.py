"""Public verification of a short-lived authority receipt bound to exact notification confirmation."""
from datetime import timedelta
import hashlib
import json
import re
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from .notification_relay import encode,instant

AUTHORITY=bytes.fromhex('3c6f1bfb75285e2077b95c421d18cf34c54d4714bce29e871f74e42b7d53e24b')
OP='maintenance.notifications.dispatch'
SKU='CP-MAINTENANCE'
FIELDS={'schema','installation_id','sku','operation','challenge','args_sha256','decision','entitlement_type','issued_at','expires_at','blocks_at','trial_id'}

def verify(packet,iid,args,rid,now,public=AUTHORITY):
    try:
        if not isinstance(packet,dict) or set(packet)!={'claims','signature'}:
            return False
        claims=packet['claims']
        if not isinstance(claims,dict) or set(claims)!=FIELDS:
            return False
        if not isinstance(args,dict) or set(args)!={'stage','command','receipt_version'} or args['stage']!='confirm' or type(args['receipt_version']) is not int or args['receipt_version']!=1:
            return False
        if not isinstance(rid,str) or re.fullmatch(r'[A-Za-z0-9_-]{16,128}',rid) is None:
            return False
        signature=packet['signature']
        if not isinstance(signature,str) or re.fullmatch(r'[a-f0-9]{128}',signature) is None:
            return False
        Ed25519PublicKey.from_public_bytes(public).verify(bytes.fromhex(signature),encode(claims))
        binding=hashlib.sha256(encode({'protocol':'cp.cloud.online.v1','installation_id':iid,'sku':SKU,'operation':OP,'args':args,'request_id':rid})).hexdigest()
        if (claims['schema']!='cp.trial.effect.v1' or claims['decision']!='allow' or claims['entitlement_type']!='trial'
            or claims['installation_id']!=iid or claims['sku']!=SKU or claims['operation']!=OP or claims['args_sha256']!=binding
            or not isinstance(claims['challenge'],str) or re.fullmatch(r'[a-f0-9]{64}',claims['challenge']) is None
            or not isinstance(claims['trial_id'],str) or not claims['trial_id']):
            return False
        issued,expires,blocks=(instant(claims[k]) for k in ('issued_at','expires_at','blocks_at'))
        return issued<=now<expires<=blocks and expires<=issued+timedelta(seconds=5)
    except Exception:
        return False

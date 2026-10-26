"""Public Security effect validation; no engine, catalog, keys or device calls."""

# CP_COMMON_ACCESS207
from .. import commercial_access207 as _cp_access207
import hashlib,json,re
from datetime import datetime,timedelta,timezone
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
SKU='CP-SECURITY';OP='security.engine.delayed_action'
AUTHORITY=bytes.fromhex('3c6f1bfb75285e2077b95c421d18cf34c54d4714bce29e871f74e42b7d53e24b')
SERVICES={
 'light':('turn_on','turn_off','toggle'),'switch':('turn_on','turn_off','toggle'),
 'input_boolean':('turn_on','turn_off'),'input_select':('select_option',),'input_number':('set_value',),
 'cover':('open_cover','close_cover','stop_cover'),
 'alarm_control_panel':('alarm_arm_home','alarm_arm_away','alarm_arm_night','alarm_disarm','alarm_trigger'),
 'siren':('turn_on','turn_off'),'persistent_notification':('create',)}
def encode(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def detach(value):return json.loads(encode(value))
def digest(value):return hashlib.sha256(encode(value)).hexdigest()
def ident(value,pattern):return type(value) is str and re.fullmatch(pattern,value) is not None
def instant(value):
 value=datetime.fromisoformat(value.replace('Z','+00:00'))
 if value.tzinfo is None:raise ValueError('timezone_required')
 return value.astimezone(timezone.utc)
def permitted(domain,service,target):
 if domain=='notify':return ident(service,'[a-z_][a-z0-9_]{0,99}') and target==''
 if service not in SERVICES.get(domain,()):return False
 if domain=='persistent_notification':return target==''
 return ident(target,re.escape(domain)+r'\.[a-z0-9_]+')
def policy(value):
 if type(value) is not dict or set(value)!={'reads','effects','notification'}:raise ValueError('security_permission_fields')
 reads=value['reads'];effects=value['effects'];notification=value['notification']
 if type(reads) is not list or len(reads)>64 or any(not ident(e,r'[a-z_]+\.[a-z0-9_]+') for e in reads) or len(set(reads))!=len(reads):raise ValueError('security_read_permissions')
 if type(effects) is not list or len(effects)>200:raise ValueError('security_effect_permissions')
 checked=[]
 for row in effects:
  if type(row) is not list or len(row)!=3 or any(type(x) is not str for x in row) or not permitted(*row) or row in checked:raise ValueError('security_effect_permission')
  checked.append(row)
 if notification is not None:
  if type(notification) is not list or len(notification)!=2 or notification+[''] not in effects or notification[0] not in ('notify','persistent_notification'):raise ValueError('security_notification_permission')
 return {'reads':sorted(reads),'effects':sorted(checked),'notification':notification}
def command(value,iid,allowed):
 value=detach(value)
 if (type(value) is not dict or set(value)!={'installation_id','code','revision','event_id','sequence','service','data'}
  or value['installation_id']!=iid or not ident(value['code'],'[A-Z]{2,8}-[A-Z0-9_-]{1,32}')
  or type(value['revision']) is not int or value['revision']<1 or not ident(value['event_id'],'[a-f0-9]{32}')
  or type(value['sequence']) is not int or not 0<=value['sequence']<32 or not ident(value['service'],r'[a-z_]+\.[a-z0-9_]+')
  or type(value['data']) is not dict or len(encode(value))>8192):raise ValueError('security_command')
 domain,service=value['service'].split('.');data=value['data'];target=data.get('entity_id','')
 if type(target) is not str or (domain,service,target) not in {tuple(row) for row in allowed} or not permitted(domain,service,target):raise PermissionError('security_target_denied')
 if set(data)&{'area_id','device_id','label_id','target','service'}:raise PermissionError('security_target_expansion_denied')
 return value
def binding(iid,args,rid):return digest({'protocol':'cp.cloud.online.v1','installation_id':iid,'sku':SKU,'operation':OP,'args':args,'request_id':rid})
def verify_receipt(packet, iid, args, rid, now, public=AUTHORITY):
    try:
        if type(packet) is not dict or set(packet) != {'claims', 'signature'}:
            return False
        c = packet['claims']
        if type(c) is not dict or not _cp_access207.valid_receipt_fields(c):
            return False
        Ed25519PublicKey.from_public_bytes(public).verify(bytes.fromhex(packet['signature']), encode(c))
        if not _cp_access207.valid_receipt_kind(c) or c['installation_id'] != iid or c['sku'] != SKU or (c['operation'] != OP) or (c['args_sha256'] != binding(iid, args, rid)) or (c['decision'] != 'allow') or (not _cp_access207.valid_receipt_kind(c)) or (not ident(c['challenge'], '[a-f0-9]{64}')) or (type(_cp_access207.entitlement_id(c)) is not str) or (not _cp_access207.entitlement_id(c)):
            return False
        issued, expires, blocks = (instant(_cp_access207.receipt_value(c, k)) for k in ('issued_at', 'expires_at', 'blocks_at'))
        return issued <= now < expires <= blocks and expires <= issued + timedelta(seconds=5)
    except Exception:
        return False

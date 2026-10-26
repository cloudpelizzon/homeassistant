"""Private protocol binding. No keys, identity files, or authority defaults."""
from datetime import datetime, timezone
import hashlib
import json

SKU = 'CP-LIGHTING'
PREFIX = b'CP-LIGHTING-RESULT-V1\n'
OPS = frozenset('lighting.' + name for name in (
    'inventory.page', 'inventory.seal', 'config.read', 'entities.discover',
    'room.create', 'room.update', 'entity.bind', 'entity.configure',
    'entities.assign_room', 'preferences.write'))

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'),
                      ensure_ascii=False, allow_nan=False).encode()

def instant(value):
    if type(value) is not str or len(value) > 64:
        raise ValueError('invalid_time')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.utcoffset() is None:
        raise ValueError('timezone_required')
    return result.astimezone(timezone.utc)

def binding(iid, operation, args, request_id):
    return hashlib.sha256(canonical({'protocol': 'cp.cloud.online.v1',
        'installation_id': iid, 'sku': SKU, 'operation': operation,
        'args': args, 'request_id': request_id})).hexdigest()

def verify_result(packet, envelope, public, now):
    if type(packet) is not dict or set(packet) != {'claims', 'signature'}:
        raise PermissionError('lighting_result_denied')
    c = packet['claims']
    expected = {'schema', 'installation_id', 'sku', 'operation', 'request_id',
                'nonce', 'args_sha256', 'issued_at', 'expires_at', 'result'}
    if type(c) is not dict or set(c) != expected or type(packet['signature']) is not str:
        raise PermissionError('lighting_result_denied')
    public.verify(bytes.fromhex(packet['signature']), PREFIX + canonical(c))
    if (c['schema'] != 'cp.lighting.result.v1' or c['sku'] != SKU
            or envelope['operation'] not in OPS or type(c['result']) is not dict
            or any(c[k] != envelope[k] for k in ('installation_id', 'operation', 'request_id', 'nonce'))
            or c['args_sha256'] != binding(envelope['installation_id'], envelope['operation'],
                                           envelope['args'], envelope['request_id'])):
        raise PermissionError('lighting_result_binding')
    issued, expires = instant(c['issued_at']), instant(c['expires_at'])
    if not issued <= now < expires or not 0 < (expires - issued).total_seconds() <= 5:
        raise PermissionError('lighting_result_expired')
    if len(canonical(c['result'])) > 524288:
        raise PermissionError('lighting_result_size')
    return json.loads(canonical(c['result']))

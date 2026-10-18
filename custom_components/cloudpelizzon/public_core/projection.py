"""Project verified lifecycle claims into the original UI's display contract.

Only Bridge may supply claims, after the signed SDK has verified them. Nothing
in this display projection authorizes execution, download, or local fallback.
"""
from datetime import datetime, timedelta, timezone
from .metadata import MODULES

SKUS = frozenset(('CP-MAINTENANCE', 'CP-SOLAR', 'CP-SECURITY', 'CP-AUTOMATION'))
PHASES = frozenset(('not_started', 'not_entitled', 'trial_active', 'trial_blocked', 'trial_removal_due', 'licensed'))


def timestamp(value):
    if type(value) is not str or len(value) > 64:
        raise ValueError('invalid_timestamp')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('timezone_required')
    return result.astimezone(timezone.utc)


def validate_claim(claim, now):
    if (type(claim) is not dict or set(claim) != {'schema', 'installation_id', 'nonce', 'issued_at', 'expires_at', 'modules'}
            or claim['schema'] != 'cp.r16.lifecycle.signed.v1' or now.tzinfo is None):
        raise ValueError('invalid_lifecycle')
    issued, expires = timestamp(claim['issued_at']), timestamp(claim['expires_at'])
    if not (issued < expires <= issued + timedelta(seconds=5)
            and timedelta(seconds=-2) <= now-issued <= timedelta(seconds=5) and now < expires):
        raise ValueError('expired_lifecycle')
    records = claim['modules']
    if type(records) is not dict or set(records) != SKUS:
        raise ValueError('invalid_module_set')
    for row in records.values():
        if (type(row) is not dict or set(row) != {'phase', 'paid_confirmed', 'blocks_at', 'removal_due_at'}
                or row['phase'] not in PHASES or type(row['paid_confirmed']) is not bool):
            raise ValueError('invalid_module_status')
        deadline = timestamp(row['blocks_at']) if row['blocks_at'] is not None else None
        removal = timestamp(row['removal_due_at']) if row['removal_due_at'] is not None else None
        if removal is not None and (deadline is None or removal < deadline):
            raise ValueError('invalid_removal_deadline')
        if row['phase'] == 'trial_active' and (row['paid_confirmed'] or deadline is None or now >= deadline):
            raise ValueError('invalid_active_trial')
        if row['phase'] == 'not_started' and (deadline is not None or removal is not None or row['paid_confirmed']):
            raise ValueError('invalid_unstarted_trial')
        if row['phase'] == 'licensed' and row['paid_confirmed'] is not True:
            raise ValueError('unconfirmed_paid_license')
    return records


def project(claim, *, core_id, installed, now, version):
    records = validate_claim(claim, now)
    rows = []
    paid = []
    for sku, metadata in MODULES.items():
        row = {'sku': sku, **metadata, 'installed': sku in installed,
               'license': {'sku': sku, 'allowed': False, 'status': 'locked', 'reason': 'not_entitled'}}
        record = records.get(sku)
        if record is not None:
            is_paid = record['paid_confirmed'] is True and record['phase'] == 'licensed'
            row['trial'] = {'verified': True, **record}
            row['license'] = {'sku': sku, 'allowed': is_paid,
                              'status': 'licensed' if is_paid else 'locked',
                              'reason': None if is_paid else 'commercial_license_not_confirmed'}
            if is_paid:
                paid.append(sku)
        rows.append(row)
    # Core/Portal ID is intentionally distinct from the Trial/Gateway identity.
    return {'core_version': version, 'installation_id': core_id, 'created_at': None,
            'license': {'present': bool(paid), 'license_id': None, 'customer': None,
                        'expires_at': None, 'modules': paid, 'activation_id': None,
                        'online_status': 'active' if paid else 'not_activated',
                        'last_checkin_at': None, 'last_checkin_error': None,
                        'lease_valid_until': None, 'license_revision': 0,
                        'server_url': 'https://api.cloudpelizzon.com.br'},
            'modules': rows}

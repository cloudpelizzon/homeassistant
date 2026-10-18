"""Existing wire contracts without customer state, keys or server policies."""
import base64
import json
import re
import secrets
import time

FLEET_URL = 'https://downloads.cloudpelizzon.com.br/fleet-gateway/api/v1/activate'
PORTAL_ORIGIN = 'https://cliente.cloudpelizzon.com.br'
CORE_ID = re.compile(r'[0-9a-f]{32}\Z')
PAIR_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{11,127}\Z')
CODE = re.compile(r'CP-[A-Z0-9]{6}(?:-[A-Z0-9]{6}){3}\Z')
PREFIX = b'CP-PORTAL-PAIR-V1\n'


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


def unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate_response_field')
        result[key] = value
    return result


def fleet_payload(core_id, code, *, consent, version, ha_version):
    if (type(core_id) is not str or not CORE_ID.fullmatch(core_id)
            or consent is not True or type(code) is not str):
        raise PermissionError('invalid_enrollment')
    code = code.strip().upper()
    if not CODE.fullmatch(code):
        raise PermissionError('invalid_enrollment')
    for value in (version, ha_version):
        if type(value) is not str or not value or len(value) > 64 or not value.isprintable():
            raise ValueError('invalid_version')
    return {'code': code, 'installation_id': core_id, 'fleet_reporting_consent': True,
            'cloudpelizzon_version': version, 'ha_version': ha_version}


def fleet_ack(status, content_type, raw, core_id):
    if (status != 200 or type(raw) is not bytes or len(raw) > 8192
            or content_type.split(';', 1)[0].strip().lower() != 'application/json'):
        raise PermissionError('fleet_denied_or_unavailable')
    doc = json.loads(raw, object_pairs_hook=unique,
                     parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite_json')))
    if (not isinstance(doc, dict) or doc.get('ok') is not True
            or doc.get('status') != 'registered' or doc.get('installation_id') != core_id):
        raise PermissionError('fleet_invalid_ack')
    # Do not forward server extras, license material or enrollment codes to the UI.
    return {'registered': True, 'installation_id': core_id}


def portal_assertion(core_id, signer, *, clock=time.time):
    # Sign with the separately approved Core/Portal key, NEVER the Trial key.
    if type(core_id) is not str or not CORE_ID.fullmatch(core_id):
        raise PermissionError('invalid_portal_identity')
    now = int(clock())
    claim = {'v': 1, 'aud': PORTAL_ORIGIN, 'installation_id': core_id,
             'nonce': secrets.token_hex(32), 'iat': now, 'exp': now + 90}
    signature = signer(PREFIX + canonical(claim))
    if type(signature) is not bytes or len(signature) != 64:
        raise PermissionError('invalid_portal_signer')
    outer = {'claim': claim, 'signature': signature.hex()}
    assertion = base64.urlsafe_b64encode(canonical(outer)).rstrip(b'=').decode('ascii')
    return {'assertion': assertion, 'expires_at': claim['exp']}


async def post_fleet(session, payload):
    import asyncio
    # The supplied HA session retains normal public CA/hostname verification.
    async with asyncio.timeout(12):
        async with session.post(FLEET_URL, json=payload, allow_redirects=False) as response:
            raw = await response.content.read(8193)
            return fleet_ack(response.status, response.headers.get('Content-Type', ''), raw,
                             payload['installation_id'])

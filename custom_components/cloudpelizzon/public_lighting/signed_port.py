"""HA adapter over the existing signed SDK, with mandatory signed results."""

# CP_COMMON_ACCESS207
from .. import commercial_access207 as _cp_access207
import asyncio
from datetime import timedelta
import json
import re
import secrets
from .wire import OPS, SKU, binding, canonical, instant, verify_result

ID = re.compile(r'[A-Za-z0-9_-]{1,128}\Z')
BASE_SKUS = {'CP-MAINTENANCE', 'CP-SOLAR', 'CP-SECURITY', 'CP-AUTOMATION'}

class SignedLightingPort:
    def __init__(self, hass, client, *, package_ready):
        if not callable(package_ready):
            raise ValueError('verified_package_required')
        self.hass, self.client, self.package_ready = hass, client, package_ready
        self.closed = False

    def registration_ready(self):
        # Package availability is not entitlement. Every request reauthorizes remotely.
        return not self.closed and self.package_ready() is True

    def installation_id(self):
        return self.client._iid

    def state_get(self, entity_id):
        return self.hass.states.get(entity_id)

    def close(self):
        self.closed = True

    def _check(self, iid, actor, operation):
        if (not self.registration_ready() or iid != self.installation_id()
                or type(actor) is not str or not ID.fullmatch(actor) or operation not in OPS):
            raise PermissionError('lighting_unavailable')

    async def _run(self, fn, *args):
        try:
            result = await self.hass.async_add_executor_job(fn, *args)
            if not self.registration_ready():
                raise PermissionError()
            return result
        except asyncio.CancelledError:
            raise
        except Exception:
            raise PermissionError('lighting_unavailable') from None

    def verified_status(self):
        if not self.registration_ready():
            raise PermissionError('lighting_unavailable')
        iid = self.installation_id()
        packet, nonce = self.client._control('status')
        if type(packet) is not dict or set(packet) != {'claims', 'signature'}:
            raise PermissionError()
        c = packet['claims']
        if type(c) is not dict or set(c) != {'schema', 'installation_id', 'nonce', 'issued_at', 'expires_at', 'modules'}:
            raise PermissionError()
        self.client._authority.verify(bytes.fromhex(packet['signature']), canonical(c))
        now = self.client._clock()
        issued, expires = (instant(c['issued_at']), instant(c['expires_at']))
        if c['schema'] != 'cp.r16.lifecycle.signed.v1' or c['installation_id'] != iid or c['nonce'] != nonce or (not issued <= now < expires <= issued + timedelta(seconds=5)) or (type(c['modules']) is not dict) or (not _cp_access207.valid_status_modules(c['modules'])):
            raise PermissionError()
        for row in c['modules'].values():
            if type(row) is not dict or set(row) != {'phase', 'paid_confirmed', 'blocks_at', 'removal_due_at'} or row['phase'] not in {'not_started', 'not_entitled', 'trial_active', 'trial_blocked', 'trial_removal_due', 'licensed'} or (type(row['paid_confirmed']) is not bool):
                raise PermissionError()
            for field in ('blocks_at', 'removal_due_at'):
                if row[field] is not None:
                    instant(row[field])
        return json.loads(canonical(c))

    def _grant(self, iid, actor, operation):
        self._check(iid, actor, operation)
        c = self.verified_status()
        now = self.client._clock()
        if SKU not in c['modules']:
            raise PermissionError()
        module = c['modules'][SKU]
        if type(module) is not dict or set(module) != {'phase', 'paid_confirmed', 'blocks_at', 'removal_due_at'}:
            raise PermissionError()
        if module['phase'] == 'licensed' and module['paid_confirmed'] is True:
            return {'sku': SKU, 'gateway_verified': True, 'license': {'allowed': True}}
        if (module['phase'] != 'trial_active' or module['paid_confirmed'] is not False
                or not now < instant(module['blocks_at'])):
            raise PermissionError()
        return {'sku': SKU, 'gateway_verified': True,
                'trial': {'verified': True, 'phase': 'trial_active', 'paid_confirmed': False}}

    async def issue_grant(self, iid, actor, operation):
        return await self._run(self._grant, iid, actor, operation)

    def _execute(self, iid, actor, operation, args, rid):
        self._check(iid, actor, operation)
        if type(rid) is not str or not re.fullmatch('[A-Za-z0-9_-]{16,128}', rid):
            raise PermissionError()
        args = json.loads(canonical(args))
        if len(canonical(args)) > 40000 or args.get('actor_id') != actor:
            raise PermissionError()
        self._grant(iid, actor, operation)
        cap, _ = self.client._control('capability', {'sku': SKU, 'operation': operation})
        if type(cap) is not dict or set(cap) != {'ok', 'operation', 'token'} or cap['ok'] is not True or (cap['operation'] != operation) or (type(cap['token']) is not str) or (not _cp_access207.valid_capability_token(cap['token'])) or (len(cap['token']) > 8192):
            raise PermissionError()
        proofs = [self.client._sign({'installation_id': iid, 'sku': SKU, 'operation': operation, 'challenge': secrets.token_hex(32), 'args_sha256': binding(iid, operation, args, rid), 'token': cap['token'], 'nonce': secrets.token_hex(32), 'timestamp': int(self.client._clock().timestamp())}) for _ in range(2)]
        if proofs[0]['nonce'] == proofs[1]['nonce'] or proofs[0]['challenge'] == proofs[1]['challenge']:
            raise PermissionError()
        envelope = self.client._sign({'v': 3, 'installation_id': iid, 'operation': operation, 'args': args, 'request_id': rid, 'proofs': proofs, 'timestamp': int(self.client._clock().timestamp()), 'nonce': secrets.token_hex(32)}, b'CP-GATEWAY-EXECUTE-V3\n', 'signature')
        packet = self.client._send('/v1/execute', envelope)
        result = verify_result(packet, envelope, self.client._authority, self.client._clock())
        self._grant(iid, actor, operation)
        self._check(iid, actor, operation)
        return result

    async def execute(self, iid, actor, operation, parameters, rid):
        return await self._run(self._execute, iid, actor, operation,
                               {'actor_id': actor, 'parameters': parameters}, rid)

    async def read_page(self, iid, actor, parameters, rid):
        return await self.execute(iid, actor, 'lighting.config.read', parameters, rid)

    async def _inventory(self, iid, actor, operation_rid, batch, digest, stage_id, kind, extra):
        payload = {'sku': SKU, 'kind': kind, 'installation_id': iid, 'actor_id': actor,
                   'operation_request_id': operation_rid, 'batch_id': batch, 'digest': digest, **extra}
        result = await self._run(self._execute, iid, actor, 'lighting.inventory.' + kind,
                               {'actor_id': actor, 'payload': payload}, stage_id)
        if result != {'accepted': True, 'kind': kind, 'batch_id': batch}:
            raise PermissionError('lighting_inventory_denied')
        return True

    async def stage_inventory_page(self, iid, actor, rid, batch, digest, total, offset, items, stage_id):
        return await self._inventory(iid, actor, rid, batch, digest, stage_id, 'page',
                                     {'total': total, 'offset': offset, 'items': items})

    async def seal_inventory(self, iid, actor, rid, batch, digest, stage_id):
        return await self._inventory(iid, actor, rid, batch, digest, stage_id, 'seal', {})

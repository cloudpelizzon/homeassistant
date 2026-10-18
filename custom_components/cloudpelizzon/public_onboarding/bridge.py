"""Admin-only handoffs for existing provisioned entries. No trial activation."""
import asyncio
from .protocol import CORE_ID, fleet_payload, portal_assertion

STATUS = 'cloudpelizzon/core/fleet/status'
REGISTER = 'cloudpelizzon/core/fleet/register'
PAIR = 'cloudpelizzon/core/portal/pair'
CONTRACTS = frozenset((STATUS, REGISTER, PAIR))


class Bridge:
    def __init__(self, *, core_id, trial_id, entry_data, persist, post,
                 portal_signer, executor, version, ha_version):
        self.core_id, self.trial_id = core_id, trial_id
        if (type(core_id) is not str or not CORE_ID.fullmatch(core_id)
                or type(trial_id) is not str or not trial_id or core_id == trial_id):
            raise ValueError('separate_identities_required')
        self.entry_data, self.persist, self.post = entry_data, persist, post
        self.portal_signer, self.executor = portal_signer, executor
        self.version, self.ha_version = version, ha_version
        self.lock = asyncio.Lock()
        self.closed = False

    def close(self):
        self.closed = True

    def check(self, authorized):
        if self.closed or authorized() is not True:
            raise PermissionError('active_admin_required')

    def status(self):
        data = self.entry_data()
        registered = (data.get('fleet_registered') is True
                      and data.get('fleet_installation_id') == self.core_id
                      and data.get('fleet_reporting_consent') is True)
        return {'registered': registered, 'installation_id': self.core_id}

    async def handle(self, command, args, *, authorized):
        self.check(authorized)
        if command not in CONTRACTS or type(args) is not dict:
            raise PermissionError('invalid_command')
        expected = {'code', 'consent'} if command == REGISTER else set()
        if set(args) != expected:
            raise PermissionError('invalid_arguments')
        if command == STATUS:
            return self.status()
        if command == PAIR:
            if self.portal_signer is None:
                raise PermissionError('approved_portal_signer_required')
            result = await self.executor(portal_assertion, self.core_id, self.portal_signer)
            self.check(authorized)
            return result
        payload = fleet_payload(self.core_id, args['code'], consent=args['consent'],
                                version=self.version, ha_version=self.ha_version)
        if self.lock.locked():
            raise PermissionError('registration_busy')
        async with self.lock:
            self.check(authorized)
            if self.status()['registered']:
                return self.status()
            if self.entry_data().get('fleet_registered'):
                raise PermissionError('existing_registration_mismatch')
            result = await self.post(payload)
            self.check(authorized)
            if result != {'registered': True, 'installation_id': self.core_id}:
                raise PermissionError('invalid_registration_ack')
            # Preserve unrelated entry data; no secret/code/license stored here.
            data = dict(self.entry_data())
            if data.get('fleet_registered') and not self.status()['registered']:
                raise PermissionError('existing_registration_mismatch')
            self.persist({**data, 'fleet_registered': True,
                          'fleet_installation_id': self.core_id,
                          'fleet_reporting_consent': True, 'fleet_enrollment_schema': 1})
            return result

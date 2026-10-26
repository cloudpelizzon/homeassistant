"""Fresh signed status only. A UI read never activates or extends a trial."""
import asyncio
from datetime import datetime, timezone
import re
import time
from .metadata import MODULES
from .projection import project, validate_claim, unavailable_catalog
from ..adapters.solar.sdk.client import ClientError

STATUS = 'cloudpelizzon/core/status'
LICENSE = 'cloudpelizzon/core/license/status'
REFRESH = 'cloudpelizzon/core/access/refresh'
CONTRACTS = frozenset((STATUS, LICENSE, REFRESH))


class CoreBridge:
    def __init__(self, fetch_verified, *, core_id, installed=(), clock=None, monotonic=None, version='0.13.0'):
        if type(core_id) is not str or not re.fullmatch('[0-9a-f]{32}', core_id):
            raise ValueError('core_identity_required')
        if not isinstance(installed, (set, frozenset, tuple, list)) or any(sku not in MODULES for sku in installed):
            raise ValueError('invalid_installed_metadata')
        self.fetch_verified = fetch_verified
        self.core_id = core_id
        self.installed = frozenset(installed)
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.monotonic = monotonic or time.monotonic
        self.version = version
        self.closed = False
        self.last_wall = None
        self.last_mono = None
        self.local_ready=lambda:set()

    @classmethod
    def from_client(cls, hass, client, **kwargs):
        # Use only the audited SDK's signature/identity/nonce/five-second verifier.
        async def fetch_verified():
            return await hass.async_add_executor_job(client.status)
        return cls(fetch_verified, **kwargs)

    def close(self):
        self.closed = True

    async def handle(self, command, args=None, *, active=False):
        if self.closed or active is not True:
            raise PermissionError('active_session_required')
        if command not in CONTRACTS or type(args if args is not None else {}) is not dict:
            raise ValueError('invalid_command')
        args = {} if args is None else args
        if command == LICENSE:
            if set(args) != {'sku'} or type(args['sku']) is not str or args['sku'] not in MODULES:
                raise ValueError('unknown_module')
        elif args:
            raise ValueError('unexpected_arguments')
        before_wall, before_mono = self.clock(), self.monotonic()
        if self.last_mono is not None and (before_mono < self.last_mono or before_wall < self.last_wall):
            raise PermissionError('clock_regressed')
        self.last_wall, self.last_mono = before_wall, before_mono
        try:
            claim = await self.fetch_verified()
        except ClientError as error:
            # Only the audited SDK's fixed error codes may enter a public DTO.
            # HTTP denial is not proof of enrollment state, absence of a paid
            # license or a new trial; never fabricate a lifecycle claim here.
            if command != STATUS or self.closed:
                raise
            code = str(error)
            if code not in ('request_denied_http_401', 'request_denied_http_403',
                            'request_denied_http_429', 'request_denied_http_500',
                            'request_denied_http_502', 'request_denied_http_503',
                            'transport_failed', 'status_not_verified', 'response_invalid'):
                code = 'access_not_verified'
            return unavailable_catalog(core_id=self.core_id, installed=self.installed,
                                       version=self.version, reason=code)
        now, elapsed = self.clock(), self.monotonic() - before_mono
        if self.closed or elapsed < 0 or elapsed >= 5 or now < before_wall:
            raise PermissionError('status_no_longer_fresh')
        validate_claim(claim, now)
        view = project(claim, core_id=self.core_id, installed=self.installed, now=now, version=self.version)
        view['status_verified']=True
        local=self.local_ready()
        for module in view['modules']:module['local_installed']=module['sku'] in local
        if command == STATUS:
            return view
        if command == LICENSE:
            row = next(item for item in view['modules'] if item['sku'] == args['sku'])
            trial = row.get('trial', {})
            # Presentation permission only; operations always use SDK.execute.
            trial_active = trial.get('verified') is True and trial.get('phase') == 'trial_active' and trial.get('paid_confirmed') is False
            return {**row['license'], 'allowed': row['license']['allowed'] or trial_active,
                    'status': 'trial_active' if trial_active else row['license']['status'],
                    'entitlement_type': 'trial' if trial_active else 'paid' if row['license']['allowed'] else None,
                    'trial_blocks_at': trial.get('blocks_at') if trial_active else None,
                    'installation_id': self.core_id, 'module': row['name'], 'preview': row['preview'], 'path': row['path']}
        return {'online_status': view['license']['online_status'],
                'modules': [{'sku': row['sku'], 'allowed': row['license']['allowed'] or (
                    row.get('trial', {}).get('phase') == 'trial_active' and row.get('trial', {}).get('paid_confirmed') is False),
                    'status': row['trial']['phase'] if 'trial' in row else row['license']['status']}
                    for row in view['modules']]}

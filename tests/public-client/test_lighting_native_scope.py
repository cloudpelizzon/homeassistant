"""Synthetic, self-contained native boundary tests; never touch real HA or secrets."""
import asyncio
import importlib.util
import unittest
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace, MappingProxyType

MODULE = Path(__file__).resolve().parents[2] / 'staging/lighting/native_scope.py'
spec = importlib.util.spec_from_file_location('native_scope', MODULE)
ns = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ns)


@dataclass
class Actor:
    id: str = 'actor_1'
    is_active: bool = True
    is_admin: bool = False
    system_generated: bool = False
    permissions: object = None


class Permissions:
    def __init__(self, allowed=None):
        self.allowed = set(allowed or ())
        self.calls = []

    def check_entity(self, entity_id, kind):
        self.calls.append((entity_id, kind))
        return entity_id in self.allowed and kind == 'read'


def fixture():
    return {
        'revision': 12,
        'rooms': [{'id': 'living', 'name': 'Sala'}, {'id': 'private', 'name': 'Privado'}],
        'items': [
            {'entity_id': 'light.living', 'name': 'Luz principal', 'kind': 'light',
             'capabilities': ['on_off'], 'visible': True, 'room_id': 'living', 'icon': 'bulb'},
            {'entity_id': 'switch.led', 'name': 'LED ligado ao relé', 'kind': 'light',
             'capabilities': ['on_off'], 'visible': True, 'room_id': 'living', 'icon': 'led'},
            {'entity_id': 'light.secret', 'name': 'Nome privado', 'kind': 'light',
             'capabilities': ['on_off'], 'visible': True, 'room_id': 'private', 'icon': 'bulb'},
            {'entity_id': 'binary_sensor.motion', 'name': 'Movimento permitido', 'kind': 'sensor',
             'capabilities': [], 'visible': True, 'room_id': 'living', 'icon': 'sensor'},
        ],
        'preferences': {'theme': 'flux'},
    }


class Harness:
    def __init__(self):
        self.data = fixture()
        self.permissions = Permissions(['light.living', 'switch.led', 'binary_sensor.motion'])
        self.user = Actor(permissions=self.permissions)
        self.connection = SimpleNamespace(user=self.user, closed=False)
        self.iid = 'installation_1'
        self.grant = {'sku': 'CP-LIGHTING', 'gateway_verified': True, 'license': {'allowed': True}}
        self.calls = []
        self.states_read = []
        self.states = {
            'light.living': SimpleNamespace(entity_id='light.living', state='on', attributes={
                'brightness': 177, 'supported_color_modes': ['brightness'],
                'device_id': 'should-not-escape', 'longitude': -49, 'latitude': -25}),
            'switch.led': SimpleNamespace(entity_id='switch.led', state='off', attributes={}),
            'light.secret': SimpleNamespace(entity_id='light.secret', state='on', attributes={}),
        }
        self.scope = self._scope()

    def _scope(self):
        return ns.NativeLightingReadScope(
            installation_id=lambda: self.iid,
            issue_grant=self.authorize,
            read_page=self.read_page,
            state_get=self.state_get,
        )

    async def authorize(self, iid, user, operation):
        self.calls.append(('authorize', iid, user, operation))
        return self.grant

    async def read_page(self, iid, user, params, request_id):
        self.calls.append(('read', iid, user, dict(params), request_id))
        if params['limit'] != 100:
            raise AssertionError('page limit')
        data = self.data
        return {k: v for k, v in data.items() if k != 'items'} | {
            'items': data['items'][params['offset']:params['offset'] + params['limit']],
            'total': len(data['items']),
        }

    def state_get(self, entity_id):
        self.states_read.append(entity_id)
        return self.states.get(entity_id)


class NativeScopeTests(unittest.IsolatedAsyncioTestCase):
    async def test_actor_and_installation_come_from_trusted_session(self):
        h = Harness()
        result = await h.scope.snapshot(h.connection)
        self.assertEqual(result['sku'], 'CP-LIGHTING')
        self.assertEqual(result['configuration']['preferences'], {'theme': 'flux'})
        self.assertEqual(result['configuration']['total'], 3)
        self.assertEqual(set(result['states']), {'light.living', 'switch.led'})
        for call in h.calls:
            self.assertEqual(call[1:3], ('installation_1', 'actor_1'))
        self.assertEqual(len({call[4] for call in h.calls if call[0]=='read'}), 1)

    async def test_unauthorized_state_metadata_and_room_do_not_leave_scope(self):
        h = Harness()
        response = await h.scope.snapshot(h.connection)
        import json
        encoded = json.dumps(response)
        self.assertNotIn('light.secret', encoded)
        self.assertNotIn('Nome privado', encoded)
        self.assertNotIn('Privado', encoded)
        self.assertNotIn('should-not-escape', encoded)
        self.assertNotIn('longitude', encoded)
        self.assertNotIn('latitude', encoded)
        self.assertEqual(response['configuration']['rooms'], [{'id': 'living', 'name': 'Sala'}])
        self.assertTrue(all(policy == 'read' for _, policy in h.permissions.calls))
        self.assertNotIn('light.secret', h.states_read)

    async def test_admin_still_requires_signed_gateway_authorization(self):
        h = Harness()
        h.user.is_admin = True
        allowed = await h.scope.snapshot(h.connection)
        self.assertEqual(allowed['configuration']['total'], 4)
        h.grant = None
        with self.assertRaisesRegex(ns.LightingReadDenied, '^lighting_read_unavailable$'):
            await h.scope.snapshot(h.connection)

    async def test_missing_inactive_or_system_identity_is_denied(self):
        for patch in [{'id': None}, {'is_active': False}, {'system_generated': True}, {'id': '../bad'}]:
            h = Harness()
            for key, value in patch.items(): setattr(h.user, key, value)
            with self.subTest(patch=patch), self.assertRaises(ns.LightingReadDenied):
                await h.scope.snapshot(h.connection)
            self.assertFalse(h.states_read)

    async def test_connection_closed_is_denied(self):
        h = Harness()
        h.connection.closed = True
        with self.assertRaises(ns.LightingReadDenied): await h.scope.snapshot(h.connection)

    async def test_identity_swap_during_await_fails_closed(self):
        h = Harness()
        async def swap(iid, user, operation):
            await asyncio.sleep(0)
            h.connection.user = Actor(id='actor_2', is_active=True, permissions=h.permissions)
            return h.grant
        h.scope = ns.NativeLightingReadScope(
            installation_id=lambda: h.iid, issue_grant=swap,
            read_page=h.read_page, state_get=h.state_get)
        with self.assertRaises(ns.LightingReadDenied): await h.scope.snapshot(h.connection)
        self.assertEqual(h.states_read, [])

    async def test_installation_changes_during_request_are_rejected(self):
        h = Harness()
        async def swapped(iid, user, operation):
            h.iid = 'installation_2'
            return h.grant
        h.scope = ns.NativeLightingReadScope(
            installation_id=lambda: h.iid, issue_grant=swapped,
            read_page=h.read_page, state_get=h.state_get)
        with self.assertRaises(ns.LightingReadDenied): await h.scope.snapshot(h.connection)

    async def test_expiration_or_revocation_during_pages_fail_closed(self):
        h = Harness()
        h.data['items'] = [h.data['items'][0] for _ in range(101)]
        # Duplicate items are rejected, so use valid distinct IDs.
        h.data['items'] = [dict(h.data['items'][0], entity_id=f'light.item_{i}') for i in range(101)]
        h.permissions.allowed = {row['entity_id'] for row in h.data['items']}
        count = 0
        async def changing(iid, actor, operation):
            nonlocal count
            count += 1
            if count == 3:
                h.grant = {'sku': 'CP-LIGHTING', 'gateway_verified': True,
                           'trial': {'verified': True, 'phase': 'trial_expired', 'paid_confirmed': False}}
            return h.grant
        h.scope = ns.NativeLightingReadScope(
            installation_id=lambda: h.iid, issue_grant=changing,
            read_page=h.read_page, state_get=h.state_get)
        with self.assertRaises(ns.LightingReadDenied): await h.scope.snapshot(h.connection)
        self.assertEqual(h.states_read, [])

    async def test_expiry_final_gateway_check_does_not_return_payload(self):
        h = Harness()
        count = 0
        async def changing(iid, actor, op):
            nonlocal count
            count += 1
            if count >= 4:
                return {'sku': 'CP-LIGHTING', 'gateway_verified': True,
                        'trial': {'verified': True, 'phase': 'trial_expired', 'paid_confirmed': False}}
            return h.grant
        h.scope = ns.NativeLightingReadScope(
            installation_id=lambda: h.iid, issue_grant=changing,
            read_page=h.read_page, state_get=h.state_get)
        with self.assertRaises(ns.LightingReadDenied): await h.scope.snapshot(h.connection)

    async def test_native_read_permission_revocation_before_return_denies_all(self):
        h = Harness()
        def state_get(eid):
            if eid == 'light.living':
                h.permissions.allowed.remove('light.living')
            return h.states.get(eid)
        h.scope = ns.NativeLightingReadScope(
            installation_id=lambda: h.iid, issue_grant=h.authorize,
            read_page=h.read_page, state_get=state_get)
        with self.assertRaises(ns.LightingReadDenied): await h.scope.snapshot(h.connection)

    async def test_zero_permission_leaks_neither_entity_count_nor_rooms(self):
        h = Harness()
        h.permissions.allowed.clear()
        response = await h.scope.snapshot(h.connection)
        self.assertEqual(response['configuration']['total'], 0)
        self.assertEqual(response['configuration']['rooms'], [])
        self.assertEqual(response['states'], {})
        self.assertTrue(h.calls)

    async def test_missing_state_leaves_row_visible_for_unavailable_presentation(self):
        h = Harness()
        h.states.pop('light.living')
        result = await h.scope.snapshot(h.connection)
        self.assertNotIn('light.living', result['states'])
        self.assertIn('light.living', [x['entity_id'] for x in result['configuration']['items']])

    async def test_different_revision_across_pages_denied(self):
        h = Harness()
        h.data['items'] = [dict(h.data['items'][0], entity_id=f'light.x_{i}') for i in range(101)]
        calls = 0
        async def read(iid, actor, params, rid):
            nonlocal calls
            calls += 1
            result = await h.read_page(iid, actor, params, rid)
            if calls == 2: result['revision'] = result['revision'] + 1
            return result
        h.scope = ns.NativeLightingReadScope(
            installation_id=lambda: h.iid, issue_grant=h.authorize,
            read_page=read, state_get=h.state_get)
        with self.assertRaises(ns.LightingReadDenied): await h.scope.snapshot(h.connection)
        self.assertEqual(h.states_read, [])

    async def test_empty_and_bad_config_contracts_are_blocked(self):
        for bad in ([], {'items': []}, {**fixture(), 'rooms': [
            {'id': 'living', 'name': 'Sala'}, {'id': 'living', 'name': 'Replicada'}]},
                    {**fixture(), 'items': [dict(fixture()['items'][0], icon='path/to/private')]},
                    {**fixture(), 'preferences': {'theme': 'invalid'}}):
            h = Harness(); h.data = bad
            with self.subTest(kind=type(bad).__name__), self.assertRaises(ns.LightingReadDenied):
                await h.scope.snapshot(h.connection)

    async def test_signed_failure_message_never_propagates(self):
        h = Harness()
        async def broken(*_): raise RuntimeError('internal-private-credential-marker')
        h.scope = ns.NativeLightingReadScope(
            installation_id=lambda: h.iid, issue_grant=broken,
            read_page=h.read_page, state_get=h.state_get)
        with self.assertRaisesRegex(ns.LightingReadDenied, '^lighting_read_unavailable$') as ctx:
            await h.scope.snapshot(h.connection)
        self.assertNotIn('internal-private', str(ctx.exception))

    async def test_cancellation_bubbles_without_delivering_state(self):
        h = Harness()
        async def cancelled(*_): raise asyncio.CancelledError()
        h.scope = ns.NativeLightingReadScope(
            installation_id=lambda: h.iid, issue_grant=cancelled,
            read_page=h.read_page, state_get=h.state_get)
        with self.assertRaises(asyncio.CancelledError): await h.scope.snapshot(h.connection)

    async def test_201_items_paginate_with_dedicated_request_ids(self):
        h = Harness()
        h.data['items'] = [dict(h.data['items'][0], entity_id=f'light.bulb_{i}') for i in range(201)]
        h.permissions.allowed = {x['entity_id'] for x in h.data['items']}
        result = await h.scope.snapshot(h.connection)
        self.assertEqual(result['configuration']['total'], 201)
        pages = [c for c in h.calls if c[0] == 'read']
        self.assertEqual([c[3]['offset'] for c in pages], [0, 100, 200])
        self.assertEqual(len(set(c[4] for c in pages)), 3)

    async def test_only_allowlisted_state_attributes_are_serialized(self):
        h = Harness()
        h.states['light.living'].attributes['brightness'] = True
        h.states['light.living'].attributes['supported_color_modes'] = ['onoff', 'not-a-color']
        result = await h.scope.snapshot(h.connection)
        self.assertEqual(result['states']['light.living']['attributes'], {})

    async def test_native_attribute_mapping_and_color_mode_str_enum(self):
        from enum import StrEnum
        class Mode(StrEnum):
            RGB = 'rgb'
        h = Harness()
        h.states['light.living'].attributes = MappingProxyType({
            'supported_color_modes': [Mode.RGB], 'color_mode': Mode.RGB, 'brightness': 200})
        result = await h.scope.snapshot(h.connection)
        self.assertEqual(result['states']['light.living']['attributes'], {
            'supported_color_modes': ['rgb'], 'color_mode': 'rgb', 'brightness': 200})

    async def test_no_private_grant_fields_allowed(self):
        h = Harness()
        h.grant['authorization_token'] = 'not-for-client'
        with self.assertRaises(ns.LightingReadDenied): await h.scope.snapshot(h.connection)

    async def test_requires_all_trusted_ports(self):
        with self.assertRaises(ValueError):
            ns.NativeLightingReadScope(installation_id=lambda: 'i', issue_grant=None,
                                       read_page=lambda: None, state_get=lambda: None)


if __name__ == '__main__':
    unittest.main()

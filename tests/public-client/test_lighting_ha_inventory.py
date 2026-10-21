import asyncio
import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace as N

P = Path(__file__).resolve().parents[2]/'staging/lighting/ha_inventory.py'
spec = importlib.util.spec_from_file_location('cp_lighting_native_inventory', P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def entity(id, **attrs):
    return N(entity_id=id, attributes=attrs)


class Permissions:
    def __init__(self, permitted=()):
        self.permitted = set(permitted)
    def check_entity(self, eid, op):
        return op == 'read' and eid in self.permitted


class Harness:
    def __init__(self):
        self.rows = [entity('light.sala', friendly_name='Luz da Sala', brightness=100, latitude=-25, token='SECRET'),
                     entity('switch.rele', friendly_name='Relé'),
                     entity('binary_sensor.presenca', friendly_name='Movimento', device_class='motion'),
                     entity('binary_sensor.porta', friendly_name='Porta', device_class='door'),
                     entity('sensor.private', friendly_name='Não exibir')]
        self.user=N(id='actor_one', is_active=True,is_admin=False,system_generated=False,
                    permissions=Permissions(('light.sala','switch.rele','binary_sensor.presenca')))
        self.connection=N(user=self.user,closed=False)
        self.current=self.user
        self.hass=N(states=N(async_all=lambda: list(self.rows)),
                    auth=N(async_get_user=self.get_user))
        self.get_calls=0
        self.inventory=m.NativeInventory(self.hass)
    async def get_user(self, id):
        self.get_calls+=1
        return self.current


class InventoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_allowed_domains_and_no_sensitive_attributes(self):
        h=Harness()
        result=await h.inventory.collect(h.connection)
        self.assertEqual([r['entity_id'] for r in result],['binary_sensor.presenca','light.sala','switch.rele'])
        self.assertEqual(result[1], {'entity_id':'light.sala','name':'Luz da Sala'})
        self.assertNotIn('SECRET',str(result))
        self.assertNotIn('latitude',str(result))
        self.assertEqual(h.get_calls,2)

    async def test_another_users_entities_never_leak(self):
        h=Harness();h.user.permissions.permitted.remove('switch.rele')
        result=await h.inventory.page(h.connection,offset=0)
        self.assertEqual(result['total'],2)
        self.assertNotIn('Relé',str(result))

    async def test_switch_stays_review_on_private_service(self):
        h=Harness();data=await h.inventory.collect(h.connection)
        self.assertEqual(next(x for x in data if x['entity_id']=='switch.rele'),
                         {'entity_id':'switch.rele','name':'Relé'})
        # The existing private LightingConfiguration transforms this to review;
        # this native source cannot authorize/promote it itself.

    async def test_admin_denied_if_directories_revoke(self):
        h=Harness();h.user.is_admin=True
        h.current=N(id='actor_one',is_active=True,is_admin=False,system_generated=False,
                    permissions=Permissions(()))
        self.assertEqual(await h.inventory.collect(h.connection), [])

    async def test_loss_of_permission_after_enumeration_fails_entire_snapshot(self):
        h=Harness();calls=0
        async def downgrade(id):
            nonlocal calls
            calls+=1
            if calls==2:
                h.user.permissions.permitted.remove('light.sala')
            return h.user
        h.hass.auth.async_get_user=downgrade
        with self.assertRaises(m.InventoryUnavailable):
            await h.inventory.collect(h.connection)

    async def test_current_directory_revocation_denies_all(self):
        h=Harness();h.current=N(id='actor_one',is_active=False,is_admin=False,
                                system_generated=False,permissions=Permissions(()))
        with self.assertRaises(m.InventoryUnavailable):
            await h.inventory.collect(h.connection)

    async def test_connection_swap_during_auth_denies(self):
        h=Harness()
        async def swap(id):
            h.connection.user=N(id='actor_two',is_active=True,is_admin=True)
            return h.user
        h.hass.auth.async_get_user=swap
        with self.assertRaises(m.InventoryUnavailable):
            await h.inventory.collect(h.connection)

    async def test_connection_close_during_auth_denies(self):
        h=Harness()
        async def closed(id):
            h.connection.closed=True;return h.user
        h.hass.auth.async_get_user=closed
        with self.assertRaises(m.InventoryUnavailable):
            await h.inventory.collect(h.connection)

    async def test_absent_permissions_is_not_admin(self):
        h=Harness();h.user.permissions=None
        self.assertEqual(await h.inventory.collect(h.connection), [])

    async def test_over_2000_is_denied_no_partial_results(self):
        h=Harness();h.user.is_admin=True
        h.rows=[entity(f'light.d_{i}') for i in range(2001)]
        with self.assertRaises(m.InventoryUnavailable):
            await h.inventory.collect(h.connection)

    async def test_page_limit_and_sort_stability(self):
        h=Harness();h.rows=[entity(f'light.light_{i:03d}') for i in reversed(range(105))];h.user.is_admin=True
        one=await h.inventory.page(h.connection,offset=0,limit=100)
        two=await h.inventory.page(h.connection,offset=100,limit=100)
        self.assertEqual((one['total'],len(one['items']),len(two['items'])),(105,100,5))
        self.assertEqual(one['items'][0]['entity_id'],'light.light_000')
        self.assertEqual(two['items'][-1]['entity_id'],'light.light_104')

    async def test_bad_page_parameters_fail_closed(self):
        h=Harness()
        for v in [dict(offset=-1),dict(offset=True),dict(offset=0,limit=101),dict(offset=0,limit=0)]:
            with self.subTest(v=v),self.assertRaises(m.InventoryUnavailable):
                await h.inventory.page(h.connection,**v)

    async def test_name_sanitized_and_presence_device_class_enforced(self):
        h=Harness();h.rows=[entity('light.r',friendly_name='<control>\x00'),
                           entity('binary_sensor.gas',device_class='gas'),
                           entity('binary_sensor.occupancy',device_class='occupancy')]
        h.user.is_admin=True
        got=await h.inventory.collect(h.connection)
        self.assertEqual(len(got),2)
        self.assertEqual(got[0]['device_class'],'occupancy')
        self.assertEqual(got[1]['name'],'light.r')

    async def test_missing_native_state_interface_fails_closed(self):
        h=Harness();h.hass.states=N()
        with self.assertRaises(m.InventoryUnavailable):
            await h.inventory.collect(h.connection)

    async def test_cancellation_preserved(self):
        h=Harness()
        async def cancelled(_):raise asyncio.CancelledError()
        h.hass.auth.async_get_user=cancelled
        with self.assertRaises(asyncio.CancelledError):
            await h.inventory.collect(h.connection)

    async def test_duplicate_ids_denied(self):
        h=Harness();h.rows=[entity('light.same'),entity('light.same')];h.user.is_admin=True
        with self.assertRaises(m.InventoryUnavailable):
            await h.inventory.collect(h.connection)

if __name__=='__main__':
    unittest.main(verbosity=2)

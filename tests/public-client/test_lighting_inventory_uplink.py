"""CP-LIGHTING inactive native uplink tests. No HA or CT104 network calls."""
import asyncio
import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace as N

ROOT=Path(__file__).resolve().parents[2]/"staging/lighting"
s=importlib.util.spec_from_file_location("cp_inventory_uplink",ROOT/"inventory_uplink.py")
u=importlib.util.module_from_spec(s)
sys.modules[s.name]=u
s.loader.exec_module(u)

class Perm:
    def __init__(self):self.ids=set()
    def check_entity(self,eid,policy):return policy=="read" and eid in self.ids

class Source:
    def __init__(self,hass):self.hass=hass
    async def collect(self,c):return self.hass._rows

class Port:
    def __init__(self):self.iid="install_1";self.calls=[];self.allow=True;self.after=None
    def installation_id(self):return self.iid
    async def stage_inventory_page(self,iid,actor,rid,batch,digest,total,offset,items,stage_id):
        self.calls.append(("page",iid,actor,rid,batch,digest,total,offset,items,stage_id))
        if self.after:await self.after(offset)
        return self.allow
    async def seal_inventory(self,iid,actor,rid,batch,digest,stage_id):
        self.calls.append(("seal",iid,actor,rid,batch,digest,stage_id))
        return self.allow

class Harness:
    def __init__(self,rows=None):
        self.permissions=Perm()
        self.rows=rows if rows is not None else [
            {"entity_id":"light.sala","name":"Sala"},
            {"entity_id":"switch.rele","name":"Rele"}]
        self.permissions.ids={x["entity_id"] for x in self.rows}
        self.user=N(id="user_1",is_admin=False,is_active=True,system_generated=False,permissions=self.permissions)
        self.connection=N(user=self.user,closed=False)
        self.port=Port();self.current=self.user
        async def lookup(uid):return self.current
        self.hass=N(_rows=self.rows,auth=N(async_get_user=lookup))
        self.uplink=u.NativeInventoryUplink(self.hass,self.port,Source)

class Tests(unittest.IsolatedAsyncioTestCase):
    async def test_exact_201_becomes_three_pages_and_seal(self):
        rows=[{"entity_id":f"light.luz_{i:03}","name":f"Luz {i}"} for i in range(201)]
        h=Harness(rows)
        batch=await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")
        self.assertEqual(len(batch),32)
        self.assertEqual([x[7] for x in h.port.calls if x[0]=="page"],[0,100,200])
        self.assertEqual(h.port.calls[-1][0],"seal")
        self.assertEqual(h.port.calls[0][5],u.digest(rows))
        self.assertTrue(all(x[3]=="request_id_123456789" for x in h.port.calls))
        self.assertEqual([len(x[8]) for x in h.port.calls if x[0]=="page"],[100,100,1])

    async def test_zero_inventory_requires_explicit_empty_page(self):
        h=Harness([]);await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")
        self.assertEqual([c[0] for c in h.port.calls],["page","seal"])
        self.assertEqual(h.port.calls[0][8],[])

    async def test_permission_revoked_between_pages_denies_seal(self):
        rows=[{"entity_id":f"light.luz_{i:03}","name":f"Luz {i}"} for i in range(101)]
        h=Harness(rows)
        async def downgrade(offset):
            if offset==0:h.permissions.ids.clear()
        h.port.after=downgrade
        with self.assertRaises(u.InventoryUplinkDenied):
            await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")
        self.assertNotIn("seal",[x[0] for x in h.port.calls])

    async def test_connection_changed_between_pages_denied(self):
        h=Harness([{"entity_id":f"light.luz_{i:03}","name":str(i)} for i in range(101)])
        async def switch(_):
            h.connection.user=N(id="other_user",is_admin=True,is_active=True)
        h.port.after=switch
        with self.assertRaises(u.InventoryUplinkDenied):
            await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")

    async def test_private_receipt_denial_fails_closed(self):
        h=Harness();h.port.allow=False
        with self.assertRaises(u.InventoryUplinkDenied):
            await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")
        self.assertEqual([x[0] for x in h.port.calls],["page"])

    async def test_installation_changed_denied(self):
        h=Harness();h.port.iid="other_install"
        with self.assertRaises(u.InventoryUplinkDenied):
            await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")

    async def test_extra_sensitive_metadata_denied(self):
        h=Harness([{"entity_id":"light.sala","name":"Sala","latitude":"private"}])
        with self.assertRaises(u.InventoryUplinkDenied):
            await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")

    async def test_unsorted_or_duplicate_inventory_denied(self):
        for rows in [[{"entity_id":"switch.rele","name":"Relé"},{"entity_id":"light.sala","name":"Sala"}],
                     [{"entity_id":"light.same","name":"Luz"},{"entity_id":"light.same","name":"Luz"}]]:
            with self.subTest(rows=rows):
                h=Harness(rows)
                with self.assertRaises(u.InventoryUplinkDenied):
                    await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")

    async def test_binary_sensor_gas_is_not_presence(self):
        h=Harness([{"entity_id":"binary_sensor.gas","name":"Gás","device_class":"gas"}])
        with self.assertRaises(u.InventoryUplinkDenied):
            await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")


    async def test_bind_stages_only_requested_approved_entity(self):
        h=Harness()
        await h.uplink.prepare(h.connection,'install_1','user_1','request_id_123456789',
                               target_entity_id='switch.rele')
        pages=[x for x in h.port.calls if x[0]=='page']
        self.assertEqual(len(pages),1)
        self.assertEqual(pages[0][6],1)
        self.assertEqual(pages[0][8],[{'entity_id':'switch.rele','name':'Rele'}])

    async def test_bind_unknown_target_refuses_transfer(self):
        h=Harness()
        with self.assertRaises(u.InventoryUplinkDenied):
            await h.uplink.prepare(h.connection,'install_1','user_1','request_id_123456789',
                                   target_entity_id='switch.unknown')
        self.assertEqual(h.port.calls,[])

    async def test_missing_signed_port_refuses_to_link(self):
        h=Harness()
        with self.assertRaises(u.InventoryUplinkDenied):
            u.NativeInventoryUplink(h.hass,N(),Source)

    async def test_permissions_from_current_directory_must_match(self):
        h=Harness()
        h.current=N(id="user_1",is_admin=False,is_active=True,system_generated=False,permissions=Perm())
        with self.assertRaises(u.InventoryUplinkDenied):
            await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")

    async def test_async_cancel_is_not_swallowed(self):
        h=Harness()
        async def cancel(_):raise asyncio.CancelledError()
        h.port.after=cancel
        with self.assertRaises(asyncio.CancelledError):
            await h.uplink.prepare(h.connection,"install_1","user_1","request_id_123456789")

if __name__=="__main__":unittest.main(verbosity=2)

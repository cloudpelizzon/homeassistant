"""Synthetic public-boundary checks. Never loads a commercial engine or contacts HA."""
import ast
import asyncio
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
COMPONENT = ROOT / 'custom_components/cloudpelizzon'
PACKAGE = 'finance_public707'
package = types.ModuleType(PACKAGE)
package.__path__ = [str(COMPONENT)]
sys.modules[PACKAGE] = package

def module(name):
    spec = importlib.util.spec_from_file_location(PACKAGE + '.' + name, COMPONENT / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = value
    spec.loader.exec_module(value)
    return value

access = module('finance_access653')
loader = module('finance_loader651')

def extract(path, names, namespace):
    tree = ast.parse(path.read_text())
    tree.body = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name in names]
    exec(compile(tree, str(path), 'exec'), namespace)
    return namespace

class AccessTests(unittest.TestCase):
    def claims(self, **changes):
        return dict(sku='CP-FINANCE', edition='full', trial=False, issued_at=100, not_before=100, expires_at=None, **changes)

    def test_paid_and_trial_times(self):
        claim = self.claims()
        access.validate_finance_access(claim, 100)
        for changes in ({'expires_at':100}, {'expires_at':True}, {'not_before':101}, {'issued_at':131}):
            with self.assertRaises(PermissionError): access.validate_finance_access({**claim, **changes}, 100)
        trial = {**claim, 'edition':'trial', 'trial':True, 'expires_at':100 + access.TRIAL_SECONDS}
        access.validate_finance_access(trial, 100)
        for now in (99, trial['expires_at']):
            with self.assertRaises(PermissionError): access.validate_finance_access(trial, now)
        with self.assertRaises(PermissionError): access.validate_finance_access({**trial,'expires_at':trial['expires_at']+1}, 100)

    def test_native_submodule_required_before_import(self):
        namespace = loader.Namespace.__new__(loader.Namespace)
        namespace.closed = False
        namespace.manifest = {'modules':[]}
        with patch.object(loader.importlib, 'import_module') as importing:
            with self.assertRaisesRegex(PermissionError, 'native_module_not_in_package'):
                namespace.load('finance_integrations651.py')
            importing.assert_not_called()
        namespace.manifest = {'modules':['finance_integrations651']}
        with patch.object(loader.importlib, 'import_module', return_value=types.SimpleNamespace()):
            with self.assertRaisesRegex(PermissionError, 'plaintext_engine_rejected'):
                namespace.load('finance_integrations651.py')
        namespace.closed = True
        with self.assertRaises(PermissionError): namespace.load('finance_integrations651.py')


    def test_package_binding_checked_before_native_initializer(self):
        import base64
        import platform
        import sysconfig
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives import serialization
        signer=Ed25519PrivateKey.generate()
        own=Ed25519PrivateKey.generate()
        public=lambda key:key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()
        def packet(domain,value):
            return {'signature':base64.b64encode(signer.sign(domain+loader.canonical(value))).decode()}
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);folder=root/'package';folder.mkdir();(root/'CP-FINANCE').mkdir()
            name='cp_finance651.'+sysconfig.get_config_var('SOABI')+'.so'
            raw=b'\x7fELF-synthetic-never-loaded'
            (folder/name).write_bytes(raw)
            manifest={'schema':'cp.native.package627.v1','sku':'CP-FINANCE','entry':'cp_finance651',
                      'abi':sysconfig.get_config_var('SOABI'),'architecture':platform.machine(),'test_only':False,
                      'files':{name:hashlib.sha256(raw).hexdigest()},'modules':sorted(loader.REQUIRED_MODULES)}
            claim={'sku':'CP-FINANCE','core_id':'synthetic-core','installation_id':'synthetic-installation',
                   'installation_public_key':public(own),'edition':'full','trial':False,'issued_at':100,'not_before':100,'expires_at':None}
            (root/'identity.json').write_text(json.dumps({'core_id':'synthetic-core','installation_id':'synthetic-installation'}))
            (root/'installation.key').write_bytes(own.private_bytes(serialization.Encoding.Raw,serialization.PrivateFormat.Raw,serialization.NoEncryption()))
            def write(m,c):
                (folder/'manifest.json').write_text(json.dumps({**packet(loader.DOMAIN,m),'manifest':m}))
                (root/'CP-FINANCE/license.json').write_text(json.dumps({**packet(loader.ENTITLEMENT,c),'claims':c}))
            cases=[({**manifest,'modules':[]},claim),
                   ({**manifest,'files':{name:'0'*64}},claim),
                   (manifest,{**claim,'expires_at':100}),
                   (manifest,{**claim,'core_id':'foreign'}),
                   (manifest,{**claim,'installation_public_key':public(signer)})]
            with patch.object(loader.time,'time',return_value=100), patch.object(loader.importlib.util,'spec_from_file_location') as initializer:
                for m,c in cases:
                    write(m,c)
                    with self.assertRaises(PermissionError):loader.Namespace(folder,sku='CP-FINANCE',public_key=public(signer),state_root=root)
                initializer.assert_not_called()
                write(manifest,claim)
                initializer.side_effect=RuntimeError('native initializer boundary reached')
                with self.assertRaisesRegex(RuntimeError,'native initializer boundary reached'):
                    loader.Namespace(folder,sku='CP-FINANCE',public_key=public(signer),state_root=root)
                initializer.assert_called_once()

    def test_unreviewed_release_has_no_effects(self):
        context = {'RELEASE_READY':False, 'safe':Mock(side_effect=AssertionError('disk touched'))}
        extract(COMPONENT/'finance_installer661.py', {'install_finance'}, context)
        with self.assertRaisesRegex(PermissionError, 'finance_private_release_not_reviewed'):
            context['install_finance']('/not-used', {}, 'trial')
        context['safe'].assert_not_called()
        source = (COMPONENT/'finance_installer661.py').read_text()
        self.assertIn('RELEASE_READY = False', source)

    def test_legacy_registry_does_not_load_finance(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root/'identity.json').write_text(json.dumps({'core_id':'synthetic-core','installation_id':'synthetic-installation'}))
            (root/'installed627.json').write_text(json.dumps({'schema':'cp.native.installed627.v1','modules':{'CP-FINANCE':{'folder':'not-used'}}}))
            (root/'data627.json').write_text('{}')
            async def executor(fn):return fn()
            env={'safe':Path,'recover_pending':lambda root:None,'ENTRIES':{'CP-FINANCE':'cp_finance651'},'json':json,'os':types.SimpleNamespace(environ={})}
            extract(COMPONENT/'compiled_registration627.py', {'Registration'}, env)
            r=env['Registration'](types.SimpleNamespace(async_add_executor_job=executor),{'core_id':'synthetic-core','trial_id':'synthetic-installation'},root,'public-test-pin')
            self.assertEqual(asyncio.run(r.load()),{})
            self.assertEqual(r.runtimes,{})

    def test_incomplete_private_package_does_not_create_database(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);state=root/'.storage/cloudpelizzon_compiled627';state.mkdir(parents=True)
            (state/'identity.json').write_text(json.dumps({'core_id':'synthetic-core','installation_id':'synthetic-installation'}))
            native=types.SimpleNamespace(load=Mock(side_effect=PermissionError('native_module_not_in_package')),close=Mock())
            env={'Path':Path,'safe':Path,'asyncio':asyncio,'json':json,'Namespace':Mock(return_value=native),'package_folder':lambda *a,**kw:state,'PUBLIC_KEY':'public-test-pin'}
            extract(COMPONENT/'finance_registration651.py',{'LocalFinance'},env)
            hass=types.SimpleNamespace(config=types.SimpleNamespace(path=lambda value:str(root/value)))
            r=env['LocalFinance'](hass,{'core_id':'synthetic-core','trial_id':'synthetic-installation'})
            with self.assertRaises(PermissionError):r._load()
            native.close.assert_called_once()
            self.assertFalse((root/'.storage/cloudpelizzon_finance651').exists())
            self.assertIsNone(r.service)

    def test_open_settings_does_not_save_schedule_or_select_recipients(self):
        user=types.SimpleNamespace(id='synthetic-user',is_active=True,is_admin=True,is_owner=False)
        async def current(_):return user
        async def executor(fn):return fn()
        hass=types.SimpleNamespace(auth=types.SimpleNamespace(async_get_user=current),async_add_executor_job=executor,async_create_task=Mock(side_effect=AssertionError('scheduled')))
        env={'asyncio':asyncio,'json':json,'INTEGRATIONS':{'integrations_get'}}
        extract(COMPONENT/'finance_registration651.py',{'LocalFinance'},env)
        r=env['LocalFinance'](hass,{})
        r.service=types.SimpleNamespace(execute=lambda *a,**kw:{'user':{'role':'admin'}})
        r.integrations=types.SimpleNamespace(saved={},view=lambda:{'config':{'mobile':'unapproved','alexa':'unapproved','inventory':True,'maintenance':True,'quotes':True,'sensors':[{}]}},configure=Mock(side_effect=AssertionError('configured')))
        view=asyncio.run(r.execute(types.SimpleNamespace(user=user),'integrations_get',{}))
        self.assertFalse(view['scheduled'])
        self.assertEqual(view['config']['mobile'],'')
        self.assertEqual(view['config']['alexa'],'')
        for key in ('inventory','maintenance','quotes'):self.assertIs(view['config'][key],False)
        self.assertEqual(view['config']['sensors'],[])
        r.integrations.configure.assert_not_called();hass.async_create_task.assert_not_called()

    def test_forbidden_source_cannot_be_whitelisted_by_hash(self):
        spec=importlib.util.spec_from_file_location('public_verifier707',ROOT/'tools/verify_public_tree.py')
        verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);name='finance_integrations651.py';raw=b'# synthetic forbidden file\n'
            (root/name).write_bytes(raw)
            (root/'source-manifest.json').write_text(json.dumps({'files':{name:hashlib.sha256(raw).hexdigest()}}))
            self.assertIn(name+': forbidden_path',verifier.verify(root,[name,'source-manifest.json']))
            component=root/'custom_components/cloudpelizzon';component.mkdir(parents=True)
            (component/'manifest.json').write_text(json.dumps({'version':'7.0.7'}))
            self.assertIn('source_version_mismatch',verifier.verify(root,[name,'source-manifest.json']))
        self.assertFalse((COMPONENT/'finance_integrations651.py').exists())
        self.assertFalse(list((COMPONENT/'ui/shell/finance').rglob('*.jpg')))

if __name__ == '__main__':unittest.main(verbosity=2)

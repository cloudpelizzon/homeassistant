"""Run public-client setup checks without private engines or customer data."""
import importlib.metadata
import json
import logging
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

logging.disable(logging.CRITICAL)
assert importlib.metadata.version('homeassistant')=='2026.10.1'
with tempfile.TemporaryDirectory(prefix='cp-public-native81-',dir='/tmp') as folder:
    case=Path(folder)
    shutil.copytree('/candidate/custom_components/cloudpelizzon',case/'client81')
    shutil.copyfile('/checks/native_setup.py',case/'native_setup.py')
    shutil.copyfile('/checks/native_trial83.py',case/'native_trial83.py')
    shutil.copyfile('/checks/public_transport87.py',case/'public_transport87.py')
    sys.path.insert(0,str(case))
    import native_setup, native_trial83, public_transport87
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(native_setup.NativeSetupTests)
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_trial83.TrialCommandTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(public_transport87.TransportTests))
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    report={'schema':'cp.public.setup_and_activation83.github.native.v1','tests':result.testsRun,
        'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
        'HA_flow_manager':'native_real','HA_Store':'native_real',
        'entry_runtime_setup':'patched_no_physical_execution',
        'Fleet_HTTP':'synthetic_boundary','activation_SDK':'synthetic_boundary','trial_WS_tests':14,'automation_transport_tests':12,'automation_HTTP_capability':'synthetic_boundary','private_engines_in_fixture':False,
        'customer_data_present':False,'network':'none','publication_allowed':False}
    print('CP_PUBLIC_NATIVE81='+json.dumps(report,separators=(',',':')),flush=True)
    code=0 if result.wasSuccessful() and result.testsRun==32 and not result.skipped else 1
raise SystemExit(code)

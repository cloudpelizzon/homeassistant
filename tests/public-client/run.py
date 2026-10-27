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
    shutil.copyfile('/checks/native_enrollment106.py',case/'native_enrollment106.py')
    shutil.copyfile('/checks/public_transport87.py',case/'public_transport87.py')
    shutil.copyfile('/checks/test_edge125.py',case/'test_edge125.py')
    shutil.copyfile('/checks/native_automation125.py',case/'native_automation125.py')
    shutil.copyfile('/checks/test_security_edge127.py',case/'test_security_edge127.py')
    shutil.copyfile('/checks/native_security127.py',case/'native_security127.py')
    shutil.copyfile('/checks/native_mirror130.py',case/'native_mirror130.py')
    shutil.copyfile('/checks/native_usability131.py',case/'native_usability131.py')
    shutil.copyfile('/checks/native_source132.py',case/'native_source132.py')
    shutil.copyfile('/checks/native_source133.py',case/'native_source133.py')
    shutil.copyfile('/checks/native_security134.py',case/'native_security134.py')
    shutil.copyfile('/checks/native_commercial157.py',case/'native_commercial157.py')
    sys.path.insert(0,str(case))
    shutil.copyfile('/checks/native_lighting497.py',case/'native_lighting497.py')
    shutil.copyfile('/checks/native_telemetry501.py',case/'native_telemetry501.py')
    import native_telemetry501
    import native_lighting497
    import native_commercial157
    import native_setup, native_trial83, public_transport87, native_enrollment106, test_edge125, native_automation125, test_security_edge127, native_security127
    import native_security134
    import native_source133
    import native_source132
    import native_usability131
    import native_mirror130
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(native_setup.NativeSetupTests)
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_trial83.TrialCommandTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(public_transport87.TransportTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_enrollment106.NativeEnrollmentTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(test_edge125.EdgeTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_automation125.NativeAutomationTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(test_security_edge127.SecurityEdgeTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_security127.NativeSecurityTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_mirror130.MirrorTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_usability131.UsabilityTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_source132.SourceTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_source133.DeliveryTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_security134.NativeSecurity134Tests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_commercial157.CommercialTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_lighting497.LightingTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(native_telemetry501.Tests))
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    report={'schema':'cp.public.setup_and_activation83.github.native.v1','tests':result.testsRun,
        'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
        'HA_flow_manager':'native_real','HA_Store':'native_real',
        'entry_runtime_setup':'patched_no_physical_execution',
        'Fleet_HTTP':'synthetic_boundary','activation_SDK':'synthetic_boundary','trial_WS_tests':14,'automation_transport_tests':12,'automation_HTTP_capability':'synthetic_boundary','private_engines_in_fixture':False,
        'customer_data_present':False,'network':'none','publication_allowed':False}
    print('CP_PUBLIC_NATIVE81='+json.dumps(report,separators=(',',':')),flush=True)
    code=0 if result.wasSuccessful() and result.testsRun==146 and not result.skipped else 1
raise SystemExit(code)

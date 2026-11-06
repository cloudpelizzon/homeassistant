"""Bound current-HA checks and print a traceback if a lifecycle call stalls."""
import faulthandler
import runpy
faulthandler.enable()
faulthandler.dump_traceback_later(90, exit=True)
try:
    for name in ('run.py', 'run_inventory_free632.py'):
        print('CURRENT_HA_CHECK='+name, flush=True)
        try:
            runpy.run_path('/checks/'+name, run_name='__main__')
        except SystemExit as e:
            if e.code not in (None, 0):
                raise
finally:
    faulthandler.cancel_dump_traceback_later()

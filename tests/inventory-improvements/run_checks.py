"""Run synthetic Inventory regression checks without customer data."""
from pathlib import Path
import shutil,subprocess,tempfile,sys
ROOT=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='cp-inventory-checks-',dir=ROOT.parent) as tmp:
 dest=Path(tmp)
 for source in (ROOT/'custom_components/cloudpelizzon/ui/inventory').iterdir():
  if source.is_file():shutil.copyfile(source,dest/source.name)
 shutil.copyfile(ROOT/'custom_components/cloudpelizzon/ui/maintenance/exceljs-4.4.0.min.js',dest/'exceljs-4.4.0.min.js')
 shutil.copyfile(ROOT/'custom_components/cloudpelizzon/inventory_audit723.py',dest/'inventory_audit723.py')
 for source in Path(__file__).parent.glob('test*'):
  if source.suffix in ('.mjs','.py'):shutil.copyfile(source,dest/source.name)
 for name in sorted(dest.glob('test*')):
  if name.suffix not in ('.mjs','.py'):continue
  subprocess.run(['node' if name.suffix=='.mjs' else sys.executable,str(name)],cwd=dest,check=True)

import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('n_isolation', Path(__file__).resolve().parents[1] / 'scripts/check-dogs-n-isolation.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

class IsolationTests(unittest.TestCase):
    def test_audit_checkout_rejected(self):
        with self.assertRaises(ValueError):
            guard.require_write_path('/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-n/registry.json')

    def test_sibling_prefix_is_not_containment(self):
        with self.assertRaises(ValueError):
            guard.require_write_path(str(guard.EXPECTED_ROOT) + '-other/report.json')

    def test_symlink_escape_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'root'
            root.mkdir()
            (root / 'escape').symlink_to(guard.AUDIT_ROOT, target_is_directory=True)
            with self.assertRaises(ValueError):
                guard.require_write_path(root / 'escape/report.json', root)

    def test_isolated_new_destination_allowed(self):
        target = guard.EXPECTED_ROOT / 'reports/dogs-generated-artwork/cohort-n/worker-a/new.json'
        self.assertEqual(guard.require_write_path(target), target.resolve())

if __name__ == '__main__':
    unittest.main()

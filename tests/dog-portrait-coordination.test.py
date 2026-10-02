import concurrent.futures
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / 'scripts/dog-portrait-coordination.py'
SPEC = importlib.util.spec_from_file_location('portrait_coordination', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CoordinationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.registry_path = self.root / 'registry.json'
        self.registry = {'cohortId': 'dogs-portraits-k', 'selectionFrozen': True,
                         'selectionSha256': 'a' * 64, 'commonsAcquisitionAuthorized': True,
                         'maxConcurrentImageCalls': 4,
                         'workers': [{'worker': x, 'threadId': 'thread-' + x,
                                      'fullAccessVerified': True, 'activeCatalogIds': ['breed-' + x],
                                      'stageRoot': str(self.root / x)} for x in 'ABCDE']}
        self.registry_path.write_text(json.dumps(self.registry))
        self.coordinator = MODULE.Coordinator(self.registry_path)

    def tearDown(self):
        self.temp.cleanup()

    def acquire(self, kind, worker, request):
        return self.coordinator.acquire(kind, worker, 'thread-' + worker, request, {'receipt': request}, 'breed-' + worker)

    def test_concurrent_five_workers_cannot_exceed_four_image_calls(self):
        def call(worker):
            try:
                return self.acquire('image', worker, 'attempt-' + worker)
            except MODULE.Busy:
                return None
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(call, 'ABCDE'))
        self.assertEqual(sum(bool(x) for x in results), 4)
        self.assertEqual(len([x for x in self.coordinator.status()['permits'] if x['status'] == 'active']), 4)

    def test_one_image_call_per_worker_and_no_duplicate_uncertain_attempt(self):
        permit = self.acquire('image', 'A', 'attempt-A')
        with self.assertRaises(MODULE.Busy):
            self.acquire('image', 'A', 'attempt-A-new')
        with self.assertRaises(MODULE.Busy):
            self.acquire('image', 'B', 'attempt-A')
        self.coordinator.finish(permit, 'A', 'thread-A', 'failed', {'failure': 'Recorded tool failure'})
        with self.assertRaises(MODULE.Busy):
            self.acquire('image', 'A', 'attempt-A')
        self.assertTrue(self.acquire('image', 'A', 'attempt-A-02'))

    def test_commons_single_owner_and_global_429_stop(self):
        permit = self.acquire('commons', 'A', 'request-A')
        with self.assertRaises(MODULE.Busy):
            self.acquire('commons', 'B', 'request-B')
        self.coordinator.finish(permit, 'A', 'thread-A', 'failed', {'httpStatus': 429, 'retryAfter': '60'})
        self.assertIn('commons_last_completed', self.coordinator.status()['state'])
        self.assertIn('commons_global_stop', self.coordinator.status()['state'])
        with self.assertRaises(MODULE.Busy):
            self.acquire('commons', 'B', 'request-B')
        self.assertTrue(self.acquire('image', 'B', 'attempt-B'))

    def test_owner_and_catalog_assignment_are_enforced(self):
        with self.assertRaises(ValueError):
            self.coordinator.acquire('image', 'A', 'thread-B', 'wrong-thread', {}, 'breed-A')
        with self.assertRaises(ValueError):
            self.coordinator.acquire('image', 'A', 'thread-A', 'wrong-identity', {}, 'breed-B')
        permit = self.acquire('image', 'A', 'attempt-A')
        with self.assertRaises(ValueError):
            self.coordinator.finish(permit, 'B', 'thread-B', 'completed', {'output': 'unknown'})
        with self.coordinator.connect() as db:
            db.execute('UPDATE permits SET started=? WHERE id=?', ('2000-01-01T00:00:00Z', permit))
        with self.assertRaises(MODULE.Busy):
            self.acquire('image', 'A', 'old-lease-not-expired')

    def test_no_acquisition_without_frozen_selection_or_permissions(self):
        self.registry['selectionFrozen'] = False
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        with self.assertRaises(ValueError):
            c.acquire('commons', 'A', 'thread-A', 'unfrozen', {}, 'breed-A')
        self.registry['selectionFrozen'] = True
        self.registry['workers'][0]['fullAccessVerified'] = False
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        with self.assertRaises(ValueError):
            c.acquire('image', 'A', 'thread-A', 'unverified', {}, 'breed-A')

    def test_disjoint_frozen_audit_allows_source_research_but_never_generation(self):
        self.registry['selectionFrozen'] = False
        self.registry['auditAllocationFrozen'] = True
        self.registry['commonsAuditAuthorized'] = True
        self.registry['workers'][0]['auditCatalogIds'] = ['breed-A']
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        self.assertTrue(c.acquire('commons', 'A', 'thread-A', 'audit-request', {}, 'breed-A'))
        with self.assertRaisesRegex(ValueError, 'not frozen'):
            c.acquire('image', 'A', 'thread-A', 'audit-image-forbidden', {}, 'breed-A')

    def test_lower_runtime_concurrency_limit_is_honored(self):
        self.registry['maxConcurrentImageCalls'] = 2
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        for worker in 'AB':
            self.assertTrue(c.acquire('image', worker, 'thread-' + worker, worker, {}, 'breed-' + worker))
        with self.assertRaises(MODULE.Busy):
            c.acquire('image', 'C', 'thread-C', 'C', {}, 'breed-C')

    def test_negative_file_titles_cannot_be_reacquired_under_url_encoding(self):
        raw = json.dumps({'rows': [{'title': 'File:Rejected Adult Dog.jpg', 'originalSha256': 'b' * 64}]}).encode()
        path = self.root / 'negatives.json'
        path.write_bytes(raw)
        self.registry['negativeRegistry'] = {'path': str(path), 'sha256': MODULE.digest(raw)}
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        for url in ['https://commons.wikimedia.org/w/api.php?titles=File%3ARejected_Adult_Dog.jpg',
                    'https://commons.wikimedia.org/wiki/File:Rejected_Adult_Dog.jpg',
                    'https://upload.wikimedia.org/wikipedia/commons/a/ab/Rejected_Adult_Dog.jpg']:
            with self.assertRaisesRegex(ValueError, 'previously rejected'):
                c.commons_fetch('A', 'thread-A', 'breed-A', url, self.root / 'A/x.json')
        self.assertEqual(c.status()['permits'], [])

    def approval(self):
        root = self.root / 'root-approvals'
        root.mkdir(exist_ok=True)
        receipt = {'cohortId': 'dogs-portraits-k', 'worker': 'A', 'threadId': 'thread-A',
                   'catalogId': 'breed-A', 'receiptType': 'immutable-root-precall-approval',
                   'status': 'approved', 'selectionSha256': 'a' * 64,
                   'rootReferenceViewed': True, 'rootIdentityAndRightsApproved': True,
                   'rootSceneAndPromptApproved': True, 'nativeDimensions': [1536, 1024],
                   'referencePurposes': {'uiDisplayAllowed': False, 'publicSnapshotAllowed': False, 'rasterExportAllowed': False}}
        for key, content in [('packet', b'{"original":"immutable fixture"}'),
                             ('reference', b'immutable original reference fixture'),
                             ('prompt', b'An exact adult dog in a natural standing three-quarter pose, full body and all four coherent grounded paws; native 1536x1024.')]:
            p = self.root / (key + '.txt')
            p.write_bytes(content)
            receipt[key] = {'path': str(p), 'sha256': MODULE.digest(content)}
        raw = (json.dumps(receipt, sort_keys=True) + '\n').encode()
        p = root / (MODULE.digest(raw) + '.json')
        p.write_bytes(raw)
        return p

    def test_preflight_binds_immutable_root_approval_to_exact_input_bytes(self):
        p = self.approval()
        result = self.coordinator.image_preflight('A', 'thread-A', 'breed-A', p)
        self.assertIn('native 1536x1024', result['prompt'])
        (self.root / 'prompt.txt').write_text('shell error: missing packet')
        with self.assertRaisesRegex(ValueError, 'approved bytes changed'):
            self.coordinator.image_preflight('A', 'thread-A', 'breed-A', p)

    def test_preflight_rejects_changed_approval_and_worker_owned_approval(self):
        p = self.approval()
        raw = p.read_text()
        p.write_text(raw.replace('1536', '1500'))
        with self.assertRaisesRegex(ValueError, 'filename/hash'):
            self.coordinator.image_preflight('A', 'thread-A', 'breed-A', p)
        fake = self.root / 'worker-approval.json'
        fake.write_text(raw)
        with self.assertRaisesRegex(ValueError, 'root-owned'):
            self.coordinator.image_preflight('A', 'thread-A', 'breed-A', fake)

    def test_fetch_rejects_unrelated_host_output_and_overwriting_before_any_network(self):
        with self.assertRaisesRegex(ValueError, 'HTTPS'):
            self.coordinator.commons_fetch('A', 'thread-A', 'breed-A', 'https://example.com/photo.jpg', self.root / 'A/x.jpg')
        with self.assertRaisesRegex(ValueError, 'allocated staging'):
            self.coordinator.commons_fetch('A', 'thread-A', 'breed-A', 'https://commons.wikimedia.org/x', self.root / 'B/x.jpg')
        path = self.root / 'A/existing.jpg'
        path.parent.mkdir()
        path.write_bytes(b'old protected original')
        with self.assertRaisesRegex(ValueError, 'fresh immutable'):
            self.coordinator.commons_fetch('A', 'thread-A', 'breed-A', 'https://commons.wikimedia.org/x', path)
        self.assertEqual(path.read_bytes(), b'old protected original')
        self.assertEqual(self.coordinator.status()['permits'], [])

    def test_upstream_wikipedia_chain_is_explicit_and_uses_same_global_429_stop(self):
        self.registry['wikipediaChainHosts'] = ['en.wikipedia.org', 'de.wikipedia.org']
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        class Response:
            code = 429
            headers = {'Retry-After': '60'}
            def read(self): return b'recorded actual rate-limit body'
            def __enter__(self): return self
            def __exit__(self, *args): return False
        class Opener:
            def open(self, request, timeout): return Response()
        with self.assertRaisesRegex(ValueError, 'File history'):
            c.commons_fetch('A', 'thread-A', 'breed-A', 'https://en.wikipedia.org/wiki/Dog', self.root / 'A/unrelated.txt')
        with patch.object(MODULE.urllib.request, 'build_opener', return_value=Opener()):
            with self.assertRaisesRegex(RuntimeError, 'HTTP 429'):
                c.commons_fetch('A', 'thread-A', 'breed-A', 'https://de.wikipedia.org/w/api.php?titles=Datei:Adult.jpg', self.root / 'A/chain.json')
        receipt = json.loads((self.root / 'A/chain.json.receipt.json').read_text())
        self.assertEqual(receipt['httpStatus'], 429)
        self.assertEqual(receipt['sha256'], MODULE.digest(b'recorded actual rate-limit body'))
        self.assertIn('commons_global_stop', c.status()['state'])
        with self.assertRaises(MODULE.Busy):
            c.commons_fetch('B', 'thread-B', 'breed-B', 'https://commons.wikimedia.org/w/api.php', self.root / 'B/blocked.json')

    def test_completed_request_cadence_is_enforced_before_network(self):
        with self.coordinator.connect() as db:
            db.execute('INSERT INTO state VALUES(?,?)', ('commons_last_completed', '100.0'))
        class Response:
            code = 200
            headers = {}
            def read(self): return b'actual metadata response'
            def __enter__(self): return self
            def __exit__(self, *args): return False
        class Opener:
            def open(self, request, timeout): return Response()
        with patch.object(MODULE.time, 'time', return_value=102.0), patch.object(MODULE.time, 'sleep') as sleep, patch.object(MODULE.urllib.request, 'build_opener', return_value=Opener()):
            self.coordinator.commons_fetch('A', 'thread-A', 'breed-A', 'https://commons.wikimedia.org/w/api.php', self.root / 'A/cadence.json')
        self.assertAlmostEqual(sleep.call_args.args[0], 3.1)


if __name__ == '__main__':
    unittest.main()

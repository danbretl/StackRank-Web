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

    def test_frozen_reserve_research_allows_only_owned_commons_and_never_images(self):
        self.registry['commonsReserveReadinessAuthorized'] = True
        self.registry['workers'][0]['auditCatalogIds'] = ['breed-A', 'reserve-A', 'other-audit-A']
        self.registry['workers'][0]['commonsResearchCatalogIds'] = ['reserve-A']
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        self.assertTrue(c.acquire('commons', 'A', 'thread-A', 'owned-reserve', {}, 'reserve-A'))
        for kind, worker, identity in [('image', 'A', 'reserve-A'), ('commons', 'B', 'reserve-A'), ('commons', 'A', 'other-audit-A')]:
            with self.assertRaises(ValueError):
                c.acquire(kind, worker, 'thread-' + worker, 'forbidden-' + kind + worker + identity, {}, identity)
        with self.assertRaises(ValueError):
            c.image_preflight('A', 'thread-A', 'reserve-A', self.root / 'irrelevant-approval.json')
        self.assertEqual(self.registry['workers'][0]['activeCatalogIds'], ['breed-A'])

    def test_reserve_research_needs_explicit_authorization_and_valid_audit_subset(self):
        self.registry['workers'][0]['commonsResearchCatalogIds'] = ['reserve-A']
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        with self.assertRaises(ValueError):
            c.acquire('commons', 'A', 'thread-A', 'not-authorized', {}, 'reserve-A')
        self.registry['commonsReserveReadinessAuthorized'] = True
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        with self.assertRaisesRegex(ValueError, 'Invalid root-owned'):
            c.acquire('commons', 'A', 'thread-A', 'outside-audit', {}, 'reserve-A')

    def test_reserve_commons_fetch_retains_actual_owner_finish_and_immutable_output(self):
        self.registry['commonsReserveReadinessAuthorized'] = True
        self.registry['workers'][0]['auditCatalogIds'] = ['breed-A', 'reserve-A']
        self.registry['workers'][0]['commonsResearchCatalogIds'] = ['reserve-A']
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        class Response:
            code = 200
            headers = {}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"query":{"pages":[]}}'
        target = self.root / 'A/reserve.json'
        with patch.object(MODULE.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = Response()
            result = c.commons_fetch('A', 'thread-A', 'reserve-A', 'https://commons.wikimedia.org/w/api.php', target)
        self.assertEqual(result['catalogId'], 'reserve-A')
        self.assertEqual(target.read_bytes(), b'{"query":{"pages":[]}}')
        self.assertEqual(c.status()['permits'][0]['status'], 'completed')
        with self.assertRaisesRegex(ValueError, 'fresh immutable'):
            c.commons_fetch('A', 'thread-A', 'reserve-A', 'https://commons.wikimedia.org/w/api.php', target)

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

    def test_file_case_after_first_character_is_distinct(self):
        raw = json.dumps({'rows': [{'title': 'File:Sarail Hound.jpg'}]}).encode()
        path = self.root / 'negatives.json'
        path.write_bytes(raw)
        self.registry['negativeRegistry'] = {'path': str(path), 'sha256': MODULE.digest(raw)}
        self.registry_path.write_text(json.dumps(self.registry))
        c = MODULE.Coordinator(self.registry_path)
        class Response:
            code = 200
            headers = {}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'distinct original bytes'
        with patch.object(MODULE.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = Response()
            result = c.commons_fetch('A', 'thread-A', 'breed-A', 'https://upload.wikimedia.org/wikipedia/commons/8/87/Sarail_hound.jpg', self.root / 'A/distinct.jpg')
            self.assertEqual(result['httpStatus'], 200)
            self.assertEqual(opener.return_value.open.call_count, 1)
        with self.assertRaisesRegex(ValueError, 'previously rejected'):
            c.commons_fetch('A', 'thread-A', 'breed-A', 'https://upload.wikimedia.org/wikipedia/commons/4/4c/sarail_Hound.jpg', self.root / 'A/rejected.jpg')

    def test_rejected_image_alias_hash_preserved_and_owner_finished(self):
        body = b'exact rejected image bytes'
        for row in ({'originalSha256': MODULE.digest(body)},
                    {'sourcePath': 'retained.jpg', 'sourceSha256': MODULE.digest(body)},
                    {'sourcePath': 'source.json', 'originalSha1': MODULE.hashlib.sha1(body).hexdigest()}):
            with self.subTest(row=row):
                raw = json.dumps({'rows': [{'title': 'File:Rejected.jpg', **row}]}).encode()
                path = self.root / 'negatives.json'; path.write_bytes(raw)
                self.registry['negativeRegistry'] = {'path': str(path), 'sha256': MODULE.digest(raw)}
                self.registry_path.write_text(json.dumps(self.registry))
                c = MODULE.Coordinator(self.registry_path)
                class Response:
                    code = 200
                    headers = {}
                    def __enter__(self): return self
                    def __exit__(self, *args): pass
                    def read(self): return body
                target = self.root / ('A/alias-' + str(len(c.status()['permits'])) + '.jpg')
                with patch.object(MODULE.time, 'sleep'), patch.object(MODULE.urllib.request, 'build_opener') as opener:
                    opener.return_value.open.return_value = Response()
                    with self.assertRaisesRegex(RuntimeError, 'match a rejected original'):
                        c.commons_fetch('A', 'thread-A', 'breed-A', 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Other_title.jpg', target)
                receipt = json.loads(target.with_name(target.name + '.receipt.json').read_text())
                self.assertTrue(receipt['knownRejectedOriginal'])
                self.assertEqual(target.read_bytes(), body)
                self.assertFalse(any(p['status'] == 'active' for p in c.status()['permits']))

    def test_exact_root_adjudication_only_allows_native_metadata(self):
        original = self.root / 'retained.jpg'; original.write_bytes(b'retained original')
        decision = {'receiptType': 'root-known-negative-retained-source-metadata-adjudication',
                    'worker': 'A', 'catalogId': 'breed-A', 'fileTitle': 'File:Rejected.jpg',
                    'original': {'path': str(original), 'sha256': MODULE.digest(original.read_bytes())},
                    'sourceBodyReassessment': 'PASS', 'rootWholeOriginalPersonallyViewed': True, 'metadataReadinessOnly': True,
                    'generationAuthorized': False, 'sourcePurposePermissions': {
                        'uiDisplayAllowed': False, 'publicSnapshotAllowed': False, 'rasterExportAllowed': False}}
        dp = self.root / 'decision.json'; dp.write_text(json.dumps(decision))
        raw = json.dumps({'rows': [{'title': 'File:Rejected.jpg'}]}).encode()
        np = self.root / 'negatives.json'; np.write_bytes(raw)
        self.registry['negativeRegistry'] = {'path': str(np), 'sha256': MODULE.digest(raw)}
        self.registry['knownNegativeMetadataAdjudications'] = [{
            'worker': 'A', 'catalogId': 'breed-A', 'fileTitle': 'File:Rejected.jpg',
            'originalSha256': decision['original']['sha256'],
            'rootDecision': {'path': str(dp), 'sha256': MODULE.digest(dp.read_bytes())}}]
        self.registry_path.write_text(json.dumps(self.registry)); c = MODULE.Coordinator(self.registry_path)
        class Response:
            code = 200
            headers = {}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"query":{"pages":[]}}'
        url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=File%3ARejected.jpg&prop=revisions'
        with patch.object(MODULE.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = Response()
            self.assertEqual(c.commons_fetch('A', 'thread-A', 'breed-A', url, self.root / 'A/history.json')['httpStatus'], 200)
        for bad in ('https://upload.wikimedia.org/wikipedia/commons/a/aa/Rejected.jpg',
                    url.replace('prop=revisions', 'prop=categories'), url.replace('titles=File%3ARejected.jpg', 'titles=File%3ARejected.jpg|File%3AOther.jpg')):
            with self.assertRaises(ValueError):
                c.commons_fetch('A', 'thread-A', 'breed-A', bad, self.root / 'A/blocked.json')
        with self.assertRaises(ValueError):
            c.commons_fetch('B', 'thread-B', 'breed-B', url, self.root / 'B/blocked.json')
        original.write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError, 'Invalid exact'):
            c.commons_fetch('A', 'thread-A', 'breed-A', url, self.root / 'A/tampered.json')

    def test_explicit_root_metadata_filepath_is_immutable_scoped_and_logged(self):
        original = self.root / 'retained.jpg'; original.write_bytes(b'retained original')
        value = {'receiptType': 'root-known-negative-retained-source-metadata-adjudication',
                 'worker': 'A', 'catalogId': 'breed-A', 'fileTitle': 'File:Rejected.jpg',
                 'original': {'path': str(original), 'sha256': MODULE.digest(original.read_bytes())},
                 'sourceBodyReassessment': 'PASS', 'rootWholeOriginalPersonallyViewed': True,
                 'metadataReadinessOnly': True, 'generationAuthorized': False,
                 'sourcePurposePermissions': {'uiDisplayAllowed': False, 'publicSnapshotAllowed': False, 'rasterExportAllowed': False}}
        raw = json.dumps(value).encode()
        folder = self.root / 'root-metadata-adjudications'; folder.mkdir()
        dp = folder / (MODULE.digest(raw) + '.json'); dp.write_bytes(raw)
        negative = json.dumps({'rows': [{'title': 'File:Rejected.jpg'}]}).encode()
        np = self.root / 'negatives.json'; np.write_bytes(negative)
        self.registry['negativeRegistry'] = {'path': str(np), 'sha256': MODULE.digest(negative)}
        self.registry_path.write_text(json.dumps(self.registry)); c = MODULE.Coordinator(self.registry_path)
        class Response:
            code = 200
            headers = {}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"query":{"pages":[]}}'
        url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=File%3ARejected.jpg&prop=revisions'
        with patch.object(MODULE.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = Response()
            result = c.commons_fetch('A', 'thread-A', 'breed-A', url, self.root / 'A/history.json', dp)
            self.assertEqual(result['rootMetadataAdjudication']['sha256'], dp.stem)
        for wrong in (self.root / 'outside.json', folder / 'incorrect-name.json'):
            wrong.write_bytes(raw)
            with self.assertRaises(ValueError):
                c.commons_fetch('A', 'thread-A', 'breed-A', url, self.root / 'A/rejected.json', wrong)
        with self.assertRaisesRegex(ValueError, 'Invalid exact'):
            c.commons_fetch('B', 'thread-B', 'breed-B', url, self.root / 'B/rejected.json', dp)
        with self.assertRaises(ValueError):
            c.commons_fetch('A', 'thread-A', 'breed-A', 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Rejected.jpg', self.root / 'A/image.jpg', dp)
        dp.write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError, 'filename/hash'):
            c.commons_fetch('A', 'thread-A', 'breed-A', url, self.root / 'A/tampered.json', dp)

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

    def test_text_only_preflight_requires_policy_and_rejects_any_photo_input(self):
        p=self.approval();receipt=json.loads(p.read_text())
        receipt['cohortId']='dogs-portraits-l';receipt['inputMode']='text-only';receipt['imageInputs']=[]
        receipt['researchDossier']=receipt.pop('reference')
        for key in ('rootMorphologyEvidenceRead','rootIdentityApproved','rootSourceUseApproved'):
            receipt[key]=True
        auth=self.root/'authorization.json';auth.write_text('actual direct-user authorization fixture')
        bound={'path':str(auth),'sha256':MODULE.digest(auth.read_bytes())}
        receipt['sourcePolicyAuthorization']=bound
        self.registry['cohortId']='dogs-portraits-l';self.registry['sourcePolicyAuthorization']=bound
        self.registry_path.write_text(json.dumps(self.registry));c=MODULE.Coordinator(self.registry_path)
        def write():
            raw=json.dumps(receipt).encode();q=p.parent/(MODULE.digest(raw)+'.json');q.write_bytes(raw);return q
        with patch.object(MODULE,'SOURCE_AUTH_SHA256',bound['sha256']):
            result=c.image_preflight('A','thread-A','breed-A',write())
            self.assertEqual(result['referencePaths'],[]);self.assertIsNone(result['referencePath'])
            receipt['imageInputs']=[bound]
            with self.assertRaisesRegex(ValueError,'cannot contain'):c.image_preflight('A','thread-A','breed-A',write())
            receipt['imageInputs']=[];receipt['rootMorphologyEvidenceRead']=False
            with self.assertRaisesRegex(ValueError,'root gate'):c.image_preflight('A','thread-A','breed-A',write())

    def test_preflight_binds_immutable_root_approval_to_exact_input_bytes(self):
        p = self.approval()
        result = self.coordinator.image_preflight('A', 'thread-A', 'breed-A', p)
        self.assertIn('native 1536x1024', result['prompt'])
        (self.root / 'prompt.txt').write_text('shell error: missing packet')
        with self.assertRaisesRegex(ValueError, 'approved bytes changed'):
            self.coordinator.image_preflight('A', 'thread-A', 'breed-A', p)

    def test_l_prior_tranche_approval_survives_append_only_freeze(self):
        original = self.approval(); receipt = json.loads(original.read_text())
        qualification = {'path': 'qualified-A.json', 'sha256': 'd' * 64}
        freeze = {'cohortId': 'dogs-portraits-l', 'id': 'l01', 'catalogIds': ['breed-A'],
                  'members': [{'catalogId': 'breed-A', 'qualification': qualification}]}
        selection = MODULE.digest(json.dumps(freeze, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode())
        freeze['selectionSha256'] = selection
        fp = self.root / 'tranche-l01-freeze-001.json'; fp.write_text(json.dumps(freeze))
        receipt.update(cohortId='dogs-portraits-l', selectionSha256=selection,
                       trancheSha256=selection, trancheId='l01', qualification=qualification)
        raw = json.dumps(receipt).encode(); approved = original.parent / (MODULE.digest(raw) + '.json'); approved.write_bytes(raw)
        self.registry.update(cohortId='dogs-portraits-l', selectionSha256='b' * 64, priorSelectionDigests=[selection])
        self.registry_path.write_text(json.dumps(self.registry)); current = MODULE.Coordinator(self.registry_path)
        self.assertEqual(current.image_preflight('A', 'thread-A', 'breed-A', approved)['selectionSha256'], selection)
        freeze['catalogIds'] = ['breed-B']; fp.write_text(json.dumps(freeze))
        with self.assertRaisesRegex(ValueError, 'immutable freeze'):
            current.image_preflight('A', 'thread-A', 'breed-A', approved)
        self.registry['priorSelectionDigests'] = []
        self.registry_path.write_text(json.dumps(self.registry))
        with self.assertRaisesRegex(ValueError, 'selection mismatch'):
            MODULE.Coordinator(self.registry_path).image_preflight('A', 'thread-A', 'breed-A', approved)

    def test_l_cannot_reuse_k_approval_or_unknown_cohort(self):
        p = self.approval()
        self.registry['cohortId'] = 'dogs-portraits-l'
        self.registry_path.write_text(json.dumps(self.registry))
        current = MODULE.Coordinator(self.registry_path)
        with self.assertRaisesRegex(ValueError, 'mismatch'):
            current.image_preflight('A', 'thread-A', 'breed-A', p)
        receipt = json.loads(p.read_text())
        receipt['cohortId'] = 'dogs-portraits-l'
        raw = json.dumps(receipt).encode()
        fresh = p.parent / (MODULE.digest(raw) + '.json')
        fresh.write_bytes(raw)
        self.assertEqual(current.image_preflight('A', 'thread-A', 'breed-A', fresh)['catalogId'], 'breed-A')
        self.registry['cohortId'] = 'dogs-portraits-n'
        self.registry_path.write_text(json.dumps(self.registry))
        with self.assertRaisesRegex(ValueError, 'Wrong coordination cohort'):
            MODULE.Coordinator(self.registry_path)

    def test_m_text_only_preflight_requires_policy_and_rejects_any_photo_input(self):
        p=self.approval();receipt=json.loads(p.read_text())
        receipt['cohortId']='dogs-portraits-m';receipt['inputMode']='text-only';receipt['imageInputs']=[]
        receipt['researchDossier']=receipt.pop('reference')
        for key in ('rootMorphologyEvidenceRead','rootIdentityApproved','rootSourceUseApproved'):
            receipt[key]=True
        auth=self.root/'authorization.json';auth.write_text('actual direct-user authorization fixture')
        bound={'path':str(auth),'sha256':MODULE.digest(auth.read_bytes())}
        receipt['sourcePolicyAuthorization']=bound
        self.registry['cohortId']='dogs-portraits-m';self.registry['sourcePolicyAuthorization']=bound
        self.registry_path.write_text(json.dumps(self.registry));c=MODULE.Coordinator(self.registry_path)
        def write():
            raw=json.dumps(receipt).encode();q=p.parent/(MODULE.digest(raw)+'.json');q.write_bytes(raw);return q
        with patch.object(MODULE,'M_SOURCE_AUTH_SHA256',bound['sha256']):
            result=c.image_preflight('A','thread-A','breed-A',write())
            self.assertEqual(result['referencePaths'],[]);self.assertIsNone(result['referencePath'])
            receipt['imageInputs']=[bound]
            with self.assertRaisesRegex(ValueError,'cannot contain'):c.image_preflight('A','thread-A','breed-A',write())
            receipt['imageInputs']=[];receipt['rootMorphologyEvidenceRead']=False
            with self.assertRaisesRegex(ValueError,'root gate'):c.image_preflight('A','thread-A','breed-A',write())

    def test_m_prior_tranche_approval_survives_append_only_freeze(self):
        original = self.approval(); receipt = json.loads(original.read_text())
        qualification = {'path': 'qualified-A.json', 'sha256': 'd' * 64}
        freeze = {'cohortId': 'dogs-portraits-m', 'id': 'm01', 'catalogIds': ['breed-A'],
                  'members': [{'catalogId': 'breed-A', 'qualification': qualification}]}
        selection = MODULE.digest(json.dumps(freeze, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode())
        freeze['selectionSha256'] = selection
        fp = self.root / 'tranche-m01-freeze-001.json'; fp.write_text(json.dumps(freeze))
        receipt.update(cohortId='dogs-portraits-m', selectionSha256=selection,
                       trancheSha256=selection, trancheId='m01', qualification=qualification)
        raw = json.dumps(receipt).encode(); approved = original.parent / (MODULE.digest(raw) + '.json'); approved.write_bytes(raw)
        self.registry.update(cohortId='dogs-portraits-m', selectionSha256='b' * 64, priorSelectionDigests=[selection])
        self.registry_path.write_text(json.dumps(self.registry)); current = MODULE.Coordinator(self.registry_path)
        self.assertEqual(current.image_preflight('A', 'thread-A', 'breed-A', approved)['selectionSha256'], selection)
        freeze['catalogIds'] = ['breed-B']; fp.write_text(json.dumps(freeze))
        with self.assertRaisesRegex(ValueError, 'immutable freeze'):
            current.image_preflight('A', 'thread-A', 'breed-A', approved)
        self.registry['priorSelectionDigests'] = []
        self.registry_path.write_text(json.dumps(self.registry))
        with self.assertRaisesRegex(ValueError, 'selection mismatch'):
            MODULE.Coordinator(self.registry_path).image_preflight('A', 'thread-A', 'breed-A', approved)

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

    def supplemental_approval(self, **changes):
        original = self.approval()
        receipt = json.loads(original.read_text())
        extra = self.root / 'supplemental-original.jpg'
        extra.write_bytes(b'exact separately approved natural ear evidence')
        item = {'path': str(extra), 'sha256': MODULE.digest(extra.read_bytes()),
                'rootReferenceViewed': True, 'rootIdentityAndRightsApproved': True,
                'limitedPurpose': 'Natural ear geometry only; whole-body primary remains separately qualified',
                'referencePurposes': receipt['referencePurposes']}
        item.update(changes)
        receipt['additionalReferences'] = [item]
        raw = json.dumps(receipt).encode()
        path = original.parent / (MODULE.digest(raw) + '.json')
        path.write_bytes(raw)
        return path, extra

    def test_supplemental_input_is_hash_bound_and_returned_in_exact_order(self):
        p, extra = self.supplemental_approval()
        result = self.coordinator.image_preflight('A', 'thread-A', 'breed-A', p)
        self.assertEqual(result['referencePaths'], [str(self.root / 'reference.txt'), str(extra)])
        self.assertEqual(len(result['referenceInputs']), 2)
        extra.write_bytes(b'different unreviewed image')
        with self.assertRaisesRegex(ValueError, 'approved bytes changed'):
            self.coordinator.image_preflight('A', 'thread-A', 'breed-A', p)

    def test_supplemental_input_cannot_skip_root_review_or_expand_photo_purposes(self):
        for changes in [{'rootReferenceViewed': False}, {'rootIdentityAndRightsApproved': False},
                        {'limitedPurpose': ''}, {'referencePurposes': {'uiDisplayAllowed': True}}]:
            p, _ = self.supplemental_approval(**changes)
            with self.assertRaises(ValueError):
                self.coordinator.image_preflight('A', 'thread-A', 'breed-A', p)

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

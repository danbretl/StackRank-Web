"""Focused no-network regression checks for correction-call authorization."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/dog-artwork-correction-coordination.py'
spec = importlib.util.spec_from_file_location('correction', SCRIPT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class CorrectionPermitTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / 'state'
        self.approvals = self.root / 'root-approvals'
        self.approvals.mkdir()
        payload = self.root / 'input.txt'
        payload.write_text('Evidence-bound exact text-only prompt. ' * 5)
        binding = {'path': str(payload), 'sha256': m.digest(payload.read_bytes()), 'bytes': payload.stat().st_size}
        self.receipt = {'receiptType': 'immutable-root-precall-approval', 'status': 'approved',
            'correctionId': 'dogs-audit-corrections-2026-10-06', 'catalogId': 'VBO:0200271',
            'inputMode': 'text-only', 'permissionProfile': 'workspace-write', 'imageInputs': [],
            'nativeDimensions': [1536, 1024], 'rootMorphologyEvidenceRead': True,
            'rootIdentityApproved': True, 'rootSourceUseApproved': True, 'rootSceneAndPromptApproved': True,
            'referencePurposes': dict.fromkeys(('uiDisplayAllowed','publicSnapshotAllowed','rasterExportAllowed'),False),
            'prompt': binding, 'researchDossier': binding, 'sourcePolicyAuthorization': binding}
        self.payload = payload
        self.approval = self.write_approval()

    def write_approval(self):
        raw = json.dumps(self.receipt).encode()
        path = self.approvals / (m.digest(raw) + '.json')
        path.write_bytes(raw)
        return path

    def test_byte_change_refuses_call(self):
        self.payload.write_text('changed')
        with self.assertRaises(ValueError): m.acquire(self.state,self.approval,'01')
        self.assertFalse((self.state/'active.json').exists())

    def test_second_inflight_request_cannot_take_slot(self):
        first = m.acquire(self.state,self.approval,'01')
        with self.assertRaises(FileExistsError): m.acquire(self.state,self.approval,'02')
        self.assertEqual(json.loads((self.state/'active.json').read_text())['request'],first['request'])

    def test_finished_attempt_cannot_be_duplicated(self):
        first = m.acquire(self.state,self.approval,'01')
        m.finish(self.state,first['request'],self.payload)
        with self.assertRaises(FileExistsError): m.acquire(self.state,self.approval,'01')
        self.assertFalse((self.state/'active.json').exists())

    def test_unrelated_request_cannot_finish_slot(self):
        m.acquire(self.state,self.approval,'01')
        with self.assertRaises(ValueError): m.finish(self.state,'wrong',self.payload)
        self.assertTrue((self.state/'active.json').exists())

    def test_image_input_or_unscoped_identity_refused(self):
        for field,value in [('imageInputs',['photo.jpg']),('catalogId','VBO:0200001')]:
            original=self.receipt[field]; self.receipt[field]=value
            with self.assertRaises(ValueError): m.acquire(self.state,self.write_approval(),'01')
            self.receipt[field]=original


if __name__ == '__main__':
    unittest.main()

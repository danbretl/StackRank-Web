import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('packet', Path(__file__).resolve().parents[1]/'scripts/dog-portrait-packet.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

class PacketTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        p = self.root/'source.txt'; p.write_text('Retained actual primary, original-grant and terms fixture.'*3)
        self.bound = {'path':str(p),'sha256':m.sha(p.read_bytes()),'bytes':p.stat().st_size}
        self.catalog = {'VBO:1':{'displayName':'Exact dog'}}
        source = {'title':'Breed organization','url':'https://example.org/standard','evidence':'Sourced character and historical working technique.','sourceRole':'primary standard','snapshot':self.bound,'text':self.bound}
        summary = 'A documented character observation, naturally calibrated, with a distinctive working habit and history. '*3
        short = 'A character-led, independently written short description grounded in specific documented breed traits.'
        profile = {'summary':summary,'shortDescription':short,'summarySha256':m.sha(summary.encode()),'shortDescriptionSha256':m.sha(short.encode()),'sources':[{k:source[k] for k in ('title','url','evidence')}]}
        ref = {k:'Actual reviewed evidence' for k in ('fileTitle','canonicalFilePage','pinnedPage','creator','originalSourceChain','license','licenseUrl','attribution','visualInspection')}
        ref.update({k:self.bound for k in ('original','metadata','fileText','originalGrant','licenseTerms')});ref['pinnedRevision']=1
        e={'catalogId':'VBO:1','displayName':'Exact dog','sourcePurposePermissions':m.PURPOSES,'reference':ref,'evidence':[{**self.bound,'role':'primary','url':source['url'],'acquisitionDisclosure':'Retained snapshot; historical HTTP status unknown','readByWriter':True}],'profile':profile,'primarySources':[source],'prompt':self.bound,'promptTemplateVersion':'dogs-field-guide-v9-cohort-l'}
        e.update({k:'Exact individually reviewed rationale' for k in ('morphologyBrief','scene','sceneRationale','identityRationale')})
        self.packet={'schemaVersion':1,'cohortId':'dogs-portraits-l','worker':'A','createdAt':'2026-10-03T00:00:00Z','entries':[e]}

    def tearDown(self): self.temp.cleanup()
    def test_valid_packet_does_not_imply_human_approval(self):
        result=m.validate(self.packet,self.catalog,set());self.assertTrue(result['humanRootSourceVisualRightsPromptApprovalStillRequired']);self.assertFalse(result['independentPeerVerified'])
    def test_changed_source_or_text_rejected(self):
        bad=copy.deepcopy(self.packet);bad['entries'][0]['profile']['summary']+=' New claim.'
        with self.assertRaisesRegex(ValueError,'length/hash'):m.validate(bad,self.catalog,set())
        Path(self.bound['path']).write_text('replaced')
        with self.assertRaisesRegex(ValueError,'bytes changed'):m.validate(self.packet,self.catalog,set())
    def test_duplicate_published_identity_and_unread_evidence_rejected(self):
        with self.assertRaisesRegex(ValueError,'previously published'):m.validate(self.packet,self.catalog,{'VBO:1'})
        self.packet['entries'][0]['evidence'][0]['readByWriter']=False
        with self.assertRaisesRegex(ValueError,'Unread'):m.validate(self.packet,self.catalog,set())
    def test_self_approval_and_stale_peer_rejected(self):
        p=self.root/'packet.json';p.write_text(json.dumps(self.packet));bound={'path':str(p),'sha256':m.sha(p.read_bytes()),'bytes':p.stat().st_size}
        peer={'schemaVersion':1,'cohortId':'dogs-portraits-l','reviewer':'A','packet':bound,'verdict':'pass','entries':[]}
        with self.assertRaisesRegex(ValueError,'Independent peer'):m.validate(self.packet,self.catalog,set(),peer)
        peer['reviewer']='B'
        with self.assertRaisesRegex(ValueError,'every entry'):m.validate(self.packet,self.catalog,set(),peer)

    def test_text_only_packet_requires_amendment_exact_dossier_and_no_image_inputs(self):
        def save(name, value):
            p=self.root/name;p.write_text(json.dumps(value))
            return {'path':str(p),'sha256':m.sha(p.read_bytes()),'bytes':p.stat().st_size}
        auth=save('authorization.json',{'approved':True,'authority':'direct-user-instruction','policyVersion':m.SOURCE_POLICY})
        dossier=save('dossier.json',{'catalogId':'VBO:1','imageInputs':[],
                     'morphologyEvidence':[{'source':self.bound,'facts':'Exact standard proportions'}],
                     'visualResearch':[{'url':'https://example.org/dog','observations':'Adult exact identity and coat'}]})
        packet=copy.deepcopy(self.packet);packet['schemaVersion']=2;packet['sourcePolicyAuthorization']=auth
        e=packet['entries'][0];e['reference']={'mode':'text-only','researchDossier':dossier,'imageInputs':[]};e['promptTemplateVersion']='dogs-field-guide-v10-cohort-l'
        with patch.object(m,'SOURCE_AUTH_SHA256',auth['sha256']):
            self.assertTrue(m.validate(packet,self.catalog,set())['valid'])
            e['reference']['imageInputs']=[self.bound]
            with self.assertRaisesRegex(ValueError,'cannot contain'):m.validate(packet,self.catalog,set())
            e['reference']['imageInputs']=[]
            Path(dossier['path']).write_text('{}')
            with self.assertRaisesRegex(ValueError,'bytes changed'):m.validate(packet,self.catalog,set())

    def test_attempt_cannot_substitute_unapproved_prompt_or_native(self):
        def save(name, value):
            p=self.root/name;p.write_text(json.dumps(value))
            return {'path':str(p),'sha256':m.sha(p.read_bytes()),'bytes':p.stat().st_size}
        approval=save('approval.json',{'cohortId':'dogs-portraits-l','status':'approved','catalogId':'VBO:1','authorizedAttemptId':'L-1',
                                     'prompt':self.bound,'reference':self.bound})
        preflight=save('preflight.json',{'attemptId':'L-1','approvalSha256':approval['sha256'],'permit':'permit-1','preflightSucceeded':True})
        receipt={'schemaVersion':1,'cohortId':'dogs-portraits-l','catalogId':'VBO:1','attemptId':'L-1','permit':'permit-1',
                 'approval':approval,'preflight':preflight,'tool':'image_gen.imagegen',
                 'actualArguments':{'prompt':Path(self.bound['path']).read_text(),'referenced_image_paths':[self.bound['path']],'transparent_background':False},
                 'imageModel':'undisclosed','startedAt':'2026-10-03T00:00:00Z','completedAt':'2026-10-03T00:01:00Z',
                 'status':'generated','native':self.bound,'originalOutputSha256':self.bound['sha256'],'originalOutputPath':'/original.png',
                 'workerWholeNativeViewed':True,'workerQaNotes':'Whole original inspected','dimensions':[1536,1024],'workerVerdict':'pass'}
        self.assertTrue(m.validate_attempt(receipt)['rootNativeReviewStillRequired'])
        auth=save('source-policy.json',{'approved':True,'authority':'direct-user-instruction','policyVersion':m.SOURCE_POLICY})
        text_approval=json.loads(Path(approval['path']).read_text());text_approval.pop('reference')
        text_approval.update(inputMode='text-only',imageInputs=[],researchDossier=self.bound,sourcePolicyAuthorization=auth)
        text_binding=save('text-approval.json',text_approval)
        text_preflight=save('text-preflight.json',{'attemptId':'L-1','approvalSha256':text_binding['sha256'],'permit':'permit-1','preflightSucceeded':True})
        text_receipt=copy.deepcopy(receipt);text_receipt.update(schemaVersion=2,approval=text_binding,preflight=text_preflight)
        text_receipt['actualArguments'].pop('referenced_image_paths')
        with patch.object(m,'SOURCE_AUTH_SHA256',auth['sha256']):
            self.assertTrue(m.validate_attempt(text_receipt)['valid'])
            text_receipt['actualArguments']['referenced_image_paths']=[]
            with self.assertRaisesRegex(ValueError,'arguments differ'):m.validate_attempt(text_receipt)
        changed=copy.deepcopy(receipt);changed['actualArguments']['prompt']='shell error'
        with self.assertRaisesRegex(ValueError,'arguments differ'):m.validate_attempt(changed)
        changed=copy.deepcopy(receipt);changed['dimensions']=[1024,1024]
        with self.assertRaisesRegex(ValueError,'Nonconforming'):m.validate_attempt(changed)

if __name__=='__main__':unittest.main()

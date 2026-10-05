"""N isolation and evidence regressions; fixtures stay inside N's private root."""
import copy, importlib.util, json
from pathlib import Path
import tempfile, unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
def load(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
p=load('np','dog-portrait-packet-n.py'); c=load('nc','dog-portrait-coordination.py')
E=ROOT/'reports/dogs-generated-artwork/cohort-n'
def bound(path):
 b=path.read_bytes(); return {'path':str(path),'sha256':p.sha(b),'bytes':len(b)}
class Safety(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(dir=E/'bootstrap'); self.r=Path(self.temp.name)
  self.auth=bound(E/'run-authorization-001.json'); self.base=bound(E/'preparation/baseline.json')
  self.reg={'cohortId':'dogs-portraits-n','maxConcurrentImageCalls':3,'sourcePolicyAuthorization':self.auth,'baseline':self.base,'selectionFrozen':True,'selectionSha256':'a'*64,'workers':[{'worker':w,'threadId':'test-'+w,'fullAccessVerified':True,'configuredModel':'gpt-6.1-sol','configuredReasoningEffort':'high','workspace':str(ROOT),'stageRoot':str(self.r/w),'activeCatalogIds':['VBO:0200038'] if w=='A' else []} for w in 'ABC']}
  self.rp=self.r/'registry.json'; self.save_reg()
  self.txt=self.r/'evidence.txt'; self.txt.write_text('Exact retained primary claim paragraphs and individually written prompt. '*5); self.b=bound(self.txt)
  source={'title':'Fixture breed organization','url':'https://example.org/standard','evidence':'Documented behavior and technique','sourceRole':'primary','snapshot':self.b,'text':self.b}
  summary='A documented character observation with a distinctive working habit, naturally calibrated to the exact identity. '*3
  short='A separate character-led short description, grounded in the documented behavior and working habits.'
  profile={k:v for k,v in [('summary',summary),('shortDescription',short)]}; profile.update({k+'Sha256':p.sha(v.encode()) for k,v in list(profile.items())}); profile['sources']=[{k:source[k] for k in ('title','url','evidence')}]
  dossier=self.save('dossier.json',{'catalogId':'VBO:0200038','imageInputs':[],'morphologyEvidence':[{'source':self.b,'facts':'Exact normative anatomy'}],'visualResearch':[{'url':'https://example.org/adult','observations':'Identified mature adult viewed'}]})
  self.packet={'schemaVersion':2,'cohortId':'dogs-portraits-n','worker':'A','createdAt':'2026-10-05T00:00:00Z','sourcePolicyAuthorization':self.auth,'entries':[{'catalogId':'VBO:0200038','displayName':'American Cocker Spaniel','sourcePurposePermissions':p.PURPOSES,'reference':{'mode':'text-only','imageInputs':[],'researchDossier':dossier},'evidence':[{**self.b,'role':'primary','url':source['url'],'acquisitionDisclosure':'Fixture','readByWriter':True}],'profile':profile,'primarySources':[source],'prompt':self.b,'promptTemplateVersion':'dogs-field-guide-v11-cohort-n',**{k:'Exact individually reviewed rationale' for k in ('morphologyBrief','scene','sceneRationale','identityRationale')}}]}
  self.catalog={'VBO:0200038':{'displayName':'American Cocker Spaniel'}}
 def save(self,name,obj):
  f=self.r/name; f.write_text(json.dumps(obj)); return bound(f)
 def save_reg(self): self.rp.write_text(json.dumps(self.reg))
 def tearDown(self): self.temp.cleanup()
 def test_isolation_before_database(self):
  bad=ROOT/'scripts'/'nonexistent-n-registry.json'
  with self.assertRaisesRegex(ValueError,'isolated'): c.validate_n_registry(bad,self.reg)
  with self.assertRaisesRegex(ValueError,'isolated'): c.validate_n_registry('/Users/danbretl/src/stackrank/registry.json',self.reg)
  self.assertFalse((self.r/'coordination.sqlite3').exists())
 def test_exact_run_and_baseline_cap(self):
  c.Coordinator(self.rp)
  self.reg['maxConcurrentImageCalls']=4; self.save_reg()
  with self.assertRaisesRegex(ValueError,'three-permit'): c.Coordinator(self.rp)
  self.reg['maxConcurrentImageCalls']=3; self.reg['workers'][0]['activeCatalogIds']=['VBO:'+str(i) for i in range(101)]; self.save_reg()
  with self.assertRaisesRegex(ValueError,'capped'): c.Coordinator(self.rp)
  self.reg['workers'][0]['activeCatalogIds']=[json.loads((E/'preparation/baseline.json').read_text())['publishedIds'][0]]; self.save_reg()
  with self.assertRaisesRegex(ValueError,'outside baseline'): c.Coordinator(self.rp)
 def test_unknown_source_and_copy_and_native_changes(self):
  self.assertTrue(p.validate(self.packet,self.catalog,set())['valid'])
  changed=copy.deepcopy(self.packet); changed['cohortId']='dogs-portraits-m'
  with self.assertRaisesRegex(ValueError,'cohort'): p.validate(changed,self.catalog,set())
  changed=copy.deepcopy(self.packet); changed['entries'][0]['profile']['summary']+=' changed'
  with self.assertRaisesRegex(ValueError,'length/hash'): p.validate(changed,self.catalog,set())
  changed=copy.deepcopy(self.packet); changed['sourcePolicyAuthorization']['sha256']='a'*64
  with self.assertRaisesRegex(ValueError,'bytes changed'): p.validate(changed,self.catalog,set())
  self.txt.write_text('changed native/source bytes')
  with self.assertRaisesRegex(ValueError,'bytes changed'): p.binding(self.b)
 def test_permit_limit_reuse_and_uncertain_owner(self):
  coord=c.Coordinator(self.rp)
  permits=[]
  for w in 'ABC': permits.append(coord.acquire('image',w,'test-'+w,'request-'+w,{'fixture':True}))
  with self.assertRaises(c.Busy): coord.acquire('image','A','test-A','request-A2',{'fixture':True})
  with self.assertRaises(c.Busy): coord.acquire('image','A','test-A','request-A',{'fixture':True})
  with self.assertRaisesRegex(ValueError,'actual active owner'): coord.finish(permits[0],'B','test-B','completed',{'fixture':True})
  coord.finish(permits[0],'A','test-A','completed',{'fixture':True})
  with self.assertRaises(c.Busy): coord.acquire('image','A','test-A','request-A',{'fixture':True})
  coord.acquire('image','A','test-A','request-A2',{'fixture':True})
 def test_self_approval_rejected(self):
  pb=self.save('packet.json',self.packet)
  peer={'schemaVersion':1,'cohortId':'dogs-portraits-n','reviewer':'A','packet':pb,'verdict':'pass','entries':[]}
  with self.assertRaisesRegex(ValueError,'Independent peer'): p.validate(self.packet,self.catalog,set(),peer)
 def test_prior_tranche_approval_and_changed_copy_fail(self):
  pb=self.save('packet.json',self.packet); entry=self.packet['entries'][0]
  peer=self.save('peer.json',{'schemaVersion':1,'cohortId':'dogs-portraits-n','reviewer':'B','packet':pb,'verdict':'pass','entries':[{'catalogId':'VBO:0200038','summarySha256':entry['profile']['summarySha256'],'shortDescriptionSha256':entry['profile']['shortDescriptionSha256'],'notes':'Independent actual source review','actualSourcesRead':True}]})
  q=self.save('qualification.json',{'catalogId':'VBO:0200038','packet':pb,'peer':peer,'status':'qualified'})
  freeze={'id':'n01','cohortId':'dogs-portraits-n','catalogIds':['VBO:0200038'],'members':[{'catalogId':'VBO:0200038','qualification':q}]}
  digest=p.sha(json.dumps(freeze,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()); freeze['selectionSha256']=digest
  self.save('tranche-n01-freeze-001.json',freeze)
  self.reg['selectionSha256']=digest; self.save_reg()
  approval={'cohortId':'dogs-portraits-n','worker':'A','threadId':'test-A','catalogId':'VBO:0200038','receiptType':'immutable-root-precall-approval','status':'approved','authorizedAttemptId':'N-VBO:0200038-1','inputMode':'text-only','imageInputs':[],'sourcePolicyAuthorization':self.auth,'packet':pb,'peer':peer,'qualification':q,'profile':entry['profile'],'prompt':entry['prompt'],'researchDossier':entry['reference']['researchDossier'],'trancheId':'n01','trancheSha256':digest,'selectionSha256':digest,'referencePurposes':p.PURPOSES,'nativeDimensions':[1536,1024],**{k:True for k in ('rootMorphologyEvidenceRead','rootIdentityApproved','rootSourceUseApproved','rootSceneAndPromptApproved')}}
  d=self.r/'root-approvals'; d.mkdir(); raw=json.dumps(approval).encode(); ap=d/(p.sha(raw)+'.json');ap.write_bytes(raw)
  with patch.object(c._n_guard,'N_EVIDENCE',self.r):
   self.assertEqual(c.Coordinator(self.rp).image_preflight('A','test-A','VBO:0200038',ap)['catalogId'],'VBO:0200038')
   self.reg['selectionSha256']='b'*64; self.reg['priorSelectionDigests']=[digest]; self.save_reg()
   self.assertEqual(c.Coordinator(self.rp).image_preflight('A','test-A','VBO:0200038',ap)['catalogId'],'VBO:0200038')
   approval['profile']=dict(approval['profile'],summary='Altered approved copy');raw=json.dumps(approval).encode();changed=d/(p.sha(raw)+'.json');changed.write_bytes(raw)
   with self.assertRaisesRegex(ValueError,'approved copy'):c.Coordinator(self.rp).image_preflight('A','test-A','VBO:0200038',changed)
   self.reg['priorSelectionDigests']=[]; self.save_reg()
   with self.assertRaisesRegex(ValueError,'selection mismatch'):c.Coordinator(self.rp).image_preflight('A','test-A','VBO:0200038',ap)
if __name__=='__main__': unittest.main()

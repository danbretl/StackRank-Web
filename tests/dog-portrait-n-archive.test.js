import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { collectNRegenerationFiles } from '../scripts/dog-portrait-n-archive.mjs';
test('N archives retain selected closure and reject main and changed evidence',()=>{
 const root=fs.mkdtempSync(path.resolve('reports/dogs-generated-artwork/cohort-n/bootstrap/archive-fixture-'));
 try {
  const base=path.join(root,'reports/dogs-generated-artwork/cohort-n');fs.mkdirSync(base,{recursive:true});
  const put=(name,obj)=>{const p=path.join(base,name),raw=Buffer.from(JSON.stringify(obj));fs.writeFileSync(p,raw);return {path:p,sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length};};
  const source=put('source.json',{actual:'retained primary paragraphs'}), auth=put('auth.json',{authority:'direct-user-instruction'});
  const dossier=put('dossier.json',{morphologyEvidence:[{source}],visualResearch:[{observations:'Actual adult anatomy observation'}],imageInputs:[]});
  const packet=put('packet.json',{cohortId:'dogs-portraits-n',worker:'A',sourcePolicyAuthorization:auth,entries:[{catalogId:'VBO:0200038',reference:{mode:'text-only',researchDossier:dossier}}]});
  const peer=put('peer.json',{packet,reviewer:'B',verdict:'pass',entries:[{catalogId:'VBO:0200038'}]});
  put('tranche-n01-freeze-001.json',{id:'n01'});
  const entry={catalogId:'VBO:0200038',preparation:{packet,peer,trancheId:'n01'}};
  const files=collectNRegenerationFiles(root,entry);assert.equal(files.length,6);
  const external=path.join(root,'outside.json');fs.writeFileSync(external,'{}');
  const outside={path:external,sha256:createHash('sha256').update('{}').digest('hex'),bytes:2};
  assert.throws(()=>collectNRegenerationFiles(root,{...entry,extra:outside}),/outside private/);
  fs.writeFileSync(source.path,'changed');assert.throws(()=>collectNRegenerationFiles(root,entry),/bytes changed/);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

"""N-only admission. Validate isolation and immutable evidence before SQLite writes."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re

N_ROOT = Path(__file__).resolve().parents[1]
N_EVIDENCE = N_ROOT / 'reports/dogs-generated-artwork/cohort-n'
N_SOURCE_AUTH_SHA256 = '292924b03d5fb2b641dfdef0cd4667aafb98760b71edf9efc4d4ed26920f0b9f'
BASELINE_SHA256 = '3fe8411eb052891adce735845aee5e240633a1418a5627fdeff05d7f4d53d4e9'

def module():
    spec = importlib.util.spec_from_file_location('n_packet', Path(__file__).with_name('dog-portrait-packet-n.py'))
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result

def require_n_path(path):
    value = Path(path).resolve()
    if not value.is_relative_to(N_EVIDENCE.resolve()):
        raise ValueError('N writes/evidence require isolated N evidence root')
    return value

def validate_n_registry(path, registry):
    require_n_path(path)
    if registry.get('cohortId') != 'dogs-portraits-n' or registry.get('maxConcurrentImageCalls') != 3:
        raise ValueError('N cohort and exact three-permit maximum required')
    packet = module()
    packet.validate_source_authorization(registry['sourcePolicyAuthorization'])
    if registry['sourcePolicyAuthorization']['sha256'] != N_SOURCE_AUTH_SHA256:
        raise ValueError('N authorization hash mismatch')
    baseline = json.loads(packet.binding(registry['baseline']).read_text())
    ids = baseline.get('publishedIds', [])
    if registry['baseline']['sha256'] != BASELINE_SHA256 or len(set(ids)) != 802 or len(ids) != 802:
        raise ValueError('N exact baseline required')
    workers = registry.get('workers', [])
    if len(workers) != 3 or {w['worker'] for w in workers} != {'A','B','C'}:
        raise ValueError('N requires three distinct registered workers')
    active = []
    for w in workers:
        require_n_path(w['stageRoot'])
        if Path(w['workspace']).resolve() != N_ROOT.resolve():
            raise ValueError('This N run uses the integration workspace with isolated worker stages')
        if w.get('configuredModel') != 'gpt-6.1-sol' or w.get('configuredReasoningEffort') != 'high':
            raise ValueError('N worker model/reasoning registration mismatch')
        active.extend(w.get('activeCatalogIds', []))
    if len(active) > 100 or len(active) != len(set(active)) or set(active).intersection(ids):
        raise ValueError('N active IDs must be distinct, outside baseline, and capped at 100')

def validate_n_approval(registry, receipt):
    packet = module()
    packet.validate_bindings(receipt)
    ident = receipt['catalogId']
    if receipt.get('inputMode') != 'text-only' or not re.fullmatch('N-' + re.escape(ident) + '-[1-3]', receipt.get('authorizedAttemptId','')):
        raise ValueError('N exact finite text-only attempt required')
    if receipt.get('sourcePolicyAuthorization') != registry['sourcePolicyAuthorization']:
        raise ValueError('N run authorization changed')
    body = json.loads(packet.binding(receipt['packet']).read_text())
    peer = json.loads(packet.binding(receipt['peer']).read_text())
    catalog = {e['id']:e for e in json.loads((N_ROOT/'data/dogs/dog-catalog.json').read_text())['entities']}
    baseline = json.loads(packet.binding(registry['baseline']).read_text())
    packet.validate(body, catalog, set(baseline['publishedIds']), peer)
    selected = [e for e in body['entries'] if e['catalogId'] == ident]
    if len(selected) != 1 or body['worker'] != receipt['worker']:
        raise ValueError('N exact approved packet identity/owner required')
    entry = selected[0]
    if receipt.get('profile') != entry['profile'] or receipt.get('researchDossier') != entry['reference']['researchDossier']:
        raise ValueError('N approved copy, prompt or morphology differs from peer packet')
    validate_n_retry(packet, registry, receipt, entry)
    qualification = json.loads(packet.binding(receipt['qualification']).read_text())
    if qualification.get('catalogId') != ident or qualification.get('packet') != receipt['packet'] or qualification.get('peer') != receipt['peer'] or qualification.get('status') != 'qualified':
        raise ValueError('N exact qualified packet and peer required')
    freeze = json.loads((N_EVIDENCE/f"tranche-{receipt['trancheId']}-freeze-001.json").read_text())
    claimed = freeze.pop('selectionSha256')
    actual = hashlib.sha256(json.dumps(freeze,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    if claimed != actual or receipt.get('trancheSha256') != actual or receipt.get('selectionSha256') != actual or freeze.get('cohortId') != 'dogs-portraits-n' or not any(m['catalogId']==ident and m['qualification']==receipt['qualification'] for m in freeze['members']):
        raise ValueError('N immutable freeze/qualification membership mismatch')


def validate_n_retry(packet, registry, receipt, entry):
    """A fresh root amendment changes only the prompt; original qualification stays frozen."""
    number = int(receipt['authorizedAttemptId'].rsplit('-', 1)[1])
    if number == 1:
        if receipt.get('retryAmendment') or receipt.get('prompt') != entry['prompt']:
            raise ValueError('N first attempt must use original peer packet prompt')
        return
    amendment = json.loads(packet.binding(receipt['retryAmendment']).read_text())
    packet.validate_bindings(amendment)
    if (amendment.get('cohortId') != 'dogs-portraits-n' or amendment.get('catalogId') != receipt['catalogId']
            or amendment.get('authorizedAttemptId') != receipt['authorizedAttemptId']
            or amendment.get('status') != 'approved' or amendment.get('reviewer') != 'root'
            or not amendment.get('reason') or not amendment.get('reviewedAt')
            or amendment.get('prompt') != receipt['prompt'] or amendment.get('imageInputs') != []):
        raise ValueError('N exact root retry amendment required')
    previous = json.loads(packet.binding(amendment['previousAttempt']).read_text())
    packet.validate_attempt(previous)
    prior_approval = json.loads(packet.binding(previous['approval']).read_text())
    validate_n_approval(registry, prior_approval)
    rejection = json.loads(packet.binding(amendment['rootRejection']).read_text())
    if (previous.get('attemptId') != f"N-{receipt['catalogId']}-{number - 1}"
            or previous.get('status') != 'generated' or rejection.get('status') != 'rejected'
            or rejection.get('reviewer') != 'root' or rejection.get('wholeUntouchedNativeViewedAtOriginalDetail') is not True
            or rejection.get('attemptId') != previous['attemptId'] or rejection.get('catalogId') != receipt['catalogId']
            or rejection.get('attempt') != amendment['previousAttempt'] or rejection.get('native') != previous['native']):
        raise ValueError('N retry requires immediately preceding whole-native root rejection')
    immutable = ('worker','threadId','catalogId','packet','peer','qualification','profile','researchDossier',
                 'sourcePolicyAuthorization','trancheId','trancheSha256','selectionSha256','inputMode','imageInputs')
    if any(receipt.get(k) != prior_approval.get(k) for k in immutable):
        raise ValueError('N retry cannot change original owner, qualification, copy or sources')
    if len(packet.binding(receipt['prompt']).read_text().strip()) < 80:
        raise ValueError('N exact reviewed retry prompt required')

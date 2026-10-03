"""Validate cohort L's immutable evidence packets; human judgments remain mandatory."""
import argparse
import hashlib
import json
from pathlib import Path

SOURCE_POLICY = 'dogs-reference-research-2026-10-03.1'
SOURCE_AUTH_SHA256 = 'f846059e89386c25b6f5bf9b65c8ec3642ab83f85c5723e104102ed8d1f1b091'


def validate_source_authorization(item):
    body = json.loads(binding(item).read_text())
    if item['sha256'] != SOURCE_AUTH_SHA256 or body.get('approved') is not True or body.get('authority') != 'direct-user-instruction' or body.get('policyVersion') != SOURCE_POLICY:
        raise ValueError('Exact direct-user source policy authorization required')


PURPOSES = {'uiDisplayAllowed': False, 'publicSnapshotAllowed': False, 'rasterExportAllowed': False}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def binding(item):
    p = Path(item['path'])
    if not p.is_absolute() or not p.is_file():
        raise ValueError(f'Absolute existing evidence path required: {p}')
    raw = p.read_bytes()
    if sha(raw) != item['sha256'] or len(raw) != item['bytes']:
        raise ValueError(f'Evidence bytes changed: {p}')
    return p


def validate_bindings(value):
    if isinstance(value, dict):
        if {'path', 'sha256', 'bytes'}.issubset(value):
            binding(value)
        for item in value.values():
            validate_bindings(item)
    elif isinstance(value, list):
        for item in value:
            validate_bindings(item)


def validate(packet, catalog, published, peer=None):
    validate_bindings(packet)
    if packet.get('schemaVersion') not in (1, 2) or packet.get('cohortId') != 'dogs-portraits-l':
        raise ValueError('Expected cohort L packet schema 1 or 2')
    if packet.get('worker') not in ('A', 'B', 'C') or not packet.get('createdAt'):
        raise ValueError('Writer and acquisition date required')
    text_only = packet['schemaVersion'] == 2
    if text_only:
        validate_source_authorization(packet['sourcePolicyAuthorization'])
    entries = packet.get('entries', [])
    if not 1 <= len(entries) <= 10 or len({e['catalogId'] for e in entries}) != len(entries):
        raise ValueError('Packet requires 1–10 distinct entries')
    for e in entries:
        ident = e['catalogId']
        if ident not in catalog or e['displayName'] != catalog[ident]['displayName'] or ident in published:
            raise ValueError(f'Wrong/previously published exact identity: {ident}')
        if e['sourcePurposePermissions'] != PURPOSES:
            raise ValueError('Photograph purposes must all remain denied')
        ref = e['reference']
        if text_only:
            if ref.get('mode') != 'text-only' or ref.get('imageInputs') != [] or any(k in ref for k in ('original', 'assetId')):
                raise ValueError('Text-only packet cannot contain photo inputs or claim a photo rights asset')
            dossier = json.loads(binding(ref['researchDossier']).read_text())
            validate_bindings(dossier)
            if dossier.get('catalogId') != ident or dossier.get('imageInputs') != [] or not dossier.get('morphologyEvidence') or not dossier.get('visualResearch'):
                raise ValueError('Exact morphology and adult visual research dossier required')
        else:
            for k in ('fileTitle', 'canonicalFilePage', 'pinnedPage', 'creator', 'originalSourceChain', 'license', 'licenseUrl', 'attribution', 'visualInspection'):
                if not isinstance(ref.get(k), str) or not ref[k].strip():
                    raise ValueError(f'Missing reference {k}')
            if not isinstance(ref.get('pinnedRevision'), int) or ref['pinnedRevision'] <= 0:
                raise ValueError('Pinned original File revision required')
            binding(ref['original'])
            for key in ('metadata', 'fileText', 'originalGrant', 'licenseTerms'):
                binding(ref[key])
        if not e.get('evidence'):
            raise ValueError('Actual acquisition disclosures required')
        for evidence in e['evidence']:
            binding(evidence)
            if not evidence.get('role') or not evidence.get('url') or not evidence.get('acquisitionDisclosure'):
                raise ValueError('Evidence role, URL and actual acquisition disclosure required')
            if evidence.get('readByWriter') is not True:
                raise ValueError('Unread evidence cannot qualify')
        profile = e['profile']
        for key, minimum, maximum in [('summary', 230, 650), ('shortDescription', 80, 180)]:
            if not minimum <= len(profile[key]) <= maximum or sha(profile[key].encode()) != profile[key + 'Sha256']:
                raise ValueError(f'Invalid final {key} length/hash')
        sources = e['primarySources']
        if not sources or profile.get('sources') != [{k:s[k] for k in ('title','url','evidence')} for s in sources]:
            raise ValueError('Full profile and primary claim evidence must agree')
        for source in sources:
            if not source['url'].startswith('https://') or not source['evidence'] or not source.get('sourceRole'):
                raise ValueError('HTTPS primary claim/source-role evidence required')
            binding(source['snapshot']); binding(source['text'])
        for k in ('morphologyBrief', 'scene', 'sceneRationale', 'identityRationale'):
            if not isinstance(e.get(k), str) or not e[k].strip():
                raise ValueError(f'Missing {k}')
        prompt = binding(e['prompt']).read_text()
        if len(prompt.strip()) < 80 or e.get('promptTemplateVersion') != ('dogs-field-guide-v10-cohort-l' if text_only else 'dogs-field-guide-v9-cohort-l'):
            raise ValueError('Invalid exact prompt/template')
    if peer is not None:
        validate_bindings(peer)
        if peer.get('schemaVersion') != 1 or peer.get('cohortId') != 'dogs-portraits-l' or peer.get('reviewer') not in ('A','B','C') or peer['reviewer'] == packet['worker']:
            raise ValueError('Independent peer required')
        p = binding(peer['packet'])
        if json.loads(p.read_text()) != packet or peer.get('verdict') != 'pass':
            raise ValueError('Peer must approve exact final packet')
        checks = {x['catalogId']: x for x in peer.get('entries', [])}
        if set(checks) != {e['catalogId'] for e in entries}:
            raise ValueError('Peer must review every entry')
        for e in entries:
            review = checks[e['catalogId']]
            for k in ('summarySha256','shortDescriptionSha256'):
                if review.get(k) != e['profile'][k]:
                    raise ValueError('Peer text hash mismatch')
            if not review.get('notes') or review.get('actualSourcesRead') is not True:
                raise ValueError('Actual independent source review required')
    return {'valid': True, 'entries': len(entries), 'independentPeerVerified': peer is not None,
            'humanRootSourceVisualRightsPromptApprovalStillRequired': True}


def validate_attempt(receipt):
    if receipt.get('schemaVersion') not in (1, 2) or receipt.get('cohortId') != 'dogs-portraits-l':
        raise ValueError('Expected L attempt schema 1')
    approval = json.loads(binding(receipt['approval']).read_text())
    preflight = json.loads(binding(receipt['preflight']).read_text())
    if (approval.get('cohortId') != 'dogs-portraits-l' or approval.get('status') != 'approved'
            or approval.get('catalogId') != receipt['catalogId']
            or approval.get('authorizedAttemptId') != receipt['attemptId']
            or preflight.get('attemptId') != receipt['attemptId']
            or preflight.get('approvalSha256') != receipt['approval']['sha256']
            or preflight.get('permit') != receipt['permit'] or preflight.get('preflightSucceeded') is not True):
        raise ValueError('Attempt lacks exact approval/preflight/permit')
    expected = {'prompt': binding(approval['prompt']).read_text(), 'transparent_background': False}
    if approval.get('inputMode') == 'text-only':
        validate_source_authorization(approval['sourcePolicyAuthorization'])
        if receipt['schemaVersion'] != 2 or approval.get('imageInputs') != [] or 'reference' in approval or approval.get('additionalReferences'):
            raise ValueError('Text-only approval cannot contain image inputs')
        binding(approval['researchDossier'])
    else:
        expected['referenced_image_paths'] = [approval['reference']['path']] + [x['path'] for x in approval.get('additionalReferences', [])]
    if receipt.get('tool') != 'image_gen.imagegen' or receipt.get('actualArguments') != expected:
        raise ValueError('Actual built-in tool arguments differ from approved inputs')
    if receipt.get('imageModel') != 'undisclosed' or not receipt.get('startedAt') or not receipt.get('completedAt'):
        raise ValueError('Actual timing/model disclosure missing')
    if receipt.get('status') == 'failed':
        if not receipt.get('failure'):
            raise ValueError('Failure evidence missing')
    elif receipt.get('status') == 'generated':
        native = binding(receipt['native'])
        if sha(native.read_bytes()) != receipt.get('originalOutputSha256') or not receipt.get('originalOutputPath'):
            raise ValueError('Untouched native/original output binding missing')
        if receipt.get('workerWholeNativeViewed') is not True or not receipt.get('workerQaNotes'):
            raise ValueError('Actual whole-native review missing')
        if receipt.get('dimensions') != [1536, 1024] and receipt.get('workerVerdict') != 'reject':
            raise ValueError('Nonconforming native cannot be accepted')
    else:
        raise ValueError('Unknown attempt outcome')
    return {'valid': True, 'rootNativeReviewStillRequired': True}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('packet'); p.add_argument('--peer'); p.add_argument('--attempt', action='store_true'); p.add_argument('--root', default=str(Path(__file__).resolve().parents[1]))
    args = p.parse_args(); root = Path(args.root)
    if args.attempt:
        print(json.dumps(validate_attempt(json.loads(Path(args.packet).read_text()))))
        return
    catalog = {x['id']: x for x in json.loads((root/'data/dogs/dog-catalog.json').read_text())['entities']}
    published = {x['catalogId'] for x in json.loads((root/'data/dogs/generated-artwork.json').read_text())['assets']}
    print(json.dumps(validate(json.loads(Path(args.packet).read_text()), catalog, published,
                              json.loads(Path(args.peer).read_text()) if args.peer else None)))

if __name__ == '__main__':
    main()

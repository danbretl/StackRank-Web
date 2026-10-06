"""One sequential, nonexpiring image slot for the authorized October 2026 audit.

No network, source fetching, or generation is performed here. Immutable lead
approvals bind the exact text-only prompt and dossier. Permission profile is
recorded truthfully; historical cohort Full-access attestations are not reused.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_binding(binding):
    path = Path(binding['path']).resolve()
    raw = path.read_bytes()
    if digest(raw) != binding['sha256'] or len(raw) != binding['bytes']:
        raise ValueError('Approved bytes changed: ' + str(path))
    return path, raw


def approved(path):
    path = Path(path).resolve()
    raw = path.read_bytes()
    if path.stem != digest(raw) or path.parent.name != 'root-approvals':
        raise ValueError('Expected immutable hash-named lead approval')
    receipt = json.loads(raw)
    required = {
        'receiptType': 'immutable-root-precall-approval', 'status': 'approved',
        'correctionId': 'dogs-audit-corrections-2026-10-06', 'inputMode': 'text-only',
        'permissionProfile': 'workspace-write', 'imageInputs': [],
        'nativeDimensions': [1536, 1024], 'rootMorphologyEvidenceRead': True,
        'rootIdentityApproved': True, 'rootSourceUseApproved': True,
        'rootSceneAndPromptApproved': True,
    }
    if any(receipt.get(k) != v for k, v in required.items()):
        raise ValueError('Invalid approval or missing exact text-only review gates')
    if receipt.get('catalogId') not in ('VBO:0200271', 'VBO:0200769'):
        raise ValueError('Outside the two confirmed corrections')
    if receipt.get('referencePurposes') != dict.fromkeys(
        ('uiDisplayAllowed', 'publicSnapshotAllowed', 'rasterExportAllowed'), False
    ) or 'reference' in receipt or receipt.get('additionalReferences'):
        raise ValueError('No image reference or display permission allowed')
    for key in ('prompt', 'researchDossier', 'sourcePolicyAuthorization'):
        read_binding(receipt[key])
    if len(read_binding(receipt['prompt'])[1].strip()) < 80:
        raise ValueError('Prompt is empty or an error')
    return receipt, digest(raw)


def exclusive_json(path, value):
    with path.open('x', encoding='utf-8') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())


def acquire(state, approval, attempt):
    receipt, approval_hash = approved(approval)
    if not attempt or not attempt.isalnum():
        raise ValueError('Attempt must be alphanumeric')
    state = Path(state).resolve()
    state.mkdir(parents=True, exist_ok=True)
    request = digest((receipt['catalogId'] + ':' + attempt).encode())
    active = state / 'active.json'
    evidence = {'request': request, 'catalogId': receipt['catalogId'], 'attempt': attempt,
                'approvalSha256': approval_hash, 'approvalPath': str(Path(approval).resolve()),
                'startedAt': datetime.now(timezone.utc).isoformat(), 'status': 'active'}
    exclusive_json(active, evidence)
    try:
        exclusive_json(state / (request + '.json'), evidence)
    except Exception:
        active.unlink()
        raise
    return evidence


def finish(state, request, output):
    state = Path(state).resolve()
    active = state / 'active.json'
    receipt = json.loads(active.read_text())
    if receipt['request'] != request:
        raise ValueError('Only the active request can finish')
    path = Path(output).resolve()
    raw = path.read_bytes()
    if not raw:
        raise ValueError('Actual output or failure record required')
    result = {**receipt, 'status': 'completed',
              'finishedAt': datetime.now(timezone.utc).isoformat(),
              'output': {'path': str(path), 'sha256': digest(raw), 'bytes': len(raw)}}
    exclusive_json(state / (request + '-completion.json'), result)
    active.unlink()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', required=True)
    sub = parser.add_subparsers(dest='action', required=True)
    start = sub.add_parser('acquire')
    start.add_argument('--approval', required=True)
    start.add_argument('--attempt', required=True)
    end = sub.add_parser('finish')
    end.add_argument('--request', required=True)
    end.add_argument('--output', required=True)
    sub.add_parser('status')
    args = parser.parse_args()
    if args.action == 'acquire':
        result = acquire(args.state, args.approval, args.attempt)
    elif args.action == 'finish':
        result = finish(args.state, args.request, args.output)
    else:
        active = Path(args.state) / 'active.json'
        result = {'active': json.loads(active.read_text()) if active.exists() else None}
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

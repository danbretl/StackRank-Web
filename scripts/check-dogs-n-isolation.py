"""Read-only cohort N preflight; a workflow guard, not an OS write sandbox."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ROOT = Path('/Users/danbretl/.codex/worktrees/dogs-cohort-n/stackrank')
AUDIT_ROOT = Path('/Users/danbretl/src/stackrank')
BRANCH = 'dogs/cohort-n-100'
BASE = 'c3ba4b030f7ad587e8a11cfc264c86b2543e5ab1'
BASELINE = ROOT / 'reports/dogs-generated-artwork/cohort-n/preparation/baseline.json'


def contained(path, parent):
    return Path(path).resolve().is_relative_to(Path(parent).resolve())


def require_write_path(path, root=EXPECTED_ROOT):
    target = Path(path).resolve()
    allowed = [Path(root).resolve(), *(Path(f'/Users/danbretl/.codex/worktrees/dogs-n-worker-{w}/stackrank').resolve() for w in 'abc')]
    if not any(target.is_relative_to(p) for p in allowed) or target.is_relative_to(AUDIT_ROOT.resolve()):
        raise ValueError(f'Write destination escapes isolated N workspaces: {path}')
    return target


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--full', action='store_true', help='Also verify all 802 baseline pairs, variants, masters and historical cohort files')
    parser.add_argument('--write-path', action='append', default=[])
    parser.add_argument('--registry', help='Check an N registry without opening or initializing SQLite')
    args = parser.parse_args()
    if ROOT != EXPECTED_ROOT.resolve() or Path.cwd().resolve() != ROOT:
        raise ValueError('Run this guard from the prepared N integration worktree')
    if git(ROOT, 'branch', '--show-current') != BRANCH or git(ROOT, 'rev-parse', '--show-toplevel') != str(ROOT):
        raise ValueError('Wrong integration branch or Git root')
    subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', BASE, 'HEAD'], check=True)
    baseline = json.loads(BASELINE.read_text())
    if baseline['baselineCommit'] != BASE or baseline['worktree'] != str(ROOT):
        raise ValueError('Wrong immutable baseline')
    if git(AUDIT_ROOT, 'rev-parse', 'HEAD') != BASE:
        raise ValueError('Audited main advanced; review isolation and report it, never reset or overwrite main')
    for relative, expected in baseline['mainEvidenceHashes'].items():
        if sha(AUDIT_ROOT / relative) != expected:
            raise ValueError(f'Audited checkout/evidence changed: {relative}; investigate without restoring it')
    for private in ['reports/dogs-generated-artwork/cohort-n', 'assets/dogs/generated-masters/cohort-n']:
        if not contained(ROOT / private, ROOT):
            raise ValueError(f'Private N root redirects outside worktree: {private}')
    for target in args.write_path:
        require_write_path(target)
    if args.registry:
        registry_path = Path(args.registry).resolve()
        if not contained(registry_path, ROOT / 'reports/dogs-generated-artwork/cohort-n'):
            raise ValueError('Registry must be in N private evidence root')
        registry = json.loads(registry_path.read_text())
        if registry.get('cohortId') != 'dogs-portraits-n' or registry.get('maxConcurrentImageCalls') != 3:
            raise ValueError('Expected N registry with exactly three maximum image permits')
        for worker in registry.get('workers', []):
            for field in ['stageRoot', 'workspace']:
                require_write_path(worker[field])
            if not contained(worker['stageRoot'], ROOT / 'reports/dogs-generated-artwork/cohort-n'):
                raise ValueError('Worker stage must be under N private evidence root')
    if args.full:
        artwork = {a['catalogId']: a for a in json.loads((ROOT / 'data/dogs/generated-artwork.json').read_text())['assets']}
        profiles = json.loads((ROOT / 'data/dogs/breed-profiles.json').read_text())['profiles']
        for ident in baseline['publishedIds']:
            if artwork.get(ident) != baseline['artworkById'][ident] or profiles.get(ident) != baseline['profilesById'][ident]:
                raise ValueError(f'Baseline pair changed: {ident}')
            for variant in artwork[ident]['variants']:
                if sha(ROOT / variant['url']) != variant['sha256']:
                    raise ValueError(f'Baseline variant changed: {variant["url"]}')
        for relative, ident in baseline['masterCopies']['paths'].items():
            p = ROOT / relative
            if p.is_symlink() or p.stat().st_ino == (AUDIT_ROOT / relative).stat().st_ino or sha(p) != baseline['artworkById'][ident]['masterSha256']:
                raise ValueError(f'Baseline master is changed or not independently copied: {relative}')
        for relative, expected in baseline['protectedFiles'].items():
            if sha(ROOT / relative) != expected:
                raise ValueError(f'Historical cohort/batch/profile file changed: {relative}')
    print(json.dumps({'status': 'passed', 'worktree': str(ROOT), 'branch': BRANCH, 'baselinePairs': 802,
                      'fullPreservationChecked': args.full, 'generationInvokedByThisCheck': False,
                      'note': 'Read-only check; generation status must be derived from N receipts once the user starts the session'}))


if __name__ == '__main__':
    main()

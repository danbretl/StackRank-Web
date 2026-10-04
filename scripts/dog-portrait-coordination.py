"""Atomic, durable coordination for explicitly registered cohort K/L/M workers.

There are no expiring permits: root checks actual owner status before recovery.
Workers invoke this exact root-owned helper, with the central registry path.
"""
import argparse
import hashlib
import json
import pathlib
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone


M_SOURCE_AUTH_SHA256 = '9fc88af4a34170def317b17d379570eb7319e40e55d30b05c9fc358529e2fd9e'
SOURCE_AUTH_SHA256 = 'f846059e89386c25b6f5bf9b65c8ec3642ab83f85c5723e104102ed8d1f1b091'

def now():
    return datetime.now(timezone.utc).isoformat()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


class Busy(RuntimeError):
    pass


class Coordinator:
    def __init__(self, registry_path):
        self.registry_path = pathlib.Path(registry_path).resolve()
        self.registry = json.loads(self.registry_path.read_text())
        if self.registry.get('cohortId') not in ('dogs-portraits-k', 'dogs-portraits-l', 'dogs-portraits-m'):
            raise ValueError('Wrong coordination cohort')
        self.root = self.registry_path.parent
        self.db_path = self.root / 'coordination.sqlite3'
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS permits (id TEXT PRIMARY KEY, kind TEXT, worker TEXT, thread TEXT, request TEXT UNIQUE, started TEXT, status TEXT, evidence TEXT)')
            db.execute('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT)')
            db.execute('CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, action TEXT, payload TEXT)')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=20)
        db.execute('PRAGMA busy_timeout=20000')
        try:
            with db:
                yield db
        finally:
            db.close()

    def owner(self, worker, thread, catalog_id=None, kind=None):
        row = next((x for x in self.registry['workers'] if x['worker'] == worker), None)
        if not row or row['threadId'] != thread or row.get('fullAccessVerified') is not True:
            raise ValueError('Unregistered worker/thread or unverified Full access')
        allocation = row.get('activeCatalogIds', []) if self.registry.get('selectionFrozen') else row.get('auditCatalogIds', [])
        if kind == 'commons' and self.registry.get('selectionFrozen') and self.registry.get('commonsReserveReadinessAuthorized') is True:
            research = row.get('commonsResearchCatalogIds', [])
            if not isinstance(research, list) or len(research) != len(set(research)) or not set(research).issubset(row.get('auditCatalogIds', [])):
                raise ValueError('Invalid root-owned Commons research allocation')
            allocation = allocation + research
        if catalog_id is not None and catalog_id not in allocation:
            raise ValueError('Identity is outside this worker\'s frozen active assignment')
        return row

    def event(self, db, action, payload):
        db.execute('INSERT INTO events(at,action,payload) VALUES(?,?,?)', (now(), action, json.dumps(payload, sort_keys=True)))

    def acquire(self, kind, worker, thread, request, evidence, catalog_id=None):
        self.owner(worker, thread, catalog_id, kind)
        if kind not in ('commons', 'image') or not request:
            raise ValueError('Invalid permit request')
        if not self.registry.get('selectionFrozen') and not (kind == 'commons' and self.registry.get('auditAllocationFrozen') is True and self.registry.get('commonsAuditAuthorized') is True):
            raise ValueError('Selection is not frozen')
        if kind == 'commons' and self.registry.get('commonsAcquisitionAuthorized') is not True:
            raise ValueError('Commons acquisition is not authorized yet')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT value FROM state WHERE key=?', ('commons_global_stop',)).fetchone() and kind == 'commons':
                raise Busy('Global Commons stop: root must adjudicate recorded HTTP 429')
            if db.execute('SELECT id,status FROM permits WHERE request=?', (request,)).fetchone():
                raise Busy('Request already recorded; do not duplicate an uncertain in-flight operation')
            active = db.execute('SELECT worker FROM permits WHERE kind=? AND status=?', (kind, 'active')).fetchall()
            limit = 1 if kind == 'commons' else min(4, self.registry.get('maxConcurrentImageCalls', 4))
            if len(active) >= limit or any(x[0] == worker for x in active):
                raise Busy('Permit capacity occupied; advance independent work or check owner status')
            permit = str(uuid.uuid4())
            db.execute('INSERT INTO permits VALUES(?,?,?,?,?,?,?,?)', (permit, kind, worker, thread, request, now(), 'active', json.dumps(evidence, sort_keys=True)))
            self.event(db, 'acquire', {'permit': permit, 'kind': kind, 'worker': worker, 'thread': thread, 'request': request})
            return permit

    def finish(self, permit, worker, thread, status, evidence):
        self.owner(worker, thread)
        if status not in ('completed', 'failed') or not evidence:
            raise ValueError('Completion needs actual output/failure evidence')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT kind,worker,thread,status FROM permits WHERE id=?', (permit,)).fetchone()
            if not row or row[1:3] != (worker, thread) or row[3] != 'active':
                raise ValueError('Only the actual active owner may complete its permit')
            db.execute('UPDATE permits SET status=?,evidence=? WHERE id=?', (status, json.dumps(evidence, sort_keys=True), permit))
            if row[0] == 'commons':
                db.execute('INSERT OR REPLACE INTO state VALUES(?,?)', ('commons_last_completed', str(time.time())))
                if evidence.get('httpStatus') == 429:
                    db.execute('INSERT OR REPLACE INTO state VALUES(?,?)', ('commons_global_stop', json.dumps(evidence, sort_keys=True)))
            self.event(db, 'finish', {'permit': permit, 'worker': worker, 'status': status, 'evidence': evidence})

    def status(self):
        with self.connect() as db:
            return {'permits': [dict(zip(['id', 'kind', 'worker', 'thread', 'request', 'started', 'status', 'evidence'], r)) for r in db.execute('SELECT * FROM permits')], 'state': dict(db.execute('SELECT * FROM state'))}

    def image_preflight(self, worker, thread, catalog_id, approval_path):
        self.owner(worker, thread, catalog_id)
        p = pathlib.Path(approval_path).resolve()
        if not p.is_relative_to(self.root / 'root-approvals'):
            raise ValueError('Dedicated root-owned approval path required')
        raw = p.read_bytes()
        receipt = json.loads(raw)
        expected = {'cohortId': self.registry['cohortId'], 'worker': worker, 'threadId': thread, 'catalogId': catalog_id,
                    'receiptType': 'immutable-root-precall-approval', 'status': 'approved'}
        if any(receipt.get(k) != v for k, v in expected.items()):
            raise ValueError('Root approval identity, ownership, status or selection mismatch')
        if p.stem != digest(raw):
            raise ValueError('Immutable root approval filename/hash mismatch')
        if receipt.get('selectionSha256') != self.registry['selectionSha256']:
            # Appending an L tranche must not strand an already approved call.
            # Bind older approval membership to its original immutable freeze.
            selection = receipt.get('selectionSha256')
            tranche_id = receipt.get('trancheId', '')
            if (self.registry['cohortId'] not in ('dogs-portraits-l', 'dogs-portraits-m')
                    or selection not in self.registry.get('priorSelectionDigests', [])
                    or not isinstance(tranche_id, str) or not tranche_id.startswith(self.registry['cohortId'][-1])
                    or not tranche_id[1:].isdigit()):
                raise ValueError('Root approval selection mismatch')
            freeze = json.loads((self.root / f'tranche-{tranche_id}-freeze-001.json').read_bytes())
            frozen_selection = freeze.pop('selectionSha256')
            computed = digest(json.dumps(freeze, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode())
            if (frozen_selection != selection or computed != selection
                    or receipt.get('trancheSha256') != selection
                    or freeze.get('id') != tranche_id or freeze.get('cohortId') != self.registry['cohortId']
                    or catalog_id not in freeze.get('catalogIds', [])
                    or not any(member.get('catalogId') == catalog_id and member.get('qualification') == receipt.get('qualification')
                               for member in freeze.get('members', []))):
                raise ValueError('Prior tranche approval membership or immutable freeze mismatch')
        text_only = receipt.get('inputMode') == 'text-only'
        if text_only:
            if self.registry['cohortId'] not in ('dogs-portraits-l', 'dogs-portraits-m') or receipt.get('sourcePolicyAuthorization') != self.registry.get('sourcePolicyAuthorization') or not receipt.get('sourcePolicyAuthorization'):
                raise ValueError('Text-only mode needs the bound direct-user L policy amendment')
            if receipt.get('imageInputs') != [] or 'reference' in receipt or receipt.get('additionalReferences'):
                raise ValueError('Text-only approval cannot contain photo inputs')
            if receipt['sourcePolicyAuthorization'].get('sha256') != (M_SOURCE_AUTH_SHA256 if self.registry['cohortId'] == 'dogs-portraits-m' else SOURCE_AUTH_SHA256):
                raise ValueError('Unknown source policy amendment')
        for key in (('packet', 'prompt', 'researchDossier', 'sourcePolicyAuthorization') if text_only else ('packet', 'prompt', 'reference')):
            item = receipt[key]
            source = pathlib.Path(item['path']).resolve()
            if digest(source.read_bytes()) != item['sha256']:
                raise ValueError(f'{key}: approved bytes changed')
        prompt = pathlib.Path(receipt['prompt']['path']).read_text()
        if len(prompt.strip()) < 80:
            raise ValueError('Empty/error prompt cannot be sent to imagegen')
        gates = ('rootMorphologyEvidenceRead', 'rootIdentityApproved', 'rootSourceUseApproved', 'rootSceneAndPromptApproved') if text_only else ('rootReferenceViewed', 'rootIdentityAndRightsApproved', 'rootSceneAndPromptApproved')
        for key in gates:
            if receipt.get(key) is not True:
                raise ValueError('Missing independent root gate: ' + key)
        if receipt.get('referencePurposes') != {'uiDisplayAllowed': False, 'publicSnapshotAllowed': False, 'rasterExportAllowed': False}:
            raise ValueError('All morphology-reference purposes must remain denied')
        if receipt.get('nativeDimensions') != [1536, 1024]:
            raise ValueError('Native 1536x1024 portrait contract changed')
        additional = receipt.get('additionalReferences', [])
        if not isinstance(additional, list) or len(additional) > 2:
            raise ValueError('At most two explicitly approved supplemental reference inputs')
        inputs = [] if text_only else [receipt['reference']]
        for item in additional:
            source = pathlib.Path(item['path']).resolve()
            if digest(source.read_bytes()) != item['sha256']:
                raise ValueError('supplemental reference: approved bytes changed')
            if item.get('rootReferenceViewed') is not True or item.get('rootIdentityAndRightsApproved') is not True or not str(item.get('limitedPurpose', '')).strip():
                raise ValueError('Supplemental reference requires explicit root identity/rights/visual review and limited purpose')
            if item.get('referencePurposes') != receipt['referencePurposes']:
                raise ValueError('Supplemental photograph purpose gates must remain denied')
            if source in [pathlib.Path(previous['path']).resolve() for previous in inputs]:
                raise ValueError('Duplicate reference input')
            inputs.append(item)
        return {'approvalPath': str(p), 'approvalSha256': digest(raw), 'prompt': prompt,
                'promptPath': receipt['prompt']['path'], 'promptSha256': receipt['prompt']['sha256'],
                'referencePath': None if text_only else receipt['reference']['path'], 'referenceSha256': None if text_only else receipt['reference']['sha256'],
                'inputMode': 'text-only' if text_only else 'licensed-photo',
                'referencePaths': [item['path'] for item in inputs],
                'referenceInputs': [{'path': item['path'], 'sha256': item['sha256']} for item in inputs],
                'packetPath': receipt['packet']['path'], 'packetSha256': receipt['packet']['sha256'],
                'catalogId': catalog_id, 'worker': worker, 'threadId': thread,
                'selectionSha256': receipt['selectionSha256'], 'nativeDimensions': [1536, 1024]}

    def commons_fetch(self, worker, thread, catalog_id, url, output, root_metadata_adjudication=None):
        row = self.owner(worker, thread, catalog_id, 'commons')
        parsed = urllib.parse.urlparse(url)
        allowed_hosts = {'commons.wikimedia.org', 'upload.wikimedia.org'}
        chain_hosts = set(self.registry.get('wikipediaChainHosts', []))
        if not chain_hosts.issubset({'en.wikipedia.org', 'de.wikipedia.org'}):
            raise ValueError('Unexpected upstream Wikipedia chain host')
        allowed_hosts.update(chain_hosts)
        if parsed.scheme != 'https' or parsed.hostname not in allowed_hosts or parsed.username or parsed.password:
            raise ValueError('Only explicit HTTPS Commons/upload URLs are allowed')
        if parsed.hostname in chain_hosts and not (parsed.path in ('/w/api.php', '/w/index.php') or parsed.path.startswith('/wiki/File:') or parsed.path.startswith('/wiki/Datei:')):
            raise ValueError('Upstream Wikipedia requests must be explicit File history/metadata evidence')
        negative = {'rows': []}
        if self.registry.get('negativeRegistry'):
            item = self.registry['negativeRegistry']
            raw = pathlib.Path(item['path']).read_bytes()
            if digest(raw) != item['sha256']:
                raise ValueError('Preserved negative-registry bytes changed')
            negative = json.loads(raw)
        def normalize(title):
            title = urllib.parse.unquote(title).replace('_', ' ').strip()
            namespace, separator, name = title.partition(':')
            if separator and namespace.casefold() in ('file', 'image'):
                name = name.strip()
                return 'File:' + (name[:1].upper() + name[1:])
            return title
        banned_titles = {normalize(x['title']) for x in negative['rows']}
        requested_titles = urllib.parse.parse_qs(parsed.query).get('titles', [])
        if parsed.path.startswith('/wiki/File:'):
            requested_titles.append(parsed.path.removeprefix('/wiki/'))
        if parsed.hostname == 'upload.wikimedia.org':
            requested_titles.append('File:' + parsed.path.rsplit('/', 1)[-1])
        metadata_decision_bound = None
        blocked = [normalize(t) for group in requested_titles for t in group.split('|') if normalize(t) in banned_titles]
        if blocked:
            query = urllib.parse.parse_qs(parsed.query)
            requested = [normalize(t) for group in requested_titles for t in group.split('|')]
            props = set('|'.join(query.get('prop', [])).split('|'))
            eligible = (parsed.hostname == 'commons.wikimedia.org' and parsed.path == '/w/api.php'
                        and query.get('action') == ['query'] and query.get('format') == ['json']
                        and len(requested) == 1 and props and props.issubset({'revisions', 'imageinfo'}))
            adjudication = next((x for x in self.registry.get('knownNegativeMetadataAdjudications', [])
                                 if x.get('worker') == worker and x.get('catalogId') == catalog_id
                                 and normalize(x.get('fileTitle', '')) == requested[0]), None) if eligible else None
            if root_metadata_adjudication and eligible:
                decision_path = pathlib.Path(root_metadata_adjudication).resolve()
                if not decision_path.is_relative_to(self.root / 'root-metadata-adjudications'):
                    raise ValueError('Root-owned immutable metadata adjudication path required')
                decision_bytes = decision_path.read_bytes()
                if decision_path.stem != digest(decision_bytes):
                    raise ValueError('Immutable metadata adjudication filename/hash mismatch')
                proposed = json.loads(decision_bytes)
                adjudication = {'originalSha256': proposed.get('original', {}).get('sha256'),
                                'rootDecision': {'path': str(decision_path), 'sha256': digest(decision_bytes)}}
            if not adjudication:
                raise ValueError('Exact previously rejected File title: reuse disposition; new qualifying evidence requires root adjudication')
            bound = adjudication['rootDecision']
            raw = pathlib.Path(bound['path']).read_bytes()
            if digest(raw) != bound['sha256']:
                raise ValueError('Root metadata adjudication bytes changed')
            decision = json.loads(raw)
            source = decision['original']
            if (decision.get('receiptType') != 'root-known-negative-retained-source-metadata-adjudication'
                    or decision.get('worker') != worker or decision.get('catalogId') != catalog_id
                    or normalize(decision.get('fileTitle', '')) != requested[0]
                    or decision.get('sourceBodyReassessment') != 'PASS'
                    or decision.get('rootWholeOriginalPersonallyViewed') is not True
                    or decision.get('metadataReadinessOnly') is not True
                    or decision.get('generationAuthorized') is not False
                    or any(decision.get('sourcePurposePermissions', {}).get(k) is not False
                           for k in ('uiDisplayAllowed', 'publicSnapshotAllowed', 'rasterExportAllowed'))
                    or digest(pathlib.Path(source['path']).read_bytes()) != source['sha256']
                    or source['sha256'] != adjudication.get('originalSha256')):
                raise ValueError('Invalid exact retained-source metadata adjudication')
            metadata_decision_bound = bound
        target = pathlib.Path(output).resolve()
        worker_root = pathlib.Path(row['stageRoot']).resolve()
        if not target.is_relative_to(worker_root) or target.exists():
            raise ValueError('Use a fresh immutable output under your allocated staging root')
        target.parent.mkdir(parents=True, exist_ok=True)
        permit = self.acquire('commons', worker, thread, str(target), {'url': url, 'catalogId': catalog_id}, catalog_id)
        with self.connect() as db:
            last = db.execute('SELECT value FROM state WHERE key=?', ('commons_last_completed',)).fetchone()
        if last:
            time.sleep(max(0, float(last[0]) + 5.1 - time.time()))
        started = now()
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None
        opener = urllib.request.build_opener(NoRedirect())
        request = urllib.request.Request(url, headers={'User-Agent': 'StackRankDogsResearch/1.0 (https://github.com/danbretl/StackRank-Web; low-volume identity/rights research)'})
        try:
            try:
                response = opener.open(request, timeout=45)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                body = response.read()
                status = response.code
                headers = dict(response.headers.items())
            target.write_bytes(body)
            evidence = {'catalogId': catalog_id, 'url': url, 'startedAt': started, 'completedAt': now(),
                        'httpStatus': status, 'headers': headers, 'path': str(target), 'sha256': digest(body),
                        'bytes': len(body), 'permit': permit, 'redirectsFollowed': False}
            if metadata_decision_bound:
                evidence['rootMetadataAdjudication'] = metadata_decision_bound
            rejected_sha256 = {x.get('originalSha256') for x in negative['rows']}
            rejected_sha256.update(x.get('sourceSha256') for x in negative['rows']
                                   if pathlib.Path(x.get('sourcePath', '')).suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'))
            rejected_sha1 = {x.get('originalSha1') for x in negative['rows']}
            if digest(body) in rejected_sha256 or hashlib.sha1(body).hexdigest() in rejected_sha1:
                evidence['knownRejectedOriginal'] = True
            target.with_name(target.name + '.receipt.json').write_text(json.dumps(evidence, indent=2) + '\n')
            self.finish(permit, worker, thread, 'completed' if status == 200 else 'failed', evidence)
            if status != 200:
                raise RuntimeError(f'HTTP {status}; recorded evidence is not a qualified reference')
            if evidence.get('knownRejectedOriginal'):
                raise RuntimeError('Retained bytes match a rejected original under another filename; no qualification or image call allowed')
            return evidence
        except Exception as error:
            if any(x['id'] == permit and x['status'] == 'active' for x in self.status()['permits']):
                self.finish(permit, worker, thread, 'failed', {'failure': str(error), 'completedAt': now()})
            raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--registry', required=True)
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('status')
    fetch = sub.add_parser('commons-fetch')
    image = sub.add_parser('image-acquire')
    finish = sub.add_parser('image-finish')
    for p in (fetch, image, finish):
        p.add_argument('--worker', required=True)
        p.add_argument('--thread', required=True)
    for p in (fetch, image):
        p.add_argument('--catalog-id', required=True)
    fetch.add_argument('--url', required=True)
    fetch.add_argument('--output', required=True)
    fetch.add_argument('--root-metadata-adjudication')
    image.add_argument('--approval', required=True)
    image.add_argument('--attempt', required=True)
    finish.add_argument('--permit', required=True)
    finish.add_argument('--evidence', required=True)
    finish.add_argument('--failed', action='store_true')
    args = parser.parse_args()
    c = Coordinator(args.registry)
    if args.action == 'status':
        value = c.status()
    elif args.action == 'commons-fetch':
        value = c.commons_fetch(args.worker, args.thread, args.catalog_id, args.url, args.output, args.root_metadata_adjudication)
    elif args.action == 'image-acquire':
        evidence = c.image_preflight(args.worker, args.thread, args.catalog_id, args.approval)
        if c.registry['cohortId'] == 'dogs-portraits-m' and json.loads(pathlib.Path(args.approval).read_text()).get('authorizedAttemptId') != args.attempt:
            raise ValueError('M attempt must equal dedicated approved attempt')
        permit = c.acquire('image', args.worker, args.thread, args.attempt, evidence, args.catalog_id)
        value = {**evidence, 'permit': permit, 'attemptId': args.attempt,
                 'preflightSucceeded': True, 'checkedAt': now(), 'configuredOperatorModel': 'gpt-6.1-sol',
                 'configuredReasoningEffort': 'high' if c.registry['cohortId'] in ('dogs-portraits-l', 'dogs-portraits-m') else 'xhigh',
                 'actualRuntimeModelIdentifierDisclosed': False}
        directory = pathlib.Path(c.owner(args.worker, args.thread)['stageRoot']) / 'preflights'
        directory.mkdir(exist_ok=True)
        path = directory / (permit + '.json')
        raw = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
        path.write_bytes(raw)
        value = {**value, 'preflightReceiptPath': str(path), 'preflightReceiptSha256': digest(raw)}
    else:
        evidence = json.loads(pathlib.Path(args.evidence).read_text())
        c.finish(args.permit, args.worker, args.thread, 'failed' if args.failed else 'completed', evidence)
        value = {'completedPermit': args.permit}
    print(json.dumps(value, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Busy as error:
        print(str(error), file=sys.stderr)
        sys.exit(75)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

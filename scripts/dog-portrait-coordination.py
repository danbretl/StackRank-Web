"""Atomic, durable coordination for the five independent cohort K tasks.

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
        if self.registry.get('cohortId') != 'dogs-portraits-k':
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

    def owner(self, worker, thread, catalog_id=None):
        row = next((x for x in self.registry['workers'] if x['worker'] == worker), None)
        if not row or row['threadId'] != thread or row.get('fullAccessVerified') is not True:
            raise ValueError('Unregistered worker/thread or unverified Full access')
        allocation = row.get('activeCatalogIds', []) if self.registry.get('selectionFrozen') else row.get('auditCatalogIds', [])
        if catalog_id is not None and catalog_id not in allocation:
            raise ValueError('Identity is outside this worker\'s frozen active assignment')
        return row

    def event(self, db, action, payload):
        db.execute('INSERT INTO events(at,action,payload) VALUES(?,?,?)', (now(), action, json.dumps(payload, sort_keys=True)))

    def acquire(self, kind, worker, thread, request, evidence, catalog_id=None):
        self.owner(worker, thread, catalog_id)
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
        expected = {'cohortId': 'dogs-portraits-k', 'worker': worker, 'threadId': thread, 'catalogId': catalog_id,
                    'receiptType': 'immutable-root-precall-approval', 'status': 'approved',
                    'selectionSha256': self.registry['selectionSha256']}
        if any(receipt.get(k) != v for k, v in expected.items()):
            raise ValueError('Root approval identity, ownership, status or selection mismatch')
        if p.stem != digest(raw):
            raise ValueError('Immutable root approval filename/hash mismatch')
        for key in ('packet', 'prompt', 'reference'):
            item = receipt[key]
            source = pathlib.Path(item['path']).resolve()
            if digest(source.read_bytes()) != item['sha256']:
                raise ValueError(f'{key}: approved bytes changed')
        prompt = pathlib.Path(receipt['prompt']['path']).read_text()
        if len(prompt.strip()) < 80:
            raise ValueError('Empty/error prompt cannot be sent to imagegen')
        for key in ('rootReferenceViewed', 'rootIdentityAndRightsApproved', 'rootSceneAndPromptApproved'):
            if receipt.get(key) is not True:
                raise ValueError('Missing independent root gate: ' + key)
        if receipt.get('referencePurposes') != {'uiDisplayAllowed': False, 'publicSnapshotAllowed': False, 'rasterExportAllowed': False}:
            raise ValueError('All morphology-reference purposes must remain denied')
        if receipt.get('nativeDimensions') != [1536, 1024]:
            raise ValueError('Native 1536x1024 portrait contract changed')
        return {'approvalPath': str(p), 'approvalSha256': digest(raw), 'prompt': prompt,
                'promptPath': receipt['prompt']['path'], 'promptSha256': receipt['prompt']['sha256'],
                'referencePath': receipt['reference']['path'], 'referenceSha256': receipt['reference']['sha256'],
                'packetPath': receipt['packet']['path'], 'packetSha256': receipt['packet']['sha256'],
                'catalogId': catalog_id, 'worker': worker, 'threadId': thread,
                'selectionSha256': receipt['selectionSha256'], 'nativeDimensions': [1536, 1024]}

    def commons_fetch(self, worker, thread, catalog_id, url, output):
        row = self.owner(worker, thread, catalog_id)
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
        normalize = lambda title: urllib.parse.unquote(title).replace('_', ' ').strip().casefold()
        banned_titles = {normalize(x['title']) for x in negative['rows']}
        requested_titles = urllib.parse.parse_qs(parsed.query).get('titles', [])
        if parsed.path.startswith('/wiki/File:'):
            requested_titles.append(parsed.path.removeprefix('/wiki/'))
        if parsed.hostname == 'upload.wikimedia.org':
            requested_titles.append('File:' + parsed.path.rsplit('/', 1)[-1])
        if any(normalize(t) in banned_titles for group in requested_titles for t in group.split('|')):
            raise ValueError('Exact previously rejected File title: reuse disposition; new qualifying evidence requires root adjudication')
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
            if digest(body) in {x.get('originalSha256') for x in negative['rows']}:
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
        value = c.commons_fetch(args.worker, args.thread, args.catalog_id, args.url, args.output)
    elif args.action == 'image-acquire':
        evidence = c.image_preflight(args.worker, args.thread, args.catalog_id, args.approval)
        permit = c.acquire('image', args.worker, args.thread, args.attempt, evidence, args.catalog_id)
        value = {**evidence, 'permit': permit, 'attemptId': args.attempt,
                 'preflightSucceeded': True, 'checkedAt': now(), 'configuredOperatorModel': 'gpt-6.1-sol',
                 'configuredReasoningEffort': 'xhigh', 'actualRuntimeModelIdentifierDisclosed': False}
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

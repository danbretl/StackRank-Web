#!/usr/bin/env python3
"""Bounded native PostgreSQL regressions; creates/stops its own local-only cluster.

Never accepts a database URL or credentials. Prerequisites model Supabase roles,
not JWT validation, PostgREST, Storage HTTP or cron execution. Requires PostgreSQL
binaries on PATH (or --pg-bin); evidence and cluster retained under reports/.
"""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess, tempfile, time

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / 'scripts/testing/security-database'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pg-bin', help='Directory containing PostgreSQL binaries; defaults to pg_config --bindir or PATH')
args = parser.parse_args()
REPORTS = ROOT / 'reports/security-audit-corrections'
REPORTS.mkdir(parents=True, exist_ok=True)
run = Path(tempfile.mkdtemp(prefix='database-', dir=REPORTS))
socket = Path(tempfile.mkdtemp(prefix='stackrank-security-pg-', dir='/tmp'))
socket.chmod(0o700)
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env.update(PGPASSFILE='/dev/null', PGSERVICEFILE='/dev/null', LC_ALL='C')
pg_config = shutil.which('pg_config')
if args.pg_bin:
    pg = Path(args.pg_bin)
elif pg_config:
    pg = Path(subprocess.run([pg_config, '--bindir'], env=env, text=True, capture_output=True, check=True).stdout.strip())
elif shutil.which('initdb'):
    pg = Path(shutil.which('initdb')).parent
else:
    parser.error('PostgreSQL binaries unavailable: install PostgreSQL or pass --pg-bin')
info = {'local_only': True, 'socket': str(socket), 'pgdata': str(run/'pgdata'),
        'limitations': ['No hosted requests, customer rows, JWT/PostgREST/Storage HTTP or scheduler validation.',
                         'Legacy rankings DDL uses recorded columns with synthetic defaults.',
                         'Broad legacy grants model fresh metadata; no new hosted defaults assumed.'],
        'migrations': [], 'checks': []}

def command(argv, timeout=60):
    return subprocess.run([str(x) for x in argv], env=env, text=True,
                          capture_output=True, timeout=timeout, check=True)

def sql(text, name, actor='security_admin'):
    (run/f'{name}.sql').write_text(text)
    try:
        result = command([pg/'psql', '-X', '-h', socket, '-p', '55479', '-U', actor,
                          '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', run/f'{name}.sql'])
    except subprocess.CalledProcessError as error:
        (run/f'{name}.log').write_text(error.stdout+'\n'+error.stderr)
        raise RuntimeError(f'{name} failed; see {run}/{name}.log') from error
    (run/f'{name}.log').write_text(result.stdout+'\n'+result.stderr)
    info['checks'] += [line.split('PASS|', 1)[1] for line in result.stderr.splitlines() if 'PASS|' in line]

def check(label, expected, statement):
    quote = lambda value: "'"+value.replace("'", "''")+"'"
    return f"SELECT security_test.check({quote(label)}, {quote(expected)}, {quote(statement)});\n"

def actor(role, owner=None):
    claims = json.dumps({'role': role, **({'sub': owner} if owner else {})})
    return f"BEGIN; SET LOCAL ROLE {role}; SELECT set_config('request.jwt.claims', '{claims}', true);\n"

started = False
try:
    info['postgres'] = command([pg/'postgres', '--version']).stdout.strip()
    command([pg/'initdb', '-D', run/'pgdata', '--username=security_admin', '--no-locale',
             '--encoding=UTF8', '--auth-local=trust', '--auth-host=reject'])
    with (run/'pgdata/postgresql.conf').open('a') as stream:
        stream.write(f"\nlisten_addresses = ''\nunix_socket_directories = '{socket}'\nunix_socket_permissions = 0700\nport = 55479\nmax_connections = 10\nshared_buffers = '32MB'\nwork_mem = '1MB'\nmax_wal_size = '128MB'\nmin_wal_size = '32MB'\nmax_parallel_workers = 0\nstatement_timeout = '8s'\nlock_timeout = '2s'\nidle_in_transaction_session_timeout = '10s'\n")
    command([pg/'pg_ctl', '-D', run/'pgdata', '-l', run/'postgres.log', '-w', 'start'])
    started = True
    sql((TESTS/'bootstrap.sql').read_text(), 'bootstrap')
    migrations = sorted((ROOT/'supabase/migrations').glob('*.sql'))
    corrections = []
    for migration in migrations:
        if migration.name >= '20261009':
            corrections.append(migration)
            continue
        original = migration.read_text()
        adapted = original.replace('create extension if not exists pg_cron with schema pg_catalog;', '-- Local inert cron adapter; scheduler not exercised.')
        sql(adapted, migration.stem)
        info['migrations'].append({'file': migration.name, 'sha256': hashlib.sha256(migration.read_bytes()).hexdigest(), 'cron_adapter': adapted != original})
    tables = ['rankings', 'movie_lists', 'pack_progress', 'shared_lists', 'product_events', 'suggestion_packs']
    # Only unnecessary privileges being tested are supplied beyond exact migrations.
    sql('GRANT TRUNCATE, REFERENCES, TRIGGER ON '+', '.join('public.'+t for t in tables)+' TO anon, authenticated;\n'
        'GRANT SELECT,INSERT,UPDATE,DELETE ON public.movie_lists,public.pack_progress TO anon,authenticated;\n', 'recorded-grants')
    sql((TESTS/'fixtures.sql').read_text(), 'fixtures')
    baseline = actor('anon')
    for table in tables:
        baseline += check('baseline anon truncate '+table, 'true', f"SELECT has_table_privilege(current_user, 'public.{table}', 'TRUNCATE')::text")
    baseline += check('baseline rotating-session 2000 accepted', '2000', "WITH inserted AS (INSERT INTO public.product_events(event_name,session_id) SELECT 'session_started',gen_random_uuid() FROM generate_series(1,2000) RETURNING 1) SELECT count(*)::text FROM inserted")
    baseline += 'ROLLBACK;\n'
    # Show the direct SQL consequence, isolated in a rolled-back transaction.
    baseline += actor('anon')+"TRUNCATE public.rankings; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"aaaaaaaa-1111-4111-8111-111111111111\"}', true);\n"+check('baseline truncate bypasses RLS', '0', 'SELECT count(*)::text FROM public.rankings')+'ROLLBACK;\n'
    sql(baseline, 'baseline-regressions', 'authenticator')
    assert corrections, 'Expected a correction migration; refusing baseline-only success'
    for migration in corrections:
        sql(migration.read_text(), migration.stem)
        info['migrations'].append({'file': migration.name, 'sha256': hashlib.sha256(migration.read_bytes()).hexdigest(), 'cron_adapter': False})
    sql((TESTS/'regressions.sql').read_text(), 'security-regressions', 'authenticator')
    # Assert every privilege/table/role, plus real rejected TRUNCATE statements.
    after = ''
    for role in ['anon', 'authenticated']:
        after += actor(role)
        for table in tables:
            for privilege in ['TRUNCATE','TRIGGER','REFERENCES']:
                after += check(f'{role} lacks {table} {privilege}', 'false', f"SELECT has_table_privilege(current_user, 'public.{table}', '{privilege}')::text")
            after += check(f'{role} truncate {table} denied', 'error:42501', f'TRUNCATE public.{table}')
        after += 'ROLLBACK;\n'
    sql(after, 'privilege-regressions', 'authenticator')
    if (TESTS/'share-regressions.sql').exists():
        sql((TESTS/'share-regressions.sql').read_text(), 'share-regressions', 'authenticator')
    # Deliberately restore old semantics only inside this disposable synthetic cluster.
    sql((ROOT/'notes/testing/security-audit-corrections/share-rollback.sql').read_text(), 'share-rollback')
    sql((ROOT/'notes/testing/security-audit-corrections/rollback-database-hardening.sql').read_text(), 'hardening-rollback')
    rollback = actor('anon')
    rollback += check('rollback Movies table public reads restored', '3', 'SELECT count(*)::text FROM public.shared_lists WHERE revoked=false')
    rollback += check('rollback Dogs public columns restored', '2', 'SELECT count(slug)::text FROM public.category_shared_lists')
    rollback += check('rollback RPC retained for new Movies viewer', '1', "SELECT count(*)::text FROM public.read_movie_share('aaaaaaaaa1')")
    rollback += check('rollback RPC retained for new Dogs viewer', '1', "SELECT count(*)::text FROM public.read_dog_share('aaaaaaaaaaa1')")
    rollback += check('rollback rotating-session 21 again accepted', '21', "WITH added AS (INSERT INTO public.product_events(event_name,session_id) SELECT 'session_started',gen_random_uuid() FROM generate_series(1,21) RETURNING 1) SELECT count(*)::text FROM added")
    for table in tables:
        for privilege in ['TRUNCATE', 'TRIGGER', 'REFERENCES']:
            rollback += check('rollback anon '+table+' '+privilege+' restored', 'true', f"SELECT has_table_privilege(current_user, 'public.{table}', '{privilege}')::text")
    rollback += 'ROLLBACK;\n'
    rollback += actor('authenticated', 'aaaaaaaa-1111-4111-8111-111111111111')
    rollback += check('rollback owner payload extra keys again accepted', '1', "WITH changed AS (UPDATE public.shared_lists SET payload=payload WHERE slug='legacy0001' RETURNING 1) SELECT count(*)::text FROM changed")
    rollback += 'ROLLBACK;\n'
    sql(rollback, 'rollback-regressions', 'authenticator')
    info['rollback_tested'] = True
    info['passed'] = True
finally:
    if started:
        command([pg/'pg_ctl', '-D', run/'pgdata', '-m', 'fast', '-w', 'stop'])
        info['cluster_stopped'] = True
    (run/'result.json').write_text(json.dumps(info, indent=2)+'\n')
    print(json.dumps({'passed': info.get('passed', False), 'checks': len(info['checks']), 'report': str(run/'result.json'), 'cluster_stopped': info.get('cluster_stopped', False)}))

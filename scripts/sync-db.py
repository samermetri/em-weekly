"""Import private editorial JSON and report deployment results with a scoped DB role."""
import argparse, copy, datetime, hashlib, json, os, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'state/db-snapshot.json'
FOLDERS = {'article': 'content/articles', 'issue': 'content/issues', 'audit': 'state/audits', 'probe': 'state/cloud-probes'}

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def prepare(rows, deployment):
    files = {}
    revisions = {}
    digest_rows = []
    for kind, identifier, body, revision in rows:
        if kind not in (*FOLDERS, 'state') or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,120}', identifier):
            raise ValueError('Unexpected editorial document identity')
        if not isinstance(body, dict):
            raise ValueError('Editorial document must be a JSON object')
        body = copy.deepcopy(body)
        digest_body = copy.deepcopy(body)
        if kind == 'state':
            if identifier not in ('publishing', 'backfill'):
                raise ValueError('Unknown state document')
            if identifier == 'publishing':
                digest_body.pop('lastSuccessfulDeployment', None)
                body['lastSuccessfulDeployment'] = deployment
            target = ROOT / 'state' / (identifier + '.json')
        else:
            if kind in ('article', 'issue') and body.get('id') != identifier:
                raise ValueError('Document ID differs from its JSON record')
            target = ROOT / FOLDERS[kind] / (identifier + '.json')
        revisions[kind + ':' + identifier] = revision
        digest_rows.append([kind, identifier, digest_body])
        files[target] = json.dumps(body, indent=2, ensure_ascii=False) + '\n'
    if not any(kind == 'state' and identifier == 'publishing' for kind, identifier, *_ in rows):
        raise ValueError('Missing publishing state; refusing an incomplete snapshot')
    digest = hashlib.sha256(canonical(digest_rows).encode()).hexdigest()
    return files, {'snapshotHash': digest, 'documentRevisions': revisions}

def connect():
    import psycopg
    dsn = os.environ.get('EM_WEEKLY_DATABASE_URL')
    if not dsn:
        raise ValueError('EM_WEEKLY_DATABASE_URL is required')
    return psycopg.connect(dsn, connect_timeout=20, prepare_threshold=None, sslmode='verify-full', sslrootcert=str(ROOT / 'db/supabase-ca.crt'))

def local_snapshot_matches(snapshot):
    """Do not let a cheap remote check preserve locally changed editorial files."""
    try:
        revisions = snapshot['documentRevisions']
        rows = [(kind, p.stem, json.loads(p.read_text()), revisions.get(kind + ':' + p.stem))
                for kind, folder in FOLDERS.items() for p in (ROOT / folder).glob('*.json')]
        state = json.loads((ROOT / 'state/publishing.json').read_text())
        rows.append(('state', 'publishing', state, revisions.get('state:publishing')))
        if (ROOT / 'state/backfill.json').exists():
            rows.append(('state', 'backfill', json.loads((ROOT / 'state/backfill.json').read_text()), revisions.get('state:backfill')))
        rows.sort(key=lambda r: (r[0], r[1]))
        _, current = prepare(rows, state.get('lastSuccessfulDeployment'))
        return current['snapshotHash'] == snapshot['snapshotHash'] and current['documentRevisions'] == revisions
    except (KeyError, ValueError, OSError, TypeError):
        return False

def pull():
    with connect() as db:
        db.execute('set transaction isolation level repeatable read')
        # Return one small digest, not the growing archive, on unchanged polls.
        # The revision trigger and repeatable-read transaction keep both reads consistent.
        fingerprint = db.execute("select md5(coalesce(string_agg(kind || ':' || id || ':' || revision::text, E'\\n' order by kind,id),'')) from em_weekly.documents where kind <> 'config'").fetchone()[0]
        old_snapshot = json.loads(SNAPSHOT.read_text()) if SNAPSHOT.exists() else {}
        unchanged = old_snapshot.get('revisionFingerprint') == fingerprint and local_snapshot_matches(old_snapshot)
        if unchanged:
            snapshot = old_snapshot
            changed = False
        else:
            rows = db.execute("select kind,id,body,revision from em_weekly.documents where kind <> 'config' order by kind,id").fetchall()
            local_state = json.loads((ROOT / 'state/publishing.json').read_text())
            files, snapshot = prepare(rows, local_state.get('lastSuccessfulDeployment'))
            snapshot['revisionFingerprint'] = fingerprint
            changed = snapshot != old_snapshot
            # JSON edits are written only after the complete snapshot passes identity checks.
            for target, body in files.items():
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists() or json.loads(target.read_text()) != json.loads(body):
                    target.write_text(body)
            SNAPSHOT.write_text(json.dumps(snapshot, indent=2) + '\n')
        db.execute("update em_weekly.publication set checked_at=now() where id='main'")
    if output := os.environ.get('GITHUB_OUTPUT'):
        with open(output, 'a') as f:
            f.write(f'changed={str(changed).lower()}\n')
    print(f'Editorial check: archive_downloaded={str(not unchanged).lower()}; changed={str(changed).lower()}; snapshot={snapshot["snapshotHash"]}')

def report(status):
    from psycopg.types.json import Jsonb
    snapshot = json.loads(SNAPSHOT.read_text()) if SNAPSHOT.exists() else {}
    state = json.loads((ROOT / 'state/publishing.json').read_text())
    deployed = state.get('lastSuccessfulDeployment') or {}
    run_url = f'https://github.com/{os.environ["GITHUB_REPOSITORY"]}/actions/runs/{os.environ["GITHUB_RUN_ID"]}'
    with connect() as db:
        if status == 'success':
            db.execute('''update em_weekly.publication set status='success',attempted_at=now(),deployed_at=now(),
              snapshot_hash=%s,commit_sha=%s,run_url=%s,deployment_url=%s,error=null,document_revisions=%s where id='main' ''',
              (snapshot['snapshotHash'], deployed['commit'], run_url, deployed['url'], Jsonb(snapshot['documentRevisions'])))
        else:
            # Preserve the last successful snapshot, deployment URL, commit, and revisions.
            db.execute("update em_weekly.publication set status='failed',attempted_at=now(),run_url=%s,error=%s where id='main'",
                       (run_url, 'Validation, build, or deployment failed. See the linked Actions run.'))
    print('Recorded publication status:', status)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['pull', 'success', 'failed'])
    args = parser.parse_args()
    try:
        pull() if args.command == 'pull' else report(args.command)
    except Exception as error:
        # Connection errors can contain credentials or unpublished source text. Never echo them.
        print(f'Database sync failed ({type(error).__name__}); existing public site is preserved.', file=sys.stderr)
        sys.exit(1)

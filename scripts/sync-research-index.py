"""Mirror validated public discovery metadata through the existing scoped DB role."""
import hashlib, importlib.util, json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent

def prepare(folder):
    manifest = json.loads((folder / 'manifest.json').read_text())
    if manifest.get('version') != 1 or not manifest.get('windows'):
        raise ValueError('Missing discovery manifest')
    starts = set()
    records = []
    for entry in manifest['windows']:
        start = entry['start']
        import datetime
        date = datetime.date.fromisoformat(start)
        first, last = datetime.date(2024,10,27), datetime.date(2026,10,26)
        if not first <= date <= last or (date-first).days % 7 or start in starts:
            raise ValueError('Unknown or repeated discovery interval')
        starts.add(start)
        raw = (folder / (start+'.json')).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry['sha256']:
            raise ValueError('Discovery digest mismatch')
        body = json.loads(raw)
        if body.get('start') != start or body.get('end') != entry['end'] or len(body.get('candidates',[])) != entry['count'] or body.get('method') != 'PubMed electronic-date discovery; primary first-online verification required':
            raise ValueError('Discovery metadata mismatch')
        records.append((start, body))
    return records

def sync():
    from psycopg.types.json import Jsonb
    records = prepare(ROOT / 'state/research-index')
    spec = importlib.util.spec_from_file_location('em_weekly_db', ROOT / 'scripts/sync-db.py')
    db_helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(db_helper)
    with db_helper.connect() as db:
        for start, body in records:
            db.execute('''insert into em_weekly.research_index(window_start,body) values (%s,%s)
                on conflict(window_start) do update set body=excluded.body,updated_at=now()
                where research_index.body is distinct from excluded.body''', (start,Jsonb(body)))
        rows = db.execute('select window_start::text,body from em_weekly.research_index').fetchall()
        actual = dict(rows)
        if any(actual.get(start) != body for start, body in records):
            raise ValueError('Research metadata read-back mismatch')
    print(f'Verified {len(records)} private discovery-cache windows. No articles or accounts changed.')

if __name__ == '__main__':
    try:
        sync()
    except Exception as error:
        # Connection errors may contain secrets; print only the failure type.
        print(f'Discovery-cache sync failed ({type(error).__name__}); no partial transaction committed.',file=sys.stderr)
        sys.exit(1)

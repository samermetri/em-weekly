"""Render a transparent, atomic CAS batch for the existing editorial store.

This does not connect to a database or create a new permission/API surface.
Hosted editors use the same SQL template in their owner-supplied task prompt.
"""
import hashlib
import json
import re


def build_backfill_batch(records):
    if not isinstance(records, list) or not 1 <= len(records) <= 15:
        raise ValueError('Expected 1–15 records')
    seen = set()
    counts = {'article': 0, 'audit': 0, 'state': 0}
    for row in records:
        if set(row) != {'kind', 'id', 'expected_revision', 'new_body'}:
            raise ValueError('Unexpected record fields')
        kind, identity, revision, body = (row[k] for k in ('kind', 'id', 'expected_revision', 'new_body'))
        if kind not in counts or not isinstance(identity, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,120}', identity):
            raise ValueError('Invalid record identity')
        if (kind, identity) in seen:
            raise ValueError('Duplicate record identity')
        seen.add((kind, identity))
        counts[kind] += 1
        if revision is not None and (type(revision) is not int or revision < 1):
            raise ValueError('Expected a positive revision or null for creation')
        if not isinstance(body, dict):
            raise ValueError('Expected a JSON object')
        if kind == 'state' and (identity != 'backfill' or revision is None or body.get('id') != 'backfill'):
            raise ValueError('Only the existing backfill checkpoint may be changed')
        if kind == 'audit' and not identity.startswith('backfill-'):
            raise ValueError('Only backfill audits may be changed')
        if kind == 'article' and (body.get('id') != identity or body.get('backfill') is not True or body.get('sample') is not False):
            raise ValueError('Expected a non-sample backfill article with matching ID')
    if counts['article'] > 12 or counts['audit'] > 2 or counts['state'] > 1:
        raise ValueError('Backfill batch bounds exceeded')
    payload = json.dumps(records, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    tag = 'em_' + hashlib.sha256(payload.encode()).hexdigest()[:20]
    delimiter = '$' + tag + '$'
    while delimiter in payload:
        tag += '_x'
        delimiter = '$' + tag + '$'
    return SQL_TEMPLATE.replace('__PAYLOAD__', delimiter + payload + delimiter)


# A stale/missing expected row or a raced creation returns fewer rows. The
# aggregate assertion raises division_by_zero and rolls back the entire statement,
# including any sibling changes, without an anonymous procedural block.
SQL_TEMPLATE = """WITH input AS MATERIALIZED (
  SELECT * FROM jsonb_to_recordset(__PAYLOAD__::jsonb)
    AS p(kind text, id text, expected_revision bigint, new_body jsonb)
), saved AS (
  INSERT INTO em_weekly.documents AS d (kind, id, body)
  SELECT i.kind, i.id, i.new_body FROM input AS i
  WHERE i.expected_revision IS NULL OR EXISTS (
    SELECT 1 FROM em_weekly.documents AS old
    WHERE old.kind=i.kind AND old.id=i.id AND old.revision=i.expected_revision
  )
  ORDER BY i.kind, i.id
  ON CONFLICT (kind, id) DO UPDATE SET body=EXCLUDED.body
  WHERE d.revision=(
    SELECT i.expected_revision FROM input AS i WHERE i.kind=d.kind AND i.id=d.id
  )
  RETURNING d.kind, d.id, d.revision
)
SELECT COALESCE(jsonb_agg(saved ORDER BY kind,id), '[]'::jsonb) AS saved,
  (SELECT count(*) FROM input) AS expected_count, count(*) AS saved_count,
  1 / CASE WHEN count(*)=(SELECT count(*) FROM input) THEN 1 ELSE 0 END AS atomic_assertion
FROM saved;"""

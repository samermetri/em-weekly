"""Render a transparent, atomic CAS batch for the existing editorial store.

This does not connect to a database or create a new permission/API surface.
Hosted editors use the same SQL template in their owner-supplied task prompt.
"""
import hashlib
import json
import re


def build_backfill_batch(records):
    return _build_batch(records, 'backfill')


def build_editorial_batch(records, workflow):
    if workflow not in ('daily', 'weekly'):
        raise ValueError('Expected daily or weekly workflow')
    return _build_batch(records, workflow)


def _build_batch(records, workflow):
    limits = {'backfill': {'article': 12, 'audit': 2, 'state': 1},
              'daily': {'article': 5, 'audit': 2, 'state': 1},
              'weekly': {'article': 5, 'issue': 2, 'audit': 2, 'state': 1}}[workflow]
    if not isinstance(records, list) or not 1 <= len(records) <= sum(limits.values()):
        raise ValueError('Batch size exceeded')
    seen = set()
    counts = dict.fromkeys(limits, 0)
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
        checkpoint = 'backfill' if workflow == 'backfill' else 'publishing'
        if kind == 'state' and (identity != checkpoint or revision is None or
                               (workflow == 'backfill' and body.get('id') != checkpoint)):
            raise ValueError('Only the existing workflow checkpoint may be changed')
        if kind == 'audit':
            pattern = r'backfill-[a-z0-9-]+' if workflow == 'backfill' else r'(?:daily-|weekly-)?\d{4}-\d{2}-\d{2}'
            if not re.fullmatch(pattern, identity):
                raise ValueError('Audit is outside the workflow scope')
        if kind == 'article' and (body.get('id') != identity or body.get('sample') is not False or
                                  (workflow == 'backfill' and body.get('backfill') is not True) or
                                  (workflow != 'backfill' and body.get('backfill') is True)):
            raise ValueError('Expected a matching non-sample article in the workflow scope')
        if kind == 'issue' and (not re.fullmatch(r'\d{4}-\d{2}-\d{2}', identity) or
                                body.get('id') != identity or body.get('sample') is not False):
            raise ValueError('Expected a matching non-sample weekly issue')
    if any(counts[kind] > limit for kind, limit in limits.items()):
        raise ValueError('Workflow batch bounds exceeded')
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

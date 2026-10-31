import importlib.util
import os
from pathlib import Path
import unittest
from urllib.parse import urlparse

spec = importlib.util.spec_from_file_location('editorial_writer', Path(__file__).parents[1] / 'scripts/editorial_writer.py')
writer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(writer)


def audit(identity='backfill-a', revision=1, text='updated'):
    return dict(kind='audit', id=identity, expected_revision=revision, new_body={'note': text})


class RenderTests(unittest.TestCase):
    def test_normal_workflow_scope(self):
        checkpoint = dict(kind='state', id='publishing', expected_revision=9, new_body={'schemaVersion': 1})
        issue = dict(kind='issue', id='2026-10-26', expected_revision=1, new_body={'id':'2026-10-26','sample':False})
        self.assertIn('atomic_assertion', writer.build_editorial_batch([checkpoint, issue], 'weekly'))
        for workflow, rows in [('daily',[issue]), ('daily',[audit()]), ('weekly',[dict(checkpoint,id='backfill')]),
                               ('daily',[dict(checkpoint,expected_revision=None)]),
                               ('weekly',[dict(issue,new_body={'id':'2026-10-19','sample':False})]),
                               ('daily',[dict(kind='article',id='old',expected_revision=None,new_body={'id':'old','sample':False,'backfill':True})])]:
            with self.subTest(workflow=workflow,rows=rows), self.assertRaises(ValueError):
                writer.build_editorial_batch(rows, workflow)

    def test_scope_and_bounds(self):
        invalid = [[], [audit('unrelated')], [audit(), audit()], [dict(kind='config', id='site', expected_revision=1, new_body={})], [audit(revision=True)], [audit(revision=0)]]
        invalid += [[audit('backfill-'+str(i)) for i in range(3)]]
        for records in invalid:
            with self.subTest(records=records), self.assertRaises(ValueError):
                writer.build_backfill_batch(records)

    def test_content_is_one_json_literal_and_not_executable_sql(self):
        query = writer.build_backfill_batch([audit(text="O'Brien $payload$ ; DROP TABLE public.users; -- \\ 💚")])
        self.assertIn('expected_revision bigint', query)
        self.assertIn('atomic_assertion', query)
        self.assertNotIn('DO $$', query)


@unittest.skipUnless(os.environ.get('EM_WEEKLY_TEST_DATABASE_URL'), 'Disposable PostgreSQL test service only')
class PostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ['EM_WEEKLY_TEST_DATABASE_URL']
        parsed = urlparse(url)
        if parsed.hostname not in ('localhost', '127.0.0.1') or parsed.path != '/em_weekly_writer_test':
            raise RuntimeError('Refusing a non-disposable test database')
        import psycopg
        cls.db = psycopg.connect(url, autocommit=True)
        cls.db.execute('CREATE SCHEMA em_weekly')
        cls.db.execute('CREATE TABLE em_weekly.documents(kind text,id text,body jsonb NOT NULL,revision bigint NOT NULL DEFAULT 1,PRIMARY KEY(kind,id))')
        cls.db.execute("CREATE FUNCTION em_weekly.bump() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.revision=OLD.revision+1; RETURN NEW; END $$")
        cls.db.execute('CREATE TRIGGER bump BEFORE UPDATE ON em_weekly.documents FOR EACH ROW EXECUTE FUNCTION em_weekly.bump()')
        for role in ('anon','authenticated','em_weekly_builder'):
            cls.db.execute('CREATE ROLE '+role+' NOLOGIN')
        cls.db.execute('GRANT USAGE ON SCHEMA em_weekly TO em_weekly_builder')
        cls.db.execute((Path(__file__).parents[1]/'db/current-discovery.sql').read_text())

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        # This database is created by the isolated CI service, never production.
        self.db.execute('TRUNCATE em_weekly.documents')
        self.db.execute("INSERT INTO em_weekly.documents VALUES ('audit','backfill-a','{}',1),('audit','backfill-b','{}',1)")

    def snapshot(self):
        return self.db.execute('SELECT id,body,revision FROM em_weekly.documents ORDER BY id').fetchall()

    def test_mixed_insert_and_revision_checked_updates(self):
        rows = [audit(), audit('backfill-b'), dict(kind='article',id='trial',expected_revision=None,new_body={'id':'trial','backfill':True,'sample':False})]
        result = self.db.execute(writer.build_backfill_batch(rows)).fetchone()
        self.assertEqual(result[1:], (3,3,1))
        self.assertEqual([r[2] for r in self.snapshot()], [2,2,1])

    def test_stale_revision_rolls_back_valid_sibling(self):
        before = self.snapshot()
        with self.assertRaises(Exception):
            self.db.execute(writer.build_backfill_batch([audit(),audit('backfill-b',99)]))
        self.assertEqual(self.snapshot(), before)

    def test_missing_update_does_not_insert_or_change_siblings(self):
        before = self.snapshot()
        with self.assertRaises(Exception):
            self.db.execute(writer.build_backfill_batch([audit(),audit('backfill-missing',1)]))
        self.assertEqual(self.snapshot(), before)

    def test_raced_creation_does_not_overwrite_or_partially_save(self):
        before = self.snapshot()
        with self.assertRaises(Exception):
            self.db.execute(writer.build_backfill_batch([audit(),audit('backfill-b',None)]))
        self.assertEqual(self.snapshot(), before)

    def test_hostile_text_is_stored_as_text(self):
        text = "O'Brien $payload$ ; DROP TABLE em_weekly.documents; -- \\ 💚"
        self.db.execute(writer.build_backfill_batch([audit(text=text)]))
        self.assertEqual(self.snapshot()[0][1]['note'], text)

    def test_weekly_issue_and_shared_checkpoint_are_atomic(self):
        self.db.execute("INSERT INTO em_weekly.documents VALUES ('state','publishing','{}',9)")
        checkpoint = dict(kind='state',id='publishing',expected_revision=9,new_body={'schemaVersion':1})
        issue = dict(kind='issue',id='2026-10-26',expected_revision=None,new_body={'id':'2026-10-26','sample':False})
        self.db.execute(writer.build_editorial_batch([checkpoint,issue], 'weekly'))
        before = self.snapshot()
        # A daily writer changes the shared checkpoint before the weekly retry.
        with self.assertRaises(Exception):
            self.db.execute(writer.build_editorial_batch([checkpoint,dict(issue,id='2026-11-02',new_body={'id':'2026-11-02','sample':False})], 'weekly'))
        self.assertEqual(self.snapshot(), before)

    def test_current_metadata_grant_is_bounded_and_cannot_edit_articles(self):
        from psycopg.types.json import Jsonb
        body={'version':1,'method':'PubMed entry-date discovery; primary first-online verification required','sourceId':'pubmed-em','query':'test','start':'2026-10-19','end':'2026-10-25','retrievedAt':'2026-10-31T00:00:00+00:00','count':0,'candidates':[],'requests':['https://eutils.ncbi.nlm.nih.gov/']}
        self.db.execute('SET ROLE em_weekly_builder')
        try:
            self.db.execute('INSERT INTO em_weekly.current_discovery(source_id,body) VALUES (%s,%s)',('pubmed-em',Jsonb(body)))
            self.assertEqual(self.db.execute('SELECT count(*) FROM em_weekly.current_discovery').fetchone()[0],1)
            with self.assertRaises(Exception):
                self.db.execute("UPDATE em_weekly.documents SET body='{}'")
            with self.assertRaises(Exception):
                self.db.execute('INSERT INTO em_weekly.current_discovery(source_id,body) VALUES (%s,%s)',('unbounded-source',Jsonb(dict(body,sourceId='unbounded-source'))))
            self.assertFalse(self.db.execute("SELECT has_table_privilege('anon','em_weekly.current_discovery','SELECT')").fetchone()[0])
        finally:
            self.db.execute('RESET ROLE')


if __name__ == '__main__':
    unittest.main()

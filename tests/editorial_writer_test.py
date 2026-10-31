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


if __name__ == '__main__':
    unittest.main()

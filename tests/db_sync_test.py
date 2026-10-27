import importlib.util
import pathlib
import hashlib
import json
import os
import runpy
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sync_db', pathlib.Path(__file__).parents[1] / 'scripts/sync-db.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class SnapshotTests(unittest.TestCase):
    def test_paths_and_incomplete_snapshot_are_rejected(self):
        for rows in [[('article','../../workflow',{'id':'../../workflow'},1)], [('article','valid',{'id':'different'},1)], [('article','valid',{'id':'valid'},1)]]:
            with self.assertRaises(ValueError): sync.prepare(rows, None)

    def test_content_hash_is_stable_and_deployment_state_is_preserved(self):
        rows=[('article','study',{'id':'study','summary':'Original text'},1),('state','publishing',{'lastSuccessfulDeployment':None,'queue':[]},1)]
        files, snapshot=sync.prepare(rows, {'commit':'previous'})
        self.assertIn('"commit": "previous"',files[sync.ROOT/'state/publishing.json'])
        rows[-1][2]['lastSuccessfulDeployment']={'commit':'another'}
        _,second=sync.prepare(rows,None)
        self.assertEqual(snapshot['snapshotHash'],second['snapshotHash'])
        rows[0][2]['summary']='A correction'
        _,third=sync.prepare(rows,None)
        self.assertNotEqual(snapshot['snapshotHash'],third['snapshotHash'])
        self.assertEqual(snapshot['documentRevisions']['article:study'],1)

    def test_unchanged_poll_skips_archive_but_revision_or_local_edit_imports(self):
        class Database:
            def __init__(self):
                self.rows=[('article','study',{'id':'study','summary':'Original text'},1),('state','publishing',{'queue':[],'completedIssues':['2026-10-19']},1)]
                self.downloads=0
            def __enter__(self): return self
            def __exit__(self,*args): return False
            def execute(self,sql):
                if 'select kind,id,body,revision' in sql: self.downloads+=1
                return self
            def fetchone(self):
                metadata='\n'.join(f'{kind}:{id}:{revision}' for kind,id,_,revision in self.rows)
                return (hashlib.md5(metadata.encode()).hexdigest(),)
            def fetchall(self): return self.rows
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);(root/'state').mkdir()
            (root/'state/publishing.json').write_text('{"lastSuccessfulDeployment":null}')
            db=Database()
            with patch.object(sync,'ROOT',root),patch.object(sync,'SNAPSHOT',root/'state/db-snapshot.json'),patch.object(sync,'connect',return_value=db),patch.dict('os.environ',{'GITHUB_OUTPUT':str(root/'output')}):
                sync.pull();self.assertEqual(db.downloads,1)
                # Deployment bookkeeping must preserve editorial state and the fast path.
                previous=os.getcwd()
                try:
                    os.chdir(root)
                    with patch('subprocess.check_output',return_value='qa-commit\n'),patch.dict('os.environ',{'GITHUB_REPOSITORY':'example/test','GITHUB_RUN_ID':'1','PAGE_URL':'https://example.invalid/'}):
                        runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1]/'scripts/record-deployment.py'))
                finally: os.chdir(previous)
                self.assertEqual(json.loads((root/'state/publishing.json').read_text())['completedIssues'],['2026-10-19'])
                sync.pull();self.assertEqual(db.downloads,1)
                self.assertTrue((root/'output').read_text().endswith('changed=false\n'))
                # A revision bump must be fetched and acknowledged even if its JSON is identical.
                kind,id,body,_=db.rows[0];db.rows[0]=(kind,id,body,2)
                sync.pull();self.assertEqual(db.downloads,2)
                self.assertEqual(json.loads((root/'state/db-snapshot.json').read_text())['documentRevisions']['article:study'],2)
                # A local edit must not evade the authoritative database import.
                article=root/'content/articles/study.json';article.write_text('{"id":"study","summary":"Local edit"}')
                sync.pull();self.assertEqual(db.downloads,3)
                self.assertEqual(json.loads(article.read_text())['summary'],'Original text')

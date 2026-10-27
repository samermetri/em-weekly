import importlib.util
import pathlib
import unittest

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

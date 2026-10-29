import importlib.util, json, pathlib, tempfile, unittest
ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('research_cache',ROOT/'scripts/sync-research-index.py')
cache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache)
class ResearchCacheTest(unittest.TestCase):
 def test_snapshot_is_complete_before_any_database_write(self):
  records=cache.prepare(ROOT/'state/research-index')
  self.assertEqual(len(records),105)
  self.assertEqual(len({date for date,_ in records}),105)
 def test_tampered_or_traversal_paths_are_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   folder=pathlib.Path(d)
   manifest=json.loads((ROOT/'state/research-index/manifest.json').read_text())
   manifest['windows']=[manifest['windows'][0]]
   entry=manifest['windows'][0]
   (folder/(entry['start']+'.json')).write_text('{}')
   (folder/'manifest.json').write_text(json.dumps(manifest))
   with self.assertRaisesRegex(ValueError,'digest'):cache.prepare(folder)
   entry['start']='../credentials'
   (folder/'manifest.json').write_text(json.dumps(manifest))
   with self.assertRaises(ValueError):cache.prepare(folder)
if __name__=='__main__':unittest.main()

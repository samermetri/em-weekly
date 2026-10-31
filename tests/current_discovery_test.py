import copy
import datetime as dt
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('current_discovery',Path(__file__).parents[1]/'scripts/current-discovery.py')
discovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(discovery)


class CurrentDiscoveryTests(unittest.TestCase):
    def test_failed_initial_range_does_not_drift_forward(self):
        today=dt.date(2026,10,31)
        self.assertEqual(discovery.interval(today,None,'2026-09-27'),('2026-09-27','2026-10-31'))
        self.assertEqual(discovery.interval(today,'2026-10-30','2026-09-27'),('2026-10-16','2026-10-31'))

    def test_capped_search_splits_and_checks_union_membership(self):
        class Fake(discovery.PubMed):
            def get(self,endpoint,params):
                self.terms=getattr(self,'terms',[])+[params['term']]
                ids=list(map(str,range(600))) if len(self.terms)==2 else list(map(str,range(600,1200)))
                return {'esearchresult':{'count':'1200' if len(self.terms)==1 else '600','idlist':ids}},'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'
        api=Fake();ids,requests=api.search('query','2026-10-19','2026-10-20')
        self.assertEqual((len(ids),len(requests)),(1200,3))
        self.assertIn('[EDAT]',api.terms[0])
        self.assertIn('2026/10/19',api.terms[1]);self.assertNotIn('2026/10/20',api.terms[1])

    def test_incomplete_enumeration_is_rejected(self):
        class Fake(discovery.PubMed):
            def get(self,*args):
                return {'esearchresult':{'count':'2','idlist':['1']}},'https://eutils.ncbi.nlm.nih.gov/'
        with self.assertRaises(ValueError):
            Fake().search('query','2026-10-19','2026-10-20')

    def test_cache_requires_all_four_exact_queries_and_memberships(self):
        sources=[{'id':s,'query':s+' query'} for s in discovery.SOURCE_IDS]
        records=[dict(sourceId=s['id'],query=s['query'],version=1,method=discovery.METHOD,start='2026-10-19',end='2026-10-25',count=1,requests=['https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'],candidates=[{'pmid':'1'}]) for s in sources]
        discovery.validate(records,sources)
        bad_count=copy.deepcopy(records);bad_count[0]['count']=2
        bad_query=copy.deepcopy(records);bad_query[0]['query']='different query'
        bad_route=copy.deepcopy(records);bad_route[0]['requests']=['https://example.com/']
        for invalid in [records[:3],bad_count,bad_query,bad_route]:
            with self.assertRaises(ValueError):
                discovery.validate(invalid,sources)


if __name__=='__main__':
    unittest.main()

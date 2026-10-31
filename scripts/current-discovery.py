"""Fetch complete official metadata outside the restricted research browser.

Uses the existing builder credential only for reading editorial checkpoints and
replacing four bounded metadata rows. It cannot edit articles or checkpoints.
"""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
METHOD = 'PubMed entry-date discovery; primary first-online verification required'
SOURCE_IDS = {'pubmed-em','pubmed-general','pubmed-specialty','pubmed-guidance'}


def interval(today, checkpoint, failed_start, first_days=30, overlap=14):
    start = dt.date.fromisoformat(checkpoint)-dt.timedelta(days=overlap) if checkpoint else today-dt.timedelta(days=first_days)
    if not checkpoint and failed_start:
        start = min(start, dt.date.fromisoformat(failed_start))
    if start > today:
        raise ValueError('Future checkpoint')
    return start.isoformat(), today.isoformat()


class PubMed:
    def __init__(self):
        self.last = 0

    def get(self, endpoint, params):
        url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'+endpoint+'?'+urllib.parse.urlencode(dict(params,tool='em-weekly',retmode='json',db='pubmed'))
        for attempt in range(3):
            time.sleep(max(0, .55-(time.monotonic()-self.last)))
            self.last = time.monotonic()
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'EMWeekly/1.0 (public PubMed metadata)'})
                with urllib.request.urlopen(req,timeout=25) as response:
                    data=json.load(response)
                if data.get('error'):
                    raise ValueError('PubMed API error')
                return data,url
            except Exception:
                if attempt==2:
                    raise
                time.sleep(2**attempt)

    def search(self, query, start, end):
        term=f'({query}) AND ("{start.replace("-","/")}"[EDAT] : "{end.replace("-","/")}"[EDAT])'
        data,url=self.get('esearch.fcgi',{'term':term,'retmax':1000})
        result=data.get('esearchresult',{})
        count=int(result.get('count',-1))
        if count<0 or result.get('errorlist') or result.get('warninglist',{}).get('quotedphrasesnotfound'):
            raise ValueError('Invalid query/result')
        if count>1000:
            first,last=dt.date.fromisoformat(start),dt.date.fromisoformat(end)
            if first==last:
                raise ValueError('Unresolved single-day cap')
            mid=first+(last-first)//2
            a,ar=self.search(query,start,mid.isoformat())
            b,br=self.search(query,(mid+dt.timedelta(days=1)).isoformat(),end)
            ids=sorted(set(a+b),key=int)
            if len(ids)!=count:
                raise ValueError('Discovery membership changed during split')
            return ids,[url]+ar+br
        ids=result.get('idlist',[])
        if len(ids)!=count or len(set(ids))!=count or any(not str(x).isdigit() for x in ids):
            raise ValueError('Incomplete discovery results')
        return ids,[url]


def validate(records, sources):
    if {r['sourceId'] for r in records}!=SOURCE_IDS or len(records)!=4:
        raise ValueError('Incomplete source set')
    expected={s['id']:s['query'] for s in sources}
    for r in records:
        ids=[c['pmid'] for c in r['candidates']]
        if r['version']!=1 or r['method']!=METHOD or r['query']!=expected[r['sourceId']] or r['count']!=len(ids) or len(ids)!=len(set(ids)) or r['start']>r['end']:
            raise ValueError('Invalid source metadata')
        if any(not str(x).isdigit() for x in ids) or not r['requests'] or any(urllib.parse.urlparse(u).netloc!='eutils.ncbi.nlm.nih.gov' for u in r['requests']):
            raise ValueError('Invalid identifiers/route')
        if len(ids)>10000 or len(json.dumps(r,ensure_ascii=False).encode())>2097152:
            raise ValueError('Discovery cache bound exceeded')


def refresh():
    from psycopg.types.json import Jsonb
    spec=importlib.util.spec_from_file_location('em_weekly_db',ROOT/'scripts/sync-db.py')
    helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    config=json.loads((ROOT/'config/sources.json').read_text())
    site=json.loads((ROOT/'config/site.json').read_text())
    with helper.connect() as db:
        state=db.execute("select body from em_weekly.documents where kind='state' and id='publishing'").fetchone()
        if not state:
            raise ValueError('Missing publishing checkpoint')
        failed=dict(db.execute("""select s->>'sourceId',min(d.body->>'coverageStart') from em_weekly.documents d
            cross join lateral jsonb_array_elements(d.body->'sources') s
            where d.kind='audit' and d.id ~ '^(daily-)?[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            and s->>'status'='failed' group by s->>'sourceId'""").fetchall())
    api=PubMed();today=dt.datetime.now(ZoneInfo('America/Los_Angeles')).date()
    records=[];members=set()
    for source in config['sources']:
        start,end=interval(today,state[0]['sources'].get(source['id'],{}).get('successfulThrough'),failed.get(source['id']),site['firstDiscoveryDays'],site['discoveryOverlapDays'])
        ids,requests=api.search(source['query'],start,end)
        if len(ids)>10000:
            raise ValueError('Discovery cache candidate bound exceeded')
        records.append(dict(version=1,method=METHOD,sourceId=source['id'],query=source['query'],start=start,end=end,retrievedAt=dt.datetime.now(dt.timezone.utc).isoformat(),count=len(ids),requests=requests,candidates=ids))
        members.update(ids)
    metadata={}
    ids=sorted(members,key=int)
    for offset in range(0,len(ids),200):
        batch=ids[offset:offset+200]
        data,_=api.get('esummary.fcgi',{'id':','.join(batch)})
        for pmid in batch:
            a=data.get('result',{}).get(pmid)
            if not a or a.get('error'):
                raise ValueError('Missing candidate metadata')
            metadata[pmid]=dict(pmid=pmid,title=a.get('title') or a.get('booktitle') or f'Untitled PMID {pmid}',journal=a.get('fulljournalname') or a.get('source') or '',epubDate=a.get('epubdate') or '',pubDate=a.get('pubdate') or '',doi=next((v['value'] for v in a.get('articleids',[]) if v['idtype']=='doi'),None),types=a.get('pubtype',[]))
    for r in records:
        r['candidates']=[metadata[x] for x in sorted(r['candidates'],key=int)]
    validate(records,config['sources'])
    # No partial cache refresh: all remote work finishes before this transaction.
    with helper.connect() as db:
        for r in records:
            db.execute('''insert into em_weekly.current_discovery(source_id,body) values (%s,%s)
                on conflict(source_id) do update set body=excluded.body,updated_at=now()''',(r['sourceId'],Jsonb(r)))
        actual=dict(db.execute('select source_id,body from em_weekly.current_discovery').fetchall())
        if any(actual.get(r['sourceId'])!=r for r in records):
            raise ValueError('Metadata read-back mismatch')
    print('Verified four complete current discovery sources; '+str(len(metadata))+' unique public metadata candidates. No editorial records changed.')


if __name__=='__main__':
    try:
        refresh()
    except Exception as error:
        # Never emit a connection URI/credential or overwrite the prior cache.
        raise SystemExit(f'Current discovery refresh failed ({type(error).__name__}); prior complete cache preserved.')

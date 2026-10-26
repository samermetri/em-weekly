"""Read-only URL/query probes; failures remain explicit, never become research success."""
import concurrent.futures,json,pathlib,urllib.request,urllib.parse,datetime,time
cfg=json.loads(pathlib.Path('config/sources.json').read_text())
def check(source):
 url=source['url'];data=None
 if source.get('kind')=='pubmed':url+='?'+urllib.parse.urlencode({'db':'pubmed','retmode':'json','retmax':0,'term':source['query']})
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'EMWeekly/1.0 source-configuration verification'})
  with urllib.request.urlopen(req,timeout=20) as r:
   body=r.read(300000);status=r.status;final=r.url
   if source.get('kind')=='pubmed':
    result=json.loads(body)['esearchresult']
    if result.get('errorlist') or result.get('warninglist',{}).get('quotedphrasesnotfound'):raise ValueError(str(result.get('errorlist') or result['warninglist']))
    data={'resultCount':int(result['count']),'queryTranslation':result.get('querytranslation')}
   # Successful HTTP with a bot challenge is not verified source content.
   if any(x in body.lower() for x in [b'verify you are human',b'just a moment...',b'checking your browser',b'captcha']):return dict(id=source['id'],url=source['url'],status='access-challenge',http=status,finalUrl=final)
  return dict(id=source['id'],url=source['url'],status='verified',http=status,finalUrl=final,**(data or {}))
 except Exception as e:return dict(id=source['id'],url=source['url'],status='unverified',error=str(e))
results=[]
for s in cfg['sources']:results.append(check(s));time.sleep(.7)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results+=list(pool.map(check,cfg['manualChecks']))
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':results,'note':'URL access/query verification only, not a completed editorial literature search. Access-restricted sources require official browser/search verification or remain failed.'}
pathlib.Path('docs/source-verification.json').write_text(json.dumps(report,indent=2)+'\n')
for r in results:print(r['id']+': '+r['status'])

"""Upload immutable, content-addressed assets; link only after public download verifies."""
import hashlib,json,pathlib,urllib.request,urllib.error,os,subprocess,time
from github import request
repo=json.loads(pathlib.Path('config/site.json').read_text())['repository']
def token():
 if os.environ.get('GH_TOKEN'):return os.environ['GH_TOKEN']
 p=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,check=True)
 return dict(x.split('=',1) for x in p.stdout.splitlines() if '=' in x)['password']
def fetch(url,headers=None):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=headers or {}),timeout=30) as r:return r.read()
  except Exception:
   if attempt==2:raise
   time.sleep(2**attempt)
failed=[]
for file in sorted(pathlib.Path('content/issues').glob('*.json')):
 issue=json.loads(file.read_text());tag='issue-'+issue['id']
 try:
  pdf=pathlib.Path('output/pdf',issue['id']+'.pdf').read_bytes();sha=hashlib.sha256(pdf).hexdigest();name=issue['id']+'-'+sha[:12]+'.pdf'
  try:release=request(f'/repos/{repo}/releases/tags/{tag}')
  except urllib.error.HTTPError as e:
   if e.code!=404:raise
   release=request(f'/repos/{repo}/releases','POST',{'tag_name':tag,'target_commitish':os.environ.get('GITHUB_SHA','main'),'name':issue['title'],'body':'Original EM Weekly brief. AI-generated; not yet human-reviewed. '+('Historical sample.' if issue['sample'] else ''),'draft':False,'prerelease':False})
  assets=request(f'/repos/{repo}/releases/{release["id"]}/assets?per_page=100')
  asset=next((a for a in assets if a['name']==name),None)
  if not asset:
   url=f'https://uploads.github.com/repos/{repo}/releases/{release["id"]}/assets?name={name}'
   req=urllib.request.Request(url,data=pdf,headers={'Authorization':'Bearer '+token(),'Content-Type':'application/pdf'},method='POST')
   with urllib.request.urlopen(req,timeout=60) as response:asset=json.load(response)
  public=asset['browser_download_url'];download=fetch(public,{'Accept':'application/pdf','Cache-Control':'no-cache'})
  if not download.startswith(b'%PDF') or hashlib.sha256(download).hexdigest()!=sha:raise ValueError('Public PDF download checksum mismatch; existing asset left intact')
  issue['pdf']={'status':'ready','releaseUrl':public,'sha256':sha};print(f'Verified {tag}: {name}')
 except Exception as e:
  issue['pdf']={**issue['pdf'],'status':'failed'};failed.append(issue['id']);print(f'PDF failed for {issue["id"]}: {type(e).__name__}: {e}')
 file.write_text(json.dumps(issue,indent=2)+'\n')
if failed:raise SystemExit('Failed PDF issues: '+', '.join(failed))

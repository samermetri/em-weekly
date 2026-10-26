"""Local setup helper; use the configured Git credential store, never a tracked token."""
import json,os,subprocess,urllib.request

def request(path, method='GET', data=None):
    token=os.environ.get('GH_TOKEN')
    if not token:
        p=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,check=True)
        token=dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line)['password']
    req=urllib.request.Request('https://api.github.com'+path,method=method,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(req,timeout=30) as response:
        body=response.read()
        return json.loads(body) if body else {}
if __name__=='__main__':
    import sys
    result=request(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else 'GET',json.loads(sys.argv[3]) if len(sys.argv)>3 else None)
    print(json.dumps(result,indent=2))

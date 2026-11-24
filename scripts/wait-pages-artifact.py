"""Wait briefly for a finalized Pages artifact to appear in GitHub's REST index."""
import json
import os
import time
import urllib.request


def wait_for_artifact(fetch, pause=time.sleep, attempts=10):
    for attempt in range(attempts):
        artifacts = [a for a in fetch()['artifacts'] if a['name'] == 'github-pages' and not a['expired']]
        if len(artifacts) == 1:
            print('Pages artifact indexed:', artifacts[0]['id'])
            return artifacts[0]['id']
        if len(artifacts) > 1:
            raise RuntimeError('Multiple Pages artifacts; refusing an ambiguous deployment')
        if attempt + 1 < attempts:
            pause(3)
    raise RuntimeError('Finalized Pages artifact did not appear within the bounded readiness check')


if __name__ == '__main__':
    url = f'https://api.github.com/repos/{os.environ["GITHUB_REPOSITORY"]}/actions/runs/{os.environ["GITHUB_RUN_ID"]}/artifacts?per_page=100'

    def fetch():
        req = urllib.request.Request(url, headers={
            'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'],
            'Accept': 'application/vnd.github+json',
            'Cache-Control': 'no-cache',
            'X-GitHub-Api-Version': '2022-11-28',
        })
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.load(response)

    wait_for_artifact(fetch)

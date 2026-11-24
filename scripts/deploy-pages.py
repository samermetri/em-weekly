"""Deploy the current run's artifact through GitHub's official Pages REST API.

The deploy-pages action's internal results-service lookup can return no artifacts
even when the REST index confirms a finalized upload. Keep the same OIDC Pages
authorization and success gate, using the REST artifact ID directly.
"""
import json
import os
import re
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


def deploy(request, artifact_id, sha, oidc_token, pause=time.sleep, attempts=120):
    deployment = request('/pages/deployments', 'POST', {
        'artifact_id': artifact_id, 'pages_build_version': sha, 'oidc_token': oidc_token,
    })
    identifier = str(deployment.get('id') or deployment['status_url'].rsplit('/', 1)[-1])
    if not re.fullmatch(r'[a-zA-Z0-9-]+', identifier):
        raise RuntimeError('Invalid Pages deployment identity')
    path = '/pages/deployments/' + identifier
    succeeded = False
    try:
        for _ in range(attempts):
            pause(5)
            status = request(path)['status']
            print('Pages deployment status:', status)
            if status == 'succeed':
                succeeded = True
                return deployment['page_url']
            if status in {'deployment_failed', 'deployment_perms_error', 'deployment_content_failed', 'deployment_cancelled', 'deployment_lost'}:
                raise RuntimeError('Pages deployment failed: ' + status)
        raise RuntimeError('Pages deployment timed out')
    finally:
        if not succeeded:
            request(path + '/cancel', 'POST', {})


if __name__ == '__main__':
    base = f'https://api.github.com/repos/{os.environ["GITHUB_REPOSITORY"]}'

    def request(path, method='GET', body=None):
        req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={
            'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'],
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-GitHub-Api-Version': '2022-11-28',
        })
        with urllib.request.urlopen(req, timeout=20) as response:
            content = response.read()
            return json.loads(content) if content else {}

    def fetch():
        result = request(f'/actions/runs/{os.environ["GITHUB_RUN_ID"]}/artifacts?per_page=100')
        for artifact in result['artifacts']:
            if artifact['name'] == 'github-pages' and artifact['workflow_run']['head_sha'] != os.environ['GITHUB_SHA']:
                raise RuntimeError('Pages artifact does not match the validated commit')
        return result

    artifact_id = wait_for_artifact(fetch)
    req = urllib.request.Request(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'], headers={
        'Authorization': 'Bearer ' + os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN'],
    })
    with urllib.request.urlopen(req, timeout=20) as response:
        oidc_token = json.load(response)['value']
    print('::add-mask::' + oidc_token)
    page_url = deploy(request, artifact_id, os.environ['GITHUB_SHA'], oidc_token)
    if not page_url.startswith('https://') or '\n' in page_url or '\r' in page_url:
        raise RuntimeError('Invalid deployment URL')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('page_url=' + page_url + '\n')

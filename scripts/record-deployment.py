import datetime
import json
import os
import pathlib
import subprocess

p = pathlib.Path('state/publishing.json')
state = json.loads(p.read_text())
state['lastSuccessfulDeployment'] = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'runUrl': f'https://github.com/{os.environ["GITHUB_REPOSITORY"]}/actions/runs/{os.environ["GITHUB_RUN_ID"]}',
    'url': os.environ['PAGE_URL'],
}
# completedIssues belongs to the editorial writer, not deployment bookkeeping.
# Changing it here would invalidate the imported content hash after every build.
p.write_text(json.dumps(state, indent=2) + '\n')

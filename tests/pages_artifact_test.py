import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('pages_wait', pathlib.Path(__file__).resolve().parents[1] / 'scripts/deploy-pages.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PagesArtifactTest(unittest.TestCase):
    def test_waits_for_index_and_ignores_expired_or_other_artifacts(self):
        responses = iter([
            {'artifacts': [{'id': 1, 'name': 'github-pages', 'expired': True}]},
            {'artifacts': [{'id': 2, 'name': 'test-report', 'expired': False}]},
            {'artifacts': [{'id': 3, 'name': 'github-pages', 'expired': False}]},
        ])
        pauses = []
        self.assertEqual(module.wait_for_artifact(lambda: next(responses), pauses.append), 3)
        self.assertEqual(pauses, [3, 3])

    def test_missing_artifact_is_bounded_and_still_fails(self):
        pauses = []
        with self.assertRaises(RuntimeError):
            module.wait_for_artifact(lambda: {'artifacts': []}, pauses.append, attempts=3)
        self.assertEqual(len(pauses), 2)

    def test_ambiguous_artifacts_do_not_deploy(self):
        with self.assertRaises(RuntimeError):
            module.wait_for_artifact(lambda: {'artifacts': [{'id': n, 'name': 'github-pages', 'expired': False} for n in [1, 2]]}, lambda _: None)

    def test_only_confirmed_success_returns_deployment_url(self):
        calls = []
        statuses = iter(['queued', 'deploying', 'succeed'])
        def request(path, method='GET', body=None):
            calls.append((path, method, body))
            if method == 'POST':
                return {'id': 'abc123', 'page_url': 'https://emweekly.samermetri.com/'}
            return {'status': next(statuses)}
        self.assertEqual(module.deploy(request, 42, 'commit', 'test-oidc', lambda _: None), 'https://emweekly.samermetri.com/')
        self.assertEqual(calls[0][2], {'artifact_id': 42, 'pages_build_version': 'commit', 'oidc_token': 'test-oidc'})
        self.assertFalse(any(c[0].endswith('/cancel') for c in calls))

    def test_timeout_and_failed_deployment_never_return_success(self):
        for status in ['deploying', 'deployment_content_failed']:
            calls = []
            def request(path, method='GET', body=None):
                calls.append(path)
                return {'id': 'abc123', 'page_url': 'https://emweekly.samermetri.com/'} if method == 'POST' else {'status': status}
            with self.assertRaises(RuntimeError):
                module.deploy(request, 42, 'commit', 'test-oidc', lambda _: None, attempts=2)
            self.assertEqual(calls[-1], '/pages/deployments/abc123/cancel')

import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('pages_wait', pathlib.Path(__file__).resolve().parents[1] / 'scripts/wait-pages-artifact.py')
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

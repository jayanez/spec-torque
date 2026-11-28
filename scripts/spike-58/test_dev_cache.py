"""Focused regression tests for the Python DEV tools."""
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import fcntl
from http.client import IncompleteRead
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
from threading import Event
import unittest
from unittest.mock import patch

from dev_cache import cache_file, directory, documents, git_blob

spec = importlib.util.spec_from_file_location('fetch_dev', Path(__file__).with_name('fetch-dev.py'))
fetch_dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch_dev)

PIN = {
    'repository': 'github.com/kcalvelli/cairn',
    'commit': '712dc76d47efd44f2affc5a07865cd26231ef3e6',
    'license': 'MIT',
}
DOC = 'openspec/specs/synthetic/spec.md'


class DevCacheTests(unittest.TestCase):
    def test_reader_accepts_legacy_indexes_and_rejects_untrusted_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            repo = root / 'kcalvelli/cairn'
            repo.mkdir(parents=True)
            file = repo / '0.md'
            file.write_bytes(b'example')
            index = root / 'index.json'

            def write_index(path=DOC, local='0.md'):
                index.write_text(json.dumps([{**PIN, 'documents': [{'path': path, 'local': local}]}]))

            write_index()
            self.assertEqual(list(documents(root)), [('kcalvelli/cairn', PIN['commit'], DOC, b'example', 'unverified-legacy')])
            for path, local in [(DOC, '../../other.md'), ('openspec/specs/../spec.md', '0.md')]:
                write_index(path, local)
                with self.assertRaises(ValueError):
                    list(documents(root))
            write_index()
            file.unlink()
            file.symlink_to(index)
            with self.assertRaises(OSError):
                list(documents(root))

    def test_cache_writer_does_not_follow_or_overwrite_existing_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / 'target'
            target.write_text('preserve')
            (root / '0.md').symlink_to(target)
            with directory(root) as fd, self.assertRaises(FileExistsError):
                with cache_file('0.md', fd, write=True):
                    self.fail('opened existing cache path')
            self.assertEqual(target.read_text(), 'preserve')

    def test_truncated_download_is_recorded_for_that_document(self):
        with tempfile.TemporaryDirectory() as temp, ThreadPoolExecutor() as pool, directory(temp) as fd:
            def read(url, _):
                if url.endswith(DOC):
                    raise IncompleteRead(b'a', 2)
                return b'data'

            with patch.object(fetch_dev, 'read', side_effect=read):
                result = fetch_dev.fetch_documents(PIN, pool, fd, {'truncated': False},
                                                   {'other': {'sha': git_blob(b'data')}}, [DOC, 'other'])
            self.assertIn('IncompleteRead', result['documents'][0]['error'])
            self.assertEqual(result['documents'][1]['local'], '1.md')
            self.assertFalse((Path(temp) / '0.md').exists())

    def test_blob_mismatch_is_not_written(self):
        with tempfile.TemporaryDirectory() as temp, ThreadPoolExecutor() as pool, directory(temp) as fd:
            with patch.object(fetch_dev, 'read', return_value=b'bad bytes'):
                result = fetch_dev.fetch_documents(PIN, pool, fd, {'truncated': False},
                                                   {DOC: {'sha': git_blob(b'intended')}}, [DOC])
            self.assertEqual(result['documents'], [{'path': DOC, 'error': 'Git blob mismatch for pinned path'}])
            self.assertFalse((Path(temp) / '0.md').exists())

    def test_fetcher_never_records_paths_its_index_reader_rejects(self):
        paths = [DOC, 'openspec/specs/untrusted\\name/spec.md']
        data = b'example'
        tree = {'truncated': False, 'tree': [
            {'path': path, 'type': 'blob', 'mode': '100644', 'sha': git_blob(data)} for path in paths
        ]}
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with patch.object(fetch_dev, 'read', side_effect=[json.dumps(tree).encode(), data]) as read:
                fetch_dev.populate(root, [{**PIN, 'family': 'openspec'}])
            self.assertEqual(read.call_count, 2)
            self.assertEqual(list(documents(root)), [
                ('kcalvelli/cairn', PIN['commit'], DOC, data, 'matches-recorded-blob'),
            ])

    def test_new_generation_requires_a_blob_for_every_download(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = {**PIN, 'cacheGeneration': 'run-' + '0' * 32, 'documents': [{'path': DOC, 'local': '0.md'}]}
            for fields in ({}, {'gitBlob': 'invalid'}):
                source['documents'] = [{'path': DOC, 'local': '0.md', **fields}]
                (root / 'index.json').write_text(json.dumps([source]))
                with self.assertRaisesRegex(ValueError, 'unauthorized DEV'):
                    list(documents(root))

    def test_null_generation_is_rejected_before_path_resolution(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'index.json').write_text(json.dumps([{**PIN, 'cacheGeneration': None}]))
            with self.assertRaisesRegex(ValueError, 'unauthorized DEV'):
                list(documents(root))

    def test_invalid_tree_is_rejected_before_dispatching_downloads(self):
        tree = {'truncated': False, 'tree': [{'path': DOC, 'type': 'blob', 'mode': '100644'}]}
        with tempfile.TemporaryDirectory() as temp, directory(temp) as fd:
            with patch.object(fetch_dev, 'read', return_value=json.dumps(tree).encode()) as read, \
                 patch.object(fetch_dev, 'ThreadPoolExecutor') as executor:
                with self.assertRaisesRegex(ValueError, 'invalid blob ID'):
                    fetch_dev.fetch({**PIN, 'family': 'openspec'}, fd)
            self.assertEqual(read.call_count, 1)
            executor.assert_not_called()
            self.assertEqual(list(Path(temp).iterdir()), [])

    def test_repository_descriptor_outlives_workers_on_unexpected_failure(self):
        started, release = Event(), Event()
        observed = []

        def fail_after_submit(_source, pool, repo_fd, *_):
            def worker():
                started.set()
                if release.wait(5):
                    observed.append(os.fstat(repo_fd).st_ino)

            pool.submit(worker)
            raise RuntimeError('unexpected failure collecting results')

        with tempfile.TemporaryDirectory() as temp, directory(temp) as fd, ThreadPoolExecutor() as caller:
            with patch.object(fetch_dev, 'read', return_value=b'{"tree":[]}'), \
                 patch.object(fetch_dev, 'fetch_documents', side_effect=fail_after_submit):
                future = caller.submit(fetch_dev.fetch, {**PIN, 'family': 'openspec'}, fd)
                try:
                    self.assertTrue(started.wait(2))
                    with self.assertRaises(TimeoutError):
                        future.result(timeout=0.05)
                finally:
                    release.set()
                with self.assertRaisesRegex(RuntimeError, 'unexpected failure'):
                    future.result(timeout=2)
            self.assertEqual(observed, [(Path(temp) / 'kcalvelli/cairn').stat().st_ino])

    def test_new_cache_parent_is_synced_and_staging_cleanup_is_best_effort(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'new' / 'cache'
            synced = []
            fsync = os.fsync

            def note_sync(fd):
                synced.append(os.fstat(fd).st_ino)
                fsync(fd)

            with patch.object(fetch_dev, 'fetch', return_value={**PIN, 'documents': []}), \
                 patch.object(fetch_dev.os, 'fsync', side_effect=note_sync), \
                 patch.object(fetch_dev.os, 'unlink', side_effect=PermissionError('staging only')):
                fetch_dev.populate(root, [PIN])
            self.assertIn(Path(temp).stat().st_ino, synced)
            self.assertIn(root.parent.stat().st_ino, synced)
            self.assertIn(root.stat().st_ino, synced)
            self.assertEqual(list(documents(root)), [])

    def test_index_publication_recovers_after_interruption_and_respects_lock(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with directory(root) as fd:
                fcntl.flock(fd, fcntl.LOCK_EX)
                with self.assertRaisesRegex(SystemExit, 'already running'):
                    fetch_dev.populate(root, [PIN])

            with patch.object(fetch_dev, 'fetch', side_effect=KeyboardInterrupt):
                with self.assertRaises(KeyboardInterrupt):
                    fetch_dev.populate(root, [PIN])
            self.assertFalse((root / 'index.json').exists())
            (abandoned,) = root.iterdir()

            verified = {**PIN, 'documents': []}
            with patch.object(fetch_dev, 'fetch', return_value=verified):
                fetch_dev.populate(root, [PIN])
            (row,) = json.loads((root / 'index.json').read_text())
            self.assertNotEqual(row['cacheGeneration'], abandoned.name)
            self.assertTrue((root / row['cacheGeneration']).is_dir())
            self.assertTrue(abandoned.is_dir())
            with self.assertRaisesRegex(SystemExit, 'fresh cache'):
                fetch_dev.populate(root, [PIN])

    def test_held_directory_cannot_be_redirected_by_replacing_its_path(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trusted = root / 'trusted'
            trusted.mkdir()
            (trusted / '0.md').write_bytes(b'original')
            redirected = root / 'redirected'
            redirected.mkdir()
            (redirected / '0.md').write_bytes(b'other')
            with directory(trusted) as fd:
                trusted.rename(root / 'moved')
                trusted.symlink_to(redirected, target_is_directory=True)
                with cache_file('0.md', fd) as stream:
                    self.assertEqual(stream.read(), b'original')
            with self.assertRaises(OSError):
                with directory(trusted):
                    self.fail('accepted symlink to a directory')

    def test_bounded_http_read_rejects_short_body(self):
        body = io.BytesIO(b'short')
        body.headers = {'Content-Length': '100'}
        with patch.object(fetch_dev, 'urlopen', return_value=body), self.assertRaises(IncompleteRead):
            fetch_dev.read('https://example.invalid', limit=50)


if __name__ == '__main__':
    unittest.main()

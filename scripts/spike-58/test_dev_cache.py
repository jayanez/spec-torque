"""Focused regression tests for the Python DEV tools."""
from concurrent.futures import ThreadPoolExecutor
import fcntl
from http.client import IncompleteRead
import importlib.util
import io
import json
from pathlib import Path
import tempfile
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

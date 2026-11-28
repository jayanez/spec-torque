"""Focused regression tests for the Python DEV tools."""
from concurrent.futures import ThreadPoolExecutor
from http.client import IncompleteRead
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from dev_cache import cache_file, directory, documents

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
            self.assertEqual(list(documents(root)), [('kcalvelli/cairn', PIN['commit'], DOC, b'example')])
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
                result = fetch_dev.fetch_documents(PIN, pool, fd, {'truncated': False}, {}, [DOC, 'other'])
            self.assertIn('IncompleteRead', result['documents'][0]['error'])
            self.assertEqual(result['documents'][1]['local'], '1.md')
            self.assertFalse((Path(temp) / '0.md').exists())

    def test_bounded_http_read_rejects_short_body(self):
        body = io.BytesIO(b'short')
        body.headers = {'Content-Length': '100'}
        with patch.object(fetch_dev, 'urlopen', return_value=body), self.assertRaises(IncompleteRead):
            fetch_dev.read('https://example.invalid', limit=50)


if __name__ == '__main__':
    unittest.main()

"""Fetch only the pinned DEV specification population for spike #58."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import suppress
import fcntl
from http.client import IncompleteRead
import json
import os
from pathlib import Path
import sys
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import uuid4

from dev_cache import BLOB_ID, DEFAULT_ROOT, GENERATION, LIMIT, MANIFEST, cache_file, directory, git_blob, matches


def read(url, limit=None):
    with urlopen(Request(url, headers={'User-Agent': 'spectorque-58'}), timeout=25) as response:
        data = response.read() if limit is None else response.read(limit + 1)
        length = response.headers.get('Content-Length')
        if length is not None and len(data) < min(int(length), limit + 1 if limit is not None else int(length)):
            raise IncompleteRead(data, int(length) - len(data))
        return data


def fetch(source, cache_fd):
    repo = source['repository'].removeprefix('github.com/')
    revision = source['commit']
    tree = json.loads(read(f'https://api.github.com/repos/{repo}/git/trees/{revision}?recursive=1'))
    blobs = {entry['path']: entry for entry in tree['tree']
             if entry['type'] == 'blob' and entry['mode'] in ('100644', '100755')}
    if any(not isinstance(entry.get('sha'), str) or not BLOB_ID.fullmatch(entry['sha']) for entry in blobs.values()):
        raise ValueError('Pinned Git tree contains a missing or invalid blob ID')
    paths = sorted(path for path in blobs if matches(path, source['family']))
    owner, name = repo.split('/')
    try:
        os.mkdir(owner, mode=0o700, dir_fd=cache_fd)
    except FileExistsError:
        pass
    with directory(owner, cache_fd) as owner_fd:
        os.mkdir(name, mode=0o700, dir_fd=owner_fd)
        with directory(name, owner_fd) as repo_fd:
            # Shutdown waits for every submitted download, including when result
            # collection raises. The repository descriptor outlives the pool.
            with ThreadPoolExecutor(max_workers=12) as pool:
                result = fetch_documents(source, pool, repo_fd, tree, blobs, paths)
            os.fsync(repo_fd)
        os.fsync(owner_fd)
        return result


def fetch_documents(source, pool, repo_fd, tree, blobs, paths):
    repo = source['repository'].removeprefix('github.com/')
    revision = source['commit']
    raw = f'https://raw.githubusercontent.com/{repo}/{revision}/'

    def download(item):
        index, path = item
        local = f'{index}.md'
        try:
            data = read(raw + quote(path), LIMIT)
            if len(data) > LIMIT:
                return {'path': path, 'error': 'document exceeds 1 MB'}
            expected = blobs[path]['sha']
            if git_blob(data) != expected:
                return {'path': path, 'error': 'Git blob mismatch for pinned path'}
            with cache_file(local, repo_fd, write=True) as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            return {'path': path, 'local': local, 'gitBlob': expected}
        except (OSError, ValueError, IncompleteRead) as error:
            return {'path': path, 'error': str(error)}

    license_record = {'path': None, 'status': 'unverified'}
    for path in sorted(blobs):
        if path.lower() not in ('license', 'license.md', 'license.txt', 'copying'):
            continue
        license_record['path'] = path
        try:
            data = read(raw + quote(path), 200_000)
            if len(data) > 200_000 or git_blob(data) != blobs[path]['sha']:
                raise ValueError('Cannot verify root license bytes against pinned Git blob')
            content = ' '.join(data.decode('utf8', 'replace').lower().split())
            spdx = ('Apache-2.0' if 'apache license version 2.0' in content else
                    'MIT' if 'permission is hereby granted, free of charge' in content and
                    'the software is provided "as is"' in content else None)
            license_record.update({'detected': spdx, 'status': 'matched-root-license'
                                   if spdx == source['license'] else 'unverified'})
        except (OSError, ValueError, IncompleteRead) as error:
            license_record['error'] = str(error)
        break
    return {**source, 'tree_truncated': bool(tree.get('truncated')), 'matching': len(paths),
            'licenseCheck': license_record, 'documents': list(pool.map(download, enumerate(paths)))}


def prepare_root(root):
    root = root.absolute()
    if root == root.parent:
        return
    if not root.parent.exists():
        prepare_root(root.parent)
    with directory(root.parent.resolve(strict=True)) as parent_fd:
        with suppress(FileExistsError):
            os.mkdir(root.name, mode=0o700, dir_fd=parent_fd)
        os.fsync(parent_fd)


def populate(root, sources):
    prepare_root(root)
    with directory(root) as cache_fd:
        try:
            fcntl.flock(cache_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('A retrieval is already running in this cache') from None
        for entry in os.listdir(cache_fd):
            if not GENERATION.fullmatch(entry):
                raise SystemExit('Use a fresh cache directory for each retrieval')
            with directory(entry, cache_fd):
                pass
        generation = f'run-{uuid4().hex}'
        os.mkdir(generation, mode=0o700, dir_fd=cache_fd)
        with directory(generation, cache_fd) as generation_fd:
            summary = []
            for source in sources:
                try:
                    result = fetch(source, generation_fd)
                except (OSError, ValueError, KeyError, IncompleteRead) as error:
                    result = {**source, 'error': str(error)}
                summary.append({**result, 'cacheGeneration': generation})
                print(source['repository'], len(result.get('documents', [])), result.get('error', ''), flush=True)
            with cache_file('index.json', generation_fd, write=True) as index:
                index.write((json.dumps(summary, ensure_ascii=False, indent=2) + '\n').encode())
                index.flush()
                os.fsync(index.fileno())
            os.fsync(generation_fd)
            os.fsync(cache_fd)
            # Atomically publish without replacing any existing directory entry.
            os.link('index.json', 'index.json', src_dir_fd=generation_fd, dst_dir_fd=cache_fd, follow_symlinks=False)
            os.fsync(cache_fd)
            # The index is already published. A leftover staging link is harmless.
            with suppress(OSError):
                os.unlink('index.json', dir_fd=generation_fd)


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ROOT
    populate(root, json.loads(MANIFEST.read_text())['sources'])


if __name__ == '__main__':
    main()

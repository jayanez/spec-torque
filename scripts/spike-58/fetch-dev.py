"""Fetch only the pinned DEV specification population for spike #58."""
from concurrent.futures import ThreadPoolExecutor
from http.client import IncompleteRead
import json
import os
from pathlib import Path
import sys
from urllib.parse import quote
from urllib.request import Request, urlopen

from dev_cache import DEFAULT_ROOT, MANIFEST, cache_file, directory, matches

LIMIT = 1_000_000


def read(url, limit=None):
    with urlopen(Request(url, headers={'User-Agent': 'spectorque-58'}), timeout=25) as response:
        data = response.read() if limit is None else response.read(limit + 1)
        length = response.headers.get('Content-Length')
        if length is not None and len(data) < min(int(length), limit + 1 if limit is not None else int(length)):
            raise IncompleteRead(data, int(length) - len(data))
        return data


def fetch(source, pool, cache_fd):
    repo = source['repository'].removeprefix('github.com/')
    revision = source['commit']
    tree = json.loads(read(f'https://api.github.com/repos/{repo}/git/trees/{revision}?recursive=1'))
    blobs = {entry['path']: entry for entry in tree['tree']
             if entry['type'] == 'blob' and entry['mode'] in ('100644', '100755')}
    paths = sorted(path for path in blobs if matches(path, source['family']))
    owner, name = repo.split('/')
    try:
        os.mkdir(owner, mode=0o700, dir_fd=cache_fd)
    except FileExistsError:
        pass
    with directory(owner, cache_fd) as owner_fd:
        os.mkdir(name, mode=0o700, dir_fd=owner_fd)
        with directory(name, owner_fd) as repo_fd:
            return fetch_documents(source, pool, repo_fd, tree, blobs, paths)


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
            with cache_file(local, repo_fd, write=True) as stream:
                stream.write(data)
            return {'path': path, 'local': local}
        except (OSError, ValueError, IncompleteRead) as error:
            return {'path': path, 'error': str(error)}

    license_record = {'path': None, 'status': 'unverified'}
    for path in sorted(blobs):
        if path.lower() not in ('license', 'license.md', 'license.txt', 'copying'):
            continue
        license_record['path'] = path
        try:
            content = ' '.join(read(raw + quote(path), 200_000).decode('utf8', 'replace').lower().split())
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


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ROOT
    root.mkdir(mode=0o700, exist_ok=True, parents=True)
    with directory(root) as cache_fd:
        if os.listdir(cache_fd):
            raise SystemExit('Use a fresh cache directory for each retrieval')
        with cache_file('index.json', cache_fd, write=True) as index, ThreadPoolExecutor(max_workers=12) as pool:
            summary = []
            for source in json.loads(MANIFEST.read_text())['sources']:
                try:
                    result = fetch(source, pool, cache_fd)
                except (OSError, ValueError, KeyError, IncompleteRead) as error:
                    result = {**source, 'error': str(error)}
                summary.append(result)
                print(source['repository'], len(result.get('documents', [])), result.get('error', ''), flush=True)
            index.write((json.dumps(summary, ensure_ascii=False, indent=2) + '\n').encode())


if __name__ == '__main__':
    main()

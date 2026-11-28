"""Shared path validation and file access for the pinned DEV cache."""
import base64
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

MANIFEST = Path(__file__).resolve().parents[2] / 'fixtures/precision/r52-dev-sources.json'
DEFAULT_ROOT = Path('/private/tmp/spec58-natural')
LIMIT = 1_000_000
GENERATION = re.compile(r'run-[0-9a-f]{32}')
BLOB_ID = re.compile(r'[0-9a-f]{40}')


def matches(path, family):
    if '\\' in path or any(part in ('', '.', '..') for part in path.split('/')):
        return False
    path = path.lower()
    patterns = {
        'openspec': ('/openspec/specs/', '/spec.md'),
        'spec-kit': ('/specs/', '/spec.md'),
        'spec-kitty': ('/kitty-specs/', '/spec.md'),
        'kiro': ('/.kiro/specs/', '/requirements.md'),
        'bmad': ('/_bmad-output/', '/prd.md'),
    }
    marker, suffix = patterns[family]
    return (path.startswith('specs/') if family == 'spec-kit' else marker in '/' + path) and path.endswith(suffix)


@contextmanager
def directory(path, parent=None):
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    if parent is not None:
        fd = os.open(path, flags, dir_fd=parent)
    else:
        absolute = Path(path).absolute()
        root, *components = (absolute.parent.resolve() / absolute.name).parts
        fd = os.open(root, flags)
        try:
            for component in components:
                child = os.open(component, flags, dir_fd=fd)
                os.close(fd)
                fd = child
        except BaseException:
            os.close(fd)
            raise
    try:
        yield fd
    finally:
        os.close(fd)


def git_blob(data):
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()


@contextmanager
def cache_file(name, directory_fd, *, write=False):
    access = os.O_WRONLY | os.O_CREAT | os.O_EXCL if write else os.O_RDONLY | os.O_NONBLOCK
    fd = os.open(name, access | os.O_NOFOLLOW, 0o600, dir_fd=directory_fd)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError('Unexpected non-regular cache file')
        with os.fdopen(fd, 'wb' if write else 'rb', closefd=False) as stream:
            yield stream
    finally:
        os.close(fd)


def load_index(cache):
    pinned = {source['repository']: source for source in json.loads(MANIFEST.read_text())['sources']}
    seen = set()
    with cache_file('index.json', cache) as stream:
        sources = json.load(stream)
    for source in sources:
        repository = source['repository']
        pin = pinned.get(repository)
        generation = source.get('cacheGeneration')
        if (repository in seen or not pin or
                any(source.get(key) != pin[key] for key in ('commit', 'license')) or
                ('cacheGeneration' in source and
                 (not isinstance(generation, str) or not GENERATION.fullmatch(generation)))):
            raise ValueError('Index contains duplicate or unauthorized DEV sources')
        seen.add(repository)
        paths, locals_ = set(), set()
        for doc in source.get('documents', []):
            path, local, blob = doc['path'], doc.get('local'), doc.get('gitBlob')
            if (path in paths or not matches(path, pin['family'])
                    or (local is not None and (not re.fullmatch(r'[0-9]+\.md', local) or local in locals_))
                    or (generation is not None and local is not None and blob is None)
                    or (blob is not None and (not isinstance(blob, str) or not BLOB_ID.fullmatch(blob)))):
                raise ValueError('Index contains duplicate or unauthorized DEV sources or paths')
            paths.add(path)
            if local is not None:
                locals_.add(local)
    return sources


def read_document(cache, source, document):
    repo = source['repository'].removeprefix('github.com/')
    owner, name = repo.split('/')
    with directory(source.get('cacheGeneration', '.'), cache) as generation:
        with directory(owner, generation) as owner_fd, directory(name, owner_fd) as repo_fd:
            with cache_file(document['local'], repo_fd) as stream:
                data = stream.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError('Cached document exceeds 1 MB')
    expected = document.get('gitBlob')
    if expected is None:
        return data, 'unverified-legacy'
    if git_blob(data) != expected:
        raise ValueError('Cached bytes disagree with recorded Git blob')
    return data, 'matches-recorded-blob'


def documents(root):
    with directory(root) as cache:
        for source in load_index(cache):
            for document in source.get('documents', []):
                if document.get('local') is not None:
                    data, verification = read_document(cache, source, document)
                    yield source['repository'].removeprefix('github.com/'), source['commit'], document['path'], data, verification


def stream_cache(root):
    with directory(root) as cache:
        sources = load_index(cache)
        print(json.dumps(sources), flush=True)
        for source in sources:
            for document in source.get('documents', []):
                if document.get('local') is None:
                    continue
                try:
                    data, _ = read_document(cache, source, document)
                    record = {'data': base64.b64encode(data).decode('ascii')}
                except (OSError, ValueError) as error:
                    record = {'error': str(error)}
                print(json.dumps(record), flush=True)


if __name__ == '__main__':
    stream_cache(Path(sys.argv[1]))

"""Shared path validation and file access for the pinned DEV cache."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import stat

MANIFEST = Path(__file__).resolve().parents[2] / 'fixtures/precision/r52-dev-sources.json'
DEFAULT_ROOT = Path('/private/tmp/spec58-natural')


def matches(path, family):
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
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        yield fd
    finally:
        os.close(fd)


@contextmanager
def cache_file(name, directory_fd, *, write=False):
    access = os.O_WRONLY | os.O_CREAT | os.O_EXCL if write else os.O_RDONLY | os.O_NONBLOCK
    fd = os.open(name, access | os.O_NOFOLLOW, 0o600, dir_fd=directory_fd)
    with os.fdopen(fd, 'wb' if write else 'rb') as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError('Unexpected non-regular cache file')
        yield stream


def documents(root):
    pinned = {source['repository']: source for source in json.loads(MANIFEST.read_text())['sources']}
    seen = set()
    with directory(root) as cache:
        with cache_file('index.json', cache) as stream:
            sources = json.load(stream)
        for source in sources:
            repository = source['repository']
            pin = pinned.get(repository)
            if (repository in seen or not pin or
                    any(source.get(key) != pin[key] for key in ('commit', 'license'))):
                raise ValueError('Index contains duplicate or unauthorized DEV sources')
            seen.add(repository)
            paths, locals_ = set(), set()
            for doc in source.get('documents', []):
                path, local = doc['path'], doc.get('local')
                if (path in paths or '\\' in path or any(part in ('', '.', '..') for part in path.split('/'))
                        or not matches(path, pin['family'])
                        or (local is not None and (not re.fullmatch(r'[0-9]+\.md', local) or local in locals_))):
                    raise ValueError('Index contains duplicate or unauthorized DEV paths')
                paths.add(path)
                if local is not None:
                    locals_.add(local)
        for source in sources:
            repo = source['repository'].removeprefix('github.com/')
            owner, name = repo.split('/')
            for document in source.get('documents', []):
                local = document.get('local')
                if local is not None:
                    with directory(owner, cache) as owner_fd, directory(name, owner_fd) as repo_fd:
                        with cache_file(local, repo_fd) as stream:
                            data = stream.read()
                    yield repo, source['commit'], document['path'], data

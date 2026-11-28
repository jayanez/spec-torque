"""Fetch only the pinned DEV specification population for spike #58."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sys
from urllib.parse import quote
from urllib.request import Request, urlopen

MANIFEST = Path(__file__).resolve().parents[2] / 'fixtures/precision/r52-dev-sources.json'
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '/private/tmp/spec58-natural')
LIMIT = 1_000_000


def read(url, limit=None):
    with urlopen(Request(url, headers={'User-Agent': 'spectorque-58'}), timeout=25) as response:
        return response.read() if limit is None else response.read(limit + 1)


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


def fetch(source, pool):
    repo = source['repository'].removeprefix('github.com/')
    revision = source['commit']
    tree = json.loads(read(f'https://api.github.com/repos/{repo}/git/trees/{revision}?recursive=1'))
    blobs = {entry['path']: entry for entry in tree['tree']
             if entry['type'] == 'blob' and entry['mode'] in ('100644', '100755')}
    paths = sorted(path for path in blobs if matches(path, source['family']))
    directory = ROOT / repo
    directory.mkdir(parents=True, exist_ok=True)
    raw = f'https://raw.githubusercontent.com/{repo}/{revision}/'

    def download(item):
        index, path = item
        local = f'{index}.md'
        try:
            data = read(raw + quote(path), LIMIT)
            if len(data) > LIMIT:
                return {'path': path, 'error': 'document exceeds 1 MB'}
            (directory / local).write_bytes(data)
            return {'path': path, 'local': local}
        except (OSError, ValueError) as error:
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
        except OSError as error:
            license_record['error'] = str(error)
        break
    return {**source, 'tree_truncated': bool(tree.get('truncated')), 'matching': len(paths),
            'licenseCheck': license_record, 'documents': list(pool.map(download, enumerate(paths)))}


def main():
    ROOT.mkdir(exist_ok=True, parents=True)
    if (ROOT / 'index.json').exists():
        raise SystemExit('Use a fresh cache directory for each retrieval')
    summary = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        for source in json.loads(MANIFEST.read_text())['sources']:
            try:
                result = fetch(source, pool)
            except (OSError, ValueError, KeyError) as error:
                result = {**source, 'error': str(error)}
            summary.append(result)
            print(source['repository'], len(result.get('documents', [])), result.get('error', ''), flush=True)
    (ROOT / 'index.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()

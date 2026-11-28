"""Aggregate whole-document exact hashes for the already authorized DEV fetch."""
import collections
import hashlib
import json
import pathlib
import unicodedata

root = pathlib.Path('/private/tmp/spec58-natural')
sources = json.loads((root / 'index.json').read_text())
raw = collections.defaultdict(list)
normalized = collections.defaultdict(list)
count = 0
for source in sources:
    repo = source['repository'].removeprefix('github.com/')
    for document in source.get('documents', []):
        if 'local' not in document:
            continue
        data = (root / repo / document['local']).read_bytes()
        identity = (repo, document['path'])
        count += 1
        raw[hashlib.sha256(data).hexdigest()].append(identity)
        text = unicodedata.normalize('NFC', data.decode('utf-8', errors='replace'))
        text = ' '.join(text.casefold().split())
        normalized[hashlib.sha256(text.encode('utf-8')).hexdigest()].append(identity)
for name, hashes in [('bytes', raw), ('normalized', normalized)]:
    groups = [group for group in hashes.values() if len(group) > 1]
    print(json.dumps({'mode': name, 'documents': count, 'duplicate_groups': len(groups),
                      'members': sum(map(len, groups)), 'cross_repository_groups': sum(
                          len({repo for repo, _ in group}) > 1 for group in groups)}))

"""Aggregate whole-document exact hashes for the already authorized DEV fetch."""
import collections
import hashlib
import json
from pathlib import Path
import sys

from dev_cache import DEFAULT_ROOT, documents
import unicodedata

root = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ROOT
raw = collections.defaultdict(list)
normalized = collections.defaultdict(list)
verification_counts = collections.Counter()
for repo, _, path, data, verification in documents(root):
    identity = (repo, path)
    verification_counts[verification] += 1
    raw[hashlib.sha256(data).hexdigest()].append(identity)
    text = unicodedata.normalize('NFC', data.decode('utf-8', errors='replace'))
    text = ' '.join(text.casefold().split())
    normalized[hashlib.sha256(text.encode('utf-8')).hexdigest()].append(identity)
for name, hashes in [('bytes', raw), ('normalized', normalized)]:
    groups = [group for group in hashes.values() if len(group) > 1]
    print(json.dumps({'mode': name, 'documents': sum(verification_counts.values()),
                      'verification': dict(verification_counts), 'duplicate_groups': len(groups),
                      'members': sum(map(len, groups)), 'cross_repository_groups': sum(
                          len({repo for repo, _ in group}) > 1 for group in groups)}))

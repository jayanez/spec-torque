"""Print bounded exact-text leads, not adjudicated defects or a recurrence gate."""
import json
from pathlib import Path
import sys

from dev_cache import DEFAULT_ROOT, documents
import re

root = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ROOT
patterns = {
    'boundary-heading': r'^\s*#{1,6}\s+Boundary\s*$',
    'spanish-plural': r'casos\s+límite',
    'undecided-keyword': r'(acceptance criteria|verification method|test failure|definition of done|provider fail).{0,100}(tbd|later|undecided|pending|to be determined|not yet)',
    'reverse-undecided': r'(tbd|later|undecided|pending|to be determined|not yet).{0,100}(acceptance criteria|verification method|test failure|definition of done|provider fail)',
}
for repo, revision, path, data in documents(root):
    for number, line in enumerate(data.decode('utf-8', errors='replace').splitlines(), 1):
        for name, pattern in patterns.items():
            if re.search(pattern, line, re.I):
                print(json.dumps({'pattern': name, 'repository': repo, 'revision': revision,
                                  'path': path, 'line': number, 'text': line}, ensure_ascii=False))

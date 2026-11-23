"""Print bounded exact-text leads, not adjudicated defects or a recurrence gate."""
import json
import pathlib
import re

root = pathlib.Path('/private/tmp/spec58-natural')
sources = json.loads((root / 'index.json').read_text())
patterns = {
    'boundary-heading': r'^\s*#{1,6}\s+Boundary\s*$',
    'spanish-plural': r'casos\s+límite',
    'undecided-keyword': r'(acceptance criteria|verification method|test failure|definition of done|provider fail).{0,100}(tbd|later|undecided|pending|to be determined|not yet)',
    'reverse-undecided': r'(tbd|later|undecided|pending|to be determined|not yet).{0,100}(acceptance criteria|verification method|test failure|definition of done|provider fail)',
}
for source in sources:
    repo = source['repository'].removeprefix('github.com/')
    for document in source.get('documents', []):
        if 'local' not in document:
            continue
        for number, line in enumerate((root / repo / document['local']).read_text(errors='replace').splitlines(), 1):
            for name, pattern in patterns.items():
                if re.search(pattern, line, re.I):
                    print(json.dumps({'pattern': name, 'repository': repo, 'revision': source['commit'],
                                      'path': document['path'], 'line': number, 'text': line}, ensure_ascii=False))

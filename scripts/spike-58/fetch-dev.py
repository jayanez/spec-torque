import json, urllib.request, pathlib, time
sources=json.load(open('fixtures/precision/r52-dev-sources.json'))['sources']
out=pathlib.Path('/private/tmp/spec58-natural');out.mkdir(exist_ok=True)
summary=[]
for s in sources:
 repo=s['repository'].removeprefix('github.com/'); rev=s['commit']; fam=s['family']
 try:
  req=urllib.request.Request(f'https://api.github.com/repos/{repo}/git/trees/{rev}?recursive=1',headers={'User-Agent':'spectorque-58'})
  tree=json.load(urllib.request.urlopen(req,timeout=25)); paths=[]
  for x in tree.get('tree',[]):
   p=x['path']; lo=p.lower()
   if x['type']!='blob' or not lo.endswith('.md'): continue
   if (fam=='openspec' and 'openspec/specs/' in lo and lo.endswith('/spec.md')) or (fam=='spec-kit' and lo.startswith('specs/') and lo.endswith('/spec.md')) or (fam=='spec-kitty' and 'kitty-specs/' in lo and lo.endswith('/spec.md')) or (fam=='kiro' and '.kiro/specs/' in lo and lo.endswith('/requirements.md')) or (fam=='bmad' and '_bmad-output/' in lo and lo.endswith('/prd.md')): paths.append(p)
  d=out/repo; d.mkdir(parents=True,exist_ok=True)
  docs=[]
  for i,p in enumerate(paths[:100]):
   url=f'https://raw.githubusercontent.com/{repo}/{rev}/'+urllib.parse.quote(p)
   try:
    data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'spectorque-58'}),timeout=20).read(1000001)
    if len(data)>1000000: continue
    (d/f'{i}.md').write_bytes(data);docs.append({'path':p,'local':f'{i}.md'})
   except Exception as e: docs.append({'path':p,'error':str(e)})
  summary.append({**s,'tree_truncated':tree.get('truncated',False),'matching':len(paths),'documents':docs})
 except Exception as e: summary.append({**s,'error':str(e)})
 (out/'index.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
 print(repo, len(summary[-1].get('documents',[])),summary[-1].get('error',''),flush=True)

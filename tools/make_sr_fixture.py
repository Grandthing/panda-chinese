# Turns Panda log files (🐞 → แชร์ไฟล์ log) into tests/fixtures/sr-attempts.json: every distinct thing the
# phone's recogniser heard for a word. tests/run.mjs replays them through scoreSpeech and compares the
# verdicts with tests/fixtures/sr-golden.json, so a scoring change can't silently flip old results.
#   python tools/make_sr_fixture.py <folder with panda-log-*.txt>      then   npm run test:update
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'fixtures', 'sr-attempts.json')
LINE = re.compile(r'\[sr\] (\S+) ได้ยิน \[(.*)\] score=')

seen, rows = set(), []
if os.path.exists(OUT):  # keep what earlier logs gave us
    for r in json.load(open(OUT, encoding='utf-8')):
        seen.add((r['id'], tuple(r['alts']))); rows.append(r)
for path in sorted(glob.glob(os.path.join(sys.argv[1], 'panda-log-*.txt'))):
    for line in open(path, encoding='utf-8', errors='replace'):
        m = LINE.search(line)
        if not m:
            continue
        key = (m.group(1), tuple(m.group(2).split(' / ')))
        if key not in seen:
            seen.add(key); rows.append({'id': key[0], 'alts': list(key[1])})
rows.sort(key=lambda r: (r['id'], r['alts']))
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('[\n' + ',\n'.join(' ' + json.dumps(r, ensure_ascii=False) for r in rows) + '\n]\n')
print(len(rows), 'attempts for', len({r['id'] for r in rows}), 'words')

# Generates recorded audio for every word/phrase in content/units.json with several Microsoft neural voices (edge-tts).
#   python -m pip install edge-tts
#   python tools/make_audio.py            # only creates missing files, so re-run after adding lessons
# Output: audio/<voice>/<id>.mp3 and audio/index.json  ({voices: [...], texts: {text: id}})
import asyncio, hashlib, json, os, re, sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICES = [  # (folder, edge voice, label shown in the app)
    ('xiaoxiao', 'zh-CN-XiaoxiaoNeural', 'Xiaoxiao (หญิง)'),
    ('yunxi', 'zh-CN-YunxiNeural', 'Yunxi (ชาย)'),
    ('xiaoyi', 'zh-CN-XiaoyiNeural', 'Xiaoyi (หญิง)'),
    ('yunyang', 'zh-CN-YunyangNeural', 'Yunyang (ชาย)'),
]
RATE = '-10%'  # a touch slower than news-reading speed


def speak_text(hz):  # must match speakText() in app.js
    return re.sub('[…]', '', hz).strip()


def texts():
    data = json.load(open(os.path.join(ROOT, 'content', 'units.json'), encoding='utf-8'))
    out = {speak_text(it['hanzi']) for it in data['items'].values() if it.get('hanzi')}
    for ts in data.get('toneSets', []):
        out |= {speak_text(h) for h in ts['hanzi']}
    nums = os.path.join(ROOT, 'content', 'numbers.json')
    if os.path.exists(nums):  # number drills: the answer itself and the sentences it is heard in
        for st in json.load(open(nums, encoding='utf-8'))['sets']:
            for g in st['groups']:
                for it in g:
                    out |= {speak_text(it['hanzi'])} | {speak_text(ln['hanzi']) for ln in it['lines']}
    return sorted(t for t in out if t)


async def main():
    ts = texts()
    ids = {t: hashlib.md5(t.encode('utf-8')).hexdigest()[:10] for t in ts}
    sem = asyncio.Semaphore(6)
    failed = []

    async def one(folder, voice, t):
        path = os.path.join(ROOT, 'audio', folder, ids[t] + '.mp3')
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return
        async with sem:
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(t, voice, rate=RATE).save(path)
                    return
                except Exception as e:  # network hiccups
                    err = e
                    await asyncio.sleep(1 + attempt * 2)
            failed.append((folder, t, str(err)))

    for folder, _, _ in VOICES:
        os.makedirs(os.path.join(ROOT, 'audio', folder), exist_ok=True)
    await asyncio.gather(*(one(f, v, t) for f, v, _ in VOICES for t in ts))
    index = {'voices': [{'id': f, 'label': l} for f, _, l in VOICES], 'texts': ids}
    json.dump(index, open(os.path.join(ROOT, 'audio', 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(ts)} texts x {len(VOICES)} voices, failed {len(failed)}')
    for f in failed[:10]:
        print('  ', f)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))

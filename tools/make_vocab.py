# Generates content/vocab.json (the after-trip "500 everyday words" mode) from tools/vocab_words.py.
#   python -m pip install pypinyin
#   python tools/make_vocab.py     then   python tools/make_audio.py
# Pinyin comes from pypinyin (with 不/一 tone changes, like the lessons); the Thai reading is built from the
# pinyin with the same spelling habits as content/units.json. A 5th field in vocab_words.py overrides the pinyin
# of an example when pypinyin picks the wrong reading of a character (长 cháng/zhǎng, 还 hái/huán …).
import json, os, re, sys, unicodedata

from pypinyin import lazy_pinyin, Style

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vocab_words import THEMES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKS = {'ā': ('a', 1), 'á': ('a', 2), 'ǎ': ('a', 3), 'à': ('a', 4), 'ē': ('e', 1), 'é': ('e', 2), 'ě': ('e', 3), 'è': ('e', 4),
         'ī': ('i', 1), 'í': ('i', 2), 'ǐ': ('i', 3), 'ì': ('i', 4), 'ō': ('o', 1), 'ó': ('o', 2), 'ǒ': ('o', 3), 'ò': ('o', 4),
         'ū': ('u', 1), 'ú': ('u', 2), 'ǔ': ('u', 3), 'ù': ('u', 4), 'ǖ': ('ü', 1), 'ǘ': ('ü', 2), 'ǚ': ('ü', 3), 'ǜ': ('ü', 4)}

# ---------------------------------------------------------------- pinyin → Thai reading
MID = {'b': 'ป', 'd': 'ต', 'g': 'ก', 'j': 'จ', 'zh': 'จ', 'z': 'จ', '': 'อ'}
PAIR = {'p': ('พ', 'ผ'), 't': ('ท', 'ถ'), 'k': ('ค', 'ข'), 'q': ('ช', 'ฉ'), 'ch': ('ช', 'ฉ'), 'c': ('ช', 'ฉ'),
        'x': ('ซ', 'ส'), 'sh': ('ซ', 'ส'), 's': ('ซ', 'ส'), 'f': ('ฟ', 'ฝ'), 'h': ('ฮ', 'ห')}
SON = {'m': 'ม', 'n': 'น', 'l': 'ล', 'r': 'ร', 'y': 'ย', 'w': 'ว'}


def thai_initial(ini, tone):
    """(consonant, tone mark) that give the Thai tone closest to the Mandarin one."""
    if ini in MID:
        return MID[ini], {1: '', 2: '๋', 3: '่', 4: '้', 5: ''}[tone]
    if ini in PAIR:
        low, high = PAIR[ini]
        return {1: (low, ''), 2: (high, ''), 3: (high, '่'), 4: (low, '่'), 5: (low, '')}[tone]
    c = SON[ini]
    return {1: (c, ''), 2: ('ห' + c, ''), 3: ('ห' + c, '่'), 4: (c, '่'), 5: (c, '')}[tone]


# final → template: C = consonant, M = tone mark
FINALS = {
    'a': 'CMา', 'o': 'โCM', 'e': 'เCMอ', 'i': 'CีM', '-i': 'CืMอ', 'u': 'CูM', 'ü': 'CวีM', 'ai': 'ไCM', 'ei': 'เCMย',
    'ao': 'เCMา', 'ou': 'โCMว', 'an': 'CMาน', 'en': 'เCิMน', 'ang': 'CMาง', 'eng': 'เCิMง', 'ong': 'CMง', 'er': 'เCMอร์',
    'ia': 'เCีMย', 'ie': 'เCีMย', 'iao': 'เCีMยว', 'iu': 'CิMว', 'ian': 'เCีMยน', 'in': 'CิMน', 'iang': 'เCีMยง', 'ing': 'CิMง',
    'iong': 'CMยง', 'ua': 'CวMา', 'uo': 'CัMว', 'uai': 'ไCวM', 'ui': 'CุMย', 'uan': 'CMวน', 'un': 'CุMน', 'uang': 'CวMาง',
    'üe': 'เCวีMย', 'üan': 'เCวีMยน', 'ün': 'CวิMน',
}
# whole syllables that don't follow initial + final
WHOLE = {
    'yi': ('', 'i'), 'ya': ('y', 'a'), 'ye': ('y', 'เCM'), 'yao': ('y', 'เCMา'), 'you': ('y', 'ou'), 'yan': ('y', 'ian'), 'yin': ('', 'in'),
    'yang': ('y', 'ang'), 'ying': ('', 'ing'), 'yong': ('y', 'ong'), 'yu': ('', 'ü'), 'yue': ('y', 'เCวีMย'), 'yuan': ('y', 'üan'), 'yun': ('y', 'ün'),
    'wu': ('', 'u'), 'wa': ('w', 'a'), 'wo': ('w', 'CMอ'), 'wai': ('w', 'ai'), 'wei': ('w', 'ei'), 'wan': ('w', 'an'), 'wen': ('w', 'en'),
    'wang': ('w', 'ang'), 'weng': ('w', 'eng'), 'hao': ('h', 'CMาว'), 'er': ('', 'er'),
    'ai': ('', 'CMาย'), 'guan': ('g', 'CวMาน'),  # not ไอ้ / กวน, which are Thai words of their own
}
PARTICLE = {'ma': 'มะ', 'ba': 'ปะ', 'ne': 'เนอะ', 'le': 'เลอ', 'de': 'เตอ', 'ge': 'เกอ', 'men': 'เมิน', 'zi': 'จือ', 'me': 'เมอ'}


def split_syl(s):
    tone, plain = 5, ''
    for ch in s:
        if ch in MARKS:
            plain += MARKS[ch][0]; tone = MARKS[ch][1]
        else:
            plain += ch
    return plain, tone


def thai_syl(s, tone=None):
    plain, t = split_syl(s.lower())
    tone = tone or t
    if tone == 5 and plain in PARTICLE:
        return PARTICLE[plain]
    if plain in WHOLE:
        ini, fin = WHOLE[plain]
    else:
        m = re.match(r'(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])?(.+)$', plain)
        ini, fin = m.group(1) or '', m.group(2)
        if ini in ('zh', 'ch', 'sh', 'r', 'z', 'c', 's') and fin == 'i':
            fin = '-i'
        if ini in ('j', 'q', 'x') and fin.startswith('u'):
            fin = 'ü' + fin[1:]
        fin = fin.replace('ue', 'üe') if fin == 'ue' else fin
    tpl = FINALS.get(fin, fin)
    if 'C' not in tpl:
        raise ValueError(f'no Thai spelling for the syllable "{s}" (final "{fin}")')
    c, mark = thai_initial(ini, tone)
    return tpl.replace('C', c).replace('M', mark)


SYL = re.compile(r"(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])|n(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])|r(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]))?", re.I)


def thai_reading(pinyin):
    """Thai reading of a pinyin phrase, word for word, with 3rd tone + 3rd tone said as 2nd + 3rd."""
    words = pinyin.split()
    syls = [SYL.findall(w) for w in words]
    flat = [s for w in syls for s in w]
    tones = [split_syl(s.lower())[1] for s in flat]
    spoken = [2 if t == 3 and i + 1 < len(tones) and tones[i + 1] == 3 else t for i, t in enumerate(tones)]
    out, k = [], 0
    for w in syls:
        out.append(''.join(thai_syl(s, spoken[k + i]) for i, s in enumerate(w)))
        k += len(w)
    return ' '.join(out)


# ---------------------------------------------------------------- pinyin of a phrase written as words
def pinyin_words(words):
    sent = ''.join(words)
    py = lazy_pinyin(sent, style=Style.TONE, tone_sandhi=False)
    assert len(py) == len(sent), (sent, py)
    # 不 / 一 are written with the tone they are said with (as in the lessons).
    tones = [split_syl(p)[1] for p in py]
    for i, ch in enumerate(sent):
        nxt = tones[i + 1] if i + 1 < len(sent) else None
        if ch == '不' and nxt == 4:
            py[i] = 'bú'
        if ch == '一' and nxt and not (i and sent[i - 1] in '第十期') and sent[i + 1] not in '一二三四五六七八九十零月号点':
            py[i] = 'yí' if nxt == 4 or sent[i + 1] == '个' else 'yì'
    out, k = [], 0
    for w in words:
        ss = py[k:k + len(w)]
        if w in NEUTRAL:
            ss[-1] = untone(ss[-1])
        out.append(join_syls(ss)); k += len(w)
    return ' '.join(out)


# Everyday words whose last syllable is said without a tone (pypinyin gives the dictionary tone).
NEUTRAL = set('''爸爸 妈妈 哥哥 姐姐 弟弟 妹妹 朋友 漂亮 喜欢 休息 告诉 明白 东西 衣服 时候 地方 意思 麻烦 学生 眼睛 耳朵 豆腐 钥匙 枕头
什么时候 有时候 早上 晚上 不好意思 师傅 行李 护士 咳嗽 厉害 消息 太阳 多少 打算 上面 下面 里面 外面 前面 后面 知道 认识 舒服 便宜 事情 窗户 暖和 凉快 奇怪 清楚 谢谢 月亮'''.split())


def untone(s):
    return ''.join(MARKS[c][0] if c in MARKS else c for c in s)


def join_syls(syls):  # kě + ài → kě'ài, so the syllables can be told apart again
    out = syls[0]
    for x in syls[1:]:
        out += ("'" if split_syl(x)[0][0] in 'aoe' else '') + x
    return out


def build():
    course = json.load(open(os.path.join(ROOT, 'content', 'units.json'), encoding='utf-8'))['items']
    known = {re.sub('[…]', '', it['hanzi']) for it in course.values()}
    seen, themes, dup = set(), [], []
    for tid, icon, title, block in THEMES:
        words = []
        for ln in block.strip().splitlines():
            f = [x.strip() for x in ln.split('|')]
            assert len(f) in (4, 5), ln
            hz, meaning, ex, exm = f[:4]
            if hz in known or hz in seen:
                dup.append(hz); continue
            seen.add(hz)
            exw = ex.split()
            assert hz in ''.join(exw), f'the example of {hz} does not use it: {ex}'
            expy = f[4] if len(f) == 5 else pinyin_words(exw)
            assert len(expy.split()) == len(exw), (ex, expy)
            assert len(SYL.findall(expy)) == len(''.join(exw)), f'pinyin does not match the characters: {ex} / {expy}'
            # the word's own pinyin: as it is read inside its example, so both always agree
            flat_hz, flat_py = ''.join(exw), SYL.findall(expy)
            i = flat_hz.index(hz)
            py = join_syls(flat_py[i:i + len(hz)]).lower()
            if hz == '一半':
                py = 'yíbàn'
            words.append({'hanzi': hz, 'pinyin': py, 'thai': thai_reading(py), 'meaning': meaning,
                          'ex': {'hanzi': ''.join(exw), 'pinyin': expy, 'thai': thai_reading(expy), 'meaning': exm}})
        themes.append({'id': tid, 'icon': icon, 'title': title, 'words': words})
    return themes, dup


if __name__ == '__main__':
    themes, dup = build()
    p = os.path.join(ROOT, 'content', 'vocab.json')
    with open(p, 'w', encoding='utf-8') as f:  # one word per line keeps diffs readable
        f.write('{"themes": [\n')
        for i, th in enumerate(themes):
            head = {k: v for k, v in th.items() if k != 'words'}
            f.write(' ' + json.dumps(head, ensure_ascii=False)[:-1] + ', "words": [\n')
            f.write(',\n'.join('  ' + json.dumps(w, ensure_ascii=False) for w in th['words']) + '\n')
            f.write(' ]}' + (',' if i < len(themes) - 1 else '') + '\n')
        f.write(']}\n')
    json.load(open(p, encoding='utf-8'))
    n = sum(len(t['words']) for t in themes)
    print(f'{len(themes)} themes, {n} words' + (f' · left out (already known / repeated): {" ".join(dup)}' if dup else ''))
    for t in themes:
        print(f"  {t['id']}: {len(t['words'])}")

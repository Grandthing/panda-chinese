# Generates the "numbers in real situations" drills into content/numbers.json.
#   python tools/make_numbers.py      then   python tools/make_audio.py   (records the new lines)
# Each group holds numbers that sound alike (14 / 40 / 44 / 4), so the four choices are a real listening test.
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DIG = '零一二三四五六七八九'
PY = ['líng', 'yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ']
TH = ['หลิง', 'อี', 'เอ้อร์', 'ซาน', 'ซื่อ', 'อู่', 'ลิ่ว', 'ชี', 'ปา', 'จิ่ว']
YI_BEFORE = {1: ('yì', 'อี้'), 2: ('yì', 'อี้'), 3: ('yì', 'อี้'), 4: ('yí', 'อี๋')}  # 一 tone sandhi


def tens(n, sandhi_next=None):
    """1..99 -> (hanzi, pinyin word, thai word). sandhi_next = tone of the following syllable for a lone 一."""
    if n < 10:
        if n == 1 and sandhi_next:
            return '一', *YI_BEFORE[sandhi_next]
        return DIG[n], PY[n], TH[n]
    t, u = divmod(n, 10)
    hz = ('' if t == 1 else DIG[t]) + '十' + (DIG[u] if u else '')
    py = ('' if t == 1 else PY[t]) + 'shí' + (("'" if PY[u][0] in 'aeoāáǎàēéěèōóǒò' else '') + PY[u] if u else '')  # shí'èr
    th = ('' if t == 1 else TH[t]) + 'สือ' + (TH[u] if u else '')
    return hz, py, th


def number(n, next_tone=None):
    """Counting reading as words: 120 -> 一百 二十, 102 -> 一百 零 二. 2 alone / 200 use 两."""
    words = []
    h, rest = divmod(n, 100)
    if h:
        if h == 1:
            words.append(('一百', 'yìbǎi', 'อี้ป่าย'))
        elif h == 2:
            words.append(('两百', 'liǎngbǎi', 'เหลียงป่าย'))
        else:
            words.append((DIG[h] + '百', PY[h] + 'bǎi', TH[h] + 'ป่าย'))
        if 0 < rest < 10:
            words.append(('零', 'líng', 'หลิง'))
        if 10 <= rest < 20:  # 一百一十
            hz, py, th = tens(rest)
            words.append(('一' + hz, 'yī' + py, 'อี' + th))
            rest = 0
    if rest:
        words.append(tens(rest, next_tone))
    return words


def digits(s):  # room numbers: read digit by digit, 1 = yāo (written 幺 so the recorded voice says yāo)
    return [('幺' if c == '1' else DIG[int(c)], 'yāo' if c == '1' else PY[int(c)], 'เยา' if c == '1' else TH[int(c)]) for c in s]


def item(words, label, meaning, carriers, accept=None):
    hz = ''.join(w[0] for w in words)
    it = {'hanzi': hz, 'pinyin': ' '.join(w[1] for w in words), 'thai': ' '.join(w[2] for w in words), 'label': label, 'meaning': meaning}
    if accept:
        it['accept'] = accept
    it['lines'] = [{'hanzi': c[0].format(hz), 'pinyin': c[1].format(it['pinyin']), 'thai': c[2].format(it['thai']), 'meaning': c[3].format(meaning)} for c in carriers]
    return it


def price(v):
    if isinstance(v, float):  # 9.5 -> 九块五
        y, j = int(v), round((v - int(v)) * 10)
        return number(y, 4) + [('块', 'kuài', 'ไคว่'), (DIG[j], PY[j], TH[j])], f'¥{v}', f'{y} หยวน {j * 10} เฟิน ({v} หยวน)'
    w = number(v, 4)
    if v == 2:
        w = [('两', 'liǎng', 'เหลียง')]
    return w + [('块', 'kuài', 'ไคว่')], f'¥{v}', f'{v} หยวน'


PRICE_C = [('一共{}。', 'yígòng {}', 'อี๋ก้ง {}', 'ทั้งหมด {}'), ('这个{}。', 'zhège {}', 'เจ้อเก้อ {}', 'อันนี้ {}')]
TIME_C = [('我们{}见。', 'wǒmen {} jiàn', 'หว่อเมิน {} เจี้ยน', 'เจอกันตอน {}'), ('火车{}开。', 'huǒchē {} kāi', 'หั่วเชอ {} ไค', 'รถไฟออกตอน {}')]
LINE_C = [('坐{}。', 'zuò {}', 'จั้ว {}', 'นั่ง {}'), ('你坐{}吧。', 'nǐ zuò {} ba', 'หนี่ จั้ว {} ปา', 'คุณนั่ง {} นะ')]
ROOM_C = [('您的房间是{}。', 'nín de fángjiān shì {}', 'หนิน เตอ ฟางเจียน ซื่อ {}', 'ห้องของคุณคือ {}')]
FLOOR_C = [('早餐在{}。', 'zǎocān zài {}', 'จ่าวชาน ไจ้ {}', 'อาหารเช้าอยู่ {}'), ('您的房间在{}。', 'nín de fángjiān zài {}', 'หนิน เตอ ฟางเจียน ไจ้ {}', 'ห้องของคุณอยู่ {}')]
QUEUE_C = [('{}，您的餐好了。', '{}, nín de cān hǎo le', '{} หนิน เตอ ชาน ห่าว เลอ', '{} อาหารของคุณได้แล้ว')]


def clock(h, half=False, part=None):
    w = [('两', 'liǎng', 'เหลียง')] if h == 2 else ([('一', 'yī', 'อี')] if h == 1 else number(h))
    w = w + [('点', 'diǎn', 'เตี่ยน')] + ([('半', 'bàn', 'ปั้น')] if half else [])
    parts = {'下午': ('xiàwǔ', 'เซี่ยอู่', 'บ่าย', 12), '晚上': ('wǎnshang', 'หว่านซาง', 'กลางคืน', 12), '上午': ('shàngwǔ', 'ซ่างอู่', 'เช้า', 0)}
    hh = h
    if part:
        p = parts[part]
        w = [(part, p[0], p[1])] + w
        hh = h + p[3]
    label = f'{hh}:{"30" if half else "00"}'
    return w, label, f'{label} น.'


def build():
    sets = []
    groups = [[price(v) for v in g] for g in [[4, 10, 14, 40], [38, 48, 83, 18], [15, 50, 55, 5], [27, 72, 17, 70], [120, 200, 220, 102], [9.5, 5.9, 95, 59]]]
    sets.append({'id': 'price', 'icon': '💰', 'title': 'ราคา (ตลาด / ร้านค้า)', 'ask': 'แม่ค้าบอกราคาเท่าไหร่?',
                 'groups': [[item(w, l, m, PRICE_C) for w, l, m in g] for g in groups]})
    tg = [[(1,), (7,), (10,), (11,)], [(2, True), (2,), (8, True), (3, True)], [(4,), (10, True), (9,), (6,)],
          [(3, False, '下午'), (4, False, '下午'), (8, False, '晚上'), (10, False, '上午')]]
    sets.append({'id': 'time', 'icon': '⏰', 'title': 'เวลานัด / รถออก', 'ask': 'กี่โมง?',
                 'groups': [[item(*clock(*a), TIME_C) for a in g] for g in tg]})
    ordinal = lambda n: [('一', 'yī', 'อี')] if n == 1 else number(n)  # 一 keeps tone 1 in line/bus numbers
    metro = lambda n: (ordinal(n) + [('号线', 'hàoxiàn', 'เฮ่าเซี่ยน')], f'สาย {n}', f'รถไฟใต้ดินสาย {n}')
    bus = lambda n: (ordinal(n) + [('路', 'lù', 'ลู่')], f'สาย {n}', f'รถเมล์สาย {n}')
    sets.append({'id': 'line', 'icon': '🚇', 'title': 'รถไฟใต้ดิน & รถเมล์', 'ask': 'ให้นั่งสายไหน?',
                 'groups': [[item(*metro(n), LINE_C) for n in [1, 7, 4, 10]], [item(*metro(n), LINE_C) for n in [2, 3, 8, 6]],
                            [item(*bus(n), LINE_C) for n in [14, 40, 44, 4]], [item(*bus(n), LINE_C) for n in [17, 70, 71, 1]]]})
    room = lambda s: item(digits(s), f'ห้อง {s}', f'ห้อง {s}', ROOM_C, [''.join(DIG[int(c)] for c in s)] if '1' in s else None)
    floor = lambda n: item(number(n) + [('楼', 'lóu', 'โหลว')], f'ชั้น {n}', f'ชั้น {n}', FLOOR_C)
    sets.append({'id': 'hotel', 'icon': '🏨', 'title': 'โรงแรม: เลขห้อง & ชั้น', 'ask': 'ห้อง / ชั้นไหน?',
                 'groups': [[room(s) for s in ['308', '380', '803', '306']], [room(s) for s in ['1205', '1502', '2105', '1209']],
                            [floor(n) for n in [4, 10, 14, 7]]]})
    q = lambda n: item(number(n) + [('号', 'hào', 'เฮ่า')], f'คิว {n}', f'คิวที่ {n}', QUEUE_C)
    sets.append({'id': 'queue', 'icon': '🍜', 'title': 'ร้านอาหาร: เรียกคิว', 'ask': 'เรียกคิวเบอร์อะไร?',
                 'groups': [[q(n) for n in [16, 60, 66, 10]], [q(n) for n in [89, 98, 19, 80]]]})
    return sets


if __name__ == '__main__':
    sets = build()
    p = os.path.join(ROOT, 'content', 'numbers.json')
    with open(p, 'w', encoding='utf-8') as f:  # one number per line keeps diffs readable
        f.write('{"sets": [\n')
        for i, st in enumerate(sets):
            head = {k: v for k, v in st.items() if k != 'groups'}
            f.write(' ' + json.dumps(head, ensure_ascii=False)[:-1] + ', "groups": [\n')
            for j, g in enumerate(st['groups']):
                f.write('  [\n' + ',\n'.join('   ' + json.dumps(it, ensure_ascii=False) for it in g) + '\n  ]' + (',' if j < len(st['groups']) - 1 else '') + '\n')
            f.write(' ]}' + (',' if i < len(sets) - 1 else '') + '\n')
        f.write(']}\n')
    json.load(open(p, encoding='utf-8'))
    print(f'{len(sets)} sets, {sum(len(g) for s in sets for g in s["groups"])} numbers')

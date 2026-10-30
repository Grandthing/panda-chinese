# Generates content/sentences.json: longer shop / food / snack sentences built only from lesson words.
#   python tools/make_sentences.py      then   python tools/make_audio.py
# A sentence is a list of tokens: a lesson item id (its hanzi/pinyin/thai are reused, and it becomes a word
# the learner must have learned), a glue word from GLUE, or punctuation. The app unlocks a sentence once
# every item in `needs` has been met in a lesson.
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GLUE = {  # hanzi: (pinyin, thai, item it comes from in the lessons, if any)
    '吗': ('ma', 'มะ', None), '的': ('de', 'เตอ', None), '和': ('hé', 'เหอ', None), '很': ('hěn', 'เหิ่น', None),
    '太': ('tài', 'ไท่', None), '了': ('le', 'เลอ', None), '用': ('yòng', 'ย่ง', 'yongxianjin'), '袋子': ('dàizi', 'ไต้จือ', 'l_yaodaizima'),
    '面': ('miàn', 'เมี่ยน', 'miantiao'), '一个': ('yí ge', 'อี๋ เก้อ', None), '两个': ('liǎng ge', 'เหลี่ยง เก้อ', 'liang3'),
    '三个': ('sān ge', 'ซาน เก้อ', 'san1'), '一杯': ('yì bēi', 'อี้ เปย', None), '两杯': ('liǎng bēi', 'เหลี่ยง เปย', 'liang3'),
}
PUNCT = {',': ('，', ','), '?': ('？', '?'), '.': ('。', '.'), '!': ('！', '!')}

SETS = [
    ('shop', '🛍️', 'ซื้อของ & จ่ายเงิน', [
        (['nihao', ',', 'woyaozhege', ',', 'xiexie', '.'], 'สวัสดี ฉันเอาอันนี้ ขอบคุณ'),
        (['wo3', 'yao4', 'zhege', '和', 'nage', '.'], 'ฉันเอาอันนี้กับอันนั้น'),
        (['wo3', 'buyao', 'zhege', ',', 'wo3', 'yao4', 'nage', '.'], 'ฉันไม่เอาอันนี้ ฉันเอาอันนั้น'),
        (['duibuqi', ',', 'wotingbudong', ',', 'zaishuoyibian', '.'], 'ขอโทษ ฉันฟังไม่เข้าใจ ช่วยพูดอีกครั้ง'),
        (['l_yaojige', '?', 'wo3', 'yao4', '三个', '.'], 'เอากี่อัน? ฉันเอาสามอัน'),
        (['wo3', 'yao4', '两个', ',', 'xiexie', '.'], 'ฉันเอาสองอัน ขอบคุณ'),
        (['nihao', ',', 'woyaomai', '.'], 'สวัสดี ฉันจะซื้ออันนี้'),
        (['qingwen', ',', 'zhegeduoshaoqian', '?'], 'ขอถามหน่อย อันนี้เท่าไหร่'),
        (['nage', 'jikuai', '?'], 'อันนั้นกี่หยวน'),
        (['wo3', 'yao4', '两个', ',', 'yigong', '?'], 'ฉันเอาสองอัน ทั้งหมดเท่าไหร่'),
        (['liangbai', 'kuai', '?', 'taiguile', '!'], 'สองร้อยหยวน? แพงไป!'),
        (['taiguile', ',', 'keyipianyima', '?'], 'แพงไป ลดได้ไหม'),
        (['yibai', 'kuai', ',', 'l_keyi', '吗', '?'], 'ร้อยหยวน ได้ไหม'),
        (['wushikuai', ',', 'xing2', '吗', '?'], 'ห้าสิบหยวน โอเคไหม'),
        (['haode', ',', 'wo3', 'yao4', 'nage', '.'], 'ตกลง ฉันเอาอันนั้น'),
        (['buyaole', ',', 'xiexie', '.'], 'ไม่เอาแล้ว ขอบคุณ'),
        (['wo3', 'meiyou', 'xianjin', ',', 'l_keyi', 'saoma', '吗', '?'], 'ฉันไม่มีเงินสด สแกนจ่ายได้ไหม'),
        (['wo3', '用', 'weixin', ',', 'l_keyi', '吗', '?'], 'ฉันใช้วีแชท ได้ไหม'),
        (['buyao', '袋子', ',', 'xiexie', '.'], 'ไม่เอาถุง ขอบคุณ'),
    ]),
    ('food', '🍜', 'สั่งอาหาร', [
        (['nihao', ',', 'liangwei', '.'], 'สวัสดี สองท่าน'),
        (['fuwuyuan', ',', 'you3', 'caidan', '吗', '?'], 'พนักงาน มีเมนูไหม'),
        (['wo3', 'yao4', '一个', 'niurou', '面', '.'], 'ฉันเอาบะหมี่เนื้อหนึ่งที่'),
        (['wo3', 'yao4', 'mifan', '和', 'jirou', '.'], 'ฉันเอาข้าวสวยกับไก่'),
        (['buyaola', ',', 'buyaoxiangcai', '.'], 'ไม่เอาเผ็ด ไม่เอาผักชี'),
        (['weila', ',', 'l_keyi', '吗', '?'], 'เผ็ดน้อย ได้ไหม'),
        (['woguomin', ',', 'buyaoxiangcai', '.'], 'ฉันแพ้ ไม่เอาผักชี'),
        (['wobuchirou', ',', 'you3', 'meiyou', 'miantiao', '?'], 'ฉันไม่กินเนื้อสัตว์ มีบะหมี่ไหม'),
        (['zailaiyige', ',', '很', 'haochi', '!'], 'ขอเพิ่มอีกหนึ่ง อร่อยมาก!'),
        (['很', 'haochi', ',', 'xiexie', '!'], 'อร่อยมาก ขอบคุณ!'),
        (['zhege', 'dabao', ',', 'xiexie', '.'], 'อันนี้ห่อกลับ ขอบคุณ'),
        (['fuwuyuan', ',', 'maidan', '.'], 'พนักงาน เช็คบิล'),
        (['yigong', '?', 'l_keyi', 'saoma', '吗', '?'], 'ทั้งหมดเท่าไหร่? สแกนจ่ายได้ไหม'),
        (['tailale', ',', 'wo3', 'yao4', 'shui3', '.'], 'เผ็ดเกินไป ฉันขอน้ำ'),
        (['wo3', 'yao4', 'yuanyangguo', ',', 'buyaotaima', '.'], 'ฉันเอาหม้อไฟสองช่อง ไม่เอาชามาก'),
        (['wo3', 'yao4', '一个', 'dandanmian', ',', 'weila', '.'], 'ฉันเอาบะหมี่ตั้นตั้นหนึ่งที่ เผ็ดน้อย'),
    ]),
    ('snack', '🧋', 'ขนม & เครื่องดื่ม', [
        (['nihao', ',', 'wo3', 'yao4', 'zhege', '和', 'nage', ',', 'xiexie', '!'], 'สวัสดี ฉันเอาอันนี้กับอันนั้น ขอบคุณ!'),
        (['zhegeduoshaoqian', '?', 'wo3', 'yao4', '三个', '.'], 'อันนี้เท่าไหร่? ฉันเอาสามอัน'),
        (['zhege', 'haochi', '吗', '?', 'wo3', 'yao4', '两个', '.'], 'อันนี้อร่อยไหม? ฉันเอาสองอัน'),
        (['zhege', 'tian2', '吗', '?'], 'อันนี้หวานไหม'),
        (['nage', '太', 'tian2', '了', ',', 'woyaozhege', '.'], 'อันนั้นหวานเกินไป ฉันเอาอันนี้'),
        (['zhege', 'suan1', '吗', '?', 'wo3', 'buyao', 'suan1', '的', '.'], 'อันนี้เปรี้ยวไหม? ฉันไม่เอาแบบเปรี้ยว'),
        (['woyaozhege', ',', 'dabao', '.'], 'ฉันเอาอันนี้ ห่อกลับ'),
        (['wo3', 'yao4', '一杯', 'naicha', ',', 'shaotang', '.'], 'ฉันเอาชานมหนึ่งแก้ว หวานน้อย'),
        (['dabei', ',', 'qubing', ',', 'xiexie', '.'], 'แก้วใหญ่ ไม่ใส่น้ำแข็ง ขอบคุณ'),
        (['wo3', 'yao4', 'rede', 'kafei', '.'], 'ฉันเอากาแฟร้อน'),
        (['两杯', 'naicha', ',', '一杯', 'shaotang', '.'], 'ชานมสองแก้ว หวานน้อยหนึ่งแก้ว'),
        (['buyao', '太', 'tian2', ',', 'shaotang', '.'], 'ไม่เอาหวานมาก หวานน้อย'),
        (['you3', 'meiyou', 'kafei', '?'], 'มีกาแฟไหม'),
        (['qingwen', ',', 'bianlidian', 'zainali', '?'], 'ขอถามหน่อย ร้านสะดวกซื้ออยู่ที่ไหน'),
    ]),
]


def build():
    items = json.load(open(os.path.join(ROOT, 'content', 'units.json'), encoding='utf-8'))['items']
    out = []
    for sid, icon, title, rows in SETS:
        sents = []
        for toks, meaning in rows:
            hz, py, th, needs = [], [], [], []
            for t in toks:
                if t in PUNCT:
                    hz.append(PUNCT[t][0])
                    if py:
                        py[-1] += PUNCT[t][1]
                        if t in ',?':  # keep the phrase breaks readable in the Thai line too
                            th[-1] += PUNCT[t][1]
                    continue
                if t in GLUE:
                    p, tt, need = GLUE[t]
                    w = (t, p, tt)
                else:
                    it = items[t]  # KeyError = typo in an item id
                    w, need = (it['hanzi'].replace('…', ''), it['pinyin'].replace(' …', ''), it['thai'].replace(' …', '')), t
                hz.append(w[0]); py.append(w[1]); th.append(w[2])
                if need and need not in needs:
                    needs.append(need)
            sents.append({'hanzi': ''.join(hz), 'pinyin': ' '.join(py), 'thai': ' '.join(th), 'meaning': meaning, 'needs': needs})
        out.append({'id': sid, 'icon': icon, 'title': title, 'sentences': sents})
    return out


if __name__ == '__main__':
    sets = build()
    p = os.path.join(ROOT, 'content', 'sentences.json')
    with open(p, 'w', encoding='utf-8') as f:  # one sentence per line keeps diffs readable
        f.write('{"sets": [\n')
        for i, st in enumerate(sets):
            head = {k: v for k, v in st.items() if k != 'sentences'}
            f.write(' ' + json.dumps(head, ensure_ascii=False)[:-1] + ', "sentences": [\n')
            f.write(',\n'.join('  ' + json.dumps(s, ensure_ascii=False) for s in st['sentences']) + '\n')
            f.write(' ]}' + (',' if i < len(sets) - 1 else '') + '\n')
        f.write(']}\n')
    json.load(open(p, encoding='utf-8'))
    print(f'{len(sets)} sets, {sum(len(s["sentences"]) for s in sets)} sentences')

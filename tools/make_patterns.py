# Generates content/patterns.json: the drills that turn memorised phrases into speaking.
#   python tools/make_patterns.py   then   python tools/make_glossary.py   and   python tools/make_audio.py
#
#   patterns  a sentence frame + words to swap in (我要 + ของ). The learner sees only the Thai and says it.
#   scenes    a situation with no choices: several answers are right (去机场 / 我要去机场 / 机场).
#   replies   what locals answer back to one question, to be recognised by ear (new words allowed).
#   sounds    look-alike sounds heard side by side (q/x/j, zh/z, -n/-ng …).
#
# Sentences for the learner to SAY are token lists like tools/make_sentences.py: a lesson item id (it becomes a
# word the learner must have met: `needs`), a glue word from GLUE, or punctuation. Lines the learner only HEARS
# (replies, and what a local says in a scene) may be written out in full: (hanzi, pinyin, thai, meaning).
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GLUE = {  # hanzi: (pinyin, thai, lesson item it comes from, if any)
    '吗': ('ma', 'มะ', None), '的': ('de', 'เตอ', None), '和': ('hé', 'เหอ', None), '很': ('hěn', 'เหิ่น', None),
    '太': ('tài', 'ไท่', 'taiguile'), '了': ('le', 'เลอ', None), '用': ('yòng', 'ย่ง', 'yongxianjin'),
    '袋子': ('dàizi', 'ไต้จือ', 'l_yaodaizima'), '面': ('miàn', 'เมี่ยน', 'miantiao'), '去': ('qù', 'ชวี่', 'woyaoqu'),
    '请': ('qǐng', 'ฉิ่ง', 'qingwen'), '人': ('rén', 'เหริน', 'taiguoren'), '泰国人': ('Tàiguó rén', 'ไท่กั๋ว เหริน', 'taiguoren'),
    '一个': ('yí ge', 'อี๋ เก้อ', 'zailaiyige'), '两个': ('liǎng ge', 'เหลี่ยง เก้อ', 'liang3'), '三个': ('sān ge', 'ซาน เก้อ', 'san1'),
    '五个': ('wǔ ge', 'อู่ เก้อ', 'wu3'), '一张': ('yì zhāng', 'อี้ จาง', 'yizhangpiao'), '两张': ('liǎng zhāng', 'เหลี่ยง จาง', 'yizhangpiao'),
    '三张': ('sān zhāng', 'ซาน จาง', 'yizhangpiao'), '一杯': ('yì bēi', 'อี้ เปย', 'dabei'), '两杯': ('liǎng bēi', 'เหลี่ยง เปย', 'dabei'),
    '我的': ('wǒ de', 'หว่อ เตอ', 'huzhaodiule'), '丢了': ('diū le', 'ติว เลอ', 'huzhaodiule'), '坏了': ('huài le', 'ไฮว่ เลอ', 'kongtiaohuaile'),
    '手机': ('shǒujī', 'โส่วจี', 'shoujimeidianle'), '远': ('yuǎn', 'เหยวี่ยน', 'yuanma'), '大': ('dà', 'ต้า', 'dayidian'), '小': ('xiǎo', 'เสี่ยว', 'xiaoyidian'),
    '带走': ('dàizǒu', 'ไต้โจ่ว', 'l_zhebianchi'), '拍照': ('pāizhào', 'พายจ้าว', 'keyipaizhao'), '吃': ('chī', 'ชือ', 'wobuchirou'),
}
PUNCT = {',': ('，', ','), '?': ('？', '?'), '.': ('。', '.'), '!': ('！', '!')}

PATTERNS = [
    ('yao', '🙋', 'ขอ / เอา…', '我要 + ของ', 'wǒ yào + …', 'อยากได้อะไร ให้พูด 我要 แล้วตามด้วยของสิ่งนั้น', [
        (['wo3', 'yao4', 'shui3', '.'], 'ฉันเอาน้ำ'),
        (['wo3', 'yao4', 'mifan', '.'], 'ฉันเอาข้าวสวย'),
        (['wo3', 'yao4', 'pijiu', '.'], 'ฉันเอาเบียร์'),
        (['wo3', 'yao4', 'caidan', '.'], 'ฉันขอเมนู'),
        (['wo3', 'yao4', 'niurou', '面', '.'], 'ฉันเอาบะหมี่เนื้อ'),
        (['wo3', 'yao4', 'fapiao', '.'], 'ฉันขอใบเสร็จ'),
        (['wo3', 'yao4', 'reshui', '.'], 'ฉันขอน้ำร้อน'),
        (['wo3', 'yao4', 'yizhangpiao', '.'], 'ฉันเอาตั๋วหนึ่งใบ'),
        (['wo3', 'yao4', 'naicha', '.'], 'ฉันเอาชานม'),
        (['wo3', 'yao4', 'kafei', '.'], 'ฉันเอากาแฟ'),
    ]),
    ('buyao', '🙅', 'ไม่เอา…', '不要 + ของ', 'bú yào + …', 'ไม่เอาอะไร ให้พูด 不要 แล้วตามด้วยของสิ่งนั้น', [
        (['buyao', '袋子', '.'], 'ไม่เอาถุง'),
        (['buyao', 'zhurou', '.'], 'ไม่เอาเนื้อหมู'),
        (['buyao', 'niurou', '.'], 'ไม่เอาเนื้อวัว'),
        (['buyao', 'pijiu', '.'], 'ไม่เอาเบียร์'),
        (['buyao', 'fapiao', '.'], 'ไม่เอาใบเสร็จ'),
        (['wo3', 'buyao', 'nage', '.'], 'ฉันไม่เอาอันนั้น'),
        (['buyao', '太', 'la4', '.'], 'ไม่เอาเผ็ดมาก'),
        (['buyao', '太', 'tian2', '.'], 'ไม่เอาหวานมาก'),
    ]),
    ('count', '🔢', 'เอากี่อัน กี่ใบ', '我要 + จำนวน + ของ', 'wǒ yào + …', 'จำนวนมาก่อนของเสมอ · ของทั่วไปใช้ 个 · ตั๋วใช้ 张 · แก้วใช้ 杯 · สองชิ้นใช้ 两 ไม่ใช่ 二', [
        (['wo3', 'yao4', '一个', '.'], 'ฉันเอาหนึ่งอัน'),
        (['wo3', 'yao4', '两个', '.'], 'ฉันเอาสองอัน'),
        (['wo3', 'yao4', '三个', '.'], 'ฉันเอาสามอัน'),
        (['wo3', 'yao4', '五个', '.'], 'ฉันเอาห้าอัน'),
        (['wo3', 'yao4', '两个', 'mifan', '.'], 'ฉันเอาข้าวสวยสองที่'),
        (['wo3', 'yao4', '两张', 'piao4', '.'], 'ฉันเอาตั๋วสองใบ'),
        (['wo3', 'yao4', '三张', 'menpiao', '.'], 'ฉันเอาตั๋วเข้าชมสามใบ'),
        (['wo3', 'yao4', '两杯', 'naicha', '.'], 'ฉันเอาชานมสองแก้ว'),
    ]),
    ('price', '💰', '…เท่าไหร่', 'ของ + 多少钱', '… + duōshao qián', 'ถามราคาอะไร ให้พูดชื่อของก่อน แล้วตามด้วย 多少钱', [
        (['nage', 'duoshaoqian', '?'], 'อันนั้นเท่าไหร่'),
        (['yizhangpiao', 'duoshaoqian', '?'], 'ตั๋วหนึ่งใบเท่าไหร่'),
        (['menpiao', 'duoshaoqian', '?'], 'ตั๋วเข้าชมเท่าไหร่'),
        (['pijiu', 'duoshaoqian', '?'], 'เบียร์เท่าไหร่'),
        (['fangjian', 'duoshaoqian', '?'], 'ห้องพักเท่าไหร่'),
        (['两个', 'duoshaoqian', '?'], 'สองอันเท่าไหร่'),
        (['去', 'jichang', 'duoshaoqian', '?'], 'ไปสนามบินเท่าไหร่'),
        (['去', 'jiudian', 'duoshaoqian', '?'], 'ไปโรงแรมเท่าไหร่'),
    ]),
    ('tai', '😖', '…เกินไป', '太 + ลักษณะ + 了', 'tài + … + le', 'บ่นว่าอะไรเกินไป ให้เอาคำบอกลักษณะไว้ระหว่าง 太 กับ 了', [
        (['太', 'tian2', '了', '.'], 'หวานเกินไป'),
        (['太', 'suan1', '了', '.'], 'เปรี้ยวเกินไป'),
        (['太', '远', '了', '.'], 'ไกลเกินไป'),
        (['太', '大', '了', '.'], 'ใหญ่เกินไป'),
        (['太', '小', '了', '.'], 'เล็กเกินไป'),
        (['太', 'ma2', '了', '.'], 'ชาลิ้นเกินไป'),
    ]),
    ('keyi', '🙏', '…ได้ไหม', '可以 + ทำอะไร + 吗', 'kěyǐ + … + ma', 'ขออนุญาตหรือถามว่าทำได้ไหม ให้เอาสิ่งที่จะทำไว้ระหว่าง 可以 กับ 吗', [
        (['l_keyi', 'saoma', '吗', '?'], 'สแกนจ่ายได้ไหม'),
        (['l_keyi', 'dabao', '吗', '?'], 'ห่อกลับได้ไหม'),
        (['l_keyi', '用', 'weixin', '吗', '?'], 'ใช้วีแชทได้ไหม'),
        (['l_keyi', '用', 'zhifubao', '吗', '?'], 'ใช้อาลีเพย์ได้ไหม'),
        (['l_keyi', 'kuaiyidian', '吗', '?'], 'เร็วหน่อยได้ไหม'),
        (['l_keyi', 'manyidian', '吗', '?'], 'ช้าหน่อยได้ไหม'),
        (['l_keyi', 'tingzheli', '吗', '?'], 'จอดตรงนี้ได้ไหม'),
        (['l_keyi', 'ruzhu', '吗', '?'], 'เช็คอินได้ไหม'),
    ]),
    ('where', '🧭', '…อยู่ที่ไหน', 'สถานที่ + 在哪里', '… + zài nǎlǐ', 'ถามทางไปไหน ให้พูดชื่อสถานที่ก่อน แล้วตามด้วย 在哪里', [
        (['ditiezhan', 'zainali', '?'], 'สถานีรถไฟใต้ดินอยู่ที่ไหน'),
        (['chukou', 'zainali', '?'], 'ทางออกอยู่ที่ไหน'),
        (['cesuo', 'zainali', '?'], 'ห้องน้ำอยู่ที่ไหน'),
        (['yaodian', 'zainali', '?'], 'ร้านขายยาอยู่ที่ไหน'),
        (['yiyuan', 'zainali', '?'], 'โรงพยาบาลอยู่ที่ไหน'),
        (['huochezhan', 'zainali', '?'], 'สถานีรถไฟอยู่ที่ไหน'),
        (['rukou', 'zainali', '?'], 'ทางเข้าอยู่ที่ไหน'),
        (['我的', 'fangjian', 'zainali', '?'], 'ห้องของฉันอยู่ที่ไหน'),
        (['qingwen', ',', 'jiudian', 'zainali', '?'], 'ขอถามหน่อย โรงแรมอยู่ที่ไหน'),
    ]),
    ('nearby', '📍', 'แถวนี้มี…ไหม', '附近有 + สถานที่ + 吗', 'fùjìn yǒu + … + ma', 'หาสถานที่ใกล้ ๆ ให้เอาชื่อสถานที่ไว้ระหว่าง 附近有 กับ 吗', [
        (['fujin', 'you3', 'ditiezhan', '吗', '?'], 'แถวนี้มีสถานีรถไฟใต้ดินไหม'),
        (['fujin', 'you3', 'cesuo', '吗', '?'], 'แถวนี้มีห้องน้ำไหม'),
        (['fujin', 'you3', 'yaodian', '吗', '?'], 'แถวนี้มีร้านขายยาไหม'),
        (['fujin', 'you3', 'yiyuan', '吗', '?'], 'แถวนี้มีโรงพยาบาลไหม'),
        (['fujin', 'you3', 'jiudian', '吗', '?'], 'แถวนี้มีโรงแรมไหม'),
        (['fujin', 'you3', 'bianlidian', '吗', '?'], 'แถวนี้มีร้านสะดวกซื้อไหม'),
    ]),
    ('have', '❓', 'มี…ไหม', '有没有 + ของ', 'yǒu méiyǒu + …', 'ถามว่าร้านมีของไหม ให้พูด 有没有 แล้วตามด้วยของสิ่งนั้น', [
        (['you3', 'meiyou', 'shui3', '?'], 'มีน้ำไหม'),
        (['you3', 'meiyou', 'caidan', '?'], 'มีเมนูไหม'),
        (['you3', 'meiyou', 'pijiu', '?'], 'มีเบียร์ไหม'),
        (['you3', 'meiyou', 'mifan', '?'], 'มีข้าวสวยไหม'),
        (['you3', 'meiyou', 'reshui', '?'], 'มีน้ำร้อนไหม'),
        (['you3', 'meiyou', 'fangjian', '?'], 'มีห้องพักไหม'),
    ]),
    ('go', '🚕', 'จะไป…', '我要去 + สถานที่', 'wǒ yào qù + …', 'บอกคนขับว่าจะไปไหน ให้พูด 我要去 แล้วตามด้วยชื่อสถานที่', [
        (['woyaoqu', 'jichang', '.'], 'ฉันจะไปสนามบิน'),
        (['woyaoqu', 'jiudian', '.'], 'ฉันจะไปโรงแรม'),
        (['woyaoqu', 'huochezhan', '.'], 'ฉันจะไปสถานีรถไฟ'),
        (['woyaoqu', 'ditiezhan', '.'], 'ฉันจะไปสถานีรถไฟใต้ดิน'),
        (['woyaoqu', 'yiyuan', '.'], 'ฉันจะไปโรงพยาบาล'),
        (['woyaoqu', 'yaodian', '.'], 'ฉันจะไปร้านขายยา'),
        (['woyaoqu', 'zheli', '.'], 'ฉันจะไปที่นี่ (ชี้แผนที่)'),
        (['woyaoqu', 'xiongmaojidi', '.'], 'ฉันจะไปศูนย์แพนด้า'),
    ]),
    ('time', '⏰', 'กี่โมง / เวลา', '几点 + ทำอะไร', 'jǐ diǎn + …', 'ถามเวลา ให้พูด 几点 แล้วตามด้วยสิ่งที่จะเกิด · บอกเวลา: ช่วงของวัน + ตัวเลข + 点', [
        (['jidian', 'guanmen', '?'], 'ปิดกี่โมง'),
        (['jidian', 'tuifang', '?'], 'เช็คเอาท์กี่โมง'),
        (['mingtian', 'jidiankaimen', '?'], 'พรุ่งนี้เปิดกี่โมง'),
        (['jintian', 'jidian', 'guanmen', '?'], 'วันนี้ปิดกี่โมง'),
        (['mingtian', 'shangwu', 'ba1', 'dian3', '.'], 'พรุ่งนี้เช้าแปดโมง'),
        (['xiawu', 'san1', 'dian3', '.'], 'บ่ายสามโมง'),
        (['wanshang', 'qi1', 'dian3', '.'], 'หนึ่งทุ่ม (เจ็ดโมงเย็น)'),
    ]),
    ('trouble', '🚑', 'แจ้งปัญหา', '我的 + ของ + 丢了 / ของ + 坏了', 'wǒ de + … + diū le', 'ของหายใช้ 丢了 · ของเสียใช้ 坏了 · ไม่มีใช้ 没有 · ให้เอาชื่อของไว้ข้างหน้า', [
        (['我的', '手机', '丢了', '.'], 'มือถือของฉันหาย'),
        (['我的', 'piao4', '丢了', '.'], 'ตั๋วของฉันหาย'),
        (['我的', 'qian2', '丢了', '.'], 'เงินของฉันหาย'),
        (['手机', '坏了', '.'], 'มือถือเสีย'),
        (['fangjian', 'meiyou', 'reshui', '.'], 'ห้องไม่มีน้ำร้อน'),
        (['wo3', 'touteng', '.'], 'ฉันปวดหัว'),
        (['wo3', 'duziteng', '.'], 'ฉันปวดท้อง'),
        (['wobushufu', ',', 'woyaoqu', 'yiyuan', '.'], 'ฉันไม่สบาย ฉันจะไปโรงพยาบาล'),
    ]),
]

# (id, icon, where, what the local says or None, the situation in Thai, [answers])
# The first answer is the one shown as the model.
SCENES = [
    ('taxi-go', '🚕', 'ขึ้นแท็กซี่', 'npc_quna', 'คุณจะไปสนามบิน', [['woyaoqu', 'jichang'], ['去', 'jichang'], ['jichang']]),
    ('taxi-stop', '🚕', 'ในแท็กซี่', None, 'ใกล้ถึงที่หมายแล้ว บอกคนขับให้จอดตรงนี้', [['tingzheli'], ['l_keyi', 'tingzheli', '吗'], ['请', 'tingzheli']]),
    ('taxi-fast', '🚕', 'ในแท็กซี่', 'l_duche', 'คุณกำลังจะตกเครื่อง ขอให้เขาขับเร็วขึ้น', [['kuaiyidian'], ['l_keyi', 'kuaiyidian', '吗'], ['请', 'kuaiyidian']]),
    ('food-seats', '🍜', 'หน้าร้านอาหาร', 'npc_jiwei', 'คุณมากันสองคน', [['liangwei'], ['两个', '人']]),
    ('food-order', '🍜', 'ร้านอาหาร', 'npc_yaoshenme', 'คุณอยากกินบะหมี่เนื้อ', [['wo3', 'yao4', 'niurou', '面'], ['niurou', '面'], ['wo3', 'yao4', '一个', 'niurou', '面']]),
    ('food-nospice', '🍜', 'ร้านอาหาร', 'npc_yaolama', 'คุณกินเผ็ดไม่ได้เลย', [['buyaola'], ['buyao'], ['bula']]),
    ('food-mild', '🍜', 'ร้านอาหาร', 'npc_yaolama', 'คุณกินเผ็ดได้นิดเดียว', [['weila'], ['yao4', ',', 'weila']]),
    ('food-enough', '🍜', 'ร้านอาหาร', 'l_haiyaobiede', 'สั่งครบแล้ว ไม่เอาอะไรเพิ่ม', [['buyaole', ',', 'xiexie'], ['buyaole'], ['buyao', ',', 'xiexie'], ['buyao']]),
    ('food-takeaway', '🍜', 'ร้านอาหาร', 'l_zhebianchi', 'คุณจะเอากลับไปกินที่โรงแรม', [['dabao'], ['带走']]),
    ('food-bill', '🍜', 'ร้านอาหาร', None, 'กินเสร็จแล้ว เรียกพนักงานมาคิดเงิน', [['fuwuyuan', ',', 'maidan'], ['maidan']]),
    ('shop-price', '🛍️', 'ร้านขายของ', None, 'คุณถือของชิ้นหนึ่งอยู่ อยากรู้ราคา', [['zhegeduoshaoqian'], ['duoshaoqian'], ['zhege', 'jikuai']]),
    ('shop-bargain', '🛍️', 'ร้านขายของ', ('两百块。', 'liǎngbǎi kuài.', 'เหลียงป่าย ไคว่', 'สองร้อยหยวน'), 'คุณว่าแพงไป ขอให้เขาลดราคา',
     [['taiguile', ',', 'pianyiyidian'], ['taiguile'], ['keyipianyima'], ['pianyiyidian']]),
    ('shop-count', '🛍️', 'ร้านขายของ', 'l_yaojige', 'คุณจะเอาสามอัน', [['三个'], ['wo3', 'yao4', '三个'], ['yao4', '三个']]),
    ('shop-other', '🛍️', 'ร้านขายของ', 'l_maiwanle', 'งั้นคุณจะเอาอีกอันที่วางอยู่ไกลออกไป', [['wo3', 'yao4', 'nage'], ['nage'], ['yao4', 'nage']]),
    ('pay-app', '💳', 'จ่ายเงิน', 'npc_zhifu', 'คุณจะจ่ายด้วยอาลีเพย์', [['zhifubao'], ['用', 'zhifubao'], ['wo3', '用', 'zhifubao']]),
    ('pay-bag', '💳', 'จ่ายเงิน', 'l_yaodaizima', 'คุณมีกระเป๋าแล้ว ไม่ต้องการถุง', [['buyao'], ['buyao', ',', 'xiexie'], ['buyao', '袋子']]),
    ('pay-cash', '💳', 'จ่ายเงิน', None, 'มือถือแบตหมด คุณมีแต่เงินสด ถามว่าจ่ายได้ไหม', [['yongxianjin'], ['xianjin', 'l_keyi', '吗']]),
    ('way-toilet', '🧭', 'กลางห้าง', None, 'คุณหาห้องน้ำไม่เจอ ถามคนแถวนั้น',
     [['xishoujianzainali'], ['cesuo', 'zainali'], ['qingwen', ',', 'xishoujianzainali'], ['qingwen', ',', 'cesuo', 'zainali']]),
    ('way-far', '🧭', 'ถามทาง', 'l_wangqianzou', 'คุณอยากรู้ว่าต้องเดินไกลไหม', [['yuanma'], ['很', '远', '吗']]),
    ('metro-tickets', '🚇', 'ช่องขายตั๋ว', 'npc_jizhang', 'คุณมากันสองคน', [['两张'], ['wo3', 'yao4', '两张'], ['两张', 'piao4']]),
    ('hotel-checkin', '🏨', 'เคาน์เตอร์โรงแรม', 'npc_huanying', 'คุณจองห้องไว้แล้ว มาเช็คอิน', [['youyuding'], ['wo3', 'yao4', 'ruzhu'], ['ruzhu']]),
    ('hotel-passport', '🏨', 'เคาน์เตอร์โรงแรม', 'npc_huzhao', 'คุณยื่นพาสปอร์ตให้ ตอบรับสั้น ๆ', [['haode'], ['hao3']]),
    ('hotel-aircon', '🏨', 'โทรหาเคาน์เตอร์', None, 'แอร์ในห้องไม่ทำงาน แจ้งพนักงาน', [['kongtiaohuaile'], ['nihao', ',', 'kongtiaohuaile'], ['fangjian', '的', 'kongtiaohuaile']]),
    ('hotel-wifi', '🏨', 'เคาน์เตอร์โรงแรม', None, 'คุณต่อไวไฟไม่ได้ อยากรู้รหัส', [['wifimima']]),
    ('sick-where', '🚑', 'ร้านขายยา', 'npc_nalibushufu', 'คุณปวดท้อง', [['duziteng'], ['wo3', 'duziteng']]),
    ('lost-passport', '🚑', 'สถานีตำรวจ', None, 'คุณทำพาสปอร์ตหาย แจ้งตำรวจ', [['huzhaodiule'], ['huzhao', '丢了']]),
    ('lost-way', '🚑', 'กลางเมือง', None, 'คุณหลงทาง ขอให้คนแถวนั้นช่วย', [['womilule'], ['womilule', ',', 'qingbangwo'], ['qingbangwo']]),
    ('chat-from', '👋', 'คุยกับคนจีน', 'npc_nashiguoren', 'คุณมาจากประเทศไทย', [['taiguoren'], ['泰国人']]),
    ('chat-toofast', '🙋', 'คุยกับคนจีน', ('地铁站就在前面，过马路右拐。', 'dìtiězhàn jiù zài qiánmian, guò mǎlù yòu guǎi.', 'ตี้เถี่ยจ้าน จิ้ว ไจ้ เฉียนเมียน, กั้ว หม่าลู่ โย่ว ไกว่',
      'สถานีรถไฟใต้ดินอยู่ข้างหน้านี่เอง ข้ามถนนแล้วเลี้ยวขวา'), 'เขาพูดเร็วมาก คุณฟังไม่ทัน',
     [['wotingbudong'], ['manyidian'], ['zaishuoyibian'], ['请', 'manyidian'], ['duibuqi', ',', 'wotingbudong']]),
    ('photo-help', '📸', 'ที่เที่ยว', None, 'คุณอยากได้รูปคู่ ขอให้คนแถวนั้นถ่ายให้', [['bangwopaizhao'], ['qingbangwo', '拍照']]),
]

# Thai meaning of a scene's model answer when it is not a lesson phrase as it stands.
MODEL_MEANING = {
    'taxi-go': 'ฉันจะไปสนามบิน', 'food-order': 'ฉันเอาบะหมี่เนื้อ', 'food-enough': 'ไม่เอาแล้ว ขอบคุณ', 'food-bill': 'พนักงาน เช็คบิล',
    'shop-bargain': 'แพงไป ลดหน่อย', 'shop-count': 'สามอัน', 'shop-other': 'ฉันเอาอันนั้น', 'metro-tickets': 'สองใบ',
}

# One question, the different things a local may answer. Heard only, so new words are fine.
# (hanzi, pinyin, thai, meaning) — or a lesson item id to reuse its line.
REPLIES = [
    ('price', '💰', 'ถามราคา', 'zhegeduoshaoqian', [
        ('十五块。', 'shíwǔ kuài.', 'สืออู่ ไคว่', '15 หยวน'),
        ('三十八块。', 'sānshíbā kuài.', 'ซานสือปา ไคว่', '38 หยวน'),
        ('一百二。', 'yìbǎi èr.', 'อี้ป่าย เอ้อร์', '120 หยวน (พูดย่อ)'),
        ('两块五。', 'liǎng kuài wǔ.', 'เหลี่ยง ไคว่ อู่', '2.5 หยวน'),
        ('十块三个。', 'shí kuài sān ge.', 'สือ ไคว่ ซาน เก้อ', 'สามอันสิบหยวน'),
        ('这个不卖。', 'zhège bú mài.', 'เจ้อเกอ ปู๋ ม่าย', 'อันนี้ไม่ขาย'),
    ]),
    ('bargain', '🤝', 'ขอลดราคา', 'keyipianyima', [
        ('不行，已经很便宜了。', 'bù xíng, yǐjīng hěn piányi le.', 'ปู้ สิง, อี่จิง เหิ่น เผียนอี เลอ', 'ไม่ได้ ถูกมากแล้ว'),
        ('好吧，八十。', 'hǎo ba, bāshí.', 'ห่าว ปะ, ปาสือ', 'ก็ได้ แปดสิบ'),
        ('最低一百。', 'zuì dī yìbǎi.', 'จุ้ย ตี อี้ป่าย', 'ต่ำสุดหนึ่งร้อย'),
        ('买两个便宜一点。', 'mǎi liǎng ge piányi yìdiǎn.', 'ไหม่ เหลี่ยง เก้อ เผียนอี อี้เตี่ยน', 'ซื้อสองอันลดให้หน่อย'),
        ('你说多少？', 'nǐ shuō duōshao?', 'หนี่ ซัว ตัวเซา', 'คุณว่าเท่าไหร่ล่ะ'),
    ]),
    ('way', '🧭', 'ถามทาง', 'xishoujianzainali', [
        ('在二楼。', 'zài èr lóu.', 'ไจ้ เอ้อร์ โหลว', 'อยู่ชั้นสอง'),
        ('一直走，左拐。', 'yìzhí zǒu, zuǒ guǎi.', 'อี้จื๋อ โจ่ว, จั๋ว ไกว่', 'ตรงไป แล้วเลี้ยวซ้าย'),
        ('在你后面。', 'zài nǐ hòumian.', 'ไจ้ หนี่ โฮ่วเมียน', 'อยู่ข้างหลังคุณ'),
        ('这里没有。', 'zhèlǐ méiyǒu.', 'เจ้อหลี่ เหมยโหย่ว', 'ที่นี่ไม่มี'),
        ('出门右拐。', 'chū mén yòu guǎi.', 'ชู เหมิน โย่ว ไกว่', 'ออกประตูแล้วเลี้ยวขวา'),
        ('我也不知道。', 'wǒ yě bù zhīdào.', 'หวอ เหย่ ปู้ จือเต้า', 'ฉันก็ไม่รู้เหมือนกัน'),
        'l_jiuzainabian', 'l_zaiqianmian',
    ]),
    ('food', '🍜', 'สั่งอาหาร', 'woyaozhege', [
        ('没有了。', 'méiyǒu le.', 'เหมยโหย่ว เลอ', 'หมดแล้ว'),
        ('马上来。', 'mǎshàng lái.', 'หม่าซ่าง ไหล', 'มาเดี๋ยวนี้เลย'),
        ('要等十分钟。', 'yào děng shí fēnzhōng.', 'เย่า เติ่ง สือ เฟินจง', 'ต้องรอสิบนาที'),
        ('要米饭吗？', 'yào mǐfàn ma?', 'เย่า หมี่ฟ่าน มะ', 'เอาข้าวสวยไหม'),
        ('喝什么？', 'hē shénme?', 'เฮอ เสินเมอ', 'ดื่มอะไร'),
        ('吃辣吗？', 'chī là ma?', 'ชือ ล่า มะ', 'กินเผ็ดไหม'),
        ('扫码点菜。', 'sǎo mǎ diǎn cài.', 'เสา หม่า เตี่ยน ไช่', 'สแกนคิวอาร์เพื่อสั่งอาหาร'),
        'l_haiyaobiede', 'l_zhebianchi',
    ]),
    ('pay', '💳', 'จ่ายเงิน', 'maidan', [
        ('我扫你。', 'wǒ sǎo nǐ.', 'หวอ เส่า หนี่', 'ฉันสแกนคุณ (เปิดคิวอาร์ของคุณให้เขา)'),
        ('你扫我。', 'nǐ sǎo wǒ.', 'หนี เส่า หว่อ', 'คุณสแกนฉัน (สแกนคิวอาร์ของร้าน)'),
        ('不收现金。', 'bù shōu xiànjīn.', 'ปู้ โซว เซี่ยนจิน', 'ไม่รับเงินสด'),
        ('找不开。', 'zhǎo bu kāi.', 'จ่าว ปู ไค', 'ไม่มีเงินทอน'),
        ('付好了。', 'fù hǎo le.', 'ฟู่ ห่าว เลอ', 'จ่ายเรียบร้อยแล้ว'),
        ('要发票吗？', 'yào fāpiào ma?', 'เย่า ฟาเพี่ยว มะ', 'เอาใบเสร็จไหม'),
        'l_yaodaizima', 'npc_zhifu',
    ]),
    ('taxi', '🚕', 'นั่งแท็กซี่', 'dache', [
        ('上车。', 'shàng chē.', 'ซ่าง เชอ', 'ขึ้นรถ'),
        ('系好安全带。', 'jì hǎo ānquándài.', 'จี้ ห่าว อันเฉวียนไต้', 'คาดเข็มขัดนิรภัยด้วย'),
        ('要四十分钟。', 'yào sìshí fēnzhōng.', 'เย่า ซื่อสือ เฟินจง', 'ต้องใช้เวลาสี่สิบนาที'),
        ('这里不能停。', 'zhèlǐ bù néng tíng.', 'เจ้อหลี่ ปู้ เหนิง ถิง', 'ตรงนี้จอดไม่ได้'),
        ('打表。', 'dǎ biǎo.', 'ต๋า เปี่ยว', 'คิดตามมิเตอร์'),
        'npc_quna', 'l_duche', 'npc_daole',
    ]),
    ('hotel', '🏨', 'เข้าพักโรงแรม', 'youyuding', [
        ('几位入住？', 'jǐ wèi rùzhù?', 'จี่ เว่ย รู่จู้', 'เข้าพักกี่ท่าน'),
        ('住几晚？', 'zhù jǐ wǎn?', 'จู้ จี๋ หว่าน', 'พักกี่คืน'),
        ('房间在八楼。', 'fángjiān zài bā lóu.', 'ฝางเจียน ไจ้ ปา โหลว', 'ห้องอยู่ชั้นแปด'),
        ('押金两百。', 'yājīn liǎngbǎi.', 'ยาจิน เหลียงป่าย', 'มัดจำสองร้อย'),
        ('早餐七点到十点。', 'zǎocān qī diǎn dào shí diǎn.', 'จ่าวชาน ชี เตี่ยน เต้า สือ เตี่ยน', 'อาหารเช้าเจ็ดโมงถึงสิบโมง'),
        ('十二点退房。', "shí'èr diǎn tuìfáng.", 'สือเอ้อร์ เตี่ยน ทุ่ยฝาง', 'เช็คเอาท์เที่ยง'),
        'npc_huzhao',
    ]),
]

# Sounds that Thai ears merge. One group = words that differ only in that sound (same tone where possible).
# (hanzi, pinyin, thai reading, meaning)
SOUNDS = [
    ('qxj', 'q · x · j', 'q พ่นลม "ช" · x ลมซ่า "ซ" ยิ้มปาก · j ไม่มีลม "จ" — ลิ้นแบนทั้งสามเสียง', [
        [('七', 'qī', 'ชี', 'เจ็ด'), ('西', 'xī', 'ซี', 'ตะวันตก'), ('鸡', 'jī', 'จี', 'ไก่')],
        [('千', 'qiān', 'เชียน', 'พัน'), ('先', 'xiān', 'เซียน', 'ก่อน'), ('尖', 'jiān', 'เจียน', 'แหลม')],
    ]),
    ('curl', 'ม้วนลิ้น zh ch sh · ลิ้นแบน z c s', 'zh ch sh ยกปลายลิ้นขึ้นไปใกล้เพดาน เสียงจะทุ้ม · z c s ปลายลิ้นแตะหลังฟัน เสียงจะแหลม', [
        [('是', 'shì', 'ซื่อ (ม้วนลิ้น)', 'ใช่'), ('四', 'sì', 'ซื่อ (ลิ้นแบน)', 'สี่')],
        [('山', 'shān', 'ซาน (ม้วนลิ้น)', 'ภูเขา'), ('三', 'sān', 'ซาน (ลิ้นแบน)', 'สาม')],
        [('找', 'zhǎo', 'จ่าว (ม้วนลิ้น)', 'หา / ทอน'), ('早', 'zǎo', 'จ่าว (ลิ้นแบน)', 'เช้า')],
        [('出', 'chū', 'ชู (ม้วนลิ้น)', 'ออก'), ('粗', 'cū', 'ชู (ลิ้นแบน)', 'หยาบ')],
    ]),
    ('zou', 'zǒu · jiǔ · shǒu', 'zǒu ปากห่อ "โจ่ว" · jiǔ มีเสียง i "จิ่ว" · shǒu ม้วนลิ้น "โส่ว"', [
        [('走', 'zǒu', 'โจ่ว', 'เดิน'), ('九', 'jiǔ', 'จิ่ว', 'เก้า'), ('手', 'shǒu', 'โส่ว', 'มือ')],
    ]),
    ('nng', 'ลงท้าย -n · -ng', '-n ลิ้นแตะหลังฟันบน เสียงสั้น · -ng เสียงขึ้นจมูกเหมือน "ง" ปากเปิดกว่า', [
        [('饭', 'fàn', 'ฟ่าน', 'ข้าว'), ('放', 'fàng', 'ฟ่าง', 'วาง')],
        [('钱', 'qián', 'เฉียน', 'เงิน'), ('强', 'qiáng', 'เฉียง', 'แข็งแรง')],
        [('晚', 'wǎn', 'หว่าน', 'ค่ำ'), ('往', 'wǎng', 'หวั่ง', 'ไปทาง')],
        [('分', 'fēn', 'เฟิน', 'นาที / ส่วน'), ('风', 'fēng', 'เฟิง', 'ลม')],
    ]),
    ('rl', 'r · l', 'r ม้วนลิ้นไม่รัว เสียงก้องคล้าย "ย+ร" · l ปลายลิ้นแตะเพดานหน้า "ล"', [
        [('肉', 'ròu', 'โร่ว', 'เนื้อ'), ('漏', 'lòu', 'โล่ว', 'รั่ว')],
        [('入', 'rù', 'รู่', 'เข้า'), ('路', 'lù', 'ลู่', 'ถนน')],
    ]),
    ('td', 't · d', 't พ่นลม "ท" · d ไม่มีลม "ต"', [
        [('退', 'tuì', 'ทุ่ย', 'คืน / ถอย'), ('对', 'duì', 'ตุ้ย', 'ถูกต้อง')],
        [('兔', 'tù', 'ทู่', 'กระต่าย'), ('肚', 'dù', 'ตู้', 'ท้อง')],
    ]),
    ('yu', 'u · ü', 'u ปากห่อ "อู" · ü ห่อปากแบบ อู แต่ออกเสียง "อี" — เสียง "อวี"', [
        [('路', 'lù', 'ลู่', 'ถนน'), ('绿', 'lǜ', 'ลวี่', 'สีเขียว')],
        [('努', 'nǔ', 'หนู่', 'พยายาม'), ('女', 'nǚ', 'หนวี่', 'ผู้หญิง')],
    ]),
]


def build():
    items = json.load(open(os.path.join(ROOT, 'content', 'units.json'), encoding='utf-8'))['items']

    def sent(toks, meaning=None):
        hz, py, th, needs = [], [], [], []
        for t in toks:
            if t in PUNCT:
                hz.append(PUNCT[t][0])
                if py:
                    py[-1] += PUNCT[t][1]
                    if t in ',?':
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
        out = {'hanzi': ''.join(hz), 'pinyin': ' '.join(py), 'thai': ' '.join(th), 'needs': needs}
        if meaning:
            out['meaning'] = meaning
        return out

    def line(x):  # something only heard: an item id, or written out in full
        if isinstance(x, str):
            it = items[x]
            return {'hanzi': it['hanzi'], 'pinyin': it['pinyin'], 'thai': it['thai'], 'meaning': it['meaning']}
        return dict(zip(('hanzi', 'pinyin', 'thai', 'meaning'), x))

    patterns = [{'id': pid, 'icon': icon, 'title': title, 'frame': frame, 'framePy': fpy, 'tip': tip,
                 'sentences': [sent(toks, meaning) for toks, meaning in rows]}
                for pid, icon, title, frame, fpy, tip, rows in PATTERNS]
    scenes = []
    for sid, icon, place, npc, cue, answers in SCENES:
        ans = []
        for toks in answers:
            a = sent(toks)
            if len(toks) == 1 and toks[0] in items:  # a lesson phrase as it is: keep its meaning and accepted spellings
                src = items[toks[0]]
                a.update({k: src[k] for k in ('meaning', 'accept', 'reject') if k in src})
            ans.append(a)
        needs = ans[0]['needs'] + ([npc] if isinstance(npc, str) and not items[npc].get('npc') else [])
        for a in ans:
            del a['needs']
        ans[0].setdefault('meaning', MODEL_MEANING.get(sid))
        assert ans[0]['meaning'], 'no Thai meaning for the model answer of ' + sid
        scenes.append({'id': sid, 'icon': icon, 'place': place, 'npc': line(npc) if npc else None, 'cue': cue, 'answers': ans, 'needs': needs})
    replies = [{'id': rid, 'icon': icon, 'title': title, 'ask': ask, 'lines': [line(x) for x in rows]} for rid, icon, title, ask, rows in REPLIES]
    sounds = [{'id': sid, 'title': title, 'tip': tip, 'groups': [[dict(zip(('hanzi', 'pinyin', 'thai', 'meaning'), w)) for w in g] for g in groups]}
              for sid, title, tip, groups in SOUNDS]
    return {'patterns': patterns, 'scenes': scenes, 'replies': replies, 'sounds': sounds}


if __name__ == '__main__':
    data = build()
    p = os.path.join(ROOT, 'content', 'patterns.json')
    with open(p, 'w', encoding='utf-8') as f:  # one entry per line keeps diffs readable
        f.write('{\n')
        keys = list(data)
        for ki, k in enumerate(keys):
            f.write(f' "{k}": [\n' + ',\n'.join('  ' + json.dumps(x, ensure_ascii=False) for x in data[k]) + '\n ]' + (',' if ki < len(keys) - 1 else '') + '\n')
        f.write('}\n')
    json.load(open(p, encoding='utf-8'))
    print(f"{len(data['patterns'])} patterns / {sum(len(x['sentences']) for x in data['patterns'])} sentences, "
          f"{len(data['scenes'])} scenes, {sum(len(x['lines']) for x in data['replies'])} replies, "
          f"{sum(len(g) for x in data['sounds'] for g in x['groups'])} sound words")

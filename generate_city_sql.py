#!/usr/bin/env python3
"""Match county-level city names to prefecture city_code and emit UPDATE SQL."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

PCA_PATH = Path("/tmp/china-admin/pca-code.json")
OUT_SQL = Path("/workspace/update_py_hotel_match_city.sql")

# Prefecture codes from the provided code table (column 2 -> column 3).
CODE_TABLE = {
    "110000": "北京市",
    "120000": "天津市",
    "130100": "石家庄市",
    "130200": "唐山市",
    "130300": "秦皇岛市",
    "130400": "邯郸市",
    "130500": "邢台市",
    "130600": "保定市",
    "130700": "张家口市",
    "130800": "承德市",
    "130900": "沧州市",
    "131000": "廊坊市",
    "131100": "衡水市",
    "140100": "太原市",
    "140200": "大同市",
    "140300": "阳泉市",
    "140400": "长治市",
    "140500": "晋城市",
    "140600": "朔州市",
    "140700": "晋中市",
    "140800": "运城市",
    "140900": "忻州市",
    "141000": "临汾市",
    "141100": "吕梁市",
    "150000": "内蒙古自治区",
    "150100": "呼和浩特市",
    "150200": "包头市",
    "150300": "乌海市",
    "150400": "赤峰市",
    "150500": "通辽市",
    "150600": "鄂尔多斯市",
    "150700": "呼伦贝尔市",
    "150800": "巴彦淖尔市",
    "150900": "乌兰察布市",
    "152200": "兴安盟",
    "152500": "锡林郭勒盟",
    "152900": "阿拉善盟",
    "210100": "沈阳市",
    "210200": "大连市",
    "210300": "鞍山市",
    "210400": "抚顺市",
    "210500": "本溪市",
    "210600": "丹东市",
    "210700": "锦州市",
    "210800": "营口市",
    "210900": "阜新市",
    "211000": "辽阳市",
    "211100": "盘锦市",
    "211200": "铁岭市",
    "211300": "朝阳市",
    "211400": "葫芦岛市",
    "220100": "长春市",
    "220200": "吉林市",
    "220300": "四平市",
    "220400": "辽源市",
    "220500": "通化市",
    "220600": "白山市",
    "220700": "松原市",
    "220800": "白城市",
    "222400": "延边朝鲜族自治州",
    "230100": "哈尔滨市",
    "230200": "齐齐哈尔市",
    "230300": "鸡西市",
    "230400": "鹤岗市",
    "230500": "双鸭山市",
    "230600": "大庆市",
    "230700": "伊春市",
    "230800": "佳木斯市",
    "230900": "七台河市",
    "231000": "牡丹江市",
    "231100": "黑河市",
    "231200": "绥化市",
    "232700": "大兴安岭地区",
    "310000": "上海市",
    "320100": "南京市",
    "320200": "无锡市",
    "320300": "徐州市",
    "320400": "常州市",
    "320500": "苏州市",
    "320600": "南通市",
    "320700": "连云港市",
    "320800": "淮安市",
    "320900": "盐城市",
    "321000": "扬州市",
    "321100": "镇江市",
    "321200": "泰州市",
    "321300": "宿迁市",
    "330100": "杭州市",
    "330200": "宁波市",
    "330300": "温州市",
    "330400": "嘉兴市",
    "330500": "湖州市",
    "330600": "绍兴市",
    "330700": "金华市",
    "330800": "衢州市",
    "330900": "舟山市",
    "331000": "台州市",
    "331100": "丽水市",
    "340100": "合肥市",
    "340200": "芜湖市",
    "340300": "蚌埠市",
    "340400": "淮南市",
    "340500": "马鞍山市",
    "340600": "淮北市",
    "340700": "铜陵市",
    "340800": "安庆市",
    "341000": "黄山市",
    "341100": "滁州市",
    "341200": "阜阳市",
    "341300": "宿州市",
    "341500": "六安市",
    "341600": "亳州市",
    "341700": "池州市",
    "341800": "宣城市",
    "350100": "福州市",
    "350200": "厦门市",
    "350300": "莆田市",
    "350400": "三明市",
    "350500": "泉州市",
    "350600": "漳州市",
    "350700": "南平市",
    "350800": "龙岩市",
    "350900": "宁德市",
    "360100": "南昌市",
    "360200": "景德镇市",
    "360300": "萍乡市",
    "360400": "九江市",
    "360500": "新余市",
    "360600": "鹰潭市",
    "360700": "赣州市",
    "360800": "吉安市",
    "360900": "宜春市",
    "361000": "抚州市",
    "361100": "上饶市",
    "370100": "济南市",
    "370200": "青岛市",
    "370300": "淄博市",
    "370400": "枣庄市",
    "370500": "东营市",
    "370600": "烟台市",
    "370700": "潍坊市",
    "370800": "济宁市",
    "370900": "泰安市",
    "371000": "威海市",
    "371100": "日照市",
    "371300": "临沂市",
    "371400": "德州市",
    "371500": "聊城市",
    "371600": "滨州市",
    "371700": "菏泽市",
    "410100": "郑州市",
    "410200": "开封市",
    "410300": "洛阳市",
    "410400": "平顶山市",
    "410500": "安阳市",
    "410600": "鹤壁市",
    "410700": "新乡市",
    "410800": "焦作市",
    "410900": "濮阳市",
    "411000": "许昌市",
    "411100": "漯河市",
    "411200": "三门峡市",
    "411300": "南阳市",
    "411400": "商丘市",
    "411500": "信阳市",
    "411600": "周口市",
    "411700": "驻马店市",
    "420100": "武汉市",
    "420200": "黄石市",
    "420300": "十堰市",
    "420500": "宜昌市",
    "420600": "襄阳市",
    "420700": "鄂州市",
    "420800": "荆门市",
    "420900": "孝感市",
    "421000": "荆州市",
    "421100": "黄冈市",
    "421200": "咸宁市",
    "421300": "随州市",
    "422800": "恩施土家族苗族自治州",
    "430100": "长沙市",
    "430200": "株洲市",
    "430300": "湘潭市",
    "430400": "衡阳市",
    "430500": "邵阳市",
    "430600": "岳阳市",
    "430700": "常德市",
    "430800": "张家界市",
    "430900": "益阳市",
    "431000": "郴州市",
    "431100": "永州市",
    "431200": "怀化市",
    "431300": "娄底市",
    "433100": "湘西土家族苗族自治州",
    "440100": "广州市",
    "440200": "韶关市",
    "440300": "深圳市",
    "440400": "珠海市",
    "440500": "汕头市",
    "440600": "佛山市",
    "440700": "江门市",
    "440800": "湛江市",
    "440900": "茂名市",
    "441200": "肇庆市",
    "441300": "惠州市",
    "441400": "梅州市",
    "441500": "汕尾市",
    "441600": "河源市",
    "441700": "阳江市",
    "441800": "清远市",
    "441900": "东莞市",
    "442000": "中山市",
    "445100": "潮州市",
    "445200": "揭阳市",
    "445300": "云浮市",
    "450000": "广西壮族自治区",
    "450100": "南宁市",
    "450200": "柳州市",
    "450300": "桂林市",
    "450400": "梧州市",
    "450500": "北海市",
    "450600": "防城港市",
    "450700": "钦州市",
    "450800": "贵港市",
    "450900": "玉林市",
    "451000": "百色市",
    "451100": "贺州市",
    "451200": "河池市",
    "451300": "来宾市",
    "451400": "崇左市",
    "460100": "海口市",
    "460200": "三亚市",
    "460300": "三沙市",
    "460400": "儋州市",
    "500000": "重庆市",
    "510100": "成都市",
    "510300": "自贡市",
    "510400": "攀枝花市",
    "510500": "泸州市",
    "510600": "德阳市",
    "510700": "绵阳市",
    "510800": "广元市",
    "510900": "遂宁市",
    "511000": "内江市",
    "511100": "乐山市",
    "511300": "南充市",
    "511400": "眉山市",
    "511500": "宜宾市",
    "511600": "广安市",
    "511700": "达州市",
    "511800": "雅安市",
    "511900": "巴中市",
    "512000": "资阳市",
    "513200": "阿坝藏族羌族自治州",
    "513300": "甘孜藏族自治州",
    "513400": "凉山彝族自治州",
    "520100": "贵阳市",
    "520200": "六盘水市",
    "520300": "遵义市",
    "520400": "安顺市",
    "520500": "毕节市",
    "520600": "铜仁市",
    "522300": "黔西南布依族苗族自治州",
    "522600": "黔东南苗族侗族自治州",
    "522700": "黔南布依族苗族自治州",
    "530100": "昆明市",
    "530300": "曲靖市",
    "530400": "玉溪市",
    "530500": "保山市",
    "530600": "昭通市",
    "530700": "丽江市",
    "530800": "普洱市",
    "530900": "临沧市",
    "532300": "楚雄彝族自治州",
    "532500": "红河哈尼族彝族自治州",
    "532600": "文山壮族苗族自治州",
    "532800": "西双版纳傣族自治州",
    "532900": "大理白族自治州",
    "533100": "德宏傣族景颇族自治州",
    "533300": "怒江傈僳族自治州",
    "533400": "迪庆藏族自治州",
    "540000": "西藏自治区",
    "540100": "拉萨市",
    "540200": "日喀则市",
    "540300": "昌都市",
    "540400": "林芝市",
    "540500": "山南市",
    "540600": "那曲市",
    "542500": "阿里地区",
    "610100": "西安市",
    "610200": "铜川市",
    "610300": "宝鸡市",
    "610400": "咸阳市",
    "610500": "渭南市",
    "610600": "延安市",
    "610700": "汉中市",
    "610800": "榆林市",
    "610900": "安康市",
    "611000": "商洛市",
    "620100": "兰州市",
    "620200": "嘉峪关市",
    "620300": "金昌市",
    "620400": "白银市",
    "620500": "天水市",
    "620600": "武威市",
    "620700": "张掖市",
    "620800": "平凉市",
    "620900": "酒泉市",
    "621000": "庆阳市",
    "621100": "定西市",
    "621200": "陇南市",
    "622900": "临夏回族自治州",
    "623000": "甘南藏族自治州",
    "630100": "西宁市",
    "630200": "海东市",
    "632200": "海北藏族自治州",
    "632300": "黄南藏族自治州",
    "632500": "海南藏族自治州",
    "632600": "果洛藏族自治州",
    "632700": "玉树藏族自治州",
    "632800": "海西蒙古族藏族自治州",
    "640000": "宁夏回族自治区",
    "640100": "银川市",
    "640200": "石嘴山市",
    "640300": "吴忠市",
    "640400": "固原市",
    "640500": "中卫市",
    "650000": "新疆维吾尔自治区",
    "650100": "乌鲁木齐市",
    "650200": "克拉玛依市",
    "650400": "吐鲁番市",
    "650500": "哈密市",
    "652300": "昌吉回族自治州",
    "652700": "博尔塔拉蒙古自治州",
    "652800": "巴音郭楞蒙古自治州",
    "652900": "阿克苏地区",
    "653000": "克孜勒苏柯尔克孜自治州",
    "653100": "喀什地区",
    "653200": "和田地区",
    "654000": "伊犁哈萨克自治州",
    "654200": "塔城地区",
    "654300": "阿勒泰地区",
    "810000": "香港特别行政区",
    "820000": "澳门特别行政区",
}

# Abbreviated / informal names -> official area or prefecture name.
ALIASES = {
    "科右中旗": "科尔沁右翼中旗",
    "科右前旗": "科尔沁右翼前旗",
    "科左后旗": "科尔沁左翼后旗",
    "科左中旗": "科尔沁左翼中旗",
    "喀喇沁左翼": "喀喇沁左翼蒙古族自治县",
    "察右前旗": "察哈尔右翼前旗",
    "察右后旗": "察哈尔右翼后旗",
    "察右中旗": "察哈尔右翼中旗",
    "达茂旗": "达尔罕茂明安联合旗",
    "西乌旗": "西乌珠穆沁旗",
    "东乌旗": "东乌珠穆沁旗",
    "鄂温克族旗": "鄂温克族自治旗",
    "鄂伦春旗": "鄂伦春自治旗",
    "莫力达瓦旗": "莫力达瓦达斡尔族自治旗",
    "前郭": "前郭尔罗斯蒙古族自治县",
    "杜尔伯特": "杜尔伯特蒙古族自治县",
    "和布克赛尔": "和布克赛尔蒙古自治县",
    "恩施州": "恩施土家族苗族自治州",
    "黔南州": "黔南布依族苗族自治州",
    "阿坝州": "阿坝藏族羌族自治州",
    "西双版纳": "西双版纳傣族自治州",
    "德宏州": "德宏傣族景颇族自治州",
    "巴音郭楞": "巴音郭楞蒙古自治州",
    "伊犁": "伊犁哈萨克自治州",
    "海西": "海西蒙古族藏族自治州",
    "怒江": "怒江傈僳族自治州",
    "大兴安岭": "大兴安岭地区",
    "香港": "香港特别行政区",
    "澳门": "澳门特别行政区",
    "东乡族": "东乡族自治县",
    "河南县": "河南蒙古族自治县",
    "甘孜县": "甘孜县",
    "玉树县": "玉树市",  # 玉树县已撤县设市
    "阿坝县": "阿坝县",
    "红河县": "红河县",
    "临夏": "临夏市",
    "楚雄": "楚雄彝族自治州",
    "喀什": "喀什地区",
    "和田": "和田地区",
    "伊宁": "伊宁市",
    "塔城": "塔城市",
    "阿勒泰": "阿勒泰市",
    "昌吉市": "昌吉市",
    "大理": "大理市",
    "文山": "文山市",
    "蒙自": "蒙自市",
    "个旧": "个旧市",
    "景洪": "景洪市",
    "芒市": "芒市",
    "潞西": "芒市",
    "香格里拉": "香格里拉市",
    "合作": "合作市",
    "同仁": "同仁市",
    "共和": "共和县",
    "海晏": "海晏县",
    "格尔木": "格尔木市",
    "德令哈": "德令哈市",
    "茫崖": "茫崖市",
    "乌兰": "乌兰县",
    "奎屯": "奎屯市",
    "乌苏": "乌苏市",
    "博乐": "博乐市",
    "库尔勒": "库尔勒市",
    "阿克苏": "阿克苏市",
    "阿图什": "阿图什市",
    "和田县": "和田县",
    "伊宁县": "伊宁县",
    "伊宁市": "伊宁市",
    "临夏县": "临夏县",
    "乌鲁木齐县": "乌鲁木齐县",
    "龙港": "龙港市",  # 温州县级市，非葫芦岛市辖区
    "阜新县": "阜新蒙古族自治县",
    "本溪县": "本溪满族自治县",
    "西盟": "西盟佤族自治县",
    "新北": None,  # 台湾新北市，码表无对应
    "台北": None,
    "宜兰": None,
}

# Names that must not match urban districts (prefer county / county-level city).
FORCE_COUNTY_LEVEL = {
    "和平",  # 河源市和平县，非市辖区
    "五华",  # 梅州市五华县，非昆明五华区
    "新兴",  # 云浮市新兴县
    "兴安",  # 桂林市兴安县
    "开平",  # 江门市开平市
    "白云",  # if any
    "新华",
    "城关",
    "西湖",
    "南郊",
    "郊区",
    "城区",
    "新北",
    "白沙",  # 海南白沙黎族自治县
    "昌江",  # 海南昌江黎族自治县
    "安定",
    "东山",  # 漳州市东山县，非多种东山区
    "南山",
    "向阳",
    "前进",
    "永宁",  # 银川市永宁县
    "大通",  # 西宁市大通回族土族自治县
    "清水",  # 天水市清水县
    "平安",
    "城中",
    "海州",
    "西安",  # should not appear; guard
    "江南",
    "江北",
    "桥西",
    "桥东",
    "双塔",
    "金川",  # 阿坝州金川县，非金昌金川区
    "平山",  # 石家庄平山县，非本溪平山区
    "东安",  # 永州东安县
    "宁江",
    "江城",  # 普洱江城县
    "长宁",  # 宜宾长宁县
    "通海",  # 玉溪通海县
    "华亭",  # 平凉华亭市
    "云龙",  # 大理云龙县
    "南溪",
    "安居",
    "蓬江",
    "金平",  # 红河金平县，非汕头金平区
    "榕城",
    "湘桥",
    "武侯",
    "青羊",
    "成华",
    "锦江",
    "龙潭",
    "沙湾",  # 乐山市沙湾区 vs 塔城地区沙湾市 — 列表后段新疆语境为沙湾市
}

# Explicit area-code overrides when short-name collision remains.
# Value is official area name.
EXPLICIT_AREA = {
    "和平": "和平县",
    "五华": "五华县",
    "新兴": "新兴县",
    "兴安": "兴安县",
    "开平": "开平市",
    "白沙": "白沙黎族自治县",
    "昌江": "昌江黎族自治县",
    "东山": "东山县",
    "永宁": "永宁县",
    "大通": "大通回族土族自治县",
    "清水": "清水县",
    "金川": "金川县",
    "平山": "平山县",
    "东安": "东安县",
    "江城": "江城哈尼族彝族自治县",
    "长宁": "长宁县",
    "通海": "通海县",
    "华亭": "华亭市",
    "云龙": "云龙县",
    "金平": "金平苗族瑶族傣族自治县",
    "沙湾": "沙湾市",
    "龙港": "龙港市",
    "南岔": "南岔县",
    "普兰": "普兰县",
    "改则": "改则县",
    "措勤": "措勤县",
    "噶尔": "噶尔县",
    "日土": "日土县",
    "革吉": "革吉县",
    "札达": "札达县",
    "互助": "互助土族自治县",
    "门源": "门源回族自治县",
    "化隆": "化隆回族自治县",
    "循化": "循化撒拉族自治县",
    "民和": "民和回族土族自治县",
    "大通": "大通回族土族自治县",
    "张家川": "张家川回族自治县",
    "肃南": "肃南裕固族自治县",
    "肃北": "肃北蒙古族自治县",
    "阿克塞": "阿克塞哈萨克族自治县",
    "积石山": "积石山保安族东乡族撒拉族自治县",
    "塔什库尔干": "塔什库尔干塔吉克自治县",
    "巴里坤": "巴里坤哈萨克自治县",
    "察布查尔": "察布查尔锡伯自治县",
    "和布克赛尔": "和布克赛尔蒙古自治县",
    "木垒": "木垒哈萨克自治县",
    "焉耆": "焉耆回族自治县",
    "塔什库尔干": "塔什库尔干塔吉克自治县",
}

ETHNIC_TOKEN = (
    r"(?:维吾尔|哈萨克|柯尔克孜|塔吉克|锡伯|俄罗斯|塔塔尔|乌孜别克|"
    r"蒙古|达斡尔|鄂温克|鄂伦春|赫哲|朝鲜|满|回|藏|彝|壮|苗|瑶|侗|白|"
    r"哈尼|傣|黎|傈僳|佤|畲|拉祜|水|东乡|纳西|景颇|土|仫佬|羌|布朗|撒拉|"
    r"毛南|仡佬|阿昌|普米|怒|德昂|保安|裕固|京|独龙|门巴|珞巴|基诺|土家|"
    r"高山|布依)族"
)

TAIL_RE = re.compile(
    r"(?:(?:各族)?(?:%s)*自治(?:县|旗|州|市)|地区|林区|特区|管理区管委会|"
    r"行政委员会|高新技术产业开发区|盟|市|县|区|旗)$" % ETHNIC_TOKEN
)
ETHNIC_RE = re.compile(ETHNIC_TOKEN)


def short_forms(name: str) -> set[str]:
    out = {name}
    n = name.strip()
    out.add(n)
    stripped = n
    for _ in range(4):
        nxt = TAIL_RE.sub("", stripped)
        nxt = ETHNIC_RE.sub("", nxt)
        nxt = nxt.replace("族", "")
        if nxt == stripped:
            break
        stripped = nxt
        if stripped:
            out.add(stripped)
    # common extra: drop only last suffix
    for suffix in (
        "土家族苗族自治县",
        "苗族土家族自治县",
        "黎族苗族自治县",
        "黎族自治县",
        "彝族自治县",
        "回族自治县",
        "蒙古族自治县",
        "瑶族自治县",
        "侗族自治县",
        "各族自治县",
        "自治县",
        "自治旗",
        "自治州",
        "地区",
        "林区",
        "市",
        "县",
        "区",
        "旗",
        "盟",
    ):
        if n.endswith(suffix) and len(n) > len(suffix):
            out.add(n[: -len(suffix)])
    out.discard("")
    return out


def is_district(area_name: str) -> bool:
    if area_name.endswith("自治县") or area_name.endswith("自治旗"):
        return False
    if area_name.endswith("区") and not area_name.endswith("地区"):
        # 林区 is not 区 in the same sense; 神农架林区 handled separately
        if area_name.endswith("林区"):
            return False
        return True
    return False


def is_county_like(area_name: str) -> bool:
    return (
        area_name.endswith("县")
        or area_name.endswith("旗")
        or area_name.endswith("市")
        or area_name.endswith("林区")
        or area_name.endswith("地区")
        or area_name.endswith("盟")
        or area_name.endswith("州")
    )


def pad_city_code(city_code: str, city_name: str, province_code: str) -> str | None:
    """Convert 4-digit pca city code to 6-digit code-table code."""
    if city_name in ("市辖区", "县"):
        return province_code + "0000"
    if city_name in ("省直辖县级行政区划", "自治区直辖县级行政区划"):
        if province_code == "65":
            return "650000"
        # Hainan / Hubei / Henan province-administered counties have no
        # matching parent in the provided code table.
        return None
    if len(city_code) == 4:
        return city_code + "00"
    if len(city_code) == 6:
        return city_code
    return None


def load_pca():
    pca = json.loads(PCA_PATH.read_text(encoding="utf-8"))
    areas = []  # dicts
    prefectures = []
    for prov in pca:
        pcode, pname = prov["code"], prov["name"]
        for city in prov["children"]:
            ccode, cname = city["code"], city["name"]
            prefectures.append(
                {
                    "name": cname,
                    "code": ccode,
                    "province_code": pcode,
                    "province": pname,
                }
            )
            for area in city.get("children") or []:
                areas.append(
                    {
                        "name": area["name"],
                        "code": area["code"],
                        "city_code": ccode,
                        "city_name": cname,
                        "province_code": pcode,
                        "province": pname,
                    }
                )
    return areas, prefectures


def build_indexes(areas, prefectures):
    exact_area = defaultdict(list)
    short_area = defaultdict(list)
    exact_pref = defaultdict(list)
    short_pref = defaultdict(list)

    for a in areas:
        exact_area[a["name"]].append(a)
        for s in short_forms(a["name"]):
            short_area[s].append(a)

    for p in prefectures:
        exact_pref[p["name"]].append(p)
        for s in short_forms(p["name"]):
            short_pref[s].append(p)

    # also index code-table prefecture names
    code_by_name = {}
    for code, name in CODE_TABLE.items():
        code_by_name[name] = code
        for s in short_forms(name):
            code_by_name.setdefault(s, code)
    return exact_area, short_area, exact_pref, short_pref, code_by_name


def pick_area(candidates, user_name: str):
    if len(candidates) == 1:
        return candidates[0]
    # de-duplicate by area code
    uniq = {}
    for c in candidates:
        uniq[c["code"]] = c
    candidates = list(uniq.values())
    if len(candidates) == 1:
        return candidates[0]

    if user_name in EXPLICIT_AREA:
        target = EXPLICIT_AREA[user_name]
        hit = [c for c in candidates if c["name"] == target]
        if len(hit) == 1:
            return hit[0]

    # Prefer county-like over district
    county = [c for c in candidates if is_county_like(c["name"]) and not is_district(c["name"])]
    non_district = [c for c in candidates if not is_district(c["name"])]
    if len(county) == 1:
        return county[0]
    if len(non_district) == 1:
        return non_district[0]

    # If user name already has a suffix, prefer exact suffix
    if user_name.endswith("县"):
        hit = [c for c in candidates if c["name"].endswith("县") and not c["name"].endswith("自治县") or c["name"] == user_name]
        exact = [c for c in candidates if c["name"] == user_name or c["name"] == user_name]
        hit2 = [c for c in candidates if c["name"] == user_name or c["name"].endswith(user_name)]
        named = [c for c in candidates if c["name"] == user_name]
        if len(named) == 1:
            return named[0]
        counties = [c for c in candidates if c["name"].endswith("县")]
        if len(counties) == 1:
            return counties[0]
    if user_name.endswith("市"):
        named = [c for c in candidates if c["name"] == user_name]
        if len(named) == 1:
            return named[0]
        cities = [c for c in candidates if c["name"].endswith("市") and not is_district(c["name"])]
        if len(cities) == 1:
            return cities[0]
    if user_name.endswith("旗"):
        named = [c for c in candidates if c["name"] == user_name or c["name"].endswith(user_name)]
        if len(named) == 1:
            return named[0]

    return None  # ambiguous


def resolve_code_from_area(area) -> tuple[str | None, str]:
    code = pad_city_code(area["city_code"], area["city_name"], area["province_code"])
    if code and code in CODE_TABLE:
        return code, CODE_TABLE[code]
    return None, area["city_name"]


def resolve_code_from_pref(pref) -> tuple[str | None, str]:
    code = pad_city_code(pref["code"], pref["name"], pref["province_code"])
    if code and code in CODE_TABLE:
        return code, CODE_TABLE[code]
    # try official prefecture name in code table
    if pref["name"] in CODE_TABLE.values():
        for c, n in CODE_TABLE.items():
            if n == pref["name"]:
                return c, n
    return None, pref["name"]


CITY_NAMES = """
句容
垫江
酉阳
奉节
石柱
云阳
公主岭
尚志
秀山
正定
翁牛特旗
阿拉善左旗
乌兰浩特
德惠
南皮
容城
巫溪
围场
新巴尔虎右旗
阜城
易县
丰都
彭水
涞源
汾阳
塔河
锡林浩特
内丘
启东
五寨
三河
隆化
准格尔旗
任丘
灵寿
乌拉特前旗
阜新县
定兴
滦南
洮南
肇东
科右中旗
珲春
安图
昆山
沛县
沁源
张家港
敖汉旗
成安
勃利
青冈
兴城
固安
嫩江
宁武
蠡县
乾安
大兴安岭
溧阳
巨鹿
杭锦旗
保德
江阴
隆尧
涞水
宝应
铁力
邳州
玉田
怀仁
睢宁
五台
河曲
介休
饶河
雄县
彰武
魏县
额尔古纳
闻喜
遵化
曲沃
农安
清徐
献县
萝北
河间
曲阳
海安
肇州
鄂温克族旗
瓦房店
孟村
霍林郭勒
富锦
喀喇沁左翼
辽阳县
太仓
常熟
集安
丰宁
苏尼特右旗
望奎
沧县
土默特右旗
铁岭县
梅河口
岚县
开原
绥棱
唐县
安泽
桓仁
平定
康平
平遥
伊通
昔阳
二连浩特
盖州
繁峙
林西
汤原
巴林右旗
绥中
克什克腾旗
大城
霸州
明水
沁水
宜兴
延吉
喀喇沁旗
依安
满洲里
青龙
阳原
原平
达拉特旗
黄骅
梨树
东光
榆树
长子
察右前旗
莫力达瓦旗
通榆
阳城
镇赉
高邑
文水
高碑店
襄垣
孝义
扎鲁特旗
张北
威县
虎林
巴林左旗
洪洞
凤城
扬中
怀来
涿州
敦化
平泉
仪征
逊克
邱县
武安
大名
乐亭
榆社
泽州
新河
乌审旗
永清
阿鲁科尔沁旗
武邑
根河
凉城
绥芬河
正蓝旗
阿荣旗
集贤
牙克石
昌黎
商都
宁城
如东
五大连池
新民
新沂
大厂
大石桥
双辽
本溪县
阿巴嘎旗
庄河
深州
交城
隰县
鄂托克旗
望都
无极
库伦旗
奈曼旗
康保
枣强
前郭
扎兰屯
庆安
盂县
浑源
额济纳旗
伊金霍洛旗
吉县
饶阳
迁西
蛟河
抚松
吴桥
舒兰
平顺
图们
定州
盐山
安平
阿尔山
汪清
丰县
青县
泰来
东港
五原
神池
武强
寿阳
西乌旗
科右前旗
临县
稷山
调兵山
壶关
垣曲
宝清
安达
泊头
如皋
景县
漠河
正镶白旗
台安
通化县
和顺
宽城
平山
石楼
广宗
香河
化德
中阳
侯马
大安
木兰
突泉
抚远
凌源
长白
赤城
北安
东丰
杭锦后旗
建昌
岢岚
四子王旗
永和
达茂旗
晋州
忠县
灵石
兴隆
新乐
定襄
鸡东
澳门
同江
海城
东宁
林口
大宁
新北
沽源
开鲁
高邮
杜尔伯特
凌海
安新
南宫
宾县
平乡
西丰
呼玛
讷河
法库
柳林
古交
曲周
左权
克东
拜泉
察右后旗
建平
文安
代县
怀安
辛集
肃宁
博野
兴县
兰西
多伦
磴口
辉南
陵川
宁晋
丰镇
扎赉特旗
涉县
林甸
香港
广平
岫岩
察右中旗
鄂托克前旗
长海
襄汾
五常
迁安
扶余
苏尼特左旗
新绛
兴和
丹阳
元氏
科左后旗
滦平
蔚县
临城
友谊
桦南
依兰
河津
科左中旗
行唐
鄂伦春旗
孙吴
黑山
永济
清河
长岭
左云
乡宁
偏关
义县
馆陶
鸡泽
阳曲
临漳
甘南县
承德县
朝阳县
广灵
汤旺
安国
嘉荫
东乌旗
磁县
富裕
临猗
天镇
古县
桦甸
高阳
巫山
灯塔
清原
灵丘
新巴尔虎左旗
靖宇
陈巴尔虎旗
方山
固阳
顺平
穆棱
龙井
尚义
南岔
阜平
和林格尔
故城
巴彦
祁县
山阴
夏县
赞皇
北镇
赵县
土默特左旗
北票
临江
深泽
高平
临西
乌拉特后旗
肇源
密山
海兴
沙河
新宾
芮城
右玉
乌拉特中旗
镶黄旗
滦州
盘山
万荣
应县
绥滨
清水河
黎城
宁安
台北
丰林
交口
方正
桦川
武乡
昌图
井陉
海伦
太仆寺旗
托克托
抚顺县
卓资
大箐山
霍州
永吉
柳河
柏乡
卢龙
东辽
磐石
涿鹿
娄烦
城口
龙江
阳高
克山
阿拉善右旗
海林
浮山
通河
平陆
石林
胶州
泸县
广饶
南安
莱阳
武穴
道孚
灵宝
信宜
紫云
务川
景洪
郓城
永城
义乌
建瓯
洪雅
称多
长沙县
青州
庐山
福清
通山
东源
阳西
峨眉山
永嘉
乐清
枝江
海原
龙胜
安陆
汶川
天长
南昌县
温宿
玉环
商城
西华
麻城
华阴
中宁
建德
大理
米林
庆云
特克斯
巢湖
安宁
南县
秭归
海盐
固始
凌云
南乐
临朐
洪湖
荣成
阿克苏
神木
南雄
稻城
沭阳
灵川
上蔡
桐乡
仙居
嘉善
丹巴
建湖
巴里坤
合江
屏南
通江
莎车
库车
犍为
五华
红原
宁国
登封
皋兰
延长
乌兰
惠东
秦安
通许
象山
婺源
海阳
莱州
金塔
道县
利川
留坝
策勒
中方
富蕴
霍山
诸城
镇宁
敦煌
浏阳
轮台
库尔勒
诸暨
肥西
吉木萨尔
蒲城
巩义
西昌
临泉
黔西
古蔺
安岳
鱼台
兴义
布尔津
平武
上高
平湖
德江
温岭
大埔
永康
唐河
旬阳
岱山
金沙
常宁
宾阳
雷山
莱西
台山
安吉
大悟
简阳
都江堰
黑水
宁海
蕲春
商河
昌吉市
廉江
灌云
苍溪
嘉祥
沁阳
息烽
荥阳
习水
马尔康
监利
松潘
进贤
普兰
广河
光山
龙泉
同心
长兴
井冈山
寿县
陆川
海西
赤壁
瑞昌
石首
遂川
江山
鹤山
恩施州
曹县
阜南
涡阳
崇州
贵定
伊川
江安
红安
青川
遂溪
青阳
南陵
绥阳
剑阁
高安
东海
新泰
贡嘎
河口
江华
富宁
响水
海宁
盱眙
宜川
浮梁
巴塘
石狮
四会
龙口
康定
南澳
内乡
三台
东山
洛浦
吉首
林州
曲阜
叙永
平塘
阳谷
宁都
云霄
东兰
雷州
高唐
新郑
夏邑
武夷山
费县
威远
辉县
邛崃
中牟
大荔
腾冲
金湖
博兴
普宁
枞阳
长武
东阳
碌曲
甘孜县
镇沅
汤阴
慈溪
平度
会东
临颍
邹城
洪江
泗水
栾川
泰顺
尉犁
乳山
关岭
博罗
静宁
田林
新安
东台
湘乡
陆丰
汝州
浠水
连江
泰兴
贵溪
龙游
临清
神农架
睢县
当涂
巨野
靖江
遂昌
修武
巴东
台前
肥东
宜城
邵阳县
明光
镇远
乐平
宿松
盘州
伊宁市
丹江口
三江
晋江
勉县
铅山
山阳
盐边
阳朔
山丹
云县
武胜
吉木乃
扶绥
广宁
长垣
桐柏
平潭
仁怀
崇仁
罗甸
郸城
团风
弥勒
海丰
永兴
隆昌
博白
平利
和平
正阳
宁陵
澜沧
肥城
余姚
利辛
阜宁
宁南
阳新
玉山
沧源
麦盖提
和布克赛尔
柘城
茂县
枣阳
大邑
龙港
天祝
昭觉
濉溪
沂南
乐陵
永昌
兴宁
瑞丽
阿坝县
德清
随县
凯里
怀宁
古浪
灵武
漳浦
新邵
德兴
阿勒泰
昭苏
衡阳县
永顺
钟祥
齐河
大英
泸溪
泗洪
泰宁
民权
庐江
福安
汉川
丘北
茶陵
叶城
淳化
泾阳
涟源
黄陵
富顺
宁蒗
高青
大竹
彭州
招远
泾县
博乐
鹤庆
大冶
定远
息县
东阿
莘县
高密
双江
沂水
大方
无棣
镇康
东兴
会理
措勤
兴平
和田
龙川
邻水
宜章
瓮安
周至
江口
岐山
雅江
松滋
谷城
瓜州
永安
巧家
淳安
乌苏
天台
惠民
宁远
洛川
平阳
金堂
东至
德庆
融水
平邑
通城
鄄城
潢川
新密
全州
城固
镇平
英德
蒲江
中江
阆中
天等
余干
嵊州
南漳
望谟
封丘
凤凰
万年
衡南
榆中
瑞安
安化
潜山
鄢陵
罗田
蓝山
勐腊
丹棱
杞县
玉龙
玉屏
霍邱
灵璧
府谷
镇巴
沙雅
巴楚
洛隆
新蔡
滕州
新星
长葛
兴安
柞水
邹平
纳雍
岚皋
道真
江油
麻江
云梦
当阳
新源
连州
荣县
新田
分宜
黟县
荔波
光泽
吉隆
资兴
汉源
冠县
麻阳
南丹
格尔木
泌阳
商南
诏安
东明
金寨
佳县
玛曲
歙县
祁连
都昌
涟水
成武
新野
眉县
郎溪
雷波
三原
开阳
天峻
龙门
九寨沟
咸丰
建始
榕江
沈丘
塔什库尔干
丹凤
醴陵
开化
兴山
泗阳
太白
永德
孝昌
长阳
全南
芦溪
镇安
临邑
宁乡
公安
湘潭县
马关
韩城
迭部
上犹
射阳
靖边
城步
汝南
奇台
九龙
黄梅
青神
陇县
楚雄市
甘德
禹州
黄龙
平乐
资中
嵩县
双峰
樟树
噶尔
常山
陆河
白玉
岳西
龙里
宜都
施秉
龙山
单县
当雄
且末
色达
民丰
宁津
精河
高州
仙游
泾川
桓台
福鼎
德化
姚安
茫崖
竹溪
察隅
松溪
夹江
两当
澄江
北川
平江
鄯善
久治
绵竹
嘉禾
西平
西盟
桃江
禹城
横州
滑县
布拖
周宁
罗定
定边
平罗
阜康
若尔盖
闽清
徐闻
泗县
乳源
邵东
绥德
五莲
闽侯
阳春
三门
册亨
文山
临湘
界首
朗县
青河
高台
连城
筠连
长汀
遂平
若羌
沅陵
太湖
岷县
赫章
炉霍
翁源
郯城
荔浦
青田
木垒
于田
陆良
从江
石台
广德
浦江
永春
濮阳县
蒙城
新昌
绩溪
永胜
开平
金平
政和
错那
乡城
宣恩
京山
舟曲
宜良
宝兴
香格里拉
大新
炎陵
桂东
夏津
钟山
西峡
灌南
裕民
思南
桐庐
呼图壁
兰溪
理塘
寻甸
临海
松桃
理县
沿河
安丘
徽县
塔城
武义
昌乐
正安
寿光
项城
丰城
赤水
安龙
丰顺
彭泽
盐源
崇阳
太康
芒市
连平
吉水
德令哈
喜德
原阳
福贡
恩平
宁阳
余庆
都匀
禄劝
萧县
师宗
信丰
皮山
班戈
石棉
济源
辰溪
泸定
莒南
田东
平南
江永
佛冈
巍山
盐池
定结
镇雄
兴化
沙洋
桐城
会昌
嘉鱼
鲁山
梁山
修水
安溪
东平
双牌
勐海
大通
永善
霍尔果斯
富县
汨罗
凭祥
共青城
临夏
金乡
西充
惠安
古田
松阳
慈利
独山
灵山
合作
临沭
蒙阴
扶风
商水
莒县
兴仁
循化
霍城
庆城
托里
缙云
焉耆
奎屯
休宁
新兴
磐安
靖西
宣汉
广汉
互助
临泽
长丰
漾濞
沅江
华安
都兰
乐业
桐梓
宁明
温泉
开江
珙县
昌邑
禄丰
刚察
临洮
新化
盐津
万载
湘阴
英山
隆安
苍南
上林
平舆
古丈
湄潭
郧西
远安
拉孜
揭西
阳山
米易
梓潼
子长
叶县
嵊泗
甘泉
日土
隆林
怀集
乌鲁木齐县
石泉
滨海
华蓥
利津
化州
漳平
平昌
天全
安仁
广南
万源
淇县
合浦
彬州
什邡
建水
瑞金
会宁
永福
宕昌
元阳
象州
霞浦
兴业
武城
吉安县
嘉黎
牟定
旺苍
景谷
上栗
彝良
泸西
墨玉
礼泉
左贡
会泽
绿春
汶上
凤庆
贞丰
芷江
盐亭
隆回
扶沟
金阳
通道
苍梧
祁阳
富川
微山
武平
夏河
福海
改则
来凤
温县
德昌
金川
固镇
于都
上杭
竹山
武冈
广水
怀远
八宿
博爱
泸水
砀山
南丰
巴马
舞钢
获嘉
威信
平阴
清镇
清丰
千阳
白水
饶平
惠来
宣威
花垣
达日
卢氏
来安
长宁
德安
哈巴河
舒城
尤溪
邓州
阿克塞
洋县
五峰
剑川
共和
北流
攸县
延津
紫金
华坪
老河口
申扎
新平
金溪
南江
江陵
晴隆
湖口
全椒
都安
灌阳
汉阴
漳县
保康
子洲
高县
环县
班玛
凤台
维西
宜阳
孟连
社旗
兰陵
印江
墨江
宁化
文成
米脂
亚东
个旧
忻城
仁寿
托克逊
耒阳
尼勒克
木里
永新
洛宁
积石山
民勤
普格
鄱阳
贵德
罗城
颍上
昌宁
剑河
冷水江
栖霞
淮滨
云和
溆浦
景宁
织金
澄城
和县
孟州
德钦
黎平
大田
札达
蒙自
新宁
桑植
临潭
吴川
沂源
阳信
蒙山
兴海
玛沁
景东
贺兰
武宁
新县
永平
渠县
兰坪
寿宁
东安
衡山
南城
岳阳县
太和
郁南
岑巩
融安
巴青
蓝田
鹿邑
富平
和硕
容县
定南
始兴
泽普
清涧
宁强
浚县
靖州
仁化
天柱
石渠
桂阳
潼关
那坡
华池
宝丰
崇信
内黄
大化
礼县
南涧
连山
长顺
藤县
资溪
合阳
汉寿
陇川
合水
应城
祥云
丁青
兰考
乌什
耿马
浦城
尼玛
襄城
永修
桃源
南召
环江
沐川
安义
浦北
庆元
尖扎
墨脱
乐至
普安
临夏县
汝阳
吴堡
韶山
大姚
隆德
波密
双柏
福泉
华宁
安远
永寿
五河
水富
南靖
平果
乐昌
尉氏
威宁
庄浪
虞城
泾源
延川
玉树县
井研
永登
和静
贡觉
洛南
大关
平和
龙南
确山
汝城
海晏
沙湾
新乡县
鹤峰
永泰
方城
甘谷
冕宁
芒康
昆玉
射洪
伊吾
阿瓦提
民乐
凤阳
澧县
望江
蕉岭
华容
兴国
小金
乾县
修文
岳池
志丹
渑池
玉门
西吉
绥江
峨边
桂平
梁河
黎川
比如
保靖
绥宁
新晃
郏县
泰和
民和
寻乌
石门
马山
房县
昭平
仪陇
衡东
含山
石阡
萨嘎
龙陵
封开
武陟
彭阳
鹿寨
镇原
罗平
卓尼
无为
祁门
西乡
安多
将乐
连南
额敏
渭源
广昌
红河县
白河
南华
弋阳
岑溪
富源
边坝
砚山
德格
新丰
元江
玛纳斯
甘洛
惠水
崇义
伊宁县
舞阳
恭城
奉新
宁县
紫阳
罗山
资源
湟源
贵南
云龙
嵩明
邵武
荥经
萨迦
洞口
宜丰
新龙
同仁
平远
西和
开远
清流
靖安
壤塘
宜黄
陇西
略阳
洱源
察布查尔
景泰
南部
越西
武功
吴起
凤冈
安福
平原
江城
上思
大余
柯坪
武山
兴文
旬邑
宾川
武定
疏附
镇坪
义马
范县
蓬安
临武
盈江
旌德
三都
永宁
青铜峡
新干
江达
英吉沙
楚雄
曲水
黄平
疏勒
麻栗坡
索县
丹寨
靖远
宁陕
伊宁
伽师
新和
曲松
永靖
安乡
淅川
安阳县
阿拉山口
工布江达
易门
武宣
正宁
天峨
普定
会同
建宁
肃南
芦山
通渭
祁东
得荣
柘荣
岳普湖
铜鼓
石屏
康乐
怒江
蓬溪
临澧
津市
通海
锦屏
拜城
柳城
玛多
龙州
营山
佛坪
卫辉
西林
囊谦
华亭
贡山
博湖
罗源
乐安
巩留
德保
化隆
加查
门源
成县
泽库
美姑
马边
聂荣
施甸
峡江
曲麻莱
合山
莲花
凤山
峨山
类乌齐
定日
德宏州
金秀
双河
麟游
西双版纳
台江
石城
陵水
琼海
文昌
阿图什
仙桃
保亭
天门
东方
图木舒克
昌江
乐东
万宁
石河子
五家渠
北屯
五指山
定安
潜江
琼中
澄迈
可克达拉
阿拉尔
白沙
临高
屯昌
阿克陶
铁门关
乌恰
永丰
鲁甸
察雅
和政
河南县
元谋
汾西
万安
昂仁
灵台
张家川
江孜
南木林
顺昌
绛县
胡杨河
屏边
康县
横峰
宜君
聂拉木
沁县
宜兰
延寿
静乐
洛扎
翼城
黔南州
宁洱
阿合奇
肃北
谢通门
屏山
富民
文县
革吉
和田县
墨竹工卡
明溪
弥渡
喀什
浪卡子
永仁
蒲县
措美
伊犁
东乡族
林周
清水
阿坝州
武川
尼木
巴音郭楞
康马
三穗
同德
""".strip().splitlines()


def main():
    areas, prefectures = load_pca()
    exact_area, short_area, exact_pref, short_pref, code_by_name = build_indexes(
        areas, prefectures
    )

    matched = []
    unmatched = []
    ambiguous = []

    seen_names = []
    for raw in CITY_NAMES:
        name = raw.strip()
        if not name:
            continue
        seen_names.append(name)

        # 1) alias
        if name in ALIASES:
            alias = ALIASES[name]
            if alias is None:
                unmatched.append((name, "台湾/码表无对应行政区"))
                continue
            # try exact area, then prefecture, then code table
            if alias in exact_area:
                area = pick_area(exact_area[alias], name) or exact_area[alias][0]
                code, pname = resolve_code_from_area(area)
                if code:
                    matched.append((name, code, pname, area["name"]))
                    continue
            if alias in exact_pref:
                pref = exact_pref[alias][0]
                code, pname = resolve_code_from_pref(pref)
                if code:
                    matched.append((name, code, pname, alias))
                    continue
            if alias in code_by_name:
                code = code_by_name[alias]
                matched.append((name, code, CODE_TABLE[code], alias))
                continue
            unmatched.append((name, f"别名未命中: {alias}"))
            continue

        # 2) explicit area override
        if name in EXPLICIT_AREA:
            target = EXPLICIT_AREA[name]
            if target in exact_area:
                area = exact_area[target][0]
                code, pname = resolve_code_from_area(area)
                if code:
                    matched.append((name, code, pname, area["name"]))
                    continue
                unmatched.append((name, f"有区县但父级不在码表: {area['city_name']}"))
                continue

        # 3) exact area name
        if name in exact_area:
            area = pick_area(exact_area[name], name)
            if area:
                code, pname = resolve_code_from_area(area)
                if code:
                    matched.append((name, code, pname, area["name"]))
                    continue
                unmatched.append((name, f"有区县但父级不在码表: {area['city_name']}"))
                continue
            ambiguous.append((name, [a["name"] + "/" + a["city_name"] for a in exact_area[name]]))
            continue

        # 4) exact prefecture
        if name in exact_pref:
            pref = exact_pref[name][0]
            code, pname = resolve_code_from_pref(pref)
            if code:
                matched.append((name, code, pname, name))
                continue

        if name in code_by_name:
            code = code_by_name[name]
            matched.append((name, code, CODE_TABLE[code], name))
            continue

        # 5) short area
        cands = short_area.get(name, [])
        # de-dup
        uniq = {}
        for a in cands:
            uniq[a["code"]] = a
        cands = list(uniq.values())
        if cands:
            area = pick_area(cands, name)
            if area is None:
                # try county-only
                county = [a for a in cands if not is_district(a["name"])]
                area = pick_area(county, name) if county else None
            if area:
                code, pname = resolve_code_from_area(area)
                if code:
                    matched.append((name, code, pname, area["name"]))
                    continue
                unmatched.append((name, f"有区县但父级不在码表: {area['city_name']} ({area['name']})"))
                continue
            ambiguous.append((name, [a["name"] + "/" + a["city_name"] for a in cands]))
            continue

        # 6) short prefecture
        prefs = short_pref.get(name, [])
        uniqp = {}
        for p in prefs:
            uniqp[p["code"]] = p
        prefs = list(uniqp.values())
        if len(prefs) == 1:
            code, pname = resolve_code_from_pref(prefs[0])
            if code:
                matched.append((name, code, pname, prefs[0]["name"]))
                continue

        unmatched.append((name, "未匹配"))

    # write SQL
    lines = [
        "-- py_hotel_match: map county-level city names to prefecture city_code",
        f"-- matched: {len(matched)} / {len(seen_names)}",
        "-- city_code comes from the provided prefecture code table.",
        "",
    ]
    for name, code, pname, official in matched:
        n = name.replace("'", "''")
        lines.append(
            f"update py_hotel_match set city = '{code}' where city = '{n}'; -- {official} -> {pname}"
        )
    if unmatched:
        lines.append("")
        lines.append("-- Unmatched (no parent city_code in the provided table):")
        for n, why in unmatched:
            lines.append(f"-- {n}: {why}")
    OUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(
        f"total={len(seen_names)} matched={len(matched)} "
        f"unmatched={len(unmatched)} ambiguous={len(ambiguous)}"
    )
    for n, why in unmatched:
        print(f"  unmatched {n}: {why}")
    for n, opts in ambiguous:
        print(f"  ambiguous {n}: {opts}")


if __name__ == "__main__":
    main()

/**
 * KNIGHT HEART のドット絵(すべてオリジナル)と、ステージごとのタイル・背景の生成。
 * 文字1つ = 1ドット、"." は透明。pixelTexture() でテクスチャにする。
 */
import { pixelTexture } from "../../common/retro.js";

// ---------------------------------------------------------------------------
// ヒロイン「カノン」(右向き、16x18)。頭・胴・脚を組み合わせてコマを作る。
// M/m = 鎧(鎧なしのときは桃色のチュニック)、q/r = 兜(鎧なしのときは髪)
// ---------------------------------------------------------------------------
const HEAD = [
    "......KKKKK.....",
    "....KKqqqqqKK...",
    "...KqqqqqqqqqK..",
    "..KqqqqqqqqYqqK.",
    "..KrrrrrrrrrrrK.",
    ".KHHHHHHHHHHSHK.",
    "KHHKHHHSSSSSSSK.",
    "KHhKHSSSSSESSSK.",
    "KhhKHSSSSSESSsK.",
    ".KK.KKSSSSSSSK..",
];
const HEAD_DOWN = [ // しゃがみ・スライディング用(少しうつむく)
    "................",
    "......KKKKK.....",
    "....KKqqqqqKK...",
    "...KqqqqqqqYqK..",
    "..KrrrrrrrrrrrK.",
    ".KHHHHHHHHHHSHK.",
    "KHhKHHSSSSESSSK.",
    "KhhKHSSSSSESSsK.",
    ".KK.KKSSSSSSSK..",
    "................",
];
const TORSO = {
    idle: [
        "....KCKSSKK.....",
        "...KCMMMMMMK....",
        "...KCMMYYMMSK...",
        "...KCmmmmmmSK...",
    ],
    throw: [
        "....KCKSSKK.....",
        "...KCMMMMMMKKKK.",
        "...KCMMYYMMMSSK.",
        "...KCmmmmmmKKK..",
    ],
    up: [ // 両手を上げる(やられ)
        "..KSKKKSSKKKSK..",
        "..KSKMMMMMMKSK..",
        "...KKMMYYMMKK...",
        "....KmmmmmmK....",
    ],
};
const LEGS = {
    stand: [
        "....KMMMMMMK....",
        ".....KSK.KSK....",
        ".....KBK.KBK....",
        "....KBBK.KBBK...",
    ],
    run1: [
        "....KMMMMMMK....",
        "...KSK...KSK....",
        "..KBK.....KBK...",
        "..KKK.....KBBK..",
    ],
    run2: [
        "....KMMMMMMK....",
        "......KSSK......",
        "......KBBK......",
        ".....KBBBK......",
    ],
    run3: [
        "....KMMMMMMK....",
        "....KSK..KSK....",
        "...KBK....KBK...",
        "...KBBK...KKK...",
    ],
    jump: [
        "....KMMMMMMK....",
        "....KSK..KSKK...",
        "...KBBK...KBBK..",
        "....KK.....KK...",
    ],
};
const SLIDE = [ // スライディング(低い姿勢で足を前に)
    ...HEAD_DOWN,
    "...KCMMMMMMKK...",
    "..KCCmmmmmmSKKK.",
    "..KKMMMMMMKSBBBK",
    "...KKKKKKKKKKKK.",
];
const CROUCH = [
    ...HEAD_DOWN,
    "...KCMMYYMMSK...",
    "...KCmmmmmmSK...",
    "...KBBKMMKBBK...",
    "....KKKKKKKK....",
];
const PAL_COMMON = {
    K: 0x201018, H: 0xf878a8, h: 0xc04878, S: 0xf8d8b8, s: 0xe8a888, E: 0x2858c8,
    Y: 0xf8d048, B: 0x804828, C: 0xe03850, W: 0xf8f8f8,
};
const PAL_ARMOR = { ...PAL_COMMON, M: 0xd8e0f0, m: 0x8890b8, q: 0xe0e8f8, r: 0x9098c0 };
const PAL_LIGHT = { ...PAL_COMMON, M: 0xf8b0d0, m: 0xd06898, q: 0xf878a8, r: 0xc04878, C: 0xf8b0d0 };

export const HERO_FRAMES = {
    stand: [...HEAD, ...TORSO.idle, ...LEGS.stand],
    run1: [...HEAD, ...TORSO.idle, ...LEGS.run1],
    run2: [...HEAD, ...TORSO.idle, ...LEGS.run2],
    run3: [...HEAD, ...TORSO.idle, ...LEGS.run3],
    jump: [...HEAD, ...TORSO.idle, ...LEGS.jump],
    throw: [...HEAD, ...TORSO.throw, ...LEGS.stand],
    throwAir: [...HEAD, ...TORSO.throw, ...LEGS.jump],
    hurt: [...HEAD, ...TORSO.up, ...LEGS.jump],
    slide: SLIDE,
    crouch: CROUCH,
};

// 顔グラフィック(16x16、会話用)
const FACE = [
    "....KKKKKKK.....",
    "..KKqqqqqqqKK...",
    ".KqqqqqqYqqqqK..",
    ".KrrrrrrrrrrrK..",
    "KHHHHHHHHHHHHHK.",
    "KHHSSHHHHHSSHHK.",
    "KHSSSSSSSSSSSHK.",
    "KHSKESSSSSKESHK.",
    "KHSKESSSSSKESHK.",
    "KHsSSSSSSSSSsHK.",
    "KHHSSSSNNSSSHHK.",
    "KhHKSSSSSSSSKHK.",
    "Khh.KKSSSSKK.hK.",
    "...KCMKSSKMCK...",
    "..KCMMMYYMMMCK..",
    ".KCMMMMMMMMMMCK.",
];
const FACE_PAL_ARMOR = { ...PAL_ARMOR, N: 0xd04050 };

// ---------------------------------------------------------------------------
// 敵(すべてオリジナル)
// ---------------------------------------------------------------------------
const PURU = [ // ぷるぷる(スライム)
    "....KKKK....",
    "..KKGGGGKK..",
    ".KGGWWGGGGK.",
    ".KGWWGGGGGK.",
    "KGGGGGGGGGGK",
    "KGGKGGGGKGGK",
    "KGGKGGGGKGGK",
    "KGGGGGGGGGGK",
    "KgGGGGGGGGgK",
    ".KKKKKKKKKK.",
];
const HOPPER = [ // ぴょんガエル
    "...KKK..KKK...",
    "..KWKGKKGKWK..",
    "..KKKGGGGKKK..",
    ".KGGGGGGGGGGK.",
    "KGGRRRRRRRRGGK",
    "KGGGGGGGGGGGGK",
    ".KGgGGGGGGgGK.",
    "KGgK.KGGK.KgGK",
    "KKK...KK...KKK",
];
const BAT1 = [
    "KK....KK....KK..",
    "KAK..KAAK..KAK..",
    "KAAKKAWAWKKAAK..",
    ".KAAAAAAAAAAK...",
    "..KAAKAAKAAK....",
    "...KK.KK.KK.....",
    "................",
    "................",
];
const BAT2 = [
    "................",
    "......KAAK......",
    ".....KAWAWK.....",
    "...KKAAAAAAKK...",
    "..KAAAKAAKAAAK..",
    ".KAAK.KAAK.KAAK.",
    "KAK....KK....KAK",
    "KK............KK",
];
const GOBLIN = [ // とげかぶとのゴブリン兵(上から踏めない)
    ".....K.......",
    "....KYK......",
    "...KYYYK.....",
    "..KMMMMMK....",
    ".KMMMMMMMK...",
    ".KGGGGGGGK...",
    ".KGWKGGWKG...",
    ".KGGGGGGGK.K.",
    "..KGRRRGK.KYK",
    "...KKKKK..KMK",
    "..KAAAAAK.KMK",
    ".KAAAAAAGKKMK",
    ".KAAMMAAGK.MK",
    "..KAAAAAK..MK",
    "..KGK.KGK..MK",
    "..KGK.KGK..K.",
    ".KKK..KKK....",
];
const FLOWER = [ // タネを飛ばす花
    "...KKKKKK...",
    "..KRRRRRRK..",
    ".KRRYYYYRRK.",
    "KRRYKKKKYRRK",
    "KRRYKKKKYRRK",
    ".KRRYYYYRRK.",
    "..KRRRRRRK..",
    "...KKGGKK...",
    "..KK.KGK.KK.",
    ".KGGKKGKKGGK",
    "..KGGGGGGGK.",
    "....KKGKK...",
    "....KGGGK...",
    "...KKKKKKK..",
];
const WISP = [ // ゆらゆら鬼火
    "....KKKK....",
    "...KAAAAK...",
    "..KAWWAAAK..",
    ".KAWWAAAAAK.",
    ".KAAKAAKAAK.",
    ".KAAKAAKAAK.",
    ".KAAAAAAAAK.",
    "..KAAAAAAK..",
    "..KAK.KAAK..",
    "...K..KAK...",
    "......KK....",
];
const ICICLE = [
    "KKKKKKKK",
    "KWAAAAAK",
    ".KWAAAK.",
    ".KWAAAK.",
    "..KWAK..",
    "..KWAK..",
    "..KWAK..",
    "...KK...",
];

// ---------------------------------------------------------------------------
// アイテム・しかけ
// ---------------------------------------------------------------------------
const HEART = [
    ".KK.KK.",
    "KMMKMMK",
    "KMWMMMK",
    "KMMMMMK",
    ".KMMMK.",
    "..KMK..",
    "...K...",
];
const APPLE = [
    "....KG..",
    "..KKGKK.",
    ".KRRRRRK",
    "KRWRRRRK",
    "KRWRRRRK",
    "KRRRRRrK",
    ".KRRRrK.",
    "..KKKK..",
];
const BANANA = [
    "......KK",
    ".....KYK",
    "....KYYK",
    "...KYYK.",
    "KKKYYYK.",
    "KYYYYK..",
    ".KYYK...",
    "..KK....",
];
const GRAPES = [
    "...KGK..",
    "..KPKPK.",
    ".KPWPPPK",
    ".KPPKPPK",
    "..KPPPK.",
    "..KPKPK.",
    "...KPK..",
    "....K...",
];
const MEAT = [ // 骨つき肉(たくさん回復)
    "..KKKKK...",
    ".KRRRRRK..",
    "KRWRRRRRK.",
    "KRRRRRRRK.",
    "KRRRRRRKWK",
    ".KRRRRKWWK",
    "..KKKKKWK.",
    ".......K..",
];
const ARMOR_ITEM = [
    ".KK....KK.",
    "KMMKKKKMMK",
    "KMMMMMMMMK",
    ".KMMYYMMK.",
    ".KMMMMMMK.",
    ".KmMMMMmK.",
    "..KmmmmK..",
    "...KKKK...",
];
const BOOTS = [
    "..KKK.....",
    "..KWWK....",
    "..KBBK....",
    "..KBBKWW..",
    "..KBBBKWWW",
    ".KBBBBBKW.",
    "KBBBBBBBK.",
    "KKKKKKKKK.",
];
const LANCE = [
    "KKKKKKKKKKK.....",
    "KMMMMMMMMMMKK...",
    "KmmmmmmmmmmWWKK.",
    "KKKKKKKKKKKKKK..",
];
const DAGGER = [
    "KK.KKKKK..",
    "KBKKWWWWKK",
    "KBKKMMMMK.",
    "KK.KKKKK..",
];
const AXE = [
    "...KKKK...",
    "..KWWMMK..",
    ".KWMMMMMK.",
    ".KMMMKKMK.",
    "..KKKBBK..",
    "....KBK...",
    "....KBK...",
    "....KBK...",
    "....KBK...",
    "....KKK...",
];
const SEED = [
    ".KK.",
    "KYYK",
    "KYYK",
    ".KK.",
];
const SPRING1 = [
    "KKKKKKKKKKKKKKKK",
    "KRRRRRRRRRRRRRRK",
    "KKKKKKKKKKKKKKKK",
    "...KWWWWWWWWK...",
    "....KKKKKKKK....",
    "...KWWWWWWWWK...",
    "....KKKKKKKK....",
    "..KKKKKKKKKKKK..",
    "..KAAAAAAAAAAK..",
    "..KKKKKKKKKKKK..",
];
const SPRING2 = [
    "................",
    "................",
    "................",
    "................",
    "KKKKKKKKKKKKKKKK",
    "KRRRRRRRRRRRRRRK",
    "KKKKKKKKKKKKKKKK",
    "..KKKKKKKKKKKK..",
    "..KAAAAAAAAAAK..",
    "..KKKKKKKKKKKK..",
];
const FLAG_DOWN = [
    "KK..........",
    "KYK.........",
    "KK..........",
    "KA..........",
    "KA..........",
    "KA..........",
    "KA..........",
    "KA..........",
    "KAKKKKK.....",
    "KAKBBBBKK...",
    "KAKBBBBBBK..",
    "KAKBBBBKK...",
    "KAKKKKK.....",
    "KA..........",
    "KA..........",
    "KA..........",
    "KA..........",
    "KA..........",
    "KA..........",
    "KA..........",
    "KK..........",
    "KK..........",
    "KK..........",
    "KK..........",
];
const FLAG_UP = FLAG_DOWN.map((r, i) => {
    if (i >= 3 && i <= 7) return ["KAKKKKK.....", "KAKMMMMKK...", "KAKMHMMMMK..", "KAKMMMMKK...", "KAKKKKK....."][i - 3];
    if (i >= 8 && i <= 12) return "KA..........";
    return r;
});

const ITEM_PAL = {
    K: 0x201018, W: 0xf8f8f8, R: 0xe83838, r: 0xa81828, G: 0x48c048, Y: 0xf8d838, P: 0x9848d8,
    M: 0xd8e0f0, m: 0x8890b8, B: 0x8a5a30, A: 0x707888, H: 0xf878a8,
};

/** 全ステージ共通のテクスチャ(敵の色はステージのテーマで変える) */
export function makeKnightTextures(scene) {
    for (const [name, rows] of Object.entries(HERO_FRAMES)) {
        pixelTexture(scene, `kanon_a_${name}`, rows, PAL_ARMOR);
        pixelTexture(scene, `kanon_l_${name}`, rows, PAL_LIGHT);
    }
    pixelTexture(scene, "kanon_face", FACE, FACE_PAL_ARMOR);
    pixelTexture(scene, "life", HEAD, PAL_ARMOR, 1);
    pixelTexture(scene, "heart", HEART, { ...ITEM_PAL, M: 0xf858a8 });
    pixelTexture(scene, "heart_s", HEART, { ...ITEM_PAL, M: 0xf858a8 }, 1);
    pixelTexture(scene, "apple", APPLE, ITEM_PAL);
    pixelTexture(scene, "banana", BANANA, ITEM_PAL);
    pixelTexture(scene, "grapes", GRAPES, ITEM_PAL);
    pixelTexture(scene, "meat", MEAT, { ...ITEM_PAL, R: 0xb86838 });
    pixelTexture(scene, "armor_item", ARMOR_ITEM, ITEM_PAL);
    pixelTexture(scene, "boots", BOOTS, { ...ITEM_PAL, B: 0x3878f8, W: 0xf8f8f8 });
    pixelTexture(scene, "w_lance", LANCE, ITEM_PAL);
    pixelTexture(scene, "w_dagger", DAGGER, ITEM_PAL);
    pixelTexture(scene, "w_axe", AXE, ITEM_PAL);
    pixelTexture(scene, "seed", SEED, ITEM_PAL);
    pixelTexture(scene, "spring1", SPRING1, ITEM_PAL);
    pixelTexture(scene, "spring2", SPRING2, ITEM_PAL);
    pixelTexture(scene, "flag_down", FLAG_DOWN, { ...ITEM_PAL, B: 0x5858a8 });
    pixelTexture(scene, "flag_up", FLAG_UP, ITEM_PAL);
    pixelTexture(scene, "icicle", ICICLE, { K: 0x284868, W: 0xf8f8f8, A: 0x98d8f8 });
    // 火の玉・岩・火花
    if (!scene.textures.exists("spark")) {
        const g = scene.add.graphics();
        g.fillStyle(0xffffff, 1).fillRect(0, 0, 3, 3);
        g.generateTexture("spark", 3, 3);
        g.clear();
        g.fillStyle(0xf85818, 1).fillCircle(7, 7, 7);
        g.fillStyle(0xf8b838, 1).fillCircle(6, 6, 4);
        g.fillStyle(0xf8f8a8, 1).fillCircle(5, 5, 2);
        g.generateTexture("fireball", 14, 14);
        g.clear();
        g.fillStyle(0x201018, 1).fillCircle(13, 13, 13);
        g.fillStyle(0x786050, 1).fillCircle(13, 13, 11);
        g.fillStyle(0x987868, 1).fillCircle(10, 9, 6);
        g.fillStyle(0x584038, 1).fillCircle(17, 17, 3).fillCircle(8, 17, 2).fillCircle(18, 8, 2);
        g.generateTexture("boulder", 26, 26);
        g.clear();
        g.fillStyle(0x000000, 1).fillEllipse(10, 3, 20, 6);
        g.generateTexture("shadow", 20, 6);
        g.destroy();
    }
}

/** 敵はステージの色にそろえて作る(キーにテーマ名を付ける) */
export function makeEnemyTextures(scene, theme) {
    const k = theme.key;
    const e = theme.enemy;
    pixelTexture(scene, `puru_${k}`, PURU, { K: 0x201018, G: e.puru, g: e.puruD, W: 0xf8f8f8 });
    pixelTexture(scene, `hopper_${k}`, HOPPER, { K: 0x201018, G: e.hopper, g: e.hopperD, W: 0xf8f8f8, R: 0xd83838 });
    pixelTexture(scene, `bat1_${k}`, BAT1, { K: 0x201018, A: e.bat, W: 0xf8f048 });
    pixelTexture(scene, `bat2_${k}`, BAT2, { K: 0x201018, A: e.bat, W: 0xf8f048 });
    pixelTexture(scene, `goblin_${k}`, GOBLIN, { K: 0x201018, Y: 0xf8d048, M: 0x9098b0, G: e.goblin, W: 0xf8f8f8, R: 0x902020, A: e.goblinCloth });
    pixelTexture(scene, `flower_${k}`, FLOWER, { K: 0x201018, R: e.flower, Y: 0xf8e858, G: 0x389838 });
    pixelTexture(scene, `wisp_${k}`, WISP, { K: 0x201018, A: e.wisp, W: 0xf8f8f8 });
}

// ---------------------------------------------------------------------------
// ボス(図形を組み合わせて描く)
// ---------------------------------------------------------------------------
export function makeBossTextures(scene) {
    if (scene.textures.exists("boss_slime")) return;
    const g = scene.add.graphics();
    const out = (key, w, h) => { g.generateTexture(key, w, h); g.clear(); };
    // 1. キングぷるぷる: 王冠をかぶった大きなスライム
    g.fillStyle(0x201018, 1).fillEllipse(40, 50, 80, 56);
    g.fillStyle(0x48c8e8, 1).fillEllipse(40, 50, 74, 50);
    g.fillStyle(0x2890b8, 1).fillEllipse(40, 62, 70, 24);
    g.fillStyle(0xd8f8f8, 1).fillEllipse(24, 38, 14, 8);
    g.fillStyle(0x201018, 1).fillRect(26, 46, 6, 9).fillRect(48, 46, 6, 9);
    g.fillStyle(0xf8f8f8, 1).fillRect(27, 47, 2, 3).fillRect(49, 47, 2, 3);
    g.fillStyle(0x201018, 1).fillRect(32, 60, 16, 3);
    g.fillStyle(0x201018, 1).fillTriangle(22, 26, 30, 10, 36, 26).fillTriangle(32, 26, 40, 6, 48, 26).fillTriangle(44, 26, 50, 10, 58, 26);
    g.fillStyle(0xf8d048, 1).fillTriangle(24, 25, 30, 13, 35, 25).fillTriangle(34, 25, 40, 9, 46, 25).fillTriangle(45, 25, 50, 13, 56, 25);
    g.fillStyle(0xf8d048, 1).fillRect(23, 24, 34, 5);
    g.fillStyle(0xe83838, 1).fillCircle(40, 26, 2);
    out("boss_slime", 80, 80);
    // 2. クイーンホーネット: 大きな蜂の女王
    g.fillStyle(0xd8f0f8, 0.75).fillEllipse(30, 18, 36, 22).fillEllipse(50, 16, 36, 22);
    g.fillStyle(0x201018, 1).fillEllipse(40, 44, 50, 34);
    g.fillStyle(0xf8c828, 1).fillEllipse(40, 44, 46, 30);
    g.fillStyle(0x201018, 1).fillRect(26, 32, 5, 24).fillRect(38, 30, 5, 28).fillRect(50, 32, 5, 24);
    g.fillStyle(0x201018, 1).fillTriangle(62, 40, 78, 46, 62, 52);
    g.fillStyle(0x201018, 1).fillCircle(18, 38, 13);
    g.fillStyle(0xf8c828, 1).fillCircle(18, 38, 11);
    g.fillStyle(0xd82858, 1).fillCircle(13, 36, 4).fillCircle(21, 36, 4);
    g.fillStyle(0xf8f8f8, 1).fillCircle(12, 35, 1).fillCircle(20, 35, 1);
    g.fillStyle(0xf8d048, 1).fillTriangle(10, 27, 14, 19, 18, 27).fillTriangle(16, 27, 20, 17, 24, 27);
    g.lineStyle(2, 0x201018, 1).lineBetween(28, 58, 24, 68).lineBetween(40, 60, 40, 70).lineBetween(52, 58, 56, 68);
    out("boss_hornet", 80, 72);
    // 3. マグマゴーレム: 岩の巨人
    g.fillStyle(0x201018, 1).fillRect(14, 20, 60, 50).fillRect(4, 26, 16, 34).fillRect(68, 26, 16, 34).fillRect(20, 68, 18, 16).fillRect(50, 68, 18, 16);
    g.fillStyle(0x685048, 1).fillRect(16, 22, 56, 46).fillRect(6, 28, 12, 30).fillRect(70, 28, 12, 30).fillRect(22, 70, 14, 12).fillRect(52, 70, 14, 12);
    g.fillStyle(0x886858, 1).fillRect(18, 24, 24, 14).fillRect(46, 40, 22, 12);
    g.fillStyle(0xf86818, 1).fillRect(30, 50, 28, 3).fillRect(40, 44, 3, 18).fillRect(18, 58, 12, 2).fillRect(60, 26, 2, 12);
    g.fillStyle(0x201018, 1).fillRect(26, 4, 36, 20);
    g.fillStyle(0x685048, 1).fillRect(28, 6, 32, 16);
    g.fillStyle(0xf8e838, 1).fillRect(32, 11, 8, 4).fillRect(48, 11, 8, 4);
    out("boss_golem", 88, 86);
    // 4. フロストナイト: 氷の騎士(盾と剣)
    g.fillStyle(0x201018, 1).fillRect(24, 22, 32, 36).fillRect(26, 56, 12, 20).fillRect(42, 56, 12, 20);
    g.fillStyle(0x88b8e8, 1).fillRect(26, 24, 28, 32).fillRect(28, 58, 8, 16).fillRect(44, 58, 8, 16);
    g.fillStyle(0xd8f0f8, 1).fillRect(30, 28, 20, 6).fillRect(38, 34, 4, 18);
    g.fillStyle(0x201018, 1).fillRect(28, 2, 24, 22);
    g.fillStyle(0xb8d8f8, 1).fillRect(30, 4, 20, 18);
    g.fillStyle(0x201018, 1).fillRect(32, 12, 16, 3);
    g.fillStyle(0x58f8f8, 1).fillRect(34, 12, 4, 2).fillRect(43, 12, 4, 2);
    g.fillStyle(0x3858c8, 1).fillTriangle(40, 0, 52, -2, 44, 6);
    g.fillStyle(0x201018, 1).fillRect(2, 26, 22, 32);
    g.fillStyle(0x5878c8, 1).fillRect(4, 28, 18, 28);
    g.fillStyle(0xd8f0f8, 1).fillRect(11, 32, 4, 20).fillRect(6, 40, 14, 4);
    g.fillStyle(0x201018, 1).fillRect(56, 34, 6, 8).fillRect(60, 14, 6, 26);
    g.fillStyle(0xe8f8f8, 1).fillRect(61, 15, 4, 24);
    out("boss_knight", 70, 78);
    // 5. ナイトメア: 夜の魔女王(マントと角、宙に浮く)
    g.fillStyle(0x201018, 1).fillTriangle(40, 18, 4, 84, 76, 84);
    g.fillStyle(0x482868, 1).fillTriangle(40, 22, 8, 82, 72, 82);
    g.fillStyle(0x803898, 1).fillTriangle(40, 30, 24, 82, 56, 82);
    g.fillStyle(0x201018, 1).fillCircle(40, 20, 13);
    g.fillStyle(0xc8b8e0, 1).fillCircle(40, 20, 11);
    g.fillStyle(0xf83858, 1).fillRect(34, 18, 4, 3).fillRect(43, 18, 4, 3);
    g.fillStyle(0x201018, 1).fillTriangle(30, 12, 22, -2, 34, 8).fillTriangle(50, 12, 58, -2, 46, 8);
    g.fillStyle(0x987048, 1).fillTriangle(30, 11, 24, 1, 33, 8).fillTriangle(50, 11, 56, 1, 47, 8);
    g.fillStyle(0xf8d048, 1).fillCircle(40, 40, 4);
    g.fillStyle(0xf858f8, 1).fillCircle(40, 40, 2);
    out("boss_queen", 80, 86);
    g.destroy();
}

// ---------------------------------------------------------------------------
// タイル(16x16)。テーマの色でキャンバスに描く
// ---------------------------------------------------------------------------
export const T = 16;
export const TILE = {
    groundTop: 0, ground: 1, block: 2, su: 3, sd: 4, g1: 5, g2: 6, g3: 7, g4: 8,
    oneway: 9, crumble: 10, spike: 11, lavaTop: 12, lava: 13, iceTop: 14, ice: 15, ceiling: 16,
};
const TILE_COUNT = 17;

const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;

export function makeTileset(scene, theme) {
    const key = `tiles_${theme.key}`;
    if (scene.textures.exists(key)) return key;
    const cv = document.createElement("canvas");
    cv.width = T * TILE_COUNT;
    cv.height = T;
    const c = cv.getContext("2d");
    const P = theme.tile;
    const rect = (i, x, y, w, h, col) => { c.fillStyle = hex(col); c.fillRect(i * T + x, y, w, h); };
    const dirt = (i) => {
        rect(i, 0, 0, T, T, P.dirt);
        for (let k = 0; k < 7; k++) rect(i, (k * 7 + 3) % 15, (k * 5 + 2) % 15, 2, 2, P.dirtD);
        rect(i, (i * 3) % 13, 9, 1, 1, P.dirtL);
    };
    // 地面の上面(芝や岩の縁)
    dirt(TILE.groundTop);
    rect(TILE.groundTop, 0, 0, T, 5, P.top);
    rect(TILE.groundTop, 0, 0, T, 1, P.topL);
    for (let x = 0; x < T; x += 3) rect(TILE.groundTop, x, 5, 2, 1 + (x % 2), P.top);
    dirt(TILE.ground);
    // ブロック(レンガ)
    rect(TILE.block, 0, 0, T, T, P.block);
    rect(TILE.block, 0, 0, T, 1, P.blockL);
    rect(TILE.block, 0, 7, T, 1, P.blockD);
    rect(TILE.block, 0, 15, T, 1, P.blockD);
    rect(TILE.block, 7, 0, 1, 7, P.blockD);
    rect(TILE.block, 3, 8, 1, 7, P.blockD);
    rect(TILE.block, 12, 8, 1, 7, P.blockD);
    // 坂: 斜面の下を土で塗り、斜面に沿って芝を描く
    const slope = (i, f) => {
        for (let x = 0; x < T; x++) {
            const y = Math.round(f(x + 0.5));
            rect(i, x, y, 1, T - y, P.dirt);
            if ((x * 7 + y) % 5 === 0 && y + 6 < T) rect(i, x, y + 6, 1, 2, P.dirtD);
            rect(i, x, y, 1, 4, P.top);
            rect(i, x, y, 1, 1, P.topL);
        }
    };
    slope(TILE.su, (x) => T - x);
    slope(TILE.sd, (x) => x);
    slope(TILE.g1, (x) => T - x / 2);
    slope(TILE.g2, (x) => T / 2 - x / 2);
    slope(TILE.g3, (x) => x / 2);
    slope(TILE.g4, (x) => T / 2 + x / 2);
    // 乗れる足場(下から抜けられる)
    rect(TILE.oneway, 0, 0, T, 5, P.plank);
    rect(TILE.oneway, 0, 0, T, 1, P.plankL);
    rect(TILE.oneway, 0, 4, T, 1, P.plankD);
    rect(TILE.oneway, 2, 5, 2, 3, P.plankD);
    rect(TILE.oneway, 12, 5, 2, 3, P.plankD);
    // くずれる床
    rect(TILE.crumble, 0, 0, T, T, P.crumble);
    rect(TILE.crumble, 0, 0, T, 1, 0xf8f8f8);
    rect(TILE.crumble, 3, 2, 1, 6, P.dirtD); rect(TILE.crumble, 4, 7, 4, 1, P.dirtD); rect(TILE.crumble, 8, 8, 1, 6, P.dirtD); rect(TILE.crumble, 11, 1, 1, 5, P.dirtD);
    rect(TILE.crumble, 0, 15, T, 1, P.dirtD);
    // とげ
    for (let k = 0; k < 4; k++) {
        for (let y = 0; y < 8; y++) {
            const w = Math.max(1, Math.round((y + 1) / 2));
            rect(TILE.spike, k * 4 + 2 - Math.floor(w / 2), 8 + y, w, 1, y < 2 ? 0xf8f8f8 : 0xa8a8c0);
        }
    }
    // 溶岩
    rect(TILE.lavaTop, 0, 4, T, 12, 0xe83818);
    rect(TILE.lavaTop, 0, 4, T, 2, 0xf8a838);
    rect(TILE.lavaTop, 3, 3, 4, 1, 0xf8d838); rect(TILE.lavaTop, 10, 2, 3, 2, 0xf8a838);
    rect(TILE.lava, 0, 0, T, T, 0xc82810);
    rect(TILE.lava, 4, 6, 3, 2, 0xe85818); rect(TILE.lava, 11, 12, 2, 2, 0xe85818);
    // 氷
    rect(TILE.iceTop, 0, 0, T, T, 0x88c8f0);
    rect(TILE.iceTop, 0, 0, T, 3, 0xe8f8f8);
    rect(TILE.iceTop, 2, 5, 5, 1, 0xd8f0f8); rect(TILE.iceTop, 9, 9, 4, 1, 0xd8f0f8);
    rect(TILE.ice, 0, 0, T, T, 0x6098d0);
    rect(TILE.ice, 3, 4, 4, 1, 0x88c8f0); rect(TILE.ice, 9, 11, 5, 1, 0x88c8f0);
    // 天井(洞窟)
    dirt(TILE.ceiling);
    rect(TILE.ceiling, 0, T - 3, T, 3, P.dirtD);
    for (let x = 1; x < T; x += 5) rect(TILE.ceiling, x, T - 1, 2, 1, 0x201018);
    scene.textures.addCanvas(key, cv);
    return key;
}

// ---------------------------------------------------------------------------
// 背景(空はグラデーション、遠景と近景は横に繰り返すテクスチャ)
// ---------------------------------------------------------------------------
export function makeBackdrop(scene, theme) {
    const far = `far_${theme.key}`, near = `near_${theme.key}`;
    if (scene.textures.exists(far)) return { far, near };
    const B = theme.back;
    const g = scene.add.graphics();
    const W = 256;
    // 遠景
    if (B.far === "hills" || B.far === "mountains" || B.far === "ice") {
        const peaks = B.far === "hills" ? [[0, 70], [40, 40], [90, 64], [140, 30], [200, 58], [256, 70]] : [[0, 90], [30, 30], [64, 70], [110, 14], [150, 64], [196, 24], [240, 80], [256, 90]];
        g.fillStyle(B.farCol, 1);
        g.beginPath(); g.moveTo(0, 120);
        peaks.forEach(([x, y]) => g.lineTo(x, y));
        g.lineTo(256, 120); g.closePath(); g.fillPath();
        if (B.far !== "hills") {
            g.fillStyle(B.snow, 1);
            peaks.forEach(([x, y]) => { if (y < 40) g.fillTriangle(x - 8, y + 10, x, y, x + 8, y + 10); });
        }
    } else if (B.far === "castle") {
        g.fillStyle(B.farCol, 1);
        g.fillRect(0, 90, W, 30);
        [[20, 40, 24], [70, 20, 30], [120, 50, 20], [170, 10, 34], [220, 46, 22]].forEach(([x, y, w]) => {
            g.fillRect(x, y, w, 120 - y);
            g.fillTriangle(x - 3, y, x + w / 2, y - 22, x + w + 3, y);
            g.fillStyle(0xf8d878, 0.8).fillRect(x + w / 2 - 2, y + 14, 4, 6);
            g.fillStyle(B.farCol, 1);
        });
    } else if (B.far === "cave") {
        g.fillStyle(B.farCol, 1);
        for (let x = 0; x < W; x += 16) {
            const h = 20 + ((x * 37) % 50);
            g.fillTriangle(x, 0, x + 8, h, x + 16, 0);
            g.fillTriangle(x + 4, 120, x + 12, 120 - h * 0.8, x + 20, 120);
        }
    } else if (B.far === "forest") {
        g.fillStyle(B.farCol, 1);
        for (let x = -10; x < W + 10; x += 22) {
            const h = 50 + ((x * 13) % 40);
            g.fillTriangle(x, 120, x + 14, 120 - h, x + 28, 120);
        }
    }
    g.generateTexture(far, W, 120);
    g.clear();
    // 近景
    if (B.near === "bushes") {
        g.fillStyle(B.nearCol, 1);
        for (let x = 0; x < W; x += 32) g.fillCircle(x + 16, 60, 18 + (x % 3) * 4).fillCircle(x + 2, 66, 14);
        g.fillRect(0, 62, W, 20);
        g.fillStyle(0xf8f8f8, 0.7);
        for (let x = 6; x < W; x += 29) g.fillRect(x, 58 - (x % 7), 2, 2);
    } else if (B.near === "trees") {
        for (let x = 0; x < W; x += 64) {
            g.fillStyle(B.trunk, 1).fillRect(x + 26, 30, 10, 52);
            g.fillStyle(B.nearCol, 1).fillCircle(x + 31, 26, 24).fillCircle(x + 14, 38, 16).fillCircle(x + 48, 38, 16);
        }
    } else if (B.near === "rocks") {
        g.fillStyle(B.nearCol, 1);
        for (let x = 0; x < W; x += 40) g.fillTriangle(x, 82, x + 18, 30 + (x % 3) * 10, x + 40, 82);
        g.fillStyle(0xf86818, 0.6);
        for (let x = 10; x < W; x += 50) g.fillRect(x, 70, 6, 2);
    } else if (B.near === "pines") {
        for (let x = 0; x < W; x += 32) {
            g.fillStyle(B.nearCol, 1).fillTriangle(x + 4, 82, x + 16, 20 + (x % 3) * 8, x + 28, 82);
            g.fillStyle(0xf8f8f8, 1).fillTriangle(x + 11, 40 + (x % 3) * 8, x + 16, 20 + (x % 3) * 8, x + 21, 40 + (x % 3) * 8);
        }
    } else if (B.near === "pillars") {
        g.fillStyle(B.nearCol, 1);
        for (let x = 0; x < W; x += 64) {
            g.fillRect(x + 20, 10, 18, 72);
            g.fillRect(x + 16, 6, 26, 6);
            g.fillStyle(0xf89838, 1).fillRect(x + 27, 24, 4, 6);
            g.fillStyle(B.nearCol, 1);
        }
        g.fillRect(0, 0, W, 6);
    }
    g.generateTexture(near, W, 82);
    g.destroy();
    return { far, near };
}

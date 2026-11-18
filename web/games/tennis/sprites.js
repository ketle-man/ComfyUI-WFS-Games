/**
 * SMASH HEART のドット絵(すべてオリジナル)。文字1つ = 1ドット、"." は透明。
 * 体と顔は髪型・色を差し替えて作る。ラケットは別のスプライトにして、腕の振りは回転で表す。
 */
import { pixelTexture } from "../../common/retro.js?v=0.4.1";

const hex = (s) => parseInt(String(s).replace("#", ""), 16);

// 後ろから見たヒロイン(14x21)。ポニーテール・白いウェア・ピンクのサンバイザー
const BACK_TOP = [
    ".....KKKK.....",
    "....KPPPPK....",
    "....KHHHHK....",
    "....KHHHHK....",
    ".....KhhK.....",
    ".....KHHK.....",
    "...KKWHHWKK...",
    "..KSKWWhWWKSK.",
    "..KSKWWWWWKSK.",
    "..KSKWWWWWKSK.",
    "..KK.KwwwK.KK.",
    ".....KWWWK....",
    "....KWWWWWK...",
    "....KWWWWWK...",
    "....KwwwwwK...",
];
const LEGS = {
    stand: [
        ".....KS.SK....",
        ".....KS.SK....",
        ".....KS.SK....",
        ".....KS.SK....",
        ".....KW.WK....",
        "....KWW.WWK...",
    ],
    run1: [
        "....KS...SK...",
        "....KS...SK...",
        "...KS.....SK..",
        "...KS.....SK..",
        "...KW.....WK..",
        "..KWW....KWW..",
    ],
    run2: [
        "......KSSK....",
        "......KSSK....",
        "......KSSK....",
        "......KSSK....",
        "......KWWK....",
        ".....KWWWWK...",
    ],
};

// 前から見たライバル(14x21)。髪型ごとに髪の部分を描き足す
const FRONT_TOP = [
    ".....KKKK.....",
    "....KHHHHK....",
    "...KHHHHHHK...",
    "...KHSSSSHK...",
    "...KSESSESK...",
    "...KSSSSSSK...",
    "....KSNNSK....",
    ".....KSSK.....",
    "...KKOOOOKK...",
    "..KSKOOOOOKSK.",
    "..KSKOOOOOKSK.",
    "..KK.KooooK.KK",
    ".....KOOOK....",
    "....KQQQQQK...",
    "....KQQQQQK...",
];
// 髪型: [x, y] に H(髪) / h(髪の影) を置く
const HAIR = {
    long: [[2, 3, "H"], [2, 4, "H"], [2, 5, "H"], [2, 6, "h"], [2, 7, "h"], [11, 3, "H"], [11, 4, "H"], [11, 5, "H"], [11, 6, "h"], [11, 7, "h"]],
    twin: [[1, 2, "H"], [0, 3, "H"], [1, 3, "H"], [0, 4, "H"], [0, 5, "h"], [12, 2, "H"], [13, 3, "H"], [12, 3, "H"], [13, 4, "H"], [13, 5, "h"]],
    bob: [[2, 3, "H"], [2, 4, "H"], [2, 5, "h"], [11, 3, "H"], [11, 4, "H"], [11, 5, "h"]],
    short: [],
};

// 顔グラフィック(16x16)
const FACE = [
    "....KKKKKKK.....",
    "...KHHHHHHHK....",
    "..KHHHHHHHHHK...",
    "..KHHHHHHHHHK...",
    ".KHHSSHHHSSHHK..",
    ".KHSSSSSSSSSHK..",
    ".KHSKESSSKESHK..",
    ".KHSSESSSSESHK..",
    ".KHSSSSSSSSSHK..",
    ".KHsSSSNNSSsHK..",
    "..KHsSSSSSsHK...",
    "...KKSSSSSKK....",
    "...KOOKSKOOK....",
    "..KOOOWOWOOOK...",
    ".KOOOOWWWOOOOK..",
    ".KOOOOOWOOOOOK..",
];
const FACE_HAIR = {
    long: [[1, 9, "H"], [1, 10, "H"], [1, 11, "h"], [13, 9, "H"], [13, 10, "H"], [13, 11, "h"], [2, 11, "H"], [12, 11, "H"]],
    twin: [[0, 3, "H"], [0, 4, "H"], [0, 5, "H"], [0, 6, "h"], [14, 3, "H"], [14, 4, "H"], [14, 5, "H"], [14, 6, "h"], [15, 4, "H"], [15, 5, "h"]],
    bob: [[1, 9, "H"], [1, 10, "h"], [13, 9, "H"], [13, 10, "h"]],
    short: [],
    // ヒロイン: ポニーテールとサンバイザー
    pony: [[13, 1, "H"], [14, 2, "H"], [14, 3, "H"], [15, 4, "H"], [15, 5, "h"], [3, 3, "P"], [4, 3, "P"], [5, 3, "P"], [6, 3, "P"], [7, 3, "P"], [8, 3, "P"], [9, 3, "P"], [10, 3, "P"], [11, 3, "P"]],
};

const RACKET = [
    ".RRR.",
    "RrrrR",
    "RrrrR",
    "RrrrR",
    "RrrrR",
    ".RRR.",
    "..G..",
    "..G..",
    "..G..",
    "..G..",
];
const BALL = [".YY.", "YYYY", "YYYY", ".YY."];
const HEART = [
    ".MM...MM.",
    "MPPM.MPPM",
    "MPWPMPPPM",
    "MPPPPPPPM",
    ".MPPPPPM.",
    "..MPPPM..",
    "...MPM...",
    "....M....",
];

// サーブ用の体: 上に4行足して、片腕を頭の上まで伸ばす(ラケットはその手に付ける)
const UP_ROWS = 4;
const BLANK = "..............";

/** 腕を上げた体を作る。armCols: [外側の輪郭, 腕, 内側の輪郭] の列、clear: 下ろした腕を消す [列, 行] の一覧(元の行番号) */
function raiseArm(body, armCols, clear) {
    const rows = [...Array(UP_ROWS).fill(BLANK), ...body];
    const pts = [];
    for (const [x, y] of clear) pts.push([x, y + UP_ROWS, "."]);
    const shoulder = armCols.shoulderRow + UP_ROWS;
    for (let y = 1; y <= shoulder; y++) {
        pts.push([armCols.cols[0], y, "K"], [armCols.cols[1], y, "S"], [armCols.cols[2], y, "K"]);
    }
    pts.push([armCols.cols[1], 0, "K"]);
    return overlay(rows, pts);
}
// 後ろから見たヒロイン: 右腕(画面の右、列10〜12)を上げると打つ形、左腕(列2〜4)を上げるとトス
const HERO_ARMS = {
    serve: { cols: [10, 11, 12], shoulderRow: 7, clear: [[11, 7], [12, 7], [11, 8], [12, 8], [11, 9], [12, 9], [11, 10], [12, 10]] },
    toss: { cols: [2, 3, 4], shoulderRow: 7, clear: [[2, 7], [3, 7], [2, 8], [3, 8], [2, 9], [3, 9], [1, 10], [2, 10], [3, 10]] },
};
// 前から見たライバル: 右腕は画面の左(列1〜3)、左腕は画面の右(列10〜12)
const RIVAL_ARMS = {
    serve: { cols: [1, 2, 3], shoulderRow: 9, clear: [[2, 9], [3, 9], [2, 10], [3, 10], [2, 11], [3, 11]] },
    toss: { cols: [10, 11, 12], shoulderRow: 9, clear: [[11, 9], [12, 9], [11, 10], [12, 10], [12, 11], [13, 11]] },
};

function overlay(rows, pts) {
    const out = rows.map((r) => [...r]);
    for (const [x, y, ch] of pts) {
        if (out[y] && x >= 0 && x < out[y].length) out[y][x] = ch;
    }
    return out.map((r) => r.join(""));
}

const BASE = { K: 0x101018, S: 0xf8d0a8, s: 0xd89878, N: 0xc84828, W: 0xf8f8f8, w: 0xc8c8d0 };

/** 共通のテクスチャ(ヒロイン・ボール・ハート・ラケット・影) */
export function makeTennisTextures(scene) {
    const heroPal = { ...BASE, H: 0x985828, h: 0x683818, P: 0xf878b8, E: 0xd89838, O: 0xf8f8f8 };
    for (const [k, legs] of Object.entries(LEGS)) pixelTexture(scene, `hero_${k}`, [...BACK_TOP, ...legs], heroPal, 2);
    for (const [k, arm] of Object.entries(HERO_ARMS)) pixelTexture(scene, `hero_${k}`, raiseArm([...BACK_TOP, ...LEGS.stand], arm, arm.clear), heroPal, 2);
    pixelTexture(scene, "hero_face", overlay(FACE, FACE_HAIR.pony), heroPal, 3);
    pixelTexture(scene, "racket", RACKET, { R: 0xe83838, r: 0xe8e8d8, G: 0x303038 }, 2);
    pixelTexture(scene, "racket_r", RACKET, { R: 0x3878f8, r: 0xe8e8d8, G: 0x303038 }, 2);
    pixelTexture(scene, "ball", BALL, { Y: 0xd8f048 }, 2);
    pixelTexture(scene, "heart", HEART, { M: 0xe858e8, P: 0xf8a8f8, W: 0xf8f8f8 }, 2);
    pixelTexture(scene, "heart_s", HEART, { M: 0xe858e8, P: 0xf8a8f8, W: 0xf8f8f8 }, 1);
    pixelTexture(scene, "shadow", [".KKKKKK.", "KKKKKKKK", ".KKKKKK."], { K: 0x000000 }, 2);
}

/** ライバルごとのテクスチャ(色・髪型を差し替え) */
export function makeRivalTextures(scene, rival) {
    const id = rival.id;
    const pal = {
        ...BASE, H: hex(rival.hair), h: hex(rival.hairDark), E: hex(rival.eyes),
        O: hex(rival.outfit), o: hex(rival.outfit2), Q: hex(rival.outfit2), P: hex(rival.outfit2),
    };
    const top = overlay(FRONT_TOP, HAIR[rival.style] || []);
    for (const [k, legs] of Object.entries(LEGS)) pixelTexture(scene, `rival_${id}_${k}`, [...top, ...legs], pal, 2);
    for (const [k, arm] of Object.entries(RIVAL_ARMS)) pixelTexture(scene, `rival_${id}_${k}`, raiseArm([...top, ...LEGS.stand], arm, arm.clear), pal, 2);
    pixelTexture(scene, `rival_${id}_face`, overlay(FACE, FACE_HAIR[rival.style] || []), pal, 3);
}

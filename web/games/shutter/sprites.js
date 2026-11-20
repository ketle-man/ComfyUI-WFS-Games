/**
 * SHUTTER HEART のドット絵(すべてオリジナル)。
 * ヒロイン「ユイ」は正面向きのちびキャラ(16x25)。頭・胴・脚を組み合わせ、手などを上書きしてポーズを作る。
 * D/d = 服(ステージごとに色を替える)、A = 服のアクセント、B = 靴
 */
import { pixelTexture } from "../../common/retro.js";

const HEAD = {
    front: [
        "...RR......RR...",
        "..RRRRhhhhRRRR..",
        "...RhHHHHHHhR...",
        "..hHHHHHHHHHHh..",
        ".hHHHHHHHHHHHHh.",
        ".hHHSHHHHHHSHHh.",
        ".hHSSSSSSSSSSHh.",
        ".hHSEESSSSEESHh.",
        ".hHSEWSSSSEWSHh.",
        ".hHHSpSMMSpSHHh.",
        "..hH.SSSSSS.Hh..",
    ],
    wink: [
        "...RR......RR...",
        "..RRRRhhhhRRRR..",
        "...RhHHHHHHhR...",
        "..hHHHHHHHHHHh..",
        ".hHHHHHHHHHHHHh.",
        ".hHHSHHHHHHSHHh.",
        ".hHSSSSSSSSSSHh.",
        ".hHSSSSSSSEESHh.",
        ".hHSEESSSSEWSHh.",
        ".hHHSpSMMSpSHHh.",
        "..hH.SSSSSS.Hh..",
    ],
    surprise: [
        "...RR......RR...",
        "..RRRRhhhhRRRR..",
        "...RhHHHHHHhR...",
        "..hHHHHHHHHHHh..",
        ".hHHHHHHHHHHHHh.",
        ".hHHSHHHHHHSHHh.",
        ".hHSEESSSSEESHh.",
        ".hHSEESSSSEESHh.",
        ".hHSEWSSSSEWSHh.",
        ".hHHSpSMMSpSHHh.",
        "..hH.SSMMSS.Hh..",
    ],
    back: [
        "...RR......RR...",
        "..RRRRhhhhRRRR..",
        "...RhHHHHHHhR...",
        "..hHHHHHHHHHHh..",
        ".hHHHHHHHHHHHHh.",
        ".hHHHHHHHHHHHHh.",
        ".hHHHHHHHHHHHHh.",
        ".hHHHHHHHHHHHHh.",
        ".hHHHHHhhHHHHHh.",
        ".hHHHHhhhhHHHHh.",
        "..hHHH.SS.HHHh..",
    ],
};
const BODY = {
    down: [
        "......SSSS......",
        "....DDDDDDDD....",
        "...SDDDAADDDS...",
        "..SSDDDDDDDDSS..",
        "..SS.DDDDDD.SS..",
        "..S.DDDDDDDD.S..",
        "....DDDDDDDD....",
    ],
    back: [
        "......SSSS......",
        "....DDDDDDDD....",
        "...SDDDDDDDDS...",
        "..SSDDDDDDDDSS..",
        "..SS.DDDDDD.SS..",
        "..S.DDDDDDDD.S..",
        "....DDDDDDDD....",
    ],
    open: [ // 腕を体から離す(手を振る・バンザイの土台)
        "......SSSS......",
        "....DDDDDDDD....",
        "....DDDAADDD....",
        "....DDDDDDDD....",
        ".....DDDDDD.....",
        "....DDDDDDDD....",
        "....DDDDDDDD....",
    ],
    chest: [ // 胸の前で手を合わせる
        "......SSSS......",
        "....DDDDDDDD....",
        "...SDDDDDDDDS...",
        "...SSDDSSDDSS...",
        ".....SSSSSS.....",
        "....DDDSSDDD....",
        "....DDDDDDDD....",
    ],
};
const LEGS = {
    stand: [
        "...dDDDDDDDDd...",
        "....dddddddd....",
        ".....SS..SS.....",
        ".....SS..SS.....",
        ".....SS..SS.....",
        ".....SS..SS.....",
        "....BBB..BBB....",
    ],
    walk1: [
        "...dDDDDDDDDd...",
        "....dddddddd....",
        "....SS....SS....",
        "...SS......SS...",
        "...SS......SS...",
        "..BBB.....SS....",
        "..........BBB...",
    ],
    walk2: [
        "...dDDDDDDDDd...",
        "....dddddddd....",
        ".....SS..SS.....",
        ".....SS..SS.....",
        ".....SS...SS....",
        "....BBB...SS....",
        "..........BBB...",
    ],
    jump: [
        "...dDDDDDDDDd...",
        "....dddddddd....",
        "....SSS..SSS....",
        "...SS......SS...",
        "...BBB....BBB...",
    ],
    sit: [
        "..dDDDDDDDDDDd..",
        "..SSSddddddSSS..",
        "..SSS......SSS..",
        "..BBB......BBB..",
    ],
};

/** 文字列の重ね書き: [行, 列, "文字列"]("." は透明) */
function compose(head, body, legs, overlays = []) {
    const rows = [...head, ...body, ...legs].map((r) => r.split(""));
    for (const [r, c, s] of overlays) {
        [...s].forEach((ch, i) => {
            if (ch === "." || !rows[r] || c + i < 0 || c + i >= rows[r].length) return;
            rows[r][c + i] = ch;
        });
    }
    return rows.map((r) => r.join(""));
}

// 手の位置(画面の右 = ユイの左手)
const WAVE = [[5, 14, "SS"], [6, 14, "SS"], [7, 13, "SS"], [8, 13, "S"], [9, 12, "SS"], [10, 12, "S"], [11, 1, ".SS"], [12, 1, "SSS"], [13, 1, "SS"], [14, 2, "S"]];
const PEACE = [[5, 1, "S.S"], [6, 1, "SSS"], [7, 1, "SS"], [8, 2, "SS"], [9, 2, "SS"], [10, 3, "S"], [11, 3, "S"], [11, 12, "S"], [12, 12, "SS"], [13, 12, "SS"], [14, 13, "S"]];
const ARMS_UP = [[3, 0, "SS"], [4, 0, "SS"], [5, 0, "S"], [6, 1, "S"], [7, 1, "S"], [8, 1, "S"], [9, 2, "S"], [10, 2, "S"], [11, 3, "S"],
    [3, 14, "SS"], [4, 14, "SS"], [5, 15, "S"], [6, 14, "S"], [7, 14, "S"], [8, 14, "S"], [9, 13, "S"], [10, 13, "S"], [11, 12, "S"]];
const HEART = [[13, 5, "PP.PP"], [14, 5, "PPPPP"], [15, 6, "PPP"], [16, 7, "P"]];

/**
 * ポーズ定義: 絵・タグ・向き・決めポーズか
 *   facing: "front" | "back"、special: キラッと光る決めポーズ(タイミング点が高い)
 */
export const POSES = {
    stand: { frames: ["stand"], tags: "standing", expr: "smile", facing: "front" },
    walk: { frames: ["walk1", "stand", "walk2", "stand"], fps: 7, tags: "walking", expr: "smile", facing: "front" },
    wave: { frames: ["wave1", "wave2"], fps: 4, tags: "waving", expr: "open mouth, smile", facing: "front" },
    peace: { frames: ["peace"], tags: "peace sign, v", expr: "smile", facing: "front", special: true },
    wink: { frames: ["wink"], tags: "hand on hip", expr: "one eye closed, smile", facing: "front", special: true },
    heart: { frames: ["heart"], tags: "heart hands", expr: "blush, smile", facing: "front", special: true },
    jump: { frames: ["jump"], tags: "jumping, arms up", expr: "happy, open mouth", facing: "front", special: true },
    stretch: { frames: ["up"], tags: "arms up, stretching", expr: "closed eyes, smile", facing: "front" },
    sit: { frames: ["sit"], tags: "sitting", expr: "smile", facing: "front" },
    lookback: { frames: ["back"], tags: "from behind, looking back", expr: "smile", facing: "back", special: true },
    surprise: { frames: ["surprise"], tags: "surprised", expr: "open mouth", facing: "front" },
};

export const YUI_FRAMES = {
    stand: compose(HEAD.front, BODY.down, LEGS.stand),
    walk1: compose(HEAD.front, BODY.down, LEGS.walk1),
    walk2: compose(HEAD.front, BODY.down, LEGS.walk2),
    wave1: compose(HEAD.front, BODY.open, LEGS.stand, WAVE),
    wave2: compose(HEAD.front, BODY.open, LEGS.stand, WAVE.map(([r, c, s]) => (r < 11 ? [r, c - 1, s] : [r, c, s]))),
    peace: compose(HEAD.front, BODY.open, LEGS.stand, PEACE),
    wink: compose(HEAD.wink, BODY.down, LEGS.stand, [[13, 13, "S"], [14, 12, "SS"], [15, 13, "."]]),
    heart: compose(HEAD.front, BODY.chest, LEGS.stand, HEART),
    jump: compose(HEAD.front, BODY.open, LEGS.jump, ARMS_UP),
    up: compose(HEAD.front, BODY.open, LEGS.stand, ARMS_UP),
    sit: compose(HEAD.front, BODY.down, LEGS.sit),
    back: compose(HEAD.back, BODY.back, LEGS.stand, [[9, 12, "S"], [10, 13, "SS"]]),
    surprise: compose(HEAD.surprise, BODY.open, LEGS.stand, [[12, 2, "SS"], [11, 1, "SS"], [12, 12, "SS"], [11, 13, "SS"]]),
};
// 目を閉じたバンザイ(のび): 目の行を線にする
YUI_FRAMES.up = YUI_FRAMES.up.map((r, i) => (i === 7 ? r.slice(0, 3) + "SSSSSSSSSS" + r.slice(13) : i === 8 ? r.slice(0, 3) + "SkkSSSSkkS" + r.slice(13) : r));

// 体のどこが何行目か(全身 25 行に対する割合。構図の判定に使う)
export const BODY_MARKS = { chin: 10.5 / 25, chest: 14 / 25, waist: 16.5 / 25, hips: 18 / 25, knee: 21.5 / 25, ankle: 23.5 / 25 };

const FACE = [
    "...RR......RR...",
    "..RRRRhhhhRRRR..",
    "...RhHHHHHHhR...",
    "..hHHHHHHHHHHh..",
    ".hHHHHHHHHHHHHh.",
    ".hHHSHHHHHHSHHh.",
    ".hHSSSSSSSSSSHh.",
    ".hHSEESSSSEESHh.",
    ".hHSEWSSSSEWSHh.",
    ".hHHSpSMMSpSHHh.",
    "..hH.SSSSSS.Hh..",
    "..hh..SSSS..hh..",
    "...DDDDDDDDDD...",
    "..DDDDDAADDDDD..",
    ".DDDDDDDDDDDDDD.",
    ".DDDDDDDDDDDDDD.",
];

const BASE_PAL = {
    H: 0xc88a58, h: 0x8a5838, R: 0xf85898, S: 0xf8dcc4, E: 0x402858, W: 0xf8f8f8, M: 0xd84860, p: 0xf8b0b0,
    P: 0xf84878, k: 0x402858,
};

/** ステージの服でヒロインのテクスチャを作る(キーにテーマ名) */
export function makeYuiTextures(scene, theme) {
    const pal = { ...BASE_PAL, D: theme.outfit.D, d: theme.outfit.d, A: theme.outfit.A, B: theme.outfit.B };
    for (const [name, rows] of Object.entries(YUI_FRAMES)) {
        // 下の空行を除く(足元を揃える)
        let n = rows.length;
        while (n > 0 && !/[^.]/.test(rows[n - 1])) n--;
        pixelTexture(scene, `yui_${theme.key}_${name}`, rows.slice(0, n), pal, 1);
    }
    pixelTexture(scene, "yui_face", FACE, { ...BASE_PAL, D: 0xf8f8f8, A: 0xf85898 }, 2);
}

// ---------------------------------------------------------------------------
// 写り込むもの・小物
// ---------------------------------------------------------------------------
const PERSON = [
    "....KKKK....",
    "...KHHHHK...",
    "...KSSSSK...",
    "...KSSSSK...",
    "....KSSK....",
    "..KCCCCCCK..",
    ".KCCCCCCCCK.",
    ".KSCCCCCCSK.",
    ".KSCCCCCCSK.",
    "..KCCCCCCK..",
    "..KLLLLLLK..",
    "..KLLK.KLLK.",
    "..KLL..KLLK.",
    "..KLL...KLK.",
    "..KKK...KKK.",
];
const GULL1 = [
    "KK........KK",
    ".KWK....KWK.",
    "..KWWKKWWK..",
    "....KWWK....",
    ".....KK.....",
];
const GULL2 = [
    "............",
    "............",
    ".KKWWKKWWKK.",
    "KWW.KWWK.WWK",
    ".....KK.....",
];
const HEART_ITEM = [
    ".KK.KK.",
    "KPPKPPK",
    "KPWPPPK",
    "KPPPPPK",
    ".KPPPK.",
    "..KPK..",
    "...K...",
];
const CAMERA_ICON = [
    "...KKK....",
    "KKKKKKKKKK",
    "KAAAKKAAAK",
    "KAAKWWKAAK",
    "KAAKWWKAAK",
    "KAAAKKAAAK",
    "KKKKKKKKKK",
];

export function makeCommonTextures(scene) {
    pixelTexture(scene, "gull1", GULL1, { K: 0x404050, W: 0xf8f8f8 });
    pixelTexture(scene, "gull2", GULL2, { K: 0x404050, W: 0xf8f8f8 });
    pixelTexture(scene, "heart", HEART_ITEM, { K: 0x401028, P: 0xf85898, W: 0xf8f8f8 });
    pixelTexture(scene, "heart_s", HEART_ITEM, { K: 0x401028, P: 0xf85898, W: 0xf8f8f8 }, 1);
    pixelTexture(scene, "camera", CAMERA_ICON, { K: 0x202028, A: 0x8890a8, W: 0x58e8f8 });
    if (!scene.textures.exists("spark")) {
        const g = scene.add.graphics();
        g.fillStyle(0xffffff, 1).fillRect(0, 0, 3, 3);
        g.generateTexture("spark", 3, 3);
        g.clear();
        // キラッ(決めポーズの合図)
        g.fillStyle(0xffffff, 1).fillTriangle(7, 0, 9, 7, 5, 7).fillTriangle(7, 16, 9, 9, 5, 9).fillTriangle(0, 8, 7, 6, 7, 10).fillTriangle(16, 8, 9, 6, 9, 10);
        g.generateTexture("twinkle", 16, 16);
        g.destroy();
    }
}

/** 通行人(服の色を変えて数種類) */
export function makePeople(scene, key, colors) {
    colors.forEach((c, i) => {
        pixelTexture(scene, `${key}_person${i}`, PERSON, { K: 0x202028, H: c.hair, S: 0xe8c0a0, C: c.top, L: c.bottom }, 1);
    });
}

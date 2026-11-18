/**
 * SKY HEART のドット絵(すべてオリジナル)と、ステージごとの背景の生成。
 * 文字1つ = 1ドット、"." は透明。pixelTexture() でテクスチャにする。
 */
import { pixelTexture } from "../../common/retro.js";

// ヒロイン「ヒカリ」を後ろから見た姿(ジェットパックで飛ぶ)。16x20
const HIKARI_BACK = [
    "......KKKK......",
    ".....KHHHHK.....",
    "....KHHHHHHK....",
    "....KHhHHhHK....",
    "...KSKHHHHKSK...",
    "..KSSKHHHHKSSK..",
    "..KSKJJHHJJKSK..",
    "..KK.KJHHJK.KK..",
    "....KBJHHJBK....",
    "....KBJhhJBK....",
    "....KBJJJJBK....",
    "....KbBBBBbK....",
    "....KBBWWBBK....",
    ".....KBBBBK.....",
    ".....KB..BK.....",
    ".....KB..BK.....",
    ".....KW..WK.....",
    ".....KK..KK.....",
    "......Y..Y......",
    "......O..O......",
];
const HIKARI_PAL = {
    K: 0x101018, H: 0xe0e8f8, h: 0x98a8d8, S: 0xf8d0a8, B: 0x3878f8, b: 0x1838a8,
    W: 0xf8f8f8, J: 0x9098a8, Y: 0xf8f048, O: 0xf89838,
};

// 顔グラフィック (16x16)
const HIKARI_FACE = [
    "....KKKKKKK.....",
    "...KHHHHHHHK....",
    "..KHHHHHHHHHK...",
    "..KGGGGGGGGGK...",
    ".KHHSSHHHSSHHK..",
    ".KHSSSSSSSSSHK..",
    ".KHSKESSSKESHK..",
    ".KHSSESSSSESHK..",
    ".KHSSSSSSSSSHK..",
    ".KHsSSSNNSSsHK..",
    ".KHHsSSSSSsHHK..",
    ".KH.KKSSSKK.HK..",
    "...KBBKSKBBK....",
    "..KBBBWBWBBBK...",
    ".KBBBBWWWBBBBK..",
    ".KBBBBBWBBBBBK..",
];
const FACE_PAL = { ...HIKARI_PAL, G: 0x40c8f8, E: 0x3878f8, s: 0xd89878, N: 0xc84828 };

// 敵(すべてオリジナル)
const DRONE = [
    "....KKKK....",
    "..KKAAAAKK..",
    ".KAAWWAAAAK.",
    "KAAAAAAAAAAK",
    "KDDDDDDDDDDK",
    ".KDRDDDDRDK.",
    "..KKDDDDKK..",
    "....KKKK....",
];
const WING = [
    "K............K",
    "KA..........AK",
    "KAA...KK...AAK",
    ".KAA.KRRK.AAK.",
    "..KAAKRRKAAK..",
    "...KAAAAAAK...",
    "....KDDDDK....",
    ".....K..K.....",
];
const ORB = [
    "...KKKK...",
    "..KAAAAK..",
    ".KAWWWWAK.",
    "KAWWRRWWAK",
    "KAWRKKRWAK",
    "KAWWRRWWAK",
    ".KAWWWWAK.",
    "..KAAAAK..",
    "...KDDK...",
    "....KK....",
];
const JET = [
    ".....KK.....",
    "....KAAK....",
    "....KWAK....",
    "...KAAAAK...",
    "..KAAAAAAK..",
    ".KAADAADAAK.",
    "KAAKDAADKAAK",
    "KAK.KRRK.KAK",
    "KK...YY...KK",
];
const ENEMY_COLORS = {
    drone: { A: 0x58e858, D: 0x188838, W: 0xf8f8f8, R: 0xf85858, K: 0x101018 },
    wing: { A: 0xe858e8, D: 0x8828a8, R: 0xf8f048, K: 0x101018 },
    orb: { A: 0xf89838, D: 0xa84818, W: 0xf8f8f8, R: 0xe83838, K: 0x101018 },
    jet: { A: 0x58c8f8, D: 0x1868b8, W: 0xf8f8f8, R: 0xf85858, Y: 0xf8f048, K: 0x101018 },
};

// ボス(すべてオリジナル)。24 ドット幅前後のドット絵を大きく拡大して使う
const BOSS_BIRD = [
    "K......................K",
    "KA....................AK",
    "KAA.......KKKK.......AAK",
    ".KAA.....KDDDDK.....AAK.",
    ".KAAA...KDWWWWDK...AAAK.",
    "..KAAA.KDWRRRRWDK.AAAK..",
    "..KAAAAKDWRKKRWDKAAAAK..",
    "...KAAAKDWRRRRWDKAAAK...",
    "...KAAAAKDWWWWDKAAAAK...",
    "....KAAAAKDDDDKAAAAK....",
    "....KTTKAAKDDKAAKTTK....",
    ".....KTK.KAAAAK.KTK.....",
    "......K...KAAK...K......",
    "...........KK...........",
];
const BOSS_CORE = [
    "........KKKKKKKK........",
    "......KKAAAAAAAAKK......",
    "....KKAAWWAAAAAAAAKK....",
    "...KAAWWAAAAAAAAAAAAK...",
    "..KAAAAAKKKKKKKKAAAAAK..",
    "..KAAAKKDDDDDDDDKKAAAK..",
    ".KAAAKDDDWWWWDDDDDKAAAK.",
    ".KAAKDDWWRRRRWWDDDDKAAK.",
    "KTAAKDDWRRKKRRWDDDDKAATK",
    "KTAAKDDWRRKKRRWDDDDKAATK",
    ".KAAKDDWWRRRRWWDDDDKAAK.",
    ".KAAAKDDDWWWWDDDDDKAAAK.",
    "..KAAAKKDDDDDDDDKKAAAK..",
    "..KAAAAAKKKKKKKKAAAAAK..",
    "...KAAAAAAAAAAAAAAAAK...",
    "....KKAAAAAAAAAAAAKK....",
    "......KKAAAAAAAAKK......",
    "........KKKKKKKK........",
];
const BOSS_FORT = [
    "..........KKKK..........",
    ".........KWWWWK.........",
    "....KK...KWRRWK...KK....",
    "...KTTK..KWWWWK..KTTK...",
    "...KTTK.KAAAAAAK.KTTK...",
    "KKKKAAKKAAAAAAAAKKAAKKKK",
    "KAAAAAAAAAAAAAAAAAAAAAAK",
    "KADDDDDDDDDDDDDDDDDDDDAK",
    "KADYDDYDDYDDDDYDDYDDYDAK",
    "KADDDDDDDDDDDDDDDDDDDDAK",
    ".KAAAAAAAAAAAAAAAAAAAAK.",
    "..KAAKKAAAAAAAAAAKKAAK..",
    "...KK..KRRK..KRRK..KK...",
    "........KK....KK........",
];
const BOSS_MECH = [
    ".......KKKKKKKKKK.......",
    "......KAAAAAAAAAAK......",
    ".....KAAWWWWWWWWAAK.....",
    ".....KAWRRRRRRRRWAK.....",
    ".....KAWRKRRRRKRWAK.....",
    ".....KAAWWWWWWWWAAK.....",
    "..KKKKKAAAAAAAAAAKKKKK..",
    ".KTTTKKDDDDDDDDDDKKTTTK.",
    "KTTTTKADDDYYYYDDDAKTTTTK",
    "KTTTKAADDDDDDDDDDAAKTTTK",
    ".KTK.KAADDDDDDDDAAK.KTK.",
    ".KTK..KAAAAAAAAAAK..KTK.",
    "..K....KAAK..KAAK....K..",
    "......KAAK....KAAK......",
    "......KKK......KKK......",
];
const BOSS_PAL = {
    bird: { A: 0x58c8f8, D: 0x1868b8, W: 0xf8f8f8, R: 0xf85858, T: 0xf8f048, K: 0x101018 },
    core: { A: 0xc898f8, D: 0x5828a8, W: 0xf8f8f8, R: 0xf858f8, T: 0x58e8f8, K: 0x101018 },
    fortress: { A: 0xa8a8b8, D: 0x585868, W: 0xf8f8f8, R: 0xf85858, Y: 0xf8f048, T: 0xf89838, K: 0x101018 },
    mech: { A: 0xf858f8, D: 0x882888, W: 0xf8f8f8, R: 0x58e8f8, Y: 0xf8f048, T: 0x58e858, K: 0x101018 },
    final: { A: 0xf8d048, D: 0xa86818, W: 0xf8f8f8, R: 0xe83838, T: 0xf85858, K: 0x101018 },
};
export const BOSS_SHAPES = { bird: BOSS_BIRD, core: BOSS_CORE, fortress: BOSS_FORT, mech: BOSS_MECH, final: BOSS_CORE };

// 地上の障害物
const TREE = [
    "...KKKK...",
    "..KLLLLK..",
    ".KLLlLLLK.",
    "KLLLLLlLLK",
    "KLlLLLLLLK",
    ".KLLLlLLK.",
    "..KKLLKK..",
    "....TT....",
    "....TT....",
    "....TT....",
    "...TTTT...",
];
const CRYSTAL = [
    "....K....",
    "...KAK...",
    "...KAK...",
    "..KAWAK..",
    "..KAWAK..",
    ".KAAWAAK.",
    ".KAAWAAK.",
    ".KDAAADK.",
    "KDDAAADDK",
    "KDDDADDDK",
    "KDDDDDDDK",
    ".KKKKKKK.",
];
const ROCK = [
    "...KKKK....",
    "..KRRRRKK..",
    ".KRRrRRRRK.",
    "KRRRRRRrRRK",
    "KRrRRRRRRRK",
    "KRRRRrRRRRK",
    ".KKKKKKKKK.",
];
const TOWER = [
    "KKKKKKKK",
    "KNNNNNNK",
    "KAAAAAAK",
    "KAYAAYAK",
    "KAAAAAAK",
    "KAYAYAAK",
    "KAAAAAAK",
    "KAAYAAYK",
    "KAAAAAAK",
    "KAYAAYAK",
    "KAAAAAAK",
    "KAAYAAAK",
    "KAAAAAAK",
    "KKKKKKKK",
];
const COLUMN = [
    "KKKKKKKK",
    "KWWWWWWK",
    ".KCCCCK.",
    ".KCcCCK.",
    ".KCcCCK.",
    ".KCcCCK.",
    ".KCcCCK.",
    ".KCcCCK.",
    ".KCcCCK.",
    ".KCcCCK.",
    "KWWWWWWK",
    "KKKKKKKK",
];

// 地上のミサイル発射台と、そのミサイル
const LAUNCHER = [
    "....KKKKKK....",
    "...KRWKKWRK...",
    "...KRWKKWRK...",
    "...KRRKKRRK...",
    "..KKKKKKKKKK..",
    ".KAAAAAAAAAAK.",
    "KAADAADDAADAAK",
    "KADDDDDDDDDDAK",
    "KKKKKKKKKKKKKK",
];
const MISSILE = [
    ".W.",
    "WRW",
    "RRR",
    "RRR",
    "KYK",
    ".O.",
];

// パワーアップのカプセル(枠の色と中の印で種類がわかる)。11x11
const CAP_1UP = [
    "...KKKKK...",
    "..KCCCCCK..",
    ".KCWWWWWCK.",
    "KCWHHHHHWCK",
    "KCWHSSSHWCK",
    "KCWSKSKSWCK",
    "KCWSSSSSWCK",
    "KCWWBBBWWCK",
    ".KCWWWWWCK.",
    "..KCCCCCK..",
    "...KKKKK...",
];
const CAP_BARRIER = [
    "...KKKKK...",
    "..KCCCCCK..",
    ".KCWWWWWCK.",
    "KCWWBBBWWCK",
    "KCWBWWWBWCK",
    "KCWBWWWBWCK",
    "KCWBWWWBWCK",
    "KCWWBBBWWCK",
    ".KCWWWWWCK.",
    "..KCCCCCK..",
    "...KKKKK...",
];
const CAP_SUPPORT = [
    "...KKKKK...",
    "..KCCCCCK..",
    ".KCWWWWWCK.",
    "KCWWWWWWWCK",
    "KCBBWWWBBCK",
    "KCBBWWWBBCK",
    "KCWWWWWWWCK",
    "KCWWWWWWWCK",
    ".KCWWWWWCK.",
    "..KCCCCCK..",
    "...KKKKK...",
];
// サポートメカ(球状)
const OPTION = [
    "..KKKK..",
    ".KOOOOK.",
    "KOWWOOOK",
    "KOWOOOOK",
    "KOOOOOdK",
    "KOOOOddK",
    ".KOddddK",
    "..KKKK..",
];

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

export function makeSkyTextures(scene) {
    pixelTexture(scene, "hikari", HIKARI_BACK, HIKARI_PAL, 2);
    pixelTexture(scene, "hikari_face", HIKARI_FACE, FACE_PAL, 3);
    pixelTexture(scene, "life", HIKARI_BACK, HIKARI_PAL, 1);
    for (const [key, rows] of Object.entries({ drone: DRONE, wing: WING, orb: ORB, jet: JET })) {
        pixelTexture(scene, key, rows, ENEMY_COLORS[key], 2);
    }
    for (const [key, pal] of Object.entries(BOSS_PAL)) {
        pixelTexture(scene, `boss_${key}`, BOSS_SHAPES[key], pal, 2);
    }
    pixelTexture(scene, "heart", HEART, { M: 0xe858e8, P: 0xf8a8f8, W: 0xf8f8f8 }, 2);
    pixelTexture(scene, "heart_s", HEART, { M: 0xe858e8, P: 0xf8a8f8, W: 0xf8f8f8 }, 1);
    pixelTexture(scene, "shot", ["YY", "WW", "WW", "YY"], { Y: 0xf8f048, W: 0xf8f8f8 }, 2);
    pixelTexture(scene, "ebullet", [".RR.", "RWWR", "RWWR", ".RR."], { R: 0xf85858, W: 0xf8f8f8 }, 2);
    pixelTexture(scene, "spark", ["W"], { W: 0xffffff }, 2);
    pixelTexture(scene, "launcher", LAUNCHER, { K: 0x101018, A: 0x9098a8, D: 0x585868, R: 0xe83838, W: 0xf8f8f8 }, 3);
    pixelTexture(scene, "missile", MISSILE, { K: 0x101018, W: 0xf8f8f8, R: 0xe83838, Y: 0xf8f048, O: 0xf89838 }, 2);
    pixelTexture(scene, "cap_1up", CAP_1UP, { K: 0x101018, C: 0x38c858, W: 0xf8f8f8, H: 0xd0d8f0, S: 0xf8d0a8, B: 0x3878f8 }, 2);
    pixelTexture(scene, "cap_barrier", CAP_BARRIER, { K: 0x101018, C: 0x3878f8, W: 0xf8f8f8, B: 0x58e8f8 }, 2);
    pixelTexture(scene, "cap_support", CAP_SUPPORT, { K: 0x101018, C: 0xf89838, W: 0xf8f8f8, B: 0xf89838 }, 2);
    pixelTexture(scene, "option", OPTION, { K: 0x101018, O: 0xf89838, W: 0xf8f8f8, d: 0xa84818 }, 2);
    pixelTexture(scene, "shadow", [".KKKKKK.", "KKKKKKKK", ".KKKKKK."], { K: 0x000000 }, 2);
}

/** ステージごとに色が変わる物(地上の障害物と遠景) */
export function makeThemeTextures(scene, theme) {
    const t = theme.key;
    const o = theme.obstacle;
    if (o === "tree") pixelTexture(scene, `obj_${t}`, TREE, { K: 0x101018, L: theme.objA, l: theme.objB, T: 0x885028 }, 3);
    else if (o === "crystal") pixelTexture(scene, `obj_${t}`, CRYSTAL, { K: 0x101018, A: theme.objA, D: theme.objB, W: 0xf8f8f8 }, 3);
    else if (o === "rock") pixelTexture(scene, `obj_${t}`, ROCK, { K: 0x101018, R: theme.objA, r: theme.objB }, 4);
    else if (o === "tower") pixelTexture(scene, `obj_${t}`, TOWER, { K: 0x101018, A: theme.objA, Y: 0xf8f0a0, N: theme.objB }, 4);
    else pixelTexture(scene, `obj_${t}`, COLUMN, { K: 0x101018, W: theme.objA, C: theme.objA, c: theme.objB }, 4);
    makeFar(scene, theme);
}

// 地平線の遠景(山・島・ビル群など)。横に並べてスクロールする
function makeFar(scene, theme) {
    const key = `far_${theme.key}`;
    if (scene.textures.exists(key)) return;
    const w = 480, h = 60;
    const g = scene.add.graphics();
    g.fillStyle(theme.far, 1);
    if (theme.farType === "city") {
        for (let x = 0; x < w; x += 16 + ((x * 7) % 13)) {
            const bh = 18 + ((x * 31) % 38);
            g.fillRect(x, h - bh, 12 + ((x * 3) % 8), bh);
            g.fillStyle(0xf8e8a0, 1);
            for (let y = h - bh + 4; y < h - 4; y += 6) if ((x + y) % 3 === 0) g.fillRect(x + 3, y, 2, 2);
            g.fillStyle(theme.far, 1);
        }
    } else if (theme.farType === "sea") {
        for (let x = 0; x < w; x += 120) {
            g.fillTriangle(x + 20, h, x + 50, h - 22, x + 80, h);
        }
    } else {
        // 山並み
        for (let x = -40; x < w + 40; x += 70) {
            const ph = 26 + ((x * 13) % 30);
            g.fillTriangle(x, h, x + 45, h - ph, x + 95, h);
        }
        if (theme.snow) {
            g.fillStyle(0xf8f8f8, 1);
            for (let x = -40; x < w + 40; x += 70) {
                const ph = 26 + ((x * 13) % 30);
                g.fillTriangle(x + 45 - 8, h - ph + 8 * (ph / 45), x + 45, h - ph, x + 45 + 9, h - ph + 8 * (ph / 50));
            }
        }
    }
    g.generateTexture(key, w, h);
    g.destroy();
}

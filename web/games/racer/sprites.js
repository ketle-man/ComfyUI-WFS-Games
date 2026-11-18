/**
 * TURBO HEART のドット絵(すべてオリジナル)と、ステージごとの背景の生成。
 * 文字1つ = 1ドット、"." は透明。pixelTexture() でテクスチャにする。
 */
import { pixelTexture } from "../../common/retro.js";

// 後ろから見たスポーツカー(24x12)。B/b がボディ色で、車ごとに色を差し替える
const CAR = [
    "......SSSSSSSSSSSS......",
    ".....SbbbbbbbbbbbbS.....",
    "......BGGGGGGGGGGB......",
    ".....BGGWGGGGGGGGGB.....",
    "....BBBBBBBBBBBBBBBB....",
    "...BBBBBBBBBBBBBBBBBB...",
    "..BRRRBBBBBBBBBBBBRRRB..",
    "..BRRRBbbbYYYYbbbBRRRB..",
    "..bBBBBBBBBBBBBBBBBBBb..",
    "..bbbbbbbbbbbbbbbbbbbb..",
    "..KKKK............KKKK..",
    "..KKKK............KKKK..",
];
const CAR_BASE = { S: 0x202028, G: 0x183048, W: 0x88c8f8, R: 0xf85818, Y: 0xf8f8f8, K: 0x101010 };
export const CAR_COLORS = {
    player: [0xe83838, 0x902020],
    blue: [0x3878f8, 0x1838a8],
    yellow: [0xf8d838, 0xa88818],
    white: [0xe8e8f0, 0x9898a8],
    green: [0x38c858, 0x187828],
    purple: [0xa858e8, 0x5828a8],
    orange: [0xf89838, 0xa84818],
    black: [0x404050, 0x181820],
};

const PALM = [
    "...LLL....LLL...",
    "..LLLLL..LLLLL..",
    ".LLl..LLLL..lLL.",
    "Ll.....LL.....lL",
    "L.....lTTl.....L",
    "......LTTL......",
    ".......TT.......",
    ".......Tt.......",
    "......TTt.......",
    "......Tt........",
    "......TT........",
    "......Tt........",
    ".....TTt........",
    ".....Tt.........",
    ".....TT.........",
    ".....Tt.........",
    "....TTtt........",
    "...TTTTtt.......",
];
const TREE = [
    ".....LL.....",
    "....LLLL....",
    "....LlLL....",
    "...LLLLLL...",
    "...LLlLLL...",
    "..LLLLLLLL..",
    "..LlLLLLlL..",
    ".LLLLLLLLLL.",
    ".LLLlLLLLLL.",
    "LLLLLLLLLlLL",
    "LlLLLLLLLLLL",
    ".....TT.....",
    ".....Tt.....",
    ".....TT.....",
];
const CACTUS = [
    "....GG....",
    "...GGgG...",
    "...GGgG...",
    ".G.GGgG...",
    ".G.GGgG.G.",
    ".GGGGgG.G.",
    "..GGGgGGG.",
    "...GGgG...",
    "...GGgG...",
    "...GGgG...",
    "...GGgG...",
    "..GGGgGG..",
];
const ROCK = [
    "....RRRRR.....",
    "..RRRrRRRRR...",
    ".RRRRRRrRRRR..",
    "RRrRRRRRRRRRR.",
    "RRRRRRRRRrRRRR",
    "rRRRRRRRRRRRRr",
];
const LAMP = ["KKKKKK..", "KYYYYK..", "KKKKKK..", ...Array(26).fill("..KK...."), ".KKKK..."];
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
// 障害物: 積み上げたダンボール(20x14)
const BOXES = [
    "......KKKKKKKK......",
    "......KCCTTCCK......",
    "......KCCTTCcK......",
    "......KCCTTCcK......",
    "......KccccccK......",
    "KKKKKKKKKKKKKKKKKKKK",
    "KCCCCTTCCKKCCCCTTCCK",
    "KCCCCTTCCKKCCCCTTCcK",
    "KCCCCTTCcKKCCCCTTCcK",
    "KCCCCTTCcKKCCCCTTCcK",
    "KCCCCCCCcKKCCCCCCCcK",
    "KCCCCCCCcKKCCCCCCCcK",
    "KccccccccKKccccccccK",
    "KKKKKKKKKKKKKKKKKKKK",
];
// 障害物: 道を横断する人(10x16)。歩きの2コマ
const PED_TOP = [
    "...HHHH...",
    "..HHHHHH..",
    "..HPPPPH..",
    "...PPPP...",
    "....PP....",
    "..SSSSSS..",
    ".SSSSSSSS.",
    "PSSSSSSSSP",
    "P.SSSSSS.P",
    "..SSSSSS..",
    "..LLLLLL..",
];
const PED_0 = [...PED_TOP, "..LLL.LL..", "..LL...LL.", ".LL....LL.", ".LL.....LL", "KK......KK"];
const PED_1 = [...PED_TOP, "...LLLL...", "...LL.L...", "...LL.LL..", "...LL.LL..", "..KKK.KKK."];

// ヒロイン「ミサキ」の顔(16x16): 赤いボブ、緑の瞳、頭にサングラス、チームジャケット
const MISAKI = [
    "....KKKKKKK.....",
    "...KHHHHHHHK....",
    "..KHUUUUUUUHK...",
    "..KHHHHHHHHHK...",
    ".KHHSSHHHSSHHK..",
    ".KHSSSSSSSSSHK..",
    ".KHSKESSSKESHK..",
    ".KHSSESSSSESHK..",
    ".KHSSSSSSSSSHK..",
    ".KHsSSSNNSSsHK..",
    "..KHsSSSSSsHK...",
    "...KKSSSSSKK....",
    "...KJJKSKJJK....",
    "..KJJJWJWJJJK...",
    ".KJJJJWWWJJJJK..",
    ".KJJJJWWWJJJJK..",
];

export function makeRacerTextures(scene, theme) {
    for (const [key, [main, dark]] of Object.entries(CAR_COLORS)) {
        pixelTexture(scene, `car_${key}`, CAR, { ...CAR_BASE, B: main, b: dark }, 2);
    }
    pixelTexture(scene, "heart", HEART, { M: 0xe858e8, P: 0xf8a8f8, W: 0xf8f8f8 }, 2);
    pixelTexture(scene, "heart_s", HEART, { M: 0xe858e8, P: 0xf8a8f8, W: 0xf8f8f8 }, 1);
    pixelTexture(scene, "misaki", MISAKI, {
        K: 0x101018, H: 0xd83818, U: 0x202028, S: 0xf8d0a8, s: 0xd89878, E: 0x38c858, N: 0xc84828, J: 0xe83838, W: 0xf8f8f8,
    }, 3);
    pixelTexture(scene, "spark", ["W"], { W: 0xffffff }, 2);
    pixelTexture(scene, "boxes", BOXES, { C: 0xc89058, c: 0x986838, T: 0xe8d8a8, K: 0x583818 }, 4);
    const ped = { H: 0x402010, P: 0xf8d0a8, S: 0x38a8f8, L: 0x384058, K: 0x101010 };
    pixelTexture(scene, "ped_0", PED_0, ped, 3);
    pixelTexture(scene, "ped_1", PED_1, ped, 3);
    // ステージごとに色が違う物はテーマ名を付けたキーで作る
    const t = theme.key;
    pixelTexture(scene, `palm_${t}`, PALM, { L: theme.leaf, l: theme.leafDark, T: 0xa86830, t: 0x684018 }, 3);
    pixelTexture(scene, `tree_${t}`, TREE, { L: theme.leaf, l: theme.leafDark, T: 0x885028, t: 0x583010 }, 4);
    pixelTexture(scene, `tree2_${t}`, TREE, { L: theme.leaf2 ?? theme.leaf, l: theme.leafDark, T: 0x885028, t: 0x583010 }, 4);
    pixelTexture(scene, `cactus_${t}`, CACTUS, { G: 0x48a848, g: 0x287828 }, 4);
    pixelTexture(scene, `rock_${t}`, ROCK, { R: theme.rock ?? 0xa86848, r: theme.rockDark ?? 0x784028 }, 4);
    pixelTexture(scene, `lamp_${t}`, LAMP, { K: 0x303038, Y: 0xf8f0a0 }, 3);
    makeBuildings(scene, t, theme);
    makeGate(scene);
    makeBackgrounds(scene, theme);
}

// ネオン街のビル(窓の明かりと看板)。3種類
function makeBuildings(scene, t, theme) {
    if (scene.textures.exists(`bldg0_${t}`)) return;
    const neon = [0xf858f8, 0x58e8f8, 0xf8f048, 0xf85858];
    for (let v = 0; v < 3; v++) {
        const w = 44 + v * 8, h = 90 + v * 22;
        const g = scene.add.graphics();
        g.fillStyle(theme.building ?? 0x282840, 1).fillRect(0, 0, w, h);
        for (let y = 14; y < h - 6; y += 8) {
            for (let x = 4; x < w - 4; x += 7) {
                if (Math.random() < 0.55) g.fillStyle(Math.random() < 0.8 ? 0xf8e8a0 : 0x88c8f8, 1).fillRect(x, y, 4, 4);
            }
        }
        g.fillStyle(neon[v % neon.length], 1).fillRect(3, 3, w - 6, 6);
        g.generateTexture(`bldg${v}_${t}`, w, h);
        g.destroy();
    }
}

// スタート/ゴールのゲート(チェッカー模様の横断幕と2本の柱)
function makeGate(scene) {
    if (scene.textures.exists("gate")) return;
    const w = 240, h = 70;
    const g = scene.add.graphics();
    g.fillStyle(0x303038, 1).fillRect(0, 10, 8, h - 10).fillRect(w - 8, 10, 8, h - 10);
    for (let y = 0; y < 2; y++) {
        for (let x = 0; x < w / 10; x++) {
            g.fillStyle((x + y) % 2 ? 0x101010 : 0xf8f8f8, 1).fillRect(x * 10, y * 10, 10, 10);
        }
    }
    g.generateTexture("gate", w, h);
    g.destroy();
}

// 空(段々のグラデーション)・遠景・近景。横にスクロールさせるので横幅は画面の2倍
function makeBackgrounds(scene, theme) {
    const t = theme.key;
    if (scene.textures.exists(`sky_${t}`)) return;
    const W = 960, skyH = 200;
    let g = scene.add.graphics();
    const bands = theme.sky;
    const bh = Math.ceil(skyH / bands.length);
    bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * bh, W, bh + 1));
    if (theme.sun) {
        const [sx, sy, sr, sc] = theme.sun;
        g.fillStyle(sc, 1).fillCircle(sx, sy, sr);
        g.fillStyle(sc, 0.35).fillCircle(sx, sy, sr + 10);
    }
    if (theme.stars) {
        for (let i = 0; i < 70; i++) g.fillStyle(0xf8f8f8, Math.random() * 0.8 + 0.2).fillRect(Math.random() * W, Math.random() * 140, 2, 2);
    }
    g.generateTexture(`sky_${t}`, W, skyH);
    g.destroy();

    // 雲は流すので空とは別のテクスチャ(背景は透明)。遠い雲(小さく淡い)と近い雲(大きい)の2層
    if (theme.clouds) {
        const cloud = (gg, x, y, k) => {
            gg.fillRect(x, y, 46 * k, 6 * k).fillRect(x + 8 * k, y - 5 * k, 28 * k, 6 * k).fillRect(x + 4 * k, y + 5 * k, 34 * k, 4 * k);
        };
        g = scene.add.graphics();
        g.fillStyle(theme.clouds, 0.7);
        for (let i = 0; i < 8; i++) cloud(g, (i * 127 + 30) % W, 18 + ((i * 41) % 60), 0.8);
        g.generateTexture(`clouds1_${t}`, W, skyH);
        g.destroy();
        g = scene.add.graphics();
        g.fillStyle(theme.clouds, 1);
        for (let i = 0; i < 5; i++) cloud(g, (i * 197 + 80) % W, 40 + ((i * 53) % 70), 1.4);
        g.generateTexture(`clouds2_${t}`, W, skyH);
        g.destroy();
    }

    // 遠景(山・岩山・ビル群・島)
    const farH = 90;
    g = scene.add.graphics();
    g.fillStyle(theme.far, 1);
    if (theme.farType === "mountains" || theme.farType === "islands") {
        const pts = [{ x: 0, y: farH }];
        let x = 0;
        while (x < W) {
            const peak = theme.farType === "islands" ? 50 + Math.random() * 30 : 10 + Math.random() * 50;
            pts.push({ x: x + 30, y: peak }, { x: x + 60, y: theme.farType === "islands" ? farH - 6 : 40 + Math.random() * 30 });
            x += 60 + Math.random() * 40;
        }
        pts.push({ x: W, y: farH });
        g.fillPoints(pts, true);
        if (theme.snow) {
            g.fillStyle(0xf8f8f8, 1);
            pts.forEach((p) => { if (p.y < 30) g.fillTriangle(p.x, p.y, p.x - 7, p.y + 10, p.x + 7, p.y + 10); });
        }
    } else if (theme.farType === "mesas") {
        let x = 0;
        while (x < W) {
            const w = 60 + Math.random() * 90, top = 25 + Math.random() * 35;
            g.fillRect(x, top, w, farH - top);
            g.fillStyle(theme.farDark, 1).fillRect(x, top, w, 4).fillStyle(theme.far, 1);
            x += w + 30 + Math.random() * 60;
        }
    } else if (theme.farType === "skyline") {
        let x = 0;
        while (x < W) {
            const w = 20 + Math.random() * 40, top = 5 + Math.random() * 60;
            g.fillStyle(theme.far, 1).fillRect(x, top, w, farH - top);
            for (let y = top + 4; y < farH - 4; y += 6) {
                for (let wx = x + 3; wx < x + w - 3; wx += 5) {
                    if (Math.random() < 0.3) g.fillStyle(0xf8e8a0, 0.9).fillRect(wx, y, 2, 2);
                }
            }
            x += w + 2;
        }
    }
    // 水平線の海
    if (theme.sea) {
        g.fillStyle(theme.sea, 1).fillRect(0, farH - 18, W, 18);
        for (let i = 0; i < 40; i++) g.fillStyle(0xf8f8f8, 0.7).fillRect(Math.random() * W, farH - 16 + Math.random() * 14, 6, 1);
    }
    g.generateTexture(`far_${t}`, W, farH);
    g.destroy();

    // 近景(丘や森のシルエット)
    const nearH = 50;
    g = scene.add.graphics();
    if (theme.near) {
        g.fillStyle(theme.near, 1);
        const pts = [{ x: 0, y: nearH }];
        for (let x = 0; x <= W; x += 24) pts.push({ x, y: 18 + Math.sin(x * 0.02) * 10 + Math.random() * 8 });
        pts.push({ x: W, y: nearH });
        g.fillPoints(pts, true);
    }
    g.generateTexture(`near_${t}`, W, nearH);
    g.destroy();
}

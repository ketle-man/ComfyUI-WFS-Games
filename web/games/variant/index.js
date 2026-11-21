/**
 * VARIANT HEART - スプライトスタックの変形メカ・全方位シューティング
 *
 * WFS Game Host API v1:
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debug... }
 * host: apiVersion / lang / settings { difficulty, sound, bgm } / runStart() / stageClear(result) / finish(result)
 *
 * 画面は 640×400 の論理解像度(キャンバスは2倍)。斜め見下ろしでカメラは自機を追う。
 * 機体も敵も地形もボクセルのスプライトスタック(stack.js / models.js)。
 * 自機 XV-7 スワローは C で変形:
 *   戦闘機 … 速い・方向キーの向きへ旋回しつつ前進、Z 機銃 / X ホーミングミサイル(前方の敵を自動ロック)
 *   人型   … 遅い・8方向に移動して近くの敵を自動で向く、Z ビームライフル(貫通) / X ビームソード(3段・弾を斬り払う)
 * 各ステージ: ノルマ数の敵を倒す → WARNING → ボス → クリア。ハート5個でプライベート写真。
 */
import { model, MORPH_DELAYS } from "./models.js";
import { draw, drawMorph, morphPairs, sprite, setShadowScale, SQ, LH, DPR } from "./stack.js";
import { makeSfx } from "./sfx.js";
import { SONGS } from "./songs.js";
import { loadFont, FONT_NAME } from "../../common/retro.js";
import { createAudio } from "../../common/audio.js";

const GAME_ID = "variant";
const W = 640, H = 400, CY = 212;
const WORLD = 3000;
const TAU = Math.PI * 2;
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyX", "KeyC", "KeyJ", "KeyK", "KeyL", "ShiftLeft", "ShiftRight", "Space", "Enter", "Escape", "KeyP", "KeyQ"]);
const COL = { white: "#f8f8f8", yellow: "#f8f048", cyan: "#58e8f8", magenta: "#f858f8", green: "#58f858", gray: "#9898a8", red: "#f85858", orange: "#f89838", pink: "#ff78b8", teal: "#3cd6cf" };

const TEXT = {
    en: {
        subtitle: "- Transforming Sky Ace -", start: "PRESS SPACE TO LAUNCH",
        controls: ["ARROWS / WASD  MOVE (FIGHTER: ← → TURN)", "Z / SPACE  MAIN WEAPON (hold)", "X  SUB WEAPON", "C / SHIFT  TRANSFORM", "ESC / P  PAUSE"],
        fighter: "FIGHTER", robot: "ROBOT", gun: "GUN", missile: "MISSILE", rifle: "BEAM RIFLE", saber: "BEAM SABER", transform: "C: TRANSFORM",
        armor: "ARMOR", enemy: "ENEMY", hearts: "HEART", warning: "WARNING", approaching: "A huge enemy is approaching!", clear: "STAGE CLEAR",
        privateShot: "ALL HEARTS: PRIVATE PHOTO", victoryShot: "A commemorative picture will be generated.", paused: "PAUSE", pauseHint: "ESC: RESUME   Q: GIVE UP",
        overTitle: "GAME OVER", cont: (n) => `CONTINUE FROM STAGE ${n}`, giveUp: "GIVE UP", theEnd: "MISSION COMPLETE", toTitle: "SPACE: BACK TO TITLE",
        score: "SCORE", outOfArea: "RETURN TO THE OPERATION AREA", next: "SPACE", heartGot: (n) => `HEART ${n}/5`, repair: "REPAIR", ammo: "MISSILES FULL",
        bossLeft: (n) => `TURRETS ${n}`, parry: "PARRY!", weak: "WEAK POINT!", lives: "LIFE",
    },
    ja: {
        subtitle: "- 可変機エース -", start: "SPACE で出撃",
        controls: ["方向キー / WASD  移動(戦闘機は ← → で旋回)", "Z / SPACE  メイン武器(押しっぱなし)", "X  サブ武器", "C / SHIFT  変形", "ESC / P  一時停止"],
        fighter: "戦闘機", robot: "人型", gun: "機銃", missile: "ミサイル", rifle: "ビームライフル", saber: "ビームソード", transform: "C: 変形",
        armor: "装甲", enemy: "敵機", hearts: "ハート", warning: "WARNING", approaching: "巨大な敵が接近中!", clear: "STAGE CLEAR",
        privateShot: "ハート全部獲得: プライベート写真", victoryShot: "記念カットを生成します。", paused: "一時停止", pauseHint: "ESC: 再開   Q: あきらめる",
        overTitle: "GAME OVER", cont: (n) => `STAGE ${n} からやり直す`, giveUp: "あきらめる", theEnd: "MISSION COMPLETE", toTitle: "SPACE: タイトルへ",
        score: "SCORE", outOfArea: "作戦区域に戻ってください", next: "SPACE", heartGot: (n) => `ハート ${n}/5`, repair: "装甲回復", ammo: "ミサイル補充",
        bossLeft: (n) => `砲台 残り${n}`, parry: "斬り払い!", weak: "弱点!", lives: "残機",
    },
    zh: {
        subtitle: "- 可变机王牌 -", start: "按 SPACE 出击",
        controls: ["方向键 / WASD  移动(战斗机用 ← → 转向)", "Z / SPACE  主武器(按住)", "X  副武器", "C / SHIFT  变形", "ESC / P  暂停"],
        fighter: "战斗机", robot: "人型", gun: "机枪", missile: "导弹", rifle: "光束步枪", saber: "光束剑", transform: "C: 变形",
        armor: "装甲", enemy: "敌机", hearts: "爱心", warning: "WARNING", approaching: "巨大的敌人正在接近!", clear: "STAGE CLEAR",
        privateShot: "全部爱心获得: 私人照片", victoryShot: "将生成纪念照。", paused: "暂停", pauseHint: "ESC: 继续   Q: 放弃",
        overTitle: "GAME OVER", cont: (n) => `从 STAGE ${n} 重来`, giveUp: "放弃", theEnd: "MISSION COMPLETE", toTitle: "SPACE: 返回标题",
        score: "SCORE", outOfArea: "请返回作战区域", next: "SPACE", heartGot: (n) => `爱心 ${n}/5`, repair: "装甲恢复", ammo: "导弹补满",
        bossLeft: (n) => `炮台 剩余${n}`, parry: "劈开!", weak: "弱点!", lives: "残机",
    },
};

let dataCache = null;
async function loadData() {
    if (!dataCache) dataCache = await (await fetch(new URL("./stages.json", import.meta.url))).json();
    return dataCache;
}

// ---------- 小さな道具 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
function segCircle(x0, y0, x1, y1, cx, cy, r) {
    const dx = x1 - x0, dy = y1 - y0;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((cx - x0) * dx + (cy - y0) * dy) / l2, 0, 1);
    return dist2(x0 + dx * t, y0 + dy * t, cx, cy) <= r * r;
}
function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** 端がつながる値ノイズ(地面のタイル用) */
function tileNoise(size, cells, seed) {
    const r = seeded(seed);
    const g = Array.from({ length: cells * cells }, () => r());
    const at = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
        const fx = (x / size) * cells, fy = (y / size) * cells;
        const i = Math.floor(fx), j = Math.floor(fy), tx = sm(fx - i), ty = sm(fy - j);
        const a = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
        const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
        return a + (b - a) * ty;
    };
}
function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return [c, c.getContext("2d")];
}

// ---------- 地面のタイル(テーマごとに1枚作って敷き詰める) ----------
const TILE = 256; // 論理px
function makeGroundTile(theme) {
    const S = TILE * 2;
    const [c, g] = makeCanvas(S, S);
    const img = g.createImageData(S, S);
    const d = img.data;
    const n1 = tileNoise(S, 8, 11), n2 = tileNoise(S, 32, 23), n3 = tileNoise(S, 4, 37);
    const F = (k) => (TAU * k) / S; // タイル幅で k 周期(継ぎ目が出ない)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const a = n1(x, y), b = n2(x, y), cc = n3(x, y);
        let r, gg, bb;
        if (theme === "ocean") {
            const k = 0.55 * a + 0.3 * cc + 0.15 * b;
            r = 14 + 16 * k; gg = 66 + 44 * k; bb = 120 + 50 * k;
            const wave = Math.sin((x + a * 120) * F(9) + (y + cc * 80) * F(4));
            if (wave > 0.95 && b > 0.5) { r += 22; gg += 28; bb += 26; }
        } else if (theme === "desert") {
            const dune = Math.sin(x * F(3) + y * F(1) + a * 6);
            const rip = Math.sin(x * F(16) + y * F(4) + b * 5) * 0.5 + 0.5;
            const k = 0.75 + 0.15 * dune + 0.05 * rip + 0.08 * (cc - 0.5);
            r = 220 * k; gg = 168 * k; bb = 104 * k;
        } else if (theme === "city") {
            const k = 0.8 + 0.3 * b;
            r = 24 * k; gg = 27 * k; bb = 38 * k;
            const lx = x % S, ly = y % S;
            const road = (v) => v >= S - 80;
            if (road(lx) || road(ly)) {
                r = 16; gg = 17; bb = 22;
                const cx = S - 40;
                if ((Math.abs(lx - cx) < 2 && !road(ly) && (ly % 40) < 22) || (Math.abs(ly - cx) < 2 && !road(lx) && (lx % 40) < 22)) { r = 200; gg = 170; bb = 60; }
                if (road(lx) && road(ly) && ((lx + ly) % 16 < 3)) { r = 150; gg = 150; bb = 160; } // 交差点の横断歩道
            } else if (lx >= S - 88 || ly >= S - 88) { r = 46; gg = 50; bb = 64; }
        } else if (theme === "snow") {
            const k = 0.84 + 0.1 * a + 0.04 * b;
            const blue = (1 - cc) * 22; // 雪の吹きだまりの青い陰(なめらかに)
            r = 226 * k + 8 - blue; gg = 234 * k + 8 - blue * 0.6; bb = 248 * k + 6;
            if (b > 0.96) { r = gg = bb = 255; }
        } else {
            const k = 0.5 * a + 0.5 * cc;
            r = 4 + 10 * k; gg = 6 + 8 * k; bb = 16 + 26 * k;
            if (b > 0.985) { r = gg = bb = 200 + 55 * a; }
        }
        const i = (y * S + x) * 4;
        d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(bb, 0, 255); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}
function makeCloud(seed) {
    const [c, g] = makeCanvas(260, 160);
    const r = seeded(seed);
    for (let i = 0; i < 14; i++) {
        const x = 50 + r() * 160, y = 50 + r() * 60, rad = 22 + r() * 34;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, "rgba(255,255,255,0.85)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    return c;
}

// ---------- 宇宙の背景(惑星・衛星・星雲) ----------
const LIGHT3 = (() => { const v = [-0.6, -0.42, 0.68], l = Math.hypot(...v); return v.map((x) => x / l); })();
/** 球をピクセルごとに陰影づけして描く。surface(lon, lat) → [r, g, b, ocean(0/1), nightGlow] */
function paintSphere(R, surface) {
    const [c, g] = makeCanvas(R * 2, R * 2);
    const img = g.createImageData(R * 2, R * 2);
    const d = img.data;
    for (let py = 0; py < R * 2; py++) for (let px = 0; px < R * 2; px++) {
        const nx = (px + 0.5 - R) / R, ny = (py + 0.5 - R) / R, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const [r, gg, b, ocean, night] = surface(Math.atan2(nx, nz), Math.asin(ny));
        const lam = nx * LIGHT3[0] + ny * LIGHT3[1] + nz * LIGHT3[2];
        const dif = Math.max(0, lam);
        const k = 0.04 + 0.96 * dif * (0.55 + 0.45 * nz);
        const spec = ocean ? 110 * Math.pow(dif, 24) : 0;
        const ng = dif < 0.06 ? night * (1 - dif / 0.06) : 0;
        const i = (py * R * 2 + px) * 4;
        d[i] = clamp(r * k + spec + ng * 255, 0, 255); d[i + 1] = clamp(gg * k + spec + ng * 190, 0, 255); d[i + 2] = clamp(b * k + spec * 0.9 + ng * 110, 0, 255);
        d[i + 3] = d2 > 0.985 ? 180 : 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}
const PN = { land: tileNoise(256, 6, 5), detail: tileNoise(256, 28, 9), cloud: tileNoise(256, 10, 13), crater: tileNoise(256, 18, 21), maria: tileNoise(256, 4, 31) };
const lonlat = (lon, lat) => [(((lon / TAU) % 1 + 1) % 1) * 256, (lat / Math.PI + 0.5) * 255.9];
/** 地球型の惑星(陸・海・氷・雲・夜側の街の灯) */
function makePlanet(R, rot) {
    return paintSphere(R, (lon, lat) => {
        const [u, v] = lonlat(lon + rot, lat);
        const h = PN.land(u, v) * 0.72 + PN.detail(u, v) * 0.28;
        let r, g, b, ocean = 0, night = 0;
        if (Math.abs(lat) > 1.22 - PN.detail(u, v) * 0.15) { r = 236; g = 242; b = 250; }
        else if (h > 0.53) {
            const t = PN.detail(u, v);
            r = 70 + 90 * t; g = 118 + 30 * t; b = 60 + 30 * t;
            if (h > 0.68) { r = 150; g = 128; b = 96; }
        } else { const dd = h / 0.53; r = 18 + 26 * dd; g = 58 + 60 * dd; b = 128 + 60 * dd; ocean = 1; }
        const [cu, cv] = lonlat(lon + rot * 1.6, lat);
        const cl = PN.cloud(cu, cv) * 0.8 + PN.detail(cu, cv) * 0.2;
        if (cl > 0.55) { const a = Math.min(1, (cl - 0.55) * 4); r += (245 - r) * a; g += (248 - g) * a; b += (255 - b) * a; ocean = 0; night *= 1 - a; }
        return [r, g, b, ocean, night];
    });
}
/** 衛星(月): 灰色の地面・海・クレーター */
function makeMoon(R) {
    return paintSphere(R, (lon, lat) => {
        const [u, v] = lonlat(lon, lat);
        const m = PN.maria(u, v), cr = PN.crater(u, v), dt = PN.detail(u, v);
        let k = 150 + 50 * dt - (m > 0.55 ? 55 : 0);
        if (cr > 0.72) k -= 45; else if (cr > 0.66) k += 30;
        return [k, k * 0.97, k * 0.93, 0, 0];
    });
}
function makeNebula() {
    const S = 320;
    const [c, g] = makeCanvas(S, S);
    const img = g.createImageData(S, S);
    const d = img.data;
    const n1 = tileNoise(S, 5, 41), n2 = tileNoise(S, 14, 43), n3 = tileNoise(S, 3, 47);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const a = n1(x, y) * 0.7 + n2(x, y) * 0.3, b = n3(x, y);
        const k = Math.max(0, a - 0.45) * 2.2;
        const i = (y * S + x) * 4;
        d[i] = 70 + 120 * b; d[i + 1] = 40 + 50 * (1 - b); d[i + 2] = 120 + 100 * (1 - b); d[i + 3] = clamp(k * 120, 0, 255);
    }
    g.putImageData(img, 0, 0);
    return c;
}

// ---------- 顔(会話ウィンドウ) ----------
function paintPortrait(who) {
    const [c, g] = makeCanvas(32, 32);
    const P = {
        heroine: { bg: ["#1c4a5c", "#0c2430"], hair: "#dfe4ee", hairD: "#a3acc0", eye: "#1fb6b0", suit: "#e9edf1", suit2: "#1c9a98", long: false },
        op: { bg: ["#3a2c50", "#1a1428"], hair: "#8a5434", hairD: "#5e3420", eye: "#3c9a4c", suit: "#2c3a66", suit2: "#e0c060", long: true, headset: true },
        rival: { bg: ["#4a1018", "#1a0408"], hair: "#24202c", hairD: "#140f18", eye: "#e8304a", suit: "#3c3844", suit2: "#b4202e", long: true, streak: "#c0283a" },
    }[who] || {};
    const gr = g.createLinearGradient(0, 0, 0, 32);
    gr.addColorStop(0, P.bg[0]); gr.addColorStop(1, P.bg[1]);
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // 後ろ髪
    if (P.long) { px(6, 10, 20, 20, P.hairD); px(5, 14, 22, 14, P.hairD); }
    // 体
    px(5, 26, 22, 6, P.suit); px(11, 25, 10, 3, P.suit); px(13, 26, 6, 2, P.suit2); px(5, 29, 22, 1, P.suit2);
    px(13, 22, 6, 4, "#efc4a8");
    // 顔
    px(9, 9, 14, 13, "#f7d6be"); px(10, 22, 12, 1, "#f7d6be"); px(11, 23, 10, 1, "#e8b898");
    // 髪
    px(8, 5, 16, 5, P.hair); px(7, 7, 18, 4, P.hair); px(7, 10, 3, 9, P.hair); px(22, 10, 3, 9, P.hair);
    px(10, 9, 3, 2, P.hair); px(14, 9, 2, 3, P.hair); px(18, 9, 3, 2, P.hair); px(12, 10, 1, 1, P.hairD); px(20, 10, 1, 2, P.hairD);
    px(9, 5, 14, 1, P.hairD);
    if (P.long) { px(6, 14, 3, 12, P.hair); px(23, 14, 3, 12, P.hair); }
    if (P.streak) { px(9, 6, 2, 6, P.streak); px(7, 12, 2, 8, P.streak); }
    // 目
    for (const ex of [11, 18]) {
        px(ex, 14, 4, 4, "#ffffff"); px(ex + 1, 14, 2, 4, P.eye); px(ex + 1, 15, 2, 2, "#0c1a20"); px(ex + 1, 14, 1, 1, "#ffffff");
        px(ex - 1, 13, 6, 1, "#2a2030");
    }
    px(12, 19, 1, 1, "#f0a8a0"); px(20, 19, 1, 1, "#f0a8a0");
    px(15, 20, 3, 1, who === "rival" ? "#a03040" : "#c86870");
    if (P.headset) { px(6, 12, 2, 6, "#7a7f8a"); px(8, 6, 16, 1, "#7a7f8a"); px(7, 18, 1, 3, "#7a7f8a"); px(8, 20, 4, 1, "#7a7f8a"); px(12, 20, 1, 1, "#e04040"); }
    return c;
}

export async function mount(container, host = {}) {
    const lang = TEXT[host.lang] ? host.lang : "en";
    const tr = (k, ...a) => { const v = TEXT[lang][k] ?? TEXT.en[k] ?? k; return typeof v === "function" ? v(...a) : v; };
    const loc = (obj) => (obj && (obj[lang] || obj.en)) || "";
    /** 結果カード用のステージ名(WFS が「STAGE n」を付けるので、名前の頭の「STAGE n」は外す) */
    const cardName = (def) => loc(def.name).replace(/^STAGE\s*\d+\s*/, "");
    const settings = { difficulty: "normal", sound: true, bgm: true, ...(host.settings || {}) };
    const [data] = await Promise.all([loadData(), loadFont()]);
    const stages = data.stages;
    const audio = createAudio({ sound: settings.sound !== false, bgm: settings.bgm !== false, songs: SONGS });
    const sfx = makeSfx(audio);
    const DIFF = {
        easy: { hp: 150, lives: 4, eDmg: 0.7, eHp: 0.85, eFire: 0.7, bSpd: 0.85 },
        normal: { hp: 100, lives: 3, eDmg: 1, eHp: 1, eFire: 1, bSpd: 1 },
        hard: { hp: 90, lives: 3, eDmg: 1.3, eHp: 1.2, eFire: 1.3, bSpd: 1.15 },
    }[settings.difficulty] || { hp: 100, lives: 3, eDmg: 1, eHp: 1, eFire: 1, bSpd: 1 };

    // ---------- DOM ----------
    container.innerHTML = "";
    const root = document.createElement("div");
    root.tabIndex = 0;
    root.style.cssText = "width:100%;height:100%;outline:none;position:relative;overflow:hidden;background:#000;";
    container.appendChild(root);
    const canvas = document.createElement("canvas");
    canvas.width = W * 2; canvas.height = H * 2;
    canvas.style.cssText = `position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;transform-origin:0 0;image-rendering:pixelated;`;
    root.appendChild(canvas);
    const g = canvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    const fit = () => {
        const s = Math.min(root.clientWidth / W, root.clientHeight / H) || 1;
        canvas.style.transform = `scale(${s}) translate(-50%, -50%)`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    fit();

    const portraits = { heroine: paintPortrait("heroine"), op: paintPortrait("op"), rival: paintPortrait("rival") };
    const names = { heroine: loc(data.heroine?.name), op: loc(data.operator?.name), rival: loc(data.rival?.name) };
    const clouds = [makeCloud(1), makeCloud(2), makeCloud(3)];
    const tiles = {};
    const tileOf = (theme) => (tiles[theme] ||= makeGroundTile(theme));
    const PAIRS = morphPairs(model("fighter"), model("robot"), MORPH_DELAYS);
    const RIVAL_PAIRS = morphPairs(model("rivalF"), model("rivalR"), MORPH_DELAYS);

    // ---------- 状態 ----------
    const ctx = {
        state: "title", paused: false, externalPause: false, finished: false, t: 0,
        story: null, banner: null, menu: null, flash: 0, shake: 0, hint: null, msg: null,
    };
    let run = null;      // 1回のプレイ
    let st = null;       // 今のステージ
    let p = null;        // 自機
    let enemies = [], ebul = [], pbul = [], parts = [], pickups = [], hearts = [], props = [], cloudList = [], boss = null, decals = [];
    let farObjs = [], nearObjs = [];               // 宇宙: 奥の層・手前の層の浮遊物
    let planetImg = null, planetT = -99, moonImg = null, nebulaImg = null;
    const cam = { x: WORLD / 2, y: WORLD / 2 };

    // ---------- 入力 ----------
    const held = new Set();
    const taps = new Set();
    const KEYMAP = {
        ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
        KeyZ: "fire", Space: "fire", KeyJ: "fire", KeyX: "sub", KeyK: "sub", KeyC: "morph", KeyL: "morph", ShiftLeft: "morph", ShiftRight: "morph",
        Enter: "ok", Escape: "pause", KeyP: "pause", KeyQ: "quit",
    };
    const onKey = (e) => {
        e.stopPropagation();
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        const a = KEYMAP[e.code];
        if (!a) return;
        if (e.type === "keydown") {
            audio.unlock();
            if (!e.repeat) { taps.add(a); if (a === "fire") taps.add("ok"); }
            held.add(a);
        } else held.delete(a);
    };
    const onBlur = () => held.clear();
    container.addEventListener("keydown", onKey);
    container.addEventListener("keyup", onKey);
    root.addEventListener("blur", onBlur);
    canvas.addEventListener("pointerdown", () => { audio.unlock(); taps.add("ok"); focusRoot(); });
    const focusRoot = () => { try { root.focus({ preventScroll: true }); } catch { /* ignore */ } };
    let padPrev = {};
    function pollPad() {
        const pad = navigator.getGamepads?.()?.find((q) => q);
        if (!pad) return { x: 0, y: 0 };
        const b = (i) => !!pad.buttons[i]?.pressed;
        const now = { fire: b(0), sub: b(1), morph: b(2) || b(3), pause: b(9) };
        for (const k of Object.keys(now)) { if (now[k] && !padPrev[k]) { taps.add(k); if (k === "fire") taps.add("ok"); } }
        padPrev = now;
        if (now.fire) held.add("padfire"); else held.delete("padfire");
        let x = pad.axes[0] || 0, y = pad.axes[1] || 0;
        if (Math.hypot(x, y) < 0.25) { x = 0; y = 0; }
        if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
        return { x, y };
    }
    const tapped = (a) => taps.has(a);

    // ---------- 進行 ----------
    function newRun() {
        return { stage: 0, score: 0, stageScore: 0, lives: DIFF.lives, hearts: {}, finish: {}, cleared: [] };
    }
    function startGame() {
        run = newRun();
        ctx.finished = false;
        try { host.runStart?.(); } catch (e) { console.error("[variant] host.runStart failed", e); }
        startStage(0, { intro: true });
    }
    function newPlayer() {
        return {
            x: WORLD / 2, y: WORLD - 420, vx: 0, vy: -250, ang: -Math.PI / 2, mode: "fighter", morph: null, morphCd: 0,
            hp: DIFF.hp, maxHp: DIFF.hp, inv: 2, gunCd: 0, gunSide: 1, subCd: 0, missiles: 8, missileT: 0, rifleCd: 0,
            saber: null, combo: 0, comboT: 0, lunge: 0, lvx: 0, lvy: 0, alt: 16, bank: 0, bankF: 0, dead: 0, locks: [], lockN: 0, out: 0,
        };
    }
    function startStage(idx, { intro = false, skipStory = false } = {}) {
        run.stage = idx;
        run.stageScore = run.score;
        run.hearts[idx] = 0;
        st = { def: stages[idx], kills: 0, spawnT: 1.5, bossPhase: "none", bossT: 0, theme: stages[idx].theme, t: 0 };
        setShadowScale(st.theme === "space" ? 0 : 1);
        enemies = []; ebul = []; pbul = []; parts = []; pickups = []; boss = null; decals = [];
        p = newPlayer();
        cam.x = p.x; cam.y = p.y - 60;
        buildWorld(idx);
        audio.playMusic("stage", { transpose: [0, -2, 3, -3, 2][idx] || 0 });
        const lines = [...(intro ? data.intro : []), ...(skipStory ? [] : (st.def.story || []))];
        ctx.state = "play";
        const go = () => { ctx.banner = { text: loc(st.def.name), sub: "", t: 0, dur: 2.4 }; };
        if (lines.length) say(lines, go); else go();
    }
    function buildWorld(idx) {
        const def = stages[idx];
        const r = seeded(1000 + idx * 77);
        props = [];
        const place = (name, n) => {
            for (let i = 0; i < n; i++) {
                let x, y;
                if (st.theme === "city") {
                    // 道路(タイルの右と下の 40px)を避けて、区画の中に建てる
                    const tx = Math.floor(r() * (WORLD / TILE)), ty = Math.floor(r() * (WORLD / TILE));
                    x = tx * TILE + 30 + r() * (TILE - 100); y = ty * TILE + 30 + r() * (TILE - 100);
                } else { x = 80 + r() * (WORLD - 160); y = 80 + r() * (WORLD - 160); }
                if (dist2(x, y, WORLD / 2, WORLD - 420) < 160 * 160) continue;
                const variant = name === "hangar" || name === "wreck" ? name : `${name}:${1 + Math.floor(r() * 6)}`;
                props.push({ m: model(variant), x, y, a: (Math.floor(r() * 8) / 8) * TAU });
            }
        };
        (def.props || []).forEach(([name, n]) => place(name, n));
        farObjs = []; nearObjs = [];
        if (st.theme === "space") {
            // 作戦面の岩はゆっくり回りながら上下にただよう
            props.forEach((q) => { q.spin = (r() - 0.5) * 0.5; q.ph = r() * TAU; });
            // 奥の層(小さく暗く、ゆっくり動く)と手前の層(大きく暗いシルエットが速く横切る)
            for (let i = 0; i < 60; i++) {
                const k = 0.3 + r() * 0.4;
                farObjs.push({ x: r() * WORLD, y: r() * WORLD, k, s: 0.3 + (k - 0.3) * 1.1, b: 0.22 + (k - 0.3) * 1.2, m: model(`asteroid:${1 + Math.floor(r() * 6)}`), a: r() * TAU, spin: (r() - 0.5) * 0.4 });
            }
            farObjs.sort((a, b) => a.k - b.k);
            for (let i = 0; i < 120; i++) {
                nearObjs.push({ x: r() * WORLD, y: r() * WORLD, k: 1.5 + r() * 0.4, s: 1.4 + r() * 0.9, m: model(`${r() < 0.7 ? "asteroid" : "debris"}:${1 + Math.floor(r() * 6)}`), a: r() * TAU, spin: (r() - 0.5) * 0.6 });
            }
        }
        if (st.theme === "city") {
            props.sort((a, b) => a.y - b.y);
        }
        // 地上の敵(最初から配置)
        const gnd = def.ground || {};
        for (const [type, n] of Object.entries(gnd)) {
            for (let i = 0; i < n; i++) {
                let x, y, k = 0;
                do { x = 200 + r() * (WORLD - 400); y = 200 + r() * (WORLD - 600); k++; } while (k < 20 && dist2(x, y, WORLD / 2, WORLD - 420) < 600 * 600);
                spawnEnemy(type, x, y);
            }
        }
        // ハート(遠くに5個、まわりに護衛)
        hearts = [];
        for (let i = 0; i < 5; i++) {
            let x, y, k = 0;
            do { x = 250 + r() * (WORLD - 500); y = 250 + r() * (WORLD - 500); k++; }
            while (k < 50 && (dist2(x, y, WORLD / 2, WORLD - 420) < 700 * 700 || hearts.some((h) => dist2(h.x, h.y, x, y) < 600 * 600)));
            hearts.push({ x, y, t: r() * 6, got: false });
            spawnEnemy(st.theme === "ocean" || st.theme === "space" ? "turret" : idx >= 2 ? "walker" : "tank", x + 70, y + 40);
        }
        // 雲
        cloudList = [];
        const cn = st.theme === "ocean" ? 22 : st.theme === "snow" ? 18 : st.theme === "desert" ? 8 : 0;
        for (let i = 0; i < cn; i++) cloudList.push({ x: r() * WORLD, y: r() * WORLD, k: Math.floor(r() * 3), s: 0.8 + r() * 0.9 });
    }

    // ---------- 会話 ----------
    function say(lines, done) {
        ctx.story = { lines, idx: 0, chars: 0, done };
    }
    function updateStory(dt) {
        const s = ctx.story;
        const line = s.lines[s.idx];
        const full = loc(line.text);
        const before = Math.floor(s.chars);
        s.chars = Math.min(full.length, s.chars + dt * 34);
        if (Math.floor(s.chars) !== before && Math.floor(s.chars) % 2 === 0) sfx("text");
        if (tapped("ok")) {
            if (s.chars < full.length) s.chars = full.length;
            else {
                s.idx++;
                s.chars = 0;
                if (s.idx >= s.lines.length) { ctx.story = null; s.done?.(); }
            }
        }
    }

    // ---------- 敵 ----------
    const ENEMY = {
        drone: { hp: 3, r: 10, alt: 12, air: true, score: 100, model: "drone" },
        lancer: { hp: 5, r: 11, alt: 14, air: true, score: 150, model: "lancer" },
        mine: { hp: 4, r: 9, alt: 5, air: true, score: 80, model: "mine" },
        walker: { hp: 14, r: 13, alt: 0, air: false, score: 300, model: "walker" },
        turret: { hp: 10, r: 12, alt: 0, air: false, score: 200, model: "turretBase" },
        tank: { hp: 12, r: 12, alt: 0, air: false, score: 250, model: "tankHull" },
        diver: { hp: 6, r: 11, alt: 14, air: true, score: 200, model: "diver" },
    };
    function spawnEnemy(type, x, y, extra = {}) {
        const d = ENEMY[type];
        const e = {
            type, x, y, ang: Math.atan2(p ? p.y - y : 1, p ? p.x - x : 0), top: 0, hp: d.hp * DIFF.eHp, maxHp: d.hp * DIFF.eHp, r: d.r, alt: d.alt, air: d.air, score: d.score,
            m: model(d.model), t: rand(0, 3), cd: rand(1.5, 3), flash: 0, vx: 0, vy: 0, orbit: rand(0, TAU), orbitR: rand(110, 190), fade: 0, ...extra,
        };
        enemies.push(e);
        return e;
    }
    function spawnAirWave() {
        const mix = st.def.mix || { drone: 1 };
        const total = Object.values(mix).reduce((a, b) => a + b, 0);
        let k = Math.random() * total, type = "drone";
        for (const [t, w] of Object.entries(mix)) { k -= w; if (k <= 0) { type = t; break; } }
        const n = type === "drone" ? 3 : type === "lancer" ? 2 : 1;
        const a = rand(0, TAU), d = rand(380, 460);
        const bx = clamp(p.x + Math.cos(a) * d, 60, WORLD - 60), by = clamp(p.y + Math.sin(a) * d, 60, WORLD - 60);
        if (st.theme === "space" && type !== "mine") {
            // 宇宙では、画面の中(進行方向寄り)の奥から小さく現れて、だんだん大きくなって近づいてくる
            const fa = Math.atan2(p.vy, p.vx) + rand(-1.1, 1.1);
            const dd = rand(130, 250);
            const ax = clamp(p.x + Math.cos(fa) * dd, 60, WORLD - 60), ay = clamp(p.y + Math.sin(fa) * dd, 60, WORLD - 60);
            for (let i = 0; i < n; i++) spawnEnemy(type, ax + rand(-40, 40), ay + rand(-40, 40), { app: 0, appDur: rand(2.2, 3) + i * 0.35 });
            return;
        }
        for (let i = 0; i < n; i++) spawnEnemy(type, bx + rand(-30, 30), by + rand(-30, 30), { fade: type === "walker" ? 1 : 0 });
    }
    const approaching = (e) => e.app !== undefined && e.app < 1;
    function eShoot(x, y, ang, speed, kind = "s", dmg = 8, extra = {}) {
        const sp = speed * DIFF.bSpd;
        ebul.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, kind, r: kind === "b" ? 7 : kind === "m" ? 5 : 4, life: 4, dmg: dmg * DIFF.eDmg, t: 0, ...extra });
    }
    const aimAt = (x, y) => Math.atan2(p.y - y, p.x - x);

    function updateEnemy(e, dt) {
        e.t += dt;
        e.flash = Math.max(0, e.flash - dt);
        if (approaching(e)) {
            // 奥から接近中: 当たらないし撃たない。着いたら光って一斉射撃
            e.app = Math.min(1, e.app + dt / e.appDur);
            e.ang += clamp(wrapA(aimAt(e.x, e.y) - e.ang), -2 * dt, 2 * dt);
            if (e.app >= 1) {
                e.flash = 0.12;
                spark(e.x, e.y, 10, "#a0d8ff", e.alt);
                if (ctx.state === "play" && !p.dead) {
                    const a0 = aimAt(e.x, e.y);
                    const n = e.type === "diver" ? 5 : 3;
                    for (let i = 0; i < n; i++) eShoot(e.x, e.y, a0 + (i - (n - 1) / 2) * 0.22, 175, "m", 9);
                }
                e.cd = rand(2.2, 3);
            }
            return;
        }
        if (e.fade > 0) { e.fade = Math.max(0, e.fade - dt * 1.5); }
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        const fireOk = d < 420 && !p.dead && e.fade <= 0 && ctx.state === "play";
        e.cd -= dt * DIFF.eFire;
        if (e.type === "drone") {
            e.orbit += dt * 0.8;
            const tx = p.x + Math.cos(e.orbit) * e.orbitR, ty = p.y + Math.sin(e.orbit) * e.orbitR;
            const want = Math.atan2(ty - e.y, tx - e.x);
            e.ang += clamp(wrapA(want - e.ang), -3 * dt, 3 * dt);
            e.x += Math.cos(e.ang) * 175 * dt; e.y += Math.sin(e.ang) * 175 * dt;
            if (e.cd <= 0 && fireOk) { e.cd = rand(2, 3.4); eShoot(e.x, e.y, aimAt(e.x, e.y), 170); }
        } else if (e.type === "lancer") {
            const lead = Math.atan2(p.y + p.vy * 0.4 - e.y, p.x + p.vx * 0.4 - e.x);
            e.ang += clamp(wrapA(lead - e.ang), -2 * dt, 2 * dt);
            e.x += Math.cos(e.ang) * 255 * dt; e.y += Math.sin(e.ang) * 255 * dt;
            if (e.cd <= 0 && fireOk && Math.abs(wrapA(lead - e.ang)) < 0.5 && d < 320) {
                e.cd = rand(2.4, 3.2);
                [-0.25, 0, 0.25].forEach((o) => eShoot(e.x, e.y, e.ang + o, 210, "m"));
            }
        } else if (e.type === "diver") {
            // 自機のまわりを大きく回りながら3連射
            e.orbit += dt * 0.6;
            const tx = p.x + Math.cos(e.orbit) * 170, ty = p.y + Math.sin(e.orbit) * 170;
            e.ang += clamp(wrapA(Math.atan2(ty - e.y, tx - e.x) - e.ang), -2.6 * dt, 2.6 * dt);
            e.x += Math.cos(e.ang) * 200 * dt; e.y += Math.sin(e.ang) * 200 * dt;
            if (e.cd <= 0 && fireOk) {
                e.cd = rand(2.6, 3.2);
                for (let i = 0; i < 3; i++) setTimeoutGame(() => { if (enemies.includes(e)) eShoot(e.x, e.y, aimAt(e.x, e.y), 210, "s", 8); }, i * 0.12);
            }
        } else if (e.type === "mine") {
            e.ang += dt * 1.5;
            e.x += (dx / d) * 38 * dt; e.y += (dy / d) * 38 * dt;
            if (d < 90 && !p.dead && !e.fuse) e.fuse = 0.7;
            if (e.fuse) { e.fuse -= dt; e.flash = Math.floor(e.fuse * 12) % 2 ? 0.05 : 0; if (e.fuse <= 0) { e.hp = 0; killEnemy(e, null); } }
        } else if (e.type === "walker") {
            const want = Math.atan2(dy, dx);
            e.ang += clamp(wrapA(want - e.ang), -1.6 * dt, 1.6 * dt);
            const sp = d > 170 ? 62 : d < 120 ? -40 : 0;
            e.x += Math.cos(e.ang) * sp * dt; e.y += Math.sin(e.ang) * sp * dt;
            if (e.cd <= 0 && fireOk) {
                e.cd = rand(2.6, 3.4);
                for (let i = 0; i < 3; i++) setTimeoutGame(() => { if (enemies.includes(e)) eShoot(e.x + Math.cos(e.ang) * 14, e.y + Math.sin(e.ang) * 14, aimAt(e.x, e.y), 200, "m", 9); }, i * 0.14);
            }
        } else if (e.type === "turret") {
            const want = Math.atan2(dy, dx);
            e.top += clamp(wrapA(want - e.top), -1.4 * dt, 1.4 * dt);
            if (e.cd <= 0 && fireOk && Math.abs(wrapA(want - e.top)) < 0.3) {
                e.cd = rand(1.6, 2.2);
                [-1, 1].forEach((s) => eShoot(e.x + Math.cos(e.top) * 14 - Math.sin(e.top) * s * 2, e.y + Math.sin(e.top) * 14 + Math.cos(e.top) * s * 2, e.top, 190));
            }
        } else if (e.type === "tank") {
            if (!e.moveT || e.moveT < 0) { e.moveT = rand(2, 4); e.moveA = rand(0, TAU); }
            e.moveT -= dt;
            e.ang += clamp(wrapA(e.moveA - e.ang), -1.2 * dt, 1.2 * dt);
            e.x += Math.cos(e.ang) * 34 * dt; e.y += Math.sin(e.ang) * 34 * dt;
            const want = Math.atan2(dy, dx);
            e.top += clamp(wrapA(want - e.top), -1.6 * dt, 1.6 * dt);
            if (e.cd <= 0 && fireOk && Math.abs(wrapA(want - e.top)) < 0.25) { e.cd = rand(2.3, 3); eShoot(e.x + Math.cos(e.top) * 18, e.y + Math.sin(e.top) * 18, e.top, 160, "b", 12); }
        }
        e.x = clamp(e.x, 20, WORLD - 20); e.y = clamp(e.y, 20, WORLD - 20);
        // 空の敵の体当たり
        if (e.air && e.type !== "mine" && !p.dead && p.inv <= 0 && !p.morph && d < e.r + 10) { hurtPlayer(10); damageEnemy(e, 3, null); }
    }
    function damageEnemy(e, dmg, weapon, fx = p.x, fy = p.y) {
        if (e.hp <= 0 || e.fade > 0.3 || approaching(e)) return false;
        if (e.type === "walker" && weapon !== "saber" && weapon !== "missile") {
            // 盾は左手(正面〜左)からの攻撃を防ぐ
            const a = Math.atan2(fy - e.y, fx - e.x);
            const rel = wrapA(a - e.ang);
            if (rel < 0.4 && rel > -1.6) {
                if (weapon === "rifle") dmg *= 0.4;
                else { spark(e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, 6, "#ffe080"); sfx("tick", { vol: 0.4 }); return true; }
            }
        }
        e.hp -= dmg;
        e.flash = 0.07;
        if (e.hp <= 0) killEnemy(e, weapon);
        else sfx("tick", { vol: 0.35 });
        return true;
    }
    function killEnemy(e, weapon) {
        const i = enemies.indexOf(e);
        if (i < 0) return;
        enemies.splice(i, 1);
        if (e.type === "mine") {
            for (let k = 0; k < 10; k++) eShoot(e.x, e.y, (k / 10) * TAU + e.t, 150, "s", 8);
        }
        explode(e.x, e.y, e.alt, e.type === "walker" || e.type === "tank" ? 1.4 : 1, e.m);
        addScore(e.score, e.x, e.y - 10);
        if (!e.summon) st.kills++;
        const roll = Math.random();
        const bigger = e.type === "walker" || e.type === "tank" || e.type === "turret";
        if (roll < (bigger ? 0.14 : 0.06)) pickups.push({ kind: "repair", x: e.x, y: e.y, t: 0 });
        else if (roll > (bigger ? 0.9 : 0.95)) pickups.push({ kind: "ammo", x: e.x, y: e.y, t: 0 });
        if (!e.air) decals.push({ x: e.x, y: e.y, r: 18, t: 0 });
        if (weapon === "saber") ctx.shake = Math.max(ctx.shake, 3);
    }

    // ---------- ボス ----------
    function spawnBoss() {
        const type = st.def.boss.type;
        const a = Math.atan2(p.vy || -1, p.vx || 0);
        const bx = clamp(p.x + Math.cos(a) * 380, 300, WORLD - 300), by = clamp(p.y + Math.sin(a) * 380, 300, WORLD - 300);
        const b = { type, x: bx, y: by, ang: Math.atan2(p.y - by, p.x - bx), t: 0, flash: 0, parts: [], cd: 2, cd2: 4, dead: 0, phase: 0 };
        const hpK = DIFF.eHp;
        const turret = (lx, ly, lz, big = true, hp = 28) => ({ lx, ly, lz, top: 0, hp: hp * hpK, maxHp: hp * hpK, alive: true, cd: rand(1, 3), r: big ? 15 : 12, big });
        if (type === "carrier") {
            const m = model("carrier"); b.m = m; const s = m.px;
            b.hp = b.maxHp = 170 * hpK;
            b.parts = [turret(28 * s, 0, 6), turret(12 * s, -5 * s, 6), turret(-30 * s, 0, 6), turret(0, 6 * s, 6)];
            b.core = { lx: -15 * s, ly: 6.5 * s, r: 18, armored: true };
        } else if (type === "crawler") {
            const m = model("crawler"); b.m = m; const s = m.px;
            b.hp = b.maxHp = 230 * hpK;
            b.core = { lx: -11 * s, ly: 0, r: 16, back: true };
            b.bodyR = 30;
        } else if (type === "rival") {
            b.hp = b.maxHp = 230 * hpK;
            b.mode = "fighter"; b.morph = null; b.modeT = 6; b.alt = 16; b.vx = 0; b.vy = 0; b.bank = 0;
            b.core = { lx: 0, ly: 0, r: 15 };
        } else if (type === "fortress") {
            const m = model("fortress"); b.m = m; const s = m.px;
            b.hp = b.maxHp = 240 * hpK;
            for (let i = 0; i < 8; i++) { const aa = (i / 8) * TAU + TAU / 16; b.parts.push(turret(Math.cos(aa) * 22 * s, Math.sin(aa) * 22 * s, 6, false, 22)); }
            b.core = { lx: 0, ly: 0, r: 26, armored: true };
        } else if (type === "flagship") {
            const m = model("flagship"); b.m = m; const s = m.px;
            b.hp = b.maxHp = 360 * hpK;
            [[30, -8], [30, 8], [12, -10], [12, 10], [-28, -9], [-28, 9]].forEach(([x, y]) => b.parts.push(turret(x * s, y * s, 9, true, 26)));
            b.core = { lx: -8 * s, ly: 0, r: 20, armored: true };
            b.beam = null; b.beamCd = 6;
        }
        boss = b;
    }
    const bossLocal = (lx, ly) => {
        const c = Math.cos(boss.ang), s = Math.sin(boss.ang);
        return { x: boss.x + lx * c - ly * s, y: boss.y + lx * s + ly * c };
    };
    const liveTurrets = () => (boss ? boss.parts.filter((q) => q.alive).length : 0);
    /** 旗艦の極太ビームの発射口 [位置, 向き](艦首と艦尾) */
    const beamMuzzles = (b) => [[bossLocal(57 * b.m.px, 0), b.ang], [bossLocal(-65 * b.m.px, 0), b.ang + Math.PI]];
    const BOSS_SHOT = 1.4; // ボスの弾は雑魚より速い
    function updateBoss(dt) {
        const n0 = ebul.length;
        updateBossInner(dt);
        for (let i = n0; i < ebul.length; i++) { ebul[i].vx *= BOSS_SHOT; ebul[i].vy *= BOSS_SHOT; }
    }
    function updateBossInner(dt) {
        const b = boss;
        b.t += dt;
        b.flash = Math.max(0, b.flash - dt);
        if (b.dead > 0) {
            b.dead -= dt;
            if (Math.random() < dt * 14) { const r = (b.m?.r || 20) * (b.m?.px || 1.5) * 0.7; explode(b.x + rand(-r, r), b.y + rand(-r, r), rand(0, 12), 1.2, b.m || model("rivalF"), { quiet: Math.random() < 0.6 }); }
            if (b.dead <= 0) bossDefeated();
            return;
        }
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
        const toP = Math.atan2(dy, dx);
        b.cd -= dt * DIFF.eFire; b.cd2 -= dt * DIFF.eFire;
        const fire = !p.dead;
        // 砲台
        b.parts.forEach((q) => {
            if (!q.alive) { if (Math.random() < dt * 3) { const w = bossLocal(q.lx, q.ly); smoke(w.x, w.y, 10); } return; }
            const w = bossLocal(q.lx, q.ly);
            const want = Math.atan2(p.y - w.y, p.x - w.x);
            q.top += clamp(wrapA(want - q.top), -1.3 * dt, 1.3 * dt);
            q.cd -= dt * DIFF.eFire;
            if (q.cd <= 0 && fire && Math.hypot(p.x - w.x, p.y - w.y) < 520) {
                q.cd = rand(1.8, 2.6);
                if (b.type === "fortress") eShoot(w.x, w.y, q.top, 170, "m", 9);
                else [-0.12, 0.12].forEach((o) => eShoot(w.x, w.y, q.top + o, 180, "s", 9));
            }
        });
        if (b.type === "carrier") {
            b.ang += dt * 0.12;
            b.x += Math.cos(b.ang) * 32 * dt; b.y += Math.sin(b.ang) * 32 * dt;
            if (d > 520) { b.x += (dx / d) * 30 * dt; b.y += (dy / d) * 30 * dt; }
            if (b.cd <= 0 && fire) {
                b.cd = 4;
                const w = bossLocal(b.core.lx, b.core.ly);
                for (let i = -3; i <= 3; i++) eShoot(w.x, w.y, Math.atan2(p.y - w.y, p.x - w.x) + i * 0.16, 150, "b", 11);
            }
            if (b.cd2 <= 0) { b.cd2 = 9; for (let i = 0; i < 3; i++) spawnEnemy("drone", b.x + rand(-40, 40), b.y + rand(-40, 40), { summon: true }); }
        } else if (b.type === "crawler") {
            if (b.dash > 0) {
                b.dash -= dt;
                b.x += Math.cos(b.ang) * 330 * dt; b.y += Math.sin(b.ang) * 330 * dt;
                if (Math.random() < dt * 30) smoke(b.x - Math.cos(b.ang) * 20, b.y - Math.sin(b.ang) * 20, 8, "#c8a070");
            } else if (b.warn > 0) {
                b.warn -= dt;
                if (b.warn <= 0) { b.dash = 0.8; sfx("dive"); }
            } else {
                b.ang += clamp(wrapA(toP - b.ang), -0.55 * dt, 0.55 * dt);
                if (d > 150) { b.x += Math.cos(b.ang) * 48 * dt; b.y += Math.sin(b.ang) * 48 * dt; }
                if (b.cd2 <= 0 && d < 260 && Math.abs(wrapA(toP - b.ang)) < 0.35) { b.cd2 = 6; b.warn = 0.7; b.ang = toP; sfx("warning"); }
            }
            if (b.cd <= 0 && fire) {
                b.cd = 2.4 - (1 - b.hp / b.maxHp) * 0.8;
                const w = bossLocal(-6 * b.m.px, 0);
                for (let i = -2; i <= 2; i++) eShoot(w.x, w.y, Math.atan2(p.y - w.y, p.x - w.x) + i * 0.2, 175, "b", 10);
            }
            if (!p.dead && p.inv <= 0 && !p.morph && d < b.bodyR + 8) hurtPlayer(b.dash > 0 ? 24 : 12);
        } else if (b.type === "rival") {
            updateRival(b, dt, d, toP);
        } else if (b.type === "fortress") {
            b.ang += dt * (0.18 + (1 - b.hp / b.maxHp) * 0.2);
            if (d > 200) { b.x += (dx / d) * 20 * dt; b.y += (dy / d) * 20 * dt; }
            if (b.cd <= 0 && fire) {
                b.cd = b.hp < b.maxHp / 2 ? 2.4 : 3.4;
                const n = b.hp < b.maxHp / 2 ? 20 : 16;
                for (let i = 0; i < n; i++) eShoot(b.x, b.y, (i / n) * TAU + b.t * 0.7, 130, "b", 10);
            }
        } else if (b.type === "flagship") {
            if (b.beam) {
                b.beam.t += dt;
                if (b.beam.t < 1.5) {
                    b.ang += clamp(wrapA(toP - b.ang), -0.7 * dt, 0.7 * dt); // 照準を合わせてから固定
                } else if (b.beam.t < 2.9) {
                    if (!b.beam.fired) { b.beam.fired = true; sfx("bigBeam"); ctx.shake = 6; }
                    // 艦首と艦尾の両方から撃つ
                    if (!p.dead && !p.morph && p.inv <= 0 && beamMuzzles(b).some(([o, a]) => segCircle(o.x, o.y, o.x + Math.cos(a) * 1100, o.y + Math.sin(a) * 1100, p.x, p.y, 24))) hurtPlayer(30);
                } else { b.beam = null; b.beamCd = 8; }
            } else {
                b.ang += clamp(wrapA(toP - b.ang), -0.25 * dt, 0.25 * dt);
                if (d > 280) { b.x += Math.cos(b.ang) * 36 * dt; b.y += Math.sin(b.ang) * 36 * dt; }
                b.beamCd -= dt;
                if (b.beamCd <= 0) { b.beam = { t: 0, fired: false }; sfx("chargeUp"); }
                if (b.cd <= 0 && fire) {
                    b.cd = 3.2;
                    const w = bossLocal(b.core.lx, b.core.ly);
                    for (let i = 0; i < 12; i++) eShoot(w.x, w.y, (i / 12) * TAU + b.t, 140, "m", 9);
                }
                if (b.cd2 <= 0) { b.cd2 = 10; for (let i = 0; i < 3; i++) spawnEnemy(i === 0 ? "lancer" : "drone", b.x + rand(-60, 60), b.y + rand(-60, 60), { summon: true }); }
            }
        }
        b.x = clamp(b.x, 120, WORLD - 120); b.y = clamp(b.y, 120, WORLD - 120);
    }
    function updateRival(b, dt, d, toP) {
        if (b.morph) {
            b.morph.t += dt / 0.55;
            if (b.morph.t >= 1) { b.mode = b.morph.to; b.morph = null; b.modeT = rand(5, 7); }
        } else {
            b.modeT -= dt;
            if (b.modeT <= 0) { b.morph = { t: 0, to: b.mode === "fighter" ? "robot" : "fighter" }; sfx("transform", { vol: 0.6 }); }
        }
        const robot = b.mode === "robot" && !b.morph;
        b.alt += ((b.mode === "fighter" ? 16 : 5) - b.alt) * Math.min(1, dt * 4);
        if (b.mode === "fighter" || b.morph) {
            // 自機のまわりを旋回しながら機銃とミサイル
            const tx = p.x + Math.cos(b.t * 0.9) * 210, ty = p.y + Math.sin(b.t * 0.9) * 210;
            const want = d < 140 ? toP + Math.PI * 0.6 : Math.atan2(ty - b.y, tx - b.x);
            const turn = clamp(wrapA(want - b.ang), -2.6 * dt, 2.6 * dt);
            b.ang += turn;
            b.bank = clamp(Math.round(turn / dt / 1.2), -2, 2);
            const sp = b.morph ? 120 : 265;
            b.x += Math.cos(b.ang) * sp * dt; b.y += Math.sin(b.ang) * sp * dt;
            if (!b.morph && b.cd <= 0 && Math.abs(wrapA(toP - b.ang)) < 0.4 && d < 380) {
                b.cd = 1.5;
                for (let i = 0; i < 5; i++) setTimeoutGame(() => { if (boss === b && b.dead <= 0) eShoot(b.x, b.y, b.ang + rand(-0.06, 0.06), 300, "s", 7); }, i * 0.07);
            }
            if (!b.morph && b.cd2 <= 0) {
                b.cd2 = 4.5;
                sfx("missile", { vol: 0.6 });
                for (let i = 0; i < 3; i++) eShoot(b.x, b.y, b.ang + (i - 1) * 0.9, 150, "missile", 12, { homing: 2.2, hp: 1, life: 3.2 });
            }
        } else {
            b.bank = 0;
            if (b.slash) {
                b.slash.t += dt;
                if (b.slash.t > 0.45 && !b.slash.go) { b.slash.go = true; sfx("saber"); }
                if (b.slash.go && b.slash.t < 0.7) {
                    b.x += Math.cos(b.slash.a) * 420 * dt; b.y += Math.sin(b.slash.a) * 420 * dt;
                    if (!p.dead && !p.morph && p.inv <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < 42) hurtPlayer(20);
                }
                if (b.slash.t > 0.9) b.slash = null;
            } else {
                b.ang += clamp(wrapA(toP - b.ang), -4 * dt, 4 * dt);
                const sp = d > 200 ? 130 : d < 130 ? -60 : 30;
                const side = Math.sin(b.t * 1.3) * 80;
                b.x += Math.cos(b.ang) * sp * dt - Math.sin(b.ang) * side * dt;
                b.y += Math.sin(b.ang) * sp * dt + Math.cos(b.ang) * side * dt;
                if (b.cd <= 0 && robot) { b.cd = 1.2; sfx("beam", { vol: 0.5 }); eShoot(b.x + Math.cos(b.ang) * 16, b.y + Math.sin(b.ang) * 16, b.ang, 330, "beam", 13, { r: 6 }); }
                if (b.cd2 <= 0 && d < 150) { b.cd2 = 3; b.slash = { t: 0, a: toP, go: false }; }
            }
        }
    }
    function damageBoss(target, dmg, weapon, fx, fy) {
        const b = boss;
        if (!b || b.dead > 0 || ctx.state !== "play" || st.bossPhase !== "fight") return false;
        if (target === "core") {
            let k = 1;
            if (b.core.armored && liveTurrets() > 0) k = 0.3;
            if (b.core.back) {
                const a = Math.atan2(fy - b.y, fx - b.x);
                k = Math.abs(wrapA(a - b.ang)) > 1.9 ? 1.4 : 0.35;
                if (k > 1) popText(tr("weak"), fx, fy - 12, COL.yellow, 0.5);
            }
            b.hp -= dmg * k;
            b.flash = 0.06;
            sfx("tick", { vol: k < 1 ? 0.25 : 0.5 });
            if (b.hp <= 0) { b.hp = 0; b.dead = 2.6; run.finish[run.stage] = weapon || "gun"; run.finishHp = p.hp / p.maxHp; sfx("bossDown"); ctx.flash = 0.8; ctx.shake = 10; ebul = []; enemies.forEach((e) => { if (e.summon) e.hp = 0; }); enemies = enemies.filter((e) => !e.summon); }
        } else {
            target.hp -= dmg;
            target.flash = 0.06;
            if (target.hp <= 0 && target.alive) {
                target.alive = false;
                const w = bossLocal(target.lx, target.ly);
                explode(w.x, w.y, 8, 1.6, model(target.big ? "bigTurretTop" : "turretTop"));
                addScore(500, w.x, w.y - 10);
            } else sfx("tick", { vol: 0.4 });
        }
        return true;
    }
    /** 弾が当たるボスの部位を探す(線分 x0,y0 → x1,y1) */
    function bossHit(x0, y0, x1, y1, pad = 0) {
        if (!boss || boss.dead > 0 || st.bossPhase !== "fight") return null;
        for (const q of boss.parts) {
            if (!q.alive) continue;
            const w = bossLocal(q.lx, q.ly);
            if (segCircle(x0, y0, x1, y1, w.x, w.y, q.r + pad)) return { target: q, x: w.x, y: w.y };
        }
        const c = bossLocal(boss.core.lx, boss.core.ly);
        if (segCircle(x0, y0, x1, y1, c.x, c.y, boss.core.r + pad)) return { target: "core", x: c.x, y: c.y };
        // 船体に当たったら弾は止まる(ダメージなし)
        if (boss.m && boss.type !== "rival") {
            const hullR = boss.type === "fortress" ? 44 : boss.type === "crawler" ? 30 : 0;
            if (hullR && segCircle(x0, y0, x1, y1, boss.x, boss.y, hullR)) return { target: "hull", x: x1, y: y1 };
            if (boss.type === "carrier" || boss.type === "flagship") {
                // 細長い船体: 中心線との距離で判定
                const len = boss.type === "carrier" ? 62 : 80, wid = boss.type === "carrier" ? 15 : 18;
                const a = bossLocal(-len, 0), bb = bossLocal(len, 0);
                for (let k = 0; k <= 4; k++) {
                    const t = k / 4, px2 = a.x + (bb.x - a.x) * t, py2 = a.y + (bb.y - a.y) * t;
                    if (segCircle(x0, y0, x1, y1, px2, py2, wid)) return { target: "hull", x: x1, y: y1 };
                }
            }
        }
        return null;
    }
    function bossDefeated() {
        explode(boss.x, boss.y, 10, 4, boss.m || model("rivalF"));
        addScore(10000, boss.x, boss.y - 20);
        boss = null;
        st.bossPhase = "done";
        stageClear();
    }

    // ---------- 自機 ----------
    function hurtPlayer(dmg) {
        if (p.dead || p.inv > 0 || p.morph || ctx.god || ctx.state !== "play") return;
        const k = p.mode === "robot" ? 0.7 : 1;
        p.hp -= dmg * k;
        p.inv = 1.0;
        p.hitT = 0.1;
        ctx.shake = Math.max(ctx.shake, 5);
        sfx("damage");
        spark(p.x, p.y, 10, "#ffd080");
        if (p.hp <= 0) playerDown();
    }
    function playerDown() {
        p.hp = 0;
        p.dead = 1.8;
        explode(p.x, p.y, p.alt, 2.2, model(p.mode === "fighter" ? "fighter" : "robot"));
        sfx("playerDown");
        run.lives--;
    }
    function respawn() {
        if (run.lives <= 0) { gameOver(); return; }
        p.dead = 0; p.hp = p.maxHp; p.inv = 2.5; p.missiles = 8; p.morph = null;
        ebul = ebul.filter((b) => dist2(b.x, b.y, p.x, p.y) > 300 * 300);
    }
    const lockTargets = () => {
        const out = [];
        const fa = p.ang;
        const consider = (x, y, ref) => {
            const d = Math.hypot(x - p.x, y - p.y);
            if (d > 540 || d < 20) return;
            const rel = Math.abs(wrapA(Math.atan2(y - p.y, x - p.x) - fa));
            if (rel < 0.9) out.push({ ref, x, y, d });
        };
        enemies.forEach((e) => { if (e.fade <= 0 && !approaching(e)) consider(e.x, e.y, e); });
        if (boss && st.bossPhase === "fight" && boss.dead <= 0) {
            boss.parts.forEach((q) => { if (q.alive) { const w = bossLocal(q.lx, q.ly); consider(w.x, w.y, q); } });
            const c = bossLocal(boss.core.lx, boss.core.ly);
            consider(c.x, c.y, "core");
        }
        out.sort((a, b) => a.d - b.d);
        return out.slice(0, 4);
    };
    function nearestTarget(range) {
        let best = null, bd = range * range;
        const consider = (x, y) => { const d = dist2(x, y, p.x, p.y); if (d < bd) { bd = d; best = { x, y }; } };
        enemies.forEach((e) => { if (e.fade <= 0 && !approaching(e)) consider(e.x, e.y); });
        if (boss && st.bossPhase === "fight" && boss.dead <= 0) {
            boss.parts.forEach((q) => { if (q.alive) { const w = bossLocal(q.lx, q.ly); consider(w.x, w.y); } });
            const c = bossLocal(boss.core.lx, boss.core.ly);
            consider(c.x, c.y);
        }
        return best;
    }
    const localPt = (lx, ly, a = p.ang) => ({ x: p.x + lx * Math.cos(a) - ly * Math.sin(a), y: p.y + lx * Math.sin(a) + ly * Math.cos(a) });

    const ROBOT_SPEED = 112; // 人型は小回りが利くぶん遅い(戦闘機は 255)
    function updatePlayer(dt, inp) {
        p.inv = Math.max(0, p.inv - dt);
        p.hitT = Math.max(0, (p.hitT || 0) - dt);
        p.morphCd = Math.max(0, p.morphCd - dt);
        p.gunCd -= dt; p.rifleCd -= dt; p.subCd -= dt; p.comboT -= dt;
        if (p.dead > 0) {
            p.dead -= dt;
            if (p.dead <= 0) respawn();
            return;
        }
        // ミサイルの自然回復
        if (p.missiles < 8) { p.missileT += dt; if (p.missileT > 0.75) { p.missileT = 0; p.missiles++; } }
        // 変形
        if (tapped("morph") && !p.morph && p.morphCd <= 0) {
            p.morph = { t: 0, to: p.mode === "fighter" ? "robot" : "fighter" };
            p.saber = null;
            p.turnV = 0;
            sfx("transform");
        }
        if (p.morph) {
            p.morph.t += dt / 0.55;
            if (p.morph.t >= 1) { p.mode = p.morph.to; p.morph = null; p.morphCd = 0.2; spark(p.x, p.y - 10, 12, "#a0f8ff"); }
        }
        const ix = inp.x, iy = inp.y, moving = Math.hypot(ix, iy) > 0.1;
        const fighterPhys = p.morph ? p.morph.to === "robot" ? p.morph.t < 0.4 : p.morph.t > 0.6 : p.mode === "fighter";
        if (fighterPhys) {
            // 戦闘機は ← → で右旋回・左旋回だけ(↑↓は使わない)。押し続けると旋回が速くなる
            const steer = ix > 0.2 ? 1 : ix < -0.2 ? -1 : 0;
            const target = steer * 3.7;
            p.turnV = (p.turnV || 0) + clamp(target - (p.turnV || 0), -16 * dt, 16 * dt);
            if (!steer && Math.abs(p.turnV) < 0.05) p.turnV = 0;
            const turn = p.turnV * dt;
            p.ang += turn;
            p.bankF += (clamp(turn / dt / 1.3, -2, 2) - p.bankF) * Math.min(1, dt * 8);
            const sp = p.morph ? 160 : 255;
            p.vx += (Math.cos(p.ang) * sp - p.vx) * Math.min(1, dt * 6);
            p.vy += (Math.sin(p.ang) * sp - p.vy) * Math.min(1, dt * 6);
        } else {
            p.bankF *= 0.8;
            const len = Math.hypot(ix, iy) || 1;
            const tvx = moving ? (ix / Math.max(1, len)) * ROBOT_SPEED : 0, tvy = moving ? (iy / Math.max(1, len)) * ROBOT_SPEED : 0;
            p.vx += (tvx - p.vx) * Math.min(1, dt * 9);
            p.vy += (tvy - p.vy) * Math.min(1, dt * 9);
            const tgt = nearestTarget(330);
            const want = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : moving ? Math.atan2(iy, ix) : p.ang;
            p.ang += clamp(wrapA(want - p.ang), -9 * dt, 9 * dt);
        }
        p.bank = Math.round(p.bankF);
        let vx = p.vx, vy = p.vy;
        if (p.lunge > 0) { p.lunge -= dt; vx = p.lvx; vy = p.lvy; }
        p.x += vx * dt; p.y += vy * dt;
        const ox = p.x, oy = p.y;
        p.x = clamp(p.x, 30, WORLD - 30); p.y = clamp(p.y, 30, WORLD - 30);
        p.out = ox !== p.x || oy !== p.y ? 1.5 : Math.max(0, p.out - dt);
        if (p.out > 0 && fighterPhys && Math.abs(ix) < 0.2) p.ang += clamp(wrapA(Math.atan2(WORLD / 2 - p.y, WORLD / 2 - p.x) - p.ang), -2 * dt, 2 * dt);
        const altT = p.morph ? (p.morph.to === "robot" ? 16 - 11 * p.morph.t : 5 + 11 * p.morph.t) : p.mode === "fighter" ? 16 : 5 + Math.sin(ctx.t * 3) * 1.2;
        const floatK = st.theme === "space" && !p.morph ? Math.sin(ctx.t * 1.1) * 3 : 0;
        p.alt += (altT + floatK - p.alt) * Math.min(1, dt * 10);
        // 排気
        if (fighterPhys && !p.morph) {
            [-1, 1].forEach((s) => { const q = localPt(-22, 6 * s); trail(q.x, q.y, p.alt + 2, "#ffb050", 0.25, 2.2); });
            if (Math.abs(p.bankF) > 1.2) [-1, 1].forEach((s) => { const q = localPt(-12, 19 * s); trail(q.x, q.y, p.alt + 3, "#ffffff", 0.45, 1, true); });
        } else if (!p.morph && moving) {
            const q = localPt(-7, 0);
            trail(q.x, q.y, p.alt + 16, "#ffb050", 0.18, 2);
        }
        p.locks = p.mode === "fighter" && !p.morph ? lockTargets() : [];
        if (p.locks.length > p.lockN) sfx("lock", { vol: 0.35 });
        p.lockN = p.locks.length;
        // 武器
        if (p.morph) return;
        const fireHeld = held.has("fire") || held.has("padfire");
        if (p.mode === "fighter") {
            if (fireHeld && p.gunCd <= 0) {
                p.gunCd = 0.075;
                p.gunSide *= -1;
                const q = localPt(10, 5 * p.gunSide);
                const a = p.ang + rand(-0.03, 0.03);
                pbul.push({ k: "gun", x: q.x, y: q.y, vx: Math.cos(a) * 640 + p.vx * 0.5, vy: Math.sin(a) * 640 + p.vy * 0.5, life: 0.6, dmg: 1.4 });
                sfx("gun", { vol: 0.35, rate: rand(0.95, 1.05) });
            }
            if (tapped("sub") && p.subCd <= 0) {
                if (p.missiles <= 0) sfx("empty");
                else {
                    p.subCd = 0.35;
                    const locks = p.locks.length ? p.locks : [null, null];
                    const n = Math.min(p.missiles, Math.max(2, locks.length));
                    for (let i = 0; i < n; i++) {
                        const side = i % 2 ? 1 : -1;
                        const q = localPt(0, 12 * side);
                        const a = p.ang + side * 0.7;
                        const lk = locks[i % locks.length];
                        pbul.push({ k: "missile", x: q.x, y: q.y, ang: a, sp: 160, life: 2.4, dmg: 5, target: lk?.ref || null, delay: i * 0.05 });
                    }
                    p.missiles -= n;
                    sfx("missile");
                }
            }
        } else {
            if (fireHeld && p.rifleCd <= 0) {
                p.rifleCd = 0.32;
                const q = localPt(18, 9);
                pbul.push({ k: "beam", x: q.x, y: q.y, vx: Math.cos(p.ang) * 1150, vy: Math.sin(p.ang) * 1150, life: 0.45, dmg: 3.2, hit: new Set() });
                spark(q.x, q.y, 4, "#ff9ad8", p.alt + 10);
                sfx("beam", { vol: 0.6 });
            }
            if (tapped("sub") && p.subCd <= 0) startSlash();
        }
    }
    function startSlash() {
        p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1;
        p.comboT = 0.6;
        p.subCd = p.combo === 3 ? 0.45 : 0.24;
        const spin = p.combo === 3;
        const tgt = nearestTarget(130);
        if (tgt) {
            const a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
            p.ang = a;
            const d = Math.hypot(tgt.x - p.x, tgt.y - p.y);
            if (d > 40) { p.lunge = 0.12; p.lvx = Math.cos(a) * (d - 30) / 0.12; p.lvy = Math.sin(a) * (d - 30) / 0.12; }
        }
        p.saber = { t: 0, dur: spin ? 0.32 : 0.2, dir: p.ang, side: p.combo === 2 ? -1 : 1, spin, hit: new Set(), dmg: spin ? 16 : 9, R: spin ? 46 : 38 };
        sfx("saber");
    }
    function updateSaber(dt) {
        const s = p.saber;
        if (!s) return;
        s.t += dt;
        if (s.t > s.dur + 0.18) { p.saber = null; return; }
        if (s.t > s.dur) return;
        const inArc = (x, y, extra = 0) => {
            const d = Math.hypot(x - p.x, y - p.y);
            if (d > s.R + extra) return false;
            if (s.spin) return true;
            return Math.abs(wrapA(Math.atan2(y - p.y, x - p.x) - s.dir)) < 1.35;
        };
        // 弾を斬り払う
        let parried = 0;
        ebul = ebul.filter((b) => { if (inArc(b.x, b.y, 6)) { parried++; spark(b.x, b.y, 5, "#ff9ad8"); return false; } return true; });
        if (parried) { sfx("parry"); addScore(10 * parried, p.x, p.y - 30, false); if (parried >= 3) popText(tr("parry"), p.x, p.y - 40, COL.pink, 0.7); }
        if (s.t < 0.04) return;
        enemies.slice().forEach((e) => {
            if (s.hit.has(e) || !inArc(e.x, e.y, e.r)) return;
            s.hit.add(e);
            if (damageEnemy(e, s.dmg, "saber")) { sfx("slash"); slashFx(e.x, e.y); }
        });
        if (boss && st.bossPhase === "fight" && boss.dead <= 0) {
            boss.parts.forEach((q) => {
                if (!q.alive || s.hit.has(q)) return;
                const w = bossLocal(q.lx, q.ly);
                if (inArc(w.x, w.y, q.r)) { s.hit.add(q); damageBoss(q, s.dmg, "saber", p.x, p.y); sfx("slash"); slashFx(w.x, w.y); }
            });
            const c = bossLocal(boss.core.lx, boss.core.ly);
            if (!s.hit.has("core") && inArc(c.x, c.y, boss.core.r)) { s.hit.add("core"); damageBoss("core", s.dmg * 1.2, "saber", p.x, p.y); sfx("slash"); slashFx(c.x, c.y); }
        }
    }

    function updatePlayerBullets(dt) {
        for (let i = pbul.length - 1; i >= 0; i--) {
            const b = pbul[i];
            b.life -= dt;
            if (b.life <= 0) { pbul.splice(i, 1); continue; }
            const x0 = b.x, y0 = b.y;
            if (b.k === "missile") {
                if (b.delay > 0) { b.delay -= dt; b.x += Math.cos(b.ang) * 60 * dt + p.vx * dt; b.y += Math.sin(b.ang) * 60 * dt + p.vy * dt; continue; }
                let tx = null, ty = null;
                if (b.target === "core" && boss && boss.dead <= 0) { const c = bossLocal(boss.core.lx, boss.core.ly); tx = c.x; ty = c.y; }
                else if (b.target && b.target.lx !== undefined && boss && b.target.alive) { const w = bossLocal(b.target.lx, b.target.ly); tx = w.x; ty = w.y; }
                else if (b.target && enemies.includes(b.target)) { tx = b.target.x; ty = b.target.y; }
                if (tx !== null) b.ang += clamp(wrapA(Math.atan2(ty - b.y, tx - b.x) - b.ang), -5.5 * dt, 5.5 * dt);
                b.sp = Math.min(560, b.sp + 900 * dt);
                b.x += Math.cos(b.ang) * b.sp * dt; b.y += Math.sin(b.ang) * b.sp * dt;
                b.tt = (b.tt || 0) + dt;
                if (b.tt > 0.016) { b.tt = 0; trail(b.x, b.y, 12, "#d8d8e0", 0.6, 2.5, false, true); }
            } else { b.x += b.vx * dt; b.y += b.vy * dt; }
            let dead = false;
            const pad = b.k === "beam" ? 4 : 0;
            for (const e of enemies) {
                if (b.hit?.has(e)) continue;
                if (e.fade > 0.3 || approaching(e)) continue;
                if (segCircle(x0, y0, b.x, b.y, e.x, e.y, e.r + pad)) {
                    damageEnemy(e, b.dmg, b.k === "gun" ? "gun" : b.k, x0, y0);
                    if (b.k === "beam") { b.hit.add(e); spark(e.x, e.y, 6, "#ff9ad8"); }
                    else { dead = true; if (b.k === "missile") explode(b.x, b.y, 10, 0.6, null, { quiet: true }); else spark(b.x, b.y, 3, "#ffe080", p.alt); break; }
                }
            }
            // 敵ミサイルは撃ち落とせる
            if (!dead) for (let j = ebul.length - 1; j >= 0; j--) {
                const eb = ebul[j];
                if (eb.kind === "missile" && segCircle(x0, y0, b.x, b.y, eb.x, eb.y, 8)) { ebul.splice(j, 1); explode(eb.x, eb.y, 8, 0.5, null, { quiet: true }); if (b.k !== "beam") { dead = true; break; } }
            }
            if (!dead) {
                const h = bossHit(x0, y0, b.x, b.y, pad);
                if (h && !(b.hit?.has(h.target))) {
                    if (h.target !== "hull") damageBoss(h.target, b.dmg, b.k === "gun" ? "gun" : b.k, x0, y0);
                    if (b.k === "beam") { b.hit.add(h.target); spark(h.x, h.y, 6, "#ff9ad8"); if (h.target === "hull") dead = true; }
                    else { dead = true; if (b.k === "missile") explode(b.x, b.y, 10, 0.6, null, { quiet: true }); else spark(b.x, b.y, 3, "#ffe080", 8); }
                }
            }
            if (dead) pbul.splice(i, 1);
        }
    }
    function updateEnemyBullets(dt) {
        const pr = p.mode === "fighter" ? 5 : 9;
        for (let i = ebul.length - 1; i >= 0; i--) {
            const b = ebul[i];
            b.t += dt;
            b.life -= dt;
            if (b.homing && b.t < b.homing && !p.dead) {
                const a = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy) + 120 * dt;
                const na = a + clamp(wrapA(aimAt(b.x, b.y) - a), -2.4 * dt, 2.4 * dt);
                b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
                if (Math.random() < 0.5) trail(b.x, b.y, 10, "#c8a0a0", 0.5, 2, false, true);
            }
            const x0 = b.x, y0 = b.y;
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.life <= 0 || b.x < -50 || b.y < -50 || b.x > WORLD + 50 || b.y > WORLD + 50) { ebul.splice(i, 1); continue; }
            if (!p.dead && !p.morph && p.inv <= 0 && segCircle(x0, y0, b.x, b.y, p.x, p.y, pr + b.r)) {
                ebul.splice(i, 1);
                hurtPlayer(b.dmg);
            }
        }
    }

    // ---------- 拾う物 ----------
    function updatePickups(dt) {
        for (let i = pickups.length - 1; i >= 0; i--) {
            const q = pickups[i];
            q.t += dt;
            if (q.t > 14) { pickups.splice(i, 1); continue; }
            if (!p.dead && dist2(q.x, q.y, p.x, p.y) < 26 * 26) {
                pickups.splice(i, 1);
                if (q.kind === "repair") { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3); sfx("repair"); popText(tr("repair"), p.x, p.y - 30, COL.green); }
                else { p.missiles = 8; sfx("item"); popText(tr("ammo"), p.x, p.y - 30, COL.cyan); addScore(200, p.x, p.y, false); }
            }
        }
        hearts.forEach((h) => {
            h.t += dt;
            if (h.got || p.dead) return;
            if (dist2(h.x, h.y, p.x, p.y) < 28 * 28) {
                h.got = true;
                run.hearts[run.stage] = (run.hearts[run.stage] || 0) + 1;
                sfx("heart");
                popText(tr("heartGot", run.hearts[run.stage]), h.x, h.y - 30, COL.pink, 1.4);
                for (let k = 0; k < 16; k++) spark(h.x, h.y, 1, "#ff78b8", 14);
                addScore(1000, h.x, h.y, false);
            }
        });
    }

    // ---------- 演出(パーティクル) ----------
    function addScore(n, x, y, show = true) {
        run.score += n;
        if (show) popText(String(n), x, y, COL.white, 0.7);
    }
    function popText(text, x, y, color, life = 1) {
        if (parts.length > 1200) return;
        parts.push({ k: "text", x, y, alt: 0, text, color, t: 0, life });
    }
    function spark(x, y, n, color, alt = 8) {
        for (let i = 0; i < n && parts.length < 1200; i++) {
            const a = rand(0, TAU), s = rand(60, 220);
            parts.push({ k: "spark", x, y, alt, vx: Math.cos(a) * s, vy: Math.sin(a) * s, va: rand(-40, 80), t: 0, life: rand(0.15, 0.4), color });
        }
    }
    function smoke(x, y, alt, color = "#5a5a60") {
        if (parts.length > 1200) return;
        parts.push({ k: "smoke", x: x + rand(-4, 4), y: y + rand(-4, 4), alt, va: rand(15, 30), t: 0, life: rand(0.8, 1.4), r: rand(4, 8), color });
    }
    function trail(x, y, alt, color, life, r, thin = false, smokeLike = false) {
        if (parts.length > 1200) return;
        parts.push({ k: smokeLike ? "puff" : thin ? "line" : "glow", x, y, alt, t: 0, life, r, color });
    }
    function slashFx(x, y) {
        parts.push({ k: "cut", x, y, alt: 12, a: rand(0, Math.PI), t: 0, life: 0.25 });
        spark(x, y, 8, "#ffc0e8", 12);
    }
    /** 爆発。m があればその色のボクセル片が飛び散る */
    function explode(x, y, alt, size, m, { quiet = false } = {}) {
        if (!quiet) sfx(size >= 2 ? "blast" : "pop", { vol: Math.min(1, 0.5 + size * 0.2), rate: rand(0.9, 1.1) });
        const n = Math.round(6 * size);
        if (parts.length > 1100) return;
        parts.push({ k: "ring", x, y, alt, t: 0, life: 0.45, r: 12 * size });
        for (let i = 0; i < n; i++) {
            const a = rand(0, TAU), s = rand(10, 60) * size;
            parts.push({ k: "fire", x: x + rand(-6, 6) * size, y: y + rand(-6, 6) * size, alt: alt + rand(0, 8), vx: Math.cos(a) * s, vy: Math.sin(a) * s, va: rand(5, 40), t: 0, life: rand(0.35, 0.7), r: rand(5, 11) * Math.sqrt(size) });
        }
        for (let i = 0; i < n * 0.6; i++) smoke(x + rand(-10, 10) * size, y + rand(-10, 10) * size, alt + rand(4, 14));
        spark(x, y, n, "#ffe090", alt);
        if (m) {
            const src = m.surf;
            for (let i = 0; i < n * 2.2; i++) {
                const v = src[Math.floor(Math.random() * src.length)];
                const a = rand(0, TAU), s = rand(40, 160) * Math.sqrt(size);
                parts.push({ k: "cube", x, y, alt: alt + rand(2, 10), vx: Math.cos(a) * s, vy: Math.sin(a) * s, va: rand(60, 200), t: 0, life: rand(0.9, 1.6), c: `rgb(${v.c[0]},${v.c[1]},${v.c[2]})`, s: rand(1.5, 3.2), rot: rand(0, TAU) });
            }
        }
        ctx.shake = Math.max(ctx.shake, size * 2.2);
    }
    function updateParts(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
            const q = parts[i];
            q.t += dt;
            if (q.t >= q.life) { parts.splice(i, 1); continue; }
            if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * (q.k === "cube" ? 0.6 : 3); q.vy *= 1 - dt * (q.k === "cube" ? 0.6 : 3); }
            if (q.va !== undefined) {
                q.alt += q.va * dt;
                if (q.k === "cube") { q.va -= 420 * dt; q.rot += dt * 9; if (q.alt < 0) { q.alt = 0; q.va *= -0.35; q.vx *= 0.6; q.vy *= 0.6; } }
            }
            if (q.k === "text") q.alt += dt * 30;
        }
        decals.forEach((d) => { d.t += dt; });
        if (decals.length > 60) decals.shift();
    }
    const timers = [];
    const setTimeoutGame = (fn, t) => timers.push({ fn, t });

    // ---------- ステージの進行 ----------
    function updateStage(dt) {
        st.t += dt;
        const def = st.def;
        if (st.bossPhase === "none") {
            st.spawnT -= dt;
            const airAlive = enemies.filter((e) => e.air || e.type === "walker").length;
            if (st.spawnT <= 0 && airAlive < 5 + run.stage) { st.spawnT = rand(1.3, 2.4); spawnAirWave(); }
            if (st.kills >= def.quota) {
                st.bossPhase = "warning"; st.bossT = 3;
                audio.stopMusic();
                sfx("warning");
                ctx.hint = null;
            }
        } else if (st.bossPhase === "warning") {
            st.bossT -= dt;
            if (st.bossT <= 0) {
                st.bossPhase = "fight";
                spawnBoss();
                audio.playMusic("boss");
                ctx.hint = { text: loc(def.boss.hint), t: 0, dur: 6 };
            }
        }
    }
    function stageResult(idx) {
        const def = stages[idx];
        const P = data.prompts;
        const bonus = (run.hearts[idx] || 0) >= 5 && !!def.private_prompt;
        const w = run.finish[idx] || "gun";
        const worn = (run.finishHp ?? 1) <= 0.3 ? P.worn : P.victory;
        const rewards = bonus
            ? buildRewards(def.private_prompt, "", P.character_private)
            : buildRewards([worn, P.finish?.[w]].filter(Boolean).join(", "), def.boss_bg || def.bg, P.character);
        return {
            gameId: GAME_ID, kind: "stage", cleared: true, score: run.score, bonus,
            items: run.hearts[idx] || 0, itemsTotal: 5, stage: idx + 1, stagesTotal: stages.length, stageName: cardName(def),
            negative: [P.negative, bonus ? P.private_negative : ""].filter(Boolean).join(", "), rewards,
        };
    }
    function buildRewards(scene, place, character) {
        const out = [];
        const add = (text, source) => { if (text) out.push({ type: "prompt", text, weight: 1, source }); };
        add(data.prompts.style, "style");
        add(character, "character");
        add(scene, "scene");
        add(place, "clear");
        return out;
    }
    function stageClear() {
        ctx.state = "clear";
        audio.playMusic("clear");
        const idx = run.stage;
        const res = stageResult(idx);
        if (!run.cleared.includes(idx)) {
            run.cleared.push(idx);
            try { host.stageClear?.(res); } catch (e) { console.error("[variant] host.stageClear failed", e); }
        }
        ctx.banner = { text: tr("clear"), sub: res.bonus ? tr("privateShot") : tr("victoryShot"), t: 0, dur: 3.6 };
        setTimeoutGame(() => {
            const next = () => { if (idx + 1 < stages.length) startStage(idx + 1); else endingSequence(); };
            const lines = stages[idx].clear || [];
            if (lines.length) say(lines, next); else next();
        }, 3.8);
    }
    function endingSequence() {
        ctx.state = "ending";
        ctx.endT = 0;
        audio.playMusic("ending");
        say(data.ending || [], () => {
            ctx.state = "theEnd";
            ctx.endT = 0;
            if (ctx.finished) return;
            ctx.finished = true;
            const P = data.prompts;
            const last = stages[stages.length - 1];
            const total = Object.values(run.hearts).reduce((a, b) => a + b, 0);
            try {
                host.finish?.({
                    gameId: GAME_ID, kind: "ending", cleared: true, score: run.score, bonus: false,
                    stage: stages.length, stagesTotal: stages.length, stageName: "ALL CLEAR", items: total, itemsTotal: stages.length * 5,
                    negative: P.negative, rewards: buildRewards(P.ending, "", P.character),
                });
            } catch (e) { console.error("[variant] host.finish failed", e); }
            void last;
        });
    }
    function gameOver() {
        ctx.state = "over";
        ctx.menu = { sel: 0, options: [tr("cont", run.stage + 1), tr("giveUp")] };
        audio.playMusic("over");
    }
    function giveUp() {
        ctx.state = "finished";
        ctx.menu = null;
        if (ctx.finished) return;
        ctx.finished = true;
        const P = data.prompts;
        const def = stages[run.stage];
        try {
            host.finish?.({
                gameId: GAME_ID, kind: "gameover", cleared: false, score: run.score, bonus: false,
                stage: run.stage + 1, stagesTotal: stages.length, stageName: cardName(def),
                negative: [P.negative, P.gameover_negative].filter(Boolean).join(", "),
                rewards: buildRewards(P.gameover, def.bg, P.character),
            });
        } catch (e) { console.error("[variant] host.finish failed", e); }
    }
    function continueStage() {
        ctx.menu = null;
        run.score = run.stageScore;
        run.lives = DIFF.lives;
        startStage(run.stage, { skipStory: true });
    }

    // ---------- 更新 ----------
    function update(dt) {
        ctx.t += dt;
        const pad = pollPad();
        let ix = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
        let iy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
        if (pad.x || pad.y) { ix = pad.x; iy = pad.y; }
        const len = Math.hypot(ix, iy);
        if (len > 1) { ix /= len; iy /= len; }

        if (ctx.state === "title") {
            if (tapped("ok") || tapped("fire")) { sfx("start"); startGame(); }
            return;
        }
        if (ctx.state === "theEnd" || ctx.state === "finished") {
            ctx.endT = (ctx.endT || 0) + dt;
            if (ctx.endT > 1 && tapped("ok")) restart();
            return;
        }
        if (ctx.state === "over") {
            const m = ctx.menu;
            if (tapped("up") || tapped("down")) { m.sel = 1 - m.sel; sfx("cursor"); }
            if (tapped("ok")) { sfx("cursor"); if (m.sel === 0) continueStage(); else giveUp(); }
            return;
        }
        if (tapped("pause") && !ctx.story) { ctx.paused = !ctx.paused; audio.setPaused(ctx.paused); sfx("cursor"); }
        if (ctx.paused) {
            if (tapped("quit")) { ctx.paused = false; audio.setPaused(false); run.lives = 0; gameOver(); }
            return;
        }
        if (ctx.story) { updateStory(dt); updateParts(dt); return; }
        // タイマー
        for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
        if (ctx.banner) { ctx.banner.t += dt; if (ctx.banner.t > ctx.banner.dur) ctx.banner = null; }
        if (ctx.hint) { ctx.hint.t += dt; if (ctx.hint.t > ctx.hint.dur) ctx.hint = null; }
        if (ctx.state === "play" || ctx.state === "clear" || ctx.state === "ending") {
            if (ctx.state === "play") updateStage(dt);
            updatePlayer(dt, { x: ctx.state === "play" ? ix : 0, y: ctx.state === "play" ? iy : 0 });
            updateSaber(dt);
            enemies.slice().forEach((e) => updateEnemy(e, dt));
            if (boss) updateBoss(dt);
            updatePlayerBullets(dt);
            updateEnemyBullets(dt);
            updatePickups(dt);
            updateParts(dt);
        }
        // カメラ(進行方向を少し先まで見せる)
        const lead = p.mode === "fighter" ? 0.45 : 0.2;
        const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
        cam.x += (tx - cam.x) * Math.min(1, dt * 4);
        cam.y += (ty - cam.y) * Math.min(1, dt * 4);
        ctx.shake = Math.max(0, ctx.shake - dt * 18);
        ctx.flash = Math.max(0, ctx.flash - dt * 1.4);
    }

    // ---------- 描画 ----------
    let shx = 0, shy = 0;
    const sx = (x) => x - cam.x + W / 2 + shx;
    const sy = (y) => (y - cam.y) * SQ + CY + shy;
    const onScreen = (x, y, r = 60) => { const X = sx(x), Y = sy(y); return X > -r && X < W + r && Y > -r - 40 && Y < H + r; };
    const font = (size) => `${size}px "${FONT_NAME}", monospace`;
    function text(str, x, y, size = 16, color = COL.white, align = "left", outline = true) {
        g.font = font(size);
        g.textAlign = align;
        g.textBaseline = "top";
        if (outline) { g.lineWidth = 3; g.strokeStyle = "rgba(0,0,10,0.85)"; g.strokeText(str, x, y); }
        g.fillStyle = color;
        g.fillText(str, x, y);
    }
    function base() { g.setTransform(2, 0, 0, 2, 0, 0); }
    /** 地面(タイル)を世界座標で描くための変形 */
    function groundT() { g.setTransform(2, 0, 0, 2 * SQ, 2 * (W / 2 - cam.x + shx), 2 * (CY - cam.y * SQ + shy)); }

    function drawGround(theme) {
        const tile = tileOf(theme);
        groundT();
        const x0 = Math.floor((cam.x - W / 2 - 20) / TILE), x1 = Math.floor((cam.x + W / 2 + 20) / TILE);
        const y0 = Math.floor((cam.y - (CY + 60) / SQ) / TILE), y1 = Math.floor((cam.y + (H - CY + 60) / SQ) / TILE);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) g.drawImage(tile, tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
        // 作戦区域の外は暗く
        g.fillStyle = "rgba(0,0,0,0.45)";
        const L = cam.x - 800, R = cam.x + 800, T = cam.y - 900, B = cam.y + 900;
        if (L < 0) g.fillRect(L, T, -L, B - T);
        if (R > WORLD) g.fillRect(WORLD, T, R - WORLD, B - T);
        if (T < 0) g.fillRect(L, T, R - L, -T);
        if (B > WORLD) g.fillRect(L, WORLD, R - L, B - WORLD);
        g.strokeStyle = "rgba(255,80,80,0.5)"; g.lineWidth = 2; g.setLineDash([12, 10]);
        g.strokeRect(0, 0, WORLD, WORLD);
        g.setLineDash([]);
        // 海のきらめき・街のネオンの映り込み
        if (theme === "ocean") {
            g.fillStyle = "rgba(220,240,255,0.7)";
            const cx0 = Math.floor((cam.x - 340) / 40), cy0 = Math.floor((cam.y - 300) / 40);
            for (let j = cy0; j < cy0 + 17; j++) for (let i = cx0; i < cx0 + 18; i++) {
                const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
                const ph = (ctx.t * 1.3 + (h % 100) / 16) % 4;
                if (ph < 0.5) { const s = Math.sin(ph * Math.PI * 2) * 3; g.fillRect(i * 40 + (h % 37), j * 40 + ((h >> 8) % 37), s + 1, 1); }
            }
        } else if (theme === "city") {
            g.globalCompositeOperation = "lighter";
            const cx0 = Math.floor((cam.x - 360) / TILE), cy0 = Math.floor((cam.y - 340) / TILE);
            for (let j = cy0; j < cy0 + 4; j++) for (let i = cx0; i < cx0 + 4; i++) {
                const h = ((i * 92837111) ^ (j * 689287499)) >>> 0;
                const x = i * TILE + TILE - 20, y = j * TILE + (h % TILE);
                const col = ["255,80,200", "80,220,255", "255,200,80"][h % 3];
                const gr = g.createRadialGradient(x, y, 0, x, y, 40);
                gr.addColorStop(0, `rgba(${col},${0.22 + 0.06 * Math.sin(ctx.t * 3 + h)})`); gr.addColorStop(1, `rgba(${col},0)`);
                g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80);
            }
            g.globalCompositeOperation = "source-over";
        }
        // 焦げ跡
        decals.forEach((d) => {
            const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
            gr.addColorStop(0, `rgba(10,8,6,${0.5 * Math.max(0, 1 - d.t / 30)})`); gr.addColorStop(1, "rgba(10,8,6,0)");
            g.fillStyle = gr; g.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
        });
        // 雲の影
        cloudList.forEach((c) => {
            const img = clouds[c.k];
            const w = 260 * c.s * 0.5, h = 160 * c.s * 0.5;
            const x = c.x + 30, y = c.y + 50;
            if (Math.abs(x - cam.x) > 600 || Math.abs(y - cam.y) > 700) return;
            g.globalAlpha = 0.13;
            g.filter = "brightness(0)";
            g.drawImage(img, x - w, y - h, w * 2, h * 2);
            g.filter = "none";
            g.globalAlpha = 1;
        });
        base();
    }
    /** スプライトを縮小・暗くして描く(奥の層・手前の層用) */
    function drawScaled(m, X, Y, a, sc, bright = 1, alpha = 1) {
        const sp = sprite(m, a, 0);
        const w = (sp.c.width / DPR) * sc, h = (sp.c.height / DPR) * sc;
        if (X + w < -10 || X - w > W + 10 || Y + h < -10 || Y - h > H + 40) return;
        if (bright < 0.99) g.filter = `brightness(${bright.toFixed(2)})`;
        g.globalAlpha = alpha;
        g.imageSmoothingEnabled = sc < 0.95; // 縮小は補間しないとドットが抜けてまだらになる
        g.drawImage(sp.c, X - (sp.ox / DPR) * sc, Y - (sp.oy / DPR) * sc, w, h);
        g.imageSmoothingEnabled = false;
        g.globalAlpha = 1;
        g.filter = "none";
    }
    const layerX = (x, k) => W / 2 + shx + (x - cam.x) * k;
    const layerY = (y, k) => CY + shy + (y - cam.y) * SQ * k;
    function drawSpaceBack() {
        base();
        g.fillStyle = "#02030a"; g.fillRect(0, 0, W, H);
        // 星雲(いちばん奥)
        nebulaImg ||= makeNebula();
        const NS = 640, nk = 0.02;
        const nox = ((-cam.x * nk) % NS + NS) % NS - NS, noy = ((-cam.y * nk * SQ) % NS + NS) % NS - NS;
        g.imageSmoothingEnabled = true;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) g.drawImage(nebulaImg, nox + i * NS, noy + j * NS, NS, NS);
        // 星(4段の視差。奥ほど暗く細かく、手前ほど明るく速い)
        [[0.03, 1, "120,130,170", 110], [0.08, 1, "170,180,220", 80], [0.16, 1, "220,228,255", 50], [0.3, 2, "255,255,255", 26]].forEach(([k, sz, c, n], li) => {
            for (let i = 0; i < n; i++) {
                const h = (i * 2654435761 + li * 7919) >>> 0;
                const x = (((h % 1300) - cam.x * k) % W + W) % W, y = ((((h >> 11) % 900) - cam.y * k * SQ) % H + H) % H;
                const tw = 0.55 + 0.45 * Math.sin(ctx.t * (1 + (h % 7) * 0.4) + h);
                g.fillStyle = `rgba(${c},${tw})`;
                g.fillRect(x, y, sz, sz);
            }
        });
        // 惑星(ゆっくり自転。3秒ごとに描き直す)
        if (!planetImg || ctx.t - planetT > 3) { planetImg = makePlanet(200, ctx.t * 0.004); planetT = ctx.t; }
        const PR = 150, ex = 480 - cam.x * 0.02, ey = 150 - cam.y * 0.014;
        g.globalCompositeOperation = "lighter";
        const halo = g.createRadialGradient(ex - 8, ey - 6, PR * 0.9, ex, ey, PR * 1.22);
        halo.addColorStop(0, "rgba(90,170,255,0.55)"); halo.addColorStop(0.35, "rgba(70,140,255,0.22)"); halo.addColorStop(1, "rgba(60,120,255,0)");
        g.fillStyle = halo; g.fillRect(ex - PR * 1.3, ey - PR * 1.3, PR * 2.6, PR * 2.6);
        g.globalCompositeOperation = "source-over";
        g.drawImage(planetImg, ex - PR, ey - PR, PR * 2, PR * 2);
        // 大気の縁(昼側だけ明るい)
        const rim = g.createRadialGradient(ex, ey, PR * 0.86, ex, ey, PR * 1.01);
        rim.addColorStop(0, "rgba(120,190,255,0)"); rim.addColorStop(1, "rgba(150,210,255,0.45)");
        g.save(); g.beginPath(); g.arc(ex, ey, PR * 1.01, 0, TAU); g.clip();
        g.fillStyle = rim; g.fillRect(ex - PR, ey - PR, PR * 2, PR * 2);
        const night = g.createLinearGradient(ex - PR * 0.6, ey - PR * 0.5, ex + PR, ey + PR * 0.8);
        night.addColorStop(0, "rgba(0,0,10,0)"); night.addColorStop(0.55, "rgba(0,0,10,0)"); night.addColorStop(1, "rgba(0,0,10,0.55)");
        g.fillStyle = night; g.fillRect(ex - PR, ey - PR, PR * 2, PR * 2);
        g.restore();
        // 衛星(月)。惑星より手前なので少し速く動く
        moonImg ||= makeMoon(48);
        const MR = 30, mx = 130 - cam.x * 0.05 + Math.cos(ctx.t * 0.02) * 30, my = 300 - cam.y * 0.04 + Math.sin(ctx.t * 0.02) * 10;
        g.globalCompositeOperation = "lighter";
        const mh = g.createRadialGradient(mx, my, MR * 0.9, mx, my, MR * 1.25);
        mh.addColorStop(0, "rgba(200,200,220,0.18)"); mh.addColorStop(1, "rgba(200,200,220,0)");
        g.fillStyle = mh; g.fillRect(mx - MR * 1.3, my - MR * 1.3, MR * 2.6, MR * 2.6);
        g.globalCompositeOperation = "source-over";
        g.drawImage(moonImg, mx - MR, my - MR, MR * 2, MR * 2);
        g.imageSmoothingEnabled = false;
        // 遠くの宇宙ステーション(ゆっくり回る、窓が光る)
        drawScaled(model("station"), layerX(1500, 0.18), layerY(1200, 0.18), ctx.t * 0.05, 0.9, 0.6, 0.95);
        // 奥の層の岩(小さく暗い。視差で作戦面より遅く流れる)
        farObjs.forEach((o) => drawScaled(o.m, layerX(o.x, o.k), layerY(o.y, o.k), o.a + ctx.t * o.spin, o.s, o.b));
        // 奥と作戦面のあいだにうっすら霞
        g.fillStyle = "rgba(10,14,40,0.18)"; g.fillRect(0, 0, W, H);
    }
    /** 奥から近づいてくる敵(小さく暗い → 大きく明るい)と、到着地点の照準 */
    function drawApproaching() {
        enemies.forEach((e) => {
            if (!approaching(e)) return;
            const u = e.app, ea = u * u * (3 - 2 * u);
            const k = 0.25 + 0.75 * ea, sc = 0.18 + 0.82 * ea;
            const X = layerX(e.x, k), Y = layerY(e.y, k) - e.alt * SQ * sc;
            // エンジンの光(奥では点に見える)
            g.globalCompositeOperation = "lighter";
            const gr = g.createRadialGradient(X, Y - 4 * sc, 0, X, Y - 4 * sc, 4 + 10 * sc);
            gr.addColorStop(0, `rgba(255,170,90,${0.5 + 0.4 * (1 - ea)})`); gr.addColorStop(1, "rgba(255,120,60,0)");
            g.fillStyle = gr; g.fillRect(X - 14, Y - 18, 28, 28);
            g.globalCompositeOperation = "source-over";
            drawScaled(e.m, X, Y, e.ang, sc, 0.25 + 0.75 * ea, 0.3 + 0.7 * ea);
            // 到着地点(作戦面)の照準: だんだん小さく濃くなる
            const TX = sx(e.x), TY = sy(e.y) - e.alt * SQ;
            const rr = 8 + (1 - ea) * 26;
            g.strokeStyle = `rgba(255,90,90,${0.25 + 0.6 * ea})`; g.lineWidth = 1.5;
            g.setLineDash([4, 4]); g.lineDashOffset = -ctx.t * 20;
            g.beginPath(); g.ellipse(TX, TY, rr, rr * SQ, 0, 0, TAU); g.stroke();
            g.setLineDash([]);
        });
    }
    /** 手前の層: 大きな暗い岩のシルエットが速く横切る */
    function drawForeground() {
        nearObjs.forEach((o) => drawScaled(o.m, layerX(o.x, o.k), layerY(o.y, o.k), o.a + ctx.t * o.spin, o.s, 0.18, 0.72));
    }
    function drawWorld() {
        const theme = st.theme;
        if (theme === "space") drawSpaceBack(); else { base(); g.fillStyle = "#000"; g.fillRect(0, 0, W, H); }
        if (theme !== "space") drawGround(theme);
        else { groundT(); g.strokeStyle = "rgba(255,80,80,0.4)"; g.lineWidth = 2; g.setLineDash([12, 10]); g.strokeRect(0, 0, WORLD, WORLD); g.setLineDash([]); base(); }
        if (theme === "space") drawApproaching();
        const list = [];
        props.forEach((q) => {
            if (!onScreen(q.x, q.y, q.m.r * q.m.px + 40)) return;
            const a = q.a + (q.spin ? ctx.t * q.spin : 0), alt = q.ph !== undefined ? 6 + Math.sin(ctx.t * 0.7 + q.ph) * 5 : 0;
            list.push({ y: q.y, f: () => draw(g, q.m, sx(q.x), sy(q.y), a, { shadowAlpha: 0.25, alt }) });
        });
        pickups.forEach((q) => {
            if (!onScreen(q.x, q.y)) return;
            if (q.t > 11 && Math.floor(q.t * 8) % 2) return;
            list.push({ y: q.y, f: () => draw(g, model(q.kind), sx(q.x), sy(q.y), ctx.t * 2, { alt: 4 + Math.sin(q.t * 4) * 2 }) });
        });
        const airList = [];
        enemies.forEach((e) => {
            if (!onScreen(e.x, e.y) || approaching(e)) return;
            const f = () => drawEnemy(e);
            (e.air ? airList : list).push({ y: e.y, f });
        });
        hearts.forEach((h) => {
            if (h.got || !onScreen(h.x, h.y)) return;
            airList.push({ y: h.y, f: () => {
                const X = sx(h.x), Y = sy(h.y) - 10 - Math.sin(h.t * 2) * 3;
                g.globalCompositeOperation = "lighter";
                const gr = g.createRadialGradient(X, Y - 10, 0, X, Y - 10, 26);
                gr.addColorStop(0, "rgba(255,120,190,0.55)"); gr.addColorStop(1, "rgba(255,120,190,0)");
                g.fillStyle = gr; g.fillRect(X - 26, Y - 36, 52, 52);
                g.globalCompositeOperation = "source-over";
                draw(g, model("heart"), X, Y + 10, h.t * 1.6, { alt: 10, shadowAlpha: 0.2 });
            } });
        });
        if (boss) (boss.type === "rival" ? airList : list).push({ y: boss.y, f: drawBoss });
        if (p && p.dead <= 0) {
            const air = p.mode === "fighter" || p.morph;
            (air ? airList : list).push({ y: p.y, f: drawPlayer });
        }
        list.sort((a, b) => a.y - b.y).forEach((o) => o.f());
        airList.sort((a, b) => a.y - b.y).forEach((o) => o.f());
        drawBullets();
        drawParts();
        drawLocks();
        drawSaber();
        // 雲(上を流れる)
        cloudList.forEach((c) => {
            const img = clouds[c.k];
            const w = 260 * c.s * 0.5, h = 160 * c.s * 0.5;
            const X = sx(c.x) - (cam.x - c.x) * 0.25, Y = sy(c.y) - 60 - (cam.y - c.y) * 0.2 * SQ;
            if (X < -w * 2 || X > W + w * 2 || Y < -h * 2 || Y > H + h * 2) return;
            g.globalAlpha = 0.55;
            g.drawImage(img, X - w, Y - h, w * 2, h * 2);
            g.globalAlpha = 1;
        });
        drawWeather(theme);
        if (theme === "space") drawForeground();
    }
    function drawWeather(theme) {
        if (theme === "snow") {
            g.fillStyle = "rgba(255,255,255,0.85)";
            for (let i = 0; i < 90; i++) {
                const h = (i * 2654435761) >>> 0;
                const x = ((h % 700) + Math.sin(ctx.t + i) * 20 - cam.x * 0.3 + 7000) % 680 - 20;
                const y = (((h >> 10) % 460) + ctx.t * (30 + (h % 40)) - cam.y * 0.3 * SQ + 7000) % 440 - 20;
                g.fillRect(x, y, h % 3 === 0 ? 2 : 1, h % 3 === 0 ? 2 : 1);
            }
        } else if (theme === "city") {
            g.strokeStyle = "rgba(160,190,255,0.25)"; g.lineWidth = 1;
            g.beginPath();
            for (let i = 0; i < 70; i++) {
                const h = (i * 2654435761) >>> 0;
                const x = ((h % 700) - cam.x * 0.5 + ctx.t * 60 + 7000) % 680 - 20;
                const y = (((h >> 10) % 460) + ctx.t * 520 - cam.y * 0.5 * SQ + 7000) % 440 - 20;
                g.moveTo(x, y); g.lineTo(x - 3, y + 12);
            }
            g.stroke();
        } else if (theme === "space") {
            // 2段の塵(作戦面より手前を速く流れる)
            [[1.2, "rgba(170,190,255,0.35)", 40, 1], [1.45, "rgba(200,215,255,0.5)", 22, 2]].forEach(([k, c, n, sz]) => {
                g.fillStyle = c;
                for (let i = 0; i < n; i++) {
                    const h = (i * 2654435761 + k * 1000) >>> 0;
                    const x = (((h % 900) + ctx.t * 6 - cam.x * k) % 680 + 680) % 680 - 20;
                    const y = (((((h >> 10) % 700) + ctx.t * 3 - cam.y * k * SQ)) % 440 + 440) % 440 - 20;
                    g.fillRect(x, y, sz, sz);
                }
            });
        } else if (theme === "desert") {
            g.fillStyle = "rgba(240,210,150,0.4)";
            for (let i = 0; i < 40; i++) {
                const h = (i * 2654435761) >>> 0;
                const x = ((h % 700) + ctx.t * (90 + (h % 60)) - cam.x * 0.4 + 7000) % 680 - 20;
                const y = (((h >> 10) % 460) + Math.sin(ctx.t * 2 + i) * 8 - cam.y * 0.4 * SQ + 7000) % 440 - 20;
                g.fillRect(x, y, 2, 1);
            }
        }
    }
    function drawEnemy(e) {
        const X = sx(e.x), Y = sy(e.y);
        const alpha = e.fade > 0 ? 1 - e.fade : 1;
        if (e.fade > 0) {
            // 降下してくる(上から光の柱)
            g.globalCompositeOperation = "lighter";
            g.fillStyle = `rgba(255,80,120,${e.fade * 0.5})`;
            g.fillRect(X - 6, Y - 200, 12, 200);
            g.globalCompositeOperation = "source-over";
        }
        const fl = e.flash > 0;
        const alt = e.alt + (e.air ? Math.sin(e.t * 3) * 1.5 : 0) + (e.fade > 0 ? e.fade * 80 : 0);
        draw(g, e.m, X, Y, e.ang, { alt, flash: fl, alpha });
        if (e.type === "turret") draw(g, model("turretTop"), X, Y, e.top, { shadow: false, flash: fl });
        if (e.type === "tank") draw(g, model("tankTop"), X, Y, e.top, { shadow: false, flash: fl });
        if (e.hp < e.maxHp && !e.air) hpBar(X, Y + 8, e.hp / e.maxHp, 22);
    }
    function hpBar(x, y, k, w) {
        g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
        g.fillStyle = k > 0.5 ? "#58f858" : k > 0.25 ? "#f8d848" : "#f85858"; g.fillRect(x - w / 2, y, w * k, 2);
    }
    const hullAlt = (m, z) => (z * LH * m.px) / SQ;
    function drawBoss() {
        const b = boss;
        const X = sx(b.x), Y = sy(b.y);
        const fl = b.flash > 0;
        if (b.type === "rival") {
            const alt = b.alt;
            if (b.morph) {
                const t = b.morph.to === "robot" ? b.morph.t : 1 - b.morph.t;
                drawMorph(g, RIVAL_PAIRS, X, Y, b.ang, t, { px: 1.8, alt });
            } else {
                const m = model(b.mode === "fighter" ? "rivalF" : "rivalR");
                draw(g, m, X, Y, b.ang, { alt, bank: b.bank, flash: fl });
            }
            if (b.slash && !b.slash.go && Math.floor(b.slash.t * 16) % 2) {
                g.strokeStyle = "rgba(255,60,90,0.9)"; g.lineWidth = 2;
                g.beginPath(); g.arc(X, Y - 20, 26, 0, TAU); g.stroke();
            }
            if (b.slash?.go && b.slash.t < 0.75) drawBlade(X, Y - alt * SQ - 16, b.slash.a + Math.sin(b.slash.t * 20) * 1.2, "255,60,90", 36);
            return;
        }
        if (b.type === "crawler") {
            const s = b.m.px;
            [-1, 1].forEach((side) => [-8, 0, 8].forEach((lx, i) => {
                const sw = Math.sin(b.t * (b.dash > 0 ? 18 : 6) + i * 2 + (side > 0 ? 1 : 0)) * 0.35;
                const w = bossLocal(lx * s, side * 7 * s);
                draw(g, model("crawlerLeg"), sx(w.x), sy(w.y), b.ang + side * (Math.PI / 2 + sw - (i - 1) * 0.35), { shadowAlpha: 0.25 });
            }));
            if (b.warn > 0 && Math.floor(b.warn * 12) % 2) {
                const ex = b.x + Math.cos(b.ang) * 300, ey = b.y + Math.sin(b.ang) * 300;
                g.strokeStyle = "rgba(255,60,60,0.7)"; g.lineWidth = 16;
                g.beginPath(); g.moveTo(X, Y); g.lineTo(sx(ex), sy(ey)); g.stroke();
            }
        }
        draw(g, b.m, X, Y, b.ang, { flash: fl, shadowAlpha: 0.35, alt: b.type === "fortress" ? 6 + Math.sin(b.t) * 2 : 0 });
        b.parts.forEach((q) => {
            const w = bossLocal(q.lx, q.ly);
            const tm = model(q.big ? "bigTurretTop" : "turretTop");
            const altBase = hullAlt(b.m, q.lz) + (b.type === "fortress" ? 6 + Math.sin(b.t) * 2 : 0) - hullAlt(tm, 4);
            if (q.alive) draw(g, tm, sx(w.x), sy(w.y), q.top, { alt: altBase, shadow: false, flash: q.flash > 0 });
            if (q.flash > 0) q.flash -= 1 / 60;
        });
        // 弱点の光
        const c = bossLocal(b.core.lx, b.core.ly);
        const armored = b.core.armored && liveTurrets() > 0;
        const pulse = 0.4 + 0.3 * Math.sin(b.t * 6);
        g.globalCompositeOperation = "lighter";
        const cX = sx(c.x), cY = sy(c.y) - (b.type === "crawler" ? 34 : b.type === "fortress" ? 26 : 16);
        const gr = g.createRadialGradient(cX, cY, 0, cX, cY, b.core.r);
        gr.addColorStop(0, armored ? `rgba(120,140,255,${pulse * 0.5})` : `rgba(255,70,90,${pulse})`); gr.addColorStop(1, "rgba(255,70,90,0)");
        g.fillStyle = gr; g.fillRect(cX - b.core.r, cY - b.core.r, b.core.r * 2, b.core.r * 2);
        g.globalCompositeOperation = "source-over";
        // 極太ビーム
        if (b.beam) beamMuzzles(b).forEach(([nose, ang]) => {
            const nx = sx(nose.x), ny = sy(nose.y) - 8;
            const ex = nx + Math.cos(ang) * 1100, ey = ny + Math.sin(ang) * 1100 * SQ;
            g.globalCompositeOperation = "lighter";
            if (b.beam.t < 1.5) {
                g.strokeStyle = `rgba(255,60,80,${Math.floor(b.beam.t * 14) % 2 ? 0.8 : 0.3})`; g.lineWidth = 1 + b.beam.t * 2;
                g.beginPath(); g.moveTo(nx, ny); g.lineTo(ex, ey); g.stroke();
                const r = 6 + b.beam.t * 10;
                const cg = g.createRadialGradient(nx, ny, 0, nx, ny, r);
                cg.addColorStop(0, "rgba(255,230,240,0.9)"); cg.addColorStop(1, "rgba(255,60,90,0)");
                g.fillStyle = cg; g.fillRect(nx - r, ny - r, r * 2, r * 2);
            } else {
                const k = Math.min(1, (2.9 - b.beam.t) * 3);
                [[46, 0.25], [30, 0.5], [14, 0.9]].forEach(([w, a]) => {
                    g.strokeStyle = `rgba(255,${w < 20 ? 240 : 80},${w < 20 ? 250 : 120},${a * k})`; g.lineWidth = w * (0.85 + 0.15 * Math.sin(ctx.t * 40));
                    g.beginPath(); g.moveTo(nx, ny); g.lineTo(ex, ey); g.stroke();
                });
            }
            g.globalCompositeOperation = "source-over";
        });
    }
    function drawPlayer() {
        const X = sx(p.x), Y = sy(p.y);
        if (p.inv > 0 && p.hitT <= 0 && !p.morph && Math.floor(p.inv * 16) % 2) return;
        if (p.morph) {
            const t = p.morph.to === "robot" ? p.morph.t : 1 - p.morph.t;
            // 変形中の光
            g.globalCompositeOperation = "lighter";
            const r = 40 * Math.sin(Math.PI * p.morph.t);
            const gr = g.createRadialGradient(X, Y - p.alt * SQ - 14, 0, X, Y - p.alt * SQ - 14, r + 1);
            gr.addColorStop(0, "rgba(140,250,255,0.35)"); gr.addColorStop(1, "rgba(140,250,255,0)");
            g.fillStyle = gr; g.fillRect(X - r, Y - p.alt * SQ - 14 - r, r * 2, r * 2);
            g.globalCompositeOperation = "source-over";
            drawMorph(g, PAIRS, X, Y, p.ang, t, { px: 1.5, alt: p.alt });
            return;
        }
        const m = model(p.mode);
        draw(g, m, X, Y, p.ang, { alt: p.alt, bank: p.bank, flash: p.hitT > 0 });
    }
    function drawBlade(X, Y, a, rgb, len) {
        g.globalCompositeOperation = "lighter";
        [[7, 0.25], [4, 0.5], [1.5, 1]].forEach(([w, al]) => {
            g.strokeStyle = w < 2 ? `rgba(255,255,255,${al})` : `rgba(${rgb},${al})`; g.lineWidth = w; g.lineCap = "round";
            g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len * SQ); g.stroke();
        });
        g.globalCompositeOperation = "source-over";
    }
    function drawSaber() {
        const s = p?.saber;
        if (!s || p.dead > 0) return;
        const X = sx(p.x), Y = sy(p.y) - p.alt * SQ - 16;
        const k = Math.min(1, s.t / s.dur);
        const span = s.spin ? TAU : 2.6;
        const a0 = s.dir - (span / 2) * s.side, a1 = a0 + span * s.side * k;
        const fade = s.t > s.dur ? 1 - (s.t - s.dur) / 0.18 : 1;
        // 軌跡
        g.globalCompositeOperation = "lighter";
        const steps = 18;
        for (let i = 0; i < steps; i++) {
            const t0 = i / steps, t1 = (i + 1) / steps;
            const aa = a0 + (a1 - a0) * t0, ab = a0 + (a1 - a0) * t1;
            const al = fade * (0.15 + 0.55 * t1);
            g.fillStyle = `rgba(255,110,200,${al})`;
            g.beginPath();
            g.moveTo(X + Math.cos(aa) * 14, Y + Math.sin(aa) * 14 * SQ);
            g.lineTo(X + Math.cos(aa) * s.R, Y + Math.sin(aa) * s.R * SQ);
            g.lineTo(X + Math.cos(ab) * s.R, Y + Math.sin(ab) * s.R * SQ);
            g.lineTo(X + Math.cos(ab) * 14, Y + Math.sin(ab) * 14 * SQ);
            g.fill();
        }
        g.globalCompositeOperation = "source-over";
        if (s.t <= s.dur) drawBlade(X, Y, a1, "255,90,200", s.R);
    }
    function drawLocks() {
        if (!p?.locks?.length) return;
        g.strokeStyle = "rgba(255,80,80,0.95)"; g.lineWidth = 1.5;
        p.locks.forEach((l, i) => {
            const X = sx(l.x), Y = sy(l.y) - 10;
            const r = 11 + Math.sin(ctx.t * 10 + i) * 1.5;
            const a = ctx.t * 3;
            for (let k = 0; k < 4; k++) {
                const b = a + (k * Math.PI) / 2;
                g.beginPath(); g.arc(X, Y, r, b, b + 0.7); g.stroke();
            }
            text(String(i + 1), X + r + 2, Y - r - 4, 8, COL.red);
        });
    }
    function drawBullets() {
        g.globalCompositeOperation = "lighter";
        pbul.forEach((b) => {
            const X = sx(b.x), Y = sy(b.y) - 12;
            if (b.k === "gun") {
                g.strokeStyle = "rgba(255,230,120,0.95)"; g.lineWidth = 2;
                g.beginPath(); g.moveTo(X, Y); g.lineTo(X - b.vx * 0.018, Y - b.vy * 0.018 * SQ); g.stroke();
            } else if (b.k === "beam") {
                const lx = b.vx * 0.03, ly = b.vy * 0.03 * SQ;
                [[6, "rgba(255,80,200,0.35)"], [3, "rgba(255,140,220,0.8)"], [1.2, "rgba(255,255,255,1)"]].forEach(([w, c]) => {
                    g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round";
                    g.beginPath(); g.moveTo(X, Y); g.lineTo(X - lx, Y - ly); g.stroke();
                });
            } else if (b.k === "missile") {
                g.fillStyle = "rgba(255,200,120,1)"; g.fillRect(X - 1.5, Y - 1.5, 3, 3);
                const gr = g.createRadialGradient(X, Y, 0, X, Y, 6);
                gr.addColorStop(0, "rgba(255,160,60,0.8)"); gr.addColorStop(1, "rgba(255,160,60,0)");
                g.fillStyle = gr; g.fillRect(X - 6, Y - 6, 12, 12);
            }
        });
        ebul.forEach((b) => {
            const X = sx(b.x), Y = sy(b.y) - 10;
            if (X < -20 || X > W + 20 || Y < -20 || Y > H + 20) return;
            const col = b.kind === "b" ? "255,120,40" : b.kind === "m" ? "200,90,255" : b.kind === "beam" ? "255,50,80" : b.kind === "missile" ? "255,160,120" : "255,70,70";
            if (b.kind === "s" || b.kind === "m") {
                // 小型の敵の弾: 見た目の縁 = 当たり判定(b.r)。外の光は薄くして大きく見せない
                const r = b.r * 0.85 + Math.sin(b.t * 20) * 0.3;
                const gr = g.createRadialGradient(X, Y, r * 0.8, X, Y, r * 1.7);
                gr.addColorStop(0, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`);
                g.fillStyle = gr; g.fillRect(X - r * 1.7, Y - r * 1.7, r * 3.4, r * 3.4);
                g.fillStyle = `rgb(${col})`; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
                g.fillStyle = "#fff"; g.beginPath(); g.arc(X, Y, r * 0.5, 0, TAU); g.fill();
                return;
            }
            const r = b.r + 3 + Math.sin(b.t * 20) * 1;
            const gr = g.createRadialGradient(X, Y, 0, X, Y, r * 1.8);
            gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, `rgba(${col},0.95)`); gr.addColorStop(1, `rgba(${col},0)`);
            g.fillStyle = gr; g.fillRect(X - r * 1.8, Y - r * 1.8, r * 3.6, r * 3.6);
            if (b.kind === "beam") {
                g.strokeStyle = `rgba(${col},0.7)`; g.lineWidth = 4;
                g.beginPath(); g.moveTo(X, Y); g.lineTo(X - b.vx * 0.05, Y - b.vy * 0.05 * SQ); g.stroke();
            }
        });
        g.globalCompositeOperation = "source-over";
    }
    function drawParts() {
        // 地面に落ちる物の影
        parts.forEach((q) => {
            if (q.k !== "cube") return;
            g.fillStyle = "rgba(0,0,0,0.25)";
            g.fillRect(sx(q.x) - q.s / 2, sy(q.y) - q.s / 4, q.s, q.s / 2);
        });
        parts.forEach((q) => {
            const X = sx(q.x), Y = sy(q.y) - q.alt * SQ;
            if (X < -40 || X > W + 40 || Y < -40 || Y > H + 40) return;
            const k = q.t / q.life;
            if (q.k === "cube") {
                g.save(); g.translate(X, Y); g.rotate(q.rot);
                g.fillStyle = q.c; g.fillRect(-q.s / 2, -q.s / 2, q.s, q.s);
                g.restore();
            } else if (q.k === "smoke" || q.k === "puff") {
                const r = (q.r || 3) * (1 + k * 1.5);
                g.globalAlpha = (q.k === "puff" ? 0.35 : 0.5) * (1 - k);
                g.fillStyle = q.color; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
                g.globalAlpha = 1;
            }
        });
        g.globalCompositeOperation = "lighter";
        parts.forEach((q) => {
            const X = sx(q.x), Y = sy(q.y) - q.alt * SQ;
            if (X < -60 || X > W + 60 || Y < -60 || Y > H + 60) return;
            const k = q.t / q.life;
            if (q.k === "fire") {
                const r = q.r * (0.6 + k);
                const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
                gr.addColorStop(0, `rgba(255,250,210,${1 - k})`); gr.addColorStop(0.4, `rgba(255,150,40,${0.9 * (1 - k)})`); gr.addColorStop(1, "rgba(200,40,10,0)");
                g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2);
            } else if (q.k === "spark") {
                g.fillStyle = q.color; g.globalAlpha = 1 - k;
                g.fillRect(X - 1, Y - 1, 2, 2);
                g.globalAlpha = 1;
            } else if (q.k === "glow") {
                const r = q.r * (1 - k * 0.5);
                g.globalAlpha = 0.8 * (1 - k);
                g.fillStyle = q.color; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
                g.globalAlpha = 1;
            } else if (q.k === "line") {
                g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; g.fillRect(X, Y, 1, 1);
            } else if (q.k === "ring") {
                g.strokeStyle = `rgba(255,220,160,${0.8 * (1 - k)})`; g.lineWidth = 2;
                g.beginPath(); g.ellipse(X, Y, q.r * (0.3 + k * 1.6), q.r * (0.3 + k * 1.6) * SQ, 0, 0, TAU); g.stroke();
            } else if (q.k === "cut") {
                g.strokeStyle = `rgba(255,200,240,${1 - k})`; g.lineWidth = 3 * (1 - k) + 1;
                const L = 24 + k * 10;
                g.beginPath(); g.moveTo(X - Math.cos(q.a) * L, Y - Math.sin(q.a) * L); g.lineTo(X + Math.cos(q.a) * L, Y + Math.sin(q.a) * L); g.stroke();
            }
        });
        g.globalCompositeOperation = "source-over";
        parts.forEach((q) => {
            if (q.k !== "text") return;
            const k = q.t / q.life;
            g.globalAlpha = 1 - k * k;
            text(q.text, sx(q.x), sy(q.y) - q.alt, 12, q.color, "center");
            g.globalAlpha = 1;
        });
    }

    // ---------- HUD ----------
    function frame(x, y, w, h) {
        g.fillStyle = "rgba(0,8,20,0.72)"; g.fillRect(x, y, w, h);
        g.strokeStyle = "rgba(90,230,240,0.7)"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    function drawHUD() {
        base();
        text(`${tr("score")} ${String(run.score).padStart(8, "0")}`, 10, 8, 14, COL.white);
        // 残機とハート
        text(tr("lives"), 10, 26, 10, COL.gray);
        for (let i = 0; i < Math.max(0, run.lives - 1); i++) { g.fillStyle = COL.teal; g.beginPath(); g.moveTo(44 + i * 12, 27); g.lineTo(50 + i * 12, 37); g.lineTo(38 + i * 12, 37); g.fill(); }
        // ハートは残機の下
        const hn = run.hearts[run.stage] || 0;
        text(tr("hearts"), 10, 42, 10, COL.gray);
        for (let i = 0; i < 5; i++) heartIcon(56 + i * 14, 43, i < hn);
        // 敵の残り / ボス
        if (st.bossPhase === "none") {
            const k = Math.min(1, st.kills / st.def.quota);
            text(`${tr("enemy")} ${st.kills}/${st.def.quota}`, W / 2, 6, 12, COL.white, "center");
            g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(W / 2 - 80, 22, 160, 4);
            g.fillStyle = COL.orange; g.fillRect(W / 2 - 80, 22, 160 * k, 4);
        } else if (boss && st.bossPhase === "fight") {
            text(loc(st.def.boss.name), W / 2, 6, 12, COL.red, "center");
            g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(W / 2 - 120, 22, 240, 6);
            g.fillStyle = "#f85858"; g.fillRect(W / 2 - 120, 22, 240 * (boss.hp / boss.maxHp), 6);
            g.strokeStyle = "#fff"; g.strokeRect(W / 2 - 120.5, 21.5, 241, 7);
            if (boss.parts.length) text(tr("bossLeft", liveTurrets()), W / 2, 31, 10, liveTurrets() ? COL.cyan : COL.gray, "center");
        }
        // 装甲と武器
        frame(8, H - 58, 196, 50);
        const fighter = p.morph ? p.morph.to === "fighter" : p.mode === "fighter";
        text(fighter ? tr("fighter") : tr("robot"), 14, H - 54, 14, p.morph ? COL.gray : COL.cyan);
        text(tr("transform"), 198, H - 52, 10, COL.gray, "right");
        text(tr("armor"), 14, H - 36, 10, COL.gray);
        const hk = Math.max(0, p.hp / p.maxHp);
        for (let i = 0; i < 20; i++) {
            g.fillStyle = i / 20 < hk ? (hk > 0.5 ? "#58e8a8" : hk > 0.25 ? "#f8d848" : "#f85858") : "rgba(255,255,255,0.12)";
            g.fillRect(56 + i * 7, H - 35, 5, 7);
        }
        if (fighter) {
            text(`Z ${tr("gun")}`, 14, H - 22, 10, COL.white);
            text(`X ${tr("missile")}`, 90, H - 22, 10, COL.white);
            for (let i = 0; i < 8; i++) { g.fillStyle = i < p.missiles ? COL.orange : "rgba(255,255,255,0.15)"; g.fillRect(150 + i * 6, H - 20, 4, 7); }
        } else {
            text(`Z ${tr("rifle")}`, 14, H - 22, 10, COL.white);
            text(`X ${tr("saber")}`, 110, H - 22, 10, COL.pink);
        }
        drawRadar();
        if (p.out > 0 && Math.floor(ctx.t * 3) % 2) text(tr("outOfArea"), W / 2, 60, 14, COL.red, "center");
        if (ctx.hint) {
            const a = Math.min(1, ctx.hint.t * 3, (ctx.hint.dur - ctx.hint.t) * 2);
            g.globalAlpha = a;
            frame(W / 2 - 200, 44, 400, 24);
            text(ctx.hint.text, W / 2, 50, 11, COL.yellow, "center", false);
            g.globalAlpha = 1;
        }
        if (st.bossPhase === "warning") {
            const a = 0.5 + 0.5 * Math.sin(ctx.t * 10);
            g.fillStyle = `rgba(255,30,40,${0.15 * a})`; g.fillRect(0, 0, W, H);
            g.fillStyle = `rgba(255,40,40,${0.8})`; g.fillRect(0, 150, W, 2); g.fillRect(0, 218, W, 2);
            text(tr("warning"), W / 2, 160, 40, `rgba(255,${80 + a * 100},80,1)`, "center");
            text(tr("approaching"), W / 2, 200, 12, COL.white, "center");
        }
    }
    function heartIcon(x, y, on) {
        g.fillStyle = on ? "#ff4f96" : "rgba(255,255,255,0.18)";
        g.beginPath();
        g.moveTo(x, y + 4);
        g.bezierCurveTo(x, y - 1, x - 6, y - 1, x - 6, y + 3);
        g.bezierCurveTo(x - 6, y + 6, x, y + 9, x, y + 11);
        g.bezierCurveTo(x, y + 9, x + 6, y + 6, x + 6, y + 3);
        g.bezierCurveTo(x + 6, y - 1, x, y - 1, x, y + 4);
        g.fill();
    }
    function drawRadar() {
        const cx = W - 54, cy = 54, R = 44, range = 760; // 右上
        g.fillStyle = "rgba(0,20,24,0.7)"; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
        g.strokeStyle = "rgba(90,230,240,0.6)"; g.lineWidth = 1;
        g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
        g.beginPath(); g.arc(cx, cy, R / 2, 0, TAU); g.stroke();
        // スイープ
        const sa = ctx.t * 2;
        g.fillStyle = "rgba(90,230,240,0.15)";
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sa, sa + 0.6); g.fill();
        const dot = (x, y, col, s = 2, clampEdge = false) => {
            let dx = (x - p.x) / range * R, dy = (y - p.y) / range * R;
            const d = Math.hypot(dx, dy);
            if (d > R - 2) { if (!clampEdge) return; dx *= (R - 3) / d; dy *= (R - 3) / d; }
            g.fillStyle = col; g.fillRect(cx + dx - s / 2, cy + dy - s / 2, s, s);
        };
        enemies.forEach((e) => dot(e.x, e.y, e.air ? "#ff5050" : "#ffa040"));
        pickups.forEach((q) => dot(q.x, q.y, "#58f858"));
        hearts.forEach((h) => { if (!h.got) dot(h.x, h.y, Math.floor(ctx.t * 4) % 2 ? "#ff78b8" : "#ffc0dc", 4, true); });
        if (boss) dot(boss.x, boss.y, Math.floor(ctx.t * 6) % 2 ? "#ff3030" : "#ffffff", 6, true);
        // 作戦区域の境界
        g.save();
        g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
        g.strokeStyle = "rgba(255,80,80,0.6)";
        g.strokeRect(cx + (0 - p.x) / range * R, cy + (0 - p.y) / range * R, WORLD / range * R, WORLD / range * R);
        g.restore();
        g.fillStyle = "#fff";
        g.save(); g.translate(cx, cy); g.rotate(p.ang + Math.PI / 2);
        g.beginPath(); g.moveTo(0, -4); g.lineTo(3, 3); g.lineTo(-3, 3); g.fill();
        g.restore();
    }
    function drawStory() {
        const s = ctx.story;
        if (!s) return;
        const line = s.lines[s.idx];
        const full = loc(line.text);
        const shown = full.slice(0, Math.floor(s.chars));
        const top = H - 112;
        frame(12, top, W - 24, 100);
        g.strokeStyle = "rgba(255,255,255,0.8)"; g.strokeRect(15.5, top + 3.5, W - 31, 93);
        const isNarr = line.speaker === "narr";
        let x = 26;
        if (!isNarr && portraits[line.speaker]) {
            g.imageSmoothingEnabled = false;
            g.drawImage(portraits[line.speaker], 24, top + 14, 64, 64);
            g.strokeStyle = "#fff"; g.strokeRect(23.5, top + 13.5, 65, 65);
            text(names[line.speaker] || "", 100, top + 12, 14, line.speaker === "rival" ? COL.red : line.speaker === "op" ? COL.orange : COL.cyan, "left", false);
            x = 100;
        }
        // 折り返し
        g.font = font(13);
        const maxW = W - x - 36;
        const rows = [];
        let cur = "";
        for (const ch of shown) {
            if (g.measureText(cur + ch).width > maxW) { rows.push(cur); cur = ""; }
            cur += ch;
        }
        rows.push(cur);
        rows.slice(0, 3).forEach((r, i) => text(r, x, top + (isNarr ? 22 : 34) + i * 19, 13, COL.white, "left", false));
        if (s.chars >= full.length && Math.floor(ctx.t * 2.5) % 2) text("▼", W - 36, top + 78, 12, COL.cyan, "left", false);
    }
    function drawBanner() {
        const b = ctx.banner;
        if (!b) return;
        const a = Math.min(1, b.t * 3, (b.dur - b.t) * 3);
        g.globalAlpha = Math.max(0, a);
        g.fillStyle = "rgba(0,10,20,0.6)"; g.fillRect(0, 150, W, b.sub ? 76 : 56);
        g.fillStyle = COL.teal; g.fillRect(0, 150, W, 1); g.fillRect(0, b.sub ? 225 : 205, W, 1);
        const slide = (1 - Math.min(1, b.t * 2.5)) * 60;
        text(b.text, W / 2 + slide, 162, 24, COL.white, "center");
        if (b.sub) text(b.sub, W / 2 - slide, 198, 12, COL.pink, "center");
        g.globalAlpha = 1;
    }
    function drawTitle() {
        base();
        // 背景: 流れる海と雲
        const tile = tileOf("ocean");
        const off = (ctx.t * 40) % TILE;
        g.setTransform(2, 0, 0, 2 * SQ, 0, 0);
        for (let y = -1; y < 4; y++) for (let x = 0; x < 4; x++) g.drawImage(tile, x * TILE - off * 0.3, y * TILE + off, TILE + 0.5, TILE + 0.5);
        base();
        g.fillStyle = "rgba(0,10,30,0.35)"; g.fillRect(0, 0, W, H);
        // 変形をくり返す自機
        const cyc = ctx.t % 6;
        const a = -0.9 + Math.sin(ctx.t * 0.4) * 0.5;
        const X = 470, Y = 270;
        let t;
        if (cyc < 2.2) t = 0; else if (cyc < 3) t = (cyc - 2.2) / 0.8; else if (cyc < 5.2) t = 1; else t = 1 - (cyc - 5.2) / 0.8;
        if (t <= 0) draw(g, model("fighterBig"), X, Y, a, { alt: 22 + Math.sin(ctx.t * 2) * 4, bank: 0, shadowAlpha: 0.3 });
        else if (t >= 1) draw(g, model("robotBig"), X, Y, a, { alt: 8 + Math.sin(ctx.t * 2) * 3, shadowAlpha: 0.3 });
        else drawMorph(g, PAIRS, X, Y, a, t, { px: 4.2, alt: 22 - 14 * t });
        if (t > 0 && t < 1 && ctx.titleMorphSfx !== Math.floor(ctx.t / 6) * 2 + (cyc < 4 ? 0 : 1)) { ctx.titleMorphSfx = Math.floor(ctx.t / 6) * 2 + (cyc < 4 ? 0 : 1); }
        // タイトル
        g.globalCompositeOperation = "lighter";
        const gr = g.createLinearGradient(0, 40, 0, 110);
        gr.addColorStop(0, "rgba(90,240,240,0.0)"); gr.addColorStop(0.5, "rgba(90,240,240,0.18)"); gr.addColorStop(1, "rgba(90,240,240,0)");
        g.fillStyle = gr; g.fillRect(0, 40, W, 70);
        g.globalCompositeOperation = "source-over";
        text("VARIANT HEART", 34, 50, 44, "#ffffff");
        text("VARIANT HEART", 34, 50, 44, `rgba(60,214,207,${0.35 + 0.2 * Math.sin(ctx.t * 3)})`, "left", false);
        text(tr("subtitle"), 40, 100, 14, COL.orange);
        TEXT[lang].controls.forEach((c, i) => text(c, 40, 150 + i * 18, 12, COL.white));
        if (Math.floor(ctx.t * 2) % 2) text(tr("start"), 40, 270, 16, COL.yellow);
        text("XV-7 SWALLOW", X, Y + 40, 10, COL.gray, "center");
        text("© WFS GAMES", W - 10, H - 18, 10, COL.gray, "right");
    }
    function drawOver() {
        base();
        g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(0, 0, W, H);
        text(tr("overTitle"), W / 2, 120, 36, COL.red, "center");
        ctx.menu.options.forEach((o, i) => text((ctx.menu.sel === i ? "▶ " : "  ") + o, W / 2 - 110, 200 + i * 26, 16, ctx.menu.sel === i ? COL.white : COL.gray));
    }
    function drawEnd() {
        base();
        g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, 0, W, H);
        if (ctx.state === "theEnd") {
            const total = Object.values(run.hearts).reduce((a, b) => a + b, 0);
            text(tr("theEnd"), W / 2, 120, 32, COL.yellow, "center");
            text(`${tr("score")} ${run.score}`, W / 2, 180, 16, COL.white, "center");
            text(`${tr("hearts")} ${total}/${stages.length * 5}`, W / 2, 206, 14, COL.pink, "center");
        } else text(tr("overTitle"), W / 2, 150, 36, COL.red, "center");
        if (ctx.endT > 1 && Math.floor(ctx.t * 2) % 2) text(tr("toTitle"), W / 2, 280, 14, COL.gray, "center");
    }
    function render() {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.imageSmoothingEnabled = false;
        if (ctx.state === "title") { drawTitle(); return; }
        shx = ctx.shake > 0 ? rand(-ctx.shake, ctx.shake) : 0;
        shy = ctx.shake > 0 ? rand(-ctx.shake, ctx.shake) : 0;
        drawWorld();
        base();
        if (ctx.flash > 0) { g.fillStyle = `rgba(255,255,255,${ctx.flash * 0.7})`; g.fillRect(0, 0, W, H); }
        if (ctx.state !== "theEnd" && ctx.state !== "finished") drawHUD();
        drawBanner();
        if (ctx.state === "over") drawOver();
        if (ctx.state === "theEnd" || ctx.state === "finished") drawEnd();
        drawStory();
        if (ctx.paused) {
            g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, 0, W, H);
            text(tr("paused"), W / 2, 170, 28, COL.white, "center");
            text(tr("pauseHint"), W / 2, 212, 12, COL.gray, "center");
        }
    }

    // ---------- ループ ----------
    let alive = true, raf = 0, last = performance.now();
    const loop = (now) => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!ctx.externalPause) {
            try { update(dt); } catch (e) { console.error("[variant] update failed", e); }
        }
        taps.clear();
        try { render(); } catch (e) { console.error("[variant] render failed", e); }
    };
    raf = requestAnimationFrame(loop);
    setTimeout(focusRoot, 0);
    audio.playMusic("title");

    function restart() {
        run = null; st = null; p = null; boss = null;
        enemies = []; ebul = []; pbul = []; parts = []; pickups = []; hearts = []; props = []; timers.length = 0;
        Object.assign(ctx, { state: "title", paused: false, finished: false, story: null, banner: null, menu: null, hint: null, flash: 0, shake: 0 });
        setShadowScale(1);
        audio.playMusic("title");
        focusRoot();
    }

    return {
        unmount() {
            alive = false;
            cancelAnimationFrame(raf);
            ro.disconnect();
            container.removeEventListener("keydown", onKey);
            container.removeEventListener("keyup", onKey);
            audio.close();
            container.innerHTML = "";
        },
        pause() { ctx.externalPause = true; audio.setPaused(true); },
        resume() { ctx.externalPause = false; audio.setPaused(false); focusRoot(); },
        restart,
        focus: focusRoot,
        // ---- 動作確認用 ----
        debugState() {
            return {
                state: ctx.state, story: !!ctx.story, stage: run?.stage, kills: st?.kills, quota: st?.def.quota, bossPhase: st?.bossPhase,
                boss: boss && { type: boss.type, hp: Math.round(boss.hp), turrets: liveTurrets(), mode: boss.mode, x: Math.round(boss.x), y: Math.round(boss.y) },
                p: p && { x: Math.round(p.x), y: Math.round(p.y), mode: p.mode, hp: p.hp, morph: !!p.morph, missiles: p.missiles, locks: p.locks.length },
                enemies: enemies.length, ebul: ebul.length, parts: parts.length, hearts: run?.hearts, lives: run?.lives, score: run?.score,
            };
        },
        debugStart(stage = 1) { if (!run) run = newRun(); ctx.finished = false; startStage(clamp((stage | 0) - 1, 0, stages.length - 1), { skipStory: true }); ctx.story = null; ctx.banner = null; return true; },
        debugSkipStory() { if (ctx.story) { const d = ctx.story.done; ctx.story = null; d?.(); } return true; },
        debugBoss() { if (st) st.kills = st.def.quota; return true; },
        debugHurtBoss(n, weapon = "saber") { if (boss) { st.bossPhase = "fight"; boss.parts.forEach((q) => { q.alive = false; }); damageBoss("core", n, weapon, boss.x - Math.cos(boss.ang) * 100, boss.y - Math.sin(boss.ang) * 100); } return true; },
        debugGod(on = true) { ctx.god = on; return true; },
        debugHearts(n = 5) { run.hearts[run.stage] = n; return true; },
        debugTeleport(x, y) { p.x = x; p.y = y; cam.x = x; cam.y = y; return true; },
        debugNearHeart() { const h = hearts.find((q) => !q.got); if (h) { p.x = h.x; p.y = h.y + 200; cam.x = p.x; cam.y = p.y; } return !!h; },
        debugResult() { return run && stageResult(run.stage); },
        debugHeld(a, on = true) { if (on) held.add(a); else held.delete(a); return true; },
        debugTap(a) { taps.add(a); return true; },
        debugBulletSpeeds() { return ebul.map((b) => Math.round(Math.hypot(b.vx, b.vy))); },
        debugWave(n = 1) { for (let i = 0; i < n; i++) spawnAirWave(); return enemies.filter(approaching).length; },
        debugAt(X, Y, r = 30) {
            const hit = [];
            const chk = (o, layer, x, y) => { if (Math.hypot(x - X, y - Y) < r) hit.push([layer, o.m?.name, Math.round(x), Math.round(y), o.s ?? 1]); };
            farObjs.forEach((o) => chk(o, "far", layerX(o.x, o.k), layerY(o.y, o.k)));
            nearObjs.forEach((o) => chk(o, "near", layerX(o.x, o.k), layerY(o.y, o.k)));
            props.forEach((o) => chk(o, "prop", sx(o.x), sy(o.y)));
            return hit;
        },
        debugBeam(t = 0) { if (boss?.type === "flagship") boss.beam = { t, fired: false }; return !!boss; },
        debugApproach() { return enemies.filter(approaching).map((e) => [e.type, +e.app.toFixed(2)]); },
        debugBullets() { ["s", "m", "b"].forEach((k, j) => { for (let i = 0; i < 5; i++) ebul.push({ x: p.x - 120 + i * 30, y: p.y - 140 + j * 40, vx: 0, vy: 0, kind: k, r: k === "b" ? 7 : k === "m" ? 5 : 4, life: 99, dmg: 0, t: 0 }); }); return true; },
        debugKill(p0) { if (p0 === "die") { p.hp = 1; p.inv = 0; hurtPlayer(999); } return true; },
    };
}

/**
 * KNIGHT HEART — 80年代風の横スクロールアクション (WFS Games 第6弾、すべてオリジナル)
 *
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debug... }
 *
 * host: apiVersion / lang / settings { difficulty, sound, bgm } / runStart() / stageClear(result) / finish(result)
 * result: { gameId, kind: "stage"|"ending"|"gameover", cleared, score, bonus, items, stage, stagesTotal, stageName, negative, rewards }
 *
 * 見習い騎士カノンが走って跳んで武器を投げる。遊びの中心は「段差」と「スピード」:
 *  - 方向キーを押し続けると少しずつ加速する(勢い)。最高速を超えた勢いはすぐには落ちない
 *  - 下り坂で加速・上り坂で減速。走りながら ↓ でスライディング(下り坂でぐんぐん加速し、小さな敵をはね飛ばす)
 *  - 速く走るほど高く遠くへ跳べる。上り坂の終わりで跳ぶとジャンプ台になる
 *  - 段差は壁(自動では上れない)。バネ・動く足場・くずれる床・ブーツ(最高速アップ)
 *  - 鎧: 1回目の被弾で鎧が割れて普段着に、2回目でミス。VITA(体力ゲージ)は時間で減り、果物で回復
 * 物理は 1/120 秒の固定刻みで計算する(坂やバネで抜けないように)。
 */
import * as Phaser from "../../vendor/phaser/phaser.esm.min.js";
import { createAudio } from "../../common/audio.js";
import { loadFont, txt, COL, pad, StoryBox, addScanlines } from "../../common/retro.js";
import { SONGS } from "./songs.js";
import { makeKnightTextures, makeEnemyTextures, makeBossTextures, makeTileset, makeBackdrop, T, TILE } from "./sprites.js";
import { buildLevel, ROWS } from "./levels.js";
import { makeSfx } from "./sfx.js";

const GAME_ID = "knight";
const W = 480;
const H = 320;
const HISCORE_KEY = "wfs_games_knight_hiscore";
const ITEMS_PER_STAGE = 5;
const STEP = 1 / 120;

// ---- 物理 (px, 秒) ----
const GRAV = 1250;          // ふつうの重力
const GRAV_HELD = 760;      // 上昇中にジャンプを押し続けているとき
const MAX_FALL = 540;
const ACC = 760;            // 地上の加速
const TOP = 175;            // 走りの最高速
const TOP_BOOTS = 235;      // ブーツの最高速
const TURN = 1500;          // 切り返しの減速
const FRICTION = 1000;      // 手を離したときの減速
const OVER_DECAY = 150;     // 最高速を超えた勢いが落ちる速さ(ゆっくり = 勢いが残る)
const SLOPE_G = 300;        // 坂で受ける加速(傾き 1 のとき)
const SLIDE_FRICTION = 120;
const SLIDE_MAX = 360;
const JUMP_V = 300;
const JUMP_SPEED_K = 0.3;   // 速いほど高く跳べる
const SPRING_V = 570;
const STOMP_V = 290;
const HW = 6;               // 当たり判定の半分の幅
const HEIGHT = 30;
const LOW_H = 14;           // スライディング・しゃがみの高さ
const COYOTE = 0.08;
const JUMP_BUFFER = 0.12;
const AFTERIMAGE_SPEED = 215;
const VITA_MAX = 32;
const EXTEND_EVERY = 30000;

const DIFFICULTY = {
    easy: { lives: 5, drain: 2.3, shot: 0.7, bossHp: 0.8 },
    normal: { lives: 3, drain: 1.6, shot: 1.0, bossHp: 1.0 },
    hard: { lives: 3, drain: 1.2, shot: 1.35, bossHp: 1.25 },
};

const WEAPONS = {
    lance: { tex: "w_lance", vx: 370, range: 240, max: 2, cd: 0.26, dmg: 1, w: 16, h: 6 },
    dagger: { tex: "w_dagger", vx: 480, range: 170, max: 3, cd: 0.14, dmg: 1, w: 10, h: 6 },
    axe: { tex: "w_axe", vx: 190, vy: -380, grav: 950, range: 9999, max: 2, cd: 0.34, dmg: 2, w: 14, h: 14, pierce: true },
};

const ENEMY = {
    puru: { hp: 1, score: 100, w: 20, h: 18, stomp: true, small: true },
    hopper: { hp: 1, score: 150, w: 24, h: 16, stomp: true, small: true },
    bat: { hp: 1, score: 200, w: 22, h: 12, stomp: true, small: true, fly: true },
    goblin: { hp: 3, score: 400, w: 18, h: 32, stomp: false },
    flower: { hp: 2, score: 300, w: 18, h: 26, stomp: false },
    wisp: { hp: 2, score: 300, w: 18, h: 20, stomp: false, fly: true },
};

const BOSS = {
    slime: { tex: "boss_slime", w: 64, h: 44, oy: 8 },
    hornet: { tex: "boss_hornet", w: 52, h: 34, oy: 14, fly: true },
    golem: { tex: "boss_golem", w: 56, h: 74, oy: 4 },
    knight: { tex: "boss_knight", w: 34, h: 72, oy: 2 },
    queen: { tex: "boss_queen", w: 44, h: 70, oy: 6, fly: true },
};

// ---- ステージの景色 ----
const THEMES = {
    meadow: {
        key: "meadow", sky: [0x3878f8, 0x5098f8, 0x70b8f8, 0x98d0f8, 0xc0e8f8],
        tile: { top: 0x58c838, topL: 0xb0f880, dirt: 0xa06838, dirtD: 0x704820, dirtL: 0xd09868, block: 0xc87848, blockL: 0xf8b880, blockD: 0x803818, plank: 0xc89058, plankL: 0xf8d090, plankD: 0x805028, crumble: 0xd8b888 },
        back: { far: "hills", farCol: 0x80c8a0, near: "bushes", nearCol: 0x38a038 },
        enemy: { puru: 0x58d8f8, puruD: 0x2888b8, hopper: 0x68d038, hopperD: 0x2c8018, bat: 0x9060d0, goblin: 0x78b848, goblinCloth: 0x986838, flower: 0xf85878, wisp: 0xa8d8f8 },
        clouds: true,
    },
    forest: {
        key: "forest", sky: [0x58a8b8, 0x70c0c0, 0x90d0c0, 0xb0e0c0, 0xd0f0c8],
        tile: { top: 0x389828, topL: 0x88e050, dirt: 0x6c4c2c, dirtD: 0x48301c, dirtL: 0x987048, block: 0x887050, blockL: 0xb8a078, blockD: 0x504028, plank: 0xa87840, plankL: 0xd8a868, plankD: 0x684020, crumble: 0xb89870 },
        back: { far: "forest", farCol: 0x3c7848, near: "trees", nearCol: 0x206828, trunk: 0x583818 },
        enemy: { puru: 0xf8a838, puruD: 0xb86818, hopper: 0x48a8f8, hopperD: 0x2060b0, bat: 0x784890, goblin: 0x68a838, goblinCloth: 0x885028, flower: 0xd848d8, wisp: 0xc8f8a8 },
    },
    volcano: {
        key: "volcano", sky: [0x100404, 0x200808, 0x381008, 0x501808, 0x682008],
        tile: { top: 0x8c6c5c, topL: 0xc0a090, dirt: 0x5a4038, dirtD: 0x382420, dirtL: 0x806058, block: 0x7c4c3c, blockL: 0xa87060, blockD: 0x482420, plank: 0x787078, plankL: 0xa8a0a8, plankD: 0x484050, crumble: 0x9c7868 },
        back: { far: "cave", farCol: 0x401818, near: "rocks", nearCol: 0x502820 },
        enemy: { puru: 0xf86838, puruD: 0xa83018, hopper: 0xf8c838, hopperD: 0xb07818, bat: 0xc04040, goblin: 0xa87838, goblinCloth: 0x603028, flower: 0xf8a018, wisp: 0xf89838 },
        embers: true,
    },
    ice: {
        key: "ice", sky: [0x88b0e0, 0xa0c8f0, 0xb8d8f8, 0xd0e8f8, 0xe8f4f8],
        tile: { top: 0xf0f8f8, topL: 0xffffff, dirt: 0x8898b8, dirtD: 0x687898, dirtL: 0xb0c0d8, block: 0x98b8d8, blockL: 0xd8f0f8, blockD: 0x5878a0, plank: 0x9c8c7c, plankL: 0xd8d0c0, plankD: 0x5c4c40, crumble: 0xc8d8e8 },
        back: { far: "ice", farCol: 0x98b8d8, snow: 0xf8f8f8, near: "pines", nearCol: 0x386868 },
        enemy: { puru: 0x88e8f8, puruD: 0x3898c8, hopper: 0xf8f8f8, hopperD: 0x98a8c8, bat: 0x5868b8, goblin: 0x88b8c8, goblinCloth: 0x4858a0, flower: 0x58a8f8, wisp: 0xd8f8f8 },
        snow: true,
    },
    castle: {
        key: "castle", sky: [0x060614, 0x0c0c24, 0x141434, 0x1c1c44, 0x281c50],
        tile: { top: 0x9090a8, topL: 0xd0d0e0, dirt: 0x585870, dirtD: 0x3c3c50, dirtL: 0x7c7c94, block: 0x70708c, blockL: 0xa0a0b8, blockD: 0x383848, plank: 0x7c5c48, plankL: 0xb08868, plankD: 0x4c3428, crumble: 0x8c8ca0 },
        back: { far: "castle", farCol: 0x1c1c3c, near: "pillars", nearCol: 0x2c2c4c },
        enemy: { puru: 0xb868f8, puruD: 0x7030b0, hopper: 0x58c898, hopperD: 0x287858, bat: 0x6838a0, goblin: 0x8890a0, goblinCloth: 0x502858, flower: 0xc83858, wisp: 0x88f8d8 },
        stars: true, moon: true,
    },
};

const TEXT = {
    en: {
        title: "KNIGHT HEART", pushStart: "PUSH SPACE KEY",
        controls: "MOVE ← →  JUMP SPACE/X  ATTACK Z/C (↑+Z UP / ↓+Z IN AIR DOWN)  SLIDE ↓ WHILE RUNNING  PAUSE ESC",
        stage: (n) => `STAGE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "ALL HEARTS: PRIVATE PHOTO",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / CLICK",
        warning: "WARNING!", checkpoint: "CHECK POINT", vitaBonus: "VITA BONUS", timeBonus: "TIME BONUS",
        retryStage: (n) => `RETRY STAGE ${n}`, giveUp: "GIVE UP", pauseRetry: "R: RETRY THIS STAGE (-1 LIFE)", continueHelp: "↑ ↓ SELECT   SPACE OK",
        difficulty: { easy: "EASY", normal: "NORMAL", hard: "HARD" },
    },
    ja: {
        title: "KNIGHT HEART", pushStart: "PUSH SPACE KEY",
        controls: "移動 ← →  ジャンプ SPACE/X  攻撃 Z/C (↑+攻撃で真上 / 空中で↓+攻撃で真下)  スライディング 走りながら↓  一時停止 ESC",
        stage: (n) => `STAGE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "ハート全部獲得: プライベート写真",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / クリック",
        warning: "WARNING!", checkpoint: "CHECK POINT", vitaBonus: "VITA BONUS", timeBonus: "TIME BONUS",
        retryStage: (n) => `STAGE ${n} からやり直す`, giveUp: "あきらめる", pauseRetry: "R: このステージをやり直す (残り -1)", continueHelp: "↑ ↓ で選んで SPACE",
        difficulty: { easy: "やさしい", normal: "ふつう", hard: "むずかしい" },
    },
    zh: {
        title: "KNIGHT HEART", pushStart: "PUSH SPACE KEY",
        controls: "移动 ← →  跳跃 SPACE/X  攻击 Z/C (↑+攻击向上 / 空中↓+攻击向下)  滑铲 奔跑中↓  暂停 ESC",
        stage: (n) => `STAGE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "全部爱心获得: 私人照片",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / 点击",
        warning: "WARNING!", checkpoint: "CHECK POINT", vitaBonus: "VITA BONUS", timeBonus: "TIME BONUS",
        retryStage: (n) => `从 STAGE ${n} 重来`, giveUp: "放弃", pauseRetry: "R: 重来本关 (残机 -1)", continueHelp: "↑ ↓ 选择  SPACE 确定",
        difficulty: { easy: "简单", normal: "普通", hard: "困难" },
    },
};

const JUMP_CODES = new Set(["Space", "KeyX"]);
const ATTACK_CODES = new Set(["KeyZ", "KeyC"]);
const GAME_KEYS = new Set(["KeyR", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS", "KeyZ", "KeyX", "KeyC", "KeyP", "Escape", "Enter"]);

// ---- タイルの性質 ----
const SOLID = new Set(["#", "i", "=", "C", "c"]);
const SLOPES = {
    "/": { k: -1, f: (lx) => T - lx },
    "\\": { k: 1, f: (lx) => lx },
    "1": { k: -0.5, f: (lx) => T - lx / 2 },
    "2": { k: -0.5, f: (lx) => T / 2 - lx / 2 },
    "3": { k: 0.5, f: (lx) => lx / 2 },
    "4": { k: 0.5, f: (lx) => T / 2 + lx / 2 },
};
const GROUNDISH = new Set(["#", "i", "/", "\\", "1", "2", "3", "4"]);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const approach = (v, target, amount) => (v < target ? Math.min(target, v + amount) : Math.max(target, v - amount));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

async function loadData() {
    const res = await fetch(new URL("./stages.json", import.meta.url));
    if (!res.ok) throw new Error(`stages.json: HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.stages) || !data.stages.length) throw new Error("stages.json: no stages");
    return data;
}

function loadHiScore() { try { return Number(localStorage.getItem(HISCORE_KEY)) || 0; } catch { return 0; } }
function saveHiScore(v) { try { localStorage.setItem(HISCORE_KEY, String(v)); } catch { /* ignore */ } }

/** グリッドの文字 → タイル番号(上が空いている地面は上面のタイル) */
function tileIndex(grid, r, c) {
    const ch = grid[r][c];
    const above = r > 0 ? grid[r - 1][c] : ".";
    switch (ch) {
        case "#": return GROUNDISH.has(above) ? TILE.ground : TILE.groundTop;
        case "i": return GROUNDISH.has(above) ? TILE.ice : TILE.iceTop;
        case "=": return TILE.block;
        case "C": return r + 1 < grid.length && grid[r + 1][c] === "C" ? TILE.ground : TILE.ceiling;
        case "/": return TILE.su;
        case "\\": return TILE.sd;
        case "1": return TILE.g1;
        case "2": return TILE.g2;
        case "3": return TILE.g3;
        case "4": return TILE.g4;
        case "-": return TILE.oneway;
        case "c": return TILE.crumble;
        case "^": return TILE.spike;
        case "~": return TILE.lavaTop;
        case "L": return TILE.lava;
        default: return -1;
    }
}

// ---------------------------------------------------------------------------
// mount
// ---------------------------------------------------------------------------

export async function mount(container, host = {}) {
    const lang = TEXT[host.lang] ? host.lang : "en";
    const tr = (k, ...a) => {
        const v = TEXT[lang][k] ?? TEXT.en[k] ?? k;
        return typeof v === "function" ? v(...a) : v;
    };
    const loc = (obj) => (obj && (obj[lang] || obj.en)) || "";
    const settings = { difficulty: "normal", sound: true, bgm: true, ...(host.settings || {}) };
    const diff = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    const [data] = await Promise.all([loadData(), loadFont()]);
    const stages = data.stages;
    const prompts = data.prompts || {};
    const heroineName = loc(data.heroine?.name) || "KANON";
    const audio = createAudio({ sound: settings.sound !== false, bgm: settings.bgm !== false, songs: SONGS });
    const sfx = makeSfx(audio);

    const ctx = { finished: false, skipStory: false, externalPause: false, pauseToggle: false, advance: false, play: null, hiScore: loadHiScore(), invincible: false };

    const finish = (result) => {
        if (ctx.finished) return;
        ctx.finished = true;
        try { host.finish?.(result); } catch (e) { console.error("[knight] host.finish failed", e); }
    };
    const syncAudioPause = () => {
        const p = ctx.play;
        audio.setPaused(ctx.externalPause || !!(p && p.sys.isActive() && p.paused));
    };

    container.innerHTML = "";
    const root = document.createElement("div");
    root.tabIndex = 0;
    root.style.cssText = "width:100%;height:100%;outline:none;position:relative;";
    container.appendChild(root);
    addScanlines(root);

    // Phaser は root で受けたキーを処理する(defaultPrevented のイベントは無視するので先に止めない)。
    // container までバブリングしてきたところで止め、WFS 全体のショートカットやスクロールに渡さない。
    const onKey = (e) => {
        e.stopPropagation();
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        if (e.type !== "keydown") return;
        audio.unlock();
        if (e.repeat) return;
        if (e.code === "Escape" || e.code === "KeyP") ctx.pauseToggle = true;
        if (e.code === "ArrowUp" || e.code === "KeyW") ctx.menuMove = -1;
        if (e.code === "ArrowDown" || e.code === "KeyS") ctx.menuMove = 1;
        if (e.code === "KeyR") ctx.retryTap = true;
        if (e.code === "Space" || e.code === "Enter" || e.code === "KeyZ") ctx.advance = true;
        // 一瞬の押下でもフレームの間で取りこぼさないように、押した事実を覚えておく
        if (JUMP_CODES.has(e.code)) ctx.jumpTap = true;
        if (ATTACK_CODES.has(e.code)) ctx.attackTap = true;
    };
    container.addEventListener("keydown", onKey);
    container.addEventListener("keyup", onKey);
    const focusRoot = () => root.focus({ preventScroll: true });
    const onPointer = () => { focusRoot(); audio.unlock(); ctx.advance = true; };
    root.addEventListener("pointerdown", onPointer);

    // ---------------- 背景 ----------------

    function buildBackdrop(scene, theme) {
        const { far, near } = makeBackdrop(scene, theme);
        const sky = scene.add.graphics().setScrollFactor(0).setDepth(-10);
        const n = theme.sky.length;
        theme.sky.forEach((c, i) => sky.fillStyle(c, 1).fillRect(0, Math.floor((i * H) / n), W, Math.ceil(H / n) + 1));
        if (theme.stars) {
            for (let i = 0; i < 50; i++) sky.fillStyle(0xf8f8f8, rand(0.3, 1)).fillRect(rand(0, W), rand(0, H * 0.6), 1, 1);
        }
        if (theme.moon) {
            sky.fillStyle(0xf8f0c8, 1).fillCircle(W * 0.78, 58, 24);
            sky.fillStyle(theme.sky[1], 1).fillCircle(W * 0.78 + 9, 52, 20);
        }
        const bd = {
            sky,
            far: scene.add.tileSprite(0, theme.back.far === "cave" ? 20 : H - 214, W, 120, far).setOrigin(0, 0).setScrollFactor(0).setDepth(-9),
            near: scene.add.tileSprite(0, H - 136, W, 82, near).setOrigin(0, 0).setScrollFactor(0).setDepth(-8),
            clouds: [],
            flakes: [],
        };
        if (theme.clouds) {
            for (let i = 0; i < 5; i++) {
                const c = scene.add.graphics().setScrollFactor(0).setDepth(-9.5);
                c.fillStyle(0xf8f8f8, 0.9).fillEllipse(0, 0, 46, 14).fillEllipse(12, -6, 30, 14).fillEllipse(-14, -3, 22, 10);
                bd.clouds.push({ g: c, x: rand(0, W * 2), y: rand(56, 120), sp: rand(0.05, 0.12) });
            }
        }
        if (theme.snow || theme.embers) {
            for (let i = 0; i < 40; i++) {
                const f = scene.add.image(rand(0, W), rand(0, H), "spark").setScrollFactor(0).setDepth(20)
                    .setTint(theme.snow ? 0xffffff : pick([0xf89838, 0xf85818, 0xf8d838])).setAlpha(rand(0.4, 0.9)).setScale(theme.snow ? rand(0.6, 1.2) : rand(0.4, 0.8));
                bd.flakes.push({ img: f, vx: theme.snow ? rand(-15, 5) : rand(-8, 8), vy: theme.snow ? rand(20, 45) : rand(-35, -15) });
            }
        }
        return bd;
    }

    function updateBackdrop(bd, camX, dt) {
        bd.far.tilePositionX = camX * 0.15;
        bd.near.tilePositionX = camX * 0.4;
        for (const c of bd.clouds) {
            const x = ((c.x - camX * c.sp) % (W + 120) + W + 120) % (W + 120) - 60;
            c.g.setPosition(x, c.y);
        }
        for (const f of bd.flakes) {
            f.img.x += f.vx * dt;
            f.img.y += f.vy * dt;
            if (f.img.y > H + 4) f.img.y = -4;
            if (f.img.y < -4) f.img.y = H + 4;
            if (f.img.x < -4) f.img.x = W + 4;
            if (f.img.x > W + 4) f.img.x = -4;
        }
    }

    // ---------------- title ----------------

    class TitleScene extends Phaser.Scene {
        constructor() { super("title"); }
        create() {
            this.started = false;
            makeKnightTextures(this);
            this.bd = buildBackdrop(this, THEMES.meadow);
            const ground = this.add.graphics().setDepth(1);
            ground.fillStyle(0x58c838, 1).fillRect(0, H - 52, W, 6);
            ground.fillStyle(0xa06838, 1).fillRect(0, H - 46, W, 46);
            this.t = 0;
            const g = this.add.graphics().setDepth(250);
            g.lineStyle(2, 0xf8f8f8, 1).strokeRect(10, 10, W - 20, H - 20);
            g.lineStyle(2, 0xf858a8, 1).strokeRect(15, 15, W - 30, H - 30);
            txt(this, W / 2 + 3, 49, tr("title"), 32, COL.red).setOrigin(0.5).setDepth(250);
            txt(this, W / 2, 46, tr("title"), 32, COL.yellow).setOrigin(0.5).setDepth(250);
            txt(this, W / 2, 80, `- ${tr("difficulty")[settings.difficulty] || ""} -`, 16, COL.white).setOrigin(0.5).setDepth(250);
            this.add.graphics().setDepth(250).fillStyle(0x000010, 0.6).fillRect(W / 2 - 124, 108, 60, 76).lineStyle(2, 0xf8f8f8, 1).strokeRect(W / 2 - 122, 112, 56, 56);
            this.add.image(W / 2 - 94, 140, "kanon_face").setDepth(250);
            txt(this, W / 2 - 94, 172, heroineName, 16, COL.yellow).setOrigin(0.5).setDepth(250).setScale(0.8);
            this.hero = this.add.image(W / 2 + 40, 186, "kanon_a_run1").setOrigin(0.5, 1).setScale(2).setDepth(250);
            this.frame = 0;
            const start = txt(this, W / 2, 212, tr("pushStart"), 16, COL.yellow).setOrigin(0.5).setDepth(250);
            this.time.addEvent({ delay: 480, loop: true, callback: () => start.setVisible(!start.visible) });
            txt(this, W / 2, 242, tr("controls"), 16, COL.white).setOrigin(0.5).setScale(0.52).setDepth(250);
            txt(this, W / 2, 290, `HI ${pad(ctx.hiScore)}`, 16, COL.white).setOrigin(0.5).setScale(0.8).setDepth(250);
            ctx.advance = false;
            audio.playMusic("title");
        }
        begin() {
            if (this.started) return;
            this.started = true;
            audio.unlock();
            audio.sfx("start");
            try { host.runStart?.(); } catch (e) { console.error("[knight] host.runStart failed", e); }
            this.scene.start("play", { stageIndex: 0, score: 0, lives: diff.lives, weapon: "lance" });
        }
        update(_t, delta) {
            const dt = Math.min(0.05, delta / 1000);
            this.t += dt;
            updateBackdrop(this.bd, this.t * 90, dt);
            this.frame = (this.frame + dt * 10) % 4;
            this.hero.setTexture(`kanon_a_${["run1", "run2", "run3", "run2"][Math.floor(this.frame)]}`);
            if (ctx.advance) { ctx.advance = false; this.begin(); }
            const pad1 = this.input.gamepad?.pad1;
            if (pad1 && (pad1.A || pad1.buttons?.[9]?.pressed)) this.begin();
        }
    }

    // ---------------- play ----------------

    class PlayScene extends Phaser.Scene {
        constructor() { super("play"); }

        init(d) {
            this.stageIndex = d.stageIndex ?? 0;
            this.score = d.score ?? 0;
            this.lives = d.lives ?? diff.lives;
            this.weapon = d.weapon || "lance";
            this.nextExtend = d.nextExtend ?? EXTEND_EVERY;
            this.retry = !!d.retry;
            this.startState = { score: this.score, weapon: this.weapon, nextExtend: this.nextExtend };
            this.stage = stages[this.stageIndex];
            this.theme = THEMES[this.stage.theme] || THEMES.meadow;
        }

        create() {
            ctx.play = this;
            ctx.pauseToggle = false;
            this.paused = false;
            this._wasPaused = false;
            this.time0 = 0;
            this.stageTime = 0;
            this.itemsGot = 0;
            this.combo = 0;

            makeKnightTextures(this);
            makeEnemyTextures(this, this.theme);
            makeBossTextures(this);
            this.bd = buildBackdrop(this, this.theme);

            // 地形
            const L = buildLevel(this.stage.id);
            this.L = L;
            this.grid = L.grid.map((row) => row.split(""));
            this.kinds = L.kinds;
            this.worldW = L.width * T;
            const tkey = makeTileset(this, this.theme);
            const data = this.grid.map((row, r) => row.map((_, c) => tileIndex(this.grid, r, c)));
            this.map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
            const ts = this.map.addTilesetImage(tkey, tkey, T, T, 0, 0);
            this.layer = this.map.createLayer(0, ts, 0, 0).setDepth(0);
            this.crumbles = new Map(); // "c,r" -> { t, fallen, back }

            // 物
            this.enemies = [];
            this.items = [];
            this.springs = [];
            this.plats = [];
            this.flags = [];
            this.spawners = [];
            this.fires = [];
            this.icicles = [];
            this.boulders = [];
            this.shots = [];
            this.eshots = [];
            this.debris = [];
            this.gateX = null;
            this.bossSpawn = null;
            this.boss = null;
            this.arena = L.arena;
            let start = { x: 3 * T + 8, y: (ROWS - 4) * T };
            for (const e of L.ents) {
                const x = e.col * T + 8;
                const y = (ROWS - e.s) * T;
                switch (e.type) {
                    case "start": start = { x, y }; break;
                    case "fruit": case "meat": case "heart": case "armor": case "boots": case "lance": case "dagger": case "axe":
                        this.addItem(e.type, x, y); break;
                    case "spring": this.springs.push({ x, y, t: 0, sprite: this.add.image(x, y, "spring1").setOrigin(0.5, 1).setDepth(4) }); break;
                    case "flag": this.flags.push({ x, y, on: false, sprite: this.add.image(x - 4, y, "flag_down").setOrigin(0.5, 1).setDepth(3) }); break;
                    case "gate": this.gateX = x; break;
                    case "boss": this.bossSpawn = { x, y }; break;
                    case "mplat": this.addPlatform(e, x - 8, y); break;
                    case "rocks": this.spawners.push({ x, y, t: 0.5 }); break;
                    case "fire": this.fires.push({ x, baseY: (ROWS - 2) * T + 4, y: (ROWS - 2) * T + 4, vy: 0, t: rand(0.5, 2.2), up: false, sprite: this.add.image(x, 0, "fireball").setDepth(7).setVisible(false) }); break;
                    case "icicle": this.icicles.push({ x, y, top: y, state: "hang", t: 0, vy: 0, sprite: this.add.image(x, y, "icicle").setOrigin(0.5, 0).setDepth(4) }); break;
                    default:
                        if (ENEMY[e.type]) this.addEnemy(e.type, x, y);
                }
            }
            this.startPos = start;
            this.checkpoint = { ...start };

            // カノン
            this.p = {
                x: start.x, y: start.y, vx: 0, vy: 0, face: 1, grounded: true, k: 0, slopeVy: 0, kind: "g",
                sliding: false, crouch: false, coyote: 0, jumpBuf: 0, throwT: 0, fireCd: 0, invuln: 0, dead: false, deadT: 0,
                armor: true, boots: false, vita: VITA_MAX, onPlat: null, dropT: 0, frame: 0, ghostT: 0, dustT: 0, knock: 0,
            };
            this.player = this.add.image(start.x, start.y, "kanon_a_stand").setOrigin(0.5, 1).setDepth(8);
            this.bootsFx = this.add.graphics().setDepth(7.9);
            this.markG = this.add.graphics().setDepth(6.5);
            this.hintText = null; // シーンを作り直すたびに作る(前のステージの物は破棄されている)
            this.marks = []; // ボスの技の予告 { kind: "shadow"|"target"|"bang", x, y, t, dur, w, follow, onEnd }

            // カメラ(手動で動かす)
            this.camX = clamp(start.x - W * 0.4, 0, this.worldW - W);
            this.lockL = 0;
            this.lockR = this.worldW;
            this.cameras.main.setScroll(this.camX, 0);

            this.buildHud();
            this.banner = txt(this, W / 2, 96, "", 32, COL.yellow).setOrigin(0.5).setDepth(320).setScrollFactor(0).setVisible(false);
            this.subBanner = txt(this, W / 2, 128, "", 16, COL.white).setOrigin(0.5, 0).setDepth(320).setScrollFactor(0).setVisible(false);
            this.subBanner.setWordWrapWidth(W - 60, true);
            this.pauseText = txt(this, W / 2, H / 2, tr("paused"), 32, COL.white).setOrigin(0.5).setDepth(340).setScrollFactor(0).setVisible(false);
            this.pauseHelp = txt(this, W / 2, H / 2 + 30, tr("pauseRetry"), 16, COL.cyan).setOrigin(0.5, 0).setScale(0.75).setBackgroundColor("#000018").setPadding(8, 4, 8, 4).setDepth(340).setScrollFactor(0).setVisible(false);
            this.story = new StoryBox(this, { W, H, portrait: "kanon_face", speakerName: heroineName, nextLabel: tr("next"), loc, sfx: (n) => audio.sfx(n), depth: 330 });
            this.story.box.setScrollFactor(0, 0, true);

            this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,Z,X,C");
            this.renderAll(0);
            this.updateHud();

            const before = this.stage.story_before || [];
            if (before.length && !ctx.skipStory && !this.retry) this.startStory(before, () => this.startIntro());
            else this.startIntro();
        }

        // ---------- 物の追加 ----------
        addItem(type, x, y) {
            let tex = type;
            if (type === "fruit") tex = pick(["apple", "banana", "grapes"]);
            if (type === "armor") tex = "armor_item";
            if (WEAPONS[type]) tex = WEAPONS[type].tex;
            const it = { type, x, y: y - 9, baseY: y - 9, t: rand(0, 6), sprite: this.add.image(x, y - 9, tex).setDepth(5) };
            if (type === "heart") it.sprite.setScale(1.3);
            this.items.push(it);
            return it;
        }
        addEnemy(type, x, y, opts = {}) {
            const d = ENEMY[type];
            const e = {
                type, x, y, vx: 0, vy: 0, hp: d.hp, def: d, dir: -1, t: rand(0, 2), state: "idle", ground: !d.fly,
                baseY: y - (d.fly ? 0 : 0), active: false, dead: false, hitT: 0, ...opts,
                sprite: this.add.image(x, y, type === "bat" ? `bat1_${this.theme.key}` : `${type}_${this.theme.key}`).setOrigin(0.5, 1).setDepth(6),
            };
            if (type === "flower") e.t = rand(0.5, 1.5);
            this.enemies.push(e);
            return e;
        }
        addPlatform(e, x, y) {
            const w = (e.w || 3) * T;
            const g = this.add.graphics().setDepth(3);
            const P = this.theme.tile;
            g.fillStyle(0x201018, 1).fillRect(0, 0, w, 8);
            g.fillStyle(P.plank, 1).fillRect(1, 1, w - 2, 6);
            g.fillStyle(P.plankL, 1).fillRect(1, 1, w - 2, 1);
            for (let i = 4; i < w; i += 12) g.fillStyle(P.plankD, 1).fillRect(i, 3, 2, 2);
            this.plats.push({ x, y, bx: x, by: y, w, ax: e.ax || "x", range: (e.range || 4) * T, speed: e.speed || 50, phase: e.phase || 0, t: 0, dx: 0, dy: 0, g });
        }

        // ---------- タイルの問い合わせ ----------
        tileAt(c, r) {
            if (c < 0 || c >= this.L.width) return "#";
            if (r < 0 || r >= ROWS) return ".";
            return this.grid[r][c];
        }
        solidAt(x, y) { return SOLID.has(this.tileAt(Math.floor(x / T), Math.floor(y / T))); }
        /** (x, 行 r) のタイルの上面。無ければ null */
        surfaceAt(x, r) {
            const c = Math.floor(x / T);
            const ch = this.tileAt(c, r);
            const top = r * T;
            if (SOLID.has(ch)) return { y: top, k: 0, solid: true, c, r, ch };
            const s = SLOPES[ch];
            if (s) return { y: top + s.f(x - c * T), k: s.k, slope: true, c, r, ch };
            if (ch === "-") return { y: top, k: 0, oneway: true, c, r, ch };
            return null;
        }
        /** x の位置で、y が yFrom〜yTo の間にある最初の床(上から探す) */
        findFloor(x, yFrom, yTo, { slopes = true, oneway = true, prevFoot = -Infinity, plats = true } = {}) {
            const ra = Math.floor(yFrom / T), rb = Math.floor(yTo / T);
            let best = null;
            for (let r = ra; r <= rb; r++) {
                const s = this.surfaceAt(x, r);
                if (!s) continue;
                if (s.slope && !slopes) continue;
                if (s.oneway && (!oneway || prevFoot > s.y + 0.5)) continue;
                if (s.y >= yFrom && s.y <= yTo) { best = s; break; }
            }
            if (plats) {
                for (const p of this.plats) {
                    if (x < p.x || x > p.x + p.w) continue;
                    if (p.y >= yFrom && p.y <= yTo && prevFoot <= p.y + 0.5 && oneway && (!best || p.y < best.y)) best = { y: p.y, k: 0, plat: p, oneway: true };
                }
            }
            return best;
        }
        /** 足元の床(真ん中は坂も見る、両端は平らな床だけ見る。真ん中が坂なら両端は見ない) */
        footFloor(x, yFrom, yTo, opts) {
            const mid = this.findFloor(x, yFrom, yTo, opts);
            if (mid?.slope) return mid;
            let best = mid;
            for (const ox of [-HW + 1, HW - 1]) {
                const s = this.findFloor(x + ox, yFrom, yTo, { ...opts, slopes: false });
                if (s && (!best || s.y < best.y)) best = s;
            }
            return best;
        }
        ceilingHit(x, top) { return this.solidAt(x - HW + 1, top) || this.solidAt(x + HW - 1, top); }
        canStand(p) { return !this.ceilingHit(p.x, p.y - HEIGHT); }

        // ---------- HUD ----------
        buildHud() {
            const D = 300;
            const fix = (o) => o.setScrollFactor(0).setDepth(D);
            this.hudBg = fix(this.add.graphics());
            this.hudBg.fillStyle(0x000010, 0.55).fillRect(0, 0, W, 34);
            this.scoreText = fix(txt(this, 8, 2, "", 16, COL.white)).setScale(0.8);
            this.hiText = fix(txt(this, W / 2, 2, "", 16, COL.yellow).setOrigin(0.5, 0)).setScale(0.8);
            this.stageText = fix(txt(this, W - 8, 2, tr("stage", this.stageIndex + 1), 16, this.stage.color || COL.white).setOrigin(1, 0)).setScale(0.8);
            fix(txt(this, 8, 18, "VITA", 16, COL.orange)).setScale(0.6);
            this.vitaG = fix(this.add.graphics());
            this.hearts = [];
            for (let i = 0; i < ITEMS_PER_STAGE; i++) this.hearts.push(fix(this.add.image(W - 12 - (ITEMS_PER_STAGE - 1 - i) * 10, 25, "heart_s")));
            this.weaponIcon = fix(this.add.image(W / 2 + 48, 25, WEAPONS[this.weapon].tex)).setScale(0.75);
            this.armorIcon = fix(this.add.image(W / 2 + 74, 25, "armor_item")).setScale(0.7);
            this.bootsIcon = fix(this.add.image(W / 2 + 94, 25, "boots")).setScale(0.7);
            this.speedG = fix(this.add.graphics());
            fix(txt(this, W / 2 - 60, 18, "SPD", 16, COL.cyan)).setScale(0.6);
            this.lifeIcons = [];
            this.bossBar = fix(this.add.graphics());
            this.bossLabel = fix(txt(this, W / 2, 38, "", 16, COL.red).setOrigin(0.5, 0)).setScale(0.75).setVisible(false);
        }
        updateHud() {
            if (this.score > ctx.hiScore) ctx.hiScore = this.score;
            this.scoreText.setText(`SCORE ${pad(this.score)}`);
            this.hiText.setText(`HI ${pad(ctx.hiScore)}`);
            this.hearts.forEach((h, i) => h.setAlpha(i < this.itemsGot ? 1 : 0.2));
            const p = this.p;
            // VITA: 16 マス(1マス = 2)
            const g = this.vitaG;
            g.clear();
            const low = p.vita < 8;
            for (let i = 0; i < 16; i++) {
                const v = clamp(p.vita - i * 2, 0, 2);
                const col = low ? (Math.floor(this.time0 * 6) % 2 ? 0xf85858 : 0xf8f048) : 0xf89838;
                g.fillStyle(0x302020, 1).fillRect(36 + i * 7, 20, 6, 9);
                if (v > 0) g.fillStyle(col, 1).fillRect(36 + i * 7, 20 + (v < 2 ? 4 : 0), 6, v < 2 ? 5 : 9);
            }
            // 速さ
            const sg = this.speedG;
            sg.clear();
            const sp = Math.abs(p.vx);
            const ratio = clamp(sp / SLIDE_MAX, 0, 1);
            sg.fillStyle(0x203040, 1).fillRect(W / 2 - 38, 21, 64, 7);
            const scol = sp > AFTERIMAGE_SPEED ? (Math.floor(this.time0 * 12) % 2 ? 0xf858f8 : 0xf8f8f8) : sp > TOP * 0.9 ? 0x58f858 : 0x58e8f8;
            sg.fillStyle(scol, 1).fillRect(W / 2 - 38, 21, 64 * ratio, 7);
            sg.fillStyle(0xf8f8f8, 0.6).fillRect(W / 2 - 38 + 64 * (TOP / SLIDE_MAX), 20, 1, 9);
            this.weaponIcon.setTexture(WEAPONS[this.weapon].tex);
            this.armorIcon.setAlpha(p.armor ? 1 : 0.2);
            this.bootsIcon.setAlpha(p.boots ? 1 : 0.2);
            const want = Math.max(0, this.lives - 1);
            if (this.lifeIcons.length !== want) {
                this.lifeIcons.forEach((i) => i.destroy());
                this.lifeIcons = [];
                for (let i = 0; i < Math.min(want, 8); i++) this.lifeIcons.push(this.add.image(12 + i * 18, H - 12, "life").setScrollFactor(0).setDepth(300));
            }
            const bb = this.bossBar;
            bb.clear();
            if (this.boss && this.boss.hp > 0) {
                const w = 200, x = W / 2 - w / 2, y = 54;
                bb.fillStyle(0x303040, 1).fillRect(x, y, w, 6);
                bb.fillStyle(0xf85858, 1).fillRect(x, y, w * (this.boss.hp / this.boss.max), 6);
                bb.lineStyle(1, 0xf8f8f8, 1).strokeRect(x - 1, y - 1, w + 2, 8);
            }
        }
        /** 画面下に数秒だけ出す説明(ボスの戦い方など) */
        showHint(text, sec = 7) {
            if (!text) return;
            if (!this.hintText) {
                this.hintText = txt(this, W / 2, 66, "", 16, COL.white).setOrigin(0.5, 0).setScrollFactor(0).setDepth(318).setScale(0.72)
                    .setBackgroundColor("#000018").setPadding(8, 5, 8, 5);
                this.hintText.setWordWrapWidth((W - 30) / 0.72, true);
            }
            this.hintText.setText(text).setVisible(true).setAlpha(1);
            this.tweens.killTweensOf(this.hintText);
            this.tweens.add({ targets: this.hintText, alpha: 0, delay: sec * 1000, duration: 600, onComplete: () => this.hintText.setVisible(false) });
        }
        showBanner(main, sub = "", color = COL.yellow) {
            this.banner.setText(main).setColor(color).setVisible(true);
            this.subBanner.setText(sub).setVisible(!!sub);
        }
        hideBanner() {
            this.banner.setVisible(false);
            this.subBanner.setVisible(false);
        }
        popup(text, x, y, color = COL.yellow) {
            const t = txt(this, x, y, text, 16, color).setOrigin(0.5).setDepth(310).setScale(0.7);
            this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 750, onComplete: () => t.destroy() });
        }
        addScore(n, x, y) {
            this.score += n;
            if (x !== undefined) this.popup(String(n), x, y, COL.white);
            if (this.score >= this.nextExtend) {
                this.nextExtend += EXTEND_EVERY;
                this.lives++;
                sfx("perfect");
                this.popup("1UP!", this.p.x, this.p.y - 44, COL.green);
            }
        }

        // ---------- story / flow ----------
        startStory(lines, done, music = "story") {
            this.state = "story";
            this.hideBanner();
            ctx.advance = false;
            audio.playMusic(music);
            this.story.start(lines, done);
        }
        startIntro() {
            this.state = "intro";
            this.introT = 2.0;
            this.showBanner(tr("stage", this.stageIndex + 1), loc(this.stage.name), this.stage.color || COL.yellow);
            this.playStageMusic();
        }
        playStageMusic() {
            const music = this.stage.music || "stage";
            audio.playMusic(music, { transpose: [0, 2, 0, 3, 2][this.stageIndex] || 0 });
        }

        // ---------- 入力 ----------
        readInput() {
            const k = this.keys;
            const pad1 = this.input.gamepad?.pad1;
            let mx = (k.LEFT.isDown || k.A.isDown ? -1 : 0) + (k.RIGHT.isDown || k.D.isDown ? 1 : 0);
            let down = k.DOWN.isDown || k.S.isDown;
            let jump = k.SPACE.isDown || k.X.isDown;
            let up = k.UP.isDown || k.W.isDown;
            let attack = k.Z.isDown || k.C.isDown;
            if (pad1) {
                const ax = pad1.leftStick?.x || 0, ay = pad1.leftStick?.y || 0;
                if (Math.abs(ax) > 0.3) mx = sign(ax);
                if (ay > 0.5) down = true;
                if (ay < -0.5 || pad1.up) up = true;
                if (pad1.left) mx = -1;
                if (pad1.right) mx = 1;
                if (pad1.down) down = true;
                if (pad1.A) jump = true;
                if (pad1.X || pad1.B) attack = true;
            }
            const jumpPressed = (jump && !this._jumpWas) || !!ctx.jumpTap;
            const attackPressed = (attack && !this._attackWas) || !!ctx.attackTap;
            ctx.jumpTap = false;
            ctx.attackTap = false;
            this._jumpWas = jump;
            this._attackWas = attack;
            return { mx, down, up, jump, jumpPressed, attackPressed };
        }

        // ---------- カノンの物理 ----------
        stepPlayer(dt, inp) {
            const p = this.p;
            if (p.dead) return;
            const ice = p.grounded && p.kind === "ice";
            const grip = ice ? 0.16 : 1;
            const dir = inp.mx;
            const top = p.boots ? TOP_BOOTS : TOP;
            if (p.knock > 0) p.knock -= dt;
            const control = p.knock <= 0;

            if (p.grounded) {
                p.coyote = COYOTE;
                const downhill = p.k * sign(p.vx);
                // スライディング開始
                if (control && inp.down && !p.sliding && Math.abs(p.vx) > 70) { p.sliding = true; sfx("slide", { vol: 0.8 }); }
                if (p.sliding) {
                    p.vx += p.k * SLOPE_G * 1.8 * dt;
                    if (downhill <= 0) p.vx = approach(p.vx, 0, SLIDE_FRICTION * (ice ? 0.3 : 1) * dt);
                    p.vx = clamp(p.vx, -SLIDE_MAX, SLIDE_MAX);
                    if (Math.abs(p.vx) < 25 || (!inp.down && this.canStand(p))) {
                        p.sliding = false;
                        p.crouch = !this.canStand(p);
                    }
                } else if (control && (inp.down || !this.canStand(p))) {
                    // しゃがみ(天井が低いときはしゃがんだまま這う)
                    p.crouch = true;
                    if (!this.canStand(p) && dir) p.vx = approach(p.vx, dir * 70, 900 * dt);
                    else p.vx = approach(p.vx, 0, FRICTION * grip * dt);
                } else {
                    p.crouch = false;
                    const maxV = top * (1 + 0.45 * p.k * dir);
                    if (control && dir) {
                        if (sign(p.vx) === -dir && Math.abs(p.vx) > 8) p.vx += dir * TURN * grip * dt;
                        else if (Math.abs(p.vx) < maxV) p.vx = dir * Math.min(maxV, Math.abs(p.vx) + ACC * grip * (1 - 0.35 * Math.abs(p.vx) / maxV) * dt);
                        else p.vx = approach(p.vx, dir * maxV, OVER_DECAY * dt);
                    } else {
                        p.vx = approach(p.vx, 0, FRICTION * grip * dt);
                    }
                    if (p.k && (Math.abs(p.vx) > 5 || dir)) p.vx += p.k * SLOPE_G * dt;
                }
            } else {
                p.coyote -= dt;
                if (control && dir) {
                    const lim = Math.max(Math.abs(p.vx), top * 0.9);
                    p.vx = clamp(p.vx + dir * ACC * 0.9 * dt, -lim, lim);
                }
            }
            if (dir && control && !p.sliding) p.face = dir;
            else if (p.sliding && Math.abs(p.vx) > 5) p.face = sign(p.vx);

            // ジャンプ(下り抜け: 足場の上で ↓ + ジャンプ)
            if (p.jumpBuf > 0 && control) {
                if (p.grounded && inp.down && Math.abs(p.vx) < 70 && p.groundOneway) {
                    p.jumpBuf = 0;
                    p.dropT = 0.25;
                    p.grounded = false;
                    p.onPlat = null;
                    p.crouch = false;
                    p.y += 2;
                } else if ((p.grounded || p.coyote > 0) && (this.canStand(p) || !p.grounded)) {
                    p.jumpBuf = 0;
                    p.vy = -(JUMP_V + Math.abs(p.vx) * JUMP_SPEED_K) + Math.min(0, p.slopeVy) * 0.5;
                    p.grounded = false;
                    p.coyote = 0;
                    p.onPlat = null;
                    p.sliding = false;
                    p.crouch = false;
                    sfx("jump", { vol: 0.7 });
                }
            }
            p.jumpBuf -= dt;
            if (p.dropT > 0) p.dropT -= dt;

            // 動く足場に乗っていれば一緒に動く
            if (p.grounded && p.onPlat) { p.x += p.onPlat.dx; p.y += p.onPlat.dy; }

            // 横
            p.x += p.vx * dt;
            this.resolveWalls(p);

            // 縦
            const hgt = p.sliding || p.crouch ? LOW_H : HEIGHT;
            const oneway = p.dropT <= 0;
            if (p.grounded) {
                const snap = 4 + Math.abs(p.vx) * dt * 1.3 + (p.onPlat ? Math.abs(p.onPlat.dy) + 2 : 0);
                const f = this.footFloor(p.x, p.y - 10, p.y + snap, { oneway, prevFoot: p.y });
                if (f) this.land(p, f, false);
                else {
                    // 足元が無くなった: 上り坂の勢いがあれば上へ飛び出す(ジャンプ台)
                    p.grounded = false;
                    p.onPlat = null;
                    p.vy = Math.min(p.slopeVy, 60);
                    if (p.sliding && p.vy < -40) p.sliding = false;
                }
            } else {
                const g = p.vy < 0 && inp.jump ? GRAV_HELD : GRAV;
                p.vy = Math.min(MAX_FALL, p.vy + g * dt);
                const ny = p.y + p.vy * dt;
                if (p.vy >= 0) {
                    const f = this.footFloor(p.x, p.y - 1, ny + 0.01, { oneway, prevFoot: p.y });
                    if (f) this.land(p, f, true);
                    else p.y = ny;
                } else {
                    if (this.ceilingHit(p.x, ny - hgt)) {
                        const r = Math.floor((ny - hgt) / T);
                        p.y = (r + 1) * T + hgt + 0.01;
                        p.vy = 0;
                    } else p.y = ny;
                }
            }
            if (p.sliding || p.crouch) {
                // 低い姿勢から立てるか(天井)
                if (!p.sliding && !inp.down && this.canStand(p)) p.crouch = false;
            }
        }
        land(p, f, fromAir) {
            p.y = f.y;
            p.vy = 0;
            p.k = f.k || 0;
            p.slopeVy = p.vx * p.k;
            p.onPlat = f.plat || null;
            p.groundOneway = !!f.oneway;
            p.groundTile = f.plat ? null : f;
            const c = Math.floor(p.x / T);
            p.kind = this.kinds[clamp(c, 0, this.kinds.length - 1)] || "g";
            if (fromAir) {
                p.grounded = true;
                this.combo = 0;
                if (this.state !== "story") this.dust(p.x, p.y, 3);
            }
            p.grounded = true;
            // くずれる床
            if (f.ch === "c") this.touchCrumble(f.c, f.r);
            if (f.solid && !f.ch) { /* no-op */ }
        }
        resolveWalls(p) {
            const hgt = p.sliding || p.crouch ? LOW_H : HEIGHT;
            const ys = hgt > 20 ? [p.y - 10, p.y - hgt / 2 - 3, p.y - hgt + 2] : [p.y - 9, p.y - hgt + 2];
            for (const side of [1, -1]) {
                const sx = p.x + side * HW;
                if (ys.some((y) => this.solidAt(sx, y))) {
                    const c = Math.floor(sx / T);
                    p.x = side > 0 ? c * T - HW - 0.01 : (c + 1) * T + HW + 0.01;
                    if (sign(p.vx) === side) p.vx = 0;
                }
            }
            p.x = clamp(p.x, this.lockL + HW, this.lockR - HW);
        }
        touchCrumble(c, r) {
            const key = `${c},${r}`;
            if (!this.crumbles.has(key)) {
                this.crumbles.set(key, { c, r, t: 0.38, fallen: false, back: 0 });
                const tile = this.layer.getTileAt(c, r);
                if (tile) tile.tint = 0xffb0b0;
            }
        }
        updateCrumbles(dt) {
            for (const [key, cr] of this.crumbles) {
                if (!cr.fallen) {
                    cr.t -= dt;
                    if (cr.t <= 0) {
                        cr.fallen = true;
                        cr.back = 6;
                        this.grid[cr.r][cr.c] = ".";
                        this.layer.removeTileAt(cr.c, cr.r);
                        for (const ox of [-4, 4]) {
                            const d = this.add.image(cr.c * T + 8 + ox, cr.r * T + 6, "spark").setScale(2.6).setTint(this.theme.tile.crumble).setDepth(4);
                            this.debris.push({ img: d, vy: rand(-40, 0), vx: ox * 4, vr: rand(-3, 3) });
                        }
                        sfx("stomp", { vol: 0.35, rate: 0.6 });
                    }
                } else {
                    cr.back -= dt;
                    const p = this.p;
                    const over = Math.abs(p.x - (cr.c * T + 8)) < 14 && p.y > cr.r * T - 2 && p.y - HEIGHT < cr.r * T + T;
                    if (cr.back <= 0 && !over) {
                        this.grid[cr.r][cr.c] = "c";
                        this.layer.putTileAt(TILE.crumble, cr.c, cr.r);
                        this.crumbles.delete(key);
                    }
                }
            }
        }

        // ---------- 武器 ----------
        throwWeapon(inp = {}) {
            const p = this.p;
            const wd = WEAPONS[this.weapon];
            if (p.fireCd > 0 || this.shots.filter((s) => !s.dead).length >= wd.max) return;
            p.fireCd = wd.cd;
            p.throwT = 0.18;
            // 向き: ↑ を押していれば真上、空中で ↓ なら真下、それ以外は前
            const aim = inp.up && !p.sliding ? "up" : !p.grounded && inp.down ? "down" : "side";
            let x = p.x + p.face * 10, y = p.y - (p.sliding || p.crouch ? 8 : 19), vx, vy, angle = 0;
            if (aim === "side") { vx = p.face * wd.vx + p.vx * 0.3; vy = wd.vy || 0; }
            else if (aim === "up") { x = p.x; y = p.y - 30; vx = wd.grav ? p.face * 50 : p.vx * 0.2; vy = wd.grav ? -600 : -wd.vx; angle = -90; }
            else { x = p.x; y = p.y - 4; vx = p.vx * 0.2; vy = wd.grav ? 150 : wd.vx; angle = 90; }
            const s = {
                kind: this.weapon, aim, x, y, vx, vy, grav: wd.grav || 0,
                dist: 0, range: wd.range, dmg: wd.dmg, w: aim === "side" ? wd.w : wd.h, h: aim === "side" ? wd.h : wd.w, pierce: !!wd.pierce, hit: new Set(), dead: false,
                sprite: this.add.image(x, y, wd.tex).setDepth(9).setFlipX(aim === "side" && p.face < 0).setAngle(angle),
            };
            this.shots.push(s);
            sfx("throw", { vol: 0.8 });
        }
        updateShots(dt) {
            for (const s of this.shots) {
                if (s.dead) continue;
                s.vy += s.grav * dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.dist += Math.hypot(s.vx, s.vy) * dt;
                if (s.kind === "axe") s.sprite.angle += (s.vx >= 0 ? 720 : -720) * dt;
                if (s.dist > s.range || s.y > H + 20 || s.y < -20 || s.x < this.camX - 40 || s.x > this.camX + W + 40) { s.dead = true; continue; }
                if (this.solidAt(s.x, s.y)) { s.dead = true; this.sparkAt(s.x, s.y); sfx("clank", { vol: 0.5 }); continue; }
                const box = { x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h };
                for (const e of this.enemies) {
                    if (e.dead || !e.active || s.hit.has(e)) continue;
                    if (overlap(box, this.enemyBox(e))) {
                        s.hit.add(e);
                        this.damageEnemy(e, s.dmg);
                        if (!s.pierce) { s.dead = true; break; }
                    }
                }
                if (s.dead) continue;
                for (const ic of this.icicles) {
                    if (ic.state === "gone" || s.hit.has(ic)) continue;
                    if (overlap(box, { x: ic.x - 6, y: ic.y, w: 12, h: 16 })) { s.hit.add(ic); this.breakIcicle(ic); this.addScore(50); if (!s.pierce) s.dead = true; }
                }
                for (const b of this.boulders) {
                    if (b.dead || s.hit.has(b)) continue;
                    if (Math.hypot(b.x - s.x, b.y - s.y) < 14) { s.hit.add(b); this.sparkAt(s.x, s.y); sfx("clank", { vol: 0.5 }); if (!s.pierce) s.dead = true; }
                }
                const bs = this.boss;
                if (bs && !s.dead && bs.state !== "dying" && !s.hit.has(bs) && overlap(box, this.bossBox(bs))) {
                    s.hit.add(bs);
                    this.damageBoss(s.dmg);
                    if (!s.pierce) s.dead = true;
                }
            }
            this.shots = this.shots.filter((s) => { if (s.dead) s.sprite.destroy(); return !s.dead; });
        }

        // ---------- 敵 ----------
        enemyBox(e) { return { x: e.x - e.def.w / 2, y: e.y - e.def.h, w: e.def.w, h: e.def.h }; }
        damageEnemy(e, dmg) {
            e.hp -= dmg;
            e.hitT = 0.1;
            if (e.hp <= 0) this.killEnemy(e);
            else sfx("hit");
        }
        killEnemy(e, score = e.def.score) {
            if (e.dead) return;
            e.dead = true;
            this.explode(e.x, e.y - e.def.h / 2, 8);
            this.addScore(score, e.x, e.y - e.def.h - 4);
            audio.sfx("boom");
            // たまに果物を落とす
            if (Math.random() < 0.15 && this.state === "play") this.addItem("fruit", e.x, Math.min(e.y, (ROWS - 1) * T));
        }
        groundFollow(e, dt) {
            if (e.ground) {
                const f = this.findFloor(e.x, e.y - 10, e.y + 10 + Math.abs(e.vx) * dt, { prevFoot: e.y });
                if (f) { e.y = f.y; e.vy = 0; e.k = f.k; return true; }
                e.ground = false;
            }
            e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt);
            const ny = e.y + e.vy * dt;
            if (e.vy >= 0) {
                const f = this.findFloor(e.x, e.y - 1, ny, { prevFoot: e.y });
                if (f) { e.y = f.y; e.vy = 0; e.ground = true; e.k = f.k; return true; }
            }
            e.y = ny;
            return false;
        }
        walkerTurn(e) {
            const ahead = e.x + e.dir * (e.def.w / 2 + 2);
            const wall = this.solidAt(ahead, e.y - 8);
            const floor = this.findFloor(ahead, e.y - 12, e.y + 18, { prevFoot: e.y - 12 });
            if (wall || (!floor && e.ground)) e.dir = -e.dir;
        }
        updateEnemies(dt) {
            const p = this.p;
            for (const e of this.enemies) {
                if (e.dead) continue;
                if (!e.active) {
                    if (e.x < this.camX + W + 24 && e.x > this.camX - 40) e.active = true;
                    else continue;
                }
                e.t += dt;
                if (e.hitT > 0) e.hitT -= dt;
                const toP = p.x - e.x;
                switch (e.type) {
                    case "puru":
                        e.x += e.dir * 28 * dt;
                        if (this.groundFollow(e, dt)) this.walkerTurn(e);
                        break;
                    case "goblin": {
                        const sp = Math.abs(toP) < 170 ? 48 : 28;
                        if (Math.abs(toP) < 170 && e.ground && Math.abs(toP) > 8 && e.t > 0.6) { e.dir = sign(toP); e.t = 0; }
                        e.x += e.dir * sp * dt;
                        if (this.groundFollow(e, dt)) this.walkerTurn(e);
                        break;
                    }
                    case "hopper":
                        if (e.ground) {
                            if (e.t > 1.2) {
                                e.t = 0;
                                e.dir = sign(toP) || -1;
                                e.vx = e.dir * 90;
                                e.vy = -330;
                                e.ground = false;
                            } else e.vx = 0;
                        }
                        e.x += e.vx * dt;
                        if (this.solidAt(e.x + sign(e.vx) * 10, e.y - 6)) { e.x -= e.vx * dt; e.vx = 0; }
                        this.groundFollow(e, dt);
                        break;
                    case "bat":
                        if (e.state === "idle") {
                            if (Math.abs(toP) < 150) { e.state = "fly"; e.t = 0; e.dir = sign(toP) || -1; }
                        } else {
                            e.x += e.dir * 85 * dt;
                            e.baseY = lerp(e.baseY, p.y - 14, dt * 0.8);
                            e.y = e.baseY + Math.sin(e.t * 5) * 18;
                        }
                        e.sprite.setTexture(`${Math.floor(e.t * 8) % 2 ? "bat1" : "bat2"}_${this.theme.key}`);
                        break;
                    case "wisp":
                        e.x += (sign(toP) || -1) * 32 * dt;
                        e.y = e.baseY + Math.sin(e.t * 2.4) * 26;
                        break;
                    case "flower":
                        if (Math.abs(toP) < 280 && e.t > 2.4 / diff.shot) {
                            e.t = 0;
                            const ang = Math.atan2(p.y - 16 - (e.y - 22), toP);
                            this.fireEnemyShot(e.x, e.y - 22, Math.cos(ang) * 140, Math.sin(ang) * 140, "seed");
                        }
                        break;
                    default: break;
                }
                if (e.y > H + 40) { e.dead = true; continue; }
                if (e.x < this.camX - 160 && e.type !== "flower") { e.dead = true; continue; }
                this.contactEnemy(e);
            }
            this.enemies = this.enemies.filter((e) => { if (e.dead) e.sprite.destroy(); return !e.dead; });
        }
        contactEnemy(e) {
            const p = this.p;
            if (p.dead || e.dead) return;
            const pb = this.playerBox();
            const eb = this.enemyBox(e);
            if (!overlap(pb, eb)) return;
            // 踏みつけ
            if (e.def.stomp && p.vy > 40 && p.y - p.vy * STEP * 2 <= eb.y + 8) {
                this.combo++;
                this.killEnemy(e, e.def.score * Math.min(8, 2 ** (this.combo - 1)));
                p.vy = -STOMP_V;
                p.grounded = false;
                sfx("stomp");
                return;
            }
            // スライディングで小さな敵をはね飛ばす
            if (p.sliding && Math.abs(p.vx) > 110 && e.def.small) {
                this.killEnemy(e, e.def.score * 2);
                sfx("stomp", { rate: 1.3 });
                return;
            }
            this.hurtPlayer(sign(p.x - e.x));
        }
        fireEnemyShot(x, y, vx, vy, tex = "seed", opts = {}) {
            this.eshots.push({ x, y, vx, vy, r: opts.r || 5, grav: opts.grav || 0, life: opts.life || 6, sprite: this.add.image(x, y, tex).setDepth(9).setScale(opts.scale || 1).setTint(opts.tint ?? 0xffffff), ...opts });
        }
        updateEnemyShots(dt) {
            const p = this.p;
            const pb = this.playerBox();
            for (const s of this.eshots) {
                s.vy += (s.grav || 0) * dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.life -= dt;
                if (s.spin) s.sprite.angle += s.spin * dt;
                if (s.ground) {
                    // 地面を走る衝撃波
                    const f = this.findFloor(s.x, s.y - 12, s.y + 12);
                    if (f) s.y = f.y - 6; else s.life = 0;
                    if (this.solidAt(s.x + sign(s.vx) * 6, s.y - 2)) s.life = 0;
                }
                if (s.life <= 0 || s.y > H + 30 || s.x < this.camX - 60 || s.x > this.camX + W + 60) { s.dead = true; continue; }
                if (s.solidStop && (this.solidAt(s.x, s.y + s.r) || (s.vy > 0 && this.tileAt(Math.floor(s.x / T), Math.floor((s.y + s.r) / T)) === "-"))) { s.dead = true; this.explode(s.x, s.y, 5); sfx("clank", { vol: 0.3, rate: 0.7 }); continue; }
                if (!p.dead && overlap(pb, { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 })) {
                    s.dead = true;
                    this.hurtPlayer(sign(p.x - s.x));
                }
            }
            this.eshots = this.eshots.filter((s) => { if (s.dead) s.sprite.destroy(); return !s.dead; });
        }

        // ---------- しかけ ----------
        updatePlatforms(dt) {
            for (const pl of this.plats) {
                pl.t += dt;
                const omega = (pl.speed / Math.max(1, pl.range)) * Math.PI * 0.5;
                const off = (0.5 - 0.5 * Math.cos(pl.phase + pl.t * omega)) * pl.range;
                const nx = pl.ax === "x" ? pl.bx + off : pl.bx;
                const ny = pl.ax === "y" ? pl.by - off : pl.by;
                pl.dx = nx - pl.x;
                pl.dy = ny - pl.y;
                pl.x = nx;
                pl.y = ny;
            }
        }
        updateSprings(dt) {
            const p = this.p;
            for (const s of this.springs) {
                if (s.t > 0) { s.t -= dt; if (s.t <= 0) s.sprite.setTexture("spring1"); }
                if (p.dead || p.vy < 0) continue;
                const top = s.y - (s.t > 0 ? 12 : 18);
                if (Math.abs(p.x - s.x) < 14 && p.y >= top - 2 && p.y <= s.y + 2 && (p.vy > 0 || p.grounded)) {
                    p.y = top;
                    p.vy = -SPRING_V;
                    p.grounded = false;
                    p.onPlat = null;
                    p.sliding = false;
                    s.t = 0.25;
                    s.sprite.setTexture("spring2");
                    sfx("spring");
                    this.combo = 0;
                }
            }
        }
        updateFlags() {
            const p = this.p;
            for (const f of this.flags) {
                if (f.on || p.x < f.x - 4) continue;
                f.on = true;
                f.sprite.setTexture("flag_up");
                this.checkpoint = { x: f.x, y: f.y };
                audio.sfx("pass");
                this.popup(tr("checkpoint"), f.x, f.y - 50, COL.cyan);
            }
        }
        updateItems(dt) {
            const p = this.p;
            const pb = this.playerBox();
            for (const it of this.items) {
                it.t += dt;
                if (it.type === "heart") { it.y = it.baseY + Math.sin(it.t * 4) * 3; it.sprite.setScale(1.3 + Math.sin(it.t * 6) * 0.1); }
                else if (it.type !== "fruit" && it.type !== "meat") it.y = it.baseY + Math.sin(it.t * 3) * 2;
                it.sprite.setPosition(it.x, it.y);
                if (p.dead || it.dead) continue;
                if (overlap(pb, { x: it.x - 7, y: it.y - 7, w: 14, h: 14 })) this.takeItem(it);
            }
            this.items = this.items.filter((i) => { if (i.dead) i.sprite.destroy(); return !i.dead; });
        }
        takeItem(it) {
            const p = this.p;
            it.dead = true;
            switch (it.type) {
                case "fruit":
                    p.vita = Math.min(VITA_MAX, p.vita + 6);
                    this.addScore(100, it.x, it.y - 8);
                    audio.sfx("pass");
                    break;
                case "meat":
                    p.vita = VITA_MAX;
                    this.addScore(500, it.x, it.y - 8);
                    audio.sfx("item");
                    break;
                case "heart":
                    this.itemsGot++;
                    this.addScore(1000);
                    audio.sfx("item");
                    this.popup("♥", it.x, it.y - 10, COL.magenta);
                    if (this.itemsGot >= ITEMS_PER_STAGE) { this.popup("PERFECT!", p.x, p.y - 60, COL.magenta); sfx("perfect"); }
                    break;
                case "armor":
                    if (p.armor) this.addScore(1000, it.x, it.y - 8);
                    p.armor = true;
                    audio.sfx("perfect");
                    this.popup("ARMOR!", p.x, p.y - 48, COL.cyan);
                    break;
                case "boots":
                    p.boots = true;
                    audio.sfx("nitro");
                    this.popup("BOOTS!", p.x, p.y - 48, COL.cyan);
                    break;
                default:
                    if (WEAPONS[it.type]) {
                        this.weapon = it.type;
                        audio.sfx("item");
                        this.popup(it.type.toUpperCase(), p.x, p.y - 48, COL.yellow);
                    }
            }
            this.updateHud();
        }
        updateHazards(dt) {
            const p = this.p;
            const pb = this.playerBox();
            // とげと溶岩(タイル)
            if (!p.dead) {
                const c0 = Math.floor((p.x - HW + 1) / T), c1 = Math.floor((p.x + HW - 1) / T);
                const r0 = Math.floor((p.y - 6) / T), r1 = Math.floor((p.y - 1) / T);
                for (let c = c0; c <= c1; c++) {
                    for (let r = r0; r <= r1; r++) {
                        const ch = this.tileAt(c, r);
                        if (ch === "^" && p.y > r * T + 8) this.hurtPlayer(-p.face);
                        if ((ch === "~" && p.y > r * T + 6) || ch === "L") this.killPlayer("lava");
                    }
                }
                if (p.y > H + 30) this.killPlayer("pit");
            }
            // 溶岩から跳ねる火の玉
            for (const f of this.fires) {
                if (Math.abs(f.x - (this.camX + W / 2)) > W) { f.sprite.setVisible(false); continue; }
                if (!f.up) {
                    f.t -= dt;
                    f.sprite.setVisible(false);
                    if (f.t <= 0) { f.up = true; f.vy = -500; f.y = f.baseY; }
                } else {
                    f.vy += 900 * dt;
                    f.y += f.vy * dt;
                    f.sprite.setVisible(true).setPosition(f.x, f.y).setFlipY(f.vy > 0);
                    if (f.y > f.baseY) { f.up = false; f.t = rand(1.6, 2.6); }
                    if (!p.dead && overlap(pb, { x: f.x - 6, y: f.y - 6, w: 12, h: 12 })) this.hurtPlayer(sign(p.x - f.x));
                }
            }
            // つらら
            for (const ic of this.icicles) {
                if (ic.state === "hang") {
                    if (Math.abs(p.x - ic.x) < 30 && p.y > ic.y && !p.dead) { ic.state = "shake"; ic.t = 0.35; }
                } else if (ic.state === "shake") {
                    ic.t -= dt;
                    ic.sprite.x = ic.x + Math.sin(this.time0 * 80) * 1.5;
                    if (ic.t <= 0) { ic.state = "fall"; ic.sprite.x = ic.x; }
                } else if (ic.state === "fall") {
                    ic.vy = Math.min(MAX_FALL, ic.vy + 900 * dt);
                    ic.y += ic.vy * dt;
                    ic.sprite.y = ic.y;
                    if (!p.dead && overlap(pb, { x: ic.x - 5, y: ic.y, w: 10, h: 16 })) { this.hurtPlayer(sign(p.x - ic.x)); this.breakIcicle(ic); }
                    else if (this.solidAt(ic.x, ic.y + 16) || ic.y > H) this.breakIcicle(ic);
                }
            }
            // 転がる岩
            for (const s of this.spawners) {
                const near = p.x > s.x - 24 * T && p.x < s.x - 2 * T;
                s.t -= dt;
                if (near && s.t <= 0 && this.boulders.filter((b) => !b.dead).length < 3) {
                    s.t = 2.6;
                    this.boulders.push({ x: s.x, y: s.y - 13, vx: -50, vy: 0, ground: false, dead: false, sprite: this.add.image(s.x, s.y - 13, "boulder").setDepth(7) });
                }
            }
            for (const b of this.boulders) {
                if (b.dead) continue;
                const foot = b.y + 13;
                if (b.ground) {
                    const f = this.findFloor(b.x, foot - 10, foot + 6 + Math.abs(b.vx) * dt, { oneway: false });
                    if (f) { b.y = f.y - 13; b.vx += f.k * SLOPE_G * 1.3 * dt; b.vx = clamp(b.vx, -260, 260); if (!f.k) b.vx = approach(b.vx, -60, 30 * dt); }
                    else b.ground = false;
                } else {
                    b.vy = Math.min(MAX_FALL, b.vy + GRAV * dt);
                    const ny = b.y + b.vy * dt;
                    const f = this.findFloor(b.x, foot - 1, ny + 13, { oneway: false });
                    if (f) { b.y = f.y - 13; b.vy = 0; b.ground = true; this.cameras.main.shake(80, 0.004); sfx("thud", { vol: 0.4 }); } else b.y = ny;
                }
                b.x += b.vx * dt;
                if (this.solidAt(b.x + sign(b.vx) * 13, b.y)) b.vx = -b.vx * 0.5;
                b.sprite.setPosition(b.x, b.y).setAngle(b.sprite.angle + b.vx * dt * 4.4);
                if (b.y > H + 30 || b.x < this.camX - 80 || this.tileAt(Math.floor(b.x / T), Math.floor((b.y + 12) / T)) === "~") b.dead = true;
                if (!p.dead && overlap(pb, { x: b.x - 11, y: b.y - 11, w: 22, h: 22 })) this.hurtPlayer(sign(p.x - b.x) || 1);
            }
            this.boulders = this.boulders.filter((b) => { if (b.dead) b.sprite.destroy(); return !b.dead; });
        }
        breakIcicle(ic) {
            if (ic.state === "gone") return;
            ic.state = "gone";
            this.explode(ic.x, ic.y + 8, 6, [0xf8f8f8, 0x98d8f8]);
            ic.sprite.destroy();
            sfx("clank", { vol: 0.4, rate: 1.4 });
        }

        // ---------- ボス ----------
        bossBox(b) {
            const d = BOSS[b.type];
            const h = b.type === "knight" && b.state === "dash" ? 38 : d.h;
            return { x: b.x - d.w / 2, y: b.y - h - d.oy, w: d.w, h };
        }
        startBoss() {
            if (this.boss || !this.bossSpawn || !this.arena) return;
            this.state = "warning";
            this.warnT = 2.0;
            this.lockL = this.arena.start * T;
            this.lockR = (this.arena.end + 1) * T;
            this.checkpoint = { x: this.arena.start * T + 40, y: this.p.y };
            audio.stopMusic();
            audio.sfx("warning");
            this.showBanner(tr("warning"), loc(this.stage.boss?.name), COL.red);
        }
        spawnBoss() {
            const def = this.stage.boss || { type: "slime", hp: 14 };
            const type = BOSS[def.type] ? def.type : "slime";
            const hp = Math.round((def.hp || 14) * diff.bossHp);
            const d = BOSS[type];
            const s = this.bossSpawn;
            const b = {
                type, x: s.x, y: d.fly ? s.y - 60 : s.y, vx: 0, vy: 0, hp, max: hp, state: "idle", t: 0, act: 0, hitT: 0, flash: 0, dir: -1,
                ground: !d.fly, floorY: s.y, baseY: s.y - (type === "queen" ? 70 : 84), sprite: this.add.image(s.x, s.y, d.tex).setOrigin(0.5, 1).setDepth(7), alpha: 1,
            };
            this.boss = b;
            this.state = "boss";
            this.bossLabel.setText(loc(this.stage.boss?.name)).setVisible(true);
            audio.playMusic("boss");
            this.showHint(loc(this.stage.boss?.hint));
        }
        updateBoss(dt) {
            const b = this.boss;
            if (!b) return;
            const p = this.p;
            b.t += dt;
            b.act += dt;
            if (b.hitT > 0) b.hitT -= dt;
            if (b.flash > 0) b.flash -= dt;
            const L = this.lockL + 40, R = this.lockR - 40;
            const toP = p.x - b.x;
            const half = b.hp <= b.max / 2;
            if (b.state === "dying") {
                b.dieT -= dt;
                if (Math.random() < 0.35) this.explode(b.x + rand(-30, 30), b.y - rand(10, 60), 6);
                if (b.dieT <= 0) {
                    b.sprite.destroy();
                    this.boss = null;
                    this.bossLabel.setVisible(false);
                    this.stageClear();
                }
                this.drawBoss(b);
                return;
            }
            switch (b.type) {
                case "slime": {
                    // 最初はその場で粘液を撃つだけ(8 秒たつか、体力が 7 割を切ったら跳びはね始める)
                    if (!b.phase2 && (b.t > 8 || b.hp <= b.max * 0.7)) { b.phase2 = true; b.act = 0; b.warned = false; this.popup("!!", b.x, b.y - 70, COL.red); }
                    if (!b.phase2) {
                        b.dir = sign(toP) || -1;
                        const wait = 1.5 / diff.shot;
                        if (!b.warned && b.act > wait - 0.4) { b.warned = true; b.flash = 0.4; }
                        if (b.act > wait) {
                            b.act = 0;
                            b.warned = false;
                            b.volley = (b.volley || 0) + 1;
                            // 山なりの粘液: カノンの足元に 0.9 秒で落ちる。2 回に 1 回は 3 方向
                            const T_ = 0.9;
                            const sx = b.x + b.dir * 24, sy = b.y - 40;
                            const spread = b.volley % 2 === 0 ? [-55, 0, 55] : [0];
                            for (const off of spread) {
                                const tx = clamp(p.x + off, L - 30, R + 30);
                                const vx = (tx - sx) / T_;
                                const vy = (b.floorY - 6 - sy) / T_ - 0.5 * 800 * T_;
                                this.fireEnemyShot(sx, sy, vx, vy, "spark", { grav: 800, r: 6, scale: 4, tint: 0x58d8f8, life: 3, solidStop: true });
                            }
                            sfx("spring", { vol: 0.5, rate: 0.6 });
                        }
                        break;
                    }
                    if (b.ground) {
                        b.vx = 0;
                        const wait = half ? 0.9 : 1.2;
                        if (!b.warned && b.act > wait - 0.45) { b.warned = true; b.flash = 0.45; }
                        if (b.act > wait) {
                            b.act = 0;
                            b.warned = false;
                            b.vx = clamp(toP * 1.1, -170, 170);
                            b.vy = half && Math.random() < 0.4 ? -620 : -470;
                            b.ground = false;
                            // 着地点の影(足場にぶつかる・乗る動きも同じ計算で先に求める)
                            const land = this.predictSlimeLanding(b, L, R);
                            this.mark("shadow", land.x, land.y, land.t, { w: 70 });
                        }
                    } else {
                        const land = this.slimeAirStep(b, dt, L, R);
                        if (land) {
                            b.y = land.y;
                            b.ground = true;
                            b.vy = 0;
                            this.cameras.main.shake(160, 0.01);
                            sfx("thud");
                            for (const dir of [-1, 1]) this.fireEnemyShot(b.x + dir * 30, b.y - 6, dir * 170, 0, "spark", { r: 6, ground: true, scale: 3, tint: 0x88e8f8, life: 3 });
                            if (half && Math.random() < 0.5 && this.enemies.length < 4) this.addEnemy("puru", b.x + rand(-20, 20), b.y, { active: true });
                        }
                    }
                    break;
                }
                case "hornet": {
                    if (b.state === "idle") {
                        b.x = lerp(b.x, (L + R) / 2 + Math.sin(b.t * 0.9) * (R - L) * 0.42, dt * 2);
                        b.y = lerp(b.y, b.baseY + Math.sin(b.t * 2.3) * 16, dt * 3);
                        b.dir = sign(toP) || -1;
                        if (b.act > 2.0 / diff.shot) {
                            b.act = 0;
                            this.fireEnemyShot(b.x, b.y - 20, toP * 0.6, 240, "seed", { tint: 0xf8f8f8, r: 4 });
                            if (half) { this.fireEnemyShot(b.x, b.y - 20, toP * 0.6 - 60, 240, "seed", { r: 4 }); this.fireEnemyShot(b.x, b.y - 20, toP * 0.6 + 60, 240, "seed", { r: 4 }); }
                            b.shots = (b.shots || 0) + 1;
                            if (b.shots >= 3) { b.shots = 0; b.state = "aim"; b.t2 = 0.9; b.flash = 0.9; this.bang(b, 0.9); this.mark("target", p.x, p.y, 0.9, { follow: p }); }
                        }
                    } else if (b.state === "aim") {
                        b.t2 -= dt;
                        if (b.t2 <= 0) { b.state = "dive"; b.tx = p.x; b.ty = p.y - 8; b.sx = b.x; b.sy = b.y; b.dt = 0; this.mark("target", b.tx, b.ty, 0.7); }
                    } else if (b.state === "dive") {
                        b.dt += dt / 0.7;
                        const u = Math.min(1, b.dt);
                        b.x = lerp(b.sx, b.tx, u);
                        b.y = lerp(b.sy, b.ty, u);
                        if (u >= 1) { b.state = "rise"; b.dt = 0; }
                    } else if (b.state === "rise") {
                        b.y = lerp(b.y, b.baseY, dt * 2.5);
                        if (Math.abs(b.y - b.baseY) < 6) { b.state = "idle"; b.act = 0; }
                    }
                    break;
                }
                case "golem": {
                    b.dir = sign(toP) || -1;
                    if (b.state !== "windup") b.x = clamp(b.x + b.dir * (half ? 42 : 30) * dt, L, R);
                    if (b.state === "idle" && b.act > 2.6 / diff.shot - 0.5) { b.state = "windup"; b.flash = 0.5; this.bang(b, 0.5); }
                    if (b.state === "windup" && b.act > 2.6 / diff.shot) {
                        b.act = 0;
                        b.state = "idle";
                        // 岩を山なりに投げる
                        const T_ = 1.1;
                        const vx = (p.x - b.x) / T_;
                        const vy = ((p.y - 10) - (b.y - 70)) / T_ - 0.5 * 900 * T_;
                        this.fireEnemyShot(b.x, b.y - 70, vx, vy, "boulder", { grav: 900, r: 9, scale: 0.7, spin: 400, life: 3, solidStop: true });
                        b.throws = (b.throws || 0) + 1;
                        if (b.throws % 3 === 0) {
                            // 足踏み: 天井から岩が降る
                            this.cameras.main.shake(300, 0.012);
                            sfx("thud");
                            const n = half ? 5 : 3;
                            for (let i = 0; i < n; i++) {
                                const rx = i === 0 ? clamp(p.x, L, R) : rand(L, R);
                                this.mark("shadow", rx, b.floorY, 0.8 + i * 0.25, { w: 30, onEnd: () => { if (this.boss) this.fireEnemyShot(rx, 40, 0, 260, "boulder", { grav: 700, r: 9, scale: 0.7, spin: 300, life: 3, solidStop: true }); } });
                            }
                        }
                    }
                    break;
                }
                case "knight": {
                    if (b.state === "idle") {
                        b.dir = sign(toP) || -1;
                        b.x = clamp(b.x + b.dir * 36 * dt, L, R);
                        if (b.act > 1.6 / diff.shot) {
                            b.act = 0;
                            b.mode = (b.mode || 0) + 1;
                            if (b.mode % 3 === 0) { b.state = "prep"; b.t2 = 0.9; b.flash = 0.9; this.bang(b, 0.9); }
                            else {
                                const n = half ? 5 : 3;
                                for (let i = 0; i < n; i++) {
                                    const ang = Math.atan2(-0.15 - (i - (n - 1) / 2) * 0.22, b.dir);
                                    this.fireEnemyShot(b.x + b.dir * 20, b.y - 46, Math.cos(ang) * 190, Math.sin(ang) * 190, "spark", { r: 5, scale: 3, tint: 0x98e8f8 });
                                }
                                sfx("throw");
                            }
                        }
                    } else if (b.state === "prep") {
                        b.t2 -= dt;
                        if (b.t2 <= 0) { b.state = "dash"; b.vx = b.dir * (half ? 300 : 250); sfx("slide"); }
                    } else if (b.state === "dash") {
                        b.x += b.vx * dt;
                        if (b.x <= L || b.x >= R) { b.x = clamp(b.x, L, R); b.state = "idle"; b.act = 0; this.cameras.main.shake(160, 0.01); sfx("thud"); }
                    }
                    break;
                }
                case "queen": {
                    if (b.state === "idle") {
                        b.y = lerp(b.y, b.baseY + Math.sin(b.t * 1.7) * 20, dt * 2);
                        b.dir = sign(toP) || -1;
                        if (!b.warned && b.act > 1.7 / diff.shot - 0.4) { b.warned = true; b.flash = 0.4; }
                        if (b.act > 1.7 / diff.shot) {
                            b.act = 0;
                            b.warned = false;
                            b.cnt = (b.cnt || 0) + 1;
                            const n = half ? 7 : 5;
                            const base = Math.atan2(p.y - 16 - (b.y - 40), toP);
                            for (let i = 0; i < n; i++) {
                                const a = base + (i - (n - 1) / 2) * 0.28;
                                this.fireEnemyShot(b.x, b.y - 40, Math.cos(a) * 130, Math.sin(a) * 130, "fireball", { r: 5, tint: 0xf878f8 });
                            }
                            audio.sfx("shoot");
                            if (b.cnt % 2 === 0) { b.state = "vanish"; b.t2 = 0; }
                            if (b.cnt % 4 === 0 && this.enemies.length < 4) {
                                for (const dx of [-60, 60]) this.addEnemy("bat", clamp(b.x + dx, L, R), b.y - 30, { active: true, state: "fly", dir: sign(toP) || -1, baseY: b.y - 30 });
                            }
                        }
                    } else if (b.state === "vanish") {
                        b.t2 += dt;
                        b.alpha = Math.max(0, 1 - b.t2 / 0.5);
                        if (b.t2 >= 0.5) {
                            b.x = clamp(p.x + pick([-1, 1]) * rand(90, 160), L, R);
                            b.baseY = b.floorY - rand(44, 96);
                            this.mark("target", b.x, b.baseY - 30, 0.9);
                            b.y = b.baseY;
                            b.state = "appear";
                            b.t2 = 0;
                        }
                    } else if (b.state === "appear") {
                        b.t2 += dt;
                        b.alpha = Math.min(1, b.t2 / 0.4);
                        if (b.t2 >= 0.4) { b.state = "idle"; b.act = 0.4; }
                    }
                    break;
                }
                default: break;
            }
            // 体当たり(消えている間は当たらない)
            if (!p.dead && b.alpha > 0.5 && overlap(this.playerBox(), this.bossBox(b))) {
                if (b.type === "slime" && p.vy > 60 && p.y - p.vy * STEP * 2 <= this.bossBox(b).y + 10) {
                    this.damageBoss(2);
                    p.vy = -STOMP_V * 1.2;
                    p.grounded = false;
                    sfx("stomp");
                } else this.hurtPlayer(sign(p.x - b.x) || 1);
            }
            this.drawBoss(b);
        }
        /**
         * キングぷるぷるの空中の動き(1コマ分)。足場や段差はすり抜けない:
         * 上昇中に頭が足場・ブロックに当たると落ち始め、落下中は地面にも足場にも着地する。
         * st = { x, y, vx, vy } を書き換え、着地したらその床を返す
         */
        slimeAirStep(st, dt, L, R) {
            const d = BOSS.slime;
            const prevY = st.y;
            st.vy += GRAV * 0.9 * dt;
            let ny = st.y + st.vy * dt;
            const nx = clamp(st.x + st.vx * dt, L, R);
            const xs = [nx - d.w / 2 + 1, nx - d.w / 4, nx, nx + d.w / 4, nx + d.w / 2 - 1]; // 体の幅いっぱい
            const blocks = (x, y) => { const ch = this.tileAt(Math.floor(x / T), Math.floor(y / T)); return SOLID.has(ch) || ch === "-"; };
            if (st.vy < 0) {
                const top = ny - d.h - d.oy;
                if (xs.some((x) => blocks(x, top))) {
                    ny = (Math.floor(top / T) + 1) * T + d.h + d.oy;
                    st.vy = 0;
                }
            }
            // 横: 体の高さのどこかがブロックに当たるなら横には進まない
            const side = nx + sign(st.vx) * (d.w / 2);
            let wall = false; // 足場も横から入れない(下に潜り込まない)。16px の足場をすり抜けないよう体の高さを 8px 刻みで見る
            if (st.vx) for (let y = ny - 2; y >= ny - d.h - d.oy && !wall; y -= 8) wall = blocks(side, y);
            if (wall) st.vx = 0; else st.x = nx;
            let land = null;
            if (st.vy >= 0) {
                for (const x of [st.x - d.w / 2 + 4, st.x, st.x + d.w / 2 - 4]) {
                    const f = this.findFloor(x, prevY - 1, ny + 0.01, { prevFoot: prevY, plats: false });
                    if (f && (!land || f.y < land.y)) land = f;
                }
            }
            st.y = land ? land.y : ny;
            return land;
        }
        /** ジャンプした瞬間に着地点を求める(影を出すため) */
        predictSlimeLanding(b, L, R) {
            const st = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
            const dt = 1 / 60;
            for (let t = dt; t < 4; t += dt) {
                const f = this.slimeAirStep(st, dt, L, R);
                if (f) return { x: st.x, y: f.y, t };
            }
            return { x: st.x, y: b.floorY, t: 1 };
        }
        /** 予告マークを出す。dur 秒後に onEnd を呼ぶ */
        mark(kind, x, y, dur, opts = {}) {
            const m = { kind, x, y, t: 0, dur, w: opts.w || 40, follow: opts.follow || null, onEnd: opts.onEnd || null };
            this.marks.push(m);
            return m;
        }
        /** ボスの頭の上に「!」 */
        bang(b, dur) {
            this.mark("bang", b.x, b.y, dur, { follow: b });
            audio.sfx("charge");
        }
        updateMarks(dt) {
            const list = this.marks;
            for (const m of list) {
                m.t += dt;
                if (m.t >= m.dur && !m.done) { m.done = true; m.onEnd?.(); }
            }
            this.marks = this.marks.filter((m) => !m.done);
        }
        drawMarks() {
            const g = this.markG;
            g.clear();
            const blink = Math.floor(this.time0 * 12) % 2 === 0;
            for (const m of this.marks) {
                const u = clamp(m.t / m.dur, 0, 1);
                if (m.kind === "shadow") {
                    // 落ちてくる場所: だんだん濃く大きくなる影
                    g.fillStyle(0x000000, 0.25 + 0.35 * u).fillEllipse(m.x, m.y - 2, m.w * (0.5 + 0.5 * u), 8);
                    g.lineStyle(1, 0xf85858, blink ? 0.9 : 0.4).strokeEllipse(m.x, m.y - 2, m.w, 10);
                } else if (m.kind === "target") {
                    if (m.follow) { m.x = m.follow.x; m.y = m.follow.y - 14; }
                    const x = m.x, y = m.y;
                    const r = 18 - 8 * u;
                    g.lineStyle(2, 0xf85858, blink ? 1 : 0.5).strokeCircle(x, y, r);
                    g.lineBetween(x - r - 5, y, x - r + 3, y).lineBetween(x + r - 3, y, x + r + 5, y).lineBetween(x, y - r - 5, x, y - r + 3).lineBetween(x, y + r - 3, x, y + r + 5);
                } else if (m.kind === "bang") {
                    const b = m.follow;
                    if (!b || !this.boss) continue;
                    const box = this.bossBox(b);
                    const x = b.x, y = box.y - 14 + Math.sin(this.time0 * 20) * 2;
                    g.fillStyle(0xf85858, 1).fillRect(x - 4, y - 14, 8, 11).fillRect(x - 4, y, 8, 5);
                    g.fillStyle(blink ? 0xf8f8f8 : 0xf8f048, 1).fillRect(x - 2, y - 12, 4, 7).fillRect(x - 2, y + 1, 4, 3);
                }
            }
        }
        drawBoss(b) {
            const d = BOSS[b.type];
            const squash = b.type === "slime" && b.ground ? 1 + Math.max(0, 0.15 - b.act) : 1;
            // 突進中の騎士は低く構える(当たり判定と同じ高さに縮めて、跳び越えられると分かるように)
            const dash = b.type === "knight" && b.state === "dash";
            b.sprite.setPosition(b.x, b.y).setFlipX(b.dir > 0).setScale(dash ? 1.2 : squash, dash ? 0.55 : 2 - squash).setAlpha(b.alpha ?? 1).setAngle(dash ? 10 * b.dir : 0);
            if (b.flash > 0 && Math.floor(b.flash * 20) % 2 === 0) b.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
            else if (b.hitT > 0) b.sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xff9090);
            else b.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
        }
        damageBoss(dmg) {
            const b = this.boss;
            if (!b || b.state === "dying" || (b.alpha ?? 1) < 0.5) return;
            b.hp -= dmg;
            b.hitT = 0.08;
            this.score += 10 * dmg;
            audio.sfx("hit");
            if (b.hp <= 0) {
                b.state = "dying";
                b.dieT = 2.0;
                b.alpha = 1;
                this.addScore(5000 * (this.stageIndex + 1));
                audio.sfx("bossDown");
                this.eshots.forEach((s) => s.sprite.destroy());
                this.eshots = [];
                this.marks = [];
                this.enemies.forEach((e) => { if (!e.dead) this.killEnemy(e, 0); });
            }
        }

        // ---------- カノンの被弾・ミス ----------
        playerBox() {
            const p = this.p;
            const h = p.sliding || p.crouch ? LOW_H : HEIGHT;
            return { x: p.x - HW, y: p.y - h, w: HW * 2, h };
        }
        hurtPlayer(fromDir = -1) {
            const p = this.p;
            if (p.invuln > 0 || p.dead || ctx.invincible || this.state === "stageclear") return;
            if (p.boots) {
                p.boots = false;
                p.invuln = 1.2;
                sfx("clank");
                this.popup("BOOTS LOST", p.x, p.y - 44, COL.gray);
                this.knockback(fromDir, 0.6);
                this.updateHud();
                return;
            }
            if (p.armor) {
                p.armor = false;
                p.invuln = 1.7;
                sfx("armor");
                // 鎧のかけらが飛び散る
                for (let i = 0; i < 6; i++) {
                    const d = this.add.image(p.x, p.y - 18, "spark").setTint(pick([0xd8e0f0, 0x8890b8, 0xf8d048])).setScale(2.5).setDepth(10);
                    this.debris.push({ img: d, vy: rand(-320, -160), vx: rand(-120, 120), vr: rand(-8, 8) });
                }
                this.knockback(fromDir, 1);
                this.updateHud();
                return;
            }
            this.killPlayer("hit");
        }
        knockback(fromDir, power) {
            const p = this.p;
            p.vx = (fromDir || -p.face) * 140 * power;
            p.vy = -230 * power;
            p.grounded = false;
            p.onPlat = null;
            p.sliding = false;
            p.knock = 0.35;
            this.cameras.main.shake(140, 0.008);
        }
        killPlayer(reason) {
            const p = this.p;
            if (p.dead || (ctx.invincible && reason !== "pit")) {
                if (ctx.invincible && reason === "pit" && !p.dead) { p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.vy = 0; }
                return;
            }
            p.dead = true;
            p.deadT = 0;
            p.reason = reason;
            p.vx = 0;
            p.vy = reason === "pit" ? 0 : -360;
            this.lives--;
            audio.stopMusic();
            audio.sfx("playerDown");
            this.cameras.main.shake(220, 0.01);
            this.updateHud();
            this.time.delayedCall(1800, () => {
                if (this.lives <= 0) this.continueMenu();
                else this.respawn();
            });
        }
        respawn() {
            const p = this.p;
            const cp = this.checkpoint;
            Object.assign(p, {
                x: cp.x, y: cp.y - 2, vx: 0, vy: 0, grounded: false, sliding: false, crouch: false, dead: false, invuln: 2,
                armor: true, boots: false, vita: VITA_MAX, onPlat: null, knock: 0, k: 0, slopeVy: 0,
            });
            this.eshots.forEach((s) => s.sprite.destroy());
            this.eshots = [];
            this.boulders.forEach((b) => b.sprite.destroy());
            this.boulders = [];
            this.marks = [];
            // ボス戦でミスしたら、ボスは体力満タンからやり直し
            if (this.boss || this.state === "boss" || this.state === "warning") {
                if (this.boss) this.boss.sprite.destroy();
                this.boss = null;
                this.bossLabel.setVisible(false);
                this.enemies.forEach((e) => e.sprite.destroy());
                this.enemies = [];
                this.state = "play";
                this.lockL = 0;
                this.lockR = this.worldW;
                this.bossStarted = false;
                this.hideBanner();
            }
            this.camX = clamp(cp.x - W * 0.4, this.lockL, this.lockR - W);
            this.playStageMusic();
            this.updateHud();
        }

        // ---------- 結果 ----------
        perfect() { return this.itemsGot >= ITEMS_PER_STAGE; }
        buildRewards(scene, stage, character = prompts.character) {
            const out = [];
            const add = (text, source) => { if (text) out.push({ type: "prompt", text, weight: 1, source }); };
            add(prompts.style, "style");
            add(character, "character");
            add(scene, "scene");
            if (stage) add(stage.clear_prompt, "clear");
            return out;
        }
        result(kind) {
            if (this.score >= ctx.hiScore) saveHiScore(ctx.hiScore);
            const cleared = kind !== "gameover";
            const bonus = kind === "stage" && this.perfect() && !!this.stage.private_prompt;
            const rewards = bonus ? this.buildRewards(this.stage.private_prompt, null, prompts.character_private || prompts.character)
                : kind === "stage" ? this.buildRewards(this.stage.scene_prompt, this.stage)
                : kind === "ending" ? this.buildRewards(prompts.ending, stages[stages.length - 1])
                : this.buildRewards(prompts.gameover, this.stage);
            const negative = [prompts.negative, kind === "gameover" ? prompts.gameover_negative : "", bonus ? prompts.private_negative : ""].filter(Boolean).join(", ");
            return {
                gameId: GAME_ID, kind, cleared, score: this.score, bonus,
                items: this.itemsGot, itemsTotal: ITEMS_PER_STAGE,
                stage: this.stageIndex + 1, stagesTotal: stages.length, stageName: loc(this.stage.name),
                negative, rewards,
            };
        }
        stageClear() {
            this.state = "stageclear";
            audio.playMusic("clear");
            // ボーナス: 残りの VITA と速さ(タイム)
            const vitaBonus = Math.round(this.p.vita) * 100;
            const par = (this.L.width * T) / 90;
            const timeBonus = Math.max(0, Math.round(par - this.stageTime)) * 100;
            this.addScore(vitaBonus + timeBonus);
            try { host.stageClear?.(this.result("stage")); } catch (e) { console.error("[knight] host.stageClear failed", e); }
            const last = this.stageIndex >= stages.length - 1;
            const perfect = this.perfect();
            const bonusLine = `${tr("vitaBonus")} ${vitaBonus}\n${tr("timeBonus")} ${timeBonus}`;
            if (perfect) { sfx("perfect"); this.showBanner(tr("perfect"), `${tr("privatePhoto")}\n\n${bonusLine}`); }
            else this.showBanner(tr("stageClear"), `${this.stage.clear_prompt ? `"${this.stage.clear_prompt}"\n\n` : ""}${bonusLine}`);
            this.updateHud();
            this.time.delayedCall(3000, () => {
                this.hideBanner();
                const proceed = () => {
                    if (last) this.allClear();
                    else this.scene.restart({ stageIndex: this.stageIndex + 1, score: this.score, lives: this.lives, weapon: this.weapon, nextExtend: this.nextExtend });
                };
                const after = [...(perfect ? prompts.private_story || [] : []), ...(this.stage.story_after || [])];
                if (after.length && !ctx.skipStory) this.startStory(after, proceed);
                else proceed();
            });
        }
        allClear() {
            this.state = "done";
            this.doneAt = performance.now();
            audio.playMusic("title");
            this.showBanner(tr("allClear"), `SCORE ${pad(this.score)}\n\n${tr("again")}`);
            ctx.advance = false;
            finish(this.result("ending"));
        }
        /** このステージを最初からやり直す(スコアと武器はステージ開始時に戻す) */
        retryStage(lives) {
            if (this.paused) { this.paused = false; this.time.paused = false; this.tweens.resumeAll(); }
            ctx.advance = false;
            ctx.menuMove = 0;
            audio.setPaused(ctx.externalPause);
            this.scene.restart({ stageIndex: this.stageIndex, lives, retry: true, ...this.startState });
        }
        /** 残りが無くなったとき: 「このステージからやり直す」か「あきらめる」を選ぶ */
        continueMenu() {
            this.state = "continue";
            audio.playMusic("gameover");
            this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(315).setScrollFactor(0);
            this.showBanner(tr("gameOver"), "", COL.red);
            this.menuSel = 0;
            this.menuItems = [tr("retryStage", this.stageIndex + 1), tr("giveUp")].map((label, i) =>
                txt(this, W / 2, 150 + i * 30, label, 16, COL.white).setOrigin(0.5).setDepth(330).setScrollFactor(0));
            this.menuHelp = txt(this, W / 2, 222, tr("continueHelp"), 16, COL.gray).setOrigin(0.5).setScale(0.75).setDepth(330).setScrollFactor(0);
            this.menuAt = performance.now();
            ctx.advance = false;
            ctx.menuMove = 0;
            this.drawMenu();
        }
        drawMenu() {
            this.menuItems.forEach((t, i) => {
                const on = i === this.menuSel;
                t.setColor(on ? COL.yellow : COL.gray).setText(`${on ? "▶ " : "  "}${t.text.replace(/^(▶ | {2})/, "")}`);
            });
        }
        updateContinue() {
            if (ctx.menuMove) {
                this.menuSel = (this.menuSel + ctx.menuMove + this.menuItems.length) % this.menuItems.length;
                ctx.menuMove = 0;
                audio.sfx("text");
                this.drawMenu();
            }
            if (ctx.advance) {
                ctx.advance = false;
                if (performance.now() - this.menuAt < 600) return; // 連打で選んでしまわないように
                const items = [...this.menuItems, this.menuHelp];
                items.forEach((t) => t.destroy());
                if (this.menuSel === 0) { audio.sfx("start"); this.retryStage(diff.lives); }
                else { this.hideBanner(); this.gameOver(); }
            }
        }
        gameOver(lines = prompts.gameover_story || []) {
            finish(this.result("gameover"));
            this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(315).setScrollFactor(0);
            const showOver = () => {
                this.state = "done";
                this.doneAt = performance.now();
                this.showBanner(tr("gameOver"), `SCORE ${pad(this.score)}\n\n${tr("again")}`, COL.red);
                ctx.advance = false;
            };
            if (lines.length && !ctx.skipStory) this.startStory(lines, showOver, "gameover");
            else { audio.playMusic("gameover"); showOver(); }
        }

        // ---------- 演出 ----------
        explode(x, y, n = 8, cols = [0xf8f048, 0xf89838, 0xf8f8f8, 0xf85858]) {
            for (let i = 0; i < n; i++) {
                const s = this.add.image(x, y, "spark").setDepth(10).setTint(pick(cols)).setScale(1.5);
                const a = Math.random() * Math.PI * 2;
                const d = rand(10, 28);
                this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: rand(250, 500), onComplete: () => s.destroy() });
            }
        }
        sparkAt(x, y) { this.explode(x, y, 4, [0xf8f8f8, 0xf8f048]); }
        dust(x, y, n = 2) {
            for (let i = 0; i < n; i++) {
                const s = this.add.image(x + rand(-6, 6), y - 2, "spark").setDepth(9).setTint(0xe8e0d0).setAlpha(0.8).setScale(rand(1, 2));
                this.tweens.add({ targets: s, x: s.x - sign(this.p.vx) * rand(6, 16), y: s.y - rand(3, 10), alpha: 0, duration: rand(250, 420), onComplete: () => s.destroy() });
            }
        }
        afterimage() {
            const p = this.player;
            const g = this.add.image(p.x, p.y, p.texture.key).setOrigin(0.5, 1).setFlipX(p.flipX).setDepth(7.5).setAlpha(0.45).setTint(this.p.boots ? 0x58e8f8 : 0xf878f8);
            this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
        }

        // ---------- 毎フレーム ----------
        updateCamera(dt) {
            const p = this.p;
            const lead = clamp(p.vx * 0.5, -100, 100);
            const target = clamp(p.x - W * 0.42 + lead, this.lockL, this.lockR - W);
            this.camX = lerp(this.camX, target, Math.min(1, dt * 5));
            this.camX = clamp(this.camX, this.lockL, this.lockR - W);
            this.cameras.main.setScroll(Math.round(this.camX), 0);
        }
        renderAll(dt) {
            const p = this.p;
            // カノンの絵
            const pre = p.armor ? "kanon_a_" : "kanon_l_";
            let frame = "stand";
            let angle = 0;
            if (p.dead) frame = "hurt";
            else if (p.knock > 0) frame = "hurt";
            else if (p.sliding) frame = "slide";
            else if (p.crouch) frame = "crouch";
            else if (!p.grounded) frame = p.throwT > 0 ? "throwAir" : "jump";
            else if (p.throwT > 0) frame = "throw";
            else if (Math.abs(p.vx) > 12) {
                p.frame = (p.frame + dt * (6 + Math.abs(p.vx) / 18)) % 4;
                frame = ["run1", "run2", "run3", "run2"][Math.floor(p.frame)];
                if (p.k) angle = p.k * 10 * (p.face > 0 ? 1 : 1);
            }
            if (p.dead) angle = p.deadT * 540 * -p.face;
            const blink = p.invuln > 0 && !p.dead && Math.floor(p.invuln * 14) % 2 === 0;
            this.player.setTexture(pre + frame).setPosition(Math.round(p.x), Math.round(p.y)).setFlipX(p.face < 0).setAngle(angle).setVisible(!blink && (!p.dead || p.reason !== "pit"));
            // ブーツの光
            const bf = this.bootsFx;
            bf.clear();
            if (p.boots && !p.dead) {
                const a = 0.4 + 0.3 * Math.sin(this.time0 * 12);
                bf.fillStyle(0x58e8f8, a).fillEllipse(p.x, p.y - 2, 18, 5);
            }
            // 物の位置
            for (const e of this.enemies) {
                const flip = e.type === "flower" ? this.p.x > e.x : e.type === "bat" ? false : (e.vx || e.dir) > 0;
                e.sprite.setPosition(Math.round(e.x), Math.round(e.y)).setFlipX(flip);
                if (e.type === "puru") e.sprite.setScale(1 + Math.sin(e.t * 8) * 0.06, 1 - Math.sin(e.t * 8) * 0.06);
                if (e.hitT > 0) e.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
                else e.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
            }
            for (const pl of this.plats) pl.g.setPosition(Math.round(pl.x), Math.round(pl.y));
            this.drawMarks();
            for (const s of this.shots) s.sprite.setPosition(s.x, s.y);
            for (const s of this.eshots) s.sprite.setPosition(s.x, s.y);
            for (const d of this.debris) {
                d.vy += GRAV * 0.8 * dt;
                d.img.x += (d.vx || 0) * dt;
                d.img.y += d.vy * dt;
                d.img.angle += d.vr * 60 * dt;
                if (d.img.y > H + 40) { d.img.destroy(); d.gone = true; }
            }
            this.debris = this.debris.filter((d) => !d.gone);
            updateBackdrop(this.bd, this.camX, dt);
        }

        update(_t, delta) {
            const dt = Math.min(0.05, delta / 1000);
            if (this.state === "done") {
                if (ctx.advance) { ctx.advance = false; if (performance.now() - this.doneAt > 1500) restart(); }
                return;
            }
            if (this.state === "continue") { this.updateContinue(); return; }
            if (ctx.pauseToggle) {
                ctx.pauseToggle = false;
                if (["play", "boss", "warning", "intro"].includes(this.state)) this.paused = !this.paused;
            }
            const shouldPause = this.paused || ctx.externalPause;
            if (shouldPause !== this._wasPaused) {
                this._wasPaused = shouldPause;
                this.pauseText.setVisible(shouldPause);
                this.pauseHelp.setVisible(shouldPause && this.paused && this.lives > 1);
                this.time.paused = shouldPause;
                if (shouldPause) this.tweens.pauseAll(); else this.tweens.resumeAll();
                syncAudioPause();
            }
            if (shouldPause) {
                // 一時停止中の R: このステージを最初から(残りを 1 つ使う)
                if (ctx.retryTap && this.paused && this.lives > 1) { ctx.retryTap = false; this.retryStage(this.lives - 1); }
                ctx.retryTap = false;
                return;
            }
            ctx.retryTap = false;
            this.time0 += dt;

            if (this.state === "story") {
                this.story.update(dt, ctx.advance);
                ctx.advance = false;
                ctx.jumpTap = false;
                ctx.attackTap = false;
                this.renderAll(dt);
                return;
            }
            ctx.advance = false;
            if (ctx.debugBoss) { ctx.debugBoss = false; this.debugToGate(); }

            const p = this.p;
            const inp = this.readInput();
            const canAct = ["play", "boss", "warning"].includes(this.state);
            if (this.state === "intro") {
                this.introT -= dt;
                if (this.introT <= 0) { this.hideBanner(); this.state = "play"; }
            } else if (this.state === "warning") {
                this.warnT -= dt;
                if (this.warnT <= 0) { this.hideBanner(); this.spawnBoss(); }
            }
            if (canAct) this.stageTime += dt;

            if (!canAct) { inp.mx = 0; inp.jumpPressed = false; inp.attackPressed = false; inp.down = false; inp.up = false; inp.jump = false; }
            if (inp.jumpPressed) p.jumpBuf = JUMP_BUFFER;
            if (inp.attackPressed && !p.dead && canAct) this.throwWeapon(inp);
            p.fireCd -= dt;
            if (p.throwT > 0) p.throwT -= dt;
            if (p.invuln > 0) p.invuln -= dt;

            // VITA は時間で減る(ボス戦は半分の速さ)
            if (canAct && !p.dead && this.state !== "stageclear") {
                p.vita -= dt / diff.drain * (this.state === "boss" ? 0.5 : 1);
                if (p.vita <= 0) { p.vita = 0; this.killPlayer("vita"); }
                const lowNow = p.vita < 8;
                if (lowNow && Math.floor(p.vita) !== this._lastLowBeep) { this._lastLowBeep = Math.floor(p.vita); audio.sfx("countdown"); }
            }

            if (p.dead) {
                p.deadT += dt;
                if (p.reason !== "pit") { p.vy += GRAV * 0.8 * dt; p.y += p.vy * dt; }
            } else {
                let acc = dt;
                while (acc > 1e-6) {
                    const h = Math.min(STEP, acc);
                    acc -= h;
                    this.updatePlatforms(h);
                    this.stepPlayer(h, inp);
                    this.updateSprings(h);
                }
            }

            if (canAct || this.state === "stageclear") {
                this.updateCrumbles(dt);
                this.updateEnemies(dt);
                this.updateShots(dt);
                this.updateEnemyShots(dt);
                this.updateItems(dt);
                this.updateHazards(dt);
                this.updateFlags();
                if (this.gateX !== null && this.state === "play" && !p.dead && p.x > this.gateX + 3 * T) this.startBoss();
                if (this.boss) this.updateBoss(dt);
                this.updateMarks(dt);
            } else {
                this.updatePlatforms(0);
            }

            // 速さの演出: 残像と砂ぼこり
            const sp = Math.abs(p.vx);
            if (!p.dead && sp > AFTERIMAGE_SPEED) {
                p.ghostT -= dt;
                if (p.ghostT <= 0) { p.ghostT = 0.045; this.afterimage(); }
            }
            if (!p.dead && p.grounded && (sp > TOP * 0.95 || p.sliding) && sp > 40) {
                p.dustT -= dt;
                if (p.dustT <= 0) { p.dustT = p.sliding ? 0.04 : 0.09; this.dust(p.x - p.face * 4, p.y, 1); }
            }

            this.updateCamera(dt);
            this.renderAll(dt);
            this.updateHud();
        }

        // ---------- debug ----------
        debugToGate() {
            this.story.hide();
            this.hideBanner();
            this.state = "play";
            if (this.gateX !== null) {
                const p = this.p;
                p.x = this.gateX - 2 * T;
                const f = this.findFloor(p.x, 0, H);
                p.y = f ? f.y : p.y;
                p.vx = 0; p.vy = 0; p.grounded = false;
                this.camX = clamp(p.x - W * 0.4, 0, this.worldW - W);
            }
        }
    }

    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: root,
        width: W,
        height: H,
        backgroundColor: "#000008",
        pixelArt: true,
        roundPixels: true,
        banner: false,
        audio: { noAudio: true },
        input: { keyboard: { target: root }, gamepad: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [TitleScene, PlayScene],
    });

    function restart() {
        Object.assign(ctx, { finished: false, skipStory: false, externalPause: false, advance: false, play: null, debugBoss: false });
        audio.setPaused(false);
        const run = () => {
            ["play", "title"].forEach((key) => { if (game.scene.isActive(key) || game.scene.isPaused(key)) game.scene.stop(key); });
            game.scene.start("title");
        };
        if (game.isBooted) run(); else game.events.once("ready", run);
        focusRoot();
    }

    setTimeout(focusRoot, 0);

    return {
        unmount() {
            try { game.destroy(true); } catch { /* ignore */ }
            audio.close();
            container.removeEventListener("keydown", onKey);
            container.removeEventListener("keyup", onKey);
            container.innerHTML = "";
        },
        pause() { ctx.externalPause = true; syncAudioPause(); },
        resume() { ctx.externalPause = false; syncAudioPause(); focusRoot(); },
        restart,
        focus: focusRoot,
        /** 動作確認用: 指定のステージから(会話は飛ばす) */
        debugStartStage(n, skipStory = true) {
            ctx.skipStory = skipStory;
            ctx.finished = false;
            ["play", "title"].forEach((key) => { if (game.scene.isActive(key)) game.scene.stop(key); });
            game.scene.start("play", { stageIndex: clamp((n | 0) - 1, 0, stages.length - 1), score: 0, lives: diff.lives });
            return true;
        },
        /** 動作確認用: ボスの部屋の手前へ */
        debugBoss() { ctx.debugBoss = true; return true; },
        debugBossLow() { const b = ctx.play?.boss; if (!b) return false; b.hp = 1; return true; },
        debugCollectAll() { const p = ctx.play; if (!p) return false; p.itemsGot = ITEMS_PER_STAGE; return true; },
        debugInvincible(on = true) { ctx.invincible = !!on; return ctx.invincible; },
        debugScene() { return ctx.play; },
        /** 動作確認用: 列 col へ移動 */
        debugTeleport(col) {
            const s = ctx.play;
            if (!s) return false;
            const p = s.p;
            p.x = col * T + 8;
            const f = s.findFloor(p.x, 4 * T, H + 40); // 天井(上の3段)より下で探す
            p.y = f ? f.y : 4 * T;
            p.vx = 0; p.vy = 0; p.grounded = false;
            s.camX = clamp(p.x - W * 0.4, s.lockL, s.lockR - W);
            return { x: p.x, y: p.y };
        },
        debugGameOver() { const s = ctx.play; if (!s) return false; s.lives = 1; const inv = ctx.invincible; ctx.invincible = false; s.p.invuln = 0; s.p.armor = false; s.p.boots = false; s.hurtPlayer(); ctx.invincible = inv; return true; },
        debugState() {
            const s = ctx.play;
            if (!s || !s.sys.isActive()) return null;
            const p = s.p;
            return {
                state: s.state, stage: s.stageIndex + 1, score: s.score, lives: s.lives, items: s.itemsGot, weapon: s.weapon,
                x: Math.round(p.x), y: Math.round(p.y), col: Math.floor(p.x / T), vx: Math.round(p.vx), vy: Math.round(p.vy),
                grounded: p.grounded, sliding: p.sliding, crouch: p.crouch, armor: p.armor, boots: p.boots, vita: +p.vita.toFixed(1), dead: p.dead,
                k: p.k, enemies: s.enemies.length, camX: Math.round(s.camX),
                boss: s.boss ? { type: s.boss.type, hp: s.boss.hp, state: s.boss.state } : null, time: +s.stageTime.toFixed(1),
            };
        },
    };
}

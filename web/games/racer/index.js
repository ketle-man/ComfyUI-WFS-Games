/**
 * TURBO HEART — 後ろから見る疑似3Dレース (WFS Game API v1)
 * 80年代のアーケード / MSX2 / PC-8801 風。8台で走り、最後尾から3位以内を目指す。全5レース。
 *
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debug... }
 *
 * host: apiVersion / lang / settings { difficulty, sound, bgm } / runStart() / stageClear(result) / finish(result)
 * result: { gameId, kind: "stage"|"ending"|"gameover", cleared, score, bonus, items, stage, stagesTotal, stageName, negative, rewards }
 *
 * 道路は区間(セグメント)ごとに奥から手前へ投影して描く古典的な疑似3D。
 * 1セグメント = 長さ SEG、道幅の半分 = ROAD_W(ワールド座標)。横位置 offset は道幅の半分を1とした値。
 */
import * as Phaser from "../../vendor/phaser/phaser.esm.min.js";
import { createAudio } from "../../common/audio.js";
import { loadFont, txt, COL, pad, addScanlines, StoryBox, seededRandom } from "../../common/retro.js";
import { SONGS } from "./songs.js";
import { makeRacerTextures } from "./sprites.js";

const GAME_ID = "racer";
const W = 480;
const H = 320;
const HISCORE_KEY = "wfs_games_racer_hiscore";
const ITEMS_PER_STAGE = 5;

// ---- 道路と物理 ----
const SEG = 200;
const RUMBLE = 3;
const ROAD_W = 2000;
const LANES = 3;
const CAM_H = 1000;
const FOV = 100;
const DRAW = 170;
const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
const PLAYER_Z = CAM_H * CAM_DEPTH;
const MAX_SPEED = SEG * 60;
const ACCEL = MAX_SPEED / 5;
const BRAKE = -MAX_SPEED;
const DECEL = -MAX_SPEED / 5;
const OFFROAD_DECEL = -MAX_SPEED / 2;
const OFFROAD_LIMIT = MAX_SPEED / 4;
const CENTRIFUGAL = 0.3;
const KMH = 280 / MAX_SPEED;
const NITRO_TIME = 2.5;
const NITRO_COUNT = 3;
const NITRO_MUL = 1.35;

// ワールドでの横幅(道幅の半分 = 2000)
const CAR_WORLD_W = 450;
const CAR_W = CAR_WORLD_W / ROAD_W;
const SPRITE_WORLD_W = { palm: 1100, tree: 900, tree2: 900, cactus: 500, rock: 700, lamp: 260, bldg: 1800, gate: ROAD_W * 2.3, heart: 340 };
// 障害物
const BOX_WORLD_W = 1100;          // 積み上げたダンボールの横幅(道幅の半分 = 2000)
const BOX_W = BOX_WORLD_W / ROAD_W;
const OIL_LEN = 10;                // オイルが続くセグメント数(短いと遠くで線のようにしか見えない)
const SPIN_TIME = 1.3;             // オイルでのスピン(2回転)にかかる秒数
const PED_WORLD_W = 300;
const PLAYER_Y = H - 4 - 13.5;
const SOLID = new Set(["palm", "tree", "tree2", "cactus", "rock", "lamp", "bldg"]);

const RIVAL_COLORS = ["blue", "yellow", "white", "green", "purple", "orange", "black"];
// シティポップ風の曲なので速くしすぎず、音域が高くなりすぎない範囲で移調する
const STAGE_MUSIC = [
    { transpose: 0, bpm: 148 },
    { transpose: 2, bpm: 150 },
    { transpose: -2, bpm: 152 },
    { transpose: 3, bpm: 156 },
    { transpose: 5, bpm: 160 },
];
const DIFFICULTY = {
    easy: { rival: 0.93 },
    normal: { rival: 1.0 },
    hard: { rival: 1.05 },
};

// ---- ステージごとの景色 ----
const THEMES = {
    seaside: {
        key: "seaside", sky: [0x2060e0, 0x2878f0, 0x3890f8, 0x50a8f8, 0x70c0f8, 0x98d8f8], clouds: 0xf8f8f8,
        farType: "islands", far: 0x5888b8, sea: 0x2058c8, near: null,
        grass: [0x58c048, 0x50b040], rumble: [0xe83838, 0xf8f8f8], road: [0x787880, 0x707078], lane: 0xf8f8f8, fog: 0x98d8f8,
        leaf: 0x38b838, leafDark: 0x187818, sprites: [["palm", 5], ["rock", 1]], density: 0.7,
    },
    mountain: {
        key: "mountain", sky: [0x3868c8, 0x4880d8, 0x5898e8, 0x78b0f0, 0xa0c8f0, 0xc8e0f8], clouds: 0xf8f8f8,
        farType: "mountains", far: 0x6858a8, snow: true, near: 0xa85828,
        grass: [0x789838, 0x6c8c30], rumble: [0xf8f8f8, 0xe83838], road: [0x787878, 0x707070], lane: 0xf8f8f8, fog: 0xc8e0f8,
        leaf: 0xf89838, leaf2: 0xe84828, leafDark: 0xa84818, sprites: [["tree", 3], ["tree2", 3], ["rock", 1]], density: 0.95,
    },
    desert: {
        key: "desert", sky: [0x382068, 0x583080, 0x903868, 0xd05048, 0xf07838, 0xf8a848, 0xf8c868], sun: [480, 160, 26, 0xf8e080],
        farType: "mesas", far: 0x983828, farDark: 0x682018, near: 0xb86030,
        grass: [0xd8a058, 0xc89048], rumble: [0xf8d838, 0x885028], road: [0x686068, 0x605860], lane: 0xf8f0a0, fog: 0xf8b858,
        rock: 0xb85838, rockDark: 0x782818, sprites: [["cactus", 3], ["rock", 2]], density: 0.5,
    },
    city: {
        key: "city", sky: [0x080818, 0x101030, 0x181848, 0x202860, 0x283078], stars: true,
        farType: "skyline", far: 0x181830, near: null,
        grass: [0x202028, 0x1a1a22], rumble: [0xf858f8, 0x58e8f8], road: [0x383840, 0x303038], lane: 0xf8f048, fog: 0x283078,
        building: 0x282840, sprites: [["bldg", 4], ["lamp", 2]], density: 1.0,
    },
    dawn: {
        key: "dawn", sky: [0x584898, 0x8858a8, 0xc86898, 0xf88898, 0xf8a8a0, 0xf8c8a0, 0xf8e0b0], sun: [300, 196, 30, 0xf8f0c0], clouds: 0xf8c8d8,
        farType: "islands", far: 0x785888, sea: 0x9868a8, near: null,
        grass: [0x50b850, 0x48a848], rumble: [0xf8f8f8, 0xe83838], road: [0x787078, 0x706870], lane: 0xf8f8f8, fog: 0xf8c8a0,
        leaf: 0x48b848, leafDark: 0x207820, sprites: [["palm", 5], ["rock", 1]], density: 0.7,
    },
};

const TEXT = {
    en: {
        title: "TURBO HEART", pushStart: "PUSH SPACE KEY",
        controls: "STEER ← →   GAS ↑/Z   BRAKE ↓/X   NITRO SPACE/C   PAUSE ESC",
        stage: (n) => `RACE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "ALL ITEMS: PRIVATE PHOTO",
        finish: "FINISH!", allClear: "CHAMPION!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY",
        next: "SPACE / CLICK", go: "GO!", pass: "PASS!", spin: "SPIN!", accident: "ACCIDENT!", nitro: "NITRO!", item: "ITEM", pos: "POS", time: "TIME",
        place: (n) => ["1ST", "2ND", "3RD"][n - 1] || `${n}TH`, needTop3: "TOP 3 TO ADVANCE",
        difficulty: { easy: "EASY", normal: "NORMAL", hard: "HARD" },
    },
    ja: {
        title: "TURBO HEART", pushStart: "PUSH SPACE KEY",
        controls: "ハンドル ← →  アクセル ↑/Z  ブレーキ ↓/X  ニトロ SPACE/C  一時停止 ESC",
        stage: (n) => `RACE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "アイテム全部獲得: プライベート写真",
        finish: "FINISH!", allClear: "CHAMPION!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY",
        next: "SPACE / クリック", go: "GO!", pass: "PASS!", spin: "SPIN!", accident: "ACCIDENT!", nitro: "NITRO!", item: "ITEM", pos: "POS", time: "TIME",
        place: (n) => ["1ST", "2ND", "3RD"][n - 1] || `${n}TH`, needTop3: "3位以内で次のレースへ",
        difficulty: { easy: "やさしい", normal: "ふつう", hard: "むずかしい" },
    },
    zh: {
        title: "TURBO HEART", pushStart: "PUSH SPACE KEY",
        controls: "方向 ← →  油门 ↑/Z  刹车 ↓/X  氮气 SPACE/C  暂停 ESC",
        stage: (n) => `RACE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "全部道具获得: 私人照片",
        finish: "FINISH!", allClear: "CHAMPION!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY",
        next: "SPACE / 点击", go: "GO!", pass: "PASS!", spin: "SPIN!", accident: "ACCIDENT!", nitro: "NITRO!", item: "ITEM", pos: "POS", time: "TIME",
        place: (n) => ["1ST", "2ND", "3RD"][n - 1] || `${n}TH`, needTop3: "前三名晋级下一场",
        difficulty: { easy: "简单", normal: "普通", hard: "困难" },
    },
};

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS", "KeyZ", "KeyX", "KeyC", "KeyP", "Escape", "Enter", "ShiftLeft"]);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (a, b, t) => a + (b - a) * t * t;
const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
const accelerate = (v, a, dt) => v + a * dt;
const overlap = (x1, w1, x2, w2, pct = 1) => Math.abs(x1 - x2) < ((w1 + w2) / 2) * pct;

function mixColor(c1, c2, t) {
    if (t <= 0) return c1;
    const r = lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t);
    const g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t);
    const b = lerp(c1 & 255, c2 & 255, t);
    return (r << 16) | (g << 8) | b;
}

function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const c = Math.floor((sec * 100) % 100);
    return `${m}'${String(s).padStart(2, "0")}"${String(c).padStart(2, "0")}`;
}

async function loadData() {
    const res = await fetch(new URL("./stages.json", import.meta.url));
    if (!res.ok) throw new Error(`stages.json: HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.stages) || !data.stages.length) throw new Error("stages.json: no stages");
    return data;
}

function loadHiScore() { try { return Number(localStorage.getItem(HISCORE_KEY)) || 0; } catch { return 0; } }
function saveHiScore(v) { try { localStorage.setItem(HISCORE_KEY, String(v)); } catch { /* ignore */ } }

// ---------------------------------------------------------------------------
// track
// ---------------------------------------------------------------------------

/** ステージのコースを作る(ステージ番号を種にした乱数なので毎回同じ形) */
function buildTrack(stage, theme) {
    const rnd = seededRandom(stage.id * 7919 + 13);
    const segs = [];
    const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);
    const addSegment = (curve, y) => {
        const n = segs.length;
        segs.push({
            index: n,
            p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
            p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} },
            curve, sprites: [], cars: [], items: [], obstacles: [], light: Math.floor(n / RUMBLE) % 2 === 0, clip: H,
        });
    };
    const addRoad = (enter, hold, leave, curve, height) => {
        const startY = lastY();
        const endY = startY + height * SEG;
        const total = enter + hold + leave;
        for (let i = 0; i < enter; i++) addSegment(easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total));
        for (let i = 0; i < hold; i++) addSegment(curve, easeInOut(startY, endY, (enter + i) / total));
        for (let i = 0; i < leave; i++) addSegment(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (enter + hold + i) / total));
    };
    const R = (a, b) => a + rnd() * (b - a);
    const target = stage.length || 2400;
    const cv = stage.curviness ?? 1;
    const hl = stage.hilliness ?? 1;

    addRoad(10, 40, 10, 0, 0); // スタート直線
    while (segs.length < target - 120) {
        const r = rnd();
        const len = Math.round(R(25, 60));
        const hill = rnd() < 0.5 * hl ? Math.round(R(-40, 40) * hl) : 0;
        if (r < 0.22) addRoad(len / 2, len, len / 2, 0, hill);
        else if (r < 0.62) {
            const dir = rnd() < 0.5 ? -1 : 1;
            addRoad(len / 2, len, len / 2, dir * R(2, 6) * cv, hill);
        } else if (r < 0.82) {
            const dir = rnd() < 0.5 ? -1 : 1;
            addRoad(len / 3, len / 2, len / 3, dir * R(2, 5) * cv, 0);
            addRoad(len / 3, len / 2, len / 3, -dir * R(2, 5) * cv, hill);
        } else {
            addRoad(len / 2, len / 2, len / 2, 0, Math.round(R(25, 60) * hl) * (rnd() < 0.5 ? -1 : 1));
        }
    }
    addRoad(20, 80, 20, 0, -lastY() / SEG / 2); // ゴール前の直線(高さを少し戻す)
    const finishIdx = segs.length - 20;
    addRoad(0, DRAW + 60, 0, 0, 0); // ゴールの先(描画用)

    const startIdx = 6;
    for (const i of [startIdx, startIdx + 1, finishIdx, finishIdx + 1]) segs[i].checker = true;
    segs[startIdx + 15].sprites.push({ kind: "gate", key: "gate", offset: 0, solid: false }); // スタート直後のゲート(近すぎると画面を覆うので少し先)
    segs[finishIdx + 2].sprites.push({ kind: "gate", key: "gate", offset: 0, solid: false });

    // 沿道の物
    const pick = () => {
        const total = theme.sprites.reduce((n, [, w]) => n + w, 0);
        let r = rnd() * total;
        for (const [kind, w] of theme.sprites) { if ((r -= w) < 0) return kind; }
        return theme.sprites[0][0];
    };
    const keyOf = (kind) => (kind === "bldg" ? `bldg${Math.floor(rnd() * 3)}_${theme.key}` : `${kind}_${theme.key}`);
    for (let i = startIdx + 12; i < finishIdx - 4; i += 4) {
        for (const side of [-1, 1]) {
            if (rnd() > theme.density * 0.55) continue;
            const kind = pick();
            const near = kind === "lamp" ? 1.15 : kind === "bldg" ? 1.7 : 1.3;
            segs[i + Math.floor(rnd() * 3)].sprites.push({ kind, key: keyOf(kind), offset: side * (near + rnd() * (kind === "lamp" ? 0 : 1.1)), solid: SOLID.has(kind) });
        }
    }

    // ハート5個: コースの 15〜85% に均等に、左右に振って置く
    const items = [];
    for (let k = 0; k < ITEMS_PER_STAGE; k++) {
        const idx = Math.round(startIdx + (finishIdx - startIdx) * (0.15 + 0.17 * k));
        const item = { segIdx: idx, offset: (k % 2 ? 1 : -1) * (0.35 + rnd() * 0.4), got: false };
        segs[idx].items.push(item);
        items.push(item);
    }
    // 障害物: ダンボール2か所・オイル1か所(ステージごとに毎回同じ場所)。ハートやほかの障害物から離して置く
    const used = items.map((i) => i.segIdx);
    const freeIdx = (lo, hi) => {
        for (let tries = 0; tries < 60; tries++) {
            const idx = Math.round(startIdx + (finishIdx - startIdx) * (lo + rnd() * (hi - lo)));
            if (used.every((u) => Math.abs(u - idx) > 30)) { used.push(idx); return idx; }
        }
        return null;
    };
    const obstacles = [];
    for (let k = 0; k < 2; k++) {
        const idx = freeIdx(0.18 + k * 0.4, 0.45 + k * 0.4);
        if (idx === null) continue;
        const ob = { kind: "box", segIdx: idx, z: (idx + 0.5) * SEG, offset: (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.35), w: BOX_W, broken: false };
        segs[idx].obstacles.push(ob);
        obstacles.push(ob);
    }
    const oi = freeIdx(0.25, 0.85);
    if (oi !== null) {
        const ob = { kind: "oil", segIdx: oi, zStart: oi * SEG, zEnd: (oi + OIL_LEN) * SEG, offset: (rnd() - 0.5) * 0.9, half: 0.36, lastHit: -99 };
        for (let k = 0; k < OIL_LEN; k++) segs[oi + k].oil = ob;
        obstacles.push(ob);
    }
    return { segs, startIdx, finishIdx, finishZ: finishIdx * SEG, items, obstacles, used };
}

function project(p, camX, camY, camZ) {
    p.camera.x = -camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    p.screen.scale = CAM_DEPTH / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(H / 2 - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * ROAD_W * W / 2);
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
    const heroineName = loc(data.heroine?.name) || "MISAKI";
    const audio = createAudio({ sound: settings.sound !== false, bgm: settings.bgm !== false, songs: SONGS });

    const ctx = { finished: false, debugClear: false, skipStory: false, externalPause: false, pauseToggle: false, advance: false, nitroPress: false, play: null, hiScore: loadHiScore() };

    const finish = (result) => {
        if (ctx.finished) return;
        ctx.finished = true;
        try { host.finish?.(result); } catch (e) { console.error("[racer] host.finish failed", e); }
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
        if (e.code === "Space" || e.code === "Enter" || e.code === "KeyZ") ctx.advance = true;
        if (e.code === "Space" || e.code === "KeyC" || e.code === "ShiftLeft") ctx.nitroPress = true;
    };
    container.addEventListener("keydown", onKey);
    container.addEventListener("keyup", onKey);
    const focusRoot = () => root.focus({ preventScroll: true });
    const onPointer = () => { focusRoot(); audio.unlock(); ctx.advance = true; };
    root.addEventListener("pointerdown", onPointer);

    // ---------------- title ----------------

    class TitleScene extends Phaser.Scene {
        constructor() { super("title"); }
        create() {
            this.started = false;
            const theme = THEMES.dawn;
            makeRacerTextures(this, theme);
            this.add.tileSprite(0, 0, W, 200, `sky_${theme.key}`).setOrigin(0).setScale(1, H / 200);
            this.titleClouds = [
                { layer: this.add.tileSprite(0, 0, W, 200, `clouds1_${theme.key}`).setOrigin(0).setScale(1, H / 200), speed: 6 },
                { layer: this.add.tileSprite(0, 0, W, 200, `clouds2_${theme.key}`).setOrigin(0).setScale(1, H / 200), speed: 14 },
            ];
            this.add.image(W / 2, H - 60, `far_${theme.key}`).setOrigin(0.5, 1);
            this.add.rectangle(W / 2, H - 30, W, 60, 0x302838);
            const g = this.add.graphics();
            g.lineStyle(2, 0xf8f8f8, 1).strokeRect(10, 10, W - 20, H - 20);
            g.lineStyle(2, 0xf858f8, 1).strokeRect(15, 15, W - 30, H - 30);
            txt(this, W / 2 + 3, 63, tr("title"), 32, COL.magenta).setOrigin(0.5);
            txt(this, W / 2, 60, tr("title"), 32, COL.yellow).setOrigin(0.5);
            txt(this, W / 2, 96, `- ${tr("difficulty")[settings.difficulty] || ""} -`, 16, COL.white).setOrigin(0.5);
            this.add.graphics().lineStyle(2, 0xf8f8f8, 1).strokeRect(W / 2 - 108, 130, 56, 56);
            this.add.image(W / 2 - 80, 158, "misaki");
            txt(this, W / 2 - 80, 198, heroineName, 16, COL.yellow).setOrigin(0.5);
            this.add.image(W / 2 + 60, 180, "car_player").setScale(2.4).setOrigin(0.5, 1);
            const start = txt(this, W / 2, 240, tr("pushStart"), 16, COL.yellow).setOrigin(0.5);
            this.time.addEvent({ delay: 480, loop: true, callback: () => start.setVisible(!start.visible) });
            txt(this, W / 2, 272, tr("controls"), 16, COL.white).setOrigin(0.5).setScale(0.62);
            txt(this, W / 2, 294, `HI ${pad(ctx.hiScore)}`, 16, COL.white).setOrigin(0.5).setScale(0.8);
            ctx.advance = false;
            audio.playMusic("title");
        }
        begin() {
            if (this.started) return;
            this.started = true;
            audio.unlock();
            audio.sfx("start");
            try { host.runStart?.(); } catch (e) { console.error("[racer] host.runStart failed", e); }
            this.scene.start("race", { stageIndex: 0, score: 0 });
        }
        update(_t, delta) {
            for (const c of this.titleClouds) c.layer.tilePositionX += c.speed * delta / 1000;
            if (ctx.advance) { ctx.advance = false; this.begin(); }
            const pad1 = this.input.gamepad?.pad1;
            if (pad1 && (pad1.A || pad1.buttons?.[9]?.pressed)) this.begin();
        }
    }

    // ---------------- race ----------------

    class RaceScene extends Phaser.Scene {
        constructor() { super("race"); }

        init(d) {
            this.stageIndex = d.stageIndex ?? 0;
            this.score = d.score ?? 0;
            this.stage = stages[this.stageIndex];
            this.theme = THEMES[this.stage.theme] || THEMES.seaside;
        }

        create() {
            ctx.play = this;
            ctx.pauseToggle = false;
            ctx.nitroPress = false;
            this.paused = false;
            this._wasPaused = false;
            makeRacerTextures(this, this.theme);

            const tk = this.theme.key;
            // 背景(空・遠景・近景)。カーブに合わせて横にずらす
            this.skyLayer = this.add.tileSprite(0, 0, W, H / 2 + 6, `sky_${tk}`).setOrigin(0).setDepth(0);
            this.skyLayer.setTileScale(1, (H / 2 + 6) / 200);
            // 流れる雲(遠い層はゆっくり、近い層は少し速く)
            this.clouds = [];
            if (this.theme.clouds) {
                this.clouds.push({ layer: this.add.tileSprite(0, 0, W, H / 2 + 6, `clouds1_${tk}`).setOrigin(0).setDepth(0.5).setTileScale(1, (H / 2 + 6) / 200), speed: 6, parallax: 0.25 });
                this.clouds.push({ layer: this.add.tileSprite(0, 0, W, H / 2 + 6, `clouds2_${tk}`).setOrigin(0).setDepth(0.6).setTileScale(1, (H / 2 + 6) / 200), speed: 14, parallax: 0.35 });
            }
            this.cloudDrift = 0;
            this.farLayer = this.add.tileSprite(0, H / 2 - 84, W, 90, `far_${tk}`).setOrigin(0).setDepth(1);
            this.nearLayer = this.add.tileSprite(0, H / 2 - 44, W, 50, `near_${tk}`).setOrigin(0).setDepth(2);
            this.bgOffset = 0;
            this.ground = this.add.rectangle(W / 2, H * 0.75, W, H / 2 + 8, mixColor(this.theme.grass[0], this.theme.fog, 0.45)).setDepth(3); // 道が描かれない地平線付近の地面
            this.road = this.add.graphics().setDepth(4);
            this.fx = this.add.graphics().setDepth(60);
            this.pool = [];
            this.poolUsed = 0;

            this.track = buildTrack(this.stage, this.theme);
            this.segs = this.track.segs;
            // 人物: 0人か1人(プレイのたびにランダム)。近づくと道を横断しはじめる
            this.ped = null;
            if (Math.random() < 0.5) this.spawnPed(0.3, 0.8);
            this.spinT = 0;
            this.spinDir = 1;
            this.position = this.track.startIdx * SEG - PLAYER_Z + SEG * 0.5; // 自機はスタートライン上
            this.playerX = 0;
            this.speed = 0;
            this.nitroLeft = NITRO_COUNT;
            this.nitroT = 0;
            this.raceTime = 0;
            this.itemsGot = 0;
            this.state = "intro";
            this.place = 0;
            this.finishOrder = [];

            // ライバル7台: 自機の前にグリッド状に並ぶ。前のほうほど速い。一番前の黒いマシンが最速
            this.cars = [];
            for (let i = 0; i < RIVAL_COLORS.length; i++) {
                const row = Math.floor(i / 2) + 1;
                const z = this.position + PLAYER_Z + row * SEG * 4;
                const lane = i % 2 ? 0.45 : -0.45;
                const base = (this.stage.rival_speed || 0.75) + i * 0.012 + (RIVAL_COLORS[i] === "black" ? 0.035 : 0);
                const car = { z, offset: lane, lane, base: base * diff.rival * MAX_SPEED, speed: 0, key: `car_${RIVAL_COLORS[i]}`, phase: i * 1.7, seg: null, finished: false, ahead: true };
                this.cars.push(car);
                this.placeCar(car);
            }

            // 自機
            // スピンで回転させるので中心を基準にする(高さ 12px x 2.25 倍の半分 = 13.5)
            this.playerSprite = this.add.image(W / 2, PLAYER_Y, "car_player").setOrigin(0.5, 0.5).setScale(2.25).setDepth(50);

            this.buildHud();
            this.banner = txt(this, W / 2, 96, "", 32, COL.yellow).setOrigin(0.5).setDepth(70).setVisible(false);
            this.subBanner = txt(this, W / 2, 128, "", 16, COL.white).setOrigin(0.5, 0).setDepth(70).setVisible(false);
            this.subBanner.setWordWrapWidth(W - 60, true);
            this.pauseText = txt(this, W / 2, H / 2, tr("paused"), 32, COL.white).setOrigin(0.5).setDepth(90).setVisible(false);
            this.story = new StoryBox(this, { W, H, portrait: "misaki", speakerName: heroineName, nextLabel: tr("next"), loc, sfx: (n) => audio.sfx(n), depth: 80 });

            this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,UP,DOWN,A,D,W,S,Z,X");
            this.render3d();
            this.updateHud();

            const before = this.stage.story_before || [];
            if (before.length && !ctx.skipStory) this.startStory(before, () => this.startCountdown());
            else this.startCountdown();
        }

        // ---------- HUD ----------
        buildHud() {
            const D = 65;
            txt(this, 10, 6, tr("pos"), 16, COL.white).setDepth(D).setScale(0.75);
            this.posText = txt(this, 10, 18, "", 32, COL.yellow).setDepth(D);
            txt(this, W / 2, 6, tr("time"), 16, COL.white).setOrigin(0.5, 0).setDepth(D).setScale(0.75);
            this.timeText = txt(this, W / 2, 18, "", 16, COL.white).setOrigin(0.5, 0).setDepth(D);
            this.stageText = txt(this, W / 2, 38, `${tr("stage", this.stageIndex + 1)} ${loc(this.stage.name)}`, 16, this.stage.color || COL.white).setOrigin(0.5, 0).setDepth(D).setScale(0.75);
            this.speedText = txt(this, W - 52, 14, "", 32, COL.cyan).setOrigin(1, 0).setDepth(D);
            txt(this, W - 10, 30, "km/h", 16, COL.cyan).setOrigin(1, 0).setDepth(D).setScale(0.75);
            this.gauge = this.add.graphics().setDepth(D);
            this.hearts = [];
            for (let i = 0; i < ITEMS_PER_STAGE; i++) this.hearts.push(this.add.image(16 + i * 12, 60, "heart_s").setDepth(D));
            txt(this, 10, H - 22, "NITRO", 16, COL.orange).setDepth(D).setScale(0.75);
            this.nitroIcons = [];
            for (let i = 0; i < NITRO_COUNT; i++) this.nitroIcons.push(this.add.rectangle(62 + i * 14, H - 15, 10, 10, 0xf89838).setDepth(D));
            this.progress = this.add.graphics().setDepth(D);
        }
        updateHud() {
            if (this.score > ctx.hiScore) ctx.hiScore = this.score;
            this.posText.setText(`${this.rank()}/${this.cars.length + 1}`);
            this.timeText.setText(fmtTime(this.raceTime));
            const kmh = Math.round(this.speed * KMH);
            this.speedText.setText(String(kmh));
            const g = this.gauge;
            g.clear();
            const n = 20, x0 = W - 128, y0 = 52;
            const lit = Math.round(clamp(this.speed / (MAX_SPEED * NITRO_MUL), 0, 1) * n);
            for (let i = 0; i < n; i++) {
                const c = i < 10 ? 0x58e858 : i < 15 ? 0xf8f048 : 0xf85858;
                g.fillStyle(i < lit ? c : 0x303040, 1).fillRect(x0 + i * 6, y0 - Math.floor(i / 4), 4, 4 + Math.floor(i / 4));
            }
            this.hearts.forEach((h, i) => h.setAlpha(i < this.itemsGot ? 1 : 0.2));
            this.nitroIcons.forEach((r, i) => r.setFillStyle(i < this.nitroLeft ? 0xf89838 : 0x403028));
            // コースの進み具合(右端の縦棒): 自機は赤、ライバルは白
            const p = this.progress;
            p.clear();
            const top = 74, bot = H - 40, x = W - 10;
            p.fillStyle(0x303040, 1).fillRect(x - 1, top, 3, bot - top);
            const toY = (z) => bot - clamp((z - this.track.startIdx * SEG) / (this.track.finishZ - this.track.startIdx * SEG), 0, 1) * (bot - top);
            for (const c of this.cars) p.fillStyle(c.key === "car_black" ? 0x707080 : 0xf8f8f8, 1).fillRect(x - 3, toY(c.z) - 1, 7, 3);
            p.fillStyle(0xf83838, 1).fillRect(x - 4, toY(this.position + PLAYER_Z) - 2, 9, 4);
        }
        showBanner(main, sub = "", color = COL.yellow) {
            this.banner.setText(main).setColor(color).setVisible(true);
            this.subBanner.setText(sub).setVisible(!!sub);
        }
        hideBanner() {
            this.banner.setVisible(false);
            this.subBanner.setVisible(false);
        }
        popup(text, color = COL.yellow) {
            const t = txt(this, W / 2, H - 120, text, 16, color).setOrigin(0.5).setDepth(70);
            this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 800, onComplete: () => t.destroy() });
        }

        // ---------- story / flow ----------
        startStory(lines, done, music = "story") {
            this.state = "story";
            this.hideBanner();
            audio.stopEngine();
            ctx.advance = false;
            audio.playMusic(music);
            this.story.start(lines, done);
        }
        startCountdown() {
            this.state = "countdown";
            this.countT = 4.6; // 最初の1秒はレース名を見せて、そのあと 3・2・1
            this.lastCount = 4;
            this.showBanner(`${tr("stage", this.stageIndex + 1)}`, `${loc(this.stage.name)}\n${tr("needTop3")}`);
            audio.stopMusic();
            audio.startEngine();
        }
        rank() {
            const me = this.position + PLAYER_Z;
            let ahead = 0;
            for (const c of this.cars) if (c.finished || c.z > me) ahead++;
            return this.state === "finished" || this.state === "done" ? this.place : ahead + 1;
        }

        // ---------- cars ----------
        findSegment(z) {
            return this.segs[clamp(Math.floor(z / SEG), 0, this.segs.length - 1)];
        }
        placeCar(car) {
            const seg = this.findSegment(car.z);
            if (car.seg !== seg) {
                if (car.seg) car.seg.cars.splice(car.seg.cars.indexOf(car), 1);
                seg.cars.push(car);
                car.seg = seg;
            }
        }
        updateCars(dt) {
            const me = this.position + PLAYER_Z;
            for (const car of this.cars) {
                if (this.state === "countdown") continue;
                car.phase += dt;
                // 差が開きすぎないよう少しだけ調整して、抜きつ抜かれつを作る
                const gap = (car.z - me) / SEG;
                const band = gap > 80 ? 0.96 : gap < -60 ? 1.05 : 1;
                const target = car.finished ? MAX_SPEED * 0.35 : car.base * band * (1 + 0.02 * Math.sin(car.phase));
                car.speed = lerp(car.speed, target, clamp(dt * 0.6, 0, 1));
                car.z = Math.min(car.z + car.speed * dt, (this.segs.length - DRAW - 10) * SEG);
                // 前が詰まっていたら横に避ける(自機も含む)
                let blocked = 0;
                const look = (oz, ooff, ospeed, ow = CAR_W, range = SEG * 14) => {
                    const d = oz - car.z;
                    if (d > 0 && d < range && ospeed < car.speed && overlap(car.offset, CAR_W, ooff, ow, 1.3)) blocked = car.offset > ooff ? 1 : -1;
                };
                for (const o of this.cars) if (o !== car) look(o.z, o.offset, o.speed);
                look(me, this.playerX, this.speed);
                // 障害物は止まっているので早めに避ける
                for (const ob of this.track.obstacles) {
                    if (ob.kind === "box" && !ob.broken) look(ob.z, ob.offset, 0, ob.w, SEG * 40);
                    else if (ob.kind === "oil") look(ob.zStart, ob.offset, 0, ob.half * 2, SEG * 40);
                    else if (ob.kind === "ped" && !ob.done) look(ob.z, ob.offset, 0, 0.25, SEG * 40);
                }
                if (blocked) car.offset = clamp(car.offset + blocked * dt * 1.2, -0.85, 0.85);
                else car.offset = lerp(car.offset, car.lane, dt * 0.3);
                if (!car.finished && car.z >= this.track.finishZ) { car.finished = true; this.finishOrder.push(car); }
                // 追い抜き
                const ahead = car.finished || car.z > me;
                if (car.ahead && !ahead && this.state === "race") {
                    this.score += 200;
                    audio.sfx("pass");
                    this.popup(tr("pass"), COL.cyan);
                }
                car.ahead = ahead;
                this.placeCar(car);
            }
        }

        // ---------- obstacles ----------
        spawnPed(lo, hi) {
            const { startIdx, finishIdx, used } = this.track;
            for (let tries = 0; tries < 60; tries++) {
                const idx = Math.round(startIdx + (finishIdx - startIdx) * (lo + Math.random() * (hi - lo)));
                if (!used.every((u) => Math.abs(u - idx) > 30)) continue;
                used.push(idx);
                const dir = Math.random() < 0.5 ? 1 : -1;
                const ped = { kind: "ped", segIdx: idx, z: (idx + 0.5) * SEG, offset: -dir * 1.8, dir, walking: false, done: false, t: 0 };
                this.segs[idx].obstacles.push(ped);
                this.track.obstacles.push(ped);
                this.ped = ped;
                return ped;
            }
            return null;
        }
        updatePed(dt) {
            const ped = this.ped;
            if (!ped || ped.done || this.state !== "race") return;
            // 遠くから歩き出す(最高速で近づくと、ちょうど道の中ほどを渡っているくらい)
            if (!ped.walking && ped.z - (this.position + PLAYER_Z) < SEG * 220) ped.walking = true;
            if (!ped.walking) return;
            ped.t += dt;
            ped.offset += ped.dir * 0.42 * dt;
            if (Math.abs(ped.offset) > 1.9) ped.done = true; // 渡りきった
        }
        smashBox(ob) {
            ob.broken = true;
            this.speed *= 0.72;
            audio.sfx("box");
            this.cameras.main.shake(180, 0.008);
            const cols = [0xc89058, 0x986838, 0xe8d8a8];
            for (let i = 0; i < 16; i++) {
                const piece = this.add.image(W / 2 + Phaser.Math.Between(-50, 50), H - 70, "spark")
                    .setTint(cols[i % 3]).setScale(Phaser.Math.Between(3, 7)).setDepth(52);
                this.tweens.add({
                    targets: piece, x: piece.x + Phaser.Math.Between(-160, 160), y: piece.y + Phaser.Math.Between(-110, 40),
                    angle: Phaser.Math.Between(-360, 360), alpha: 0, duration: Phaser.Math.Between(450, 750), onComplete: () => piece.destroy(),
                });
            }
        }
        startSpin(ob) {
            this.spinT = SPIN_TIME;
            this.spinDir = this.playerX >= ob.offset ? 1 : -1;
            this.nitroT = 0;
            this.speed *= 0.85;
            this.popup(tr("spin"), COL.red);
        }
        accident(ped) {
            // 人を引いたらゲームオーバー(描写は停車と表示だけ)
            this.state = "crashed";
            ped.done = true;
            ped.offset = ped.dir * 1.6; // 道の脇に飛びのいて無事(会話とも合わせる)
            this.speed = 0;
            this.nitroT = 0;
            audio.setSqueal(0);
            audio.stopEngine();
            audio.stopMusic();
            audio.sfx("accident");
            this.cameras.main.shake(400, 0.015);
            this.cameras.main.flash(250, 255, 255, 255);
            this.showBanner(tr("accident"), "", COL.red);
            this.time.delayedCall(2000, () => this.gameOver(prompts.accident_story || prompts.gameover_story || []));
        }

        // ---------- player ----------
        updatePlayer(dt) {
            const k = this.keys;
            const pad1 = this.input.gamepad?.pad1;
            const racing = this.state === "race";
            const spinning = this.spinT > 0;
            if (spinning) this.spinT -= dt;
            const control = racing && !spinning; // スピン中は操作できない
            const ratio = this.speed / MAX_SPEED;
            const dx = dt * 2 * ratio;
            const left = control && (k.LEFT.isDown || k.A.isDown || pad1?.left || (pad1?.leftStick?.x ?? 0) < -0.3);
            const right = control && (k.RIGHT.isDown || k.D.isDown || pad1?.right || (pad1?.leftStick?.x ?? 0) > 0.3);
            const gas = control && (k.UP.isDown || k.W.isDown || k.Z.isDown || pad1?.A);
            const brake = control && (k.DOWN.isDown || k.S.isDown || k.X.isDown || pad1?.B);

            if (ctx.nitroPress) {
                ctx.nitroPress = false;
                if (control && this.nitroLeft > 0 && this.nitroT <= 0) {
                    this.nitroLeft--;
                    this.nitroT = NITRO_TIME;
                    audio.sfx("nitro");
                    this.popup(tr("nitro"), COL.orange);
                    this.cameras.main.shake(NITRO_TIME * 1000, 0.004);
                }
            }
            if (pad1?.X && racing && this.nitroLeft > 0 && this.nitroT <= 0) ctx.nitroPress = true;
            const boosting = this.nitroT > 0;
            if (boosting) this.nitroT -= dt;

            const seg = this.findSegment(this.position + PLAYER_Z);
            if (left) this.playerX -= dx;
            if (right) this.playerX += dx;
            this.playerX -= dx * ratio * seg.curve * CENTRIFUGAL;
            if (spinning) this.playerX += this.spinDir * dt * 0.7; // 横に流される

            const maxSpeed = boosting ? MAX_SPEED * NITRO_MUL : MAX_SPEED;
            if (this.state === "finished") this.speed = accelerate(this.speed, DECEL * 1.5, dt);
            else if (spinning) this.speed = Math.max(MAX_SPEED * 0.15, accelerate(this.speed, -MAX_SPEED * 0.45, dt));
            else if (boosting) this.speed = accelerate(this.speed, MAX_SPEED / 1.2, dt);
            else if (gas) this.speed = accelerate(this.speed, ACCEL, dt);
            else if (brake) this.speed = accelerate(this.speed, BRAKE, dt);
            else this.speed = accelerate(this.speed, DECEL, dt);

            const offRoad = this.playerX < -1 || this.playerX > 1;
            if (offRoad) {
                if (this.speed > OFFROAD_LIMIT) this.speed = accelerate(this.speed, OFFROAD_DECEL, dt);
                // 沿道の物にぶつかったら止まる
                for (const sp of seg.sprites) {
                    if (!sp.solid) continue;
                    const sw = (SPRITE_WORLD_W[sp.kind] || 600) / ROAD_W * 0.5;
                    if (overlap(this.playerX, CAR_W, sp.offset, sw, 1)) {
                        this.speed = MAX_SPEED / 5;
                        this.position = Math.max(0, seg.p1.world.z - PLAYER_Z);
                        audio.sfx("crash");
                        this.cameras.main.shake(200, 0.01);
                        break;
                    }
                }
            }
            // ライバル車との接触
            for (const s of [seg, this.segs[seg.index + 1]]) {
                if (!s) continue;
                for (const car of s.cars) {
                    const d = car.z - (this.position + PLAYER_Z);
                    if (d < 0 || d > SEG * 1.2) continue;
                    if (this.speed > car.speed && overlap(this.playerX, CAR_W, car.offset, CAR_W, 0.8)) {
                        this.speed = car.speed * (car.speed / this.speed);
                        this.position = car.z - PLAYER_Z - SEG * 0.3;
                        audio.sfx("crash");
                        this.cameras.main.shake(150, 0.006);
                    }
                }
            }
            this.playerX = clamp(this.playerX, -2.5, 2.5);
            this.speed = clamp(this.speed, 0, maxSpeed);

            // ハート
            const before = this.position + PLAYER_Z;
            this.position += this.speed * dt;
            const after = this.position + PLAYER_Z;
            for (const it of this.track.items) {
                if (it.got) continue;
                const z = (it.segIdx + 0.5) * SEG;
                if (before < z && after >= z && Math.abs(this.playerX - it.offset) < 0.32) {
                    it.got = true;
                    this.itemsGot++;
                    this.score += 500;
                    audio.sfx("item");
                    this.popup(`${tr("item")} ${this.itemsGot}/${ITEMS_PER_STAGE}`, COL.magenta);
                }
            }
            // 障害物
            for (const ob of this.track.obstacles) {
                if (ob.kind === "box") {
                    if (!ob.broken && before < ob.z && after >= ob.z && overlap(this.playerX, CAR_W, ob.offset, ob.w, 0.9)) this.smashBox(ob);
                } else if (ob.kind === "oil") {
                    if (!spinning && this.state === "race" && after >= ob.zStart && before < ob.zEnd && Math.abs(this.playerX - ob.offset) < ob.half + CAR_W * 0.3 && this.raceTime - ob.lastHit > 3) {
                        ob.lastHit = this.raceTime;
                        this.startSpin(ob);
                    }
                } else if (ob.kind === "ped") {
                    if (!ob.done && this.state === "race" && before < ob.z && after >= ob.z && Math.abs(ob.offset) < 1.15 && overlap(this.playerX, CAR_W, ob.offset, 0.16, 1)) {
                        this.accident(ob);
                        return;
                    }
                }
            }

            // 自機の見た目: ハンドルを切ると少し傾く、コース外はガタガタ揺れる
            const steer = (right ? 1 : 0) - (left ? 1 : 0);
            // スピン中は2回転、ふだんはハンドルで少し傾く
            this.playerSprite.setRotation(spinning ? this.spinDir * (1 - this.spinT / SPIN_TIME) * Math.PI * 4 : steer * 0.04);
            if (!(this.spinT > 0) && spinning) this.playerSprite.setRotation(0);
            this.playerSprite.y = PLAYER_Y + (offRoad && this.speed > 500 ? (Math.random() < 0.5 ? -2 : 0) : 0);
            audio.setEngine(this.speed / MAX_SPEED, boosting);

            // 速いままカーブに入るとタイヤが鳴る(カーブがきついほど・速いほど大きく)。最高速近くで強くハンドルを切っても少し鳴る
            const sRatio = this.speed / MAX_SPEED;
            let sq = 0;
            if (!offRoad && this.state === "race") {
                sq = clamp((sRatio - 0.55) / 0.4, 0, 1) * clamp((Math.abs(seg.curve) - 1.5) / 3.5, 0, 1);
                if (steer !== 0 && sRatio > 0.85) sq = Math.max(sq, 0.35);
            }
            if (spinning) sq = 1; // スピン中は最大
            this.squeal = sq;
            audio.setSqueal(sq);
            // タイヤの白い煙(後輪から)
            if (sq > 0.2 && Math.random() < 0.4 + sq) {
                for (const side of [-1, 1]) {
                    // 後輪の外側に、車体より手前に出す(車の後ろだと隠れて見えない)
                    const puff = this.add.image(W / 2 + side * 46 + Phaser.Math.Between(-4, 4), H - 8, "spark").setTint(0xe8e8f0).setAlpha(0.9).setScale(3).setDepth(51);
                    this.tweens.add({
                        targets: puff, x: puff.x + side * Phaser.Math.Between(10, 26) - steer * 14, y: puff.y - Phaser.Math.Between(10, 28),
                        alpha: 0, scale: 9, duration: 420, onComplete: () => puff.destroy(),
                    });
                }
            }

            if (this.state === "race" && after >= this.track.finishZ) this.crossFinish();
        }

        // ---------- render ----------
        sprite(key) {
            let img = this.pool[this.poolUsed];
            if (!img) { img = this.add.image(0, 0, key).setOrigin(0.5, 1); this.pool.push(img); }
            this.poolUsed++;
            img.setTexture(key).setVisible(true).setCrop();
            return img;
        }
        drawSprite(key, worldW, scale, x, y, clip, depth) {
            const destW = worldW * scale * W / 2;
            if (destW < 1.5 || y < 0) return;
            const img = this.sprite(key);
            const s = destW / img.width;
            img.setScale(s).setPosition(Math.round(x), Math.round(y)).setDepth(depth);
            const top = y - img.height * s;
            if (y > clip) {
                const visible = clip - top;
                if (visible <= 0) { img.setVisible(false); return; }
                img.setCrop(0, 0, img.width, visible / s);
            }
        }
        render3d() {
            const th = this.theme;
            const g = this.road;
            g.clear();
            this.poolUsed = 0;
            const base = this.findSegment(this.position);
            const basePercent = (this.position % SEG) / SEG;
            const pSeg = this.findSegment(this.position + PLAYER_Z);
            const pPct = ((this.position + PLAYER_Z) % SEG) / SEG;
            const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
            let maxy = H;
            let x = 0;
            let dx = -(base.curve * basePercent);
            const camY = playerY + CAM_H;
            const last = Math.min(this.segs.length - 1, base.index + DRAW);
            for (let i = base.index; i <= last; i++) {
                const seg = this.segs[i];
                const n = i - base.index;
                seg.fog = clamp((n / DRAW - 0.45) / 0.55, 0, 1) * 0.85;
                seg.clip = maxy;
                project(seg.p1, this.playerX * ROAD_W - x, camY, this.position);
                project(seg.p2, this.playerX * ROAD_W - x - dx, camY, this.position);
                x += dx;
                dx += seg.curve;
                seg.visible = false;
                if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
                seg.visible = true;
                this.drawSegment(g, seg, th);
                maxy = seg.p2.screen.y;
            }
            // 沿道の物・ハート・車を奥から手前へ
            let depth = 10;
            for (let i = last; i > base.index; i--) {
                const seg = this.segs[i];
                const p1 = seg.p1;
                if (!(p1.screen.scale > 0) || p1.camera.z <= CAM_DEPTH) continue; // カメラの直前は描かない
                for (const sp of seg.sprites) {
                    depth += 0.001;
                    const sx = p1.screen.x + p1.screen.scale * sp.offset * ROAD_W * W / 2;
                    this.drawSprite(sp.key, SPRITE_WORLD_W[sp.kind] || 600, p1.screen.scale, sx, p1.screen.y, seg.clip, depth);
                }
                for (const ob of seg.obstacles) {
                    depth += 0.001;
                    const sx = p1.screen.x + p1.screen.scale * ob.offset * ROAD_W * W / 2;
                    if (ob.kind === "box" && !ob.broken) this.drawSprite("boxes", BOX_WORLD_W, p1.screen.scale, sx, p1.screen.y, seg.clip, depth);
                    else if (ob.kind === "ped") {
                        const key = ob.walking && !ob.done && this.state === "race" ? (Math.floor(ob.t * 6) % 2 ? "ped_1" : "ped_0") : "ped_0";
                        this.drawSprite(key, PED_WORLD_W, p1.screen.scale, sx, p1.screen.y, seg.clip, depth);
                    }
                }
                for (const it of seg.items) {
                    if (it.got) continue;
                    depth += 0.001;
                    const bob = Math.sin(this.raceTime * 6 + it.segIdx) * p1.screen.scale * 50 * H / 2;
                    const sx = p1.screen.x + p1.screen.scale * it.offset * ROAD_W * W / 2;
                    this.drawSprite("heart", SPRITE_WORLD_W.heart, p1.screen.scale, sx, p1.screen.y - p1.screen.scale * 260 * H / 2 + bob, seg.clip, depth);
                }
                for (const car of seg.cars) {
                    depth += 0.001;
                    const pct = (car.z % SEG) / SEG;
                    const scale = lerp(seg.p1.screen.scale, seg.p2.screen.scale, pct);
                    const sx = lerp(seg.p1.screen.x, seg.p2.screen.x, pct) + scale * car.offset * ROAD_W * W / 2;
                    const sy = lerp(seg.p1.screen.y, seg.p2.screen.y, pct);
                    this.drawSprite(car.key, CAR_WORLD_W, scale, sx, sy, seg.clip, depth);
                }
            }
            for (let i = this.poolUsed; i < this.pool.length; i++) this.pool[i].setVisible(false);

            // 背景をカーブに合わせて流す
            this.skyLayer.tilePositionX = this.bgOffset * 0.2;
            for (const c of this.clouds) c.layer.tilePositionX = this.bgOffset * c.parallax + this.cloudDrift * c.speed;
            this.farLayer.tilePositionX = this.bgOffset * 0.5;
            this.nearLayer.tilePositionX = this.bgOffset;
            const hy = (playerY - 0) * 0; // (坂で背景を上下させるなら)
            this.farLayer.y = H / 2 - 84 + hy;

            // スピード線(高速時とニトロ中)
            const fx = this.fx;
            fx.clear();
            const ratio = this.speed / MAX_SPEED;
            if ((ratio > 0.82 || this.nitroT > 0) && this.state === "race") {
                const nLines = this.nitroT > 0 ? 18 : 8;
                for (let i = 0; i < nLines; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const r0 = 150 + Math.random() * 80;
                    const len = 20 + Math.random() * (this.nitroT > 0 ? 70 : 35);
                    const cx = W / 2, cy = H / 2 + 20;
                    fx.lineStyle(this.nitroT > 0 ? 2 : 1, 0xffffff, this.nitroT > 0 ? 0.6 : 0.35);
                    fx.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7, cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len) * 0.7);
                }
            }
        }
        drawSegment(g, seg, th) {
            const { p1, p2 } = seg;
            const L = seg.light ? 0 : 1;
            const fog = seg.fog;
            const c = (col) => mixColor(col, th.fog, fog);
            const x1 = p1.screen.x, y1 = p1.screen.y, w1 = p1.screen.w;
            const x2 = p2.screen.x, y2 = p2.screen.y, w2 = p2.screen.w;
            g.fillStyle(c(th.grass[L]), 1).fillRect(0, y2, W, y1 - y2); // +1 すると奥の芝が手前の道路に1px はみ出して線になる
            const r1 = w1 / 6, r2 = w2 / 6;
            const quad = (col, ax, ay, bx, by, cx, cy, dx, dy) => {
                g.fillStyle(c(col), 1);
                g.fillPoints([{ x: ax, y: ay }, { x: bx, y: by }, { x: cx, y: cy }, { x: dx, y: dy }], true);
            };
            quad(th.rumble[L], x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2);
            quad(th.rumble[L], x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2);
            if (seg.checker) {
                const n = 10;
                for (let k = 0; k < n; k++) {
                    const a1 = x1 - w1 + (2 * w1 * k) / n, b1 = x1 - w1 + (2 * w1 * (k + 1)) / n;
                    const a2 = x2 - w2 + (2 * w2 * k) / n, b2 = x2 - w2 + (2 * w2 * (k + 1)) / n;
                    quad((k + seg.index) % 2 ? 0x101010 : 0xf8f8f8, a1, y1, b1, y1, b2, y2, a2, y2);
                }
                return;
            }
            quad(th.road[L], x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
            if (seg.oil) {
                // オイル: 路面に描く(前後は細く、セグメントごとに色を変えて光って見せる)
                const o = seg.oil;
                const k = seg.index - o.segIdx;
                const taper = Math.min(1, (k + 1) / 3, (OIL_LEN - k) / 3); // 前後を細くして水たまりの形に
                const cx1 = x1 + o.offset * w1, cx2 = x2 + o.offset * w2;
                const h1 = o.half * w1 * taper, h2 = o.half * w2 * taper;
                // ほぼ黒一色、ところどころ青紫の光沢
                quad(k % 4 === 2 ? 0x3a4068 : 0x101018, cx1 - h1, y1, cx1 + h1 * 0.9, y1, cx2 + h2 * 0.9, y2, cx2 - h2, y2);
            }
            if (seg.light) {
                const lw1 = w1 / 32, lw2 = w2 / 32;
                const step1 = (2 * w1) / LANES, step2 = (2 * w2) / LANES;
                for (let lane = 1; lane < LANES; lane++) {
                    const lx1 = x1 - w1 + step1 * lane, lx2 = x2 - w2 + step2 * lane;
                    quad(th.lane, lx1 - lw1 / 2, y1, lx1 + lw1 / 2, y1, lx2 + lw2 / 2, y2, lx2 - lw2 / 2, y2);
                }
            }
        }

        // ---------- finish / result ----------
        crossFinish() {
            this.place = this.finishOrder.length + 1;
            this.state = "finished";
            this.nitroT = 0;
            const bonus = [5000, 3000, 2000][this.place - 1] || 0;
            this.score += bonus;
            this.updateHud();
            const ok = this.place <= 3;
            audio.playMusic(ok ? "clear" : "gameover");
            this.showBanner(tr("finish"), `${tr("place", this.place)}`, ok ? COL.yellow : COL.red);
            this.time.delayedCall(3200, () => {
                audio.stopEngine();
                if (ok) this.stageClear();
                else this.gameOver();
            });
        }
        perfect() { return this.itemsGot >= ITEMS_PER_STAGE; }
        buildRewards(scene, stage, character = prompts.character) {
            const out = [];
            const add = (text, source, extra = {}) => { if (text) out.push({ type: "prompt", text, weight: 1, source, ...extra }); };
            add(prompts.style, "style");
            add(character, "character");
            add(scene, "scene");
            if (stage) add(stage.clear_prompt, "clear", { stage: stage.id });
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
                gameId: GAME_ID, kind, cleared, score: this.score, bonus, place: this.place,
                items: this.itemsGot, itemsTotal: ITEMS_PER_STAGE,
                stage: this.stageIndex + 1, stagesTotal: stages.length, stageName: loc(this.stage.name),
                negative, rewards,
            };
        }
        stageClear() {
            this.state = "stageclear";
            try { host.stageClear?.(this.result("stage")); } catch (e) { console.error("[racer] host.stageClear failed", e); }
            const last = this.stageIndex >= stages.length - 1;
            const perfect = this.perfect();
            if (perfect) { audio.sfx("perfect"); this.showBanner(tr("perfect"), tr("privatePhoto")); }
            else this.showBanner(tr("stageClear"), this.stage.clear_prompt ? `"${this.stage.clear_prompt}"` : "");
            this.time.delayedCall(2400, () => {
                this.hideBanner();
                const proceed = () => {
                    if (last) this.allClear();
                    else this.scene.restart({ stageIndex: this.stageIndex + 1, score: this.score });
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
        gameOver(lines = prompts.gameover_story || []) {
            finish(this.result("gameover"));
            this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(75);
            const showOver = () => {
                this.state = "done";
                this.doneAt = performance.now();
                this.showBanner(tr("gameOver"), `SCORE ${pad(this.score)}\n\n${tr("again")}`, COL.red);
                ctx.advance = false;
            };
            if (lines.length && !ctx.skipStory) this.startStory(lines, showOver, "gameover");
            else { audio.playMusic("gameover"); showOver(); }
        }

        // ---------- main loop ----------
        update(_t, delta) {
            const dt = Math.min(0.05, delta / 1000);
            if (this.state === "done") {
                if (ctx.advance) { ctx.advance = false; if (performance.now() - this.doneAt > 1500) restart(); }
                return;
            }
            if (ctx.pauseToggle) {
                ctx.pauseToggle = false;
                if (this.state === "race" || this.state === "countdown") this.paused = !this.paused;
            }
            const shouldPause = this.paused || ctx.externalPause;
            if (shouldPause !== this._wasPaused) {
                this._wasPaused = shouldPause;
                this.pauseText.setVisible(shouldPause);
                this.time.paused = shouldPause;
                if (shouldPause) this.tweens.pauseAll(); else this.tweens.resumeAll();
                syncAudioPause();
            }
            if (shouldPause) return;
            if (ctx.debugFinishPlace) { const p = ctx.debugFinishPlace; ctx.debugFinishPlace = 0; this.applyDebugFinish(p); }

            this.cloudDrift += dt;
            if (this.state === "story") {
                this.story.update(dt, ctx.advance);
                ctx.advance = false;
                for (const c of this.clouds) c.layer.tilePositionX = this.bgOffset * c.parallax + this.cloudDrift * c.speed;
                return;
            }
            if (this.state === "countdown") {
                this.countT -= dt;
                const n = Math.ceil(this.countT - 0.6);
                if (n !== this.lastCount && n >= 1 && n <= 3) {
                    this.lastCount = n;
                    this.showBanner(String(n), "");
                    audio.sfx("countdown");
                }
                if (this.countT <= 0.6) {
                    this.state = "race";
                    this.showBanner(tr("go"), "");
                    audio.sfx("go");
                    const m = STAGE_MUSIC[this.stageIndex] || STAGE_MUSIC[0];
                    audio.playMusic("race", m);
                    this.time.delayedCall(700, () => { if (this.state === "race") this.hideBanner(); });
                }
                ctx.nitroPress = false;
            }
            if (this.state === "race") this.raceTime += dt;
            if (this.state === "race" || this.state === "finished" || this.state === "countdown") {
                this.updatePed(dt);
                this.updatePlayer(dt);
                this.updateCars(dt);
                const seg = this.findSegment(this.position + PLAYER_Z);
                this.bgOffset += seg.curve * (this.speed / MAX_SPEED) * dt * 60;
            }
            ctx.advance = false;
            this.render3d();
            this.updateHud();
        }

        // ---------- debug ----------
        applyDebugFinish(place) {
            // place-1 台を先にゴールさせ、自機をゴール直前へ
            const order = [...this.cars].sort((a, b) => b.z - a.z);
            order.forEach((c, i) => {
                if (i < place - 1) { c.z = this.track.finishZ + SEG * (10 + i); if (!c.finished) { c.finished = true; this.finishOrder.push(c); } }
                else c.z = Math.min(c.z, this.track.finishZ - SEG * 40);
                this.placeCar(c);
            });
            this.state = "race";
            this.story.hide();
            this.position = this.track.finishZ - PLAYER_Z - SEG * 2;
            this.speed = MAX_SPEED * 0.8;
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
        scene: [TitleScene, RaceScene],
    });

    function restart() {
        Object.assign(ctx, { finished: false, debugClear: false, skipStory: false, externalPause: false, advance: false, nitroPress: false, play: null });
        audio.stopEngine();
        audio.setPaused(false);
        const run = () => {
            ["race", "title"].forEach((key) => { if (game.scene.isActive(key) || game.scene.isPaused(key)) game.scene.stop(key); });
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
        /** 動作確認用: 指定の順位でゴール直前へ(1〜8) */
        debugFinish(place = 1) { ctx.debugFinishPlace = clamp(place | 0, 1, RIVAL_COLORS.length + 1); return true; },
        /** 動作確認用: 最終レースを1位でゴールする(会話は飛ばす) */
        debugClear() {
            ctx.skipStory = true;
            game.scene.stop("title");
            game.scene.start("race", { stageIndex: stages.length - 1, score: 0 });
            setTimeout(() => { ctx.debugFinishPlace = 1; }, 300);
            return true;
        },
        /** 動作確認用: 障害物(box / oil / ped)の手前へ移動する。ped は無ければ作る */
        debugJumpTo(kind = "box", segsBefore = 30) {
            const p = ctx.play;
            if (!p || p.state !== "race") return false;
            const me = p.position + PLAYER_Z;
            let ob = p.track.obstacles.find((o) => o.kind === kind && !o.broken && !o.done && (o.z ?? o.zStart) > me);
            if (!ob && kind === "ped") {
                const idx = Math.floor(me / SEG) + 120;
                ob = { kind: "ped", segIdx: idx, z: (idx + 0.5) * SEG, offset: -0.45, dir: 1, walking: false, done: false, t: 0 };
                p.segs[idx].obstacles.push(ob);
                p.track.obstacles.push(ob);
                p.ped = ob;
            }
            if (!ob) return false;
            p.position = (ob.z ?? ob.zStart) - PLAYER_Z - SEG * segsBefore;
            p.playerX = ob.offset;
            if (kind === "ped") {
                // 確実に当たるよう、自機の正面・すぐ手前に置く
                Object.assign(ob, { offset: 0, walking: true, done: false });
                p.playerX = 0;
                p.position = ob.z - PLAYER_Z - SEG * 3;
            }
            p.speed = MAX_SPEED * 0.7;
            return { kind, offset: +ob.offset.toFixed(2) };
        },
        debugGameOver() { ctx.debugFinishPlace = RIVAL_COLORS.length + 1; return true; },
        debugCollectAll() { const p = ctx.play; if (!p) return false; p.itemsGot = ITEMS_PER_STAGE; p.track.items.forEach((i) => { i.got = true; }); return true; },
        debugStartStage(n) {
            const i = clamp((n | 0) - 1, 0, stages.length - 1);
            ["race", "title"].forEach((key) => { if (game.scene.isActive(key)) game.scene.stop(key); });
            ctx.finished = false;
            game.scene.start("race", { stageIndex: i, score: 0 });
            return i + 1;
        },
        debugState() {
            const p = ctx.play;
            return p && p.sys.isActive() ? {
                state: p.state, spin: +(p.spinT || 0).toFixed(2), ped: p.ped ? { offset: +p.ped.offset.toFixed(2), walking: p.ped.walking, done: p.ped.done } : null,
                boxes: p.track.obstacles.filter((o) => o.kind === "box").map((o) => o.broken), oil: p.track.obstacles.some((o) => o.kind === "oil"),
                stage: p.stageIndex + 1, kmh: Math.round(p.speed * KMH), squeal: +(p.squeal || 0).toFixed(2), rank: p.rank(), place: p.place,
                progress: Math.round(((p.position + PLAYER_Z) / p.track.finishZ) * 100), playerX: +p.playerX.toFixed(2),
                items: p.itemsGot, nitro: p.nitroLeft, time: +p.raceTime.toFixed(1), score: p.score, paused: !!p.paused,
                storyLine: p.state === "story" ? p.story.idx : null,
            } : null;
        },
    };
}

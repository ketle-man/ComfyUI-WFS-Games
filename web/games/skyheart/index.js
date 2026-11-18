/**
 * SKY HEART — 80年代風・疑似3Dの飛行シューティング (WFS Games 第4弾、すべてオリジナル)
 *
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debug... }
 *
 * host: apiVersion / lang / settings { difficulty, sound, bgm } / runStart() / stageClear(result) / finish(result)
 * result: { gameId, kind: "stage"|"ending"|"gameover", cleared, score, bonus, items, stage, stagesTotal, stageName, negative, rewards }
 *
 * 画面の奥へ向かって飛ぶ。座標は「自機の奥行き(ZP)での画面座標」x, y と奥行き z で持つ。
 * 投影: s = ZP / z、画面上の位置 = 消失点 + (x, y - 消失点) * s。z = ZP で画面座標そのものになる。
 * 消失点は自機の位置と逆向きに少し動く(視点が動いて見える)。自機の弾はまっすぐ奥へ飛ぶので、敵と重なる位置で撃つ。
 */
import * as Phaser from "../../vendor/phaser/phaser.esm.min.js";
import { createAudio } from "../../common/audio.js";
import { loadFont, txt, COL, pad, StoryBox, addScanlines } from "../../common/retro.js";
import { SONGS } from "./songs.js";
import { makeSkyTextures, makeThemeTextures } from "./sprites.js";

const GAME_ID = "skyheart";
const W = 480;
const H = 320;
const HISCORE_KEY = "wfs_games_skyheart_hiscore";
const ITEMS_PER_STAGE = 5;

// ---- 奥行きと投影 ----
const ZP = 100;              // 自機のいる奥行き
const ZFAR = 2600;           // これより奥は描かない
const ZNEAR = 45;            // 地面を描く手前の端
const HORIZON = 118;         // 地平線(消失点)の高さの基準
const GROUND_Y = H - 6;      // 地面の高さ(ZP での画面座標)
const SCROLL = 1000;         // 地面が流れる速さ(奥行き/秒)
const BAND = 120;            // 地面の縞の幅(奥行き)
const BOSS_Z = 380;
const PLAYER_SPEED = 240;
const PX_MIN = 28, PX_MAX = W - 28, PY_MIN = 46, PY_MAX = GROUND_Y - 22;
const FIRE_INTERVAL = 0.11;
const SHOT_SPEED = 2200;

const DIFFICULTY = {
    easy: { lives: 5, bullet: 720, fire: 0.6, hp: 0.8 },
    normal: { lives: 3, bullet: 900, fire: 1.0, hp: 1.0 },
    hard: { lives: 3, bullet: 1080, fire: 1.4, hp: 1.25 },
};

// ---- ステージごとの景色 ----
const THEMES = {
    meadow: {
        key: "meadow", sky: [0x2060e0, 0x3078f0, 0x4890f8, 0x68b0f8, 0x90d0f8], ground: [0x68d050, 0x3c9830], line: 0xb8f8a8, fog: 0xa8d8f8,
        far: 0x5888b8, farType: "mountains", snow: true, obstacle: "tree", objA: 0x38b838, objB: 0x187818, objScale: 3, objDensity: 1,
    },
    crystal: {
        key: "crystal", sky: [0x201040, 0x302058, 0x483078, 0x6848a0, 0x9878d0], ground: [0x6848b8, 0x3c2078], line: 0xd8b8f8, fog: 0x9878d0,
        far: 0x382060, farType: "mountains", obstacle: "crystal", objA: 0xc898f8, objB: 0x6848a8, objScale: 3.2, objDensity: 1.1, stars: true,
    },
    sea: {
        key: "sea", sky: [0xd84828, 0xf06838, 0xf88848, 0xf8a858, 0xf8c878], ground: [0x2870d8, 0x1440a0], line: 0xf8d898, fog: 0xf8b878,
        far: 0x804050, farType: "sea", obstacle: "rock", objA: 0x886858, objB: 0x584038, objScale: 2.6, objDensity: 0.8, sun: 0xf8e858,
    },
    city: {
        key: "city", sky: [0x080818, 0x101028, 0x181838, 0x282050, 0x382060], ground: [0x202038, 0x0c0c18], line: 0xf858f8, fog: 0x382060,
        far: 0x202040, farType: "city", obstacle: "tower", objA: 0x303050, objB: 0xf858f8, objScale: 4, objDensity: 0.9, stars: true, objHp: 4, // ビルは4発で壊せる
    },
    moon: {
        key: "moon", sky: [0x000010, 0x080820, 0x101830, 0x182840, 0x283850], ground: [0x686878, 0x404050], line: 0xc8c8d8, fog: 0x283850,
        far: 0x384058, farType: "mountains", obstacle: "column", objA: 0xd8d8e0, objB: 0x9898a8, objScale: 3.4, objDensity: 1, stars: true, moon: true,
    },
};

// 敵の大きさ(ZP での拡大率)と得点
const ENEMY = {
    drone: { scale: 2.4, score: 100 },
    wing: { scale: 2.4, score: 150 },
    orb: { scale: 2.6, score: 300 },
    jet: { scale: 2.4, score: 200 },
};
const BOSS_SCALE = 9;
// 地上のミサイル発射台
const LAUNCHER_SCALE = 3.4;
const LAUNCHER_FIRE_Z = [1400, 600]; // この奥行きの間に入ったらミサイルを撃つ
const GROUND_HEART_Y = GROUND_Y - 16; // 地上のハートの高さ(低く飛べば取れる)
// パワーアップ(空中・地上の両方に出る)
const POWERUPS_PER_STAGE = 4;
const BARRIER_HITS = 3;     // バリア1個で耐えられる回数
const BARRIER_MAX = 5;
const SUPPORT_TIME = 15;    // サポートメカが一緒に撃つ秒数
const OPTION_DX = 38;       // サポートメカの自機からの横の距離
const POWER_INFO = {
    "1up": { key: "cap_1up", color: 0x38c858, label: "1UP!" },
    barrier: { key: "cap_barrier", color: 0x58e8f8, label: "BARRIER" },
    support: { key: "cap_support", color: 0xf89838, label: "SUPPORT" },
};

const TEXT = {
    en: {
        title: "SKY HEART", pushStart: "PUSH SPACE KEY",
        controls: "MOVE ← → ↑ ↓   SHOT SPACE/Z (HOLD)   PAUSE ESC",
        stage: (n) => `STAGE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "ALL HEARTS: PRIVATE PHOTO",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / CLICK",
        warning: "WARNING!", ready: "READY", difficulty: { easy: "EASY", normal: "NORMAL", hard: "HARD" },
    },
    ja: {
        title: "SKY HEART", pushStart: "PUSH SPACE KEY",
        controls: "移動 ← → ↑ ↓   ショット SPACE/Z (押しっぱなし)   一時停止 ESC",
        stage: (n) => `STAGE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "ハート全部獲得: プライベート写真",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / クリック",
        warning: "WARNING!", ready: "READY", difficulty: { easy: "やさしい", normal: "ふつう", hard: "むずかしい" },
    },
    zh: {
        title: "SKY HEART", pushStart: "PUSH SPACE KEY",
        controls: "移动 ← → ↑ ↓   射击 SPACE/Z (按住)   暂停 ESC",
        stage: (n) => `STAGE ${n}`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "全部爱心获得: 私人照片",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / 点击",
        warning: "WARNING!", ready: "READY", difficulty: { easy: "简单", normal: "普通", hard: "困难" },
    },
};

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS", "KeyZ", "KeyP", "Escape", "Enter"]);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function mixColor(c1, c2, t) {
    if (t <= 0) return c1;
    if (t >= 1) return c2;
    const r = Math.round(lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t));
    const g = Math.round(lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t));
    const b = Math.round(lerp(c1 & 255, c2 & 255, t));
    return (r << 16) | (g << 8) | b;
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
    const heroineName = loc(data.heroine?.name) || "HIKARI";
    const audio = createAudio({ sound: settings.sound !== false, bgm: settings.bgm !== false, songs: SONGS });

    const ctx = { finished: false, skipStory: false, externalPause: false, pauseToggle: false, advance: false, play: null, hiScore: loadHiScore(), invincible: false };

    const finish = (result) => {
        if (ctx.finished) return;
        ctx.finished = true;
        try { host.finish?.(result); } catch (e) { console.error("[skyheart] host.finish failed", e); }
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
    };
    container.addEventListener("keydown", onKey);
    container.addEventListener("keyup", onKey);
    const focusRoot = () => root.focus({ preventScroll: true });
    const onPointer = () => { focusRoot(); audio.unlock(); ctx.advance = true; };
    root.addEventListener("pointerdown", onPointer);

    // ---------------- 背景(空・遠景・地面)を描く共通処理 ----------------

    function buildWorld(scene, theme) {
        makeSkyTextures(scene);
        makeThemeTextures(scene, theme);
        const w = {
            theme,
            sky: scene.add.graphics().setDepth(0),
            far: scene.add.tileSprite(0, 0, W, 60, `far_${theme.key}`).setOrigin(0, 1).setDepth(2),
            ground: scene.add.graphics().setDepth(5),
            stars: [],
            scroll: 0,
            drift: 0,
            vp: { x: W / 2, y: HORIZON },
        };
        if (theme.stars) {
            for (let i = 0; i < 40; i++) w.stars.push({ x: Math.random() * W * 1.4 - W * 0.2, y: Math.random() * HORIZON, b: Math.random() });
        }
        return w;
    }

    function drawWorld(w) {
        const { theme, vp } = w;
        const sy = (z) => vp.y + (GROUND_Y - vp.y) * (ZP / z);
        // 空
        const g = w.sky;
        g.clear();
        const n = theme.sky.length;
        const bandH = vp.y / n;
        theme.sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, Math.floor(i * bandH), W, Math.ceil(bandH) + 1));
        for (const s of w.stars) {
            const x = s.x + (vp.x - W / 2) * 0.15;
            if (s.y < vp.y - 4) g.fillStyle(0xf8f8f8, 0.4 + 0.6 * Math.abs(Math.sin(w.drift * 2 + s.b * 9))).fillRect(x, s.y, 1, 1);
        }
        if (theme.moon) {
            const mx = W * 0.72 + (vp.x - W / 2) * 0.2;
            g.fillStyle(0xf8f0c8, 1).fillCircle(mx, vp.y - 62, 22);
            g.fillStyle(0xe0d8a8, 1).fillCircle(mx - 7, vp.y - 66, 5).fillCircle(mx + 8, vp.y - 55, 4);
        }
        if (theme.sun) {
            const sx = W * 0.5 + (vp.x - W / 2) * 0.25;
            g.fillStyle(theme.sun, 1).fillCircle(sx, vp.y - 14, 26);
            g.fillStyle(theme.sky[n - 1], 1);
            for (let i = 0; i < 4; i++) g.fillRect(sx - 30, vp.y - 14 + i * 5, 60, 1 + i);
        }
        // 遠景
        w.far.setPosition(0, vp.y + 1);
        w.far.tilePositionX = -(vp.x - W / 2) * 0.35 + w.drift * 4;
        // 地面: 奥から手前へ流れる縞
        const gr = w.ground;
        gr.clear();
        gr.fillStyle(theme.fog, 1).fillRect(0, vp.y, W, H - vp.y);
        const phase = w.scroll % (BAND * 2);
        for (let k = 0; ; k++) {
            const zn = Math.max(ZNEAR, ZNEAR + k * BAND - phase);
            const zf = ZNEAR + (k + 1) * BAND - phase;
            if (zf <= ZNEAR) continue;
            if (zn > ZFAR) break;
            const yn = sy(zn);
            const yf = sy(zf);
            const fog = Math.pow(clamp(zf / ZFAR, 0, 1), 1.1);
            gr.fillStyle(mixColor(theme.ground[k % 2], theme.fog, fog), 1).fillRect(0, Math.floor(yf), W, Math.ceil(yn - yf) + 1);
        }
        // 奥へ向かう線
        gr.lineStyle(1, theme.line, 0.45);
        const yNear = sy(ZNEAR);
        const yFar = sy(ZFAR);
        for (let i = -16; i <= 16; i++) {
            const X = W / 2 + i * 64;
            gr.lineBetween(vp.x + (X - vp.x) * (ZP / ZFAR), yFar, vp.x + (X - vp.x) * (ZP / ZNEAR), yNear);
        }
    }

    function updateVp(w, px, py) {
        w.vp.x = W / 2 - (px - W / 2) * 0.55;
        w.vp.y = HORIZON - (py - H * 0.5) * 0.22;
    }

    // 奥行きのある点を画面へ。s は拡大率
    const project = (w, x, y, z) => {
        const s = ZP / z;
        return { sx: w.vp.x + (x - w.vp.x) * s, sy: w.vp.y + (y - w.vp.y) * s, s };
    };
    // 手前ほど上に重ねる
    const depthOf = (z) => 100 + (1 - clamp(z / ZFAR, 0, 1)) * 100;

    // ---------------- title ----------------

    class TitleScene extends Phaser.Scene {
        constructor() { super("title"); }
        create() {
            this.started = false;
            this.world = buildWorld(this, THEMES.meadow);
            this.t = 0;
            const g = this.add.graphics().setDepth(250);
            g.lineStyle(2, 0xf8f8f8, 1).strokeRect(10, 10, W - 20, H - 20);
            g.lineStyle(2, 0x58e8f8, 1).strokeRect(15, 15, W - 30, H - 30);
            txt(this, W / 2 + 3, 51, tr("title"), 32, COL.magenta).setOrigin(0.5).setDepth(250);
            txt(this, W / 2, 48, tr("title"), 32, COL.yellow).setOrigin(0.5).setDepth(250);
            txt(this, W / 2, 80, `- ${tr("difficulty")[settings.difficulty] || ""} -`, 16, COL.white).setOrigin(0.5).setDepth(250);
            this.add.graphics().setDepth(250).lineStyle(2, 0xf8f8f8, 1).strokeRect(W / 2 - 108, 112, 56, 56);
            this.add.image(W / 2 - 80, 140, "hikari_face").setDepth(250);
            txt(this, W / 2 - 80, 180, heroineName, 16, COL.yellow).setOrigin(0.5).setDepth(250);
            this.hero = this.add.image(W / 2 + 60, 150, "hikari").setScale(1.6).setDepth(250);
            const start = txt(this, W / 2, 232, tr("pushStart"), 16, COL.yellow).setOrigin(0.5).setDepth(250);
            this.time.addEvent({ delay: 480, loop: true, callback: () => start.setVisible(!start.visible) });
            txt(this, W / 2, 266, tr("controls"), 16, COL.white).setOrigin(0.5).setScale(0.62).setDepth(250);
            txt(this, W / 2, 288, `HI ${pad(ctx.hiScore)}`, 16, COL.white).setOrigin(0.5).setScale(0.8).setDepth(250);
            ctx.advance = false;
            audio.playMusic("title");
        }
        begin() {
            if (this.started) return;
            this.started = true;
            audio.unlock();
            audio.sfx("start");
            try { host.runStart?.(); } catch (e) { console.error("[skyheart] host.runStart failed", e); }
            this.scene.start("play", { stageIndex: 0, score: 0, lives: diff.lives });
        }
        update(_t, delta) {
            const dt = Math.min(0.05, delta / 1000);
            this.t += dt;
            const w = this.world;
            w.scroll += SCROLL * 0.6 * dt;
            w.drift += dt;
            updateVp(w, W / 2 + Math.sin(this.t * 0.6) * 90, H * 0.5 + Math.sin(this.t * 0.9) * 30);
            drawWorld(w);
            this.hero.setPosition(W / 2 + 60 + Math.sin(this.t * 1.2) * 6, 150 + Math.sin(this.t * 2) * 4).setAngle(Math.sin(this.t * 1.2) * 6);
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
            this.barrier = d.barrier ?? 0;      // 残りの耐えられる回数
            this.supportT = d.supportT ?? 0;    // サポートメカの残り秒数
            this.stage = stages[this.stageIndex];
            this.theme = THEMES[this.stage.theme] || THEMES.meadow;
        }

        create() {
            ctx.play = this;
            ctx.pauseToggle = false;
            this.paused = false;
            this._wasPaused = false;
            this.world = buildWorld(this, this.theme);
            this.state = "intro";
            this.time0 = 0;
            this.px = W / 2;
            this.py = H * 0.55;
            this.vx = 0;
            this.fireCd = 0;
            this.invuln = 0;
            this.alive = true;
            this.objs = [];       // 地上の障害物
            this.enemies = [];
            this.shots = [];
            this.bullets = [];
            this.items = [];
            this.itemsGot = 0;
            this.spawnT = 1.5;
            this.objT = 0;
            this.boss = null;
            // ハートはステージ中に5回、間隔をあけて飛んでくる
            const dur = this.stage.duration || 40;
            this.heartTimes = Array.from({ length: ITEMS_PER_STAGE }, (_, i) => dur * (i + 0.6) / (ITEMS_PER_STAGE + 0.4));
            // 地上にも同じ数のハート(空中のハートの合間に来る)。どちらでも合わせて5個取ればプライベート写真
            this.groundHeartTimes = this.heartTimes.map((t, i) => t + dur / (ITEMS_PER_STAGE + 0.4) * 0.5 * (i % 2 ? 0.8 : 1.1));
            // ミサイル発射台(後のステージほど多い)
            const nl = 3 + this.stageIndex;
            this.launcherTimes = Array.from({ length: nl }, (_, i) => 3 + (dur - 6) * (i + 0.5) / nl + rand(-1.5, 1.5)).sort((a, b) => a - b);
            this.launchers = [];
            // パワーアップ: 空中と地上を交互に。1UP は1ステージ1個まで
            this.powerTimes = Array.from({ length: POWERUPS_PER_STAGE }, (_, i) => dur * (i + 0.35) / POWERUPS_PER_STAGE + rand(-1, 1));
            this.powerCount = 0;
            this.oneUpGiven = false;

            this.shadow = this.add.image(0, 0, "shadow").setAlpha(0.35).setDepth(depthOf(ZP) - 0.5);
            this.player = this.add.image(this.px, this.py, "hikari").setScale(1.5).setDepth(depthOf(ZP));
            this.flame = this.add.image(0, 0, "spark").setScale(2).setTint(0xf8a838).setDepth(depthOf(ZP) - 0.2);
            this.options = [-1, 1].map((side) => ({ side, x: this.px + side * OPTION_DX, y: this.py, sprite: this.add.image(0, 0, "option").setScale(1.3).setDepth(depthOf(ZP) + 0.1).setVisible(false) }));
            this.barrierG = this.add.graphics().setDepth(depthOf(ZP) + 0.3);

            this.buildHud();
            this.banner = txt(this, W / 2, 96, "", 32, COL.yellow).setOrigin(0.5).setDepth(320).setVisible(false);
            this.subBanner = txt(this, W / 2, 128, "", 16, COL.white).setOrigin(0.5, 0).setDepth(320).setVisible(false);
            this.subBanner.setWordWrapWidth(W - 60, true);
            this.pauseText = txt(this, W / 2, H / 2, tr("paused"), 32, COL.white).setOrigin(0.5).setDepth(340).setVisible(false);
            this.story = new StoryBox(this, { W, H, portrait: "hikari_face", speakerName: heroineName, nextLabel: tr("next"), loc, sfx: (n) => audio.sfx(n), depth: 330 });

            this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,Z");
            this.render3d();
            this.updateHud();

            const before = this.stage.story_before || [];
            if (before.length && !ctx.skipStory) this.startStory(before, () => this.startIntro());
            else this.startIntro();
        }

        // ---------- HUD ----------
        buildHud() {
            const D = 300;
            this.scoreText = txt(this, 10, 6, "", 16, COL.white).setDepth(D);
            this.hiText = txt(this, W / 2, 6, "", 16, COL.yellow).setOrigin(0.5, 0).setDepth(D);
            this.stageText = txt(this, W - 10, 6, `${tr("stage", this.stageIndex + 1)}`, 16, this.stage.color || COL.white).setOrigin(1, 0).setDepth(D);
            this.hearts = [];
            for (let i = 0; i < ITEMS_PER_STAGE; i++) this.hearts.push(this.add.image(W - 14 - (ITEMS_PER_STAGE - 1 - i) * 12, 34, "heart_s").setDepth(D));
            this.lifeIcons = [];
            this.powerText = txt(this, W - 10, H - 22, "", 16, COL.cyan).setOrigin(1, 0).setDepth(D).setScale(0.75);
            this.bossBar = this.add.graphics().setDepth(D);
            this.bossLabel = txt(this, W / 2, 28, "", 16, COL.red).setOrigin(0.5, 0).setDepth(D).setScale(0.75).setVisible(false);
            // 高度計(左端の縦のゲージ)。近づいてくるハートの高さもピンクの印で出す
            this.alt = this.add.graphics().setDepth(D);
            txt(this, 6, 46, "ALT", 16, COL.cyan).setDepth(D).setScale(0.6);
            this.altText = txt(this, 6, H - 52, "", 16, COL.cyan).setDepth(D).setScale(0.6);
        }
        drawAltimeter() {
            const g = this.alt;
            g.clear();
            const x = 12, top = 64, bot = H - 58, h = bot - top;
            const toY = (py) => bot - clamp((GROUND_Y - py) / (GROUND_Y - PY_MIN), 0, 1) * h;
            g.fillStyle(0x000010, 0.55).fillRect(x - 4, top - 4, 16, h + 8);
            g.lineStyle(1, 0x58e8f8, 0.9).strokeRect(x - 4, top - 4, 16, h + 8);
            for (let i = 0; i <= 4; i++) g.fillStyle(0x58e8f8, 0.8).fillRect(x - 2, top + (h * i) / 4, i % 2 ? 4 : 8, 1);
            g.fillStyle(0x58e858, 0.9).fillRect(x - 4, bot + 2, 16, 2); // 地面
            // 近づいてくるハート(奥行き 1600 以内)の高さ
            for (const it of this.items) {
                if (it.dead || it.z > 1600 || it.z < ZP) continue;
                const a = 1 - (it.z - ZP) / 1500;
                g.fillStyle(it.power ? POWER_INFO[it.power].color : 0xf858f8, 0.35 + a * 0.65).fillRect(x + 6, toY(it.y) - 1, 6, 3);
            }
            // 自機
            const y = toY(this.py);
            g.fillStyle(0xf8f048, 1).fillTriangle(x - 3, y - 4, x - 3, y + 4, x + 5, y);
            this.altText.setText(String(Math.round(((GROUND_Y - this.py) / (GROUND_Y - PY_MIN)) * 300)).padStart(3, "0"));
        }
        updateHud() {
            if (this.score > ctx.hiScore) ctx.hiScore = this.score;
            this.scoreText.setText(`SCORE ${pad(this.score)}`);
            this.hiText.setText(`HI ${pad(ctx.hiScore)}`);
            this.hearts.forEach((h, i) => h.setAlpha(i < this.itemsGot ? 1 : 0.2));
            this.drawAltimeter();
            const want = Math.max(0, this.lives - 1);
            if (this.lifeIcons.length !== want) {
                this.lifeIcons.forEach((i) => i.destroy());
                this.lifeIcons = [];
                for (let i = 0; i < want; i++) this.lifeIcons.push(this.add.image(16 + i * 18, H - 16, "life").setDepth(300));
            }
            const st = [];
            if (this.barrier > 0) st.push(`BARRIER ${this.barrier}`);
            if (this.supportT > 0) st.push(`SUPPORT ${Math.ceil(this.supportT)}`);
            this.powerText.setText(st.join("  "));
            const g = this.bossBar;
            g.clear();
            if (this.boss && this.boss.hp > 0) {
                const w = 200, x = W / 2 - w / 2, y = 46;
                g.fillStyle(0x303040, 1).fillRect(x, y, w, 6);
                g.fillStyle(0xf85858, 1).fillRect(x, y, w * (this.boss.hp / this.boss.max), 6);
                g.lineStyle(1, 0xf8f8f8, 1).strokeRect(x - 1, y - 1, w + 2, 8);
            }
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
            const t = txt(this, x, y, text, 16, color).setOrigin(0.5).setDepth(310).setScale(0.75);
            this.tweens.add({ targets: t, y: y - 24, alpha: 0, duration: 700, onComplete: () => t.destroy() });
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
            this.introT = 2.2;
            this.showBanner(tr("stage", this.stageIndex + 1), loc(this.stage.name), this.stage.color || COL.yellow);
            audio.playMusic("stage", { transpose: [0, 2, -1, 3, 5][this.stageIndex] || 0, bpm: 156 + this.stageIndex * 3 });
        }

        // ---------- 出現 ----------
        spawnWave() {
            const kinds = this.stage.enemies || ["drone"];
            const kind = pick(kinds);
            const cx = rand(PX_MIN + 60, PX_MAX - 60);
            const cy = rand(PY_MIN + 30, PY_MAX - 60);
            if (kind === "drone") {
                // 横一列で迫ってくる
                for (let i = 0; i < 5; i++) {
                    this.addEnemy("drone", { x: cx + (i - 2) * 46, y: cy, z: ZFAR + i * 60, vz: -720, wob: rand(0, 6), mode: "line" });
                }
            } else if (kind === "wing") {
                // 輪になって回りながら迫ってくる
                const n = 6;
                for (let i = 0; i < n; i++) {
                    this.addEnemy("wing", { cx, cy, a: (i / n) * Math.PI * 2, r: 70, z: ZFAR, vz: -620, mode: "ring" });
                }
            } else if (kind === "orb") {
                // 奥で止まって撃ってくる
                const cnt = Math.random() < 0.5 ? 1 : 2;
                for (let i = 0; i < cnt; i++) {
                    this.addEnemy("orb", { x: clamp(cx + (i ? 120 : -60), PX_MIN, PX_MAX), y: cy, z: ZFAR, vz: -900, hold: rand(650, 900), mode: "hover", t: 0, shots: 3, fireT: 1 });
                }
            } else {
                // 自機めがけて一直線に突っ込んでくる
                for (let i = 0; i < 3; i++) {
                    this.time.delayedCall(i * 280, () => {
                        if (this.state !== "play") return;
                        this.addEnemy("jet", { x0: rand(PX_MIN, PX_MAX), y0: rand(PY_MIN, PY_MAX - 40), tx: this.px, ty: this.py, z: ZFAR, z0: ZFAR, vz: -1500, mode: "dash" });
                    });
                }
            }
        }
        addEnemy(kind, props) {
            const def = ENEMY[kind];
            const sprite = this.add.image(0, 0, kind).setVisible(false);
            const tex = this.textures.get(kind).getSourceImage();
            const e = { kind, sprite, hp: kind === "orb" ? 3 : 1, score: def.score, scale: def.scale, r: (tex.width * def.scale) / 2 * 0.85, fired: false, x: 0, y: 0, ...props };
            this.updateEnemyPos(e, 0);
            this.enemies.push(e);
            return e;
        }
        updateEnemyPos(e, dt) {
            if (e.mode === "line") {
                e.z += e.vz * dt;
                e.wob += dt * 3;
                e.x += Math.sin(e.wob) * 30 * dt;
            } else if (e.mode === "ring") {
                e.z += e.vz * dt;
                e.a += dt * 1.8;
                e.x = e.cx + Math.cos(e.a) * e.r;
                e.y = e.cy + Math.sin(e.a) * e.r;
            } else if (e.mode === "hover") {
                e.t += dt;
                if (e.leaving) e.z += 1100 * dt;
                else if (e.z > e.hold) e.z = Math.max(e.hold, e.z + e.vz * dt);
                else {
                    e.x += Math.sin(e.t * 1.7) * 50 * dt;
                    e.fireT -= dt;
                    if (e.fireT <= 0 && e.shots > 0) { e.shots--; e.fireT = 1.0; this.fireAt(e, this.px, this.py); }
                    if (e.shots <= 0 && e.fireT <= 0) e.leaving = true;
                }
            } else if (e.mode === "dash") {
                e.z += e.vz * dt;
                const p = clamp(1 - (e.z - ZP) / (e.z0 - ZP), 0, 1.3);
                e.x = lerp(e.x0, e.tx, p);
                e.y = lerp(e.y0, e.ty, p);
            } else if (e.mode === "minion") {
                e.z += e.vz * dt;
                const p = clamp(1 - (e.z - ZP) / (e.z0 - ZP), 0, 1.3);
                e.x = lerp(e.x0, e.tx, p);
                e.y = lerp(e.y0, e.ty, p);
            }
            // 雑魚もときどき撃ってくる
            if (!e.fired && e.mode !== "hover" && e.mode !== "minion" && e.z < 1500 && e.z > 700) {
                e.fired = true;
                if (Math.random() < (this.stage.fire_rate || 0.2) * diff.fire) this.fireAt(e, this.px, this.py);
            }
        }
        spawnObstacle() {
            const t = this.theme;
            const tex = this.textures.get(`obj_${t.key}`).getSourceImage();
            // 自機が飛べる範囲と、その外側(飾り)に置く
            const x = Math.random() < 0.75 ? rand(PX_MIN - 20, PX_MAX + 20) : (Math.random() < 0.5 ? rand(-260, -20) : rand(W + 20, W + 260));
            const sprite = this.add.image(0, 0, `obj_${t.key}`).setOrigin(0.5, 1).setVisible(false);
            this.objs.push({ x, z: ZFAR, sprite, w: tex.width * t.objScale, h: tex.height * t.objScale, scale: t.objScale, hit: false, hp: t.objHp || 0 });
        }
        spawnHeart(onGround = false) {
            const sprite = this.add.image(0, 0, "heart").setVisible(false);
            const y = onGround ? GROUND_HEART_Y : rand(PY_MIN + 20, PY_MAX - 50);
            this.items.push({ x: rand(PX_MIN + 30, PX_MAX - 30), y, z: ZFAR, sprite, t: 0, ground: onGround });
        }
        spawnPowerup(onGround) {
            let kind = Math.random() < 0.5 ? "barrier" : "support";
            if (!this.oneUpGiven && Math.random() < 0.3) { kind = "1up"; this.oneUpGiven = true; }
            const sprite = this.add.image(0, 0, POWER_INFO[kind].key).setVisible(false);
            const y = onGround ? GROUND_HEART_Y : rand(PY_MIN + 20, PY_MAX - 50);
            this.items.push({ x: rand(PX_MIN + 30, PX_MAX - 30), y, z: ZFAR, sprite, t: 0, ground: onGround, power: kind });
        }
        takePowerup(kind) {
            const info = POWER_INFO[kind];
            if (kind === "1up") this.lives++;
            else if (kind === "barrier") this.barrier = Math.min(BARRIER_MAX, this.barrier + BARRIER_HITS);
            else if (kind === "support") {
                if (this.supportT <= 0) this.options.forEach((o) => { o.x = this.px + o.side * OPTION_DX; o.y = this.py; });
                this.supportT = SUPPORT_TIME;
            }
            this.score += 1000;
            audio.sfx(kind === "1up" ? "perfect" : "item");
            this.popup(info.label, this.px, this.py - 24, "#" + info.color.toString(16).padStart(6, "0"));
            this.updateHud();
        }
        spawnLauncher() {
            const tex = this.textures.get("launcher").getSourceImage();
            const sprite = this.add.image(0, 0, "launcher").setOrigin(0.5, 1).setVisible(false);
            const w = tex.width * LAUNCHER_SCALE, h = tex.height * LAUNCHER_SCALE;
            // ステージ3以降は2発撃つ
            this.launchers.push({ x: rand(PX_MIN + 10, PX_MAX - 10), z: ZFAR, sprite, w, h, hp: 2, shots: this.stageIndex >= 2 ? 2 : 1, fireT: 0, hitDone: false });
        }

        // 敵の弾: 撃った位置から、撃った瞬間の自機の位置へまっすぐ飛ぶ
        fireAt(src, tx, ty, key = "ebullet") {
            const sprite = this.add.image(0, 0, key).setVisible(false);
            const dist = Math.max(200, src.z - ZP);
            // 近くから撃たれても避けられるよう、届くまでの時間に下限をつける
            const T = Math.max(dist / diff.bullet, 0.95 * 900 / diff.bullet);
            this.bullets.push({ x0: src.x, y0: src.y, z0: src.z, tx, ty, t: 0, T, x: src.x, y: src.y, z: src.z, sprite, missile: key === "missile" });
            audio.sfx("dive");
        }

        // ---------- ボス ----------
        startWarning() {
            this.state = "warning";
            this.warnT = 2.4;
            this.showBanner(tr("warning"), loc(this.stage.boss?.name), COL.red);
            audio.stopMusic();
            audio.sfx("warning");
        }
        spawnBoss() {
            const b = this.stage.boss || { type: "bird", hp: 40 };
            const key = `boss_${b.type}`;
            const tex = this.textures.get(key).getSourceImage();
            const hp = Math.round((b.hp || 40) * diff.hp);
            const scale = BOSS_SCALE * (b.type === "final" ? 1.25 : 1);
            this.boss = {
                type: b.type, hp, max: hp, x: W / 2, y: 130, z: ZFAR, t: 0, state: "enter",
                sprite: this.add.image(0, 0, key).setVisible(false), scale, r: (tex.width * scale) / 2 * 0.7,
                timers: { aim: 1.5, ring: 2.0, spawn: 3.5, charge: 6 }, charge: null, flash: 0,
            };
            this.bossLabel.setText(loc(b.name)).setVisible(true);
            this.state = "boss";
            audio.playMusic("boss");
        }
        updateBoss(dt) {
            const b = this.boss;
            if (!b) return;
            b.t += dt;
            b.flash = Math.max(0, b.flash - dt);
            b.hitT = Math.max(0, (b.hitT || 0) - dt);
            if (b.state === "enter") {
                b.z = Math.max(BOSS_Z, b.z - 1400 * dt);
                if (b.z <= BOSS_Z) b.state = "fight";
            } else if (b.state === "fight" || b.state === "charge") {
                if (!b.charge) {
                    b.x = W / 2 + Math.sin(b.t * 0.7) * 140;
                    b.y = 120 + Math.sin(b.t * 1.1) * 45;
                }
                const T = b.timers;
                const kind = b.type;
                const every = (key, sec, fn) => { T[key] -= dt; if (T[key] <= 0) { T[key] = sec; fn(); } };
                if (!b.charge) {
                    if (kind === "bird" || kind === "final") every("aim", kind === "final" ? 1.5 : 1.3, () => { [-60, 0, 60].forEach((o) => this.fireAt(b, this.px + o, this.py)); });
                    if (kind === "core" || kind === "final") every("ring", kind === "final" ? 2.4 : 1.8, () => {
                        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + b.t; this.fireAt(b, this.px + Math.cos(a) * 110, this.py + Math.sin(a) * 80); }
                    });
                    if (kind === "core") every("aim", 2.6, () => this.fireAt(b, this.px, this.py));
                    if (kind === "fortress" || kind === "mech") every("aim", kind === "mech" ? 1.4 : 1.1, () => { this.fireAt(b, this.px, this.py); if (kind === "mech") this.time.delayedCall(180, () => this.boss && this.fireAt(this.boss, this.px, this.py)); });
                    if (kind === "fortress" || kind === "final") every("spawn", kind === "final" ? 6 : 4.5, () => {
                        for (let i = 0; i < 3; i++) {
                            this.addEnemy("drone", { x0: b.x + (i - 1) * 60, y0: b.y, tx: this.px + (i - 1) * 50, ty: this.py, z: b.z, z0: b.z, vz: -300, mode: "minion" });
                        }
                    });
                    if (kind === "mech" || kind === "final") every("charge", kind === "final" ? 9 : 6, () => { b.charge = { t: 0, tx: this.px, ty: this.py, x0: b.x, y0: b.y }; b.flash = 0.6; audio.sfx("charge"); });
                }
                if (b.charge) {
                    // 光ったあと、自機のいた位置へ突進して戻る
                    const c = b.charge;
                    c.t += dt;
                    if (c.t < 0.6) { /* 予告 */ } else if (c.t < 1.4) {
                        const p = (c.t - 0.6) / 0.8;
                        b.z = lerp(BOSS_Z, ZP + 20, p);
                        b.x = lerp(c.x0, c.tx, p);
                        b.y = lerp(c.y0, c.ty, p);
                    } else if (c.t < 2.4) {
                        b.z = lerp(ZP + 20, BOSS_Z, (c.t - 1.4) / 1.0);
                    } else { b.z = BOSS_Z; b.charge = null; }
                    if (b.z < ZP + 70 && this.invuln <= 0 && Math.hypot(b.x - this.px, b.y - this.py) < b.r * 0.55) this.playerHit();
                }
            } else if (b.state === "dying") {
                b.dieT -= dt;
                if (Math.random() < 0.4) { const p = project(this.world, b.x + rand(-b.r, b.r), b.y + rand(-b.r * 0.6, b.r * 0.6), b.z); this.explode(p.sx, p.sy, depthOf(b.z) + 1, 6); }
                if (b.dieT <= 0) {
                    b.sprite.destroy();
                    this.boss = null;
                    this.bossLabel.setVisible(false);
                    this.stageClear();
                }
            }
        }
        damageBoss() {
            const b = this.boss;
            if (!b || b.state === "enter" || b.state === "dying") return;
            b.hp--;
            b.hitT = 0.06;
            this.score += 10;
            audio.sfx("hit");
            if (b.hp <= 0) {
                b.state = "dying";
                b.dieT = 2.0;
                b.charge = null;
                this.score += 5000 * (this.stageIndex + 1);
                audio.sfx("bossDown");
                this.bullets.forEach((x) => x.sprite.destroy());
                this.bullets = [];
            }
        }

        // ---------- 当たり・演出 ----------
        explode(x, y, depth, n = 8) {
            for (let i = 0; i < n; i++) {
                const s = this.add.image(x, y, "spark").setDepth(depth).setTint(pick([0xf8f048, 0xf89838, 0xf8f8f8, 0xf85858]));
                const a = Math.random() * Math.PI * 2;
                const d = rand(10, 30);
                this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: rand(250, 500), onComplete: () => s.destroy() });
            }
        }
        killEnemy(e) {
            e.dead = true;
            const p = project(this.world, e.x, e.y, e.z);
            this.explode(p.sx, p.sy, depthOf(e.z) + 1);
            this.score += e.score;
            audio.sfx("boom");
        }
        playerHit() {
            if (this.invuln > 0 || !this.alive || ctx.invincible) return;
            if (this.barrier > 0) {
                // バリアが受け止める(少しのあいだ無敵)
                this.barrier--;
                this.invuln = 0.8;
                this.barrierFlash = 0.3;
                audio.sfx("hit");
                this.explode(this.px, this.py, depthOf(ZP) + 1, 6);
                this.updateHud();
                return;
            }
            this.lives--;
            this.explode(this.px, this.py, depthOf(ZP) + 1, 14);
            audio.sfx("playerDown");
            this.cameras.main.shake(260, 0.012);
            if (this.lives <= 0) {
                this.alive = false;
                this.player.setVisible(false);
                this.flame.setVisible(false);
                this.state = "dead";
                this.time.delayedCall(1400, () => this.gameOver());
            } else {
                this.invuln = 2.2;
            }
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
            try { host.stageClear?.(this.result("stage")); } catch (e) { console.error("[skyheart] host.stageClear failed", e); }
            const last = this.stageIndex >= stages.length - 1;
            const perfect = this.perfect();
            if (perfect) { audio.sfx("perfect"); this.showBanner(tr("perfect"), tr("privatePhoto")); }
            else this.showBanner(tr("stageClear"), this.stage.clear_prompt ? `"${this.stage.clear_prompt}"` : "");
            this.time.delayedCall(2600, () => {
                this.hideBanner();
                const proceed = () => {
                    if (last) this.allClear();
                    else this.scene.restart({ stageIndex: this.stageIndex + 1, score: this.score, lives: this.lives, barrier: this.barrier, supportT: this.supportT });
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
            this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(315);
            const showOver = () => {
                this.state = "done";
                this.doneAt = performance.now();
                this.showBanner(tr("gameOver"), `SCORE ${pad(this.score)}\n\n${tr("again")}`, COL.red);
                ctx.advance = false;
            };
            if (lines.length && !ctx.skipStory) this.startStory(lines, showOver, "gameover");
            else { audio.playMusic("gameover"); showOver(); }
        }

        // ---------- 毎フレーム ----------
        updatePlayer(dt) {
            if (!this.alive) return;
            const k = this.keys;
            const pad1 = this.input.gamepad?.pad1;
            let mx = (k.LEFT.isDown || k.A.isDown ? -1 : 0) + (k.RIGHT.isDown || k.D.isDown ? 1 : 0);
            let my = (k.UP.isDown || k.W.isDown ? -1 : 0) + (k.DOWN.isDown || k.S.isDown ? 1 : 0);
            if (pad1) {
                const ax = pad1.leftStick?.x || 0, ay = pad1.leftStick?.y || 0;
                if (Math.abs(ax) > 0.25) mx = ax;
                if (Math.abs(ay) > 0.25) my = ay;
                if (pad1.left) mx = -1;
                if (pad1.right) mx = 1;
                if (pad1.up) my = -1;
                if (pad1.down) my = 1;
            }
            const len = Math.hypot(mx, my);
            if (len > 1) { mx /= len; my /= len; }
            this.vx = lerp(this.vx, mx, Math.min(1, dt * 10));
            this.px = clamp(this.px + mx * PLAYER_SPEED * dt, PX_MIN, PX_MAX);
            this.py = clamp(this.py + my * PLAYER_SPEED * dt, PY_MIN, PY_MAX);
            // ショット(押しっぱなしで連射)
            this.fireCd -= dt;
            const fire = k.SPACE.isDown || k.Z.isDown || !!(pad1 && (pad1.A || pad1.X));
            if (fire && this.fireCd <= 0 && (this.state === "play" || this.state === "boss" || this.state === "warning")) {
                this.fireCd = FIRE_INTERVAL;
                this.shots.push({ x: this.px, y: this.py - 8, z: ZP + 4, sprite: this.add.image(0, 0, "shot").setVisible(false) });
                // サポートメカも同じように撃つ
                if (this.supportT > 0) {
                    for (const o of this.options) this.shots.push({ x: o.x, y: o.y - 4, z: ZP + 4, sprite: this.add.image(0, 0, "shot").setVisible(false) });
                }
                audio.sfx("shoot");
            }
            if (this.invuln > 0) this.invuln -= dt;
            this.barrierFlash = Math.max(0, (this.barrierFlash || 0) - dt);
            if (this.supportT > 0 && ["play", "boss", "warning", "intro"].includes(this.state)) {
                this.supportT = Math.max(0, this.supportT - dt);
                if (this.supportT === 0) this.popup("SUPPORT END", this.px, this.py - 24, COL.gray);
            }
            // サポートメカは少し遅れてついてくる
            for (const o of this.options) {
                const k = Math.min(1, dt * 8);
                o.x = lerp(o.x, this.px + o.side * OPTION_DX, k);
                o.y = lerp(o.y, this.py + 6, k);
            }
        }

        updateWorld(dt) {
            const scroll = SCROLL * dt;
            this.world.scroll += scroll;
            this.world.drift += dt;
            updateVp(this.world, this.px, this.py);

            // 障害物
            for (const o of this.objs) {
                const prev = o.z;
                o.z -= scroll;
                if (!o.hit && !o.dead && prev > ZP && o.z <= ZP && this.alive) {
                    if (Math.abs(this.px - o.x) < o.w * 0.38 && this.py > GROUND_Y - o.h * 0.92) { o.hit = true; this.playerHit(); }
                }
            }
            // ミサイル発射台: 近づくと自機めがけてミサイルを撃つ。ぶつかるとダメージ、低く飛んで撃てば壊せる
            for (const l of this.launchers) {
                const prev = l.z;
                l.z -= scroll;
                if (!l.dead && l.shots > 0 && l.z < LAUNCHER_FIRE_Z[0] && l.z > LAUNCHER_FIRE_Z[1] && this.alive && ["play", "boss", "warning"].includes(this.state)) {
                    l.fireT -= dt;
                    if (l.fireT <= 0) {
                        l.shots--;
                        l.fireT = 0.45;
                        this.fireAt({ x: l.x, y: GROUND_Y - l.h * 0.8, z: l.z }, this.px, this.py, "missile");
                        audio.sfx("charge");
                    }
                }
                if (!l.dead && !l.hitDone && prev > ZP && l.z <= ZP && this.alive) {
                    if (Math.abs(this.px - l.x) < l.w * 0.4 && this.py > GROUND_Y - l.h * 0.9) { l.hitDone = true; this.playerHit(); }
                }
            }
            // 敵
            for (const e of this.enemies) {
                const prev = e.z;
                this.updateEnemyPos(e, dt);
                if (!e.dead && prev > ZP && e.z <= ZP && this.alive && Math.hypot(e.x - this.px, e.y - this.py) < e.r + 10) {
                    this.killEnemy(e);
                    this.playerHit();
                }
            }
            // 自機の弾
            for (const s of this.shots) {
                const prev = s.z;
                s.z += SHOT_SPEED * dt;
                for (const e of this.enemies) {
                    if (e.dead || s.dead) continue;
                    if (e.z >= prev - 40 && e.z <= s.z + 40 && Math.hypot(e.x - s.x, e.y - s.y) < e.r) {
                        s.dead = true;
                        e.hp--;
                        if (e.hp <= 0) this.killEnemy(e); else audio.sfx("hit");
                    }
                }
                // 耐久値のある障害物(ステージ4のビル)は撃って壊せる
                for (const o of this.objs) {
                    if (!o.hp || o.dead || s.dead) continue;
                    if (o.z >= prev - 40 && o.z <= s.z + 40 && Math.abs(o.x - s.x) < o.w * 0.5 && s.y > GROUND_Y - o.h - 8) {
                        s.dead = true;
                        o.hp--;
                        if (o.hp <= 0) {
                            o.dead = true;
                            this.objKills = (this.objKills || 0) + 1;
                            const p = project(this.world, o.x, GROUND_Y - o.h / 2, o.z);
                            this.explode(p.sx, p.sy, depthOf(o.z) + 1, 14);
                            this.score += 200;
                            audio.sfx("boom");
                        } else {
                            audio.sfx("hit");
                            o.sprite.setTint(0xff9090);
                            this.time.delayedCall(70, () => { if (o.sprite.active) o.sprite.clearTint(); });
                        }
                    }
                }
                for (const l of this.launchers) {
                    if (l.dead || s.dead) continue;
                    if (l.z >= prev - 40 && l.z <= s.z + 40 && Math.abs(l.x - s.x) < l.w * 0.5 && Math.abs((GROUND_Y - l.h / 2) - s.y) < l.h * 0.5 + 8) {
                        s.dead = true;
                        l.hp--;
                        if (l.hp <= 0) {
                            l.dead = true;
                            const p = project(this.world, l.x, GROUND_Y - l.h / 2, l.z);
                            this.explode(p.sx, p.sy, depthOf(l.z) + 1, 10);
                            this.score += 300;
                            audio.sfx("boom");
                        } else audio.sfx("hit");
                    }
                }
                const b = this.boss;
                if (b && !s.dead && b.z >= prev - 60 && b.z <= s.z + 60 && Math.hypot(b.x - s.x, b.y - s.y) < b.r) {
                    s.dead = true;
                    this.damageBoss();
                }
                if (s.z > ZFAR) s.dead = true;
            }
            // 敵の弾
            for (const b of this.bullets) {
                const prev = b.z;
                b.t += dt;
                const p = b.t / b.T;
                b.x = lerp(b.x0, b.tx, p);
                b.y = lerp(b.y0, b.ty, p);
                b.z = lerp(b.z0, ZP, p);
                if (prev > ZP && b.z <= ZP && this.alive && Math.hypot(b.x - this.px, b.y - this.py) < (b.missile ? 16 : 14)) { b.dead = true; this.playerHit(); }
                if (b.z < ZP * 0.5) b.dead = true;
            }
            // ハート
            for (const it of this.items) {
                const prev = it.z;
                it.z -= SCROLL * 0.9 * dt;
                it.t += dt;
                if (!it.dead && prev > ZP && it.z <= ZP && this.alive && Math.hypot(it.x - this.px, it.y - this.py) < 34) {
                    it.dead = true;
                    if (it.power) { this.takePowerup(it.power); continue; }
                    this.itemsGot++;
                    this.score += 500;
                    audio.sfx("item");
                    this.popup("♥", this.px, this.py - 20, COL.magenta);
                    if (this.perfect()) this.popup("PERFECT!", W / 2, 80, COL.magenta);
                }
            }
            // 消えた物・後ろへ過ぎた物を片付ける
            const sweep = (arr, gone) => arr.filter((o) => {
                if (o.dead || gone(o)) { o.sprite.destroy(); return false; }
                return true;
            });
            this.objs = sweep(this.objs, (o) => o.z < ZNEAR);
            this.launchers = sweep(this.launchers, (l) => l.z < ZNEAR);
            this.enemies = sweep(this.enemies, (e) => e.z < ZNEAR || e.z > ZFAR + 400);
            this.shots = sweep(this.shots, () => false);
            this.bullets = sweep(this.bullets, () => false);
            this.items = sweep(this.items, (i) => i.z < ZNEAR);
        }

        render3d() {
            const w = this.world;
            drawWorld(w);
            const place = (sprite, x, y, z, scale, originBottom = false) => {
                if (z <= ZNEAR * 0.8 || z > ZFAR) { sprite.setVisible(false); return null; }
                const p = project(w, x, y, z);
                sprite.setVisible(true).setPosition(p.sx, p.sy).setScale(scale * p.s).setDepth(depthOf(z));
                const fog = Math.pow(clamp(z / ZFAR, 0, 1), 1.2);
                sprite.setAlpha(1 - fog * 0.6);
                if (originBottom) sprite.setOrigin(0.5, 1);
                return p;
            };
            for (const o of this.objs) place(o.sprite, o.x, GROUND_Y, o.z, o.scale, true);
            for (const l of this.launchers) place(l.sprite, l.x, GROUND_Y, l.z, LAUNCHER_SCALE, true);
            for (const e of this.enemies) {
                place(e.sprite, e.x, e.y, e.z, e.scale);
                e.sprite.setAngle(e.kind === "drone" ? Math.sin(e.z / 90) * 10 : 0);
            }
            for (const s of this.shots) place(s.sprite, s.x, s.y, s.z, 3);
            for (const b of this.bullets) place(b.sprite, b.x, b.y, b.z, b.missile ? 2.6 : 2.2);
            for (const it of this.items) {
                place(it.sprite, it.x, it.y + Math.sin(it.t * 5) * (it.ground ? 3 : 6), it.z, it.power ? 2.4 : 2.6);
                if (it.power) it.sprite.setAngle(Math.sin(it.t * 3) * 12);
            }
            const b = this.boss;
            if (b) {
                place(b.sprite, b.x, b.y, b.z, b.scale);
                // 突進の予告は白く点滅、弾が当たったときは少し赤くする
                if (b.flash > 0 && Math.floor(b.flash * 20) % 2 === 0) b.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
                else if (b.hitT > 0) b.sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xff9090);
                else b.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
            }
            // 自機と影
            const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
            this.player.setPosition(this.px, this.py).setAngle(this.vx * 14).setVisible(this.alive && !blink);
            this.flame.setPosition(this.px + Math.sin(this.time0 * 40) * 1.5, this.py + 26).setScale(2 + Math.random() * 1.5).setVisible(this.alive && !blink);
            // サポートメカ(残り3秒で点滅)
            const optOn = this.alive && this.supportT > 0 && !(this.supportT < 3 && Math.floor(this.supportT * 8) % 2 === 0);
            for (const o of this.options) o.sprite.setPosition(o.x, o.y + Math.sin(this.time0 * 6 + o.side) * 2).setVisible(optOn);
            // バリア: 自機のまわりの光る輪と、残り回数の点
            const bg = this.barrierG;
            bg.clear();
            if (this.alive && this.barrier > 0) {
                const pulse = 0.45 + 0.25 * Math.sin(this.time0 * 8);
                const col = this.barrierFlash > 0 ? 0xffffff : 0x58e8f8;
                bg.lineStyle(2, col, this.barrierFlash > 0 ? 1 : pulse).strokeCircle(this.px, this.py, 30);
                bg.lineStyle(1, col, pulse * 0.6).strokeCircle(this.px, this.py, 26);
                for (let i = 0; i < this.barrier; i++) bg.fillStyle(0x58e8f8, 1).fillCircle(this.px - (this.barrier - 1) * 4 + i * 8, this.py + 36, 2);
            }
            const hgt = clamp((GROUND_Y - this.py) / (GROUND_Y - PY_MIN), 0, 1);
            this.shadow.setPosition(this.px, GROUND_Y - 2).setScale(2.2 - hgt * 1.2, 1.6 - hgt * 0.8).setAlpha(this.alive ? 0.4 - hgt * 0.25 : 0);
        }

        update(_t, delta) {
            const dt = Math.min(0.05, delta / 1000);
            if (this.state === "done") {
                if (ctx.advance) { ctx.advance = false; if (performance.now() - this.doneAt > 1500) restart(); }
                return;
            }
            if (ctx.pauseToggle) {
                ctx.pauseToggle = false;
                if (["play", "boss", "warning", "intro"].includes(this.state)) this.paused = !this.paused;
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
            this.time0 += dt;

            if (this.state === "story") {
                this.story.update(dt, ctx.advance);
                ctx.advance = false;
                this.world.scroll += SCROLL * 0.3 * dt;
                this.world.drift += dt;
                drawWorld(this.world);
                return;
            }
            ctx.advance = false;
            if (ctx.debugBoss) { ctx.debugBoss = false; this.debugToBoss(); }

            if (this.state === "intro") {
                this.introT -= dt;
                if (this.introT <= 0) { this.hideBanner(); this.state = "play"; this.playT = 0; }
            } else if (this.state === "play") {
                this.playT += dt;
                const dur = this.stage.duration || 40;
                // 雑魚の出現(後のステージほど間隔が短い)
                this.spawnT -= dt;
                if (this.playT < dur && this.spawnT <= 0) {
                    this.spawnT = Math.max(1.4, 2.6 - this.stageIndex * 0.22) * rand(0.85, 1.15);
                    this.spawnWave();
                }
                while (this.heartTimes.length && this.playT >= this.heartTimes[0]) { this.heartTimes.shift(); this.spawnHeart(false); }
                while (this.groundHeartTimes.length && this.playT >= this.groundHeartTimes[0]) { this.groundHeartTimes.shift(); this.spawnHeart(true); }
                while (this.launcherTimes.length && this.playT >= this.launcherTimes[0]) { this.launcherTimes.shift(); this.spawnLauncher(); }
                while (this.powerTimes.length && this.playT >= this.powerTimes[0]) { this.powerTimes.shift(); this.spawnPowerup(this.powerCount++ % 2 === 1); }
                if (this.playT >= dur && this.enemies.length === 0) this.startWarning();
            } else if (this.state === "warning") {
                this.warnT -= dt;
                if (this.warnT <= 0) { this.hideBanner(); this.spawnBoss(); }
            }
            // 障害物は戦闘中ずっと流れる(ボス戦ではまばら)
            if (["intro", "play", "warning", "boss"].includes(this.state)) {
                this.objT -= dt;
                if (this.objT <= 0) {
                    const base = this.state === "boss" ? 1.6 : 0.55;
                    this.objT = base / (this.theme.objDensity || 1) * rand(0.6, 1.4);
                    this.spawnObstacle();
                }
            }
            this.updatePlayer(dt);
            this.updateWorld(dt);
            if (this.state === "boss" || this.boss) this.updateBoss(dt);
            this.render3d();
            this.updateHud();
        }

        // ---------- debug ----------
        debugToBoss() {
            this.story.hide();
            this.enemies.forEach((e) => e.sprite.destroy());
            this.enemies = [];
            this.groundHeartTimes = [];
            this.launcherTimes = [];
            this.powerTimes = [];
            this.hideBanner();
            this.state = "play";
            this.playT = this.stage.duration || 40;
            this.heartTimes = [];
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
        /** 動作確認用: すぐボス戦へ */
        debugBoss() { ctx.debugBoss = true; return true; },
        /** 動作確認用: ボスの残り体力を1にする */
        debugBossLow() { const b = ctx.play?.boss; if (!b) return false; b.hp = 1; return true; },
        debugCollectAll() { const p = ctx.play; if (!p) return false; p.itemsGot = ITEMS_PER_STAGE; return true; },
        /** 動作確認用: 飛んでくるハートの一覧と、自機の移動 */
        debugItems() { const p = ctx.play; return p ? p.items.map((i) => ({ x: Math.round(i.x), y: Math.round(i.y), z: Math.round(i.z), ground: !!i.ground, power: i.power || null })) : []; },
        debugMoveTo(x, y) { const p = ctx.play; if (!p) return false; p.px = clamp(x, PX_MIN, PX_MAX); p.py = clamp(y, PY_MIN, PY_MAX); return true; },
        /** 動作確認用: パワーアップを取ったことにする("1up" / "barrier" / "support") */
        debugPower(kind) { const p = ctx.play; if (!p || !POWER_INFO[kind]) return false; p.takePowerup(kind); return { lives: p.lives, barrier: p.barrier, supportT: p.supportT }; },
        debugInvincible(on = true) { ctx.invincible = !!on; return ctx.invincible; },
        debugGameOver() { const p = ctx.play; if (!p) return false; p.lives = 1; p.invuln = 0; const inv = ctx.invincible; ctx.invincible = false; p.playerHit(); ctx.invincible = inv; return true; },
        debugState() {
            const p = ctx.play;
            return p && p.sys.isActive() ? {
                state: p.state, stage: p.stageIndex + 1, score: p.score, lives: p.lives, items: p.itemsGot,
                px: Math.round(p.px), py: Math.round(p.py), enemies: p.enemies.length, launchers: p.launchers.length, objKills: p.objKills || 0, barrier: p.barrier, supportT: +p.supportT.toFixed(1), objs: p.objs.length, bullets: p.bullets.length, shots: p.shots.length,
                boss: p.boss ? { type: p.boss.type, hp: p.boss.hp, z: Math.round(p.boss.z), state: p.boss.state } : null, playT: +(p.playT || 0).toFixed(1),
            } : null;
        },
    };
}

/**
 * Star Formation — 隊列ダイブ型の縦シューティング (WFS Game API v1)
 * 80年代のアーケード / MSX2 / PC-8801 風: ドット絵・ドットフォント・走査線・PSG 風 BGM・ADV 風の会話。
 *
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debugClear, debugState }
 *
 * host (WFS 側が渡す):
 *   host.apiVersion  ... 1
 *   host.lang        ... "en" | "ja" | "zh"
 *   host.settings    ... { difficulty: "easy"|"normal"|"hard", sound: bool, bgm: bool }
 *   host.finish(result) ... ゲーム終了時に1回だけ呼ぶ
 *
 * result: { gameId, cleared, score, stage, stagesTotal, negative,
 *           rewards: [{ type: "prompt", text, weight, source: "style"|"character"|"scene"|"clear", stage? }] }
 *
 * 当たり判定・移動は Phaser の物理エンジンを使わず自前で計算する(円判定)。
 */
import * as Phaser from "../../vendor/phaser/phaser.esm.min.js";
import { createAudio } from "./audio.js";
import { SONGS } from "./songs.js";
import { makePixelTextures } from "./sprites.js";

const GAME_ID = "shooter";
const W = 480;
const H = 640;
const FONT_NAME = "WFSDotGothic16";
const FONT_URL = new URL("../../vendor/fonts/DotGothic16-Regular.ttf", import.meta.url);
const HISCORE_KEY = "wfs_games_shooter_hiscore";

// 80年代 PC 風の文字色
const COL = { white: "#f8f8f8", yellow: "#f8f048", cyan: "#58e8f8", magenta: "#f858f8", green: "#58f858", gray: "#9898a8", red: "#f85858" };

const TEXT = {
    en: {
        title: "STAR FORMATION",
        pushStart: "PUSH SPACE KEY",
        controls: "MOVE ← →/A D   SHOT SPACE/Z   PAUSE ESC",
        stage: (n) => `STAGE ${n}`,
        stageClear: "STAGE CLEAR",
        promptGet: "PROMPT GET",
        allClear: "ALL CLEAR!",
        gameOver: "GAME OVER",
        paused: "PAUSE",
        again: "PUSH SPACE KEY",
        next: "SPACE / CLICK",
        difficulty: { easy: "EASY", normal: "NORMAL", hard: "HARD" },
        narr: "",
    },
    ja: {
        title: "STAR FORMATION",
        pushStart: "PUSH SPACE KEY",
        controls: "移動 ← →/A D   ショット SPACE/Z   一時停止 ESC",
        stage: (n) => `STAGE ${n}`,
        stageClear: "STAGE CLEAR",
        promptGet: "プロンプト獲得",
        allClear: "ALL CLEAR!",
        gameOver: "GAME OVER",
        paused: "PAUSE",
        again: "PUSH SPACE KEY",
        next: "SPACE / クリック",
        difficulty: { easy: "やさしい", normal: "ふつう", hard: "むずかしい" },
        narr: "",
    },
    zh: {
        title: "STAR FORMATION",
        pushStart: "PUSH SPACE KEY",
        controls: "移动 ← →/A D   射击 SPACE/Z   暂停 ESC",
        stage: (n) => `STAGE ${n}`,
        stageClear: "STAGE CLEAR",
        promptGet: "获得提示词",
        allClear: "ALL CLEAR!",
        gameOver: "GAME OVER",
        paused: "PAUSE",
        again: "PUSH SPACE KEY",
        next: "SPACE / 点击",
        difficulty: { easy: "简单", normal: "普通", hard: "困难" },
        narr: "",
    },
};

const DIFFICULTY = {
    easy:   { lives: 5, fire: 0.6, dive: 0.7, bulletSpeed: 0.8, maxDivers: 2, maxShots: 3 },
    normal: { lives: 3, fire: 1.0, dive: 1.0, bulletSpeed: 1.0, maxDivers: 3, maxShots: 2 },
    hard:   { lives: 2, fire: 1.4, dive: 1.4, bulletSpeed: 1.25, maxDivers: 4, maxShots: 2 },
};

const ENEMY_TYPES = {
    scout:     { hp: 1, points: 100, tex: "scout", r: 11, color: 0xe858e8 },
    guard:     { hp: 2, points: 160, tex: "guard", r: 11, color: 0xf89838 },
    commander: { hp: 3, points: 400, tex: "commander", r: 15, color: 0x58e858 },
};

// ステージごとの BGM (同じ曲を移調・テンポ違いで使う)
const STAGE_MUSIC = [
    { transpose: 0, bpm: 150 },
    { transpose: 2, bpm: 156 },
    { transpose: 5, bpm: 166 },
];

// 隊列: 8列 x 4行。commander は上段中央、guard は2段目、scout は3〜4段目
const COLS = 8;
const SLOT_DX = 46;
const SLOT_DY = 40;
const FORMATION_Y = 96;
const CENTER_OUT = [3, 4, 2, 5, 1, 6, 0, 7];
const SLOT_ROWS = { commander: [0], guard: [1], scout: [2, 3] };

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyZ", "KeyP", "Escape", "Enter"]);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

// 入場パス (u: 0..1)
const ENTRY_PATHS = {
    left_arc:       [{ x: -30, y: 140 }, { x: W * 0.7, y: 60 }, { x: W * 0.85, y: 460 }, { x: W * 0.35, y: 330 }],
    right_arc:      [{ x: W + 30, y: 140 }, { x: W * 0.3, y: 60 }, { x: W * 0.15, y: 460 }, { x: W * 0.65, y: 330 }],
    top_left_loop:  [{ x: W * 0.4, y: -30 }, { x: W * 0.05, y: 380 }, { x: W * 0.95, y: 480 }, { x: W * 0.55, y: 260 }],
    top_right_loop: [{ x: W * 0.6, y: -30 }, { x: W * 0.95, y: 380 }, { x: W * 0.05, y: 480 }, { x: W * 0.45, y: 260 }],
};

async function loadData() {
    const res = await fetch(new URL("./stages.json", import.meta.url));
    if (!res.ok) throw new Error(`stages.json: HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.stages) || !data.stages.length) throw new Error("stages.json: no stages");
    return data;
}

async function loadFont() {
    try {
        if (![...document.fonts].some((f) => f.family === FONT_NAME)) {
            const face = new FontFace(FONT_NAME, `url(${FONT_URL.href})`);
            document.fonts.add(face);
        }
        await document.fonts.load(`16px "${FONT_NAME}"`);
    } catch (e) {
        console.warn("[shooter] font load failed, using monospace", e);
    }
}

function loadHiScore() {
    try { return Number(localStorage.getItem(HISCORE_KEY)) || 0; } catch { return 0; }
}
function saveHiScore(v) {
    try { localStorage.setItem(HISCORE_KEY, String(v)); } catch { /* ignore */ }
}

function makeStarfield(scene) {
    const stars = [];
    const tints = [0xf8f8f8, 0x58e8f8, 0xf8f048, 0xf858f8];
    for (let i = 0; i < 80; i++) {
        const depth = Math.random();
        const s = scene.add.image(Math.random() * W, Math.random() * H, "star");
        s.setScale(depth > 0.75 ? 2 : 1).setAlpha(0.35 + depth * 0.65).setTint(tints[i % tints.length]);
        stars.push({ s, speed: 18 + Math.floor(depth * 4) * 26 });
    }
    return (dt) => {
        for (const st of stars) {
            st.s.y += st.speed * dt;
            if (st.s.y > H) { st.s.y = -2; st.s.x = Math.floor(Math.random() * W); }
        }
    };
}

function txt(scene, x, y, str, size = 16, color = COL.white) {
    return scene.add.text(x, y, str, { fontFamily: `"${FONT_NAME}", monospace`, fontSize: `${size}px`, color, align: "center", lineSpacing: 6 });
}

const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, "0");

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
    const heroineName = loc(data.heroine?.name) || "RINA";
    const audio = createAudio({ sound: settings.sound !== false, bgm: settings.bgm !== false, songs: SONGS });

    const ctx = { finished: false, debugClear: false, skipStory: false, externalPause: false, pauseToggle: false, advance: false, play: null, hiScore: loadHiScore() };

    const finish = (result) => {
        if (ctx.finished) return;
        ctx.finished = true;
        try { host.finish?.(result); } catch (e) { console.error("[shooter] host.finish failed", e); }
    };

    const syncAudioPause = () => {
        const p = ctx.play;
        const gamePaused = !!(p && p.sys.isActive() && p.paused);
        audio.setPaused(ctx.externalPause || gamePaused);
    };

    // ゲーム用のフォーカス可能な要素。キー入力はここだけで受ける(WFS の他の入力欄を奪わない)
    container.innerHTML = "";
    const root = document.createElement("div");
    root.tabIndex = 0;
    root.style.cssText = "width:100%;height:100%;outline:none;position:relative;";
    container.appendChild(root);
    // ブラウン管風の走査線 (表示のみ・クリックは透過)
    const scan = document.createElement("div");
    scan.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:2;"
        + "background:repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px);"
        + "box-shadow: inset 0 0 80px rgba(0,0,0,0.55);";
    root.appendChild(scan);

    // Phaser は root で受けたキーを処理する(defaultPrevented のイベントは無視するので、先に止めない)。
    // その後 container までバブリングしてきたところで止め、WFS 全体のショートカット
    // (Esc でモーダルを閉じる等)やページのスクロールに渡さない。
    const onKey = (e) => {
        e.stopPropagation();
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        if (e.type !== "keydown") return;
        audio.unlock();
        if (e.repeat) return;
        // 一時停止・会話送りはフレームをまたがない短い押下も取りこぼさないよう DOM イベントで直接受ける
        if (e.code === "Escape" || e.code === "KeyP") ctx.pauseToggle = true;
        if (e.code === "Space" || e.code === "Enter" || e.code === "KeyZ") ctx.advance = true;
    };
    container.addEventListener("keydown", onKey);
    container.addEventListener("keyup", onKey);
    const focusRoot = () => root.focus({ preventScroll: true });
    const onPointer = () => { focusRoot(); audio.unlock(); ctx.advance = true; };
    root.addEventListener("pointerdown", onPointer);

    // ---------------- scenes ----------------

    class BootScene extends Phaser.Scene {
        constructor() { super("boot"); }
        create() {
            makePixelTextures(this, 2);
            this.scene.start("title");
        }
    }

    class TitleScene extends Phaser.Scene {
        constructor() { super("title"); }
        create() {
            this.started = false; // シーンのインスタンスはリスタート後も使い回されるので毎回戻す
            this.stars = makeStarfield(this);
            const g = this.add.graphics();
            g.lineStyle(2, 0xf8f8f8, 1).strokeRect(16, 16, W - 32, H - 32);
            g.lineStyle(2, 0x58e8f8, 1).strokeRect(22, 22, W - 44, H - 44);

            txt(this, W / 2 + 3, 133, tr("title"), 32, COL.magenta).setOrigin(0.5);
            txt(this, W / 2, 130, tr("title"), 32, COL.cyan).setOrigin(0.5);
            txt(this, W / 2, 176, `- ${tr("difficulty")[settings.difficulty] || ""} -`, 16, COL.gray).setOrigin(0.5);

            // ヒロインと自機
            const fx = W / 2 - 24;
            this.add.graphics().lineStyle(2, 0xf8f8f8, 1).strokeRect(fx - 4, 232, 56, 56);
            this.add.image(W / 2, 260, "rina");
            txt(this, W / 2, 300, heroineName, 16, COL.yellow).setOrigin(0.5);
            this.add.image(W / 2, 370, "ship");

            const start = txt(this, W / 2, 440, tr("pushStart"), 16, COL.yellow).setOrigin(0.5);
            this.time.addEvent({ delay: 480, loop: true, callback: () => start.setVisible(!start.visible) });
            txt(this, W / 2, 540, tr("controls"), 16, COL.gray).setOrigin(0.5).setScale(0.75);
            txt(this, W / 2, 576, `HI ${pad6(ctx.hiScore)}`, 16, COL.white).setOrigin(0.5);
            txt(this, W / 2, 600, "WFS GAMES  2026", 16, COL.gray).setOrigin(0.5).setScale(0.75);

            this.keys = this.input.keyboard.addKeys("SPACE,ENTER,Z");
            this.input.on("pointerdown", () => this.begin());
            ctx.advance = false;
            audio.playMusic("title");
        }
        begin() {
            if (this.started) return;
            this.started = true;
            audio.unlock();
            audio.sfx("start");
            this.scene.start("play", { stageIndex: 0, score: 0, lives: diff.lives });
        }
        update(_t, delta) {
            this.stars(delta / 1000);
            if (ctx.advance) { ctx.advance = false; this.begin(); }
            const pad = this.input.gamepad?.pad1;
            if (pad && (pad.A || pad.buttons?.[9]?.pressed)) this.begin();
        }
    }

    class PlayScene extends Phaser.Scene {
        constructor() { super("play"); }

        init(data) {
            this.stageIndex = data.stageIndex ?? 0;
            this.score = data.score ?? 0;
            this.lives = data.lives ?? diff.lives;
            this.stage = stages[this.stageIndex];
        }

        create() {
            ctx.play = this;
            ctx.pauseToggle = false;
            this.stars = makeStarfield(this);
            this.enemies = [];
            this.shots = [];
            this.ebullets = [];
            this.occupied = new Set();
            this.time0 = 0;
            this.state = "intro";
            this.stateTimer = 0;
            this.fireCd = 0;
            this.diveTimer = 3;
            this.invuln = 0;
            this.paused = false;
            this._wasPaused = false;

            this.waveQueue = (this.stage.waves || []).map((w) => ({ ...w }));
            this.waveTimer = 0;
            this.spawnQueue = [];

            this.player = this.add.image(W / 2, H - 56, "ship");
            this.playerAlive = true;

            // HUD
            this.scoreText = txt(this, 12, 8, "", 16, COL.white);
            this.hiText = txt(this, W / 2, 8, "", 16, COL.yellow).setOrigin(0.5, 0);
            this.stageText = txt(this, W - 12, 8, tr("stage", this.stageIndex + 1), 16, this.stage.color || COL.white).setOrigin(1, 0);
            this.lifeIcons = [];
            this.updateHud();

            this.banner = txt(this, W / 2, H / 2 - 40, "", 32, COL.yellow).setOrigin(0.5).setDepth(10).setVisible(false);
            this.subBanner = txt(this, W / 2, H / 2 + 6, "", 16, COL.white).setOrigin(0.5, 0).setDepth(10).setVisible(false);
            this.subBanner.setWordWrapWidth(W - 60, true);
            this.pauseText = txt(this, W / 2, H / 2, tr("paused"), 32, COL.white).setOrigin(0.5).setDepth(30).setVisible(false);

            this.buildStoryBox();

            this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,A,D,SPACE,Z");

            const before = this.stage.story_before || [];
            if (before.length && !ctx.skipStory) this.startStory(before, () => this.startIntro());
            else this.startIntro();
        }

        // ---------- HUD / banner ----------
        updateHud() {
            if (this.score > ctx.hiScore) ctx.hiScore = this.score;
            this.scoreText.setText(`1UP ${pad6(this.score)}`);
            this.hiText.setText(`HI ${pad6(ctx.hiScore)}`);
            this.lifeIcons.forEach((i) => i.destroy());
            this.lifeIcons = [];
            for (let i = 0; i < Math.max(0, this.lives - 1); i++) {
                this.lifeIcons.push(this.add.image(20 + i * 22, H - 16, "ship").setScale(0.6));
            }
        }
        showBanner(main, sub = "") {
            this.banner.setText(main).setVisible(true);
            this.subBanner.setText(sub).setVisible(!!sub);
        }
        hideBanner() {
            this.banner.setVisible(false);
            this.subBanner.setVisible(false);
        }

        // ---------- ADV 風の会話ウィンドウ ----------
        buildStoryBox() {
            const top = H - 200;
            const box = this.add.container(0, 0).setDepth(20).setVisible(false);
            const g = this.add.graphics();
            g.fillStyle(0x000010, 1).fillRect(10, top, W - 20, 170);
            g.lineStyle(2, 0xf8f8f8, 1).strokeRect(12, top + 2, W - 24, 166);
            g.lineStyle(1, 0x58e8f8, 1).strokeRect(17, top + 7, W - 34, 156);
            const face = this.add.container(0, 0);
            const fg = this.add.graphics().lineStyle(2, 0xf8f8f8, 1).strokeRect(26, top + 20, 52, 52);
            face.add([fg, this.add.image(52, top + 46, "rina")]);
            const name = txt(this, 92, top + 18, "", 16, COL.yellow);
            const body = txt(this, 92, top + 46, "", 16, COL.white).setAlign("left");
            const cursor = txt(this, W - 34, top + 140, "▼", 16, COL.cyan);
            const hint = txt(this, W - 52, top + 142, tr("next"), 16, COL.gray).setOrigin(1, 0).setScale(0.75);
            box.add([g, face, name, body, cursor, hint]);
            this.story = { box, face, name, body, cursor, hint, top, lines: [], idx: -1, pos: 0, full: "", done: null, blink: 0 };
        }
        startStory(lines, done) {
            this.state = "story";
            this.hideBanner();
            ctx.advance = false;
            audio.playMusic("story");
            Object.assign(this.story, { lines, idx: -1, done });
            this.story.box.setVisible(true);
            this.nextLine();
        }
        nextLine() {
            const s = this.story;
            s.idx++;
            if (s.idx >= s.lines.length) {
                s.box.setVisible(false);
                const done = s.done;
                s.done = null;
                done?.();
                return;
            }
            const line = s.lines[s.idx];
            const isNarr = line.speaker !== "rina";
            s.face.setVisible(!isNarr);
            s.name.setText(isNarr ? "" : heroineName);
            const x = isNarr ? 30 : 92;
            s.body.setPosition(x, isNarr ? s.top + 30 : s.top + 46);
            s.body.setWordWrapWidth(W - x - 34, true);
            s.full = loc(line.text);
            s.pos = 0;
            s.body.setText("");
            s.cursor.setVisible(false);
        }
        updateStory(dt) {
            const s = this.story;
            if (s.pos < s.full.length) {
                const before = Math.floor(s.pos);
                s.pos = Math.min(s.full.length, s.pos + dt * 28);
                if (Math.floor(s.pos) !== before) {
                    s.body.setText(s.full.slice(0, Math.floor(s.pos)));
                    if (Math.floor(s.pos) % 2 === 0) audio.sfx("text");
                }
            } else {
                s.blink += dt;
                s.cursor.setVisible(Math.floor(s.blink * 2.5) % 2 === 0);
            }
            if (ctx.advance) {
                ctx.advance = false;
                if (s.pos < s.full.length) { s.pos = s.full.length; s.body.setText(s.full); }
                else this.nextLine();
            }
        }

        startIntro() {
            this.state = "intro";
            this.stateTimer = 1.8;
            this.showBanner(tr("stage", this.stageIndex + 1), loc(this.stage.name));
            const m = STAGE_MUSIC[this.stageIndex] || STAGE_MUSIC[0];
            audio.playMusic("stage", m);
        }

        // ---------- formation ----------
        formationOffset() {
            return Math.round(Math.sin(this.time0 * 0.7) * 34);
        }
        slotPos(slot) {
            const x0 = W / 2 - ((COLS - 1) / 2) * SLOT_DX;
            return { x: x0 + slot.col * SLOT_DX + this.formationOffset(), y: FORMATION_Y + slot.row * SLOT_DY };
        }
        takeSlot(type) {
            const tryRows = (rows) => {
                for (const row of rows) {
                    for (const col of CENTER_OUT) {
                        const key = `${row}:${col}`;
                        if (!this.occupied.has(key)) { this.occupied.add(key); return { row, col, key }; }
                    }
                }
                return null;
            };
            return tryRows(SLOT_ROWS[type] || SLOT_ROWS.scout) || tryRows([3, 2, 1, 0]) || { row: 3, col: 0, key: "overflow" };
        }

        // ---------- spawning ----------
        spawnEnemy(type, pathName) {
            const def = ENEMY_TYPES[type] || ENEMY_TYPES.scout;
            const path = ENTRY_PATHS[pathName] || ENTRY_PATHS.left_arc;
            const sprite = this.add.image(path[0].x, path[0].y, def.tex);
            this.enemies.push({ sprite, type, def, hp: def.hp, slot: this.takeSlot(type), state: "enter", path, u: 0, dur: 2.3, fired: 0 });
        }
        updateSpawning(dt) {
            if (this.spawnQueue.length) {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    const s = this.spawnQueue.shift();
                    this.spawnEnemy(s.enemy, s.path);
                    this.spawnTimer = 0.17;
                }
                return;
            }
            if (!this.waveQueue.length) return;
            this.waveTimer -= dt;
            if (this.waveTimer > 0) return;
            const w = this.waveQueue.shift();
            for (let i = 0; i < (w.count || 1); i++) this.spawnQueue.push({ enemy: w.enemy, path: w.path });
            this.spawnTimer = 0;
            this.waveTimer = 2.6;
        }
        allSpawned() {
            return !this.waveQueue.length && !this.spawnQueue.length;
        }

        // ---------- enemies ----------
        startDive(e) {
            const from = { x: e.sprite.x, y: e.sprite.y };
            const dir = from.x < W / 2 ? -1 : 1;
            const px = this.player.x;
            e.state = "dive";
            e.u = 0;
            e.dur = 2.8 / Math.min(1.5, 0.85 + this.stageIndex * 0.12);
            e.fired = 0;
            e.path = [
                from,
                { x: from.x + dir * 90, y: from.y - 60 },
                { x: px + Phaser.Math.Between(-120, 120), y: H * 0.65 },
                { x: px + Phaser.Math.Between(-160, 160), y: H + 40 },
            ];
            audio.sfx("dive");
        }
        enemyFire(e) {
            if (!this.playerAlive) return;
            const sp = 210 * diff.bulletSpeed;
            const dx = this.player.x - e.sprite.x;
            const dy = this.player.y - e.sprite.y;
            const len = Math.hypot(dx, dy) || 1;
            const b = this.add.image(e.sprite.x, e.sprite.y + 10, "ebullet");
            this.ebullets.push({ sprite: b, vx: (dx / len) * sp, vy: Math.max(0.5, dy / len) * sp });
        }
        updateEnemies(dt) {
            for (const e of this.enemies) {
                const s = e.sprite;
                if (e.state === "enter" || e.state === "dive") {
                    e.u += dt / e.dur;
                    const prev = { x: s.x, y: s.y };
                    const p = bezier(...e.path, Math.min(1, e.u));
                    s.setPosition(p.x, p.y);
                    s.rotation = Math.atan2(p.y - prev.y, p.x - prev.x) - Math.PI / 2;
                    if (e.state === "dive") {
                        const fireAt = [0.35, 0.55];
                        if (e.fired < fireAt.length && e.u > fireAt[e.fired]) {
                            if (Math.random() < (this.stage.enemy_fire ?? 0.6) * diff.fire) this.enemyFire(e);
                            e.fired++;
                        }
                    }
                    if (e.u >= 1) {
                        if (e.state === "dive") s.setPosition(this.slotPos(e.slot).x, -30);
                        e.state = "join";
                    }
                } else if (e.state === "join") {
                    const t = this.slotPos(e.slot);
                    const dx = t.x - s.x, dy = t.y - s.y;
                    const d = Math.hypot(dx, dy);
                    const step = 260 * dt;
                    if (d <= step) {
                        s.setPosition(t.x, t.y);
                        s.rotation = 0;
                        e.state = "formation";
                    } else {
                        s.setPosition(s.x + (dx / d) * step, s.y + (dy / d) * step);
                        s.rotation = Math.atan2(dy, dx) - Math.PI / 2;
                    }
                } else {
                    const t = this.slotPos(e.slot);
                    // 隊列中は2コマのはばたき(80年代風の簡易アニメ)
                    s.setPosition(t.x, t.y + (Math.floor(this.time0 * 4 + e.slot.col) % 2 ? 2 : 0));
                    s.rotation = 0;
                }
            }
            if (this.state !== "play" || !this.playerAlive) return;
            this.diveTimer -= dt;
            if (this.diveTimer <= 0) {
                this.diveTimer = (this.stage.dive_interval ?? 3) / diff.dive * Phaser.Math.FloatBetween(0.7, 1.2);
                const diving = this.enemies.filter((e) => e.state === "dive").length;
                const idle = this.enemies.filter((e) => e.state === "formation");
                const n = Math.min(idle.length, diff.maxDivers - diving, Math.random() < 0.35 ? 2 : 1);
                for (let i = 0; i < n; i++) {
                    const idx = Math.floor(Math.random() * idle.length);
                    this.startDive(idle.splice(idx, 1)[0]);
                }
            }
        }

        // ---------- player ----------
        updatePlayer(dt) {
            if (!this.playerAlive) return;
            const k = this.keys;
            const pad = this.input.gamepad?.pad1;
            let vx = 0;
            if (k.LEFT.isDown || k.A.isDown || pad?.left || (pad?.leftStick?.x ?? 0) < -0.3) vx -= 1;
            if (k.RIGHT.isDown || k.D.isDown || pad?.right || (pad?.leftStick?.x ?? 0) > 0.3) vx += 1;
            this.player.x = Phaser.Math.Clamp(this.player.x + vx * 270 * dt, 20, W - 20);

            this.fireCd -= dt;
            const fireHeld = k.SPACE.isDown || k.Z.isDown || pad?.A;
            if (fireHeld && this.fireCd <= 0 && this.shots.length < diff.maxShots && this.state === "play") {
                this.shots.push(this.add.image(this.player.x, this.player.y - 18, "shot"));
                this.fireCd = 0.2;
                audio.sfx("shoot");
            }
            if (this.invuln > 0) {
                this.invuln -= dt;
                this.player.setVisible(Math.floor(this.invuln * 10) % 2 === 0);
                if (this.invuln <= 0) this.player.setVisible(true);
            }
        }

        // ---------- bullets / collisions ----------
        explode(x, y, color = 0xffffff, n = 10) {
            for (let i = 0; i < n; i++) {
                const p = this.add.image(x, y, "spark").setTint(i % 3 === 0 ? 0xf8f8f8 : color);
                const a = Math.random() * Math.PI * 2;
                const d = 16 + Math.random() * 40;
                this.tweens.add({
                    targets: p, x: Math.round(x + Math.cos(a) * d), y: Math.round(y + Math.sin(a) * d), alpha: 0,
                    duration: 350 + Math.random() * 250, onComplete: () => p.destroy(),
                });
            }
        }
        killEnemy(e, idx) {
            const bonus = e.state === "dive" ? 2 : 1;
            this.score += e.def.points * bonus;
            this.explode(e.sprite.x, e.sprite.y, e.def.color, 12);
            e.sprite.destroy();
            this.occupied.delete(e.slot.key);
            this.enemies.splice(idx, 1);
            audio.sfx("boom");
            this.updateHud();
        }
        updateBullets(dt) {
            for (let i = this.shots.length - 1; i >= 0; i--) {
                const s = this.shots[i];
                s.y -= 540 * dt;
                let hit = false;
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    const e = this.enemies[j];
                    if (Math.hypot(e.sprite.x - s.x, e.sprite.y - s.y) < e.def.r + 4) {
                        e.hp--;
                        if (e.hp <= 0) this.killEnemy(e, j);
                        else {
                            e.sprite.setTintFill(0xffffff);
                            this.time.delayedCall(70, () => e.sprite.active && e.sprite.clearTint());
                            audio.sfx("hit");
                        }
                        hit = true;
                        break;
                    }
                }
                if (hit || s.y < -20) { s.destroy(); this.shots.splice(i, 1); }
            }
            for (let i = this.ebullets.length - 1; i >= 0; i--) {
                const b = this.ebullets[i];
                b.sprite.x += b.vx * dt;
                b.sprite.y += b.vy * dt;
                if (this.canBeHit() && Math.hypot(b.sprite.x - this.player.x, b.sprite.y - this.player.y) < 10) {
                    b.sprite.destroy(); this.ebullets.splice(i, 1);
                    this.playerHit();
                    continue;
                }
                if (b.sprite.y > H + 20 || b.sprite.x < -20 || b.sprite.x > W + 20) { b.sprite.destroy(); this.ebullets.splice(i, 1); }
            }
            if (this.canBeHit()) {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    const e = this.enemies[j];
                    if (Math.hypot(e.sprite.x - this.player.x, e.sprite.y - this.player.y) < e.def.r + 9) {
                        this.killEnemy(e, j);
                        this.playerHit();
                        break;
                    }
                }
            }
        }
        canBeHit() {
            return this.playerAlive && this.invuln <= 0 && this.state === "play";
        }
        playerHit() {
            this.playerAlive = false;
            this.player.setVisible(false);
            this.explode(this.player.x, this.player.y, 0x40c8f8, 22);
            audio.sfx("playerDown");
            this.lives--;
            this.updateHud();
            this.time.delayedCall(1600, () => {
                if (this.lives > 0) {
                    this.player.setPosition(W / 2, H - 56).setVisible(true);
                    this.playerAlive = true;
                    this.invuln = 2.2;
                } else {
                    this.gameOver();
                }
            });
        }

        // ---------- stage flow / result ----------
        buildRewards(clearedUpto, cleared) {
            const out = [];
            const add = (text, source, extra = {}) => { if (text) out.push({ type: "prompt", text, weight: 1, source, ...extra }); };
            add(prompts.style, "style");
            add(prompts.character, "character");
            if (cleared) add(prompts.ending, "scene");
            stages.slice(0, clearedUpto + 1).forEach((st) => add(st.clear_prompt, "clear", { stage: st.id }));
            return out;
        }
        result(cleared, clearedUpto) {
            if (this.score >= ctx.hiScore) saveHiScore(ctx.hiScore);
            return {
                gameId: GAME_ID, cleared, score: this.score,
                stage: this.stageIndex + 1, stagesTotal: stages.length,
                negative: prompts.negative || "",
                rewards: this.buildRewards(clearedUpto, cleared),
            };
        }
        stageClear() {
            this.state = "stageclear";
            audio.playMusic("clear");
            const last = this.stageIndex >= stages.length - 1;
            this.showBanner(tr("stageClear"), this.stage.clear_prompt ? `${tr("promptGet")}\n"${this.stage.clear_prompt}"` : "");
            this.time.delayedCall(2700, () => {
                this.hideBanner();
                const proceed = () => {
                    if (last) this.allClear();
                    else this.scene.restart({ stageIndex: this.stageIndex + 1, score: this.score, lives: this.lives });
                };
                const after = this.stage.story_after || [];
                if (after.length && !ctx.skipStory) this.startStory(after, proceed);
                else proceed();
            });
        }
        allClear() {
            this.state = "done";
            this.doneAt = performance.now();
            audio.playMusic("title");
            this.showBanner(tr("allClear"), `SCORE ${pad6(this.score)}\n\n${tr("again")}`);
            ctx.advance = false;
            finish(this.result(true, this.stageIndex));
        }
        gameOver() {
            this.state = "done";
            this.doneAt = performance.now();
            audio.playMusic("gameover");
            this.showBanner(tr("gameOver"), `SCORE ${pad6(this.score)}\n\n${tr("again")}`);
            ctx.advance = false;
            finish(this.result(false, this.stageIndex - 1));
        }
        applyDebugClear() {
            ctx.debugClear = false;
            ctx.skipStory = true;
            this.story.box.setVisible(false);
            this.enemies.forEach((e) => e.sprite.destroy());
            this.enemies = [];
            this.waveQueue = [];
            this.spawnQueue = [];
            this.stageIndex = stages.length - 1;
            this.stage = stages[this.stageIndex];
            this.stageClear();
        }

        update(_t, delta) {
            const rawDt = Math.min(0.05, delta / 1000);
            if (this.state === "done") {
                this.stars(rawDt);
                // 終了直後の連打でリザルトを飛ばさないよう、少し待ってから受け付ける
                if (ctx.advance) { ctx.advance = false; if (performance.now() - this.doneAt > 1500) restart(); }
                return;
            }
            if (ctx.pauseToggle) {
                ctx.pauseToggle = false;
                if (this.state !== "story") this.paused = !this.paused;
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
            if (ctx.debugClear && this.state !== "stageclear") { this.applyDebugClear(); return; }

            const dt = rawDt;
            this.time0 += dt;
            this.stars(dt);

            if (this.state === "story") { this.updateStory(dt); return; }
            if (this.state === "intro") {
                this.stateTimer -= dt;
                if (this.stateTimer <= 0) { this.state = "play"; this.hideBanner(); this.waveTimer = 0; ctx.advance = false; }
            }
            if (this.state === "play") this.updateSpawning(dt);
            this.updateEnemies(dt);
            this.updatePlayer(dt);
            this.updateBullets(dt);

            if (this.state === "play" && this.allSpawned() && this.enemies.length === 0 && this.playerAlive) {
                this.stageClear();
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
        scene: [BootScene, TitleScene, PlayScene],
    });

    function restart() {
        ctx.finished = false;
        ctx.debugClear = false;
        ctx.skipStory = false;
        ctx.externalPause = false;
        ctx.advance = false;
        ctx.play = null;
        audio.setPaused(false);
        const run = () => {
            ["play", "title", "boot"].forEach((key) => { if (game.scene.isActive(key) || game.scene.isPaused(key)) game.scene.stop(key); });
            game.scene.start("boot"); // boot → title (テクスチャ作成済みなら作り直さない)
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
        /** 動作確認用: 最終ステージをクリアした扱いにする(会話は飛ばす) */
        debugClear() { ctx.debugClear = true; },
        /** 動作確認用: 今のステージの敵を全部消す(会話は飛ばさない) */
        debugStageClear() {
            const p = ctx.play;
            if (!p || p.state !== "play") return false;
            p.enemies.forEach((e) => e.sprite.destroy());
            p.enemies = [];
            p.waveQueue = [];
            p.spawnQueue = [];
            return true;
        },
        /** 動作確認用: プレイ中の状態 */
        debugState() {
            const p = ctx.play;
            return p && p.sys.isActive() ? {
                state: p.state, playerX: Math.round(p.player.x), alive: p.playerAlive, lives: p.lives,
                shots: p.shots.length, enemies: p.enemies.length, score: p.score, paused: !!p.paused,
                external: ctx.externalPause, storyLine: p.state === "story" ? p.story.idx : null,
            } : null;
        },
    };
}

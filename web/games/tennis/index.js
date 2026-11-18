/**
 * SMASH HEART — 80年代風・後ろから見るテニスゲーム (WFS Games 第5弾、すべてオリジナル)
 *
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debug... }
 *
 * host: apiVersion / lang / settings { difficulty, sound, bgm } / runStart() / stageClear(result) / finish(result)
 *
 * ルール: 5人のライバルと1人ずつ対戦。1試合は4ゲーム(1ゲームは 15-30-40-デュース)。多く取った方の勝ち、
 * 2-2 は引き分けで「再戦 / 終了」を選ぶ。コートに出るハートに触れて取る(5個でプライベート写真)。
 * BGM は無し。打球音・バウンド・靴の音・ネット・観客は録音した効果音、主審のコールとサーブの掛け声はブラウザの音声合成。
 *
 * 座標はメートル: x = 横(右が +)、y = 奥行き(自分のベースライン 0、相手のベースライン 23.77)、z = 高さ。
 * カメラは自分のコートの後ろの上にある。投影: s = F / (y + D)、画面 = (W/2 + x*s, HOR + (CAMH - z)*s)。
 */
import * as Phaser from "../../vendor/phaser/phaser.esm.min.js";
// 共通ファイルは版を付けて読む(古い audio.js / retro.js がブラウザに残っていても新しい機能を使えるように)
import { createAudio } from "../../common/audio.js?v=0.4.1";
import { loadFont, txt, COL, pad, StoryBox, addScanlines } from "../../common/retro.js?v=0.4.1";
import { makeTennisTextures, makeRivalTextures } from "./sprites.js?v=0.1.2";
import { SQUEAKS } from "./squeak.js?v=0.1.2";

const GAME_ID = "tennis";
const W = 480;
const H = 320;
const HISCORE_KEY = "wfs_games_tennis_hiscore";
const ITEMS_PER_STAGE = 5;
const GAMES_PER_MATCH = 4;

// ---- コート(メートル) ----
const HALF_W = 4.115;
const LEN = 23.77;
const NET_Y = LEN / 2;
const NET_H = 0.914;
const SVC = 6.40;            // ネットからサービスラインまで
const G = 9.8;
// ---- カメラ ----
const D = 14, F = 700, CAMH = 6.03, HOR = -51.5;
const proj = (x, y, z = 0) => { const s = F / (y + D); return { sx: W / 2 + x * s, sy: HOR + (CAMH - z) * s, s }; };
const depthOf = (y) => 100 - y;
// ---- 選手 ----
const BODY_H = 1.65;         // 体の高さ(m)。テクスチャは 42px
const PLAYER_SPEED = 5.6;
const P_BOUNDS = { x: [-6.2, 6.2], y: [-2.3, NET_Y - 0.7] };
const R_BOUNDS = { x: [-6.2, 6.2], y: [NET_Y + 0.7, 26.6] };
const SWING_TIME = 0.3;
// サーブ: トスはラケットを持つ手の真上(体の中心から 0.39m)に上げ、頂点(約2.4m)をラケットの面で打つ
const HAND_X = 0.39;
const TOSS_Z = 1.4, TOSS_VZ = 4.4;
const TOSS_APEX_T = TOSS_VZ / G;      // 0.45 秒
const HEART_INTERVAL = 8;
const HEART_LIFE = 9;

const DIFFICULTY = {
    easy: { reach: 1.75, aiSpeed: 0.85, aiError: 0.06 },
    normal: { reach: 1.45, aiSpeed: 1.0, aiError: 0 },
    hard: { reach: 1.25, aiSpeed: 1.1, aiError: -0.03 },
};

// サーブの掛け声(音声合成)。ヒロインと各ライバル
const SHOUTS = {
    heroine: { lang: "ja-JP", words: ["はっ！", "えいっ！", "やっ！"], pitch: 1.6, rate: 1.5 },
    kurumi: { lang: "ja-JP", words: ["それっ！", "ほいっ！"], pitch: 1.4, rate: 1.4 },
    hinata: { lang: "ja-JP", words: ["えーいっ！", "ふわっ！"], pitch: 1.8, rate: 1.3 },
    gloria: { lang: "en-US", words: ["Hah!", "Take this!"], pitch: 0.9, rate: 1.3 },
    shion: { lang: "ja-JP", words: ["ふっ！", "せいっ！"], pitch: 1.1, rate: 1.4 },
    elena: { lang: "en-GB", words: ["Here!", "Hah!"], pitch: 1.2, rate: 1.2 },
};
const CALL_WORDS = ["Love", "Fifteen", "Thirty", "Forty"];

const TEXT = {
    en: {
        title: "SMASH HEART", pushStart: "PUSH SPACE KEY",
        controls: "MOVE ← → ↑ ↓   SHOT Z   LOB X   (SERVE: Z TO TOSS, Z TO HIT)   PAUSE ESC",
        aimHelp: "HOLD ← → TO AIM, ↑ DEEP, ↓ DROP SHOT",
        match: (n) => `MATCH ${n}`, vs: "VS", gameTo: (n) => `GAME ${n}`, deuce: "DEUCE", ad: (n) => `AD ${n}`,
        out: "OUT", net: "NET", fault: "FAULT", doubleFault: "DOUBLE FAULT", winner: "WINNER!", win: "YOU WIN!", lose: "YOU LOSE", draw: "DRAW",
        retry: "RETRY", quit: "QUIT", choose: "← → SELECT   SPACE / ENTER", perfect: "PERFECT!", privatePhoto: "ALL HEARTS: PRIVATE PHOTO",
        allClear: "CHAMPION!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / CLICK",
        difficulty: { easy: "EASY", normal: "NORMAL", hard: "HARD" },
    },
    ja: {
        title: "SMASH HEART", pushStart: "PUSH SPACE KEY",
        controls: "移動 ← → ↑ ↓  ショット Z  ロブ X  (サーブ: Z でトス、もう一度 Z で打つ)  一時停止 ESC",
        aimHelp: "打つ瞬間 ← → で打ち分け、↑ で深く、↓ でドロップ",
        match: (n) => `MATCH ${n}`, vs: "VS", gameTo: (n) => `GAME ${n}`, deuce: "DEUCE", ad: (n) => `AD ${n}`,
        out: "OUT", net: "NET", fault: "FAULT", doubleFault: "DOUBLE FAULT", winner: "WINNER!", win: "YOU WIN!", lose: "YOU LOSE", draw: "DRAW",
        retry: "再戦", quit: "終了", choose: "← → で選択   SPACE / ENTER で決定", perfect: "PERFECT!", privatePhoto: "ハート全部獲得: プライベート写真",
        allClear: "CHAMPION!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / クリック",
        difficulty: { easy: "やさしい", normal: "ふつう", hard: "むずかしい" },
    },
    zh: {
        title: "SMASH HEART", pushStart: "PUSH SPACE KEY",
        controls: "移动 ← → ↑ ↓  击球 Z  高吊球 X  (发球: Z 抛球，再按 Z 击球)  暂停 ESC",
        aimHelp: "击球瞬间 ← → 控制方向，↑ 打深，↓ 放小球",
        match: (n) => `MATCH ${n}`, vs: "VS", gameTo: (n) => `GAME ${n}`, deuce: "DEUCE", ad: (n) => `AD ${n}`,
        out: "OUT", net: "NET", fault: "FAULT", doubleFault: "DOUBLE FAULT", winner: "WINNER!", win: "YOU WIN!", lose: "YOU LOSE", draw: "DRAW",
        retry: "再战", quit: "结束", choose: "← → 选择   SPACE / ENTER 确定", perfect: "PERFECT!", privatePhoto: "全部爱心获得: 私人照片",
        allClear: "CHAMPION!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / 点击",
        difficulty: { easy: "简单", normal: "普通", hard: "困难" },
    },
};

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyZ", "KeyX", "KeyP", "Escape", "Enter"]);
// 録音した効果音(Stable Audio 3 で生成)。靴の音は squeak.js で合成する
const SFX = ["hit1", "hit2", "bounce1", "bounce2", "net", "applause", "cheer", "ambience"];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const hex = (s) => parseInt(String(s).replace("#", ""), 16);

async function loadData() {
    const res = await fetch(new URL("./stages.json", import.meta.url));
    if (!res.ok) throw new Error(`stages.json: HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.stages) || !data.stages.length) throw new Error("stages.json: no stages");
    return data;
}
function loadHiScore() { try { return Number(localStorage.getItem(HISCORE_KEY)) || 0; } catch { return 0; } }
function saveHiScore(v) { try { localStorage.setItem(HISCORE_KEY, String(v)); } catch { /* ignore */ } }

/** 音声合成(主審のコールと掛け声)。使えない環境や効果音オフでは何もしない */
function createVoice(enabled) {
    const ss = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!enabled || !ss || typeof SpeechSynthesisUtterance === "undefined") return { speak() {}, cancel() {} };
    const pickVoice = (lang) => {
        const vs = ss.getVoices() || [];
        return vs.find((v) => v.lang === lang) || vs.find((v) => v.lang?.startsWith(lang.slice(0, 2))) || null;
    };
    ss.getVoices(); // 一覧の読み込みを始めておく
    return {
        speak(text, { lang = "en-US", pitch = 1, rate = 1, volume = 0.9, interrupt = false } = {}) {
            try {
                if (interrupt) ss.cancel();
                const u = new SpeechSynthesisUtterance(text);
                u.lang = lang;
                const v = pickVoice(lang);
                if (v) u.voice = v;
                u.pitch = pitch;
                u.rate = rate;
                u.volume = volume;
                ss.speak(u);
            } catch { /* ignore */ }
        },
        cancel() { try { ss.cancel(); } catch { /* ignore */ } },
    };
}

/** ボールの先の動きを計算する(バウンドも含む)。stop(st) が true を返した時点の状態を返す */
function simulate(b, bounce, maxT, stop) {
    let { x, y, z, vx, vy, vz } = b;
    let t = 0, bounces = b.bounces || 0;
    const dt = 1 / 60;
    while (t < maxT) {
        vz -= G * dt;
        x += vx * dt; y += vy * dt; z += vz * dt; t += dt;
        let bounced = false;
        if (z <= 0 && vz < 0) { z = 0; bounces++; vz = -vz * bounce; vx *= 0.82; vy *= 0.82; bounced = true; }
        const st = { x, y, z, t, bounces, vz, bounced };
        if (stop(st)) return st;
    }
    return null;
}

/** (bx,by,bz) から (tx,ty) に T 秒で落ちる初速。clearNet ならネットを越えるまで滞空時間をのばす */
function aimVelocity(b, tx, ty, T, clearNet = true) {
    for (let i = 0; i < 20; i++) {
        const vx = (tx - b.x) / T, vy = (ty - b.y) / T, vz = (-b.z + 0.5 * G * T * T) / T;
        if (!clearNet) return { vx, vy, vz };
        const tn = (NET_Y - b.y) / vy;
        if (!(tn > 0 && tn < T)) return { vx, vy, vz };
        const zn = b.z + vz * tn - 0.5 * G * tn * tn;
        if (zn > NET_H + 0.3) return { vx, vy, vz };
        T += 0.08;
    }
    return { vx: (tx - b.x) / T, vy: (ty - b.y) / T, vz: (-b.z + 0.5 * G * T * T) / T };
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
    const heroineName = loc(data.heroine?.name) || "NANAMI";
    // BGM は無し。効果音は録音したサンプル
    const audio = createAudio({ sound: settings.sound !== false, bgm: false, songs: {} });
    const sfxBase = new URL("./sfx/", import.meta.url);
    const samplesReady = audio.loadSamples(Object.fromEntries(SFX.map((n) => [n, new URL(`${n}.ogg`, sfxBase).href])));
    for (const [name, make] of Object.entries(SQUEAKS)) audio.addSynthSample(name, make);
    const voice = createVoice(settings.sound !== false);

    const ctx = { finished: false, skipStory: false, externalPause: false, pauseToggle: false, advance: false, play: null, hiScore: loadHiScore() };
    const finish = (result) => {
        if (ctx.finished) return;
        ctx.finished = true;
        try { host.finish?.(result); } catch (e) { console.error("[tennis] host.finish failed", e); }
    };
    const syncAudioPause = () => {
        const p = ctx.play;
        const paused = ctx.externalPause || !!(p && p.sys.isActive() && p.paused);
        audio.setPaused(paused);
        if (paused) voice.cancel();
    };

    container.innerHTML = "";
    const root = document.createElement("div");
    root.tabIndex = 0;
    root.style.cssText = "width:100%;height:100%;outline:none;position:relative;";
    container.appendChild(root);
    addScanlines(root);

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

    // ---------------- コートを描く ----------------

    function drawCourt(scene, venue) {
        const g = scene.add.graphics().setDepth(0);
        const court = hex(venue.court), out = hex(venue.out);
        g.fillStyle(out, 1).fillRect(0, 0, W, H);
        // 観客席(奥)
        const standTop = 0, standBot = proj(0, 30).sy + 4;
        g.fillStyle(hex(venue.sky), 1).fillRect(0, standTop, W, 10);
        g.fillStyle(hex(venue.stands), 1).fillRect(0, 10, W, standBot - 10);
        const crowd = [0xf8d0a8, 0xf85858, 0x58c8f8, 0xf8f048, 0xf8f8f8, 0x58e858, 0xc898f8, 0xe8a058];
        for (let y = 14; y < standBot - 4; y += 5) {
            for (let x = 2; x < W; x += 5) {
                if (Math.random() < 0.8) g.fillStyle(pick(crowd), venue.night ? 0.6 : 0.85).fillRect(x + (y % 10 ? 2 : 0), y, 2, 3);
            }
        }
        g.fillStyle(0x101018, 1).fillRect(0, standBot - 3, W, 3);
        // 夜は照明
        if (venue.night) {
            [60, 180, 300, 420].forEach((x) => { g.fillStyle(0xf8f8e0, 1).fillRect(x - 8, 2, 16, 4); g.fillStyle(0xf8f8c0, 0.15).fillTriangle(x - 8, 6, x + 8, 6, x + 60 * (x < 240 ? 1 : -1), 120); });
        }
        // コートの面(周りより少し広く)
        const quad = (x0, y0, x1, y1, color) => {
            const a = proj(x0, y0), b = proj(x1, y0), c = proj(x1, y1), d = proj(x0, y1);
            g.fillStyle(color, 1).fillPoints([{ x: a.sx, y: a.sy }, { x: b.sx, y: b.sy }, { x: c.sx, y: c.sy }, { x: d.sx, y: d.sy }], true);
        };
        quad(-6.4, -3.2, 6.4, LEN + 3.6, court);
        // ライン
        g.lineStyle(2, 0xf8f8f8, 1);
        const line = (x0, y0, x1, y1) => { const a = proj(x0, y0), b = proj(x1, y1); g.lineBetween(a.sx, a.sy, b.sx, b.sy); };
        line(-HALF_W, 0, HALF_W, 0);
        line(-HALF_W, LEN, HALF_W, LEN);
        line(-HALF_W, 0, -HALF_W, LEN);
        line(HALF_W, 0, HALF_W, LEN);
        line(-HALF_W, NET_Y - SVC, HALF_W, NET_Y - SVC);
        line(-HALF_W, NET_Y + SVC, HALF_W, NET_Y + SVC);
        line(0, NET_Y - SVC, 0, NET_Y + SVC);
        line(0, 0, 0, 0.25);
        line(0, LEN, 0, LEN - 0.25);
        // ネット(ネットより手前の物は上に描く)
        const n = scene.add.graphics().setDepth(depthOf(NET_Y));
        const pts = (z) => [proj(-5.6, NET_Y, z), proj(5.6, NET_Y, z)];
        const [l0, r0] = pts(0), [l1, r1] = pts(NET_H);
        n.fillStyle(0x101018, 0.55).fillPoints([{ x: l0.sx, y: l0.sy }, { x: r0.sx, y: r0.sy }, { x: r1.sx, y: r1.sy }, { x: l1.sx, y: l1.sy }], true);
        n.lineStyle(1, 0x303038, 0.6);
        for (let x = -5.4; x <= 5.4; x += 0.3) { const a = proj(x, NET_Y, 0), b = proj(x, NET_Y, NET_H); n.lineBetween(a.sx, a.sy, b.sx, b.sy); }
        n.lineStyle(3, 0xf8f8f8, 1).lineBetween(l1.sx, l1.sy, r1.sx, r1.sy);
        n.lineStyle(3, 0x585868, 1).lineBetween(l0.sx, l0.sy, proj(-5.6, NET_Y, 1.07).sx, proj(-5.6, NET_Y, 1.07).sy);
        n.lineBetween(r0.sx, r0.sy, proj(5.6, NET_Y, 1.07).sx, proj(5.6, NET_Y, 1.07).sy);
        return g;
    }

    // ---------------- title ----------------

    class TitleScene extends Phaser.Scene {
        constructor() { super("title"); }
        create() {
            this.started = false;
            makeTennisTextures(this);
            drawCourt(this, stages[0].venue);
            this.add.rectangle(W / 2, H / 2, W, H, 0x000010, 0.45).setDepth(150);
            const D2 = 200;
            const g = this.add.graphics().setDepth(D2);
            g.lineStyle(2, 0xf8f8f8, 1).strokeRect(10, 10, W - 20, H - 20);
            g.lineStyle(2, 0xf858f8, 1).strokeRect(15, 15, W - 30, H - 30);
            txt(this, W / 2 + 3, 51, tr("title"), 32, COL.magenta).setOrigin(0.5).setDepth(D2);
            txt(this, W / 2, 48, tr("title"), 32, COL.yellow).setOrigin(0.5).setDepth(D2);
            txt(this, W / 2, 80, `- ${tr("difficulty")[settings.difficulty] || ""} -`, 16, COL.white).setOrigin(0.5).setDepth(D2);
            this.add.graphics().setDepth(D2).lineStyle(2, 0xf8f8f8, 1).strokeRect(W / 2 - 28, 104, 56, 56);
            this.add.image(W / 2, 132, "hero_face").setDepth(D2);
            txt(this, W / 2, 172, heroineName, 16, COL.yellow).setOrigin(0.5).setDepth(D2);
            const start = txt(this, W / 2, 214, tr("pushStart"), 16, COL.yellow).setOrigin(0.5).setDepth(D2);
            this.time.addEvent({ delay: 480, loop: true, callback: () => start.setVisible(!start.visible) });
            txt(this, W / 2, 250, tr("controls"), 16, COL.white).setOrigin(0.5).setScale(0.55).setDepth(D2);
            txt(this, W / 2, 268, tr("aimHelp"), 16, COL.gray).setOrigin(0.5).setScale(0.55).setDepth(D2);
            txt(this, W / 2, 290, `HI ${pad(ctx.hiScore)}`, 16, COL.white).setOrigin(0.5).setScale(0.8).setDepth(D2);
            ctx.advance = false;
        }
        begin() {
            if (this.started) return;
            this.started = true;
            audio.unlock();
            audio.sfx("start");
            try { host.runStart?.(); } catch (e) { console.error("[tennis] host.runStart failed", e); }
            this.scene.start("match", { stageIndex: 0, score: 0 });
        }
        update() {
            if (ctx.advance) { ctx.advance = false; this.begin(); }
            const pad1 = this.input.gamepad?.pad1;
            if (pad1 && (pad1.A || pad1.buttons?.[9]?.pressed)) this.begin();
        }
    }

    // ---------------- match ----------------

    class MatchScene extends Phaser.Scene {
        constructor() { super("match"); }

        init(d) {
            this.stageIndex = d.stageIndex ?? 0;
            this.score = d.score ?? 0;
            this.stage = stages[this.stageIndex];
            this.rivalDef = this.stage.rival;
            this.ai = { ...this.rivalDef.ai };
        }

        create() {
            ctx.play = this;
            ctx.pauseToggle = false;
            this.paused = false;
            this._wasPaused = false;
            this.time0 = 0;
            this.predCache = null;
            this.predMark = null;
            makeTennisTextures(this);
            makeRivalTextures(this, this.rivalDef);
            const venue = this.stage.venue;
            this.bounce = venue.bounce ?? (this.stage.id === 2 ? 0.66 : this.stage.id === 3 ? 0.5 : 0.6);
            drawCourt(this, venue);
            this.fx = this.add.graphics().setDepth(0.5); // 落下点の目印はコートの上

            const rid = this.rivalDef.id;
            this.player = this.makeChar("hero", "racket", 1);
            this.rival = this.makeChar(`rival_${rid}`, "racket_r", -1);
            this.ball = { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, active: false, toss: false, dead: true, bounces: 0, lastHitter: null, serve: false, netted: false, shots: 0 };
            this.ballSprite = this.add.image(0, 0, "ball").setVisible(false);
            this.ballShadow = this.add.image(0, 0, "shadow").setAlpha(0.35).setVisible(false);

            // スコア
            this.games = [0, 0];      // [自分, 相手]
            this.pts = [0, 0];
            this.faults = 0;
            this.rallyShots = 0;
            this.itemsGot = 0;
            this.heartsSpawned = 0;
            this.heartClock = 0;
            this.heart = null;
            this.state = "story";
            this.choiceIdx = 0;

            this.buildHud();
            this.banner = txt(this, W / 2, 110, "", 32, COL.yellow).setOrigin(0.5).setDepth(320).setVisible(false);
            this.subBanner = txt(this, W / 2, 140, "", 16, COL.white).setOrigin(0.5, 0).setDepth(320).setVisible(false);
            this.subBanner.setWordWrapWidth(W - 60, true);
            this.pauseText = txt(this, W / 2, H / 2, tr("paused"), 32, COL.white).setOrigin(0.5).setDepth(340).setVisible(false);
            this.story = new StoryBox(this, {
                W, H, portrait: "hero_face", speakerName: heroineName, nextLabel: tr("next"), loc, sfx: (n) => audio.sfx(n), depth: 330,
                speakers: { heroine: { portrait: "hero_face", name: heroineName }, rival: { portrait: `rival_${rid}_face`, name: loc(this.rivalDef.name) } },
            });

            this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,UP,DOWN,Z,X,SPACE,ENTER");
            this.events.once("shutdown", () => { audio.stopLoop("ambience"); voice.cancel(); });
            samplesReady.then(() => { if (this.sys.isActive()) audio.startLoop("ambience", 0.45); });

            this.placeForPoint();
            this.render3d();
            this.updateHud();
            const before = this.stage.story_before || [];
            if (before.length && !ctx.skipStory) this.startStory(before, () => this.startIntro());
            else this.startIntro();
        }

        makeChar(prefix, racketKey, facing) {
            const sprite = this.add.image(0, 0, `${prefix}_stand`).setOrigin(0.5, 1);
            const racket = this.add.image(0, 0, racketKey).setOrigin(0.5, 0.92);
            const shadow = this.add.image(0, 0, "shadow").setAlpha(0.35);
            return { prefix, sprite, racket, shadow, facing, x: 0, y: 0, vx: 0, vy: 0, swingT: 0, swingKind: "drive", swingHit: false, runT: 0, squeakCd: 0, lastSpeed: 0 };
        }

        // ---------- HUD ----------
        buildHud() {
            const D3 = 300;
            this.hudBg = this.add.rectangle(6, 4, 168, 40, 0x000010, 0.7).setOrigin(0).setDepth(D3).setStrokeStyle(1, 0xf8f8f8, 0.8);
            this.nameP = txt(this, 12, 7, heroineName, 16, COL.yellow).setDepth(D3).setScale(0.75);
            this.nameR = txt(this, 12, 25, loc(this.rivalDef.name), 16, this.stage.color || COL.white).setDepth(D3).setScale(0.75);
            this.gamesP = txt(this, 110, 7, "", 16, COL.white).setDepth(D3).setScale(0.75);
            this.gamesR = txt(this, 110, 25, "", 16, COL.white).setDepth(D3).setScale(0.75);
            this.ptsP = txt(this, 136, 7, "", 16, COL.cyan).setDepth(D3).setScale(0.75);
            this.ptsR = txt(this, 136, 25, "", 16, COL.cyan).setDepth(D3).setScale(0.75);
            this.serveDot = this.add.image(100, 0, "ball").setDepth(D3).setScale(0.8);
            this.callText = txt(this, W / 2, 62, "", 16, COL.white).setOrigin(0.5).setDepth(D3);
            this.hearts = [];
            for (let i = 0; i < ITEMS_PER_STAGE; i++) this.hearts.push(this.add.image(W - 14 - (ITEMS_PER_STAGE - 1 - i) * 12, 12, "heart_s").setDepth(D3));
            this.scoreText = txt(this, W - 10, 22, "", 16, COL.white).setOrigin(1, 0).setDepth(D3).setScale(0.7);
            this.choicePanel = this.add.rectangle(W / 2, 196, 260, 36, 0x000010, 0.85).setStrokeStyle(2, 0xf8f8f8, 1).setDepth(318).setVisible(false);
            this.choiceText = txt(this, W / 2, 196, "", 16, COL.white).setOrigin(0.5).setDepth(320).setVisible(false);
        }
        pointLabel(i) {
            const [p, r] = this.pts;
            if (p >= 3 && r >= 3) {
                if (p === r) return i === 0 ? tr("deuce") : "";
                const leader = p > r ? 0 : 1;
                return i === leader ? "AD" : "";
            }
            return ["0", "15", "30", "40"][this.pts[i]] ?? "";
        }
        updateHud() {
            if (this.score > ctx.hiScore) ctx.hiScore = this.score;
            this.gamesP.setText(String(this.games[0]));
            this.gamesR.setText(String(this.games[1]));
            this.ptsP.setText(this.pointLabel(0));
            this.ptsR.setText(this.pointLabel(1));
            this.serveDot.setY(this.playerServes() ? 14 : 32);
            this.hearts.forEach((h, i) => h.setAlpha(i < this.itemsGot ? 1 : 0.2));
            this.scoreText.setText(`SCORE ${pad(this.score)}`);
        }
        showBanner(main, sub = "", color = COL.yellow) {
            this.banner.setText(main).setColor(color).setVisible(true);
            this.subBanner.setText(sub).setVisible(!!sub);
        }
        hideBanner() { this.banner.setVisible(false); this.subBanner.setVisible(false); }
        flashCall(text, color = COL.white, ms = 1400) {
            this.callText.setText(text).setColor(color).setVisible(true);
            this.time.delayedCall(ms, () => { if (this.callText.text === text) this.callText.setVisible(false); });
        }

        // ---------- story / flow ----------
        startStory(lines, done) {
            this.state = "story";
            this.hideBanner();
            ctx.advance = false;
            this.story.start(lines, done);
        }
        startIntro() {
            this.state = "intro";
            this.introT = 2.6;
            this.showBanner(tr("match", this.stageIndex + 1), `${tr("vs")} ${loc(this.rivalDef.name)}  -  ${loc(this.rivalDef.type)}\n${loc(this.stage.name)}`, this.stage.color || COL.yellow);
            audio.playSample("applause", { vol: 0.6 });
        }

        playerServes() { return (this.games[0] + this.games[1]) % 2 === 0; }

        /** ポイントの始まりの立ち位置。デュースサイド(合計ポイントが偶数)は、サーバーから見て右から打つ */
        placeForPoint() {
            const deuce = (this.pts[0] + this.pts[1]) % 2 === 0;
            const p = this.player, r = this.rival;
            const side = deuce ? 1 : -1; // 自分から見て +x がデュースサイド
            if (this.playerServes()) {
                Object.assign(p, { x: 1.0 * side, y: -0.6 });
                Object.assign(r, { x: -2.3 * side, y: 24.6 });
            } else {
                Object.assign(r, { x: -1.0 * side, y: 24.4 });
                Object.assign(p, { x: 2.3 * side, y: -0.4 });
            }
            [p, r].forEach((c) => { c.vx = 0; c.vy = 0; c.swingT = 0; });
            Object.assign(this.ball, { active: false, toss: false, dead: false, bounces: 0, lastHitter: null, serve: false, netted: false });
            this.rallyShots = 0;
            this.aiTarget = null;
            this.aiLetGo = false;
            this.aiServeT = 1.3;
            this.serveDecided = false;
            this.rivalHome = null;
        }

        // ---------- ショット ----------
        hitBall(side, tx, ty, T, { clearNet = true, serve = false } = {}) {
            const b = this.ball;
            const v = aimVelocity(b, tx, ty, T, clearNet);
            Object.assign(b, v, { active: true, toss: false, bounces: 0, lastHitter: side, serve, netted: false });
            b.shots++;
            this.rallyShots++;
            const isP = side === "p";
            audio.playSample(pick(["hit1", "hit2"]), { vol: isP ? 0.95 : 0.55, rate: rand(0.94, 1.08), pan: clamp(b.x / 6, -0.8, 0.8) });
            this.aiTarget = null;
            this.aiLetGo = false;
            if (!isP) this.aiReact = 0;
            else this.aiReact = 0.16;
        }

        playerSwing(kind) {
            const p = this.player;
            if (p.swingT > 0) return;
            p.swingT = SWING_TIME;
            p.swingKind = kind;
            p.swingHit = false;
        }

        /** 打てる位置にボールがあれば、手元からの距離を返す */
        reachDist(c, side) {
            const b = this.ball;
            if (!b.active || b.toss || b.dead || b.lastHitter === side || b.netted) return null;
            const own = side === "p" ? b.y < NET_Y : b.y > NET_Y;
            if (!own) return null;
            if (b.serve && b.bounces === 0) return null; // サーブはバウンドしてから
            if (b.bounces >= 2 || b.z > 2.7) return null;
            const hx = c.x + (side === "p" ? 0.35 : -0.35);
            const d = Math.hypot(b.x - hx, b.y - c.y);
            const reach = side === "p" ? diff.reach : 1.5;
            return d < reach ? d : null;
        }

        playerShot() {
            const p = this.player, r = this.rival, k = this.keys;
            const d = this.reachDist(p, "p");
            if (d === null) return false;
            const q = clamp(1 - d / diff.reach, 0, 1); // 芯に近いほど正確
            const left = k.LEFT.isDown, right = k.RIGHT.isDown, up = k.UP.isDown, down = k.DOWN.isDown;
            let tx = left ? -3.3 : right ? 3.3 : (r.x > 0 ? -2.3 : 2.3) + rand(-0.8, 0.8);
            let ty, T;
            if (p.swingKind === "lob") { ty = rand(20.5, 22.5); T = rand(1.9, 2.2); }
            else if (down) { ty = rand(13.6, 15.2); T = 1.25; }
            else if (up) { ty = rand(21, 22.8); T = 0.98; }
            else { ty = rand(19, 22); T = rand(1.15, 1.3); }
            const err = 0.25 + (1 - q) * 1.5;
            tx += rand(-err, err);
            ty += rand(-err, err) * 0.8;
            this.hitBall("p", tx, ty, T);
            if (up && p.swingKind !== "lob" && Math.random() < 0.4) voice.speak("はっ", { lang: "ja-JP", pitch: 1.6, rate: 1.6, volume: 0.6 });
            return true;
        }

        rivalShot() {
            const ai = this.ai, p = this.player;
            const err = clamp(ai.error + diff.aiError, 0.01, 0.4);
            const flight = ai.flight || [1.2, 1.5];
            if (Math.random() < err) {
                // ミス: アウトかネット
                if (Math.random() < 0.6) {
                    const wide = Math.random() < 0.5;
                    const tx = wide ? (Math.random() < 0.5 ? -1 : 1) * rand(HALF_W + 0.4, HALF_W + 1.6) : rand(-3, 3);
                    const ty = wide ? rand(2, 6) : rand(-1.8, -0.4);
                    this.hitBall("r", tx, ty, rand(flight[0], flight[1]));
                } else {
                    this.hitBall("r", rand(-2.5, 2.5), NET_Y - 1.0, 0.42, { clearNet: false });
                }
                return;
            }
            const spread = Math.min(3.6, ai.spread || 2.5);
            let tx = (p.x > 0 ? -1 : 1) * rand(spread * 0.4, spread);
            if (Math.random() < 0.25) tx = rand(-spread, spread);
            let ty = rand(1.0, 4.5), T = rand(flight[0], flight[1]);
            if (Math.random() < (ai.lob || 0)) { ty = rand(0.8, 2.6); T = rand(1.9, 2.3); }
            else if (Math.random() < (ai.drop || 0)) { ty = rand(8.3, 10); T = 1.15; }
            this.hitBall("r", tx, ty, T);
            // ネットプレーヤーは打ったら前へ
            if (ai.net) this.rivalHome = { x: clamp(this.ball.x * 0.4, -2, 2), y: NET_Y + 3.2 };
        }

        // ---------- サーブ ----------
        startToss(c) {
            const b = this.ball;
            Object.assign(b, { x: c.x + HAND_X * c.facing, y: c.y, z: TOSS_Z, vx: 0, vy: 0, vz: TOSS_VZ, active: true, toss: true, dead: false, bounces: 0, lastHitter: null });
            c.tossAt = this.time0;
        }
        serveHit(side, q, aimX = 0) {
            const server = side === "p" ? this.player : this.rival;
            const sign = server.x > 0 ? -1 : 1; // 対角のサービスボックス
            let tx = sign * 2.05 + aimX * 1.1;
            let ty = side === "p" ? NET_Y + SVC - 0.9 : NET_Y - SVC + 0.9;
            const e = 1 - q;
            tx += rand(-e, e) * 1.4;
            ty += (side === "p" ? 1 : -1) * rand(-0.6, 1) * e * 1.8;
            let clearNet = true;
            if (q < 0.15) {
                // 打ち損じ: ネットかロング
                if (Math.random() < 0.5) { clearNet = false; ty = NET_Y + (side === "p" ? 1 : -1) * 1.2; }
                else ty += (side === "p" ? 1 : -1) * rand(1.5, 3);
            }
            const T = clearNet ? 1.35 - 0.38 * q : 0.45;
            this.hitBall(side, tx, ty, T, { clearNet, serve: true });
            this.ball.boxSign = sign; // 入ったかどうかは、打った時点のサービスボックスで判定する(サーバーはその後動く)
            const sh = side === "p" ? SHOUTS.heroine : (SHOUTS[this.rivalDef.id] || SHOUTS.heroine);
            voice.speak(pick(sh.words), { lang: sh.lang, pitch: sh.pitch, rate: sh.rate, volume: side === "p" ? 0.85 : 0.6 });
        }

        // ---------- ルール ----------
        onBounce() {
            const b = this.ball;
            if (b.dead || !b.lastHitter) return;
            const other = b.lastHitter === "p" ? "r" : "p";
            const sideNow = b.y < NET_Y ? "p" : "r";
            if (b.bounces === 1) {
                if (b.serve) {
                    const sign = b.boxSign || 1;
                    const inX = sign < 0 ? b.x >= -HALF_W - 0.03 && b.x <= 0.03 : b.x >= -0.03 && b.x <= HALF_W + 0.03;
                    const inY = b.lastHitter === "p" ? b.y >= NET_Y && b.y <= NET_Y + SVC + 0.03 : b.y <= NET_Y && b.y >= NET_Y - SVC - 0.03;
                    if (!(inX && inY)) { this.fault(b.lastHitter); return; }
                    return;
                }
                const inside = Math.abs(b.x) <= HALF_W + 0.03 && b.y >= -0.03 && b.y <= LEN + 0.03 && sideNow === other;
                if (!inside) { this.pointTo(other, tr("out")); return; }
            } else if (b.bounces >= 2) {
                this.pointTo(b.lastHitter, this.rallyShots >= 2 ? tr("winner") : "");
            }
        }
        fault(server) {
            const b = this.ball;
            b.dead = true;
            this.faults++;
            if (this.faults >= 2) {
                this.faults = 0;
                this.pointTo(server === "p" ? "r" : "p", tr("doubleFault"));
                voice.speak("Double fault", { lang: "en-US", pitch: 0.9, rate: 1.0, interrupt: true });
                return;
            }
            this.flashCall(tr("fault"), COL.orange);
            voice.speak("Fault", { lang: "en-US", pitch: 0.9, rate: 1.0, interrupt: true });
            this.state = "between";
            this.time.delayedCall(1300, () => {
                if (this.state !== "between") return;
                const keepFaults = this.faults;
                this.placeForPoint();
                this.faults = keepFaults;
                this.state = "serve";
            });
        }
        pointTo(winner, label = "") {
            if (this.state === "point") return;
            const b = this.ball;
            b.dead = true;
            this.state = "point";
            this.faults = 0;
            const wi = winner === "p" ? 0 : 1;
            this.pts[wi]++;
            if (winner === "p") this.score += 100;
            if (label) this.flashCall(label, winner === "p" ? COL.green : COL.red);
            audio.playSample("applause", { vol: clamp(0.35 + this.rallyShots * 0.06, 0.35, 0.9), rate: rand(0.95, 1.05) });
            const [p, r] = this.pts;
            const won = Math.max(p, r) >= 4 && Math.abs(p - r) >= 2;
            this.time.delayedCall(1700, () => {
                if (won) this.endGame(wi);
                else {
                    this.callScore();
                    this.placeForPoint();
                    this.state = "serve";
                    this.updateHud();
                }
            });
            this.updateHud();
        }
        callScore() {
            const [p, r] = this.pts;
            const serverIdx = this.playerServes() ? 0 : 1;
            let call;
            if (p >= 3 && r >= 3) call = p === r ? "Deuce" : `Advantage ${p > r ? heroineName : loc(this.rivalDef.name)}`;
            else {
                const a = this.pts[serverIdx], b = this.pts[1 - serverIdx];
                call = a === b ? `${CALL_WORDS[a]} all` : `${CALL_WORDS[a]} ${CALL_WORDS[b]}`;
            }
            voice.speak(call, { lang: "en-US", pitch: 0.95, rate: 1.0, interrupt: true });
            this.flashCall(call.toUpperCase(), COL.white, 1600);
        }
        endGame(wi) {
            this.games[wi]++;
            if (wi === 0) this.score += 500;
            this.pts = [0, 0];
            const name = wi === 0 ? heroineName : loc(this.rivalDef.name);
            voice.speak(`Game, ${name}`, { lang: "en-US", pitch: 0.95, rate: 1.0, interrupt: true });
            audio.playSample("applause", { vol: 0.8 });
            this.showBanner(`GAME ${name}`, `${this.games[0]} - ${this.games[1]}`, wi === 0 ? COL.green : COL.red);
            this.updateHud();
            this.state = "gameEnd";
            this.time.delayedCall(2200, () => {
                this.hideBanner();
                if (this.games[0] + this.games[1] >= GAMES_PER_MATCH) this.endMatch();
                else { this.placeForPoint(); this.state = "serve"; this.updateHud(); }
            });
        }
        endMatch() {
            const [a, b] = this.games;
            this.ball.active = false;
            this.ballSprite.setVisible(false);
            this.ballShadow.setVisible(false);
            if (a > b) {
                this.score += 3000 * (this.stageIndex + 1);
                audio.playSample("cheer", { vol: 0.9 });
                this.showBanner(tr("win"), `${a} - ${b}`, COL.green);
                this.state = "matchEnd";
                this.time.delayedCall(2200, () => this.startStory(this.stage.story_win || [], () => this.stageClear()));
            } else if (a < b) {
                audio.playSample("applause", { vol: 0.5 });
                this.showBanner(tr("lose"), `${a} - ${b}`, COL.red);
                this.state = "matchEnd";
                this.time.delayedCall(2200, () => this.startStory(this.stage.story_lose || [], () => this.gameOver()));
            } else {
                audio.playSample("applause", { vol: 0.6 });
                this.showBanner(tr("draw"), `${a} - ${b}`, COL.yellow);
                this.state = "matchEnd";
                const lines = [...(prompts.draw_story || []), ...(this.stage.story_draw || [])];
                this.time.delayedCall(2000, () => this.startStory(lines, () => this.showChoice()));
            }
            this.updateHud();
        }
        showChoice() {
            this.state = "choice";
            this.choiceIdx = 0;
            this.showBanner(tr("draw"), tr("choose"), COL.yellow);
            this.renderChoice();
            this.choicePanel.setVisible(true);
            this.choiceText.setVisible(true);
        }
        renderChoice() {
            const a = this.choiceIdx === 0 ? `▶ ${tr("retry")}` : `  ${tr("retry")}`;
            const b = this.choiceIdx === 1 ? `▶ ${tr("quit")}` : `  ${tr("quit")}`;
            this.choiceText.setText(`${a}      ${b}`);
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
                stage: this.stageIndex + 1, stagesTotal: stages.length, stageName: `${loc(this.stage.name)} vs ${loc(this.rivalDef.name)}`,
                negative, rewards,
            };
        }
        stageClear() {
            this.state = "stageclear";
            try { host.stageClear?.(this.result("stage")); } catch (e) { console.error("[tennis] host.stageClear failed", e); }
            const last = this.stageIndex >= stages.length - 1;
            const perfect = this.perfect();
            if (perfect) { audio.sfx("perfect"); this.showBanner(tr("perfect"), tr("privatePhoto")); }
            else this.showBanner(tr("win"), "");
            this.time.delayedCall(2200, () => {
                this.hideBanner();
                const proceed = () => {
                    if (last) this.allClear();
                    else this.scene.restart({ stageIndex: this.stageIndex + 1, score: this.score });
                };
                const after = perfect ? prompts.private_story || [] : [];
                if (after.length && !ctx.skipStory) this.startStory(after, proceed);
                else proceed();
            });
        }
        allClear() {
            this.state = "done";
            this.doneAt = performance.now();
            audio.playSample("cheer", { vol: 1 });
            this.showBanner(tr("allClear"), `SCORE ${pad(this.score)}\n\n${tr("again")}`);
            ctx.advance = false;
            finish(this.result("ending"));
        }
        gameOver() {
            finish(this.result("gameover"));
            this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(315);
            this.state = "done";
            this.doneAt = performance.now();
            this.choiceText.setVisible(false);
            this.showBanner(tr("gameOver"), `SCORE ${pad(this.score)}\n\n${tr("again")}`, COL.red);
            ctx.advance = false;
        }

        // ---------- 毎フレーム: 選手 ----------
        moveChar(c, ax, ay, speed, dt, bounds) {
            const tvx = ax * speed, tvy = ay * speed;
            const k = Math.min(1, dt * 12);
            const pvx = c.vx, pvy = c.vy;
            c.vx = lerp(c.vx, tvx, k);
            c.vy = lerp(c.vy, tvy, k);
            c.x = clamp(c.x + c.vx * dt, bounds.x[0], bounds.x[1]);
            c.y = clamp(c.y + c.vy * dt, bounds.y[0], bounds.y[1]);
            // 靴の音: 急に止まる・切り返すとき
            c.squeakCd = Math.max(0, c.squeakCd - dt);
            const sp = Math.hypot(c.vx, c.vy), psp = Math.hypot(pvx, pvy);
            const reverse = psp > 2.5 && (pvx * tvx + pvy * tvy) < -0.5;
            const stop = psp > 2.6 && Math.hypot(tvx, tvy) < 0.1;
            if ((reverse || stop) && c.squeakCd <= 0) {
                c.squeakCd = 0.45;
                const isP = c === this.player;
                audio.playSample(stop ? pick(["squeak1", "squeak3"]) : pick(["squeak1", "squeak2", "squeak3"]), { vol: isP ? 0.45 : 0.2, rate: rand(0.93, 1.07), pan: clamp(c.x / 6, -0.8, 0.8) });
            }
            c.runT += dt * (sp > 0.6 ? 1 : 0);
            c.lastSpeed = sp;
        }

        updatePlayer(dt) {
            const p = this.player, k = this.keys;
            const pad1 = this.input.gamepad?.pad1;
            let ax = (k.LEFT.isDown ? -1 : 0) + (k.RIGHT.isDown ? 1 : 0);
            let ay = (k.UP.isDown ? 1 : 0) + (k.DOWN.isDown ? -1 : 0);
            if (pad1) {
                const sx = pad1.leftStick?.x || 0, sy = pad1.leftStick?.y || 0;
                if (Math.abs(sx) > 0.25) ax = sx;
                if (Math.abs(sy) > 0.25) ay = -sy;
                if (pad1.left) ax = -1; if (pad1.right) ax = 1; if (pad1.up) ay = 1; if (pad1.down) ay = -1;
            }
            const serving = this.state === "serve" && this.playerServes();
            if (serving) { ax = 0; ay = 0; }
            if (this.state === "point" || this.state === "gameEnd" || this.state === "between") { ax *= 0.4; ay *= 0.4; }
            const len = Math.hypot(ax, ay);
            if (len > 1) { ax /= len; ay /= len; }
            if (ctx.autoPlay) { const a = this.autoMove(p, "p"); ax = a.ax; ay = a.ay; }
            this.moveChar(p, ax, ay, PLAYER_SPEED, dt, P_BOUNDS);

            const zDown = Phaser.Input.Keyboard.JustDown(k.Z) || Phaser.Input.Keyboard.JustDown(k.SPACE) || (pad1 && pad1.A && !this._padA);
            const xDown = Phaser.Input.Keyboard.JustDown(k.X) || (pad1 && pad1.B && !this._padB);
            this._padA = !!(pad1 && pad1.A);
            this._padB = !!(pad1 && pad1.B);
            if (serving && !this.serveDecided) {
                const b = this.ball;
                if (zDown || (ctx.autoPlay && !b.toss)) {
                    if (!b.toss) { this.startToss(p); }
                    else {
                        const t = this.time0 - p.tossAt;
                        const q = clamp(1 - Math.abs(t - TOSS_APEX_T) / 0.3, 0, 1);
                        p.swingT = SWING_TIME; p.swingKind = "serve"; p.swingHit = true;
                        this.serveDecided = true;
                        this.state = "rally";
                        this.serveHit("p", q, k.LEFT.isDown ? -1 : k.RIGHT.isDown ? 1 : 0);
                    }
                }
                if (ctx.autoPlay && b.toss && this.time0 - p.tossAt >= TOSS_APEX_T) {
                    p.swingT = SWING_TIME; p.swingKind = "serve"; this.serveDecided = true; this.state = "rally"; this.serveHit("p", 0.9, 0);
                }
                return;
            }
            if (this.state === "rally" || this.state === "serve") {
                if (zDown) this.playerSwing("drive");
                else if (xDown) this.playerSwing("lob");
                if (ctx.autoPlay && p.swingT <= 0 && this.reachDist(p, "p") !== null) this.playerSwing("drive");
            }
            if (p.swingT > 0) {
                p.swingT -= dt;
                const t = SWING_TIME - p.swingT;
                if (!p.swingHit && t > 0.02 && t < 0.24 && (this.state === "rally" || this.state === "serve")) {
                    if (this.playerShot()) p.swingHit = true;
                }
            }
        }

        /** 自動で動く(ライバルと、動作確認用の自動プレイ) */
        autoMove(c, side) {
            const b = this.ball;
            const isR = side === "r";
            let target = null;
            const coming = b.active && !b.toss && !b.dead && b.lastHitter && b.lastHitter !== side;
            if (coming) {
                if (!this.predCache || this.predCache.shots !== b.shots || this.predCache.side !== side) {
                    // 1回目のバウンドの位置(アウトなら見送る)と、打つ位置
                    const first = simulate(b, this.bounce, 4, (st) => st.bounced);
                    let letGo = false;
                    if (first && !b.serve) {
                        const inside = Math.abs(first.x) <= HALF_W + 0.05 && (isR ? first.y >= NET_Y && first.y <= LEN + 0.05 : first.y <= NET_Y && first.y >= -0.05);
                        letGo = !inside;
                    }
                    let hit = null;
                    if (isR && this.ai.net && c.y < NET_Y + 6 && !b.serve) {
                        hit = simulate(b, this.bounce, 3, (st) => st.bounces === 0 && st.y >= c.y - 0.2 && st.z < 2.2);
                    }
                    if (!hit) hit = simulate(b, this.bounce, 4, (st) => (st.bounces >= 1 && st.vz < 0 && st.z < 1.1) || (isR ? st.y > 26.4 : st.y < -2.2));
                    this.predCache = { shots: b.shots, side, hit, letGo, first };
                }
                const pc = this.predCache;
                if (pc.hit) target = { x: pc.hit.x - (isR ? -0.35 : 0.35), y: pc.hit.y };
                if (pc.letGo) target = target ? { x: lerp(c.x, target.x, 0.3), y: target.y } : null;
                if (isR) this.aiLetGo = pc.letGo;
            }
            if (!target) {
                const home = isR ? (this.rivalHome || { x: clamp(b.x * 0.3, -1.5, 1.5), y: 24.6 }) : { x: clamp(b.x * 0.3, -1.5, 1.5), y: -0.6 };
                target = home;
            }
            const dx = target.x - c.x, dy = target.y - c.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.08) return { ax: 0, ay: 0 };
            const f = Math.min(1, dist / 0.6);
            return { ax: (dx / dist) * f, ay: (dy / dist) * f };
        }

        updateRival(dt) {
            const r = this.rival;
            const serving = this.state === "serve" && !this.playerServes();
            let a = { ax: 0, ay: 0 };
            if (!serving && (this.state === "rally" || this.state === "serve")) {
                this.aiReact = Math.max(0, (this.aiReact || 0) - dt);
                if (this.aiReact <= 0) a = this.autoMove(r, "r");
            }
            if (this.ball.lastHitter === "p" && !this.ai.net) this.rivalHome = null;
            this.moveChar(r, a.ax, a.ay, (this.ai.speed || 5) * diff.aiSpeed, dt, R_BOUNDS);
            if (serving && !this.serveDecided) {
                this.aiServeT -= dt;
                const b = this.ball;
                if (this.aiServeT <= 0 && !b.toss) this.startToss(r);
                if (b.toss && this.time0 - r.tossAt >= TOSS_APEX_T) {
                    const faultP = (this.ai.serveFault || 0.1) * (this.faults ? 0.5 : 1);
                    const q = Math.random() < faultP ? rand(0, 0.12) : rand(0.55, 0.95);
                    r.swingT = SWING_TIME; r.swingKind = "serve";
                    this.serveDecided = true;
                    this.state = "rally";
                    this.serveHit("r", q, rand(-0.6, 0.6));
                }
                return;
            }
            if (r.swingT > 0) r.swingT -= dt;
            if (this.state === "rally" && !this.aiLetGo && this.reachDist(r, "r") !== null) {
                r.swingT = SWING_TIME; r.swingKind = "drive";
                this.rivalShot();
            }
        }

        // ---------- 毎フレーム: ボール ----------
        updateBall(dt) {
            const b = this.ball;
            const p = this.player, r = this.rival;
            if (!b.active) {
                // サーバーの手元に持っている
                const s = this.playerServes() ? p : r;
                Object.assign(b, { x: s.x + HAND_X * s.facing, y: s.y, z: 1.0 });
                return;
            }
            const prev = { x: b.x, y: b.y, z: b.z };
            b.vz -= G * dt;
            b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
            if (b.toss) {
                if (b.z < 0.9 && b.vz < 0) {
                    // 打たずに落ちてきたら持ち直す(フォルトにはしない)
                    b.active = false; b.toss = false;
                }
                return;
            }
            // ネット
            if (!b.netted && (prev.y - NET_Y) * (b.y - NET_Y) < 0) {
                const f = (NET_Y - prev.y) / (b.y - prev.y);
                const zc = prev.z + (b.z - prev.z) * f;
                const xc = prev.x + (b.x - prev.x) * f;
                if (zc < NET_H && Math.abs(xc) < 5.6) {
                    b.netted = true;
                    b.y = NET_Y - Math.sign(b.vy) * 0.08;
                    b.vy = -b.vy * 0.12; b.vx *= 0.3; b.vz = Math.min(0, b.vz);
                    audio.playSample("net", { vol: 0.8, pan: clamp(b.x / 6, -0.8, 0.8) });
                    if (!b.dead && b.lastHitter) {
                        if (b.serve) this.fault(b.lastHitter);
                        else this.pointTo(b.lastHitter === "p" ? "r" : "p", tr("net"));
                    }
                }
            }
            // バウンド
            if (b.z <= 0 && b.vz < 0) {
                b.z = 0;
                const speed = Math.abs(b.vz);
                b.vz = -b.vz * this.bounce;
                b.vx *= 0.82; b.vy *= 0.82;
                if (Math.abs(b.vz) < 0.5) { b.vz = 0; b.vx *= 0.9; b.vy *= 0.9; }
                if (speed > 0.8) {
                    b.bounces++;
                    const near = b.y < NET_Y;
                    audio.playSample(pick(["bounce1", "bounce2"]), { vol: clamp(speed / 8, 0.15, 0.8) * (near ? 1 : 0.55), rate: rand(0.95, 1.05), pan: clamp(b.x / 6, -0.8, 0.8) });
                    if (this.state === "rally") this.onBounce();
                }
            }
            // 遠くへ転がっていったら消す
            if (b.dead && (b.y < -6 || b.y > 32 || Math.abs(b.x) > 12)) { b.active = false; }
        }

        // ---------- ハート ----------
        updateHeart(dt) {
            if (this.state === "rally" || this.state === "serve") this.heartClock += dt;
            if (!this.heart && this.heartsSpawned < ITEMS_PER_STAGE && this.heartClock >= HEART_INTERVAL) {
                this.heartClock = 0;
                this.heartsSpawned++;
                this.heart = { x: rand(-3.6, 3.6), y: rand(0.6, 9.5), t: 0, sprite: this.add.image(0, 0, "heart") };
            }
            const h = this.heart;
            if (!h) return;
            h.t += dt;
            const p = this.player;
            if (Math.hypot(h.x - p.x, h.y - p.y) < 0.8) {
                this.itemsGot++;
                this.score += 500;
                audio.sfx("item");
                const s = proj(h.x, h.y, 0.4);
                const t = txt(this, s.sx, s.sy - 10, "♥", 16, COL.magenta).setOrigin(0.5).setDepth(260);
                this.tweens.add({ targets: t, y: t.y - 24, alpha: 0, duration: 700, onComplete: () => t.destroy() });
                if (this.perfect()) this.flashCall(tr("perfect"), COL.magenta);
                h.sprite.destroy();
                this.heart = null;
                this.updateHud();
                return;
            }
            if (h.t > HEART_LIFE) { h.sprite.destroy(); this.heart = null; }
        }

        // ---------- 描画 ----------
        render3d() {
            const drawChar = (c, frontView) => {
                const pp = proj(c.x, c.y, 0);
                const sc = (BODY_H * pp.s) / 42;
                const moving = c.lastSpeed > 0.6;
                const isServer = (c === this.player) === this.playerServes();
                const tossing = this.ball.toss && isServer;
                const serving = c.swingKind === "serve" && c.swingT > 0;
                // サーブ: トスでは反対の腕を上げ、打つ瞬間はラケットを持つ腕を頭の上まで伸ばした絵にする
                let frame = moving ? (Math.floor(c.runT * 8) % 2 ? "run1" : "run2") : "stand";
                if (serving) frame = "serve";
                else if (tossing) frame = "toss";
                c.sprite.setTexture(`${c.prefix}_${frame}`).setPosition(pp.sx, pp.sy).setScale(sc).setDepth(depthOf(c.y));
                c.shadow.setPosition(pp.sx, pp.sy).setScale(sc * 1.6, sc * 1.2).setDepth(depthOf(c.y) - 0.3);
                // ラケット: 手元に付けて、振りを回転で表す。打つ瞬間の手は伸ばした腕の先(足元から 48px = 約1.9m)
                const side = frontView ? -1 : 1;
                const hx = pp.sx + side * (serving ? 9 : 10) * sc, hy = pp.sy - (serving ? 48 : 22) * sc;
                let ang = 35;
                if (c.swingT > 0) {
                    const t = 1 - c.swingT / SWING_TIME;
                    if (c.swingKind === "serve") ang = t < 0.15 ? lerp(-20, 0, t / 0.15) : lerp(0, 140, (t - 0.15) / 0.85);
                    else ang = c.swingKind === "lob" ? lerp(120, -50, t) : lerp(110, -95, t);
                } else if (tossing) ang = 150; // トス中はラケットを下げて構える
                c.racket.setPosition(hx, hy).setScale((0.68 * pp.s) / 20).setAngle(ang * side).setDepth(depthOf(c.y) + 0.2);
            };
            drawChar(this.player, false);
            drawChar(this.rival, true);
            const b = this.ball;
            const show = b.active || (!b.dead && ["serve", "intro"].includes(this.state));
            if (show) {
                const bp = proj(b.x, b.y, b.z);
                const size = Math.max(2.5, 0.2 * bp.s);
                this.ballSprite.setVisible(true).setPosition(bp.sx, bp.sy).setScale(size / 8).setDepth(depthOf(b.y) + 0.5);
                const sp = proj(b.x, b.y, 0);
                this.ballShadow.setVisible(b.z > 0.02).setPosition(sp.sx, sp.sy).setScale(size / 10, size / 16).setDepth(depthOf(b.y) - 0.4);
            } else { this.ballSprite.setVisible(false); this.ballShadow.setVisible(false); }
            if (this.heart) {
                const h = this.heart;
                const hp = proj(h.x, h.y, 0.35 + Math.sin(h.t * 5) * 0.1);
                const blink = h.t > HEART_LIFE - 2 && Math.floor(h.t * 8) % 2 === 0;
                h.sprite.setPosition(hp.sx, hp.sy).setScale((0.55 * hp.s) / 18).setDepth(depthOf(h.y)).setVisible(!blink);
            }
            // 相手の打った球が落ちる位置の目印
            const g = this.fx;
            g.clear();
            if (b.active && !b.dead && b.lastHitter === "r" && b.bounces === 0 && !b.toss) {
                const pc = this.predMark && this.predMark.shots === b.shots ? this.predMark : (this.predMark = { shots: b.shots, st: simulate(b, this.bounce, 4, (st) => st.bounced) });
                if (pc.st) {
                    const m = proj(pc.st.x, pc.st.y, 0);
                    g.lineStyle(1, 0xf8f048, 0.6).strokeEllipse(m.sx, m.sy, 0.5 * m.s, 0.2 * m.s);
                }
            }
        }

        update(_t, delta) {
            const dt = Math.min(0.05, delta / 1000);
            if (this.state === "done") {
                if (ctx.advance) { ctx.advance = false; if (performance.now() - this.doneAt > 1500) restart(); }
                return;
            }
            if (ctx.pauseToggle) {
                ctx.pauseToggle = false;
                if (["serve", "rally", "point", "between", "intro"].includes(this.state)) this.paused = !this.paused;
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
            this.time0 = (this.time0 || 0) + dt;

            if (this.state === "story") {
                this.story.update(dt, ctx.advance);
                ctx.advance = false;
                this.render3d();
                return;
            }
            if (this.state === "choice") {
                const k = this.keys;
                if (Phaser.Input.Keyboard.JustDown(k.LEFT) || Phaser.Input.Keyboard.JustDown(k.RIGHT)) { this.choiceIdx = 1 - this.choiceIdx; audio.sfx("text"); this.renderChoice(); }
                if (ctx.advance) {
                    ctx.advance = false;
                    this.choiceText.setVisible(false);
                    this.choicePanel.setVisible(false);
                    this.hideBanner();
                    if (this.choiceIdx === 0) this.scene.restart({ stageIndex: this.stageIndex, score: this.score });
                    else this.gameOver();
                }
                return;
            }
            ctx.advance = false;
            if (ctx.debugEnd) { const g = ctx.debugEnd; ctx.debugEnd = null; this.story.hide(); this.games = g; this.pts = [0, 0]; this.endMatch(); }
            if (this.state === "intro") {
                this.introT -= dt;
                if (this.introT <= 0) { this.hideBanner(); this.state = "serve"; this.callScoreStart(); }
            }
            if (["serve", "rally", "point", "between", "gameEnd", "intro"].includes(this.state)) {
                this.updatePlayer(dt);
                this.updateRival(dt);
                this.updateBall(dt);
                this.updateHeart(dt);
            }
            this.render3d();
            this.updateHud();
        }
        callScoreStart() {
            voice.speak(this.playerServes() ? `${heroineName} to serve. Play.` : `${loc(this.rivalDef.name)} to serve. Play.`, { lang: "en-US", pitch: 0.95, rate: 1.0, interrupt: true });
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
        scene: [TitleScene, MatchScene],
    });

    function restart() {
        Object.assign(ctx, { finished: false, skipStory: false, externalPause: false, advance: false, play: null, debugEnd: null, autoPlay: false });
        audio.setPaused(false);
        voice.cancel();
        const run = () => {
            ["match", "title"].forEach((key) => { if (game.scene.isActive(key) || game.scene.isPaused(key)) game.scene.stop(key); });
            game.scene.start("title");
        };
        if (game.isBooted) run(); else game.events.once("ready", run);
        focusRoot();
    }

    setTimeout(focusRoot, 0);

    return {
        unmount() {
            voice.cancel();
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
        /** 動作確認用: 指定の試合から(会話は飛ばすかどうか) */
        debugStartStage(n, skipStory = true) {
            ctx.skipStory = skipStory;
            ctx.finished = false;
            ["match", "title"].forEach((key) => { if (game.scene.isActive(key)) game.scene.stop(key); });
            game.scene.start("match", { stageIndex: clamp((n | 0) - 1, 0, stages.length - 1), score: 0 });
            return true;
        },
        /** 動作確認用: 自分を自動で動かして打たせる */
        debugAutoPlay(on = true) { ctx.autoPlay = !!on; return ctx.autoPlay; },
        /** 動作確認用: ゲーム数を決めて試合を終える(例 [3,1] 勝ち、[2,2] 引き分け) */
        debugEndMatch(p = 3, r = 1) { ctx.debugEnd = [p, r]; return true; },
        debugCollectAll() { const s = ctx.play; if (!s) return false; s.itemsGot = ITEMS_PER_STAGE; return true; },
        debugState() {
            const s = ctx.play;
            return s && s.sys.isActive() ? {
                state: s.state, stage: s.stageIndex + 1, games: [...s.games], pts: [...s.pts], score: s.score, items: s.itemsGot, hearts: s.heartsSpawned,
                rally: s.rallyShots, faults: s.faults, ball: { x: +s.ball.x.toFixed(2), y: +s.ball.y.toFixed(2), z: +s.ball.z.toFixed(2), active: s.ball.active, bounces: s.ball.bounces, last: s.ball.lastHitter, dead: s.ball.dead },
                player: { x: +s.player.x.toFixed(2), y: +s.player.y.toFixed(2) }, rival: { x: +s.rival.x.toFixed(2), y: +s.rival.y.toFixed(2) },
                samples: [...SFX, ...Object.keys(SQUEAKS)].filter((n) => audio.hasSample(n)).length,
            } : null;
        },
    };
}

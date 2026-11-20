/**
 * SHUTTER HEART — 80年代風のカメラマンゲーム (WFS Games 第7弾、すべてオリジナル)
 *
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debug... }
 *
 * host: apiVersion / lang / settings { difficulty, sound, bgm } / runStart() / stageClear(result) / finish(result)
 * result: { gameId, kind: "stage"|"ending"|"gameover", cleared, score, bonus, items, stage, stagesTotal, stageName, negative, rewards }
 *
 * 撮った写真がそのまま生成画像になる。プレイヤーは撮影場所(ステージごとに3か所)を選び、
 * そこでポーズを取るモデルのユイをファインダー(3:2 の撮影枠)で撮る。
 *   場所: 枠に目印(屋台・雪だるまなど)が入っていれば、その場所のプロンプトが写真に入る
 *   構図: 写った範囲で全身・膝上・上半身・顔のアップ、カメラの高さと傾きでアングルのタグ
 *   ポーズと表情: 気まぐれ(ランダム)。表情はシャッターの瞬間のバイオリズムで決まり、コンタクトシートで分かる
 *   バイオリズム: 3本の波(体・心・知)が上でそろった瞬間に撮るとベストショット(加点)
 * フィルムを使い切るか時間切れでコンタクトシートが出て、1枚選ぶ。目標点以上ならクリアで、その写真のタグがプロンプトになる。
 */
import * as Phaser from "../../vendor/phaser/phaser.esm.min.js";
import { createAudio } from "../../common/audio.js";
import { loadFont, txt, COL, pad, StoryBox, addScanlines } from "../../common/retro.js";
import { SONGS } from "./songs.js";
import { POSES, makeYuiTextures, makeCommonTextures, makePeople } from "./sprites.js";
import { makeSfx } from "./sfx.js";

const GAME_ID = "shutter";
const W = 480;
const H = 320;
const HISCORE_KEY = "wfs_games_shutter_hiscore";
const ITEMS_PER_STAGE = 5;

// ---- 舞台(奥行き) ----
const HORIZON = 128;          // 地平線(カメラの高さがアイレベルのとき)
const CAM_SHIFT = 22;         // ロー/ハイで地平線が動く量
const NEAR_Y = H - 14;        // 手前(d = 1)の足元の高さ
const FAR_GAP = 26;           // 地平線から奥(d = 0)の足元までの間
const S_FAR = 1.5, S_NEAR = 3.3; // ユイの拡大率(奥 → 手前)

// ---- ファインダー ----
const ASPECT = 1.5;           // 3:2
const FW_MIN = 56, FW_MAX = 300;
const FRAME_SPEED = 250;      // 枠の移動(px/秒)
const TILT_MAX = 25;          // 傾き(度)
const DUTCH = 10;             // これを超えたらダッチアングル
const SHUTTER_CD = 0.35;

// ---- バイオリズム(体・心・知の3本の波。周期は本物の 23 / 28 / 33 日にちなむ) ----
const BIO_PERIODS = [1.6, 1.95, 2.3];   // 秒(ステージの速さで短くなる)
const BIO_BEST = 0.7;                   // 3本の平均がこれ以上でベストショット
const BIO_COLORS = [0xf85858, 0x58e858, 0x58a8f8];
const BIO_PAST = 1.0, BIO_FUTURE = 2.2; // グラフに出す範囲(秒)

// ---- ポーズ(気まぐれに変わる)。sprite は見た目に使う絵 ----
const POSE_POOL = {
    stand: [
        { tag: "standing, hands on own hips", sprite: "stand", en: "HANDS ON HIPS", ja: "腰に手", zh: "叉腰" },
        { tag: "standing, arms behind back", sprite: "stand", en: "ARMS BEHIND BACK", ja: "後ろで手を組む", zh: "双手背后" },
        { tag: "waving, raised hand", sprite: "wave", en: "WAVING", ja: "手をふる", zh: "挥手" },
        { tag: "salute", sprite: "wave", en: "SALUTE", ja: "敬礼", zh: "敬礼" },
        { tag: "reaching towards viewer, outstretched hand", sprite: "wave", en: "REACHING OUT", ja: "手を差しのべる", zh: "伸出手" },
        { tag: "v sign", sprite: "peace", en: "PEACE SIGN", ja: "ピース", zh: "比耶" },
        { tag: "double v", sprite: "peace", en: "DOUBLE PEACE", ja: "ダブルピース", zh: "双手比耶" },
        { tag: "pointing at viewer", sprite: "peace", en: "POINTING", ja: "こっちを指さす", zh: "指向镜头" },
        { tag: "heart hands", sprite: "heart", en: "HEART HANDS", ja: "ハートハンド", zh: "比心" },
        { tag: "hands clasped, own hands together", sprite: "heart", en: "HANDS CLASPED", ja: "手を組む", zh: "双手合握" },
        { tag: "index finger raised, finger to mouth", sprite: "wink", en: "FINGER TO LIPS", ja: "口に人差し指", zh: "手指抵唇" },
        { tag: "hand on own cheek", sprite: "wink", en: "HAND ON CHEEK", ja: "ほおに手", zh: "手托脸颊" },
        { tag: "jumping, arms up", sprite: "jump", en: "JUMPING", ja: "ジャンプ", zh: "跳跃" },
        { tag: "arms up, stretching", sprite: "stretch", en: "STRETCHING", ja: "のび", zh: "伸懒腰" },
        { tag: "hand in own hair, hair flip", sprite: "stretch", en: "HAIR FLIP", ja: "髪をかきあげる", zh: "撩头发" },
        { tag: "from behind, looking back, looking over shoulder", sprite: "lookback", en: "LOOKING BACK", ja: "振り返り", zh: "回眸" },
        { tag: "spinning, twirling", sprite: "lookback", en: "TWIRLING", ja: "くるっと回る", zh: "转圈" },
        { tag: "covering mouth, hand over mouth", sprite: "surprise", en: "COVERING MOUTH", ja: "口に手", zh: "捂嘴" },
        { tag: "leaning forward, hands on own knees", sprite: "surprise", en: "LEANING FORWARD", ja: "前かがみ", zh: "前倾" },
    ],
    sit: [
        { tag: "sitting, hugging own knees", sprite: "sit", en: "HUGGING KNEES", ja: "ひざを抱える", zh: "抱膝" },
        { tag: "sitting, crossed legs", sprite: "sit", en: "LEGS CROSSED", ja: "足を組む", zh: "跷腿" },
        { tag: "sitting, head rest, chin rest", sprite: "sit", en: "CHIN ON HAND", ja: "ほおづえ", zh: "托腮" },
        { tag: "sitting, waving", sprite: "sit", en: "WAVING", ja: "座って手をふる", zh: "坐着挥手" },
        { tag: "sitting, v sign", sprite: "sit", en: "PEACE SIGN", ja: "座ってピース", zh: "坐着比耶" },
        { tag: "seiza", sprite: "sit", en: "SEIZA", ja: "正座", zh: "跪坐" },
        { tag: "sitting, leaning back, hands on ground", sprite: "sit", en: "LEANING BACK", ja: "後ろに手をつく", zh: "后仰撑地" },
    ],
};
// ---- 表情(シャッターの瞬間のバイオリズムで、どの表情の中から出るかが決まる) ----
const EXPR_POOL = {
    high: [
        { tag: "bright smile, sparkling eyes", en: "SPARKLING SMILE", ja: "キラキラ笑顔", zh: "闪亮笑容" },
        { tag: "laughing, open mouth, closed eyes", en: "LAUGHING", ja: "大笑い", zh: "大笑" },
        { tag: ":d, happy", en: "BIG GRIN", ja: "にっこり", zh: "开心" },
        { tag: "wink, one eye closed, smile", en: "WINK", ja: "ウインク", zh: "眨眼" },
        { tag: "smile, blush, happy", en: "SHY SMILE", ja: "照れ笑い", zh: "害羞的笑" },
        { tag: "grin, teeth", en: "GRIN", ja: "ニカッ", zh: "咧嘴笑" },
    ],
    mid: [
        { tag: "smile", en: "SMILE", ja: "ほほえみ", zh: "微笑" },
        { tag: "gentle smile, closed mouth", en: "GENTLE SMILE", ja: "やさしい笑み", zh: "温柔微笑" },
        { tag: "head tilt, curious", en: "HEAD TILT", ja: "首かしげ", zh: "歪头" },
        { tag: "surprised, open mouth", en: "SURPRISED", ja: "びっくり", zh: "惊讶" },
        { tag: "calm, closed mouth, expressionless", en: "COOL FACE", ja: "すまし顔", zh: "淡定" },
        { tag: "tongue out, playful", en: "TONGUE OUT", ja: "ペロッ", zh: "吐舌" },
    ],
    low: [
        { tag: "sleepy, half-closed eyes", en: "SLEEPY", ja: "ねむそう", zh: "困倦" },
        { tag: "pout, puffed cheeks", en: "POUTING", ja: "ふくれっ面", zh: "鼓腮" },
        { tag: "yawning, open mouth, tears", en: "YAWNING", ja: "あくび", zh: "打哈欠" },
        { tag: "awkward smile, sweatdrop", en: "AWKWARD", ja: "苦笑い", zh: "苦笑" },
        { tag: "closed eyes, blinking", en: "BLINKED", ja: "目つぶり", zh: "闭眼了" },
        { tag: "bored, half-closed eyes", en: "BORED", ja: "たいくつ", zh: "无聊" },
    ],
};

const DIFFICULTY = {
    easy: { chances: 4, target: -8, speed: 0.85, bombers: 0.7 },
    normal: { chances: 3, target: 0, speed: 1.0, bombers: 1.0 },
    hard: { chances: 2, target: 5, speed: 1.15, bombers: 1.3 },
};

const SHOT = {
    wide: { tag: "wide shot, full body, scenery", en: "WIDE SHOT", ja: "引きの全身", zh: "远景全身" },
    full: { tag: "full body", en: "FULL BODY", ja: "全身", zh: "全身" },
    cowboy: { tag: "cowboy shot", en: "COWBOY SHOT", ja: "膝上", zh: "七分身" },
    upper: { tag: "upper body", en: "UPPER BODY", ja: "上半身", zh: "上半身" },
    portrait: { tag: "portrait", en: "PORTRAIT", ja: "胸から上", zh: "胸像" },
    close: { tag: "close-up, face", en: "CLOSE-UP", ja: "顔のアップ", zh: "面部特写" },
};

// ---- ステージの景色 ----
const THEMES = {
    beach: {
        key: "beach", night: false,
        sky: [0x3888e8, 0x50a0f0, 0x70b8f8, 0x98d0f8, 0xc0e4f8], far: 0x2878c8, farLine: 0x88d0f8,
        ground: [0xf0d8a0, 0xe0c080], groundLine: 0xd0b070,
        outfit: { D: 0xf8f8f8, d: 0xc8d0e0, A: 0xe8c860, B: 0xc89058 },
        people: [{ hair: 0x302018, top: 0xf85858, bottom: 0x3858a8 }, { hair: 0xd8a868, top: 0x58c8f8, bottom: 0xf8f8f8 }, { hair: 0x201818, top: 0xf8d048, bottom: 0x58a858 }],
        props: [{ tex: "palm", x: 455, d: 0.05, tag: "palm tree" }, { tex: "palm", x: 168, d: 0.0, tag: "palm tree" }],
        gulls: true, sailboat: true,
    },
    festival: {
        key: "festival", night: true,
        sky: [0x080820, 0x101030, 0x181840, 0x282050, 0x382858], far: 0x201830, farLine: 0x403050,
        ground: [0x403028, 0x302018], groundLine: 0x584030,
        outfit: { D: 0xf898c0, d: 0xd06890, A: 0xf8e058, B: 0xb83838 },
        people: [{ hair: 0x201818, top: 0x4868c8, bottom: 0x4868c8 }, { hair: 0x302018, top: 0xf8a8c8, bottom: 0xf8a8c8 }, { hair: 0x201818, top: 0x58a868, bottom: 0x303030 }],
        props: [],
        fireworks: true, stars: true,
    },
    snow: {
        key: "snow", night: false,
        sky: [0x98a8c8, 0xa8b8d0, 0xb8c8d8, 0xc8d4e0, 0xd8e0e8], far: 0x8898b8, farLine: 0xe8f0f8,
        ground: [0xf8f8f8, 0xe0e8f0], groundLine: 0xd0d8e8,
        outfit: { D: 0xe03838, d: 0xa01828, A: 0xf8f8f8, B: 0x603820 },
        people: [{ hair: 0x302018, top: 0x384878, bottom: 0x303030 }, { hair: 0x201818, top: 0xf8d048, bottom: 0x484848 }, { hair: 0x806040, top: 0x58a868, bottom: 0x383838 }],
        props: [{ tex: "pine", x: 318, d: 0.0, tag: "snow-covered tree" }],
        snowfall: true,
    },
    city: {
        key: "city", night: true,
        sky: [0x080818, 0x101028, 0x181838, 0x281c48, 0x381c50], far: 0x181830, farLine: 0x282848,
        ground: [0x383848, 0x282830], groundLine: 0x484858,
        outfit: { D: 0x5878c0, d: 0x384878, A: 0x202028, B: 0x202028 },
        people: [{ hair: 0x201818, top: 0x202028, bottom: 0x202028 }, { hair: 0xd8b878, top: 0xf85898, bottom: 0x303040 }, { hair: 0x302018, top: 0x8890a8, bottom: 0x384878 }],
        props: [{ tex: "neon2", x: 300, sky: -46, tag: "neon sign" }],
        buildings: true, glare: true, stars: true,
    },
    sakura: {
        key: "sakura", night: false,
        sky: [0x78b0f0, 0x98c4f4, 0xb8d4f4, 0xe0d8f0, 0xf8e0ec], far: 0x88b878, farLine: 0xb0d8a0,
        ground: [0x88c868, 0x68a850], groundLine: 0x58984a,
        outfit: { D: 0x98c8f8, d: 0x6890c8, A: 0xf8f8f8, B: 0xf8f8f8 },
        people: [{ hair: 0x302018, top: 0xf8f8f8, bottom: 0x384878 }, { hair: 0x201818, top: 0xd8a8f8, bottom: 0x484848 }, { hair: 0xa07048, top: 0xf8d048, bottom: 0x58a868 }],
        props: [{ tex: "sakura", x: 440, d: 0.1, tag: "cherry blossom tree" }],
        petals: true,
    },
};

const TEXT = {
    en: {
        title: "SHUTTER HEART", pushStart: "PUSH SPACE KEY",
        controls: "SPOT Q / E  FRAME ← ↑ → ↓  ZOOM Z / X  TILT A / D  CAMERA HEIGHT W / S  SHUTTER SPACE  PAUSE ESC",
        stage: (n) => `STAGE ${n}`, target: (n) => `TARGET ${n} PTS`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "ALL HEARTS: PRIVATE PHOTO",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / CLICK",
        sheet: "CONTACT SHEET", choose: "← → ↑ ↓ SELECT   SPACE CHOOSE", below: "BELOW THE TARGET", noneOk: "NO PHOTO REACHED THE TARGET",
        retry: (n) => `SPACE: SHOOT AGAIN (${n} LEFT)`, giveUp: "SPACE: END", timeUp: "TIME UP", filmOut: "FILM OUT", miss: "MISS",
        parts: (a, b, c, d) => `FRAMING ${a}  PLACE ${b}  BIO ${c}  STEADY ${d}`,
        spot: (name, i, n) => `Q< SPOT ${i}/${n}: ${name} >E`, place: "PLACE", pose: "POSE", face: "FACE", best: "BEST SHOT!", bestShort: "BEST",
        offSpot: "(SPOT NOT IN FRAME)", blocked: "BLOCKED",
        angle: { "-1": "LOW", 0: "EYE", 1: "HIGH" }, difficulty: { easy: "EASY", normal: "NORMAL", hard: "HARD" },
    },
    ja: {
        title: "SHUTTER HEART", pushStart: "PUSH SPACE KEY",
        controls: "撮影場所 Q / E  枠の移動 ← ↑ → ↓  ズーム Z / X  傾き A / D  カメラの高さ W / S  シャッター SPACE  一時停止 ESC",
        stage: (n) => `STAGE ${n}`, target: (n) => `目標 ${n}点`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "ハート全部: プライベート写真",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / クリック",
        sheet: "コンタクトシート", choose: "← → ↑ ↓ で選んで SPACE", below: "目標点に届いていません", noneOk: "目標点に届いた写真がありません",
        retry: (n) => `SPACE: 撮り直す (残り ${n} 回)`, giveUp: "SPACE: 終了", timeUp: "TIME UP", filmOut: "フィルムがなくなりました", miss: "MISS",
        parts: (a, b, c, d) => `構図 ${a}  場所 ${b}  バイオ ${c}  ブレ ${d}`,
        spot: (name, i, n) => `Q< 撮影場所 ${i}/${n}: ${name} >E`, place: "場所", pose: "ポーズ", face: "表情", best: "BEST SHOT!", bestShort: "BEST",
        offSpot: "(場所が写っていない)", blocked: "写り込み",
        angle: { "-1": "ロー", 0: "アイ", 1: "ハイ" }, difficulty: { easy: "やさしい", normal: "ふつう", hard: "むずかしい" },
    },
    zh: {
        title: "SHUTTER HEART", pushStart: "PUSH SPACE KEY",
        controls: "地点 Q / E  取景框 ← ↑ → ↓  缩放 Z / X  倾斜 A / D  相机高度 W / S  快门 SPACE  暂停 ESC",
        stage: (n) => `STAGE ${n}`, target: (n) => `目标 ${n}分`, stageClear: "STAGE CLEAR", perfect: "PERFECT!", privatePhoto: "全部爱心: 私人照片",
        allClear: "ALL CLEAR!", gameOver: "GAME OVER", paused: "PAUSE", again: "PUSH SPACE KEY", next: "SPACE / 点击",
        sheet: "印样", choose: "← → ↑ ↓ 选择  SPACE 确定", below: "未达到目标分", noneOk: "没有达到目标分的照片",
        retry: (n) => `SPACE: 重拍 (剩余 ${n} 次)`, giveUp: "SPACE: 结束", timeUp: "TIME UP", filmOut: "胶卷用完了", miss: "MISS",
        parts: (a, b, c, d) => `构图 ${a}  地点 ${b}  节律 ${c}  稳定 ${d}`,
        spot: (name, i, n) => `Q< 拍摄地点 ${i}/${n}: ${name} >E`, place: "地点", pose: "姿势", face: "表情", best: "BEST SHOT!", bestShort: "BEST",
        offSpot: "(没拍到地点)", blocked: "遮挡",
        angle: { "-1": "低", 0: "平", 1: "高" }, difficulty: { easy: "简单", normal: "普通", hard: "困难" },
    },
};

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS", "KeyZ", "KeyX", "KeyQ", "KeyE", "Digit1", "Digit2", "Digit3", "KeyP", "Escape", "Enter"]);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function loadData() {
    const res = await fetch(new URL("./stages.json", import.meta.url));
    if (!res.ok) throw new Error(`stages.json: HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.stages) || !data.stages.length) throw new Error("stages.json: no stages");
    return data;
}
function loadHiScore() { try { return Number(localStorage.getItem(HISCORE_KEY)) || 0; } catch { return 0; } }
function saveHiScore(v) { try { localStorage.setItem(HISCORE_KEY, String(v)); } catch { /* ignore */ } }

/** 小物・背景のテクスチャ(図形で描く) */
function makePropTextures(scene) {
    if (scene.textures.exists("parasol")) return;
    const g = scene.add.graphics();
    const out = (k, w, h) => { g.generateTexture(k, w, h); g.clear(); };
    // ビーチパラソル
    g.fillStyle(0xf85858, 1).fillTriangle(2, 14, 20, 0, 38, 14);
    g.fillStyle(0xf8f8f8, 1).fillTriangle(12, 14, 20, 0, 20, 14).fillTriangle(28, 14, 20, 0, 34, 14);
    g.fillStyle(0x8a6a48, 1).fillRect(19, 12, 2, 30);
    out("parasol", 40, 42);
    // 砂の城
    g.fillStyle(0xd8b878, 1).fillRect(2, 10, 28, 12).fillRect(4, 4, 6, 8).fillRect(22, 4, 6, 8).fillRect(13, 0, 6, 12);
    g.fillStyle(0xb89858, 1).fillRect(2, 19, 28, 3).fillRect(14, 14, 4, 8);
    g.fillStyle(0xf85858, 1).fillTriangle(16, 0, 16, -0, 22, 0);
    out("sandcastle", 32, 22);
    // ヤシ
    g.fillStyle(0x8a6a48, 1).fillRect(14, 14, 4, 46);
    g.fillStyle(0x38a048, 1).fillEllipse(8, 12, 18, 6).fillEllipse(24, 12, 18, 6).fillEllipse(16, 6, 8, 12).fillEllipse(5, 18, 12, 5).fillEllipse(27, 18, 12, 5);
    out("palm", 32, 60);
    // 屋台
    for (const [k, c] of [["stall", 0xd83838], ["stall2", 0x3858c8]]) {
        g.fillStyle(0x5a3a28, 1).fillRect(2, 12, 2, 26).fillRect(40, 12, 2, 26);
        g.fillStyle(c, 1).fillRect(0, 4, 44, 10);
        g.fillStyle(0xf8f8f8, 1);
        for (let x = 0; x < 44; x += 8) g.fillRect(x, 4, 4, 10);
        g.fillStyle(0x8a6a48, 1).fillRect(4, 26, 36, 12);
        g.fillStyle(0xf8e058, 0.9).fillCircle(22, 18, 4);
        out(k, 44, 38);
    }
    // 提灯の列
    g.lineStyle(1, 0x202020, 1).lineBetween(0, 4, 160, 4);
    for (let x = 8; x < 160; x += 18) { g.fillStyle(x % 36 === 8 ? 0xf85838 : 0xf8a838, 1).fillEllipse(x, 12, 9, 12); g.fillStyle(0x202020, 1).fillRect(x - 3, 5, 6, 2).fillRect(x - 3, 17, 6, 2); }
    out("lanterns", 160, 20);
    // 雪だるま
    g.fillStyle(0xf8f8f8, 1).fillCircle(14, 30, 12).fillCircle(14, 12, 9);
    g.fillStyle(0x202020, 1).fillCircle(11, 10, 1).fillCircle(17, 10, 1);
    g.fillStyle(0xf89838, 1).fillTriangle(14, 12, 20, 13, 14, 14);
    g.fillStyle(0xe03838, 1).fillRect(6, 18, 16, 3);
    g.fillStyle(0x303030, 1).fillRect(7, 2, 14, 2).fillRect(9, -2, 10, 4);
    out("snowman", 28, 42);
    // 雪の木
    g.fillStyle(0x305848, 1).fillTriangle(16, 0, 0, 30, 32, 30).fillTriangle(16, 16, -2, 50, 34, 50);
    g.fillStyle(0xf8f8f8, 1).fillTriangle(16, 0, 8, 14, 24, 14).fillTriangle(16, 18, 6, 32, 26, 32);
    g.fillStyle(0x5a3a28, 1).fillRect(14, 50, 4, 8);
    out("pine", 34, 58);
    // ネオン
    g.fillStyle(0x101018, 1).fillRect(0, 0, 44, 18);
    g.lineStyle(2, 0xf858f8, 1).strokeRect(2, 2, 40, 14);
    g.fillStyle(0x58e8f8, 1).fillRect(7, 6, 6, 6).fillRect(17, 6, 2, 6).fillRect(23, 6, 6, 2).fillRect(23, 10, 6, 2).fillRect(33, 6, 4, 6);
    out("neon1", 44, 18);
    g.fillStyle(0x101018, 1).fillRect(0, 0, 18, 40);
    g.lineStyle(2, 0xf8e058, 1).strokeRect(2, 2, 14, 36);
    g.fillStyle(0xf85858, 1).fillCircle(9, 10, 3).fillCircle(9, 20, 3).fillCircle(9, 30, 3);
    out("neon2", 18, 40);
    // 街灯
    g.fillStyle(0x484858, 1).fillRect(7, 6, 3, 50);
    g.fillStyle(0xf8f0b0, 1).fillCircle(8, 5, 5);
    g.fillStyle(0xf8f0b0, 0.25).fillCircle(8, 5, 9);
    out("lamp", 18, 56);
    // 桜の木
    g.fillStyle(0x6a4a38, 1).fillRect(20, 26, 6, 32);
    g.fillStyle(0xf8b8d8, 1).fillCircle(23, 18, 16).fillCircle(10, 24, 11).fillCircle(36, 24, 11);
    g.fillStyle(0xf8d8e8, 1).fillCircle(18, 12, 6).fillCircle(32, 18, 5);
    out("sakura", 48, 58);
    // ベンチ
    g.fillStyle(0x8a5a38, 1).fillRect(0, 6, 40, 4).fillRect(0, 0, 40, 3);
    g.fillStyle(0x404040, 1).fillRect(3, 10, 3, 8).fillRect(34, 10, 3, 8).fillRect(3, 3, 2, 4).fillRect(35, 3, 2, 4);
    out("bench", 40, 18);
    // かまくら
    g.fillStyle(0xf0f4f8, 1).fillEllipse(24, 22, 48, 40).fillRect(0, 22, 48, 14);
    g.fillStyle(0xd0d8e8, 1).fillRect(0, 32, 48, 4);
    g.fillStyle(0x382010, 1).fillEllipse(24, 28, 18, 18).fillRect(15, 28, 18, 8);
    g.fillStyle(0xf8b848, 0.9).fillEllipse(24, 30, 12, 10).fillRect(18, 30, 12, 6);
    out("kamakura", 48, 36);
    // 自動販売機
    g.fillStyle(0xd83838, 1).fillRect(0, 0, 22, 44);
    g.fillStyle(0xf8f8e8, 1).fillRect(2, 3, 18, 16);
    for (let i = 0; i < 4; i++) { g.fillStyle([0x3858c8, 0xf8a838, 0x58c858, 0xf85878][i], 1).fillRect(3 + i * 4.5, 6, 3, 8); g.fillStyle(0x303030, 1).fillRect(3 + i * 4.5, 15, 3, 2); }
    g.fillStyle(0x202020, 1).fillRect(3, 34, 16, 6);
    g.fillStyle(0xf8f8f8, 1).fillRect(16, 22, 3, 6);
    out("vending", 22, 44);
    // お花見シート(奥行きのある台形)と重箱
    g.fillStyle(0x3878d8, 1).fillTriangle(6, 0, 0, 12, 60, 12).fillTriangle(6, 0, 54, 0, 60, 12);
    g.fillStyle(0x88b8f8, 1).fillRect(10, 2, 40, 2).fillRect(6, 8, 48, 2);
    g.fillStyle(0xb82828, 1).fillRect(36, 2, 10, 6);
    g.fillStyle(0xf8d048, 1).fillRect(36, 2, 10, 1);
    out("picnic", 60, 12);
    // 帆船
    g.fillStyle(0xf8f8f8, 1).fillTriangle(10, 0, 10, 16, 20, 16).fillTriangle(9, 2, 9, 16, 2, 16);
    g.fillStyle(0x6a4a38, 1).fillRect(0, 17, 22, 3);
    out("sailboat", 22, 20);
    g.destroy();
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
    const heroineName = loc(data.heroine?.name) || "YUI";
    const audio = createAudio({ sound: settings.sound !== false, bgm: settings.bgm !== false, songs: SONGS });
    const sfx = makeSfx(audio);

    const ctx = { finished: false, skipStory: false, externalPause: false, pauseToggle: false, advance: false, shutterTap: false, play: null, hiScore: loadHiScore() };

    const finish = (result) => {
        if (ctx.finished) return;
        ctx.finished = true;
        try { host.finish?.(result); } catch (e) { console.error("[shutter] host.finish failed", e); }
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
    const onKey = (e) => {
        e.stopPropagation();
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        if (e.type !== "keydown") return;
        audio.unlock();
        if (e.repeat) return;
        if (e.code === "Escape" || e.code === "KeyP") ctx.pauseToggle = true;
        if (e.code === "Space" || e.code === "Enter") { ctx.advance = true; ctx.shutterTap = true; }
        if (e.code === "ArrowLeft") ctx.menu = [-1, 0];
        if (e.code === "ArrowRight") ctx.menu = [1, 0];
        if (e.code === "ArrowUp") ctx.menu = [0, -1];
        if (e.code === "ArrowDown") ctx.menu = [0, 1];
        if (e.code === "KeyW") ctx.camStep = 1;
        if (e.code === "KeyS") ctx.camStep = -1;
        if (e.code === "KeyQ") ctx.spotStep = -1;
        if (e.code === "KeyE") ctx.spotStep = 1;
        if (/^Digit[1-3]$/.test(e.code)) ctx.spotPick = Number(e.code.slice(5)) - 1;
    };
    container.addEventListener("keydown", onKey);
    container.addEventListener("keyup", onKey);
    const focusRoot = () => root.focus({ preventScroll: true });
    const onPointer = () => { focusRoot(); audio.unlock(); ctx.advance = true; };
    root.addEventListener("pointerdown", onPointer);

    // ---------------- 背景 ----------------

    /** 空・遠景・地面を描く。地平線の高さ hy で描き直せるようにする */
    function drawStageBackdrop(g, theme, hy, t) {
        g.clear();
        const n = theme.sky.length;
        theme.sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, Math.floor((i * hy) / n), W, Math.ceil(hy / n) + 1));
        if (theme.stars) {
            for (let i = 0; i < 40; i++) {
                const x = (i * 97) % W, y = (i * 53) % Math.max(10, hy - 20);
                g.fillStyle(0xf8f8f8, 0.4 + 0.5 * Math.abs(Math.sin(t * 1.5 + i))).fillRect(x, y, 1, 1);
            }
        }
        if (theme.key === "beach") {
            g.fillStyle(0xf8f0b0, 1).fillCircle(380, hy - 70, 16);
            g.fillStyle(theme.far, 1).fillRect(0, hy - 18, W, 18);
            g.fillStyle(theme.farLine, 0.8);
            for (let x = 0; x < W; x += 24) g.fillRect((x + t * 20) % W, hy - 10 + ((x / 24) % 3) * 4, 10, 1);
        } else if (theme.key === "festival") {
            g.fillStyle(theme.far, 1);
            for (let x = 0; x < W; x += 60) g.fillRect(x + 4, hy - 30 - ((x / 60) % 2) * 10, 52, 40);
            g.fillStyle(0xf8c860, 0.6);
            for (let x = 14; x < W; x += 60) g.fillRect(x, hy - 20, 6, 6).fillRect(x + 24, hy - 20, 6, 6);
        } else if (theme.key === "snow") {
            g.fillStyle(theme.far, 1);
            g.beginPath(); g.moveTo(0, hy); [[0, hy - 30], [70, hy - 60], [150, hy - 34], [240, hy - 70], [330, hy - 40], [420, hy - 64], [480, hy - 36], [480, hy]].forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fillPath();
            g.fillStyle(theme.farLine, 1).fillTriangle(240, hy - 70, 226, hy - 58, 254, hy - 58).fillTriangle(70, hy - 60, 60, hy - 50, 80, hy - 50).fillTriangle(420, hy - 64, 410, hy - 54, 430, hy - 54);
        } else if (theme.key === "city") {
            for (let i = 0; i < 12; i++) {
                const bx = i * 42 - 6, bh = 50 + ((i * 37) % 60);
                g.fillStyle(i % 2 ? 0x202038 : 0x181830, 1).fillRect(bx, hy - bh, 40, bh);
                for (let wy = hy - bh + 6; wy < hy - 6; wy += 9) for (let wx = bx + 5; wx < bx + 36; wx += 9) if ((wx * 7 + wy * 3 + i) % 5 < 2) g.fillStyle(0xf8e098, 0.75).fillRect(wx, wy, 4, 4);
            }
        } else if (theme.key === "sakura") {
            g.fillStyle(theme.far, 1);
            g.beginPath(); g.moveTo(0, hy); [[0, hy - 20], [120, hy - 42], [260, hy - 26], [380, hy - 46], [480, hy - 24], [480, hy]].forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fillPath();
            g.fillStyle(0xf8c8e0, 0.8);
            for (let x = 10; x < W; x += 37) g.fillCircle(x, hy - 22 - (x % 17), 6);
        }
        // 地面(奥ほど詰まる横縞)
        g.fillStyle(theme.ground[0], 1).fillRect(0, hy, W, H - hy);
        for (let k = 0; k < 9; k++) {
            const y = hy + FAR_GAP * 0.4 + Math.pow(k / 9, 1.6) * (H - hy);
            g.fillStyle(k % 2 ? theme.ground[1] : theme.ground[0], 1).fillRect(0, y, W, Math.max(1, (H - hy) / 18 * (k / 9 + 0.2)));
        }
        g.fillStyle(theme.groundLine, 1).fillRect(0, hy, W, 1);
    }

    // ---------------- title ----------------

    class TitleScene extends Phaser.Scene {
        constructor() { super("title"); }
        create() {
            this.started = false;
            const theme = THEMES.beach;
            makeCommonTextures(this);
            makeYuiTextures(this, theme);
            makePropTextures(this);
            this.t = 0;
            this.bg = this.add.graphics();
            drawStageBackdrop(this.bg, theme, HORIZON + 10, 0);
            this.yui = this.add.image(W / 2 + 92, 232, `yui_beach_peace`).setOrigin(0.5, 1).setScale(3.0);
            // 撮影枠の飾り
            const g = this.add.graphics();
            g.lineStyle(2, 0xf8f8f8, 1).strokeRect(10, 10, W - 20, H - 20);
            g.lineStyle(2, 0xf858a8, 1).strokeRect(15, 15, W - 30, H - 30);
            this.vf = this.add.graphics();
            txt(this, W / 2 + 3, 47, tr("title"), 32, COL.magenta).setOrigin(0.5).setStroke("#000018", 4);
            txt(this, W / 2, 44, tr("title"), 32, COL.yellow).setOrigin(0.5).setStroke("#000018", 4);
            txt(this, W / 2, 78, `- ${tr("difficulty")[settings.difficulty] || ""} -`, 16, COL.white).setOrigin(0.5).setStroke("#000018", 4);
            this.add.graphics().fillStyle(0x000010, 0.6).fillRect(60, 110, 60, 76).lineStyle(2, 0xf8f8f8, 1).strokeRect(62, 114, 56, 56);
            this.add.image(90, 142, "yui_face");
            txt(this, 90, 174, heroineName, 16, COL.yellow).setOrigin(0.5).setScale(0.8);
            const start = txt(this, W / 2 - 40, 214, tr("pushStart"), 16, COL.yellow).setOrigin(0.5).setStroke("#000018", 4);
            this.time.addEvent({ delay: 480, loop: true, callback: () => start.setVisible(!start.visible) });
            txt(this, W / 2, 258, tr("controls"), 16, COL.white).setOrigin(0.5).setScale(0.58).setStroke("#000018", 4).setWordWrapWidth((W - 60) / 0.58, true);
            txt(this, W / 2, 292, `HI ${pad(ctx.hiScore)}`, 16, COL.white).setOrigin(0.5).setScale(0.8).setStroke("#000018", 4);
            ctx.advance = false;
            audio.playMusic("title");
        }
        begin() {
            if (this.started) return;
            this.started = true;
            audio.unlock();
            audio.sfx("start");
            try { host.runStart?.(); } catch (e) { console.error("[shutter] host.runStart failed", e); }
            this.scene.start("play", { stageIndex: 0, score: 0, chances: diff.chances });
        }
        update(_t, delta) {
            const dt = Math.min(0.05, delta / 1000);
            this.t += dt;
            // ファインダーがユイを追いかける
            const g = this.vf;
            g.clear();
            const cx = W / 2 + 92 + Math.sin(this.t * 0.9) * 8, cy = 188 + Math.sin(this.t * 1.3) * 6, fw = 84 + Math.sin(this.t * 0.7) * 10, fh = fw / ASPECT;
            g.lineStyle(2, 0xf8f8f8, 0.9);
            const c = 10;
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
                const x = cx + sx * fw / 2, y = cy + sy * fh / 2;
                g.lineBetween(x, y, x - sx * c, y).lineBetween(x, y, x, y - sy * c);
            });
            if (ctx.advance || ctx.shutterTap) { ctx.advance = false; ctx.shutterTap = false; this.begin(); }
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
            this.chances = d.chances ?? diff.chances;
            this.retry = !!d.retry;
            this.stage = stages[this.stageIndex];
            this.theme = THEMES[this.stage.theme] || THEMES.beach;
            this.target = clamp((this.stage.target || 60) + diff.target, 30, 95);
        }

        create() {
            ctx.play = this;
            ctx.pauseToggle = false;
            this.paused = false;
            this._wasPaused = false;
            this.t = 0;
            const theme = this.theme;
            makeCommonTextures(this);
            makeYuiTextures(this, theme);
            makePropTextures(this);
            makePeople(this, theme.key, theme.people);
            this.removeOldPhotos();

            // 舞台
            this.camH = 0;          // -1 ロー / 0 アイ / 1 ハイ
            this.horizon = HORIZON;
            this.bg = this.add.graphics().setDepth(0);
            this.fx = this.add.graphics().setDepth(5);       // 花火・まぶしい光
            this.props = theme.props.map((p) => ({ ...p, sprite: this.add.image(0, 0, p.tex).setOrigin(0.5, 1) }));
            // 撮影場所(目印の小物も小物の一覧に入れて、同じように描く・隠れ判定する)
            this.spots = (this.stage.spots || []).map((sp) => {
                const spot = { ...sp, prop: null };
                if (sp.prop) {
                    spot.prop = { tex: sp.prop, x: sp.x, d: sp.d, sky: sp.sky, tag: null, spot: true, sprite: this.add.image(0, 0, sp.prop).setOrigin(0.5, 1) };
                    this.props.push(spot.prop);
                }
                return spot;
            });
            this.spotIndex = 0;
            // バイオリズム(体・心・知)。ステージが進むほど波が速い
            const bioSp = (this.stage.speed || 1) * diff.speed;
            this.bio = { per: BIO_PERIODS.map((p) => p / bioSp), ph: BIO_PERIODS.map(() => rand(0, Math.PI * 2)), wasBest: false };
            this.sailboat = theme.sailboat ? { x: -30, sprite: this.add.image(0, 0, "sailboat").setDepth(4), tag: "sailboat" } : null;
            this.walkers = [];
            this.gulls = [];
            this.hearts = [];
            this.bursts = [];
            this.particles = [];
            this.glare = null;
            this.gust = 0;

            // ユイ
            const sp0 = this.spots[0] || { yx: W / 2, yd: 0.55 };
            this.yui = {
                x: sp0.yx, d: sp0.yd, tx: sp0.yx, td: sp0.yd, mode: "pose", pose: "stand", entry: null, t: 0, dur: 1.2, face: 1, jump: 0, atSpot: true,
                sprite: this.add.image(sp0.yx, 0, `yui_${theme.key}_stand`).setOrigin(0.5, 1),
            };
            this.newPose();
            this.twinkles = [0, 1, 2].map(() => this.add.image(0, 0, "twinkle").setDepth(150).setVisible(false));

            // ファインダー
            this.frame = { x: W / 2, y: 190, w: 150, rot: 0 };
            this.moveHist = [];
            this.cd = 0;
            this.film = this.stage.film || 10;
            this.timeLeft = this.stage.time || 45;
            this.photos = [];
            this.heartsGot = 0;
            this.vf = this.add.graphics().setDepth(200);
            this.shade = this.add.graphics().setDepth(199);
            this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(260);

            this.buildHud();
            this.banner = txt(this, W / 2, 96, "", 32, COL.yellow).setOrigin(0.5).setDepth(320).setStroke("#000018", 5).setVisible(false);
            this.subBanner = txt(this, W / 2, 128, "", 16, COL.white).setOrigin(0.5, 0).setDepth(320).setStroke("#000018", 4).setVisible(false);
            this.subBanner.setWordWrapWidth(W - 60, true);
            this.pauseText = txt(this, W / 2, H / 2, tr("paused"), 32, COL.white).setOrigin(0.5).setDepth(340).setStroke("#000018", 5).setVisible(false);
            this.story = new StoryBox(this, { W, H, portrait: "yui_face", speakerName: heroineName, nextLabel: tr("next"), loc, sfx: (n) => audio.sfx(n), depth: 330 });
            this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,UP,DOWN,A,D,Z,X");

            this.heartTimes = Array.from({ length: ITEMS_PER_STAGE }, (_, i) => this.timeLeft * (i + 0.4) / ITEMS_PER_STAGE + rand(-1, 1));
            this.bomberT = 3;
            this.gullT = 2;
            this.eventT = 4;

            this.renderStage();
            this.drawViewfinder(null);
            this.updateHud();

            const before = this.stage.story_before || [];
            if (before.length && !ctx.skipStory && !this.retry) this.startStory(before, () => this.startIntro());
            else this.startIntro();
        }

        removeOldPhotos() {
            for (const key of this.textures.getTextureKeys()) if (key.startsWith("photo_")) this.textures.remove(key);
        }

        // ---------- 舞台の座標 ----------
        groundY(d) { return this.horizon + FAR_GAP + d * (NEAR_Y - this.horizon - FAR_GAP); }
        scaleAt(d) { return lerp(S_FAR, S_NEAR, d); }

        // ---------- HUD ----------
        buildHud() {
            const D = 300;
            this.hudBg = this.add.graphics().setDepth(D);
            this.hudBg.fillStyle(0x000010, 0.6).fillRect(0, 0, W, 22).fillRect(0, H - 18, W, 18);
            // バイオリズムのグラフ(左下)と撮影場所の表示(左上)
            this.bioBox = { x: 4, y: H - 52, w: 132, h: 30 };
            this.bioG = this.add.graphics().setDepth(D);
            this.bioLabel = txt(this, 7, H - 51, "BIO", 16, COL.white).setDepth(D).setScale(0.5);
            this.spotText = txt(this, 6, 25, "", 16, COL.yellow).setDepth(D).setScale(0.7).setStroke("#000018", 3);
            this.stageText = txt(this, 6, 3, `${tr("stage", this.stageIndex + 1)} ${loc(this.stage.name)}`, 16, this.stage.color || COL.white).setDepth(D).setScale(0.75);
            this.timeText = txt(this, 236, 3, "", 16, COL.white).setDepth(D).setScale(0.75);
            this.filmG = this.add.graphics().setDepth(D);
            this.heartIcons = [];
            for (let i = 0; i < ITEMS_PER_STAGE; i++) this.heartIcons.push(this.add.image(W - 58 + i * 10, 11, "heart_s").setDepth(D));
            this.chanceIcons = [];
            this.infoText = txt(this, 6, H - 16, "", 16, COL.cyan).setDepth(D).setScale(0.7);
            this.targetText = txt(this, W - 6, H - 16, tr("target", this.target), 16, COL.yellow).setOrigin(1, 0).setDepth(D).setScale(0.7);
            this.shotLabel = txt(this, 0, 0, "", 16, COL.white).setDepth(201).setScale(0.6).setStroke("#000018", 3);
        }
        updateHud() {
            if (this.score > ctx.hiScore) ctx.hiScore = this.score;
            this.timeText.setText(`TIME ${String(Math.ceil(Math.max(0, this.timeLeft))).padStart(2, "0")}`);
            const g = this.filmG;
            g.clear();
            const n = this.stage.film || 10;
            for (let i = 0; i < n; i++) g.fillStyle(i < this.film ? 0xf8e058 : 0x404050, 1).fillRect(298 + i * 6, 6, 4, 10);
            this.heartIcons.forEach((h, i) => h.setAlpha(i < this.heartsGot ? 1 : 0.2));
            if (this.chanceIcons.length !== this.chances) {
                this.chanceIcons.forEach((c) => c.destroy());
                this.chanceIcons = [];
                for (let i = 0; i < this.chances; i++) this.chanceIcons.push(this.add.image(214 - i * 13, 11, "camera").setDepth(300));
            }
            const spot = this.spots[this.spotIndex];
            this.spotText.setText(spot ? tr("spot", loc(spot.name), this.spotIndex + 1, this.spots.length) : "");
            this.drawBio();
            const zoom = (FW_MAX / this.frame.w).toFixed(1);
            this.infoText.setText(`ZOOM x${zoom}   ${lang === "en" ? "ANGLE" : lang === "ja" ? "アングル" : "角度"} ${tr("angle")[this.camH]}   TILT ${Math.round(this.frame.rot)}°   SCORE ${pad(this.score)}`);
        }
        showBanner(main, sub = "", color = COL.yellow) {
            this.banner.setText(main).setColor(color).setVisible(true);
            this.subBanner.setText(sub).setVisible(!!sub);
        }
        hideBanner() { this.banner.setVisible(false); this.subBanner.setVisible(false); }
        popup(text, x, y, color = COL.yellow, scale = 0.8) {
            const t = txt(this, x, y, text, 16, color).setOrigin(0.5).setDepth(310).setScale(scale).setStroke("#000018", 3);
            this.tweens.add({ targets: t, y: y - 20, alpha: 0, duration: 900, onComplete: () => t.destroy() });
        }

        // ---------- 流れ ----------
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
            this.showBanner(tr("stage", this.stageIndex + 1), `${loc(this.stage.name)}\n${tr("target", this.target)}`, this.stage.color || COL.yellow);
            audio.playMusic(this.stage.music || "stage");
        }

        // ---------- ユイの動き ----------
        /** 撮影場所の気まぐれなポーズを1つ選ぶ(座る場所では座りポーズ) */
        newPose() {
            const y = this.yui;
            const spot = this.spots[this.spotIndex];
            const pool = spot?.sit ? POSE_POOL.sit : POSE_POOL.stand;
            let e = pick(pool);
            if (y.entry && pool.length > 1) while (e === y.entry) e = pick(pool);
            y.entry = e;
            y.pose = e.sprite;
            y.mode = "pose";
            y.t = 0;
            y.dur = rand(1.8, 3.0) / ((this.stage.speed || 1) * diff.speed);
            // 場所の近くで少しだけ立ち位置を変える
            if (spot && !spot.sit) { y.tx = spot.yx + rand(-14, 14); y.td = clamp(spot.yd + rand(-0.04, 0.04), 0, 1); }
        }
        /** 撮影場所を変える(ユイが歩いて移動する) */
        setSpot(i) {
            const n = this.spots.length;
            if (!n) return;
            i = ((i % n) + n) % n;
            if (i === this.spotIndex) return;
            this.spotIndex = i;
            const spot = this.spots[i], y = this.yui;
            y.mode = "walk";
            y.pose = "walk";
            y.entry = null;
            y.atSpot = false;
            y.tx = spot.yx;
            y.td = spot.yd;
            y.t = 0;
            y.jump = 0;
            sfx("tick");
            this.updateHud();
        }
        updateYui(dt) {
            const y = this.yui;
            const sp = (this.stage.speed || 1) * diff.speed;
            y.t += dt;
            const dx = y.tx - y.x, dd = y.td - y.d;
            if (y.mode === "walk") {
                const vx = 105 * sp, vd = 0.42 * sp;
                if (Math.abs(dx) > 1) { y.x += Math.sign(dx) * Math.min(Math.abs(dx), vx * dt); y.face = Math.sign(dx); }
                if (Math.abs(dd) > 0.005) y.d += Math.sign(dd) * Math.min(Math.abs(dd), vd * dt);
                if (Math.abs(dx) <= 1 && Math.abs(dd) <= 0.005) { y.atSpot = true; this.newPose(); }
                return;
            }
            // ポーズ中: 立ち位置の小さなずれはゆっくり詰める
            if (Math.abs(dx) > 0.5) y.x += Math.sign(dx) * Math.min(Math.abs(dx), 12 * dt);
            if (Math.abs(dd) > 0.002) y.d += Math.sign(dd) * Math.min(Math.abs(dd), 0.05 * dt);
            y.jump = y.pose === "jump" ? Math.max(0, Math.sin(y.t * 5.5)) * 22 : 0;
            if (y.t >= y.dur) this.newPose();
        }

        // ---------- バイオリズム ----------
        /** 時刻 t の3本の波と平均(-1〜1) */
        bioAt(t) {
            const b = this.bio;
            const w = b.per.map((p, i) => Math.sin((2 * Math.PI * t) / p + b.ph[i]));
            return { w, v: (w[0] + w[1] + w[2]) / 3 };
        }
        drawBio() {
            const g = this.bioG, bx = this.bioBox;
            if (!g) return;
            g.clear();
            const show = !this.snapping && ["play", "intro"].includes(this.state);
            this.bioLabel.setVisible(show);
            this.spotText.setVisible(show);
            if (!show) return;
            const { x, y, w, h } = bx;
            const mid = y + h / 2 + 2, amp = h / 2 - 3;
            g.fillStyle(0x000010, 0.7).fillRect(x, y, w, h);
            // ベストの帯
            g.fillStyle(0xf858a8, 0.25).fillRect(x, mid - amp, w, amp * (1 - BIO_BEST));
            g.lineStyle(1, 0x404060, 1).lineBetween(x, mid, x + w, mid);
            const span = BIO_PAST + BIO_FUTURE;
            const nowX = x + (w * BIO_PAST) / span;
            const pts = [[], [], [], []];
            for (let i = 0; i <= w; i += 2) {
                const s = this.bioAt(this.t - BIO_PAST + (i / w) * span);
                s.w.forEach((v, k) => pts[k].push(x + i, mid - v * amp));
                pts[3].push(x + i, mid - s.v * amp);
            }
            const line = (arr, c, a, wd) => {
                g.lineStyle(wd, c, a);
                g.beginPath();
                g.moveTo(arr[0], arr[1]);
                for (let i = 2; i < arr.length; i += 2) g.lineTo(arr[i], arr[i + 1]);
                g.strokePath();
            };
            BIO_COLORS.forEach((c, k) => line(pts[k], c, 0.55, 1));
            line(pts[3], 0xf8f8f8, 1, 2);
            // いま
            const now = this.bioAt(this.t);
            const best = now.v >= BIO_BEST;
            g.lineStyle(1, best ? 0xf858f8 : 0xf8e058, 1).lineBetween(nowX, y + 1, nowX, y + h - 1);
            g.fillStyle(best ? 0xf858f8 : 0xf8e058, 1).fillCircle(nowX, mid - now.v * amp, 2.5);
            g.lineStyle(1, best ? 0xf858f8 : 0x606078, 1).strokeRect(x, y, w, h);
        }

        // ---------- 写り込むもの・演出 ----------
        updateExtras(dt) {
            const theme = this.theme;
            // 通行人(手前を横切る)
            this.bomberT -= dt;
            if (this.bomberT <= 0 && this.state === "play") {
                this.bomberT = 5.5 / ((this.stage.bombers || 1) * diff.bombers) * rand(0.6, 1.4);
                const dir = Math.random() < 0.5 ? 1 : -1;
                const near = Math.random() < 0.55;
                this.walkers.push({
                    x: dir > 0 ? -30 : W + 30, d: near ? rand(0.95, 1.12) : rand(0.3, 0.9), vx: dir * rand(55, 85), t: rand(0, 1),
                    sprite: this.add.image(0, 0, `${theme.key}_person${Math.floor(Math.random() * theme.people.length)}`).setOrigin(0.5, 1).setFlipX(dir < 0),
                });
            }
            for (const w of this.walkers) { w.x += w.vx * dt; w.t += dt; }
            this.walkers = this.walkers.filter((w) => { const gone = w.x < -60 || w.x > W + 60; if (gone) w.sprite.destroy(); return !gone; });
            // カモメ
            if (theme.gulls) {
                this.gullT -= dt;
                if (this.gullT <= 0 && this.state === "play") {
                    this.gullT = rand(3, 6);
                    const dir = Math.random() < 0.5 ? 1 : -1;
                    this.gulls.push({ x: dir > 0 ? -20 : W + 20, y: rand(this.horizon - 60, this.horizon + 70), vx: dir * rand(70, 110), t: 0, sprite: this.add.image(0, 0, "gull1").setScale(2).setDepth(160).setFlipX(dir < 0) });
                }
                for (const gl of this.gulls) { gl.x += gl.vx * dt; gl.t += dt; gl.sprite.setPosition(gl.x, gl.y + Math.sin(gl.t * 6) * 4).setTexture(Math.floor(gl.t * 6) % 2 ? "gull1" : "gull2"); }
                this.gulls = this.gulls.filter((gl) => { const gone = gl.x < -40 || gl.x > W + 40; if (gone) gl.sprite.destroy(); return !gone; });
            }
            // 帆船(水平線をゆっくり)
            if (this.sailboat) {
                this.sailboat.x += 9 * dt;
                if (this.sailboat.x > W + 30) this.sailboat.x = -30;
                this.sailboat.sprite.setPosition(this.sailboat.x, this.horizon - 16);
            }
            // ステージの出来事: 花火 / 車のライト / 花びらの風
            this.eventT -= dt;
            if (this.eventT <= 0 && (this.state === "play" || this.state === "intro")) {
                if (theme.fireworks) {
                    this.eventT = rand(1.2, 2.6);
                    this.bursts.push({ x: rand(40, W - 40), y: rand(this.horizon - 100, this.horizon - 40), t: 0, col: pick([0xf85858, 0xf8e058, 0x58e8f8, 0xf858f8, 0x88f858]) });
                    sfx("tick", { rate: 0.35, vol: 0.6 });
                } else if (theme.glare) {
                    this.eventT = rand(5, 8);
                    this.glare = { x: Math.random() < 0.5 ? -60 : W + 60, y: this.horizon + rand(40, 110), t: 0 };
                    this.glare.vx = this.glare.x < 0 ? 260 : -260;
                } else if (theme.petals) {
                    this.eventT = rand(6, 9);
                    this.gust = 2.2;
                } else this.eventT = 99;
            }
            for (const b of this.bursts) b.t += dt;
            this.bursts = this.bursts.filter((b) => b.t < 1.4);
            if (this.glare) { this.glare.x += this.glare.vx * dt; this.glare.t += dt; if (this.glare.x < -80 || this.glare.x > W + 80) this.glare = null; }
            if (this.gust > 0) this.gust -= dt;
            // 雪・花びら
            const want = theme.snowfall ? 70 : theme.petals ? (this.gust > 0 ? 90 : 30) : 0;
            while (this.particles.length < want) {
                this.particles.push({ x: rand(0, W), y: rand(-20, H), vx: rand(-10, 10), vy: rand(20, 45), img: this.add.image(0, 0, "spark").setDepth(170).setTint(theme.snowfall ? 0xffffff : 0xf8b8d8).setScale(rand(0.7, 1.4)) });
            }
            for (const p of this.particles) {
                p.x += (p.vx + (this.gust > 0 ? 140 : 0)) * dt;
                p.y += p.vy * dt;
                if (p.y > H + 4) { p.y = -4; p.x = rand(0, W); }
                if (p.x > W + 4) p.x = -4;
                if (p.x < -4) p.x = W + 4;
                p.img.setPosition(p.x, p.y);
            }
            // ハート
            while (this.heartTimes.length && this.state === "play" && (this.stage.time || 45) - this.timeLeft >= this.heartTimes[0]) {
                this.heartTimes.shift();
                const dir = Math.random() < 0.5 ? 1 : -1;
                this.hearts.push({ x: dir > 0 ? -12 : W + 12, y: rand(this.horizon - 40, this.horizon + 90), vx: dir * rand(26, 38), t: rand(0, 6), sprite: this.add.image(0, 0, "heart").setDepth(165).setScale(1.6) });
            }
            for (const h of this.hearts) { h.x += h.vx * dt; h.t += dt; h.sprite.setPosition(h.x, h.y + Math.sin(h.t * 2.5) * 8); }
            this.hearts = this.hearts.filter((h) => { const gone = h.got || h.x < -30 || h.x > W + 30; if (gone && !h.got) h.sprite.destroy(); return !gone; });
        }

        // ---------- 描画 ----------
        renderStage() {
            const theme = this.theme;
            this.horizon = lerp(this.horizon, HORIZON + this.camH * CAM_SHIFT, 0.2);
            drawStageBackdrop(this.bg, theme, this.horizon, this.t);
            for (const p of this.props) {
                if (p.sky !== undefined) { p.sprite.setPosition(p.x, this.horizon + p.sky).setScale(1.4).setDepth(3); continue; }
                const s = this.scaleAt(p.d) * 0.62;
                p.sprite.setPosition(p.x, this.groundY(p.d)).setScale(s).setDepth(10 + p.d * 100);
            }
            for (const w of this.walkers) {
                const s = this.scaleAt(Math.min(1.2, w.d));
                w.sprite.setPosition(w.x, this.groundY(w.d) + Math.abs(Math.sin(w.t * 9)) * -2).setScale(s).setDepth(10 + w.d * 100);
            }
            // 花火・まぶしい光
            const fx = this.fx;
            fx.clear();
            for (const b of this.bursts) {
                const r = 6 + b.t * 34, a = 1 - b.t / 1.4;
                for (let k = 0; k < 14; k++) {
                    const ang = (k / 14) * Math.PI * 2;
                    fx.fillStyle(b.col, a).fillRect(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r + b.t * b.t * 10, 2, 2);
                }
            }
            if (this.glare) {
                fx.fillStyle(0xfff8d0, 0.35).fillCircle(this.glare.x, this.glare.y, 46);
                fx.fillStyle(0xffffff, 0.6).fillCircle(this.glare.x, this.glare.y, 18);
                fx.lineStyle(2, 0xffffff, 0.5).lineBetween(this.glare.x - 90, this.glare.y, this.glare.x + 90, this.glare.y);
            }
            // ユイ
            const y = this.yui;
            const pose = POSES[y.pose] || POSES.stand;
            const frames = pose.frames;
            const f = frames[Math.floor(y.t * (pose.fps || 4)) % frames.length];
            const s = this.scaleAt(y.d);
            y.sprite.setTexture(`yui_${theme.key}_${f}`).setPosition(Math.round(y.x), Math.round(this.groundY(y.d) - y.jump)).setScale(s).setDepth(10 + y.d * 100)
                .setFlipX(y.mode === "walk" && y.face < 0);
            // キラッ(決めポーズ)
            const top = this.groundY(y.d) - y.jump - y.sprite.height * s;
            // キラッ: バイオリズムが上でそろったとき(もうすぐそろうときは1つだけ点滅)
            const bv = this.bioAt(this.t).v;
            const phase = y.mode === "walk" ? null : bv >= BIO_BEST ? "peak" : this.bioAt(this.t + 0.35).v >= BIO_BEST ? "ready" : null;
            this.twinkles.forEach((tw, i) => {
                if (phase === "ready") tw.setVisible(i === 0 && Math.floor(this.t * 10) % 2 === 0).setPosition(y.x + 14 * s / 2, top + 6).setScale(1.2);
                else if (phase === "peak") {
                    const a = this.t * 4 + i * 2.1;
                    tw.setVisible(true).setPosition(y.x + Math.cos(a) * 9 * s, top + 8 * s + Math.sin(a) * 6 * s).setScale(0.8 + 0.4 * Math.abs(Math.sin(a * 2))).setAlpha(0.9);
                } else tw.setVisible(false);
            });
        }

        /** ファインダーの中を判定する(撮影時もライブ表示も同じ計算) */
        analyze() {
            const fr = this.frame;
            const fw = fr.w, fh = fr.w / ASPECT;
            const r = (fr.rot * Math.PI) / 180;
            const cos = Math.cos(-r), sin = Math.sin(-r);
            const local = (px, py) => { const dx = px - fr.x, dy = py - fr.y; return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }; };
            const inFrame = (px, py, m = 0) => { const p = local(px, py); return Math.abs(p.x) <= fw / 2 - m && Math.abs(p.y) <= fh / 2 - m; };
            const y = this.yui;
            const s = this.scaleAt(y.d);
            const hpx = y.sprite.height * s;
            const feet = this.groundY(y.d) - y.jump;
            const top = feet - hpx;
            const ly0 = local(y.x, top).y, ly1 = local(y.x, feet).y;
            const span = ly1 - ly0 || 1;
            const rT = (-fh / 2 - ly0) / span;
            const rB = (fh / 2 - ly0) / span;
            const chest = local(y.x, top + hpx * 0.5);
            const offset = Math.abs(chest.x) / (fw / 2);
            const vis = clamp(rB, 0, 1) - clamp(rT, 0, 1);
            const ratio = (vis * hpx) / fh;
            const subject = offset < 0.95 && rT <= 0.15 && rB >= 0.3 && vis > 0;
            const pose = POSES[y.pose] || POSES.stand;
            const res = { subject, rT, rB, offset, ratio, pose, inFrame, framing: 0, place: 0, bio: 0, bioV: 0, best: false, steady: 0, penalty: 0, bonus: 0, tags: [], extraTags: [], shot: null, spot: null, entry: null };
            if (!subject) return res;
            // 構図
            let shot;
            if (rB >= 0.985) shot = ratio < 0.38 ? "wide" : "full";
            else if (rB >= 0.7) shot = "cowboy";
            else if (rB >= 0.56) shot = "upper";
            else if (rB >= 0.43) shot = "portrait";
            else shot = "close";
            res.shot = shot;
            let framing = 30;
            if (rB >= 0.39 && rB < 0.45) framing -= 12;          // 首で切れている
            if (rB >= 0.82 && rB < 0.9) framing -= 8;            // ひざで切れている
            if (rB >= 0.92 && rB < 0.985) framing -= 8;          // 足首で切れている
            if (rT > 0.03 && shot !== "close") framing -= 7;     // 頭が切れている
            if (offset > 0.8) framing -= 15; else if (offset > 0.6) framing -= 8;
            // 小さすぎる(引きの全身は場所を入れるための構図なので少し小さくても良い)
            if (ratio < 0.2) framing -= 18; else if (ratio < 0.26) framing -= 8; else if (ratio < 0.38 && shot !== "wide") framing -= 10;
            if (rT < -0.6 && shot !== "wide") framing -= 5;      // 上が空きすぎ
            res.framing = clamp(framing, 0, 30);
            // 撮影場所: 目印が枠に入っているか(ユイが場所に着いているときだけ)
            const spot = this.spots[this.spotIndex];
            if (spot && y.atSpot) {
                const m = this.spotMark(spot);
                if (inFrame(m.x, m.y)) res.place = 20;
                else if (inFrame(m.x, m.y, -Math.max(16, fw * 0.12))) res.place = 8;
                if (res.place) res.spot = spot;
            }
            // バイオリズム(30)+ベストショット(10)。歩いている途中は半分
            const bv = this.bioAt(this.t).v;
            res.bioV = bv;
            res.bio = Math.round(30 * clamp((bv + 0.1) / (BIO_BEST + 0.1), 0, 1) * (y.mode === "walk" ? 0.5 : 1));
            res.best = bv >= BIO_BEST && y.mode !== "walk";
            res.entry = y.entry;
            // ブレ(直前の枠の動き)
            const now = this.t;
            const hist = this.moveHist.filter((m) => now - m.t < 0.2);
            const dist = hist.reduce((a, m) => a + m.d, 0);
            const speed = dist / 0.2;
            res.steady = Math.round(clamp(10 - (speed - 30) / 15, 0, 10));
            // 写り込み(ユイと重なる通行人・カモメ)は減点
            const yb = { x: y.x - (y.sprite.width * s) / 2, y: top, w: y.sprite.width * s, h: hpx };
            const hit = (b) => b.x < yb.x + yb.w && b.x + b.w > yb.x && b.y < yb.y + yb.h && b.y + b.h > yb.y;
            let penalty = 0;
            for (const w of this.walkers) {
                const ws = this.scaleAt(Math.min(1.2, w.d));
                const wb = { x: w.x - (w.sprite.width * ws) / 2, y: this.groundY(w.d) - w.sprite.height * ws, w: w.sprite.width * ws, h: w.sprite.height * ws };
                if (w.d > y.d && hit(wb) && inFrame(w.x, wb.y + wb.h / 2, -wb.w / 2)) { penalty = 18; break; }
            }
            for (const gl of this.gulls) if (penalty < 6 && hit({ x: gl.x - 12, y: gl.y - 6, w: 24, h: 12 }) && inFrame(gl.x, gl.y)) penalty = 6;
            // 手前の小物(雪だるま・ベンチなど)にユイが半分以上隠れている
            for (const p of this.props) {
                if (p.sky !== undefined || p.d <= y.d) continue;
                const pw = p.sprite.width * p.sprite.scaleX, ph = p.sprite.height * p.sprite.scaleY;
                const pb = { x: p.x - pw / 2, y: this.groundY(p.d) - ph, w: pw, h: ph };
                const ox = Math.max(0, Math.min(pb.x + pb.w, yb.x + yb.w) - Math.max(pb.x, yb.x));
                const oy = Math.max(0, Math.min(pb.y + pb.h, yb.y + yb.h) - Math.max(pb.y, yb.y));
                if (ox * oy > yb.w * yb.h * 0.35) penalty = Math.max(penalty, 12);
            }
            res.penalty = penalty;
            // 景色のタグ(枠に入った小物・出来事。撮影場所の目印は場所のプロンプトで入るので除く)
            const extra = new Set();
            for (const p of this.props) {
                if (p.spot) continue;
                const py = p.sky !== undefined ? this.horizon + p.sky + 6 : this.groundY(p.d) - p.sprite.height * p.sprite.scaleY / 2;
                if (inFrame(p.x, py)) extra.add(p.tag);
            }
            if (this.sailboat && inFrame(this.sailboat.x, this.horizon - 16)) extra.add("sailboat");
            if (this.bursts.some((b) => b.t < 1.1 && inFrame(b.x, b.y))) extra.add("fireworks");
            if (this.glare && inFrame(this.glare.x, this.glare.y, -20)) extra.add("lens flare");
            if (this.gust > 0) extra.add("falling petals, wind");
            res.extraTags = [...extra].slice(0, 3);
            res.bonus = Math.min(8, res.extraTags.length * 4);
            // プロンプトのタグ
            const tags = [SHOT[shot].tag];
            if (this.camH < 0) tags.push("from below");
            if (this.camH > 0) tags.push("from above");
            if (Math.abs(fr.rot) > DUTCH) tags.push("dutch angle");
            if (pose.facing === "front" && shot !== "wide") tags.push("looking at viewer");
            tags.push(y.mode === "walk" ? pose.tags : y.entry?.tag || pose.tags);
            if (res.spot) tags.push(res.spot.prompt);
            res.tags = tags;
            return res;
        }
        /** 撮影場所の目印の位置(小物の真ん中、小物の無い場所は地平線の上の点) */
        spotMark(spot) {
            const p = spot.prop;
            if (p && p.sky === undefined) return { x: p.x, y: this.groundY(p.d) - (p.sprite.height * p.sprite.scaleY) / 2 };
            return { x: spot.x, y: this.horizon + (spot.sky ?? -8) + (p ? 6 : 0) };
        }
        /** シャッターの瞬間の表情(バイオリズムが高いほど良い顔が出やすい) */
        rollExpression(v) {
            const r = Math.random();
            const tier = v >= BIO_BEST ? (r < 0.85 ? "high" : "mid")
                : v >= 0.3 ? (r < 0.45 ? "high" : r < 0.9 ? "mid" : "low")
                : v >= -0.2 ? (r < 0.15 ? "high" : r < 0.7 ? "mid" : "low")
                : (r < 0.25 ? "mid" : "low");
            return pick(EXPR_POOL[tier]);
        }

        scoreOf(a) {
            if (!a.subject) return 0;
            return clamp(a.framing + a.place + a.bio + (a.best ? 10 : 0) + a.steady + a.bonus - a.penalty, 0, 100);
        }
        gradeOf(sc) { return sc >= 90 ? "S" : sc >= 78 ? "A" : sc >= 62 ? "B" : sc >= 45 ? "C" : "D"; }

        drawViewfinder(a) {
            const fr = this.frame;
            const fw = fr.w, fh = fr.w / ASPECT;
            const r = (fr.rot * Math.PI) / 180;
            const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
                const x = sx * fw / 2, y = sy * fh / 2;
                return { x: fr.x + x * Math.cos(r) - y * Math.sin(r), y: fr.y + x * Math.sin(r) + y * Math.cos(r) };
            });
            const P = (x, y) => ({ x: fr.x + x * Math.cos(r) - y * Math.sin(r), y: fr.y + x * Math.sin(r) + y * Math.cos(r) });
            // 枠の外を暗くする(傾けていないときだけ)
            const sh = this.shade;
            sh.clear();
            if (Math.abs(fr.rot) < 0.5 && this.state === "play" && !this.snapping) {
                sh.fillStyle(0x000000, 0.35);
                const x0 = fr.x - fw / 2, y0 = fr.y - fh / 2;
                sh.fillRect(0, 0, W, Math.max(0, y0)).fillRect(0, y0 + fh, W, H).fillRect(0, y0, Math.max(0, x0), fh).fillRect(x0 + fw, y0, W, fh);
            }
            const g = this.vf;
            g.clear();
            if (this.snapping || (this.state !== "play" && this.state !== "intro")) { this.shotLabel.setVisible(false); return; }
            const ok = a && a.subject;
            g.lineStyle(1, 0xf8f8f8, 0.25);
            for (const k of [-1 / 6, 1 / 6]) {
                const v0 = P(k * fw, -fh / 2), v1 = P(k * fw, fh / 2), h0 = P(-fw / 2, k * fh), h1 = P(fw / 2, k * fh);
                g.lineBetween(v0.x, v0.y, v1.x, v1.y).lineBetween(h0.x, h0.y, h1.x, h1.y);
            }
            g.lineStyle(1, 0xf8f8f8, 0.6);
            for (let i = 0; i < 4; i++) g.lineBetween(pts[i].x, pts[i].y, pts[(i + 1) % 4].x, pts[(i + 1) % 4].y);
            // 四隅のカギ
            g.lineStyle(2, ok ? 0x58f858 : 0xf8f8f8, 1);
            const c = Math.min(12, fw / 6);
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
                const p = P(sx * fw / 2, sy * fh / 2), q1 = P(sx * fw / 2 - sx * c, sy * fh / 2), q2 = P(sx * fw / 2, sy * fh / 2 - sy * c);
                g.lineBetween(p.x, p.y, q1.x, q1.y).lineBetween(p.x, p.y, q2.x, q2.y);
            });
            // 中心
            g.lineStyle(1, 0xf8f8f8, 0.8).lineBetween(fr.x - 4, fr.y, fr.x + 4, fr.y).lineBetween(fr.x, fr.y - 4, fr.x, fr.y + 4);
            // 撮影場所の目印(枠に入れると場所のプロンプトが写真に入る)
            const spot = this.spots[this.spotIndex];
            if (spot) {
                const m = this.spotMark(spot);
                const inPlace = a && a.place >= 20;
                const bob = Math.sin(this.t * 6) * 2;
                // 矢印は目印の上(ユイが重なっているときはユイの頭より上)に出す
                const yy = this.yui, ys = this.scaleAt(yy.d);
                const yTop = this.groundY(yy.d) - yy.jump - yy.sprite.height * ys;
                const near = Math.abs(yy.x - m.x) < 24 && yTop < m.y;
                const col = inPlace ? 0x58f858 : 0xf8e058, ay = (near ? yTop - 6 : m.y) - 20 + bob;
                g.fillStyle(0x000018, 0.9).fillTriangle(m.x - 8, ay - 1, m.x + 8, ay - 1, m.x, ay + 10);
                g.fillStyle(col, 1).fillTriangle(m.x - 6, ay, m.x + 6, ay, m.x, ay + 8);
                g.lineStyle(1, col, 0.8).strokeCircle(m.x, m.y, 4);
            }
            // ピント(顔に AF の四角)
            if (ok) {
                const y = this.yui, s = this.scaleAt(y.d);
                const top = this.groundY(y.d) - y.jump - y.sprite.height * s;
                g.lineStyle(1, 0x58f858, 1).strokeRect(y.x - 6 * s, top + 3 * s, 12 * s, 8 * s);
            }
            const tl = P(-fw / 2 + 3, -fh / 2 + 2);
            this.shotLabel.setVisible(true).setPosition(tl.x, tl.y).setAngle(fr.rot)
                .setText(ok ? SHOT[a.shot][lang] || SHOT[a.shot].en : "- - -").setColor(ok ? COL.green : COL.gray);
        }

        // ---------- 撮影 ----------
        updateFrame(dt) {
            const k = this.keys;
            const pad1 = this.input.gamepad?.pad1;
            let mx = (k.LEFT.isDown ? -1 : 0) + (k.RIGHT.isDown ? 1 : 0);
            let my = (k.UP.isDown ? -1 : 0) + (k.DOWN.isDown ? 1 : 0);
            let zoom = (k.Z.isDown ? 1 : 0) - (k.X.isDown ? 1 : 0);
            let tilt = (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0);
            if (pad1) {
                const ax = pad1.leftStick?.x || 0, ay = pad1.leftStick?.y || 0;
                if (Math.abs(ax) > 0.2) mx = ax;
                if (Math.abs(ay) > 0.2) my = ay;
                if (pad1.L1) zoom = -1;
                if (pad1.R1) zoom = 1;
                if (pad1.A && !this._padShot) ctx.shutterTap = true;
                this._padShot = !!pad1.A;
            }
            const fr = this.frame;
            const px = fr.x, py = fr.y;
            if (zoom) {
                const before = fr.w;
                fr.w = clamp(fr.w * (1 - zoom * 1.1 * dt), FW_MIN, FW_MAX);
                if (Math.floor(before / 12) !== Math.floor(fr.w / 12)) sfx("tick", { vol: 0.5 });
            }
            if (tilt) fr.rot = clamp(fr.rot + tilt * 40 * dt, -TILT_MAX, TILT_MAX);
            else if (Math.abs(fr.rot) < 1.5) fr.rot = 0;
            fr.x = clamp(fr.x + mx * FRAME_SPEED * dt, fr.w / 2, W - fr.w / 2);
            const fh = fr.w / ASPECT;
            fr.y = clamp(fr.y + my * FRAME_SPEED * dt, 22 + fh / 2, H - 18 - fh / 2);
            this.moveHist.push({ t: this.t, d: Math.hypot(fr.x - px, fr.y - py) });
            this.moveHist = this.moveHist.filter((m) => this.t - m.t < 0.5);
            if (ctx.camStep) {
                this.camH = clamp(this.camH + ctx.camStep, -1, 1);
                ctx.camStep = 0;
                sfx("tick");
            }
        }
        takePhoto() {
            if (this.cd > 0 || this.film <= 0) return;
            this.cd = SHUTTER_CD;
            this.film--;
            const a = this.analyze();
            const score = this.scoreOf(a);
            const fr = this.frame;
            // 表情はシャッターを切った瞬間に決まる(コンタクトシートで分かる)
            const expr = a.subject ? this.rollExpression(a.bioV) : null;
            const photo = {
                id: this.photos.length, score, grade: this.gradeOf(score), a, best: !!(a.subject && a.best), expr, entry: a.entry, spot: a.spot,
                // 同じタグ(「sitting」など)が重ならないように1つにまとめる
                tags: a.subject ? [...new Set([...a.tags, expr.tag, ...a.extraTags].join(", ").split(/\s*,\s*/).filter(Boolean))] : [],
                parts: [a.framing, a.place, a.bio, a.steady], key: null,
            };
            this.photos.push(photo);
            // ハート: ユイと一緒に写っていれば獲得
            if (a.subject) {
                for (const h of this.hearts) {
                    if (h.got || !a.inFrame(h.x, h.y)) continue;
                    h.got = true;
                    this.heartsGot = Math.min(ITEMS_PER_STAGE, this.heartsGot + 1);
                    this.tweens.add({ targets: h.sprite, scale: 3, alpha: 0, duration: 500, onComplete: () => h.sprite.destroy() });
                    audio.sfx("item");
                    if (this.heartsGot >= ITEMS_PER_STAGE) this.popup("PERFECT!", W / 2, 60, COL.magenta, 1);
                }
            }
            // 写真のサムネイル: 枠の範囲を切り出す(枠の線や暗い覆いは消してから)
            const fw = fr.w, fh = fr.w / ASPECT;
            const r = Math.abs((fr.rot * Math.PI) / 180);
            const bw = fw * Math.cos(r) + fh * Math.sin(r), bh = fw * Math.sin(r) + fh * Math.cos(r);
            const bx = Math.max(0, Math.round(fr.x - bw / 2)), by = Math.max(0, Math.round(fr.y - bh / 2));
            const sw = Math.min(W - bx, Math.round(bw)), shh = Math.min(H - by, Math.round(bh));
            const hide = [this.vf, this.shade, this.shotLabel, this.hudBg, this.stageText, this.timeText, this.filmG, this.infoText, this.targetText, this.bioG, this.bioLabel, this.spotText, ...this.heartIcons, ...this.chanceIcons];
            const vis = hide.map((o) => o.visible);
            hide.forEach((o) => o.setVisible(false));
            this.snapping = true;
            const key = `photo_${this.stageIndex}_${photo.id}_${Date.now()}`;
            // 枠の線などを消した画面が一度描かれてから切り出す(すぐ切り出すと前の画面が写る)
            this.pendingSnap = { frames: 2, run: () => this.game.renderer.snapshotArea(bx, by, sw, shh, (img) => {
                this.snapping = false;
                hide.forEach((o, i) => o.setVisible(vis[i]));
                const add = () => { if (!this.textures.exists(key)) { this.textures.addImage(key, img); photo.key = key; } };
                if (img && img.complete) add(); else if (img) img.onload = add;
                // フラッシュ(写真に写らないように切り出しのあと)
                this.flash.setAlpha(0.75);
                this.tweens.add({ targets: this.flash, alpha: 0, duration: 160 });
                // 点数の表示も写真に写らないように切り出しのあと
                this.popup(a.subject ? `${photo.grade} ${score}` : tr("miss"), fr.x, fr.y - fh / 2 - 6, a.subject ? (score >= this.target ? COL.green : COL.yellow) : COL.gray, 0.9);
                if (photo.best) { this.popup(tr("best"), W / 2, 70, COL.magenta, 1); audio.sfx("pass"); }
            }) };
            sfx("shutter");
            this.updateHud();
            if (this.film <= 0) this.time.delayedCall(700, () => this.endShoot(tr("filmOut")));
        }
        endShoot(reason) {
            if (this.state !== "play") return;
            this.state = "ending";
            this.showBanner(reason, "", COL.white);
            this.time.delayedCall(1400, () => { this.hideBanner(); this.openSheet(); });
        }

        // ---------- コンタクトシート ----------
        openSheet() {
            this.state = "sheet";
            audio.playMusic("sheet");
            const D = 305;
            const objs = [];
            const add = (o) => { objs.push(o); return o.setDepth(D); };
            add(this.add.rectangle(W / 2, H / 2, W, H, 0x000010, 0.88));
            add(txt(this, W / 2, 8, tr("sheet"), 16, COL.yellow).setOrigin(0.5, 0));
            add(txt(this, W / 2, 26, `${tr("target", this.target)}`, 16, COL.white).setOrigin(0.5, 0).setScale(0.7));
            this.sheet = { objs, sel: 0, cells: [], detail: null, msg: null, thumbs: [] };
            const n = this.photos.length;
            const okIdx = this.photos.map((p, i) => (p.score >= this.target ? i : -1)).filter((i) => i >= 0);
            let best = 0;
            this.photos.forEach((p, i) => { if (p.score > this.photos[best].score) best = i; });
            this.sheet.sel = n ? best : 0;
            this.sheet.anyOk = okIdx.length > 0;
            for (let i = 0; i < 10; i++) {
                const col = i % 5, row = Math.floor(i / 5);
                const x = 24 + col * 88 + 42, y = 64 + row * 76 + 28;
                const frameG = add(this.add.graphics());
                const label = add(txt(this, x, y + 32, "", 16, COL.white).setOrigin(0.5, 0).setScale(0.7));
                this.sheet.cells.push({ x, y, frameG, label, img: null });
            }
            this.sheet.detail = add(txt(this, 20, 222, "", 16, COL.white).setScale(0.7).setAlign("left"));
            this.sheet.detail.setWordWrapWidth((W - 40) / 0.7, true);
            this.sheet.msg = add(txt(this, W / 2, H - 22, "", 16, COL.cyan).setOrigin(0.5).setScale(0.75));
            if (!this.sheet.anyOk) {
                this.sheet.msg.setText(`${tr("noneOk")}   ${this.chances > 1 ? tr("retry", this.chances - 1) : tr("giveUp")}`).setColor(COL.red);
            } else this.sheet.msg.setText(tr("choose"));
            ctx.advance = false;
            ctx.menu = null;
            this.drawSheet();
        }
        drawSheet() {
            const sh = this.sheet;
            sh.cells.forEach((c, i) => {
                const p = this.photos[i];
                const g = c.frameG;
                g.clear();
                const sel = i === sh.sel && this.photos.length > 0;
                g.fillStyle(0x202030, 1).fillRect(c.x - 42, c.y - 28, 84, 56);
                if (p && p.key && !c.img) {
                    c.img = this.add.image(c.x, c.y, p.key).setDepth(306);
                    const sc = Math.min(84 / c.img.width, 56 / c.img.height);
                    c.img.setScale(sc);
                    sh.objs.push(c.img);
                }
                g.lineStyle(sel ? 3 : 1, sel ? 0xf8e058 : p?.best ? 0xf858f8 : 0x606078, 1).strokeRect(c.x - 43, c.y - 29, 86, 58);
                if (p) c.label.setText(p.score > 0 ? `${p.best ? `${tr("bestShort")} ` : ""}${p.grade} ${p.score}` : tr("miss"))
                    .setColor(p.score < this.target ? (p.score > 0 ? COL.white : COL.gray) : p.best ? COL.magenta : COL.green);
                else c.label.setText("");
            });
            const p = this.photos[sh.sel];
            if (p) {
                const extra = `${p.best ? `  ${tr("bestShort")} +10` : ""}${p.a.bonus ? `  +${p.a.bonus}` : ""}${p.a.penalty ? `  ${tr("blocked")} -${p.a.penalty}` : ""}`;
                const head = `#${sh.sel + 1}  ${p.score > 0 ? `${p.grade} ${p.score}` : tr("miss")}   ${tr("parts", ...p.parts)}${extra}`;
                const about = p.score > 0
                    ? `${tr("place")}: ${p.spot ? loc(p.spot.name) : tr("offSpot")}   ${tr("pose")}: ${p.entry ? loc(p.entry) : "-"}   ${tr("face")}: ${p.expr ? loc(p.expr) : "-"}`
                    : "";
                sh.detail.setText(`${head}\n${about}\n${p.tags.join(", ") || "-"}`);
            } else sh.detail.setText("");
        }
        updateSheet() {
            const sh = this.sheet;
            if (ctx.menu && this.photos.length) {
                const [dx, dy] = ctx.menu;
                const n = this.photos.length;
                let i = sh.sel + dx + dy * 5;
                if (i < 0) i = 0;
                if (i >= n) i = n - 1;
                if (i !== sh.sel) { sh.sel = i; audio.sfx("text"); }
                ctx.menu = null;
            }
            this.drawSheet();
            if (!ctx.advance) return;
            ctx.advance = false;
            if (!sh.anyOk) {
                // 撮り直し or 終了
                this.closeSheet();
                if (this.chances > 1) { audio.sfx("start"); this.scene.restart({ stageIndex: this.stageIndex, score: this.score, chances: this.chances - 1, retry: true }); }
                else { this.chances = 0; this.gameOver(); }
                return;
            }
            const p = this.photos[sh.sel];
            if (!p || p.score < this.target) {
                sh.msg.setText(tr("below")).setColor(COL.red);
                audio.sfx("countdown");
                this.time.delayedCall(1200, () => sh.msg?.active && sh.msg.setText(tr("choose")).setColor(COL.cyan));
                return;
            }
            this.chosen = p;
            this.closeSheet();
            this.stageClear();
        }
        closeSheet() {
            this.sheet?.objs.forEach((o) => o.destroy());
            this.sheet = null;
        }

        // ---------- 結果 ----------
        perfect() { return this.heartsGot >= ITEMS_PER_STAGE; }
        buildRewards(scene, place, character) {
            const out = [];
            const add = (text, source) => { if (text) out.push({ type: "prompt", text, weight: 1, source }); };
            add(prompts.style, "style");
            add(character, "character");
            add(scene, "scene");
            add(place, "clear");
            return out;
        }
        // photo: 生成する写真(既定は選んだ写真)。worst: ステージでいちばん点数の低かった写真
        result(kind, photo = this.chosen, worst = false) {
            if (this.score >= ctx.hiScore) saveHiScore(ctx.hiScore);
            const cleared = kind !== "gameover";
            const bonus = !worst && kind === "stage" && this.perfect() && !!this.stage.private_prompt;
            const photoTags = (photo?.tags || []).join(", ") || (worst ? "no humans, scenery" : "");
            // ユイが写っていない失敗写真はキャラクターを入れず、景色だけの写真にする
            const charStage = worst && !photo?.a?.subject ? "" : [prompts.character, this.stage.outfit].filter(Boolean).join(", ");
            // 撮影場所ごとのネガティブ(例: 金魚すくいで水槽に入らないように)。場所が写っているときだけ
            const spotNeg = kind === "stage" && !bonus ? photo?.spot?.negative || "" : "";
            let rewards;
            if (bonus) {
                // プライベート写真: 構図とアングルは選んだ写真のまま、服と場面はふだんの姿に
                // 構図・アングルのタグ(写真のタグは1語ずつに分けてあるので、構図のタグも1語ずつで照らし合わせる)
                const compSet = new Set([...Object.values(SHOT).flatMap((s) => s.tag.split(", ")), "from below", "from above", "dutch angle", "looking at viewer"]);
                const comp = (this.chosen?.tags || []).filter((t) => compSet.has(t)).join(", ");
                // 表情は撮った写真の気まぐれな表情のまま
                rewards = this.buildRewards([comp, this.chosen?.expr?.tag, this.stage.private_prompt].filter(Boolean).join(", "), "", prompts.character_private || prompts.character);
            } else if (kind === "stage") rewards = this.buildRewards(photoTags, this.stage.clear_prompt, charStage);
            else if (kind === "ending") rewards = this.buildRewards(prompts.ending, stages[stages.length - 1].clear_prompt, [prompts.character, stages[stages.length - 1].outfit].join(", "));
            else rewards = this.buildRewards(prompts.gameover, "", charStage);
            const negative = [prompts.negative, kind === "gameover" ? prompts.gameover_negative : "", bonus ? prompts.private_negative : "", spotNeg].filter(Boolean).join(", ");
            return {
                gameId: GAME_ID, kind, cleared, score: this.score, bonus, worst,
                photoScore: photo?.score ?? null,
                items: this.heartsGot, itemsTotal: ITEMS_PER_STAGE,
                stage: this.stageIndex + 1, stagesTotal: stages.length, stageName: loc(this.stage.name),
                negative, rewards,
            };
        }
        stageClear() {
            this.state = "stageclear";
            this.score += this.chosen.score * 100 + this.heartsGot * 500;
            audio.playMusic("clear");
            try { host.stageClear?.(this.result("stage")); } catch (e) { console.error("[shutter] host.stageClear failed", e); }
            // いちばん点数の低かった写真も画像にする(NG集)。選んだ写真しか撮っていなければなし
            const worst = this.photos.filter((p) => p !== this.chosen).reduce((m, p) => (!m || p.score < m.score ? p : m), null);
            if (worst) {
                try { host.stageClear?.(this.result("stage", worst, true)); } catch (e) { console.error("[shutter] host.stageClear (worst) failed", e); }
            }
            // 選んだ写真を大きく
            const objs = [];
            objs.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000010, 0.7).setDepth(290));
            if (this.chosen.key && this.textures.exists(this.chosen.key)) {
                const img = this.add.image(W / 2, 150, this.chosen.key).setDepth(291);
                const sc = Math.min(260 / img.width, 174 / img.height);
                img.setScale(sc * 0.6).setAngle(-6);
                this.tweens.add({ targets: img, scale: sc, angle: -3, duration: 380, ease: "Back.Out" });
                const fg = this.add.graphics().setDepth(290.5);
                fg.fillStyle(0xf8f8f8, 1).fillRect(W / 2 - 138, 150 - 96, 276, 200);
                objs.push(img, fg);
            }
            this.updateHud();
            const perfect = this.perfect();
            const c = this.chosen;
            const caption = [c.spot ? loc(c.spot.name) : "", c.entry ? loc(c.entry) : "", c.expr ? loc(c.expr) : ""].filter(Boolean).join(" / ");
            if (perfect) { audio.sfx("perfect"); this.showBanner(tr("perfect"), `${caption}\n${tr("privatePhoto")}`); }
            else this.showBanner(c.best ? tr("best") : tr("stageClear"), `${c.grade} ${c.score}   ${caption}`);
            this.banner.setY(30).setDepth(320);
            this.subBanner.setY(266).setDepth(320);
            this.time.delayedCall(3200, () => {
                objs.forEach((o) => o.destroy());
                this.hideBanner();
                this.banner.setY(96);
                this.subBanner.setY(128);
                const last = this.stageIndex >= stages.length - 1;
                const proceed = () => {
                    if (last) this.allClear();
                    else this.scene.restart({ stageIndex: this.stageIndex + 1, score: this.score, chances: this.chances });
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
        update(_t, delta) {
            const dt = Math.min(0.05, delta / 1000);
            if (this.state === "done") {
                if (ctx.advance) { ctx.advance = false; if (performance.now() - this.doneAt > 1500) restart(); }
                return;
            }
            if (ctx.pauseToggle) {
                ctx.pauseToggle = false;
                if (["play", "intro"].includes(this.state)) this.paused = !this.paused;
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
            this.t += dt;
            if (this.pendingSnap && --this.pendingSnap.frames <= 0) { const run = this.pendingSnap.run; this.pendingSnap = null; run(); }

            if (this.state === "story") {
                this.story.update(dt, ctx.advance);
                ctx.advance = false;
                ctx.shutterTap = false;
                this.renderStage();
                return;
            }
            if (this.state === "sheet") { this.updateSheet(); ctx.shutterTap = false; return; }
            if (this.state === "intro") {
                this.introT -= dt;
                if (this.introT <= 0) { this.hideBanner(); this.state = "play"; }
                ctx.shutterTap = false;
            }
            if (this.state === "play" || this.state === "intro") {
                if (ctx.spotStep) this.setSpot(this.spotIndex + ctx.spotStep);
                if (ctx.spotPick !== null && ctx.spotPick !== undefined) this.setSpot(ctx.spotPick);
            }
            ctx.spotStep = 0;
            ctx.spotPick = null;
            if (this.state === "play") {
                // バイオリズムが上でそろった瞬間に「キラッ」
                const best = this.bioAt(this.t).v >= BIO_BEST;
                if (best && !this.bio.wasBest && this.yui.mode !== "walk") sfx("twinkle", { vol: 0.7 });
                this.bio.wasBest = best;
                this.timeLeft -= dt;
                if (this.cd > 0) this.cd -= dt;
                this.updateFrame(dt);
                if (ctx.shutterTap) { ctx.shutterTap = false; this.takePhoto(); }
                if (this.timeLeft <= 0) { this.timeLeft = 0; this.endShoot(tr("timeUp")); }
            } else if (this.state === "intro") this.updateFrame(dt);
            ctx.advance = false;
            ctx.menu = null;
            this.updateYui(dt);
            this.updateExtras(dt);
            this.renderStage();
            const a = this.state === "play" || this.state === "intro" ? this.analyze() : null;
            // ピントが合った瞬間に「ピピッ」
            const okNow = !!(a && a.subject);
            if (okNow && !this._wasOk && this.state === "play") sfx("focus", { vol: 0.6 });
            this._wasOk = okNow;
            this.drawViewfinder(a);
            this.updateHud();
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
        Object.assign(ctx, { finished: false, skipStory: false, externalPause: false, advance: false, shutterTap: false, play: null });
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
            game.scene.start("play", { stageIndex: clamp((n | 0) - 1, 0, stages.length - 1), score: 0, chances: diff.chances });
            return true;
        },
        debugScene() { return ctx.play; },
        /** 動作確認用: ユイに枠を合わせる(shot: "full"|"cowboy"|"upper"|"close") */
        debugAim(shot = "upper") {
            const s = ctx.play;
            if (!s) return false;
            const y = s.yui, sc = s.scaleAt(y.d), hpx = y.sprite.height * sc;
            const feet = s.groundY(y.d) - y.jump, top = feet - hpx;
            const bottomR = { full: 1.06, cowboy: 0.76, upper: 0.62, close: 0.38 }[shot] || 0.62;
            const fh = (bottomR + 0.08) * hpx;
            s.frame.w = clamp(fh * ASPECT, FW_MIN, FW_MAX);
            s.frame.x = clamp(y.x, s.frame.w / 2, W - s.frame.w / 2);
            s.frame.y = top - 0.08 * hpx + (s.frame.w / ASPECT) / 2;
            s.frame.rot = 0;
            return true;
        },
        debugShoot() { const s = ctx.play; if (!s) return null; s.takePhoto(); return s.photos[s.photos.length - 1]; },
        /** 動作確認用: 撮影場所を選ぶ(0 始まり) */
        debugSpot(i) { const s = ctx.play; if (!s) return false; s.setSpot(i); return true; },
        /** 動作確認用: いまバイオリズムが最高(3本とも頂点)になるように波をずらす */
        debugBioPeak(ahead = 0) { const s = ctx.play; if (!s) return false; s.bio.ph = s.bio.per.map((p) => Math.PI / 2 - (2 * Math.PI * (s.t + ahead)) / p); return true; },
        /** 動作確認用: ユイを撮影場所に着かせる */
        debugArrive() { const s = ctx.play; if (!s) return false; const y = s.yui; y.x = y.tx; y.d = y.td; if (y.mode === "walk") { y.atSpot = true; s.newPose(); } y.x = y.tx; y.d = y.td; return true; },
        debugEnd() { const s = ctx.play; if (!s) return false; s.timeLeft = 0.01; return true; },
        debugState() {
            const s = ctx.play;
            if (!s || !s.sys.isActive()) return null;
            const a = ["play", "intro"].includes(s.state) ? s.analyze() : null;
            return {
                state: s.state, stage: s.stageIndex + 1, score: s.score, film: s.film, time: +s.timeLeft.toFixed(1), chances: s.chances, hearts: s.heartsGot,
                target: s.target, photos: s.photos.map((p) => p.score), yui: { pose: s.yui.pose, entry: s.yui.entry?.tag || null, mode: s.yui.mode, x: Math.round(s.yui.x), d: +s.yui.d.toFixed(2) }, spot: s.spots[s.spotIndex]?.id, bio: +s.bioAt(s.t).v.toFixed(2),
                frame: { ...s.frame, w: Math.round(s.frame.w) }, live: a && a.subject ? { shot: a.shot, score: s.scoreOf(a), parts: [a.framing, a.place, a.bio, a.steady], best: a.best, penalty: a.penalty, tags: a.tags.join(", "), extra: a.extraTags } : null,
            };
        },
    };
}

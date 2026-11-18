/**
 * PROMPT TYPER — 80年代風タイピングゲーム (WFS Games 第3弾)
 *
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debug... }
 *
 * host: apiVersion / lang / settings { difficulty, sound, bgm } / runStart() / stageClear(result) / finish(result)
 *
 * ルール
 * - 全10ステージ、1ステージ20ワード。2ステージごとにワードの文字数が増える(stages.json の tiers)
 * - 打った文字は間違っていてもそのまま進む。バックスペースで今のワードだけ直せる(打ち間違えた数は減らない)。
 *   打った文字列がそのまま画像生成のプロンプトになる
 * - 正しく打てた文字が85%以上でステージクリア。クリアできなくてもそのステージの画像は生成する
 * - ステージ終了後はリトライできる(クリア時: 次へ / リトライ、未クリア時: リトライ / あきらめる)
 *
 * 文字入力をきれいに扱うため Phaser は使わず DOM で描く(論理サイズ W x H を枠に合わせて拡大)。
 */
import { createAudio } from "../../common/audio.js";
import { loadFont, FONT_NAME, COL, pad, addScanlines } from "../../common/retro.js";

const GAME_ID = "typing";
const W = 640;
const H = 400;
const HISCORE_KEY = "wfs_games_typing_hiscore";
const PROGRESS_KEY = "wfs_games_typing_progress"; // 開放済みの最大ステージ番号
const DEFAULT_CLEAR_RATE = 0.85;
// 入力として受け付ける文字。プロンプトの重み指定 "(:)" やワイルドカード "{|}" "__" になる記号は受け付けない
const ALLOWED = /^[a-z0-9 '.-]$/;
// 日本語・中国語(IME で入力)では、上の記号と改行・区切りのカンマを捨てる(全角の記号はそのまま使える)
const CJK_REJECT = /[(){}[\]|:_\\,<>\r\n\t]/;
// タイピングする言語。日本語・中国語は IME で変換して確定した文字を使う
const TYPE_LANGS = ["en", "ja", "zh"];
const TYPE_LANG_NAMES = { en: "ENGLISH", ja: "日本語", zh: "中文" };
const TLANG_KEY = "wfs_games_typing_lang";

const TEXT = {
    en: {
        title: "PROMPT TYPER", sub: "- TYPE THE PROMPT -",
        rules: ["10 STAGES x 20 WORDS. WORDS GROW EVERY 2 STAGES.", "WHAT YOU TYPE BECOMES THE IMAGE PROMPT - TYPOS TOO.", "TYPE 85% CORRECTLY TO CLEAR. BACKSPACE FIXES THE WORD."],
        pushStart: "PUSH ENTER KEY", startStage: "START STAGE", selectHint: "← → SELECT",
        stage: (n) => `STAGE ${n}`, words: (n, a, b) => `${n} WORDS  /  ${a}-${b} LETTERS`, clearLine: (p) => `CLEAR: ${p}% CORRECT`,
        noBs: "BACKSPACE FIXES THE CURRENT WORD - BUT MISSES STILL COUNT", go: "GO!", word: "WORD", acc: "ACC", miss: "MISS", time: "TIME", score: "SCORE",
        next: "NEXT", prompt: "PROMPT", ime: "IME IS ON - SWITCH TO HALF-WIDTH ALPHANUMERIC",
        clear: "STAGE CLEAR!", failed: "NOT CLEARED", correct: "CORRECT", wpm: "WPM", generating: "THE IMAGE IS BEING GENERATED",
        optNext: "ENTER: NEXT STAGE", optRetry: "R: RETRY", optRetryEnter: "ENTER / R: RETRY", optQuit: "Q: GIVE UP",
        allClear: "ALL STAGES CLEAR!", gameOver: "GAME OVER", total: "TOTAL SCORE", again: "PUSH ENTER KEY", paused: "PAUSE", resume: "ESC: RESUME",
        hi: "HI", typeLang: "TYPING", langHint: "↑ ↓ LANGUAGE",
        cjkNote: "TYPE WITH YOUR IME AND CONFIRM - WHAT YOU CONFIRM IS USED AS IT IS", inputHere: "type here",
        modelNote: "THE IMAGE MODEL MUST UNDERSTAND THIS LANGUAGE",
    },
    ja: {
        title: "PROMPT TYPER", sub: "- プロンプトを打て -",
        rules: ["全10ステージ x 20ワード。2ステージごとに長くなる。", "打った文字が、打ち間違いも含めてそのままプロンプトに。", "85%以上正しく打てばクリア。バックスペースで直せる。"],
        pushStart: "PUSH ENTER KEY", startStage: "スタートステージ", selectHint: "← → で選択",
        stage: (n) => `STAGE ${n}`, words: (n, a, b) => `${n} ワード  /  ${a}〜${b} 文字`, clearLine: (p) => `クリア条件: 正しく入力 ${p}% 以上`,
        noBs: "バックスペースで今のワードを直せる ── ただしミスの数は減らない", go: "GO!", word: "WORD", acc: "ACC", miss: "MISS", time: "TIME", score: "SCORE",
        next: "NEXT", prompt: "PROMPT", ime: "IME がオンです ── 半角英数に切り替えてください",
        clear: "STAGE CLEAR!", failed: "クリアならず", correct: "正しく入力", wpm: "WPM", generating: "このプロンプトで画像を生成します",
        optNext: "ENTER: 次のステージ", optRetry: "R: リトライ", optRetryEnter: "ENTER / R: リトライ", optQuit: "Q: あきらめる",
        allClear: "ALL STAGES CLEAR!", gameOver: "GAME OVER", total: "TOTAL SCORE", again: "PUSH ENTER KEY", paused: "PAUSE", resume: "ESC: 再開",
        hi: "HI", typeLang: "タイピング", langHint: "↑ ↓ で言語",
        cjkNote: "IME で変換して確定 ── 確定した文字がそのままプロンプトに", inputHere: "ここに入力",
        modelNote: "日本語がわかる画像モデルで使ってください",
    },
    zh: {
        title: "PROMPT TYPER", sub: "- 打出提示词 -",
        rules: ["共 10 关 x 20 个词。每 2 关变长。", "输入的文字(包括打错的)会原样成为提示词。", "正确率 85% 以上过关。可以退格修改。"],
        pushStart: "PUSH ENTER KEY", startStage: "开始关卡", selectHint: "← → 选择",
        stage: (n) => `STAGE ${n}`, words: (n, a, b) => `${n} 个词  /  ${a}~${b} 个字`, clearLine: (p) => `过关条件: 正确输入 ${p}% 以上`,
        noBs: "退格可修改当前的词 ── 但失误次数不会减少", go: "GO!", word: "WORD", acc: "ACC", miss: "MISS", time: "TIME", score: "SCORE",
        next: "NEXT", prompt: "PROMPT", ime: "输入法已开启 ── 请切换到半角英数",
        clear: "STAGE CLEAR!", failed: "未能过关", correct: "正确输入", wpm: "WPM", generating: "将用这段提示词生成图像",
        optNext: "ENTER: 下一关", optRetry: "R: 重试", optRetryEnter: "ENTER / R: 重试", optQuit: "Q: 放弃",
        allClear: "ALL STAGES CLEAR!", gameOver: "GAME OVER", total: "TOTAL SCORE", again: "PUSH ENTER KEY", paused: "PAUSE", resume: "ESC: 继续",
        hi: "HI", typeLang: "打字语言", langHint: "↑ ↓ 切换语言",
        cjkNote: "用输入法输入并确认 ── 确认的文字会原样成为提示词", inputHere: "在此输入",
        modelNote: "请使用能理解中文的图像模型",
    },
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ひらがなとカタカナは同じ文字として扱う(「こーひー」と「コーヒー」)
const kanaFold = (c) => {
    const code = c.charCodeAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : c;
};
const sameChar = (a, b) => a === b || (a != null && b != null && kanaFold(a) === kanaFold(b));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const c = Math.floor((sec * 10) % 10);
    return `${m}'${String(s).padStart(2, "0")}"${c}`;
}

async function loadData() {
    const res = await fetch(new URL("./stages.json", import.meta.url));
    if (!res.ok) throw new Error(`stages.json: HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.stages) || !data.stages.length) throw new Error("stages.json: no stages");
    return data;
}

function loadNum(key) { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } }
function saveNum(key, v) { try { localStorage.setItem(key, String(v)); } catch { /* ignore */ } }

const CSS = `
.wtp-root { width:100%; height:100%; position:relative; outline:none; overflow:hidden; background:#05060f; }
.wtp-screen { position:absolute; left:50%; top:50%; width:${W}px; height:${H}px; transform-origin:50% 50%;
  font-family:"${FONT_NAME}", monospace; color:${COL.white}; font-size:16px; line-height:1.4; user-select:none;
  background:radial-gradient(ellipse at 50% 40%, #141838 0%, #05060f 75%); }
.wtp-frame { position:absolute; inset:8px; border:2px solid ${COL.white}; pointer-events:none; }
.wtp-frame::after { content:""; position:absolute; inset:4px; border:1px solid var(--wtp-accent, ${COL.cyan}); }
.wtp-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:6px; padding:24px; }
.wtp-title { font-size:44px; color:${COL.yellow}; text-shadow:3px 3px 0 ${COL.magenta}; letter-spacing:2px; }
.wtp-big { font-size:36px; text-shadow:3px 3px 0 #202050; }
.wtp-mid { font-size:22px; }
.wtp-small { font-size:13px; color:${COL.gray}; }
.wtp-blink { animation:wtp-blink 0.96s steps(1) infinite; }
@keyframes wtp-blink { 50% { visibility:hidden; } }
.wtp-hud { position:absolute; left:20px; right:20px; top:16px; display:flex; justify-content:space-between; font-size:14px; }
.wtp-hud b { font-weight:normal; color:${COL.yellow}; margin-left:6px; }
.wtp-stagebar { position:absolute; left:20px; right:20px; top:40px; display:flex; justify-content:space-between; font-size:14px; color:var(--wtp-accent); }
.wtp-progress { position:absolute; left:20px; right:20px; top:62px; height:6px; background:#202040; }
.wtp-progress > div { height:100%; background:var(--wtp-accent); width:0; }
.wtp-wordbox { position:absolute; left:20px; right:20px; top:82px; height:154px; border:2px solid #303060; background:#000010;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; }
.wtp-row { display:flex; justify-content:center; white-space:pre; line-height:1.15; }
.wtp-row span { display:inline-block; text-align:center; }
.wtp-reading { font-size:14px; height:18px; color:${COL.cyan}; letter-spacing:1px; }
.wtp-ref span { color:${COL.white}; }
.wtp-ref span.done { color:#505070; }
.wtp-ref span.cur { color:#000010; background:${COL.cyan}; }
.wtp-ref span.sp { color:#404060; }
.wtp-ref span.cur.sp { color:#000010; }
.wtp-typed span.ok { color:${COL.green}; }
.wtp-typed span.ng { color:${COL.red}; text-decoration:underline; }
.wtp-next { position:absolute; left:20px; right:20px; top:238px; font-size:14px; color:${COL.gray}; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wtp-msg { position:absolute; left:20px; right:20px; top:258px; height:20px; font-size:14px; text-align:center; color:${COL.orange}; }
.wtp-promptbox { position:absolute; left:20px; right:20px; top:282px; bottom:18px; border:1px solid #303060; padding:6px 8px; overflow:hidden; font-size:13px; line-height:1.5; }
.wtp-promptbox .lbl { color:${COL.cyan}; margin-right:6px; }
.wtp-promptbox .ng, .wtp-result-prompt .ng { color:${COL.red}; }
.wtp-result-prompt { max-height:96px; overflow:hidden; width:100%; border:1px solid #303060; padding:6px 8px; font-size:12px; line-height:1.5; text-align:left; color:#c8c8d8; }
.wtp-stats { display:grid; grid-template-columns:auto auto; gap:2px 24px; font-size:15px; text-align:left; }
.wtp-stats .v { color:${COL.yellow}; text-align:right; }
.wtp-opts { display:flex; gap:24px; font-size:15px; color:${COL.cyan}; margin-top:4px; }
.wtp-overlay { position:absolute; inset:0; background:rgba(0,0,16,0.72); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; z-index:3; }
.wtp-input { width:300px; height:30px; margin-top:2px; padding:0 8px; font-family:inherit; font-size:18px; color:${COL.yellow};
  background:#0a0a24; border:1px solid ${COL.cyan}; outline:none; text-align:center; }
.wtp-input:disabled { border-color:#303060; }
.wtp-input::placeholder { color:#505070; }
.wtp-count { font-size:72px; color:${COL.yellow}; text-shadow:4px 4px 0 ${COL.magenta}; }
`;

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
    const [data] = await Promise.all([loadData(), loadFont()]);
    const stages = data.stages;
    const clearRate = Number(data.clear_rate) > 0 ? Number(data.clear_rate) : DEFAULT_CLEAR_RATE;
    // BGM は無し(効果音だけ)
    const audio = createAudio({ sound: settings.sound !== false, bgm: false, songs: {} });
    let savedLang = "";
    try { savedLang = localStorage.getItem(TLANG_KEY) || ""; } catch { /* ignore */ }

    const ctx = {
        mode: "title",          // title | intro | count | type | result | ending | gameover
        finished: false,
        userPause: false,
        externalPause: false,
        hiScore: loadNum(HISCORE_KEY),
        unlocked: clamp(loadNum(PROGRESS_KEY) || 1, 1, stages.length),
        startStage: 1,
        tlang: TYPE_LANGS.includes(savedLang) ? savedLang : "en", // タイピングする言語
        stageIndex: 0,
        score: 0,               // これまでのステージの合計(リトライ時は最後の結果で置き換える)
        stageScores: [],
        clearedTyped: [],       // ステージごとの、最後にクリアしたときの入力
        // 現在のステージ
        typedWords: [],
        cur: "",
        wordIdx: 0,
        typed: 0,
        correct: 0,
        started: false,
        elapsed: 0,
        countT: 0,
        msgT: 0,
        last: null,             // 直前のステージ結果
    };
    const paused = () => ctx.userPause || ctx.externalPause;

    // ---- DOM ----
    container.innerHTML = "";
    const root = document.createElement("div");
    root.className = "wtp-root";
    root.tabIndex = 0;
    const style = document.createElement("style");
    style.textContent = CSS;
    const screen = document.createElement("div");
    screen.className = "wtp-screen";
    root.append(style, screen);
    container.appendChild(root);
    addScanlines(root);

    const fit = () => {
        const s = Math.min(root.clientWidth / W, root.clientHeight / H) || 1;
        screen.style.transform = `translate(-50%, -50%) scale(${s})`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    fit();

    const q = (sel) => screen.querySelector(sel);
    const isCjk = () => ctx.tlang !== "en";
    // 日本語・中国語のプレイ中は IME 用の入力欄にフォーカスする
    const focusRoot = () => {
        const input = q(".wtp-input");
        if (input && !input.disabled) input.focus({ preventScroll: true });
        else root.focus({ preventScroll: true });
    };

    const finish = (result) => {
        if (ctx.finished) return;
        ctx.finished = true;
        try { host.finish?.(result); } catch (e) { console.error("[typing] host.finish failed", e); }
    };

    const stage = () => stages[ctx.stageIndex];
    const wordsOf = (st) => st.words?.[ctx.tlang] || st.words?.en || [];
    const tierOf = (i) => {
        const list = data.tiers?.[ctx.tlang] || data.tiers?.en || [];
        return list[Math.floor(i / 2)] || list[list.length - 1] || { min: 1, max: 32 };
    };
    const stageChars = () => wordsOf(stage()).reduce((a, w) => a + w.length, 0);
    const allowedMiss = () => Math.floor(stageChars() * (1 - clearRate) + 1e-9);
    const accent = () => stage()?.color || COL.cyan;

    // ---------------- screens ----------------

    function renderTitle() {
        ctx.mode = "title";
        screen.style.setProperty("--wtp-accent", COL.magenta);
        const sel = ctx.unlocked > 1
            ? `<div class="wtp-mid">${esc(tr("startStage"))}  <span style="color:${COL.cyan}">◀</span> <span style="color:${COL.yellow}">${ctx.startStage}</span> <span style="color:${COL.cyan}">▶</span></div>
               <div class="wtp-small">${esc(tr("selectHint"))}  ·  ${esc(loc(stages[ctx.startStage - 1].name))}</div>`
            : "";
        screen.innerHTML = `
            <div class="wtp-frame"></div>
            <div class="wtp-center">
                <div class="wtp-title">${esc(tr("title"))}</div>
                <div>${esc(tr("sub"))}</div>
                <div style="margin:6px 0;font-size:14px;color:${COL.gray};line-height:1.7">${tr("rules").map(esc).join("<br>")}</div>
                <div class="wtp-mid">${esc(tr("typeLang"))}  ${TYPE_LANGS.map((l) => `<span style="color:${l === ctx.tlang ? COL.yellow : "#505070"}">${esc(TYPE_LANG_NAMES[l])}</span>`).join("  ")}</div>
                <div class="wtp-small">${esc(tr("langHint"))}${isCjk() ? `  ·  ${esc(tr("modelNote"))}` : ""}</div>
                ${sel}
                <div class="wtp-blink" style="color:${COL.yellow};margin-top:8px">${esc(tr("pushStart"))}</div>
                <div class="wtp-small">${esc(tr("hi"))} ${pad(ctx.hiScore)}</div>
            </div>`;
    }

    function renderIntro() {
        ctx.mode = "intro";
        if (ctx.userPause) { ctx.userPause = false; audio.setPaused(paused()); }
        const st = stage();
        const tier = tierOf(ctx.stageIndex);
        screen.style.setProperty("--wtp-accent", accent());
        screen.innerHTML = `
            <div class="wtp-frame"></div>
            <div class="wtp-center">
                <div class="wtp-big" style="color:${accent()}">${esc(tr("stage", st.id))}</div>
                <div class="wtp-mid">${esc(loc(st.name))}</div>
                <div style="margin-top:14px">${esc(tr("words", wordsOf(st).length, tier.min, tier.max))}</div>
                <div style="color:${COL.yellow}">${esc(tr("clearLine", Math.round(clearRate * 100)))}</div>
                <div class="wtp-small" style="margin-top:6px">${esc(tr("noBs"))}</div>
                ${isCjk() ? `<div class="wtp-small" style="color:${COL.cyan}">${esc(TYPE_LANG_NAMES[ctx.tlang])}: ${esc(tr("cjkNote"))}</div>` : ""}
                <div class="wtp-blink" style="color:${COL.yellow};margin-top:18px">${esc(tr("pushStart"))}</div>
            </div>`;
    }

    function startCountdown() {
        resetStageState();
        renderPlay();
        ctx.mode = "count";
        ctx.countT = 3;
        showCount("3");
        audio.sfx("countdown");
    }

    function showCount(label) {
        let ov = q(".wtp-overlay.count");
        if (!label) { ov?.remove(); return; }
        if (!ov) {
            ov = document.createElement("div");
            ov.className = "wtp-overlay count";
            ov.style.background = "rgba(0,0,16,0.45)";
            screen.appendChild(ov);
        }
        ov.innerHTML = `<div class="wtp-count">${esc(label)}</div>`;
    }

    function resetStageState() {
        Object.assign(ctx, { typedWords: [], cur: "", wordIdx: 0, typed: 0, correct: 0, started: false, elapsed: 0, msgT: 0 });
    }

    function renderPlay() {
        const st = stage();
        screen.style.setProperty("--wtp-accent", accent());
        screen.innerHTML = `
            <div class="wtp-frame"></div>
            <div class="wtp-hud">
                <span>${esc(tr("score"))}<b data-r="score"></b></span>
                <span>${esc(tr("acc"))}<b data-r="acc"></b></span>
                <span>${esc(tr("miss"))}<b data-r="miss"></b></span>
                <span>${esc(tr("time"))}<b data-r="time"></b></span>
            </div>
            <div class="wtp-stagebar">
                <span>${esc(tr("stage", st.id))}  ${esc(loc(st.name))}</span>
                <span>${esc(tr("word"))} <span data-r="word"></span></span>
            </div>
            <div class="wtp-progress"><div data-r="bar"></div></div>
            <div class="wtp-wordbox">
                <div class="wtp-reading" data-r="reading"></div>
                <div class="wtp-row wtp-ref" data-r="ref"></div>
                <div class="wtp-row wtp-typed" data-r="typed"></div>
                ${isCjk() ? `<input class="wtp-input" type="text" lang="${ctx.tlang}" autocomplete="off" spellcheck="false" disabled placeholder="${esc(tr("inputHere"))}">` : ""}
            </div>
            <div class="wtp-next" data-r="next"></div>
            <div class="wtp-msg" data-r="msg"></div>
            <div class="wtp-promptbox" data-r="prompt"></div>`;
        const input = q(".wtp-input");
        if (input) bindImeInput(input);
        updateWord();
        updatePrompt();
        updateHud();
    }

    function charCell(ch, cls, w, fs) {
        return `<span class="${cls}" style="width:${w}px;font-size:${fs}px">${ch === " " ? "&nbsp;" : esc(ch)}</span>`;
    }

    function updateWord() {
        const st = stage();
        const target = wordsOf(st)[ctx.wordIdx] || "";
        // 英字は縦長のマス、日本語・中国語は全角の正方形のマス
        const w = isCjk() ? clamp(Math.floor(580 / Math.max(1, target.length)), 24, 44) : clamp(Math.floor(580 / Math.max(1, target.length)), 14, 30);
        const fs = isCjk() ? Math.round(w * 0.86) : Math.round(w * 1.4);
        let ref = "";
        let typed = "";
        for (let i = 0; i < target.length; i++) {
            const t = target[i];
            const sp = t === " ";
            const cls = i < ctx.cur.length ? "done" : i === ctx.cur.length ? "cur" : "";
            ref += charCell(sp ? "·" : t, `${cls}${sp ? " sp" : ""}`, w, fs);
            if (i < ctx.cur.length) {
                const c = ctx.cur[i];
                const ok = sameChar(c, t);
                typed += charCell(!ok && c === " " ? "␣" : c, ok ? "ok" : "ng", w, fs);
            } else {
                typed += charCell(" ", "", w, fs);
            }
        }
        q('[data-r="ref"]').innerHTML = ref;
        // 漢字を含むワードは読みがなを出す(日本語のみ)
        const reading = st.reading?.[ctx.tlang]?.[ctx.wordIdx] || "";
        const rd = q('[data-r="reading"]');
        rd.textContent = reading;
        rd.style.display = isCjk() ? "" : "none";
        q('[data-r="typed"]').innerHTML = typed;
        const next = wordsOf(st)[ctx.wordIdx + 1];
        q('[data-r="next"]').textContent = next ? `${tr("next")}: ${next}` : "";
        q('[data-r="word"]').textContent = `${Math.min(ctx.wordIdx + 1, wordsOf(st).length)}/${wordsOf(st).length}`;
        q('[data-r="bar"]').style.width = `${(ctx.wordIdx / wordsOf(st).length) * 100}%`;
    }

    // 打った文字列を、間違えた文字を赤くして HTML にする
    function markTyped(typedStr, target) {
        let out = "";
        for (let i = 0; i < typedStr.length; i++) {
            const c = typedStr[i];
            out += sameChar(c, target[i]) ? esc(c) : `<span class="ng">${c === " " ? "␣" : esc(c)}</span>`;
        }
        return out;
    }

    function promptHtml(words, typedWords) {
        return typedWords.map((tw, i) => markTyped(tw, words[i])).join(", ");
    }

    function updatePrompt() {
        const box = q('[data-r="prompt"]');
        if (!box) return;
        box.innerHTML = `<span class="lbl">${esc(tr("prompt"))}&gt;</span>${promptHtml(wordsOf(stage()), ctx.typedWords)}`;
        // あふれたら古い方を隠す(最新の行が見えるように)
        box.scrollTop = box.scrollHeight;
    }

    function updateHud() {
        const acc = ctx.typed ? (ctx.correct / ctx.typed) * 100 : 100;
        const miss = ctx.typed - ctx.correct;
        const allow = allowedMiss();
        const set = (r, v, color) => {
            const el = q(`[data-r="${r}"]`);
            if (!el) return;
            el.textContent = v;
            if (color) el.style.color = color;
        };
        set("score", pad(ctx.score + liveStageScore()));
        set("acc", `${acc.toFixed(1)}%`, acc >= clearRate * 100 ? COL.green : COL.red);
        set("miss", `${miss}/${allow}`, miss > allow ? COL.red : miss > allow * 0.7 ? COL.orange : COL.yellow);
        set("time", fmtTime(ctx.elapsed));
    }

    function liveStageScore() {
        return ctx.correct * 10;
    }

    function flashMsg(text, color = COL.orange) {
        const el = q('[data-r="msg"]');
        if (!el) return;
        el.textContent = text;
        el.style.color = color;
        ctx.msgT = 2.2;
    }

    // ---------------- typing ----------------

    /**
     * 日本語・中国語: IME で変換中の文字は入力欄に出し、確定した文字をまとめて今のワードに足す。
     * 1回の確定は今のワードだけに入る(変換せずに読みのまま確定して文字数が多くても、次のワードへはずれ込まない)。
     * 確定した文字は、入力欄が空のときのバックスペースで今のワードから消せる。
     */
    function bindImeInput(input) {
        let composing = false;
        const consume = () => {
            const v = input.value;
            input.value = "";
            if (!v || ctx.mode !== "type" || paused()) return;
            const chars = [...v.normalize("NFKC")].filter((ch) => !CJK_REJECT.test(ch));
            if (chars.length) addChars(chars);
        };
        input.addEventListener("compositionstart", () => { composing = true; });
        input.addEventListener("compositionend", () => { composing = false; consume(); });
        input.addEventListener("input", (e) => { if (!composing && !e.isComposing) consume(); });
    }

    function setInputEnabled(on) {
        const input = q(".wtp-input");
        if (!input) return;
        input.disabled = !on;
        if (on) focusRoot();
    }

    function typeChar(ch) {
        addChars([ch]);
    }

    /**
     * 今のワードに文字を足す。ワードの文字数に達したら(超えた分もそのワードに含めて)次のワードへ進む。
     * 正解率は「入力した文字」単位で数える。バックスペースで消しても、打ち間違えたことは取り消されない。
     */
    function addChars(chars) {
        const st = stage();
        const target = wordsOf(st)[ctx.wordIdx];
        if (!target) return;
        if (!ctx.started) ctx.started = true;
        let miss = false;
        for (const ch of chars) {
            const ok = sameChar(ch, target[ctx.cur.length]);
            ctx.cur += ch;
            ctx.typed++;
            if (ok) ctx.correct++; else miss = true;
        }
        audio.sfx(miss ? "hit" : "text");
        if (ctx.cur.length >= target.length) {
            ctx.typedWords.push(ctx.cur);
            const perfectWord = [...ctx.cur].every((c, i) => sameChar(c, target[i]));
            ctx.cur = "";
            ctx.wordIdx++;
            if (perfectWord) audio.sfx("pass");
            updatePrompt();
            if (ctx.wordIdx >= wordsOf(st).length) { endStage(); return; }
        }
        updateWord();
        updateHud();
    }

    /** 今のワードの最後の1文字を消す(確定済みの前のワードは直せない) */
    function backspace() {
        if (!ctx.cur) return;
        ctx.cur = [...ctx.cur].slice(0, -1).join("");
        audio.sfx("text");
        updateWord();
    }

    function endStage() {
        const st = stage();
        const total = stageChars();
        const acc = ctx.typed ? ctx.correct / ctx.typed : 0;
        const cleared = acc + 1e-9 >= clearRate;
        const minutes = Math.max(ctx.elapsed, 0.1) / 60;
        const wpm = Math.round((ctx.typed / 5) / minutes);
        const stageScore = ctx.correct * 10 + Math.min(wpm, 200) * 5 + (cleared ? 500 * st.id : 0);
        ctx.stageScores[ctx.stageIndex] = stageScore;
        ctx.score = ctx.stageScores.reduce((a, b) => a + (b || 0), 0);
        if (ctx.score > ctx.hiScore) { ctx.hiScore = ctx.score; saveNum(HISCORE_KEY, ctx.hiScore); }
        if (cleared) {
            ctx.clearedTyped[ctx.stageIndex] = ctx.typedWords.slice();
            const nextUnlock = Math.min(stages.length, st.id + 1);
            if (nextUnlock > ctx.unlocked) { ctx.unlocked = nextUnlock; saveNum(PROGRESS_KEY, nextUnlock); }
        }
        ctx.last = { stageIndex: ctx.stageIndex, cleared, acc, wpm, typed: ctx.typed, correct: ctx.correct, total, time: ctx.elapsed, stageScore, typedWords: ctx.typedWords.slice() };

        // クリアできなくても、打ったプロンプトで画像を生成する
        const pct = (acc * 100).toFixed(1);
        try {
            host.stageClear?.({
                gameId: GAME_ID, kind: "stage", stage: st.id, stagesTotal: stages.length,
                stageName: `${loc(st.name)} — ${cleared ? "CLEAR" : "MISS"} ${pct}%`,
                cleared, score: ctx.score, accuracy: Number(pct),
                rewards: ctx.typedWords.map((text) => ({ type: "prompt", text, weight: 1, source: "typing" })),
            });
        } catch (e) { console.error("[typing] host.stageClear failed", e); }
        renderResult();
        focusRoot(); // 入力欄が消えるので、Enter / R を受け取れるよう枠にフォーカスを戻す
    }

    function renderResult() {
        ctx.mode = "result";
        const r = ctx.last;
        const st = stages[r.stageIndex];
        const isLast = r.stageIndex >= stages.length - 1;
        const opts = r.cleared
            ? [isLast ? "ENTER: ALL CLEAR" : tr("optNext"), tr("optRetry")]
            : [tr("optRetryEnter"), tr("optQuit")];
        screen.innerHTML = `
            <div class="wtp-frame"></div>
            <div class="wtp-center" style="gap:8px">
                <div class="wtp-big" style="color:${r.cleared ? COL.yellow : COL.red}">${esc(r.cleared ? tr("clear") : tr("failed"))}</div>
                <div style="color:${accent()}">${esc(tr("stage", st.id))}  ${esc(loc(st.name))}</div>
                <div class="wtp-stats">
                    <span>${esc(tr("correct"))}</span><span class="v">${r.correct}/${r.total}  (${(r.acc * 100).toFixed(1)}%)</span>
                    <span>${esc(tr("time"))} / ${esc(tr("wpm"))}</span><span class="v">${fmtTime(r.time)} / ${r.wpm}</span>
                    <span>${esc(tr("score"))}</span><span class="v">${pad(r.stageScore)}  (${esc(tr("total"))} ${pad(ctx.score)})</span>
                </div>
                <div class="wtp-small">${esc(tr("generating"))}</div>
                <div class="wtp-result-prompt">${promptHtml(wordsOf(st), r.typedWords)}</div>
                <div class="wtp-opts">${opts.map((o) => `<span>${esc(o)}</span>`).join("")}</div>
            </div>`;
        audio.sfx(r.cleared ? "perfect" : "playerDown");
    }

    function renderEnding() {
        ctx.mode = "ending";
        screen.style.setProperty("--wtp-accent", COL.yellow);
        screen.innerHTML = `
            <div class="wtp-frame"></div>
            <div class="wtp-center">
                <div class="wtp-title">${esc(tr("allClear"))}</div>
                <div class="wtp-mid" style="margin-top:12px">${esc(tr("total"))}  <span style="color:${COL.yellow}">${pad(ctx.score)}</span></div>
                <div class="wtp-small">${esc(tr("hi"))} ${pad(ctx.hiScore)}</div>
                <div class="wtp-blink" style="color:${COL.yellow};margin-top:20px">${esc(tr("again"))}</div>
            </div>`;
        audio.sfx("perfect");
        // エンディング: 各ステージの最初のワード(主題)を、クリア時に打った文字のままつなげる
        const rewards = stages
            .map((s, i) => ctx.clearedTyped[i]?.[0])
            .filter(Boolean)
            .map((text) => ({ type: "prompt", text, weight: 1, source: "typing" }));
        finish({ gameId: GAME_ID, kind: "ending", cleared: true, score: ctx.score, stage: stages.length, stagesTotal: stages.length, stageName: "ALL CLEAR", rewards });
    }

    function renderGameOver() {
        ctx.mode = "gameover";
        const st = stage();
        screen.style.setProperty("--wtp-accent", COL.red);
        screen.innerHTML = `
            <div class="wtp-frame"></div>
            <div class="wtp-center">
                <div class="wtp-title" style="color:${COL.red};text-shadow:3px 3px 0 #401010">${esc(tr("gameOver"))}</div>
                <div class="wtp-mid" style="margin-top:12px">${esc(tr("total"))}  <span style="color:${COL.yellow}">${pad(ctx.score)}</span></div>
                <div class="wtp-blink" style="color:${COL.yellow};margin-top:20px">${esc(tr("again"))}</div>
            </div>`;
        // あきらめたときは追加の画像は作らない(そのステージの画像はもう生成済み)
        finish({ gameId: GAME_ID, kind: "gameover", cleared: false, score: ctx.score, stage: st.id, stagesTotal: stages.length, stageName: loc(st.name), rewards: [] });
    }

    function startRun() {
        Object.assign(ctx, { finished: false, score: 0, stageScores: [], clearedTyped: [], stageIndex: ctx.startStage - 1 });
        try { host.runStart?.(); } catch (e) { console.error("[typing] host.runStart failed", e); }
        audio.sfx("start");
        renderIntro();
    }

    function setPauseOverlay() {
        const on = ctx.userPause && (ctx.mode === "type" || ctx.mode === "count");
        let ov = q(".wtp-overlay.pause");
        if (on && !ov) {
            ov = document.createElement("div");
            ov.className = "wtp-overlay pause";
            ov.innerHTML = `<div class="wtp-big" style="color:${COL.yellow}">${esc(tr("paused"))}</div><div class="wtp-small">${esc(tr("resume"))}</div>`;
            screen.appendChild(ov);
        } else if (!on && ov) ov.remove();
        audio.setPaused(paused());
        // 一時停止中は入力欄を止め、Esc を受け取れるよう枠にフォーカスを戻す
        if (ctx.mode === "type") setInputEnabled(!paused());
        focusRoot();
    }

    // ---------------- input ----------------

    const onKey = (e) => {
        e.stopPropagation(); // WFS 全体のショートカットへ渡さない
        if (e.type !== "keydown") return;
        if (e.ctrlKey || e.metaKey || e.altKey) return; // コピーなどブラウザの操作は通す
        const k = e.key;
        audio.unlock();
        // 日本語・中国語のプレイ中は、文字の入力を IME と入力欄に任せる(変換中のキーには触らない)
        if (isCjk() && (ctx.mode === "type" || ctx.mode === "count")) {
            if (e.isComposing || k === "Process") return;
            if (k === "Escape" || (k === "Backspace" && e.target?.value === "")) {
                e.preventDefault();
                if (!e.repeat) handleKey(k);
            }
            return;
        }
        const handled = k.length === 1 || ["Enter", "Escape", "Backspace", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Process"].includes(k);
        if (handled) e.preventDefault();
        if (e.isComposing || k === "Process") {
            if (ctx.mode === "type") flashMsg(tr("ime"), COL.red);
            return;
        }
        if (e.repeat) return;
        handleKey(k);
    };

    function handleKey(k) {
        const lower = k.length === 1 ? k.toLowerCase() : k;
        switch (ctx.mode) {
            case "title":
                if (k === "ArrowLeft" || k === "ArrowRight") {
                    const d = k === "ArrowLeft" ? -1 : 1;
                    const n = clamp(ctx.startStage + d, 1, ctx.unlocked);
                    if (n !== ctx.startStage) { ctx.startStage = n; audio.sfx("text"); renderTitle(); }
                } else if (k === "ArrowUp" || k === "ArrowDown") {
                    const i = TYPE_LANGS.indexOf(ctx.tlang) + (k === "ArrowUp" ? -1 : 1);
                    ctx.tlang = TYPE_LANGS[(i + TYPE_LANGS.length) % TYPE_LANGS.length];
                    try { localStorage.setItem(TLANG_KEY, ctx.tlang); } catch { /* ignore */ }
                    audio.sfx("text");
                    renderTitle();
                } else if (k === "Enter" || k === " ") startRun();
                break;
            case "intro":
                if (k === "Enter" || k === " ") startCountdown();
                break;
            case "count":
            case "type":
                if (k === "Escape") { ctx.userPause = !ctx.userPause; setPauseOverlay(); break; }
                if (paused() || ctx.mode !== "type") break;
                if (k === "Backspace") { backspace(); break; }
                if (lower.length === 1 && ALLOWED.test(lower)) typeChar(lower);
                break;
            case "result": {
                const r = ctx.last;
                if (r.cleared && k === "Enter") {
                    if (r.stageIndex >= stages.length - 1) renderEnding();
                    else { ctx.stageIndex = r.stageIndex + 1; renderIntro(); }
                } else if (lower === "r" || (!r.cleared && k === "Enter")) {
                    ctx.stageIndex = r.stageIndex;
                    renderIntro();
                } else if (!r.cleared && lower === "q") renderGameOver();
                break;
            }
            case "ending":
            case "gameover":
                if (k === "Enter" || k === " ") { ctx.startStage = Math.min(ctx.startStage, ctx.unlocked); renderTitle(); }
                break;
            default: break;
        }
    }

    container.addEventListener("keydown", onKey);
    container.addEventListener("keyup", onKey);
    const onPointer = () => { focusRoot(); audio.unlock(); };
    root.addEventListener("pointerdown", onPointer);

    // ---------------- loop ----------------

    let raf = 0;
    let lastTs = 0;
    const loop = (ts) => {
        raf = requestAnimationFrame(loop);
        const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
        lastTs = ts;
        if (paused()) return;
        if (ctx.mode === "count") {
            const before = Math.ceil(ctx.countT);
            ctx.countT -= dt;
            const now = Math.ceil(ctx.countT);
            if (ctx.countT <= -0.5) { showCount(""); beginTyping(); }
            else if (now !== before) {
                if (now > 0) { showCount(String(now)); audio.sfx("countdown"); }
                else { showCount(tr("go")); audio.sfx("go"); beginTyping(); setTimeout(() => { if (ctx.mode === "type") showCount(""); }, 450); }
            }
        } else if (ctx.mode === "type") {
            if (ctx.started) {
                ctx.elapsed += dt;
                const el = q('[data-r="time"]');
                if (el) el.textContent = fmtTime(ctx.elapsed);
            }
            if (ctx.msgT > 0) {
                ctx.msgT -= dt;
                if (ctx.msgT <= 0) { const el = q('[data-r="msg"]'); if (el) el.textContent = ""; }
            }
        }
    };
    raf = requestAnimationFrame(loop);

    function beginTyping() {
        ctx.mode = "type";
        setInputEnabled(!paused());
    }

    function restart() {
        Object.assign(ctx, { finished: false, userPause: false, externalPause: false });
        audio.setPaused(false);
        ctx.startStage = Math.min(ctx.startStage, ctx.unlocked);
        renderTitle();
        focusRoot();
    }

    renderTitle();
    setTimeout(focusRoot, 0);

    return {
        unmount() {
            cancelAnimationFrame(raf);
            ro.disconnect();
            audio.close();
            container.removeEventListener("keydown", onKey);
            container.removeEventListener("keyup", onKey);
            container.innerHTML = "";
        },
        pause() {
            ctx.externalPause = true;
            audio.setPaused(true);
            const input = q(".wtp-input");
            if (input) input.disabled = true; // 別タブへ移ったときはフォーカスを奪わない
        },
        resume() {
            ctx.externalPause = false;
            audio.setPaused(paused());
            if (ctx.mode === "type") setInputEnabled(!paused());
            focusRoot();
        },
        restart,
        focus: focusRoot,
        /** 動作確認用: 指定のステージの導入画面へ(1〜10) */
        debugStartStage(n) {
            ctx.finished = false;
            ctx.stageIndex = clamp((n | 0) - 1, 0, stages.length - 1);
            renderIntro();
            return ctx.stageIndex + 1;
        },
        /** 動作確認用: 今のステージの残りを、指定の正解率で打ち切る(0〜1) */
        debugFinishStage(acc = 1) {
            if (ctx.mode === "intro") startCountdown();
            if (ctx.mode === "count") { showCount(""); beginTyping(); }
            if (ctx.mode !== "type") return false;
            ctx.started = true;
            ctx.elapsed = Math.max(ctx.elapsed, 30);
            let n = 0;
            const wrong = isCjk() ? ["猫", "犬"] : ["x", "z"];
            while (ctx.mode === "type") {
                const target = wordsOf(stage())[ctx.wordIdx];
                const want = target[ctx.cur.length];
                n++;
                const ok = (n * 0.6180339) % 1 < acc;
                typeChar(ok ? want : (want === wrong[0] ? wrong[1] : wrong[0]));
            }
            return ctx.last && { cleared: ctx.last.cleared, acc: +(ctx.last.acc * 100).toFixed(1) };
        },
        debugKey(k) { handleKey(k); return ctx.mode; },
        debugState() {
            return { mode: ctx.mode, tlang: ctx.tlang, stage: ctx.stageIndex + 1, word: ctx.wordIdx, cur: ctx.cur, typed: ctx.typed, correct: ctx.correct, score: ctx.score, unlocked: ctx.unlocked, paused: paused(), last: ctx.last && { cleared: ctx.last.cleared, acc: ctx.last.acc } };
        },
    };
}

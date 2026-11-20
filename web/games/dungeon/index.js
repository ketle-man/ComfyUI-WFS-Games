/**
 * DUNGEON HEART - 3D迷路のコマンド式RPG(three.js)
 *
 * WFS Game Host API v1:
 *   export async function mount(container, host) -> { unmount, pause, resume, restart, focus, debug... }
 * host: apiVersion / lang / settings { difficulty, sound, bgm } / runStart() / stageClear(result) / finish(result)
 *
 * 画面は 640×400 の論理解像度。3D ビュー(three.js, VIEW_W×VIEW_H を2倍に拡大)の上に
 * Canvas 2D の UI(HUD・オートマップ・メッセージ・選択肢)を重ねる。WebGL コンテキストは three.js の1つだけ。
 * 操作はキーボードのみ。セーブは localStorage に1枠(階の開始時に自動、回復の泉で手動)。
 *
 * 企画: ComfyUI-Workflow-Studio/PLAN_GAME_TAB.md 14.6。段取り5(全5階・ボス・BGM・エンディング)まで。
 */
import { createWorld, VIEW_W, VIEW_H, DIRS } from "./world.js";
import { ITEMS, GEMS, TREASURES, GOLD_PROMPT, EQUIP, SLOTS, SLOT_NAMES, parseLoot } from "./items.js";
import { drawSera } from "./portrait.js";
import { drawItemIcon } from "./icons.js";
import { createTitle } from "./title.js";
import { makeSfx } from "./sfx.js";
import { createMagic, SPELLS } from "./magic.js";
import { createBattle, baseStats, knownSpells } from "./battle.js";
import { loadFont, FONT_NAME } from "../../common/retro.js";
import { createAudio } from "../../common/audio.js";
import { SONGS } from "./songs.js";

const GAME_ID = "dungeon";
const SAVE_KEY = "wfs_games_dungeon_save";
const SAVE_VERSION = 1;
const STAGES_TOTAL = 5;

const W = 640, H = 400;
const VIEW_X = 8, VIEW_Y = 8, VIEW_SCALE = 2;
const VW = VIEW_W * VIEW_SCALE, VH = VIEW_H * VIEW_SCALE;
const SIDE_X = VIEW_X + VW + 10, SIDE_W = W - SIDE_X - 6;
const MAP_CELL = 8;
const MSG_Y = VIEW_Y + VH + 8, MSG_H = H - MSG_Y - 6;

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyQ", "KeyE", "KeyZ", "KeyX", "Space", "Enter", "Escape", "KeyP"]);

const COL = { white: "#f8f8f8", yellow: "#f8f048", cyan: "#58e8f8", magenta: "#f858f8", green: "#58f858", gray: "#9898a8", red: "#f85858", orange: "#f89838", blue: "#58a8f8", pink: "#f878b8" };

const TEXT = {
    en: {
        subtitle: "- The Star Well -", newGame: "NEW GAME", cont: "CONTINUE", titleHint: "↑↓ SELECT   SPACE DECIDE",
        overwrite: "Start a new game? Your save will be overwritten at the next auto-save.", yes: "YES", no: "NO",
        hint: "↑↓ MOVE  ← → TURN  Q/E STRAFE  SPACE EXAMINE  X MENU  ESC PAUSE", field: ["MAGIC", "ITEM", "EQUIP"], equipTitle: "EQUIPMENT", spin: "The floor spins you around!", pitAsk: "A pitfall! Jump over it?", autoEquip: (n) => `Sera equipped ${n}! (Change it any time from EQUIP)`, offerBefore: "BEFORE", critLabel: "CRIT", affinityMark: "◎", offerAsk: (n) => `Equip ${n} now?`, offerYes: "EQUIP", offerNo: "LATER", offerTitle: "NEW EQUIPMENT", offerNow: "NOW", offerNew: "NOW", equipped: (n) => `Sera equipped ${n}!`, jump: "JUMP", noLanding: "There is nowhere to land on the other side.", jumped: "Sera leaped over the pit!", pitFall: (n) => `Sera fell into a pit! ${n} damage!`, mimic: "The chest bared its teeth and attacked! It's a Mimic!", learnSpell: (n) => `Sera learned the secret art ${n}!`, theEnd: "THE END", endScore: (n) => `SCORE ${n}`, endTreasure: (n) => `TREASURE ${n}`, altarDone: "The altar is quiet now.", unequip: "(remove)", stat: ["ATK", "DEF", "MAG", "AGI"], equipHint: "↑↓ SELECT  SPACE EQUIP  X BACK", gotEquip: (n) => `Got ${n}!`, floorClear: (n) => `${n} cleared! A commemorative picture will be generated.`, privateClear: "All 5 hearts! A private picture will be generated.", noField: "No spell can be used here.", luminaOn: "A soft light fills the corridor.", luminaOff: "Lumina's light faded.", healF: (n) => `Sera recovers ${n} HP!`, mpF: (n) => `Sera recovers ${n} MP!`, noItemF: "No usable items.", full: "HP is already full.", examine: "SPACE: EXAMINE",
        bump: "A wall blocks the way.", nothing: "Nothing special here.",
        doorOpen: "The door creaks open.", locked: "It's locked.", unlock: "Sera used the Old Key. The door opened!",
        secret: "Part of the wall crumbled away - a hidden passage!", chestOpen: "Sera opened the chest!", chestEmpty: "The chest is empty.",
        gotItem: (n) => `Got ${n}!`, gotGold: (n) => `Got ${n} gold!`, gotHeart: (n) => `Found a Heart! (${n}/5 on this floor)`,
        fountain: "The fountain's light heals Sera completely.", askSave: "Save your progress?", saved: "Progress saved.",
        trap: (n) => `A trap! Spikes shoot up - ${n} damage!`, stairs: "Stairs lead further down. Go down?",
        notYet: "The way further down is still blocked. (In development: floors up to here)",
        arrive: (n) => n, paused: "PAUSE", gameover: "Sera has fallen...", retry: "RETRY FROM LAST SAVE", giveUp: "GIVE UP",
        overTitle: "GAME OVER", toTitle: "SPACE: BACK TO TITLE", noSave: "No save yet - starting from the beginning.",
        hp: "HP", mp: "MP", lv: "LV", gold: "GOLD", keys: "KEY", hearts: "HEART", gems: "GEMS", items: "ITEMS",
    },
    ja: {
        subtitle: "- 星の井戸 -", newGame: "はじめから", cont: "つづきから", titleHint: "↑↓ 選ぶ   SPACE 決定",
        overwrite: "はじめから遊びますか? セーブは次の自動セーブで上書きされます。", yes: "はい", no: "いいえ",
        hint: "↑↓ 移動  ← → 向き  Q/E 横歩き  SPACE 調べる  X メニュー  ESC 一時停止", field: ["まほう", "どうぐ", "そうび"], equipTitle: "そうび", spin: "床がぐるぐると回った!", pitAsk: "落とし穴だ。飛び越えますか?", autoEquip: (n) => `セラは${n}を装備した!(「そうび」でいつでも替えられる)`, offerBefore: "まえ", critLabel: "会心", affinityMark: "◎", offerAsk: (n) => `${n}をすぐに装備しますか?`, offerYes: "装備する", offerNo: "あとで", offerTitle: "あたらしい装備", offerNow: "いま", offerNew: "いま", equipped: (n) => `セラは${n}を装備した!`, jump: "飛び越える", noLanding: "向こう側に着地できる場所がない。", jumped: "セラは落とし穴を飛び越えた!", pitFall: (n) => `落とし穴に落ちた! ${n}のダメージ!`, mimic: "宝箱が牙をむいて襲いかかってきた! ミミックだ!", learnSpell: (n) => `セラは奥義${n}をおぼえた!`, theEnd: "THE END", endScore: (n) => `スコア ${n}`, endTreasure: (n) => `財宝 ${n}`, altarDone: "祭壇は静まりかえっている。", unequip: "(はずす)", stat: ["攻撃", "防御", "魔力", "素早さ"], equipHint: "↑↓ 選ぶ  SPACE 装備  X もどる", gotEquip: (n) => `${n}を手に入れた!`, floorClear: (n) => `${n}を突破した! 記念カットを生成します。`, privateClear: "ハートを5個集めた! プライベート写真を生成します。", noField: "ここで使える魔法がない。", luminaOn: "やわらかな光が通路を照らした。", luminaOff: "ルミナの光が消えた。", healF: (n) => `セラのHPが${n}回復した!`, mpF: (n) => `セラのMPが${n}回復した!`, noItemF: "使える道具がない。", full: "HPはもう満タンだ。", examine: "SPACE: 調べる",
        bump: "壁に阻まれた。", nothing: "特に何もない。",
        doorOpen: "扉がきしみながら開いた。", locked: "鍵がかかっている。", unlock: "セラは古い鍵を使った。扉が開いた!",
        secret: "壁の一部が崩れ落ちた。隠し通路だ!", chestOpen: "セラは宝箱を開けた!", chestEmpty: "宝箱は空っぽだ。",
        gotItem: (n) => `${n}を手に入れた!`, gotGold: (n) => `${n}ゴールドを手に入れた!`, gotHeart: (n) => `ハートを見つけた!(この階 ${n}/5)`,
        fountain: "泉の光がセラの体を包み、すっかり回復した。", askSave: "ここまでの冒険をセーブしますか?", saved: "セーブしました。",
        trap: (n) => `罠だ! 床から針が飛び出した。${n}のダメージ!`, stairs: "下へ続く階段がある。下りますか?",
        notYet: "この先はまだふさがっている。(開発中: ここまでの階です)",
        arrive: (n) => n, paused: "一時停止", gameover: "セラは力尽きた……", retry: "最後のセーブから", giveUp: "あきらめる",
        overTitle: "GAME OVER", toTitle: "SPACE: タイトルへ", noSave: "セーブがないので、はじめから始めます。",
        hp: "HP", mp: "MP", lv: "LV", gold: "ゴールド", keys: "鍵", hearts: "ハート", gems: "宝石", items: "道具",
    },
    zh: {
        subtitle: "- 星之井 -", newGame: "从头开始", cont: "继续游戏", titleHint: "↑↓ 选择   SPACE 确定",
        overwrite: "要从头开始吗? 存档会在下次自动存档时被覆盖。", yes: "是", no: "否",
        hint: "↑↓ 移动  ← → 转向  Q/E 横移  SPACE 调查  X 菜单  ESC 暂停", field: ["魔法", "道具", "装备"], equipTitle: "装备", spin: "地板旋转起来了!", pitAsk: "是陷坑。要跳过去吗?", autoEquip: (n) => `塞拉装备了${n}!(随时可在“装备”中更换)`, offerBefore: "之前", critLabel: "会心", affinityMark: "◎", offerAsk: (n) => `要立刻装备${n}吗?`, offerYes: "装备", offerNo: "稍后", offerTitle: "新装备", offerNow: "现在", offerNew: "现在", equipped: (n) => `塞拉装备了${n}!`, jump: "跳过去", noLanding: "对面没有可以落脚的地方。", jumped: "塞拉跳过了陷坑!", pitFall: (n) => `掉进了陷坑! 受到${n}点伤害!`, mimic: "宝箱露出獠牙扑了过来! 是宝箱怪!", learnSpell: (n) => `塞拉学会了奥义${n}!`, theEnd: "THE END", endScore: (n) => `分数 ${n}`, endTreasure: (n) => `财宝 ${n}`, altarDone: "祭坛已恢复平静。", unequip: "(卸下)", stat: ["攻击", "防御", "魔力", "敏捷"], equipHint: "↑↓ 选择  SPACE 装备  X 返回", gotEquip: (n) => `得到了${n}!`, floorClear: (n) => `突破了${n}! 将生成纪念照。`, privateClear: "集齐了5颗爱心! 将生成私人照片。", noField: "这里没有可用的魔法。", luminaOn: "柔和的光照亮了通道。", luminaOff: "光明的光芒消失了。", healF: (n) => `塞拉恢复了${n}点HP!`, mpF: (n) => `塞拉恢复了${n}点MP!`, noItemF: "没有可用的道具。", full: "HP已经是满的。", examine: "SPACE: 调查",
        bump: "被墙挡住了。", nothing: "没有什么特别的。",
        doorOpen: "门吱呀一声打开了。", locked: "门锁着。", unlock: "塞拉使用了旧钥匙。门打开了!",
        secret: "墙的一部分崩塌了。是隐藏通道!", chestOpen: "塞拉打开了宝箱!", chestEmpty: "宝箱是空的。",
        gotItem: (n) => `得到了${n}!`, gotGold: (n) => `得到了${n}金币!`, gotHeart: (n) => `找到了爱心!(本层 ${n}/5)`,
        fountain: "泉水的光芒包围了塞拉，体力完全恢复了。", askSave: "要保存目前的冒险吗?", saved: "已保存。",
        trap: (n) => `是陷阱! 地上弹出了尖刺。受到${n}点伤害!`, stairs: "有通往下层的楼梯。要下去吗?",
        notYet: "前面的路还被堵着。(开发中: 只做到这一层)",
        arrive: (n) => n, paused: "暂停", gameover: "塞拉倒下了……", retry: "从最后的存档重来", giveUp: "放弃",
        overTitle: "GAME OVER", toTitle: "SPACE: 返回标题", noSave: "没有存档，从头开始。",
        hp: "HP", mp: "MP", lv: "LV", gold: "金币", keys: "钥匙", hearts: "爱心", gems: "宝石", items: "道具",
    },
};

let dataCache = null;
async function loadData() {
    if (!dataCache) {
        const res = await fetch(new URL("./stages.json", import.meta.url));
        dataCache = await res.json();
    }
    return dataCache;
}

function readSave() {
    try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
        return s && s.v === SAVE_VERSION ? s : null;
    } catch { return null; }
}
function writeSave(run) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(run)); return true; } catch { return false; }
}

export async function mount(container, host = {}) {
    const lang = TEXT[host.lang] ? host.lang : "en";
    const tr = (k, ...a) => {
        const v = TEXT[lang][k] ?? TEXT.en[k] ?? k;
        return typeof v === "function" ? v(...a) : v;
    };
    const loc = (obj) => (obj && (obj[lang] || obj.en)) || "";
    const settings = { difficulty: "normal", sound: true, bgm: true, ...(host.settings || {}) };
    const [data] = await Promise.all([loadData(), loadFont()]);
    const floors = data.floors;
    const heroName = loc(data.heroine?.name) || "SERA";
    const audio = createAudio({ sound: settings.sound !== false, bgm: settings.bgm !== false, songs: SONGS });
    const sfx = makeSfx(audio);

    // ---------- DOM ----------
    container.innerHTML = "";
    const root = document.createElement("div");
    root.tabIndex = 0;
    root.style.cssText = "width:100%;height:100%;outline:none;position:relative;overflow:hidden;background:#000;";
    container.appendChild(root);
    const stage = document.createElement("div");
    stage.style.cssText = `position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;transform-origin:0 0;`;
    root.appendChild(stage);
    const glCanvas = document.createElement("canvas");
    glCanvas.width = VIEW_W; glCanvas.height = VIEW_H;
    glCanvas.style.cssText = `position:absolute;left:${VIEW_X}px;top:${VIEW_Y}px;width:${VW}px;height:${VH}px;image-rendering:pixelated;`;
    stage.appendChild(glCanvas);
    const ui = document.createElement("canvas");
    ui.width = W; ui.height = H;
    ui.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;image-rendering:pixelated;`;
    stage.appendChild(ui);
    const g = ui.getContext("2d");
    const fit = () => {
        const s = Math.min(root.clientWidth / W, root.clientHeight / H) || 1;
        stage.style.transform = `scale(${s}) translate(-50%, -50%)`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    fit();

    let alive = true;
    const world = createWorld(glCanvas);
    const magic = createMagic(world);
    const DIFF = {
        easy: { enemyDmg: 0.7, enemyHp: 0.85, enc: 1.4 },
        normal: { enemyDmg: 1, enemyHp: 1, enc: 1 },
        hard: { enemyDmg: 1.3, enemyHp: 1.2, enc: 0.8 },
    }[settings.difficulty] || { enemyDmg: 1, enemyHp: 1, enc: 1 };

    // ---------- 状態 ----------
    // run: セーブする冒険の状態 / ctx: 画面と入力の状態
    let run = null;
    let floor = null;          // 今の階の定義
    let opened = new Set();    // 今の階で開けた物 "x,z"
    let visited = new Set();   // 今の階で歩いたマス
    const ctx = {
        state: "title", paused: false, externalPause: false, finished: false,
        keys: [], msgs: [], msgChars: 0, onMsgsDone: null, ask: null, titleSel: 0, pendingArrive: null, hintT: 0,
        flash: null, menu: null, timers: [], blog: [], foes: null, pops: [], slashT: 0,
    };
    const flashFx = (color, a) => { ctx.flash = { color, a, max: a }; };

    function newRun() {
        const f0 = floors[0];
        return {
            v: SAVE_VERSION, floor: 0, x: f0.start[0], z: f0.start[1], dir: f0.start[2],
            hp: 30, maxHp: 30, mp: 12, maxMp: 12, lv: 1, exp: 0,
            gold: 0, gems: {}, keys: 0, items: { herb: 1 },
            equip: { weapon: "iron_sword", armor: "bronze_armor", acc: null }, bag: ["iron_sword", "bronze_armor"], treasures: {}, loot: {}, finish: {},
            hearts: {}, opened: {}, visited: {}, cleared: [], score: 0, enc: 12, lumina: 0,
        };
    }
    /** 古いセーブに足りない項目を補う */
    function migrate(r) {
        if (!r.equip?.armor) r.equip = { weapon: "iron_sword", armor: "bronze_armor", acc: null };
        if (!Array.isArray(r.bag)) r.bag = Object.values(r.equip).filter(Boolean);
        r.treasures ||= {}; r.loot ||= {}; r.finish ||= {};
        return r;
    }
    /** 今の階の開けた物・歩いたマスを run に書き戻す(セーブの直前に呼ぶ) */
    function syncFloorState() {
        if (!run) return;
        run.opened[run.floor] = [...opened];
        run.visited[run.floor] = [...visited];
        run.x = world.cam.x; run.z = world.cam.z; run.dir = world.cam.dir;
    }
    function save() { syncFloorState(); return writeSave(run); }

    const cellAt = (x, z) => {
        const rows = floor.map;
        return x < 0 || z < 0 || z >= rows.length || x >= rows[0].length ? "#" : rows[z][x];
    };
    const keyOf = (x, z) => `${x},${z}`;
    const objAt = (x, z) => floor.objects?.[keyOf(x, z)] || {};
    function canEnter(x, z) {
        const c = cellAt(x, z);
        if (c === "#" || "TkHFA".includes(c)) return false;
        if ("DL?".includes(c)) return opened.has(keyOf(x, z));
        return true;
    }

    const FLOOR_KEY = [0, -2, 2, -3, 1]; // 探索の曲を階ごとに移調する
    const exploreMusic = () => audio.playMusic("explore", { transpose: FLOOR_KEY[run?.floor || 0] || 0 });
    function enterFloor(idx, pos, { autosave = true } = {}) {
        run.floor = idx;
        floor = floors[idx];
        opened = new Set(run.opened[idx] || []);
        visited = new Set(run.visited[idx] || []);
        const [x, z, dir] = pos || floor.start;
        world.loadFloor(floor.map, floor.theme, (cx, cz) => opened.has(keyOf(cx, cz)), (cx, cz) => objAt(cx, cz));
        world.place(x, z, dir);
        world.setLightBoost((run.lumina || 0) > 0);
        magic.clearEnemies();
        if (!(run.enc > 0)) run.enc = rollEnc();
        visited.add(keyOf(x, z));
        run.x = x; run.z = z; run.dir = dir;
        if (autosave) save();
        ctx.state = "explore";
        ctx.arriveT = 2.2; // 階の名前を大きく出す時間
        exploreMusic();
        // はじめて着いた階の会話(最下層では奥義をおぼえる)
        run.seen ||= [];
        if (!run.seen.includes(idx) && (floor.story?.length || floor.learn || floor.affinity_hint)) {
            run.seen.push(idx);
            const lines = (floor.story || []).map((l) => ({ text: loc(l.text), speaker: l.speaker === "heroine" ? heroName : "" }));
            if (floor.affinity_hint) lines.push({ text: loc(floor.affinity_hint), speaker: heroName });
            if (floor.learn && !(run.learned ||= []).includes(floor.learn)) {
                run.learned.push(floor.learn);
                lines.push({ text: tr("learnSpell", loc(SPELLS[floor.learn].name)) });
                setTimeout(() => sfx("perfect"), 200);
            }
            if (autosave) save();
            ctx.pendingStory = lines;
        }
    }

    // ---------- メッセージ・選択肢 ----------
    function say(lines, onDone) {
        ctx.msgs = (Array.isArray(lines) ? lines : [lines]).map((l) => (typeof l === "string" ? { text: l } : l));
        ctx.msgChars = 0;
        ctx.onMsgsDone = onDone || null;
    }
    function ask(question, options, cb, sel = 0) {
        say(question, () => { ctx.ask = { options, sel, cb }; });
        ctx.msgs[ctx.msgs.length - 1].keep = true; // 選択肢の間も質問を出したまま
    }

    // ---------- 冒険の開始・再開 ----------
    function startNew() {
        try { host.runStart?.(); } catch (e) { console.error("[dungeon] host.runStart failed", e); }
        run = newRun();
        ctx.finished = false;
        enterFloor(0, null, { autosave: true });
        say([...(data.intro || []).map((l) => ({ text: loc(l.text), speaker: l.speaker === "heroine" ? heroName : "" })), ...(ctx.pendingStory || [])]);
        ctx.pendingStory = null;
    }
    function continueSave(s) {
        audio.unlock();
        try { host.runStart?.(); } catch (e) { console.error("[dungeon] host.runStart failed", e); }
        run = migrate(s);
        ctx.finished = false;
        enterFloor(run.floor, [run.x, run.z, run.dir], { autosave: false });
    }
    function gameOver() {
        ctx.state = "gameover";
        world.shake(0.12);
        sfx("playerDown");
        audio.playMusic("gameover");
        ctx.ask = null;
        say(tr("gameover"), () => {
            ctx.ask = {
                options: [tr("retry"), tr("giveUp")], sel: 0, noCancel: true,
                cb: (i) => {
                    if (i === 0) {
                        const s = readSave();
                        if (s) continueSave(s);
                        else { startNew(); say(tr("noSave")); }
                    } else giveUp();
                },
            };
        });
        ctx.msgs[0].keep = true;
    }
    function endingSequence() {
        audio.playMusic("ending");
        flashFx("#fff0a0", 0.8);
        sfx("heal");
        say((data.ending || []).map((l) => ({ text: loc(l.text), speaker: l.speaker === "heroine" ? heroName : "" })), () => {
            ctx.state = "ending";
            ctx.endT = 0;
            if (ctx.finished) return;
            ctx.finished = true;
            save();
            try { host.finish?.(endingResult()); } catch (e) { console.error("[dungeon] host.finish failed", e); }
        });
    }
    /** 集めた財宝・宝石の価値の合計 */
    function treasureValue() {
        let v = 0;
        Object.entries(run.gems || {}).forEach(([id, n]) => { v += (GEMS[id]?.value || 0) * n; });
        Object.entries(run.treasures || {}).forEach(([id, n]) => { v += (TREASURES[id]?.value || 0) * n; });
        return v + run.gold;
    }
    function endingResult() {
        const all = Object.keys(run.loot || {}).flatMap((fi) => topLoot(Number(fi)));
        const rich = treasureValue();
        const pile = rich >= 6000 ? "mountains of gold, jewels everywhere" : rich >= 3000 ? "treasure chests overflowing with gold" : "small pile of treasure";
        const last = floors[floors.length - 1];
        return {
            gameId: GAME_ID, kind: "ending", cleared: true, score: run.score, bonus: false,
            stage: floors.length, stagesTotal: STAGES_TOTAL, stageName: "ALL CLEAR",
            negative: P().negative,
            rewards: buildRewards([P().ending, pile, ...[...new Set(all)].slice(0, 2)].filter(Boolean).join(", "), last.bg, [P().character, equipPrompt()].filter(Boolean).join(", ")),
        };
    }
    function giveUp() {
        ctx.state = "over";
        if (ctx.finished) return;
        ctx.finished = true;
        const result = {
            gameId: GAME_ID, kind: "gameover", cleared: false, score: run.score, bonus: false,
            stage: run.floor + 1, stagesTotal: STAGES_TOTAL, stageName: loc(floor.name),
            negative: [P().negative, P().gameover_negative].filter(Boolean).join(", "),
            rewards: buildRewards(P().gameover, floor.bg, [P().character, equipPrompt()].filter(Boolean).join(", ")),
        };
        try { host.finish?.(result); } catch (e) { console.error("[dungeon] host.finish failed", e); }
    }

    // ---------- 探索の行動 ----------
    function examine() {
        const { x, z } = world.front();
        const c = cellAt(x, z);
        const k = keyOf(x, z);
        if (c === "D" && !opened.has(k)) { opened.add(k); world.open(x, z); sfx("door"); say(tr("doorOpen")); return; }
        if (c === "L" && !opened.has(k)) {
            if (run.keys > 0) { run.keys--; opened.add(k); world.open(x, z); sfx("unlock"); setTimeout(() => sfx("door"), 150); say(tr("unlock")); }
            else { sfx("bump"); say(tr("locked")); }
            return;
        }
        if (c === "?" && !opened.has(k)) { opened.add(k); world.open(x, z); world.shake(0.05); sfx("secret"); say(tr("secret")); return; }
        if (c === "P") {
            ask(tr("pitAsk"), [tr("jump"), tr("no")], (i) => {
                if (i !== 0) return;
                const [dx, dz] = DIRS[world.cam.dir];
                const lx = world.cam.x + dx * 2, lz = world.cam.z + dz * 2;
                if (!canEnter(lx, lz) || cellAt(lx, lz) === "P") { say(tr("noLanding")); return; }
                sfx("jump");
                visited.add(k);
                world.jump(lx, lz);
                ctx.pendingArrive = { x: lx, z: lz };
                ctx.afterJump = true;
            });
            return;
        }
        if ("TkH".includes(c) && objAt(x, z).mimic && !opened.has(k)) {
            // 偽の宝箱: 倒すと中身が手に入る
            sfx("mimic");
            world.shake(0.08);
            flashFx("#ff2020", 0.4);
            say(tr("mimic"), () => startBattle([objAt(x, z).mimic], {
                onWin: () => {
                    opened.add(k);
                    world.open(x, z);
                    sfx("chest");
                    const loot = parseLoot(objAt(x, z).loot);
                    if (loot) { setTimeout(() => sfx("item"), 300); say([tr("chestOpen"), gain(loot)]); }
                },
            }));
            return;
        }
        if ("TkH".includes(c)) {
            if (opened.has(k)) { say(tr("chestEmpty")); return; }
            opened.add(k);
            world.open(x, z);
            sfx("chest");
            const loot = parseLoot(c === "H" ? "heart" : c === "k" ? "key" : objAt(x, z).loot);
            const lines = [tr("chestOpen")];
            if (loot) lines.push(gain(loot));
            setTimeout(() => sfx("item"), 300);
            say(lines);
            return;
        }
        if (c === "A") {
            const bossKey = Object.keys(floor.objects || {}).find((kk) => floor.objects[kk].boss);
            if (bossKey && !opened.has(bossKey)) { say(loc(data.altar_locked)); return; }
            if (ctx.finished) { say(tr("altarDone")); return; }
            endingSequence();
            return;
        }
        if (c === "F") {
            run.hp = run.maxHp; run.mp = run.maxMp;
            sfx("heal");
            flashFx("#78c8ff", 0.5);
            ask([tr("fountain"), tr("askSave")], [tr("yes"), tr("no")], (i) => {
                if (i === 0) { const ok = save(); say(ok ? tr("saved") : "Save failed (storage unavailable)."); }
            });
            return;
        }
        say(tr("nothing"));
    }
    /** 手に入れたものを run に足して、メッセージを返す */
    function gain(loot) {
        const text = gainText(loot);
        return { text, loot };
    }
    function gainText(loot) {
        // この階で手に入れた財宝・宝石・ゴールド(記念カットの小道具になる)
        if (["gold", "gem", "treasure"].includes(loot.kind)) (run.loot[run.floor] ||= []).push(loot);
        if (loot.kind === "gold") { run.gold += loot.amount; run.score += loot.amount; return tr("gotGold", loot.amount); }
        if (loot.kind === "treasure") {
            run.treasures[loot.id] = (run.treasures[loot.id] || 0) + 1;
            run.score += TREASURES[loot.id].value;
            return tr("gotItem", loc(TREASURES[loot.id].name));
        }
        if (loot.kind === "equip") {
            if (!run.bag.includes(loot.id)) run.bag.push(loot.id);
            if (run.equip[EQUIP[loot.id].slot] !== loot.id) (ctx.offerQueue ||= []).push(loot.id);
            return tr("gotEquip", loc(EQUIP[loot.id].name));
        }
        if (loot.kind === "gem") {
            run.gems[loot.id] = (run.gems[loot.id] || 0) + 1;
            run.score += GEMS[loot.id].value;
            return tr("gotItem", loc(GEMS[loot.id].name));
        }
        if (loot.id === "key") { run.keys++; return tr("gotItem", loc(ITEMS.key.name)); }
        if (loot.id === "heart") {
            run.hearts[run.floor] = (run.hearts[run.floor] || 0) + 1;
            run.score += 500;
            return tr("gotHeart", run.hearts[run.floor]);
        }
        run.items[loot.id] = (run.items[loot.id] || 0) + 1;
        return tr("gotItem", loc(ITEMS[loot.id].name));
    }
    /** マスに着いたとき(立て札・罠・階段) */
    function rollEnc() {
        const [a, b] = floor?.encounters?.steps || [10, 20];
        return Math.round((a + Math.random() * (b - a)) * DIFF.enc);
    }
    function arrive(x, z) {
        visited.add(keyOf(x, z));
        const c = cellAt(x, z);
        const k = keyOf(x, z);
        if (run.lumina > 0) { run.lumina--; if (run.lumina === 0) { world.setLightBoost(false); say(tr("luminaOff")); return; } }
        if (c === "B" && !opened.has(k)) {
            const o = objAt(x, z);
            const go = () => startBattle(o.boss ? [o.boss] : o.enemies || ["slime"], { boss: true, key: k });
            if (o.text) say(loc(o.text), go); else go();
            return;
        }
        if (c === "i" && !opened.has(k)) { opened.add(k); say(loc(objAt(x, z).text)); return; }
        if (c === "^" && !opened.has(k)) {
            opened.add(k);
            world.open(x, z);
            const dmg = objAt(x, z).damage || 5;
            run.hp = Math.max(0, run.hp - dmg);
            world.shake(0.1);
            sfx("trap");
            flashFx("#ff2828", 0.5); // 赤く光る
            say(tr("trap", dmg), () => { if (run.hp <= 0) gameOver(); });
            return;
        }
        if (c === "P") {
            // うっかり踏むと落ちる: ダメージを受けて、元のマスへ戻る
            const back = ctx.prevCell || { x: floor.start[0], z: floor.start[1] };
            const dmg = Math.max(1, Math.round((6 + run.floor * 5) * (DIFF.enemyDmg || 1)));
            sfx("fall");
            world.fall(back.x, back.z, () => {
                run.hp = Math.max(0, run.hp - dmg);
                world.shake(0.1);
                flashFx("#000000", 0.6);
                sfx("hurt");
                ctx.pose = { name: "flinch", until: performance.now() + 500 };
                say(tr("pitFall", dmg), () => { if (run.hp <= 0) gameOver(); });
            });
            return;
        }
        if (ctx.afterJump) { ctx.afterJump = false; say(tr("jumped")); }
        if (c === "R") {
            let d = Math.floor(Math.random() * 4);
            if (d === world.cam.dir) d = (d + 1 + Math.floor(Math.random() * 3)) % 4;
            world.spin(d);
            sfx("secret");
            run.spun ||= [];
            if (!run.spun.includes(run.floor)) { run.spun.push(run.floor); say(tr("spin")); }
            return;
        }
        if (c === "S") {
            ask(tr("stairs"), [tr("yes"), tr("no")], (i) => {
                if (i !== 0) return;
                if (run.floor + 1 >= floors.length) { say(tr("notYet")); return; }
                sfx("stairs");
                syncFloorState();
                enterFloor(run.floor + 1, null, { autosave: true });
            });
            return;
        }
        // ランダム遭遇(特別なマスでは起きない)
        const groups = floor.encounters?.groups;
        if (groups?.length && ".@R".includes(c)) {
            run.enc--;
            if (run.enc <= 0) {
                run.enc = rollEnc();
                startBattle(groups[Math.floor(Math.random() * groups.length)]);
            }
        }
    }

    // ---------- バトル ----------
    // 非同期の部品: wait(秒) / pick(種類, 選択肢) / bsay(1行)。ループの dt で進むので一時停止中は止まる
    function wait(sec, skippable = true) { return new Promise((res) => ctx.timers.push({ t: sec, res, skippable })); }
    function pick(kind, options, { cancelable = true, sel = 0 } = {}) {
        let first = sel;
        while (options[first]?.disabled && first < options.length - 1) first++;
        return new Promise((res) => { ctx.menu = { kind, options, sel: first, cancelable, res }; });
    }
    async function bsay(text, sec = 0.8) {
        ctx.blog.push(text);
        if (ctx.blog.length > 3) ctx.blog.shift();
        await wait(sec);
    }
    /** レベル + 装備の強さ(eq を渡すと、その装備にしたときの強さ) */
    function stats(eq = run.equip) {
        const st = baseStats(run.lv);
        st.el = null;
        SLOTS.forEach((sl) => {
            const it = EQUIP[eq[sl]];
            if (!it) return;
            Object.entries(it.stats || {}).forEach(([k, v]) => { st[k] = (st[k] || 0) + v; });
            if (it.el) st.el = it.el;
        });
        st.agi = Math.max(1, st.agi);
        // 階との相性: 相性のよい装備1つごとに会心 +10%(基本 1/16)
        const aff = floor?.affinity || [];
        st.match = SLOTS.filter((sl) => eq[sl] && aff.includes(eq[sl])).length;
        st.crit = 1 / 16 + st.match * 0.1;
        st.critPct = Math.round(st.crit * 100);
        return st;
    }
    const fxEnv = { flash: flashFx, shake: (n) => world.shake(n), sfx: (n) => sfx(n) };
    const battle = createBattle({
        lang, loc, heroName, fx: magic, sfx: (n) => sfx(n), diff: DIFF, fxEnv,
        run: () => run, stats, knownSpells: () => [...knownSpells(run.lv), ...(run.learned || [])], equipMenu: () => equipMenu(),
        say: bsay, clearLog: () => { ctx.blog = []; }, pick, wait, flash: flashFx, shake: (n) => world.shake(n),
        popup: (target, text, color) => {
            ctx.pops.push({ target, text, color, t: 0 });
            if (target === "player" && !String(text).startsWith("+")) ctx.pose = { name: "flinch", until: performance.now() + 450 };
        },
        slash: () => { ctx.slashT = 0.18; },
        setFoes: (f) => { ctx.foes = f; },
        onBossDown: (id, action) => { run.finish[run.floor] = action; },
    });
    async function startBattle(ids, { boss = false, key = null, onWin = null } = {}) {
        if (ctx.state === "battle") return;
        ctx.state = "battle";
        ctx.arriveT = 0;
        ctx.blog = [];
        flashFx("#ffffff", 0.6);
        audio.playMusic(boss ? "boss" : "battle");
        const r = await battle.fight(ids, { boss });
        if (!alive) return;
        ctx.blog = [];
        if (r === "lose") { gameOver(); return; }
        if (r === "win") {
            audio.playMusic("victory", { onEnd: () => { if (ctx.state === "explore" || ctx.state === "menu") exploreMusic(); } });
            ctx.pose = { name: "victory", until: performance.now() + 2600 };
        } else exploreMusic();
        if (r === "win" && onWin) { ctx.state = "explore"; onWin(); return; }
        if (r === "win" && key) {
            opened.add(key);
            const o = objAt(...key.split(",").map(Number));
            const lines = [...(o.after ? [loc(o.after)] : []), ...(o.drops || []).map((d) => parseLoot(d)).filter(Boolean).map((l) => gain(l))];
            if (o.drops?.length) sfx("item");
            // 階のボスを倒したら記念カット(同じ階は1回だけ。セーブから再開しても送り直さない)
            if (!run.cleared.includes(run.floor)) {
                run.cleared.push(run.floor);
                const res = stageResult(run.floor);
                lines.push(res.bonus ? tr("privateClear") : tr("floorClear", loc(floor.name)));
                try { host.stageClear?.(res); } catch (e) { console.error("[dungeon] host.stageClear failed", e); }
            }
            save();
            ctx.state = "explore";
            if (lines.length) say(lines);
            return;
        }
        ctx.state = "explore";
    }

    // ---------- 画像のプロンプト ----------
    const P = () => data.prompts || {};
    function buildRewards(scene, place, character) {
        const out = [];
        const add = (text, source) => { if (text) out.push({ type: "prompt", text, weight: 1, source }); };
        add(P().style, "style");
        add(character, "character");
        add(scene, "scene");
        add(place, "clear");
        return out;
    }
    /** 今の装備のプロンプト(防具・装飾品・武器) */
    const equipPrompt = (eq = run.equip) => ["armor", "acc", "weapon"].map((sl) => EQUIP[eq[sl]]?.prompt).filter(Boolean).join(", ");
    /** その階で手に入れた財宝・宝石のうち価値の高いもの(最大2つ) */
    function topLoot(fi) {
        const list = run.loot[fi] || [];
        const cands = [];
        const gold = list.filter((l) => l.kind === "gold").reduce((s, l) => s + l.amount, 0);
        if (gold >= GOLD_PROMPT.min) cands.push({ value: gold, prompt: GOLD_PROMPT.prompt });
        list.forEach((l) => {
            if (l.kind === "gem") cands.push({ value: GEMS[l.id].value, prompt: GEMS[l.id].prompt });
            if (l.kind === "treasure") cands.push({ value: TREASURES[l.id].value, prompt: TREASURES[l.id].prompt });
        });
        cands.sort((a, b) => b.value - a.value);
        return [...new Set(cands.map((c) => c.prompt))].slice(0, 2);
    }
    /** ボスを倒したときの HP で、記念カットのポーズと表情を変える(立ち絵と同じ区切り) */
    function hpMoodPrompt() {
        const ratio = run.hp / Math.max(1, run.maxHp);
        if (run.hp <= 5) return "kneeling on one knee, sword planted in the ground, exhausted, battle-worn, scratches, relieved smile";
        if (ratio <= 0.25) return "battle-worn, scratches, panting, tired but determined smile";
        if (ratio <= 0.5) return "victory pose, slightly tired smile, sweat";
        return "";
    }
    function finishPrompt(fi) {
        const a = run.finish[fi];
        return SPELLS[a]?.prompt || (a === "attack" ? P().finish_attack : "") || "";
    }
    function stageResult(fi) {
        const f = floors[fi];
        const bonus = (run.hearts[fi] || 0) >= 5 && !!f.private_prompt;
        const charStage = [P().character, equipPrompt()].filter(Boolean).join(", ");
        const rewards = bonus
            ? buildRewards([f.private_prompt, EQUIP[run.equip.weapon] ? "weapon leaning against the wall" : ""].filter(Boolean).join(", "), "", P().character_private || P().character)
            : buildRewards([hpMoodPrompt() || P().victory, finishPrompt(fi), ...topLoot(fi)].filter(Boolean).join(", "), f.boss_bg || f.bg, charStage);
        return {
            gameId: GAME_ID, kind: "stage", cleared: true, score: run.score, bonus,
            items: run.hearts[fi] || 0, itemsTotal: 5, stage: fi + 1, stagesTotal: STAGES_TOTAL, stageName: loc(f.name),
            negative: [P().negative, bonus ? P().private_negative : ""].filter(Boolean).join(", "), rewards,
        };
    }

    // ---------- 手に入れた装備をすぐに着る ----------
    function offerEquip(id) {
        // 手に入れた装備は自動で装備する(前の装備は持ち物に残るので「そうび」で戻せる)
        const it = EQUIP[id];
        if (!it || run.equip[it.slot] === id) return;
        const prev = { ...run.equip };
        run.equip[it.slot] = id;
        ctx.offer = { id, slot: it.slot, prev };
        ctx.dressT = 1.2;                                                  // キラキラ
        ctx.pose = { name: "victory", until: performance.now() + 2200 };
        sfx("unlock");
        setTimeout(() => sfx("heal"), 120);
        say(tr("autoEquip", loc(it.name)), () => { ctx.offer = null; });
    }
    function drawOffer() {
        const o = ctx.offer;
        if (!o) return;
        const now = o.prev, next = run.equip;
        const x0 = VIEW_X + 4, y0 = VIEW_Y + 4, w0 = VW - 8, h0 = VH - 8;
        frame(x0, y0, w0, h0);
        text(tr("offerTitle"), x0 + w0 / 2, y0 + 6, 16, COL.yellow, "center");
        const t = performance.now() / 1000;
        const st = seraState();
        // 左: いま / 右: 装備すると
        text(tr("offerBefore"), x0 + 90, y0 + 24, 12, COL.gray, "center");
        drawSera(g, x0 + 30, y0 + 38, 3, eqDefs(now), t, { ...st, pose: "stand" });
        text(tr("offerNew"), x0 + w0 - 90, y0 + 24, 12, COL.yellow, "center");
        // 新しい装備の後ろに光
        g.globalAlpha = 0.18 + 0.1 * Math.sin(t * 4);
        g.fillStyle = "#f8f0a0"; g.fillRect(x0 + w0 - 150, y0 + 34, 120, 186);
        g.globalAlpha = 1;
        drawSera(g, x0 + w0 - 150, y0 + 38, 3, eqDefs(next), t, { ...st, pose: Math.floor(t * 1.2) % 3 === 0 ? "victory" : st.pose });
        // 矢印と強さの増減
        shadowText("▶", x0 + w0 / 2, y0 + 120, 28, COL.yellow, "center");
        const a = stats(now), b = stats(next);
        [...tr("stat"), tr("critLabel")].forEach((lab, i) => {
            const k = ["atk", "def", "mag", "agi", "critPct"][i];
            const d = b[k] - a[k];
            const y = y0 + 150 + i * 18;
            text(`${lab}`, x0 + w0 / 2 - 44, y, 12, COL.gray);
            text(`${b[k]}${k === "critPct" ? "%" : ""}`, x0 + w0 / 2 + 20, y, 12, COL.white, "right");
            if (d) text(d > 0 ? `+${d}` : `${d}`, x0 + w0 / 2 + 50, y, 12, d > 0 ? COL.green : COL.red, "right");
        });
        // 装備の絵
        drawItemIcon(g, x0 + w0 / 2 - 24, y0 + 40, 3, { kind: "equip", id: o.id });
    }

    // ---------- そうび ----------
    async function equipMenu() {
        let slotSel = 0;
        for (;;) {
            const opts = SLOTS.map((sl) => ({ label: loc(SLOT_NAMES[sl]), right: run.equip[sl] ? loc(EQUIP[run.equip[sl]].name) : "—", slot: sl }));
            const k = await pick("equipSlot", opts, { sel: slotSel });
            if (k < 0) return;
            slotSel = k;
            const slot = SLOTS[k];
            const aff = floor?.affinity || [];
            const items = run.bag.filter((id) => EQUIP[id]?.slot === slot).map((id) => ({ label: loc(EQUIP[id].name) + (aff.includes(id) ? " " + tr("affinityMark") : ""), id, slot, on: run.equip[slot] === id }));
            if (slot === "acc") items.push({ label: tr("unequip"), id: null, slot, on: !run.equip.acc });
            const j = await pick("equipItem", items, { sel: Math.max(0, items.findIndex((o) => o.on)) });
            if (j >= 0) { run.equip[slot] = items[j].id; sfx("unlock"); }
        }
    }
    /** そうび画面で選んでいる装備にしたときの装備一式(立ち絵と強さの予告) */
    function previewEquip() {
        const m = ctx.menu;
        if (m?.kind === "equipItem") { const o = m.options[m.sel]; return { ...run.equip, [o.slot]: o.id }; }
        return run.equip;
    }
    const eqDefs = (eq) => ({ weapon: EQUIP[eq.weapon] || null, armor: EQUIP[eq.armor] || null, acc: EQUIP[eq.acc] || null });
    /** 立ち絵の状態: HP で表情とポーズ、勝ったとき・攻撃を受けたときは一時的なポーズ、ときどきまばたき */
    function seraState(extra = {}) {
        const now = performance.now();
        const pose = ctx.pose && now < ctx.pose.until ? ctx.pose.name : "stand";
        return { hp: run.hp, maxHp: run.maxHp, pose, blink: Math.floor(now / 110) % 30 === 0, ...extra };
    }

    // ---------- フィールドのメニュー(X) ----------
    async function fieldMenu() {
        ctx.state = "menu";
        try {
            const c = await pick("field", tr("field").map((label) => ({ label })));
            if (c === 0) {
                const list = knownSpells(run.lv).filter((id) => SPELLS[id].field);
                if (!list.length) { say(tr("noField")); return; }
                const k = await pick("spell", list.map((id) => ({ label: loc(SPELLS[id].name), right: `${SPELLS[id].mp}`, disabled: run.mp < SPELLS[id].mp })));
                if (k < 0) return;
                const id = list[k], sp = SPELLS[id];
                if (sp.heal && run.hp >= run.maxHp) { say(tr("full")); return; }
                run.mp -= sp.mp;
                const t = magic.cast(id, [], fxEnv);
                await wait(t, false);
                if (sp.heal) { const n = Math.min(sp.heal + Math.round(stats().mag * 0.5), run.maxHp - run.hp); run.hp += n; ctx.pops.push({ target: "player", text: `+${n}`, color: COL.green, t: 0 }); say(tr("healF", n)); }
                if (sp.light) { run.lumina = sp.light; world.setLightBoost(true); say(tr("luminaOn")); }
            } else if (c === 2) {
                await equipMenu();
            } else if (c === 1) {
                const list = Object.keys(run.items).filter((id) => run.items[id] > 0 && ITEMS[id]?.type === "use");
                if (!list.length) { say(tr("noItemF")); return; }
                const k = await pick("item", list.map((id) => ({ label: loc(ITEMS[id].name), right: `×${run.items[id]}` })));
                if (k < 0) return;
                const it = ITEMS[list[k]];
                run.items[list[k]]--;
                sfx("heal");
                flashFx("#80ffb0", 0.3);
                if (it.hp) { const n = Math.min(it.hp, run.maxHp - run.hp); run.hp += n; say(tr("healF", n)); }
                if (it.mp) { const n = Math.min(it.mp, run.maxMp - run.mp); run.mp += n; say(tr("mpF", n)); }
            }
        } finally {
            if (ctx.state === "menu") ctx.state = "explore";
        }
    }
    const interactable = () => {
        const { x, z } = world.front();
        const c = cellAt(x, z);
        if ("TkHFAP".includes(c)) return true;
        return (c === "D" || c === "L") && !opened.has(keyOf(x, z)); // 隠し壁は教えない
    };

    // ---------- 入力 ----------
    const onKey = (e) => {
        e.stopPropagation();
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        if (e.type !== "keydown") return;
        audio.unlock();
        const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyQ: "q", KeyE: "e", Space: "ok", Enter: "ok", KeyZ: "ok", KeyX: "cancel", Escape: "pause", KeyP: "pause" };
        const a = map[e.code];
        if (!a) return;
        if (e.repeat && !["up", "down", "q", "e", "left", "right"].includes(a)) return;
        if (ctx.keys.length < 3) ctx.keys.push(a);
    };
    container.addEventListener("keydown", onKey);
    container.addEventListener("keyup", onKey);
    const focusRoot = () => { try { root.focus({ preventScroll: true }); } catch { /* ignore */ } };

    function handleInput() {
        const a = ctx.keys.shift();
        if (!a) return;
        // バトルやメニューの選択肢
        if (ctx.menu) {
            const m = ctx.menu, n = m.options.length;
            const move = (d) => { let i = m.sel; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!m.options[i].disabled) break; } if (i !== m.sel) { m.sel = i; sfx("cursor"); } };
            if (a === "up" || (a === "left" && m.kind === "target")) move(-1);
            else if (a === "down" || (a === "right" && m.kind === "target")) move(1);
            else if (a === "ok") { if (m.options[m.sel]?.disabled) { sfx("bump"); return; } ctx.menu = null; sfx("cursor"); m.res(m.sel); }
            else if (a === "cancel" && m.cancelable) { ctx.menu = null; sfx("cursor"); m.res(-1); }
            return;
        }
        // バトルのメッセージは SPACE で早送り
        if (ctx.timers.length && (a === "ok" || a === "cancel") && !ctx.msgs.length && !ctx.ask) {
            ctx.timers.forEach((tm) => { if (tm.skippable) tm.t = 0; });
            return;
        }
        // 一時停止
        if (a === "pause" && ["explore"].includes(ctx.state) && !ctx.msgs.length && !ctx.ask) { ctx.paused = !ctx.paused; return; }
        if (ctx.paused) { if (a === "pause" || a === "ok" || a === "cancel") ctx.paused = false; return; }
        // 選択肢
        if (ctx.ask) {
            const q = ctx.ask;
            if (a === "up" || a === "left") { q.sel = (q.sel + q.options.length - 1) % q.options.length; sfx("cursor"); }
            else if (a === "down" || a === "right") { q.sel = (q.sel + 1) % q.options.length; sfx("cursor"); }
            else if (a === "ok" || (a === "cancel" && !q.noCancel)) {
                const sel = a === "cancel" ? q.options.length - 1 : q.sel;
                ctx.ask = null;
                ctx.msgs = [];
                sfx("cursor");
                q.cb(sel);
            }
            return;
        }
        // メッセージ送り
        if (ctx.msgs.length) {
            if (a !== "ok" && a !== "cancel") return;
            const m = ctx.msgs[0];
            if (ctx.msgChars < m.text.length) { ctx.msgChars = m.text.length; return; }
            if (m.keep) return; // 選択肢を出すメッセージ(全部表示されたら自動で選択肢が出る)
            ctx.msgs.shift();
            ctx.msgChars = 0;
            if (!ctx.msgs.length) { const done = ctx.onMsgsDone; ctx.onMsgsDone = null; done?.(); }
            return;
        }
        if (ctx.state === "title") {
            const hasSave = !!readSave();
            if (a === "up" || a === "down") { ctx.titleSel = 1 - ctx.titleSel; sfx("cursor"); }
            else if (a === "ok") {
                sfx("cursor");
                if (ctx.titleSel === 1) {
                    const s = readSave();
                    if (s) continueSave(s); else { sfx("bump"); }
                } else if (hasSave) {
                    ask(tr("overwrite"), [tr("yes"), tr("no")], (i) => { if (i === 0) startNew(); }, 1);
                } else startNew();
            }
            return;
        }
        if (ctx.state === "over") { if (a === "ok") { ctx.state = "title"; ctx.titleSel = readSave() ? 1 : 0; audio.playMusic("title"); } return; }
        if (ctx.state === "ending") { if (a === "ok" && ctx.endT > 2) { ctx.state = "title"; ctx.titleSel = readSave() ? 1 : 0; audio.playMusic("title"); } return; }
        if (ctx.state !== "explore") return;
        if (world.busy()) { if (["up", "down", "q", "e", "left", "right"].includes(a)) ctx.keys.unshift(a); return; }
        let r = null;
        ctx.prevCell = { x: world.cam.x, z: world.cam.z };
        if (a === "up") r = world.step(1, 0, canEnter);
        else if (a === "down") r = world.step(-1, 0, canEnter);
        else if (a === "q") r = world.step(0, -1, canEnter);
        else if (a === "e") r = world.step(0, 1, canEnter);
        else if (a === "left") world.turn(-1);
        else if (a === "right") world.turn(1);
        else if (a === "ok") examine();
        else if (a === "cancel") { sfx("cursor"); fieldMenu(); }
        if (r && !r.ok) { sfx("bump"); ctx.hintT = 0; }
        if (r && r.ok) { sfx("step"); ctx.pendingArrive = { x: r.x, z: r.z }; }
    }

    // ---------- 描画(Canvas 2D) ----------
    const font = (size) => `${size}px "${FONT_NAME}", monospace`;
    function frame(x, y, w, h) {
        g.fillStyle = "#000010";
        g.fillRect(x, y, w, h);
        g.strokeStyle = COL.white; g.lineWidth = 2;
        g.strokeRect(x + 1, y + 1, w - 2, h - 2);
        g.strokeStyle = "#5858a8";
        g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    }
    function text(str, x, y, size = 16, color = COL.white, align = "left") {
        g.font = font(size); g.fillStyle = color; g.textAlign = align; g.textBaseline = "top";
        g.fillText(str, x, y);
        g.textAlign = "left";
    }
    function shadowText(str, x, y, size, color, align = "left") {
        text(str, x + 2, y + 2, size, "#000", align);
        text(str, x, y, size, color, align);
    }
    /** 折り返し(日本語・中国語は1文字ずつ、英語は単語ごと) */
    function wrap(str, maxW, size) {
        g.font = font(size);
        const out = [];
        let line = "";
        const tokens = /[a-zA-Z]/.test(str) && lang === "en" ? str.split(/(\s+)/) : [...str];
        for (const t of tokens) {
            if (g.measureText(line + t).width > maxW && line) { out.push(line.trimEnd()); line = t.trimStart(); }
            else line += t;
        }
        if (line) out.push(line);
        return out;
    }
    function bar(x, y, w, v, max, color) {
        g.fillStyle = "#202038"; g.fillRect(x, y, w, 6);
        g.fillStyle = color; g.fillRect(x, y, Math.round(w * Math.min(1, Math.max(0, v) / max)), 6);
    }

    // タイトル画面(title.js): 夜空・星の井戸・たいまつ・セラ(セーブがあればその装備)・金色のロゴ
    const titleScene = createTitle();
    let titleEq = null, titleEqAt = 0, titleHasSave = false;
    function drawTitle() {
        const now = performance.now();
        if (!titleEq || now - titleEqAt > 1000) { // セーブは1秒ごとに読み直す(毎フレーム localStorage を読まない)
            const sv = readSave();
            titleEq = eqDefs(sv?.equip || { weapon: "iron_sword", armor: "bronze_armor", acc: null });
            titleHasSave = !!sv;
            titleEqAt = now;
        }
        const hasSave = titleHasSave;
        titleScene.draw(g, now / 1000, {
            W, H, font, eq: titleEq, state: { pose: Math.floor(now / 1000) % 9 === 0 ? "victory" : "stand", blink: Math.floor(now / 110) % 30 === 0 },
            labels: [tr("newGame"), tr("cont")], sel: ctx.titleSel, disabled: [false, !hasSave],
            subtitle: tr("subtitle"), hint: tr("titleHint"),
        });
    }

    function drawMap() {
        const rows = floor.map, mh = rows.length, mw = rows[0].length;
        const fx = SIDE_X, fy = VIEW_Y - 2, fw = SIDE_W, fh = mh * MAP_CELL + 16;
        frame(fx, fy, fw, fh);
        const c = MAP_CELL, ox = fx + Math.floor((fw - mw * c) / 2), oy = fy + 8;
        for (const key of visited) {
            const [x, z] = key.split(",").map(Number);
            g.fillStyle = "#283068";
            g.fillRect(ox + x * c, oy + z * c, c, c);
            const ch = cellAt(x, z);
            if (ch === "S") { g.fillStyle = COL.yellow; g.fillRect(ox + x * c + 3, oy + z * c + 3, 4, 4); }
            if (ch === "^" && opened.has(key)) { g.fillStyle = COL.red; g.fillRect(ox + x * c + 3, oy + z * c + 3, 4, 4); }
            if (ch === "R") { g.fillStyle = COL.magenta; g.fillRect(ox + x * c + 2, oy + z * c + 2, 3, 3); }
            if (ch === "P") { g.fillStyle = "#000000"; g.fillRect(ox + x * c + 1, oy + z * c + 1, c - 2, c - 2); g.strokeStyle = COL.red; g.lineWidth = 1; g.strokeRect(ox + x * c + 1.5, oy + z * c + 1.5, c - 3, c - 3); }
            g.fillStyle = "#c8c8f8";
            DIRS.forEach(([dx, dz], d) => {
                const n = cellAt(x + dx, z + dz), nk = keyOf(x + dx, z + dz);
                const wall = n === "#" || (n === "?" && !opened.has(nk));
                const door = "DL".includes(n) || (n === "?" && opened.has(nk));
                const thing = "TkHFA".includes(n);
                if (n === "P") { g.fillStyle = "#000000"; g.fillRect(ox + (x + dx) * c + 1, oy + (z + dz) * c + 1, c - 2, c - 2); g.strokeStyle = COL.red; g.lineWidth = 1; g.strokeRect(ox + (x + dx) * c + 1.5, oy + (z + dz) * c + 1.5, c - 3, c - 3); }
                if (thing) { // 宝箱・泉は隣のマスに印
                    g.fillStyle = n === "F" ? COL.blue : n === "H" ? COL.pink : n === "A" ? COL.yellow : COL.orange;
                    if (!opened.has(nk) || n === "F" || n === "A") g.fillRect(ox + (x + dx) * c + 3, oy + (z + dz) * c + 3, 4, 4);
                    else { g.fillStyle = "#505070"; g.fillRect(ox + (x + dx) * c + 3, oy + (z + dz) * c + 3, 4, 4); }
                    g.fillStyle = "#c8c8f8";
                }
                if (!wall && !door) return;
                g.fillStyle = door ? COL.orange : "#c8c8f8";
                const len = door ? 4 : c, off = door ? 3 : 0;
                if (d === 0) g.fillRect(ox + x * c + off, oy + z * c, len, 1);
                if (d === 1) g.fillRect(ox + x * c + c - 1, oy + z * c + off, 1, len);
                if (d === 2) g.fillRect(ox + x * c + off, oy + z * c + c - 1, len, 1);
                if (d === 3) g.fillRect(ox + x * c, oy + z * c + off, 1, len);
                g.fillStyle = "#c8c8f8";
            });
        }
        const px = ox + world.cam.fx * c + c / 2, pz = oy + world.cam.fz * c + c / 2;
        const a = -world.cam.fa;
        g.fillStyle = COL.yellow;
        g.beginPath();
        g.moveTo(px + Math.sin(a) * 4.5, pz - Math.cos(a) * 4.5);
        g.lineTo(px + Math.sin(a + 2.4) * 4, pz - Math.cos(a + 2.4) * 4);
        g.lineTo(px + Math.sin(a - 2.4) * 4, pz - Math.cos(a - 2.4) * 4);
        g.fill();
        return fy + fh;
    }

    function drawStatus(top) {
        const fx = SIDE_X, fy = top + 6, fw = SIDE_W, fh = H - fy - 6;
        frame(fx, fy, fw, fh);
        const x = fx + 10;
        text(heroName, x, fy + 10, 16, COL.blue);
        text(`${tr("lv")} ${run.lv}`, fx + fw - 10, fy + 10, 16, COL.white, "right");
        // 立ち絵(装備で変わる)
        drawSera(g, fx + 6, fy + 30, 2, eqDefs(run.equip), performance.now() / 1000, seraState());
        if (ctx.dressT > 0) { // 着替えたときのキラキラ
            const e = ctx.dressT / 1.2;
            for (let i = 0; i < 14; i++) {
                const a = i / 14 * Math.PI * 2 + (1 - e) * 4;
                const rr = 30 + (1 - e) * 30;
                const sx = fx + 46 + Math.cos(a) * rr * 0.8, sy = fy + 90 + Math.sin(a) * rr * 1.2;
                g.globalAlpha = e;
                g.fillStyle = i % 2 ? "#ffffff" : "#f8e070";
                g.fillRect(sx - 1, sy - 3, 2, 6); g.fillRect(sx - 3, sy - 1, 6, 2);
            }
            g.globalAlpha = 1;
        }
        const rx = fx + 92, rw = fw - 100;
        let y = fy + 34;
        text(`${tr("hp")} ${run.hp}`, rx, y, 12, run.hp <= run.maxHp / 4 ? COL.red : COL.white);
        bar(rx, y + 14, rw, run.hp, run.maxHp, run.hp <= run.maxHp / 4 ? COL.red : COL.green);
        y += 24;
        text(`${tr("mp")} ${run.mp}`, rx, y, 12);
        bar(rx, y + 14, rw, run.mp, run.maxMp, COL.cyan);
        y += 28;
        const st = stats();
        tr("stat").forEach((lab, i) => { text(`${lab} ${[st.atk, st.def, st.mag, st.agi][i]}`, rx, y + i * 13, 12, COL.gray); });
        text(`${tr("critLabel")} ${st.critPct}%`, rx, y + 4 * 13, 12, st.match ? COL.yellow : COL.gray); // 階と相性のよい装備があると黄色
        y = fy + 30 + 122;
        text(`${tr("gold")} ${run.gold}`, x, y, 12, COL.yellow);
        text(`${tr("keys")} ${run.keys}  ♥${run.hearts[run.floor] || 0}/5`, fx + fw - 10, y, 12, COL.pink, "right");
        y += 16;
        const gems = [...Object.entries(run.gems).map(([id, n]) => `${loc(GEMS[id].name)}${n > 1 ? "×" + n : ""}`), ...Object.entries(run.treasures || {}).map(([id, n]) => `${loc(TREASURES[id].name)}${n > 1 ? "×" + n : ""}`)].join(" ");
        if (gems) { wrap(gems, fw - 20, 12).slice(0, 2).forEach((l) => { text(l, x, y, 12, COL.magenta); y += 15; }); }
        const items = Object.entries(run.items).filter(([, n]) => n > 0).map(([id, n]) => `${loc(ITEMS[id].name)}×${n}`).join(" ");
        if (items && y < H - 24) text(items, x, y, 12, COL.gray);
    }

    function drawMessage() {
        frame(VIEW_X - 2, MSG_Y, VW + 4, MSG_H);
        const tx = VIEW_X + 12, ty = MSG_Y + 12, maxW = VW - 20;
        // 手に入れたものの絵(メッセージにつく)
        const lm = ctx.msgs[0];
        if (lm?.loot && ctx.state !== "battle") {
            const bx = VIEW_X + VW / 2 - 56, by = VIEW_Y + 40;
            frame(bx, by, 112, 112);
            g.globalAlpha = 0.35 + 0.15 * Math.sin(performance.now() / 150);
            g.fillStyle = "#f8f0a0"; g.fillRect(bx + 14, by + 14, 84, 84);
            g.globalAlpha = 1;
            drawItemIcon(g, bx + 16, by + 16, 5, lm.loot);
        }
        if (ctx.state === "battle" && !ctx.msgs.length) {
            ctx.blog.forEach((l, i) => text(l, tx, ty + i * 22, 16));
        } else if (ctx.msgs.length) {
            const m = ctx.msgs[0];
            let y = ty;
            if (m.speaker) { text(m.speaker, tx, y, 14, COL.blue); y += 18; }
            const shown = m.text.slice(0, Math.floor(ctx.msgChars));
            wrap(shown, ctx.ask ? maxW - 120 : maxW, 16).slice(0, m.speaker ? 2 : 3).forEach((l, i) => text(l, tx, y + i * 22, 16));
            if (!ctx.ask && ctx.msgChars >= m.text.length && Math.floor(performance.now() / 300) % 2) text("▼", VIEW_X + VW - 18, MSG_Y + MSG_H - 22, 14, COL.yellow);
        } else if (ctx.state === "explore") {
            wrap(tr("hint"), maxW, 13).slice(0, 2).forEach((l, i) => text(l, tx, ty + i * 18, 13, COL.gray));
            if (interactable()) text(tr("examine"), tx, ty + 42, 16, COL.yellow);
        }
        if (ctx.ask) {
            const q = ctx.ask;
            const bw = 120, bx = VIEW_X + VW - bw - 6, by = MSG_Y - q.options.length * 24 - 14;
            const wide = q.options.some((o) => o.length > 6);
            const w2 = wide ? 220 : bw;
            frame(bx - (w2 - bw), by, w2, q.options.length * 24 + 16);
            q.options.forEach((o, i) => text((q.sel === i ? "▶ " : "  ") + o, bx - (w2 - bw) + 12, by + 10 + i * 24, 16, q.sel === i ? COL.white : COL.gray));
        }
    }

    function draw() {
        g.clearRect(0, 0, W, H);
        if (ctx.state === "title") { glCanvas.style.visibility = "hidden"; drawTitle(); if (ctx.msgs.length || ctx.ask) drawMessage(); return; }
        glCanvas.style.visibility = "visible";
        g.strokeStyle = COL.white; g.lineWidth = 2;
        g.strokeRect(VIEW_X - 1, VIEW_Y - 1, VW + 2, VH + 2);
        // 色のフラッシュ(泉・罠・魔法・被弾)
        if (ctx.flash && ctx.flash.a > 0) {
            g.globalAlpha = Math.min(0.6, ctx.flash.a);
            g.fillStyle = ctx.flash.color;
            g.fillRect(VIEW_X, VIEW_Y, VW, VH);
            g.globalAlpha = 1;
        }
        // 斬撃
        if (ctx.slashT > 0) {
            const e = 1 - ctx.slashT / 0.18;
            g.strokeStyle = "#ffffff"; g.lineWidth = 4;
            g.beginPath();
            g.moveTo(VIEW_X + VW * (0.62 - e * 0.3), VIEW_Y + VH * (0.15 + e * 0.1));
            g.lineTo(VIEW_X + VW * (0.38 - e * 0.1), VIEW_Y + VH * (0.75 + e * 0.05));
            g.stroke();
        }
        if (ctx.state === "battle") drawBattle();
        // 階の名前
        if (ctx.state === "battle") { /* バトル中は敵の名前を上に出す */ }
        else if (ctx.arriveT > 0) {
            g.globalAlpha = Math.min(1, ctx.arriveT);
            shadowText(loc(floor.name), VIEW_X + VW / 2, VIEW_Y + VH / 2 - 20, 28, COL.yellow, "center");
            g.globalAlpha = 1;
        } else shadowText(loc(floor.name), VIEW_X + 8, VIEW_Y + 6, 12, COL.gray);
        const mapBottom = drawMap();
        drawStatus(mapBottom);
        // 3D ビューにかぶせる表示(一時停止・ゲームオーバー)は、メッセージと選択肢より先に描く
        if (ctx.paused || ctx.externalPause) {
            g.fillStyle = "rgba(0,0,16,0.6)"; g.fillRect(VIEW_X, VIEW_Y, VW, VH);
            shadowText(tr("paused"), VIEW_X + VW / 2, VIEW_Y + VH / 2 - 16, 32, COL.yellow, "center");
        }
        if (ctx.state === "gameover" || ctx.state === "over") {
            g.fillStyle = "rgba(40,0,0,0.55)"; g.fillRect(VIEW_X, VIEW_Y, VW, VH);
            shadowText(tr("overTitle"), VIEW_X + VW / 2, VIEW_Y + VH / 2 - 50, 40, COL.red, "center");
            if (ctx.state === "over") shadowText(tr("toTitle"), VIEW_X + VW / 2, VIEW_Y + VH / 2 + 10, 16, COL.white, "center");
        }
        drawOffer();
        drawMessage();
        drawMenu();
        if (ctx.state === "ending") drawEnding();
    }

    function drawEnding() {
        const a = Math.min(1, (ctx.endT || 0) / 1.5);
        g.globalAlpha = a * 0.85;
        g.fillStyle = "#000010"; g.fillRect(0, 0, W, H);
        g.globalAlpha = a;
        for (let i = 0; i < 70; i++) {
            const x = (i * 97 + 13) % W, y = ((i * 53) % H + (ctx.endT || 0) * (10 + (i % 5) * 6)) % H;
            g.fillStyle = i % 4 ? "#e8e8ff" : "#f8e070";
            g.fillRect(x, y, 2, 2);
        }
        drawSera(g, W / 2 - 60, 60, 3, eqDefs(run.equip), performance.now() / 1000, seraState({ pose: "victory" }));
        shadowText(tr("theEnd"), W / 2, 260, 40, COL.yellow, "center");
        shadowText(tr("endScore", run.score), W / 2, 312, 18, COL.white, "center");
        shadowText(tr("endTreasure", treasureValue()), W / 2, 336, 16, COL.cyan, "center");
        if ((ctx.endT || 0) > 2) shadowText(tr("toTitle"), W / 2, 368, 14, COL.gray, "center");
        g.globalAlpha = 1;
    }

    function drawBattle() {
        const foes = ctx.foes;
        if (foes) {
            // 敵の名前(上)。ボスは HP のバー
            const names = foes.filter((f) => f.alive).map((f) => f.label).join("   ");
            shadowText(names, VIEW_X + VW / 2, VIEW_Y + 8, 14, COL.white, "center");
            const boss = foes.find((f) => f.def.boss && f.alive);
            if (boss) bar(VIEW_X + VW / 2 - 80, VIEW_Y + 28, 160, boss.hp, boss.maxHp, boss.raged ? COL.red : COL.orange);
            // 目標の選択: ▼
            if (ctx.menu?.kind === "target") {
                const fi = ctx.menu.options[ctx.menu.sel].foe;
                const p = magic.project(fi);
                if (p && Math.floor(performance.now() / 200) % 2) shadowText("▼", VIEW_X + p.x * VW, VIEW_Y + p.y * VH - 22, 18, COL.yellow, "center");
            }
        }
        // ダメージの数字
        ctx.pops.forEach((pp) => {
            let x, y;
            if (pp.target === "player") { x = VIEW_X + VW / 2; y = VIEW_Y + VH - 40; }
            else { const p = magic.project(pp.target, false); if (!p) return; x = VIEW_X + p.x * VW; y = VIEW_Y + p.y * VH; }
            y -= pp.t * 40;
            g.globalAlpha = Math.max(0, 1 - Math.max(0, pp.t - 0.5) * 2);
            shadowText(pp.text, x, y, 20, pp.color, "center");
            g.globalAlpha = 1;
        });
    }

    function drawEquip() {
        const m = ctx.menu;
        const x0 = VIEW_X + 4, y0 = VIEW_Y + 4, w0 = VW - 8, h0 = VH - 8;
        frame(x0, y0, w0, h0);
        text(tr("equipTitle"), x0 + 14, y0 + 12, 16, COL.yellow);
        const eq = previewEquip();
        // 立ち絵(大きく)
        drawSera(g, x0 + w0 - 40 * 3 - 18, y0 + 14, 3, eqDefs(eq), performance.now() / 1000, seraState());
        // 装備の枠
        let y = y0 + 40;
        SLOTS.forEach((sl, i) => {
            const active = (m.kind === "equipSlot" && m.sel === i) || (m.kind === "equipItem" && m.options[0]?.slot === sl);
            text((active ? "▶ " : "  ") + loc(SLOT_NAMES[sl]), x0 + 12, y, 14, active ? COL.white : COL.gray);
            text(eq[sl] ? loc(EQUIP[eq[sl]].name) : "—", x0 + 100, y, 14, eq[sl] !== run.equip[sl] ? COL.yellow : COL.cyan);
            y += 22;
        });
        // 持っている装備(選んでいる枠)
        if (m.kind === "equipItem") {
            y += 6;
            m.options.forEach((o, i) => {
                text((m.sel === i ? "▶ " : "  ") + o.label + (o.on ? " E" : ""), x0 + 24, y, 14, m.sel === i ? COL.white : COL.gray);
                y += 18;
            });
        }
        // 強さ(変わる値は色付き)
        const now = stats(), next = stats(eq);
        const sx = x0 + w0 - 40 * 3 - 10, sy = y0 + 14 + 60 * 3 + 6; // 立ち絵の下
        tr("stat").forEach((lab, i) => {
            const k = ["atk", "def", "mag", "agi"][i];
            const d = next[k] - now[k];
            const cx = sx + (i % 2) * 64, cy = sy + Math.floor(i / 2) * 18;
            text(`${lab} ${next[k]}`, cx, cy, 12, COL.white);
            if (d) text(d > 0 ? `+${d}` : `${d}`, cx + 60, cy, 12, d > 0 ? COL.green : COL.red, "right");
        });
        {
            const d = next.critPct - now.critPct;
            text(`${tr("critLabel")} ${next.critPct}%`, sx, sy + 36, 12, next.match ? COL.yellow : COL.white);
            if (d) text(d > 0 ? `+${d}` : `${d}`, sx + 124, sy + 36, 12, d > 0 ? COL.green : COL.red, "right");
        }
        text(tr("equipHint"), x0 + 12, y0 + h0 - 18, 12, COL.gray);
    }

    function drawMenu() {
        const m = ctx.menu;
        if (!m || m.kind === "target") return;
        if (m.kind === "equipSlot" || m.kind === "equipItem") { drawEquip(); return; }
        const n = m.options.length, lh = 22;
        let w = m.kind === "command" ? 128 : m.kind === "field" ? 128 : 220;
        const h = n * lh + 18;
        let x = VIEW_X + 6, y = VIEW_Y + VH - h - 6;
        if (m.kind === "spell" || m.kind === "item") { x = VIEW_X + VW - w - 6; }
        if (m.kind === "field") { y = VIEW_Y + 6; }
        frame(x, y, w, h);
        m.options.forEach((o, i) => {
            const col = o.disabled ? "#505060" : m.sel === i ? COL.white : COL.gray;
            text((m.sel === i ? "▶ " : "  ") + o.label, x + 10, y + 10 + i * lh, 16, col);
            if (o.right) text(o.right, x + w - 12, y + 10 + i * lh, 16, o.disabled ? "#505060" : COL.cyan, "right");
        });
    }

    // ---------- ループ ----------
    let raf = 0, last = performance.now();
    alive = true;
    const loop = (now) => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!ctx.externalPause) {
            handleInput();
            if (!ctx.paused) {
                if (run && ctx.state !== "title") { world.update(dt); magic.update(dt); }
                for (let i = ctx.timers.length - 1; i >= 0; i--) { const tm = ctx.timers[i]; tm.t -= dt; if (tm.t <= 0) { ctx.timers.splice(i, 1); tm.res(); } }
                ctx.pops.forEach((pp) => { pp.t += dt; });
                ctx.pops = ctx.pops.filter((pp) => pp.t < 1);
                if (ctx.slashT > 0) ctx.slashT -= dt;
                if (ctx.msgs.length) ctx.msgChars = Math.min(ctx.msgs[0].text.length, ctx.msgChars + dt * 45);
                // 質問のメッセージが全部表示されたら選択肢を出す
                const m0 = ctx.msgs[0];
                if (ctx.msgs.length === 1 && m0.keep && ctx.msgChars >= m0.text.length && ctx.onMsgsDone && !ctx.ask) {
                    const done = ctx.onMsgsDone; ctx.onMsgsDone = null; done();
                }
                if (ctx.pendingArrive && !world.busy()) { const p = ctx.pendingArrive; ctx.pendingArrive = null; arrive(p.x, p.z); }
                if (ctx.pendingStory && !ctx.msgs.length && !ctx.ask && ctx.state === "explore") { say(ctx.pendingStory); ctx.pendingStory = null; }
                if (ctx.offerQueue?.length && !ctx.offer && !ctx.msgs.length && !ctx.ask && !ctx.menu && ctx.state === "explore") offerEquip(ctx.offerQueue.shift());
                if (ctx.dressT > 0) ctx.dressT -= dt;
                if (ctx.state === "ending") ctx.endT = (ctx.endT || 0) + dt;
                if (ctx.arriveT > 0) ctx.arriveT -= dt;
                if (ctx.flash) { ctx.flash.a -= dt * 1.6; if (ctx.flash.a <= 0) ctx.flash = null; }
            }
        }
        if (run && ctx.state !== "title") world.render();
        draw();
    };
    raf = requestAnimationFrame(loop);
    setTimeout(focusRoot, 0);

    function restart() {
        run = null; floor = null;
        audio.playMusic("title");
        magic.clearEnemies();
        Object.assign(ctx, { state: "title", paused: false, finished: false, keys: [], msgs: [], ask: null, onMsgsDone: null, pendingArrive: null, titleSel: readSave() ? 1 : 0, menu: null, timers: [], blog: [], foes: null, pops: [], offer: null, offerQueue: [], dressT: 0 });
        focusRoot();
    }
    ctx.titleSel = readSave() ? 1 : 0;
    audio.playMusic("title"); // 最初の操作で音が出始める(自動再生の制限)

    return {
        unmount() {
            alive = false;
            cancelAnimationFrame(raf);
            ro.disconnect();
            container.removeEventListener("keydown", onKey);
            container.removeEventListener("keyup", onKey);
            magic.dispose();
            world.dispose();
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
                state: ctx.state, msgs: ctx.msgs.map((m) => m.text), ask: ctx.ask ? ctx.ask.options : null,
                run: run && { ...run, opened: undefined, visited: undefined }, x: world.cam.x, z: world.cam.z, dir: world.cam.dir,
                opened: [...opened], hasSave: !!readSave(), contextLost: world.renderer.getContext().isContextLost(),
            };
        },
        debugNew() { startNew(); ctx.msgs = []; return true; },
        debugTeleport(x, z, dir = world.cam.dir) { world.place(x, z, dir); visited.add(keyOf(x, z)); return true; },
        debugFloor(n) { if (!run) run = newRun(); syncFloorState(); enterFloor(Math.max(0, Math.min(floors.length - 1, (n | 0) - 1)), null, { autosave: false }); return true; },
        debugKey(a) { ctx.keys.push(a); return true; },
        debugRun() { return run; },
        debugEnding() { endingSequence(); return true; },
        debugGive(loot) { const l = parseLoot(loot); return l ? gain(l) : null; },
        debugStageResult(fi = run.floor) { return stageResult(fi); },
        debugBattle(ids, boss = false) { startBattle(ids, { boss }); return true; },
        debugUi() { return { menu: ctx.menu && { kind: ctx.menu.kind, options: ctx.menu.options.map((o) => o.label + (o.disabled ? "(x)" : "")), sel: ctx.menu.sel }, blog: [...ctx.blog], foes: ctx.foes && ctx.foes.map((f) => [f.label, f.hp, f.alive]), state: ctx.state }; },
        debugClearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } return true; },
        debugRenderer() { return world.renderer; },
    };
}

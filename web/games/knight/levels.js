/**
 * KNIGHT HEART のステージ地形。ビルダーで左から順に組み立てる(すべてオリジナル)。
 *
 * 高さ h = 地面の上面が下から何タイル目か。カーソル x は列(1列 = 16px)。
 *   flat(n)            平らな地面を n 列
 *   up(n, gentle)      上り坂(急 = 1列で1段、ゆるい = 2列で1段)を n 段
 *   down(n, gentle)    下り坂
 *   step(dh)           段差(壁)。h を dh だけ変える(列は進まない)
 *   pit(n) / lava(n)   穴 / 溶岩
 *   spikes(n)          とげのある地面
 *   surface("ice")     これから置く地面を氷にする("g" で戻す)
 *   ceiling(n)         上から n 段を天井にする(0 でなし)
 *   plat(dx, up, w, t) 足場("-" 下から抜けられる / "=" ブロック / "c" くずれる床)。dx はカーソルからの列、up は地面からの段
 *   ent(type, dx, up, opts)  敵・アイテム・しかけ
 *   arena(n)           ボスの部屋(右端は壁)
 * 文字のグリッド:
 *   "#" 地面  "i" 氷  "=" ブロック  "C" 天井  "/" "\" 急な坂  "1" "2" ゆるい上り  "3" "4" ゆるい下り
 *   "-" 足場  "c" くずれる床  "^" とげ  "~" 溶岩の表面  "L" 溶岩
 */

export const ROWS = 20;

class Builder {
    constructor() {
        this.x = 0;
        this.h = 4;
        this.surf = "g";
        this.ceilH = 0;
        this.cols = [];
        this.plats = [];
        this.ents = [];
        this.spikeCols = [];
        this.arenaInfo = null;
    }
    push(top, h = this.h, kind = this.surf) {
        this.cols.push({ top, h, kind, ceil: this.ceilH });
        this.x++;
        return this;
    }
    flat(n) { for (let i = 0; i < n; i++) this.push("flat"); return this; }
    up(n = 1, gentle = false) {
        for (let i = 0; i < n; i++) {
            if (gentle) { this.push("g1"); this.push("g2"); } else this.push("su");
            this.h++;
        }
        return this;
    }
    down(n = 1, gentle = false) {
        for (let i = 0; i < n; i++) {
            if (gentle) { this.push("g3"); this.push("g4"); } else this.push("sd");
            this.h--;
        }
        return this;
    }
    step(dh) { this.h += dh; return this; }
    pit(n) { for (let i = 0; i < n; i++) this.push("pit", 0, "pit"); return this; }
    lava(n) { for (let i = 0; i < n; i++) this.push("lava", 1, "lava"); return this; }
    spikes(n) {
        for (let i = 0; i < n; i++) { this.spikeCols.push({ col: this.x, s: this.h }); this.push("flat"); }
        return this;
    }
    surface(k) { this.surf = k; return this; }
    ceiling(n) { this.ceilH = n; return this; }
    plat(dx, up, w, type = "-") { this.plats.push({ col: this.x + dx, s: this.h + up, w, type }); return this; }
    ent(type, dx = 0, up = 0, opts = {}) { this.ents.push({ type, col: this.x + dx, s: this.h + up, ...opts }); return this; }
    fruits(dx, n, gap = 2, up = 1) { for (let i = 0; i < n; i++) this.ent("fruit", dx + i * gap, up); return this; }
    arena(n) {
        this.arenaInfo = { start: this.x, end: this.x + n };
        const start = this.x;
        this.flat(n);
        this.push("wall", ROWS);
        // ボスの部屋の足場: 左右に低い足場、まん中に高い足場(攻撃をよけたり、上からねらったりする)
        const o = start - this.x;
        this.plat(o + 3, 3, 4).plat(o + n - 7, 3, 4).plat(o + Math.floor(n / 2) - 3, 6, 6);
        return this;
    }

    finish() {
        const R = ROWS;
        const W = this.cols.length;
        const grid = Array.from({ length: R }, () => new Array(W).fill("."));
        const kinds = this.cols.map((c) => c.kind);
        this.cols.forEach((c, i) => {
            for (let r = 0; r < c.ceil; r++) grid[r][i] = "C";
            if (c.top === "pit") return;
            if (c.top === "lava") { grid[R - 2][i] = "~"; grid[R - 1][i] = "L"; return; }
            const solid = c.kind === "ice" ? "i" : "#";
            const fill = (from) => { for (let r = Math.max(0, from); r < R; r++) grid[r][i] = solid; };
            switch (c.top) {
                case "su": case "g1": case "g2":
                    fill(R - c.h);
                    grid[R - c.h - 1][i] = { su: "/", g1: "1", g2: "2" }[c.top];
                    break;
                case "sd": case "g3": case "g4":
                    fill(R - c.h + 1);
                    grid[R - c.h][i] = { sd: "\\", g3: "3", g4: "4" }[c.top];
                    break;
                default:
                    fill(R - c.h);
            }
        });
        for (const p of this.plats) {
            const r = R - p.s;
            if (r < 0 || r >= R) continue;
            for (let k = 0; k < p.w; k++) if (p.col + k >= 0 && p.col + k < W) grid[r][p.col + k] = p.type;
        }
        for (const s of this.spikeCols) grid[R - s.s - 1][s.col] = "^";
        return { grid: grid.map((row) => row.join("")), kinds, ents: this.ents, arena: this.arenaInfo, width: W, rows: R };
    }
}

// ---------------------------------------------------------------------------
// ステージ 1: 花の丘 — 段差・ゆるい坂・下り坂のスライディング・バネ・ジャンプ台を覚える
// ---------------------------------------------------------------------------
function stage1(b) {
    b.ent("start", 3).fruits(8, 3, 2, 1).flat(16);                                  // h4
    // 段差を3つ上る。上の段の上にハート
    b.ent("puru", 4).flat(7).step(1).flat(4).step(1).ent("fruit", 2, 1).flat(5).step(1); // h7
    b.ent("heart", 3, 4).flat(6);
    b.step(-3).ent("puru", 3).ent("puru", 8).flat(12);                              // h4
    // なだらかな丘とカエル
    b.up(1, true).flat(3).up(1, true).ent("hopper", 2).flat(4).down(1, true).flat(2); // h5
    b.ent("fruit", 2, 1).up(2, true).flat(4);                                        // h7
    // 長い下り坂: ↓ でスライディングすると加速して、下のぷるぷるをはね飛ばせる
    b.down(3, true);                                                                 // h4
    b.ent("puru", 3).ent("puru", 6).ent("puru", 9).fruits(4, 3, 3, 1).flat(16);
    // バネで高い足場へ。上にハート
    b.ent("spring", 4).plat(2, 8, 7, "-").ent("heart", 6, 9).ent("fruit", 4, 9).flat(12);
    b.ent("flag", 3).ent("boots", 6, 1).flat(9);
    // 穴とコウモリ
    b.pit(3).flat(5).ent("bat", 2, 5).pit(4).flat(3).fruits(0, 2, 2, 1).flat(4);
    // 谷で勢いをつけてジャンプ台から跳ぶ。穴の上空にハート
    b.flat(4).down(2).flat(2).up(2).ent("heart", 3, 5).pit(6).flat(10);              // h4
    // すべり込まないと通れない低いトンネル(中にハート)
    b.ent("puru", 2).flat(6).plat(0, 2, 8, "=").plat(0, 3, 8, "=").ent("heart", 4, 0).ent("fruit", 7, 0).flat(8).flat(6);
    // 階段を上って、最上段から高いハートへ
    b.ent("hopper", 2).flat(4).step(1).flat(2).step(1).flat(2).step(1).flat(2).step(1); // h8
    b.ent("heart", 3, 6).ent("fruit", 1, 1).flat(7);
    b.ent("armor", 2, 1).ent("flower", 6).flat(9);
    b.down(4).flat(4);                                                               // h4
    b.ent("meat", 2, 1).flat(6);
    b.ent("gate", 0).arena(26).ent("boss", -13, 0);
}

// ---------------------------------------------------------------------------
// ステージ 2: ささやきの森 — 高い段差、木の上の足場、動く足場、ゴブリン兵
// ---------------------------------------------------------------------------
function stage2(b) {
    b.ent("start", 3).fruits(8, 2, 2, 1).flat(14);                                    // h4
    b.ent("dagger", 6, 1).ent("puru", 3).ent("hopper", 9).flat(12);
    // 2段の高い段差(走ってジャンプ)
    b.step(2).ent("fruit", 2, 1).flat(6).step(2).ent("goblin", 6).plat(2, 4, 3, "-").ent("heart", 3, 5).flat(9);            // h8
    b.down(2).ent("bat", 4, 5).flat(6).down(2, true).flat(4);                         // h4
    // バネと木の上の足場の道
    b.ent("spring", 3).plat(5, 7, 5, "-").plat(13, 8, 4, "-").plat(20, 7, 5, "-").ent("heart", 15, 9).ent("fruit", 22, 8).ent("hopper", 10);
    b.flat(28);
    b.ent("flower", 6).ent("puru", 11).flat(14);
    // 動く足場で穴をわたる
    b.ent("mplat", 1, 0, { w: 3, ax: "x", range: 6, speed: 50 }).pit(10).flat(4);
    b.ent("bat", 2, 6).ent("mplat", 0, 2, { w: 3, ax: "y", range: 4, speed: 40 }).pit(4).ent("heart", 1, 7).pit(4).flat(6);
    b.ent("flag", 2).ent("fruit", 4, 1).ent("boots", 7, 1).flat(9);
    // 急な上り坂と下り坂の連続(下りで加速、上りで減速)
    b.up(3).flat(2).down(3).flat(2).up(2).flat(1).down(2).ent("puru", 2).ent("puru", 5).flat(8);
    // 階段状の段差にゴブリン兵
    b.step(1).flat(3).step(1).flat(3).step(1).ent("goblin", 2).flat(5).step(1).flat(3);   // h8
    b.ent("heart", 1, 6).flat(3).step(-4).ent("hopper", 3).ent("fruit", 6, 1).flat(10);    // h4
    // 長い下り坂の先の穴: スライディングの勢いで跳ぶ
    b.up(3, true).flat(3).down(4, true).flat(3);                                      // h3
    b.ent("heart", 4, 5).pit(7).flat(6);
    b.ent("goblin", 4).ent("flower", 9).flat(12);
    b.ent("armor", 2, 1).ent("meat", 6, 1).flat(10);
    b.ent("gate", 0).arena(26).ent("boss", -13, 0);
}

// ---------------------------------------------------------------------------
// ステージ 3: 火山の洞窟 — 天井、溶岩、くずれる橋(止まらず走る)、転がってくる岩
// ---------------------------------------------------------------------------
function stage3(b) {
    b.ceiling(3);
    b.ent("start", 3).fruits(8, 2, 2, 1).flat(14);                                    // h4
    b.ent("axe", 3, 1).ent("bat", 6, 5).ent("puru", 10).flat(12);
    // 溶岩の池と火の玉
    b.lava(4).ent("fire", -2).flat(4).lava(5).ent("fire", -4).ent("fire", -1).ent("heart", -3, 4).flat(6);
    // くずれる橋: 止まると落ちる
    b.lava(12).plat(-12, 0, 12, "c").ent("heart", -6, 4).flat(6);
    // 岩が転がってくる長い下り坂を上る(岩は上から転がり落ちてくる)
    b.ent("fruit", 2, 1).flat(4).up(5, true).ent("rocks", 2).flat(5);                 // h9
    b.ent("heart", 3, 3).flat(2).down(5);                                             // h4
    b.ent("goblin", 3).flat(10).ent("flag", 0).flat(6);
    // 天井の低い通路(すべり込み)と溶岩
    b.flat(2).plat(0, 2, 10, "=").ent("heart", 5, 0).ent("fruit", 8, 0).flat(10).flat(4);
    b.ent("mplat", 1, 1, { w: 3, ax: "x", range: 7, speed: 60 }).lava(11).ent("fire", -5).flat(5);
    b.ent("hopper", 3).ent("bat", 6, 6).flat(10);
    // 段差を上って2本目の転がる岩の坂
    b.step(2).flat(4).step(2).flat(4).ent("goblin", 2).flat(4);                       // h8
    b.down(4, true).ent("rocks", -9, 4).flat(4);                                      // h4  (岩は段の上から)
    b.ent("fruit", 0, 1).lava(3).flat(3).lava(3).ent("fire", -2).flat(3).lava(3).flat(4);
    // 最後のくずれる橋の上空にハート(橋からジャンプ)
    b.lava(14).plat(-14, 2, 14, "c").ent("heart", -7, 7).ent("fire", -10).ent("fire", -4).flat(8);
    b.ent("armor", 2, 1).ent("meat", 5, 1).flat(8);
    b.ceiling(0).ent("gate", 0).arena(26).ent("boss", -13, 0);
}

// ---------------------------------------------------------------------------
// ステージ 4: 氷の城壁 — すべる氷、長い滑降、つらら、大ジャンプ
// ---------------------------------------------------------------------------
function stage4(b) {
    b.ent("start", 3).fruits(8, 2, 2, 1).flat(12);                                   // h4
    b.surface("ice").ent("puru", 6).flat(12);
    // つららの下を抜ける
    b.plat(2, 5, 10, "=").ent("icicle", 4, 4).ent("icicle", 7, 4).ent("icicle", 10, 4).ent("fruit", 6, 1).ent("heart", 9, 1).flat(14);
    // 氷の段差を上って長い滑降 → ジャンプ台 → 大きな穴
    b.surface("g").step(2).flat(4).step(2).flat(3).step(2).flat(4).surface("ice");    // h10
    b.down(6, true).flat(2).up(1).ent("heart", 4, 6).pit(9).flat(8);                // h5
    b.ent("bat", 4, 6).ent("hopper", 8).flat(12);
    b.ent("flag", 2).ent("boots", 4, 1).flat(6);
    // バネで高い氷の足場、つららとコウモリ
    b.surface("g").ent("spring", 3).plat(5, 8, 10, "-").ent("heart", 12, 9).ent("bat", 9, 10).flat(12).surface("ice");
    b.ent("goblin", 4).ent("fruit", 8, 1).flat(12);
    // 動く足場の連続(氷の上は止まりにくい)
    b.ent("mplat", 1, 1, { w: 3, ax: "x", range: 5, speed: 55 }).pit(9).flat(3);
    b.ent("mplat", 0, 3, { w: 3, ax: "y", range: 4, speed: 45 }).pit(4).ent("heart", 1, 8).pit(4).flat(5);
    // 急坂の連続(下りで加速して上りを越える)
    b.down(1).flat(1).down(1).flat(4).up(2).ent("puru", 2).flat(4).down(2).flat(4).up(3).flat(3).ent("flower", 1);  // h6
    b.flat(4).down(2).ent("goblin", 4).flat(10);                                      // h4
    // すべり込みトンネル
    b.plat(0, 2, 10, "=").plat(0, 3, 10, "=").ent("heart", 6, 0).flat(12);
    b.ent("armor", 3, 1).ent("meat", 7, 1).flat(10);
    b.surface("g").ent("gate", 0).arena(26).ent("boss", -13, 0);
}

// ---------------------------------------------------------------------------
// ステージ 5: 夜の城 — とげ、くずれる床、上下する足場、すべての腕だめし
// ---------------------------------------------------------------------------
function stage5(b) {
    b.ent("start", 3).fruits(8, 2, 2, 1).flat(14);                                   // h4
    b.ent("lance", 6, 1).ent("wisp", 10, 4).ent("goblin", 12).flat(16);
    // とげの床の上の足場
    b.flat(2).spikes(10).plat(-8, 3, 3, "=").plat(-3, 4, 2, "=").ent("fruit", -7, 4).ent("heart", -5, 7).flat(4);
    // 城の階段(段差)を上る
    b.step(1).flat(2).step(1).flat(2).step(1).ent("goblin", 1).flat(3).step(1).flat(2).step(1).flat(4); // h9
    b.ent("heart", 2, 5).ent("wisp", 6, 3).flat(5);
    // 長い下り坂で加速して穴を跳ぶ
    b.down(4, true).ent("puru", 2).flat(3);                                          // h5
    b.pit(6).flat(5).ent("flag", 2).ent("axe", 4, 1).flat(5);
    // 上下する足場ととげの穴
    b.ent("mplat", 1, 0, { w: 2, ax: "y", range: 5, speed: 45 }).pit(3).ent("mplat", 0, 3, { w: 2, ax: "y", range: 5, speed: 55, phase: 1.5 }).pit(3).ent("heart", 0, 9).pit(3).flat(5);
    b.ent("flower", 3).ent("wisp", 7, 5).flat(10);
    // くずれる床の橋(下はとげの穴)
    b.pit(12).plat(-12, 0, 12, "c").ent("bat", -6, 5).ent("heart", -3, 3).flat(6);
    // 高い段の上から岩が落ちてくる
    b.step(3).flat(3).ent("rocks", 2).flat(3).down(3).ent("goblin", 4).flat(8);       // h5
    // すべり込みトンネル
    b.plat(0, 2, 8, "=").plat(0, 3, 8, "=").ent("heart", 4, 0).flat(10);
    b.ent("hopper", 3).ent("wisp", 8, 4).ent("fruit", 5, 1).flat(12);
    b.spikes(4).flat(2).spikes(4).plat(-10, 3, 10, "-").ent("fruit", -5, 4).flat(4);
    b.ent("armor", 3, 1).ent("meat", 6, 1).ent("boots", 9, 1).flat(12);
    b.ent("gate", 0).arena(28).ent("boss", -13, 0);
}

export const LEVELS = { 1: stage1, 2: stage2, 3: stage3, 4: stage4, 5: stage5 };

export function buildLevel(id) {
    const fn = LEVELS[id] || stage1;
    const b = new Builder();
    fn(b);
    return b.finish();
}

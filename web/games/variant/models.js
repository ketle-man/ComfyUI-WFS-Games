/**
 * VARIANT HEART のボクセルモデル(すべてオリジナルデザイン)
 *   自機 XV-7 スワロー: 戦闘機(fighter)と人型(robot)。部位タグ(body/head/legL,R/wingL,R/armL,R/finL,R/gun)で変形を対応させる
 *   敵: ドローン・ランサー・ウォーカー・戦車・砲台・機雷、ボス5体、地形の飾り
 * 座標は stack.js 参照(+x 前、+y 右、+z 上)。最初に使うときに compile してキャッシュする。
 */
import { Vox, compile } from "./stack.js";

// ---- 自機の色 ----
const W = "#e9edf1", W2 = "#bcc5d0", TE = "#1c9a98", TD = "#11605e", OR = "#f08a24", DK = "#383e47", CAN = "#1d3446";
const GL = "!#62f4ff", EX = "!#ffb44a";
// ---- 敵の色 ----
const HG = "#5d6270", HD = "#34373f", HP = "#7b3d92", HP2 = "#9b5bb2", HR = "!#ff3a48", HY = "#c9a23e", HO = "!#ff8a30";

function fighterVox() {
    const v = new Vox();
    // 胴体
    v.T("body");
    for (let x = -10; x <= 12; x++) {
        const hw = x > 7 ? Math.max(0, Math.round((12 - x) * 0.45)) : 2;
        const zt = x > 9 ? 2 : 3;
        for (let y = -hw; y <= hw; y++) for (let z = 1; z <= zt; z++) v.set(x, y, z, z === 1 ? W2 : (y === 0 && z === zt && x < 3 && x > -9) ? TE : W);
    }
    v.set(13, 0, 2, DK);
    v.box(3, -1, 4, 7, 1, 4, CAN).box(4, 0, 5, 6, 0, 5, CAN).set(6, 0, 5, GL);
    v.set(2, 0, 4, OR).set(1, 0, 4, OR);
    // 機首下のセンサー(→ 頭)
    v.T("head").box(9, -1, 0, 11, 1, 0, W2).set(11, 0, 0, GL);
    // エンジン(→ 脚)
    v.T("leg*");
    for (let x = -14; x <= 1; x++) for (let y = 3; y <= 5; y++) for (let z = 1; z <= 3; z++) {
        if ((y === 3 || y === 5) && (z === 1 || z === 3)) continue;
        v.set(x, y, z, x >= 0 ? DK : x === -14 ? EX : x === -13 ? DK : y === 5 ? TE : W);
    }
    // 主翼(→ 背中のウイング)
    v.T("wing*");
    for (let x = -9; x <= 4; x++) {
        const span = Math.round(6 + (4 - x) * 0.55);
        for (let y = 6; y <= span; y++) {
            const lead = x === 4 || y === span || Math.round(6 + (4 - (x + 1)) * 0.55) < y;
            v.set(x, y, 2, x === -9 ? TD : lead ? W : y === span - 2 && x < -2 ? OR : TE);
        }
    }
    // 翼下のポッド(→ 腕)
    v.T("arm*").box(-5, 8, 1, 3, 8, 1, W2).set(3, 8, 1, DK).set(-5, 8, 1, DK);
    // 双垂直尾翼(→ 背中のフィン)
    v.T("fin*");
    for (let x = -13; x <= -8; x++) {
        const zt = 4 + Math.round((-8 - x) * 0.8);
        for (let z = 4; z <= zt; z++) v.set(x, 4, z, z === zt ? OR : TE);
    }
    v.mirror();
    // ガンポッド(→ ライフル)
    v.T("gun").box(-3, 0, 0, 7, 0, 0, DK).set(7, 0, 0, GL);
    return v;
}

function robotVox() {
    const v = new Vox();
    // 脚
    v.T("leg*");
    v.box(-1, 2, 6, 1, 4, 11, W2);
    v.box(-2, 2, 1, 2, 4, 6, W);
    v.box(2, 2, 6, 2, 4, 7, TE).box(2, 3, 5, 2, 3, 5, TE);
    v.box(-3, 2, 0, 4, 4, 0, DK).box(2, 2, 1, 4, 4, 1, W).set(4, 3, 1, OR);
    v.box(-3, 3, 2, -3, 3, 4, EX);
    // 胴体
    v.T("body");
    v.box(-1, -2, 11, 1, 2, 12, DK);
    v.box(-2, -4, 13, 3, 4, 18, (x, y, z) => (z === 18 ? W2 : x === 3 && Math.abs(y) >= 1 && Math.abs(y) <= 3 && z >= 15 && z <= 17 ? TE : W));
    v.box(3, -1, 14, 4, 1, 16, CAN).set(4, 0, 16, GL);
    v.box(3, -1, 13, 3, 1, 13, OR);
    v.box(-3, -3, 14, -3, 3, 17, W2);
    // 頭
    v.T("head");
    v.box(-1, -1, 19, 1, 1, 21, W).box(2, -1, 20, 2, 1, 20, GL).box(2, 0, 21, 2, 0, 21, W2);
    v.box(-2, 0, 22, 0, 0, 22, OR).set(-3, 0, 22, OR).set(-1, 2, 20, TE).set(-1, -2, 20, TE);
    // 腕
    v.T("arm*");
    v.box(-2, 5, 16, 2, 7, 18, TE).box(-1, 8, 17, 1, 8, 17, OR);
    v.box(-1, 6, 12, 1, 6, 15, W2);
    v.box(-1, 5, 9, 2, 7, 12, W);
    v.box(0, 6, 8, 1, 6, 8, DK);
    // 背中のウイング(戦闘機の主翼をたたんだもの)
    v.T("wing*");
    for (let i = 0; i <= 9; i++) {
        const y = 3 + Math.round(i * 0.7), z = 11 + i;
        v.box(-5, y, z, -4, y + 1, z, i >= 8 ? W : i === 5 ? OR : TE);
    }
    // 背中のフィンとスラスター
    v.T("fin*");
    v.box(-4, 2, 13, -3, 3, 17, W2).set(-4, 2, 12, EX).set(-4, 3, 12, EX);
    v.box(-4, 3, 18, -2, 3, 20, TE).set(-4, 3, 21, OR);
    v.mirror();
    // ビームライフル(右手)
    v.T("gun").box(1, 6, 7, 10, 6, 7, DK).box(3, 6, 8, 5, 6, 8, DK).set(11, 6, 7, GL).box(-1, 6, 6, 1, 6, 6, DK);
    return v;
}

/** 敵エースのカラーリング(自機と同じ型の黒と深紅) */
function rivalColor(v) {
    const map = { [W]: "#3c3844", [W2]: "#2a2730", [TE]: "#b4202e", [TD]: "#6e1019", [OR]: "#e3b443", [CAN]: "#401018", [GL]: "!#ff4a6a", [EX]: "!#ff6040" };
    const key = (c) => (c[3] ? "!" : "") + "#" + c.slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join("");
    return v.recolor((c) => map[key(c)] || null);
}

function droneVox() {
    const v = new Vox();
    for (let x = -6; x <= 6; x++) {
        const hw = Math.round((6 - x) * 0.7) + 1;
        for (let y = 0; y <= hw; y++) v.set(x, y, 1, y >= hw - 1 ? HD : y > 3 && x < 0 ? HP2 : HG);
    }
    v.box(-4, 0, 2, 4, 2, 3, HP).box(-2, 0, 4, 2, 1, 4, HP2);
    v.box(-7, 3, 1, -7, 4, 2, HO);
    v.mirror();
    v.box(5, 0, 2, 5, 0, 2, HR).box(6, 0, 1, 7, 0, 1, HD);
    return v;
}

function lancerVox() {
    const v = new Vox();
    v.box(-8, 0, 1, 10, 1, 2, (x, y, z) => (z === 2 && y === 0 && x > -4 && x < 6 ? HP : HG));
    v.box(11, 0, 1, 13, 0, 1, HD);
    v.box(-8, 5, 1, 3, 5, 1, HP).box(4, 5, 1, 5, 5, 1, HD);
    v.box(-4, 2, 1, 0, 4, 1, HD);
    v.box(-9, 5, 1, -9, 5, 1, HO);
    v.mirror();
    v.box(-9, 0, 1, -9, 0, 2, HO).box(6, 0, 3, 8, 0, 3, HR);
    return v;
}

function walkerVox() {
    const v = new Vox();
    v.box(-2, 2, 1, 2, 4, 8, (x, y, z) => (z === 5 && x === 2 ? HY : HD));
    v.box(-3, 2, 0, 4, 4, 0, HG);
    v.box(-1, -2, 9, 1, 2, 9, HD);
    v.box(-3, -4, 10, 3, 4, 15, (x, y, z) => (x === 3 && z === 13 ? HY : HP));
    v.box(-3, 5, 13, 3, 8, 16, (x, y, z) => (z === 16 ? HP2 : HG));
    v.box(-1, 6, 7, 2, 7, 12, HD);
    v.box(-1, -1, 16, 2, 1, 18, HG);
    v.mirror();
    v.box(3, -1, 17, 3, 1, 17, HR);
    // 左手の盾・右手の砲
    v.box(2, -10, 5, 3, -9, 14, (x, y, z) => (z === 9 ? HY : HG));
    v.box(2, 7, 8, 8, 7, 9, HD).set(9, 7, 8, HR);
    return v;
}

function tankHullVox() {
    const v = new Vox();
    v.box(-7, 0, 1, 7, 4, 3, (x, y, z) => (z === 3 && y < 3 ? HG : HD));
    v.box(-8, 5, 0, 8, 6, 2, (x) => (x % 2 === 0 ? "#26282e" : HD));
    v.box(-8, 2, 1, -8, 3, 2, HO);
    v.mirror();
    return v;
}
function tankTopVox() {
    const v = new Vox();
    v.box(-3, 0, 4, 3, 3, 6, (x, y, z) => (z === 6 ? HP2 : HP));
    v.mirror();
    v.box(4, 0, 5, 11, 0, 5, HD).set(12, 0, 5, HR);
    return v;
}
function turretBaseVox() {
    const v = new Vox();
    v.cyl(0, 0, 0, 2, 6, (x, y, z) => (z === 2 ? HG : HD));
    v.cyl(0, 0, 3, 3, 4.5, HY);
    return v;
}
function turretTopVox() {
    const v = new Vox();
    v.ell(0, 0, 5, 3.6, 3.6, 2.4, HP);
    v.box(3, 1, 5, 10, 1, 5, HD).set(11, 1, 5, HR);
    v.mirror();
    v.set(2, 0, 7, HR);
    return v;
}
function mineVox() {
    const v = new Vox();
    v.ell(0, 0, 5, 3.5, 3.5, 3.5, (x, y, z) => ((x + y + z) % 3 === 0 ? HD : HG));
    [[6, 0, 5], [-6, 0, 5], [0, 6, 5], [0, -6, 5], [0, 0, 10], [4, 4, 5], [-4, -4, 5], [4, -4, 5], [-4, 4, 5]].forEach(([x, y, z]) => v.set(x, y, z, HR));
    return v;
}
function heartVox() {
    const v = new Vox();
    for (let y = -8; y <= 8; y++) for (let z = -8; z <= 8; z++) {
        const a = y / 7, b = (z - 0.5) / 7;
        const f = (a * a + b * b - 1) ** 3 - a * a * b * b * b;
        if (f <= 0) for (let x = -1; x <= 1; x++) v.set(x, y, z + 9, z > 3 && y < 0 && y > -6 ? "#ffc4dc" : Math.abs(x) === 1 ? "#ff5f9e" : "#ff3d86");
    }
    return v;
}
function capsuleVox(col, mark) {
    const v = new Vox();
    v.ell(0, 0, 5, 4, 4, 4, col);
    v.box(-4, -1, 5, 4, 1, 5, mark).box(-1, -4, 5, 1, 4, 5, mark).box(-1, -1, 9, 1, 1, 9, mark);
    return v;
}

/** 奥(深宇宙)から突っ込んでくる攻撃機 */
function diverVox() {
    const v = new Vox();
    for (let x = -7; x <= 9; x++) {
        const hw = Math.round((9 - x) * 0.45) + 1;
        for (let y = 0; y <= hw; y++) for (let z = 1; z <= 2; z++) v.set(x, y, z, z === 2 && y <= 1 && x > -5 ? HP : y === hw ? HD : HG);
    }
    v.box(-8, 3, 1, -5, 4, 3, HD).box(-9, 3, 1, -9, 4, 3, HO);
    v.box(-6, 6, 3, -3, 6, 3, HP2);
    v.mirror();
    v.box(3, 0, 3, 5, 0, 3, HR).box(10, 0, 1, 11, 0, 1, HD);
    return v;
}
/** 遠くに浮かぶ宇宙ステーション(背景用) */
function stationVox() {
    const v = new Vox();
    v.cyl(0, 0, 0, 12, 4, (x, y, z) => (z % 4 === 0 ? "#7a808c" : "#a4aab6"));
    v.fill(-20, 20, -20, 20, 5, 7, (x, y, z) => {
        const d = Math.hypot(x, y);
        if (Math.abs(d - 17) > 1.6) return null;
        return z === 6 && Math.abs(d - 17) > 1.2 && (Math.round(Math.atan2(y, x) * 9) % 2 === 0) ? "!#ffe08a" : "#c6cad4";
    });
    v.box(-16, 0, 6, 16, 0, 6, "#8a909c").box(0, -16, 6, 0, 16, 6, "#8a909c");
    for (const sgn of [-1, 1]) v.box(sgn * 22, -4, 6, sgn * 36, 4, 6, (x, y) => (x % 3 === 0 || Math.abs(y) === 4 ? "#8a96a8" : "#28468a"));
    v.box(0, 0, 13, 0, 0, 17, "#9aa0ac").set(0, 0, 18, "!#ff4050");
    return v;
}

// ---- ボス ----
function carrierVox() {
    const v = new Vox();
    for (let x = -40; x <= 40; x++) {
        const hw = x > 26 ? Math.round((40 - x) * 0.72) : x < -36 ? 10 - (-36 - x) * 2 : 10;
        for (let y = 0; y <= hw; y++) for (let z = 0; z <= 5; z++) {
            const c = z === 5 ? ((x % 12 === 0 && y < 2) ? "#e8e070" : y === hw ? HG : "#2c2f37") : z === 0 ? "#22242a" : y === hw ? HG : HD;
            v.set(x, y, z, c);
        }
    }
    v.mirror();
    // 艦橋(弱点)
    v.box(-22, 4, 6, -8, 9, 11, (x, y, z) => (z === 11 ? HP2 : HP));
    v.box(-20, 5, 12, -12, 8, 14, HG).box(-12, 5, 13, -12, 8, 13, HR);
    v.box(-17, 6, 15, -16, 7, 19, HD).set(-16, 7, 19, HR);
    v.box(-41, -6, 2, -41, -3, 3, HO).box(-41, 3, 2, -41, 6, 3, HO);
    // 甲板の誘導線
    for (let x = -30; x <= 34; x += 4) v.set(x, 0, 6, "#e8e070");
    return v;
}
function crawlerVox() {
    const v = new Vox();
    v.ell(0, 0, 5, 15, 9, 4, (x, y, z) => (z >= 8 ? HP2 : Math.abs(x) % 6 === 0 ? HG : HP));
    v.ell(15, 0, 5, 5, 5, 3, HG);
    v.box(19, 2, 6, 19, 3, 6, HR).box(19, -3, 6, 19, -2, 6, HR);
    v.box(20, 3, 3, 24, 4, 4, HD).box(20, -4, 3, 24, -3, 4, HD);
    // 尾(上へ反って前へ曲がる)と先端の砲
    const seg = [[-15, 6], [-18, 8], [-20, 11], [-21, 14], [-20, 17], [-17, 19], [-14, 20]];
    seg.forEach(([x, z], i) => v.ell(x, 0, z, 2.6, 2.6, 2, i % 2 ? HG : HP));
    v.ell(-11, 0, 20, 2.5, 2, 2, HD).set(-8, 0, 20, HR).set(-9, 0, 20, HR);
    return v;
}
function crawlerLegVox() {
    const v = new Vox();
    v.box(0, 0, 4, 6, 1, 5, HG).box(6, 0, 0, 8, 1, 5, HD).box(8, 0, 0, 9, 1, 0, HY);
    return v;
}
function fortressVox() {
    const v = new Vox();
    v.cyl(0, 0, 0, 5, 26, (x, y, z) => (z === 5 ? (Math.hypot(x, y) > 23 ? HY : "#4a4e5a") : HD));
    v.ell(0, 0, 6, 17, 17, 9, (x, y, z) => (Math.abs(x) <= 1 || Math.abs(y) <= 1 ? HG : z > 12 ? HP2 : HP));
    v.ell(0, 0, 15, 4, 4, 2.5, HR);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        v.box(Math.round(Math.cos(a) * 25), Math.round(Math.sin(a) * 25), 0, Math.round(Math.cos(a) * 25), Math.round(Math.sin(a) * 25), 3, HO);
    }
    return v;
}
function flagshipVox() {
    const v = new Vox();
    for (let x = -50; x <= 50; x++) {
        const hw = x > 30 ? Math.round((50 - x) * 0.55) + 2 : x < -40 ? 12 : 12 + (x > -10 && x < 20 ? 3 : 0);
        for (let y = 0; y <= hw; y++) {
            const zt = 3 + (y < 6 ? 3 : 0) + (x > -30 && x < 10 && y < 4 ? 3 : 0);
            for (let z = 0; z <= zt; z++) v.set(x, y, z, z === zt ? (y === hw ? HY : (x + y) % 9 === 0 ? HR : HG) : y === hw ? HG : HD);
        }
    }
    v.mirror();
    // 船尾: 左右にエンジン、まん中に後ろ向きの主砲
    v.box(-52, -10, 1, -51, -5, 5, (x, y) => (Math.abs(y) % 4 === 1 ? HO : HD));
    v.box(-52, 5, 1, -51, 10, 5, (x, y) => (Math.abs(y) % 4 === 1 ? HO : HD));
    v.box(-56, -4, 2, -51, 4, 7, HG); // 砲の付け根
    v.box(-64, -2, 4, -57, 2, 6, HD).box(-65, -1, 5, -65, 1, 5, HR);
    v.ell(-8, 0, 12, 6, 6, 5, (x, y, z) => (z > 13 ? HR : HP));
    v.box(44, -2, 4, 56, 2, 6, HD).box(57, -1, 5, 57, 1, 5, HR);
    return v;
}

// ---- 地形の飾り ----
function islandVox(seed) {
    const v = new Vox();
    const rnd = rng(seed);
    v.ell(0, 0, 0, 13 + rnd() * 5, 10 + rnd() * 4, 1.6, (x, y, z) => (z >= 1 ? "#dccb8e" : "#c7b276"));
    v.ell(-3, 2, 2, 5, 4, 3, "#6b6c62");
    const palms = 1 + Math.floor(rnd() * 3);
    for (let p = 0; p < palms; p++) {
        const px = Math.round((rnd() - 0.5) * 12), py = Math.round((rnd() - 0.5) * 8);
        const h = 8 + Math.floor(rnd() * 4);
        for (let z = 1; z <= h; z++) v.set(px + Math.round(z * 0.15), py, z, "#7a5a36");
        const tx = px + Math.round(h * 0.15);
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + rnd();
            for (let r = 1; r <= 5; r++) v.set(tx + Math.cos(a) * r, py + Math.sin(a) * r, h + 1 - Math.floor(r * r / 10), r === 5 ? "#3f8a3c" : "#52a84a");
        }
    }
    return v;
}
function rockVox(seed, col = "#7a7466", col2 = "#5d584e") {
    const v = new Vox();
    const rnd = rng(seed);
    for (let i = 0; i < 4; i++) v.ell((rnd() - 0.5) * 8, (rnd() - 0.5) * 8, 1 + rnd() * 2, 3 + rnd() * 4, 3 + rnd() * 3, 2 + rnd() * 3, (x, y, z) => ((x * 3 + y * 5 + z * 7) % 11 === 0 ? col2 : col));
    return v;
}
function mesaVox(seed) {
    const v = new Vox();
    const rnd = rng(seed);
    const rx = 9 + rnd() * 7, ry = 7 + rnd() * 6, h = 7 + Math.floor(rnd() * 6);
    for (let z = 0; z <= h; z++) {
        const k = 1 - (z / h) * 0.25;
        const col = z === h ? "#e2a160" : z % 3 === 0 ? "#a85a32" : "#c4743f";
        v.ell(0, 0, z, rx * k, ry * k, 0.5, col);
    }
    return v;
}
function hangarVox() {
    const v = new Vox();
    for (let x = -12; x <= 12; x++) for (let y = -9; y <= 9; y++) {
        const zt = Math.round(Math.sqrt(Math.max(0, 81 - y * y)) * 0.8);
        for (let z = 0; z <= zt; z++) if (z === zt || Math.abs(x) === 12) v.set(x, y, z, x === 12 && Math.abs(y) < 5 && z < 6 ? "#2a2c30" : x % 4 === 0 ? "#8a8c80" : "#a3a596");
    }
    return v;
}
function buildingVox(seed) {
    const v = new Vox();
    const rnd = rng(seed);
    const w = 5 + Math.floor(rnd() * 5), d = 5 + Math.floor(rnd() * 5), h = 12 + Math.floor(rnd() * 22);
    const win = rnd() < 0.5 ? "!#ffe08a" : "!#7fe8ff";
    const wall = ["#56607e", "#5e5478", "#4a6670", "#6a6a7a"][Math.floor(rnd() * 4)];
    v.box(-w, -d, 0, w, d, h, (x, y, z) => {
        const side = Math.abs(x) === w || Math.abs(y) === d;
        if (z === h) return "#7c84a0";
        if (Math.abs(x) === w && Math.abs(y) === d) return "#8a92b0";
        if (side && z % 3 === 1 && (x + y) % 2 === 0 && rnd() < 0.55) return win;
        return wall;
    });
    if (rnd() < 0.6) v.box(-2, -2, h + 1, 2, 2, h + 2, "#3a3e50").set(0, 0, h + 3, "!#ff4050");
    if (rnd() < 0.4) v.box(-w, -d, h + 1, w, -d, h + 1, rnd() < 0.5 ? "!#ff5ac8" : "!#5affb0");
    return v;
}
function pineVox(seed) {
    const v = new Vox();
    const rnd = rng(seed);
    const h = 10 + Math.floor(rnd() * 6);
    v.box(0, 0, 0, 0, 0, 3, "#5a4030");
    for (let z = 2; z <= h; z++) {
        const r = Math.max(0.5, (h - z) * 0.42 + (z % 3 === 0 ? 0.8 : 0));
        v.cyl(0, 0, z, z, r, (x, y) => ((z % 3 === 0 || z === h) && Math.hypot(x, y) > r - 1.2 ? "#eef4fa" : "#2f6a48"));
    }
    return v;
}
function snowRockVox(seed) {
    const v = rockVox(seed, "#8a92a0", "#6a7280");
    for (const vv of v.map.values()) if (!v.has(vv.x, vv.y, vv.z + 1) && vv.z >= 2) vv.c = [240, 246, 252, 0];
    return v;
}
function asteroidVox(seed) {
    const v = new Vox();
    const rnd = rng(seed);
    const r = 5 + rnd() * 7;
    for (let i = 0; i < 3; i++) v.ell((rnd() - 0.5) * r, (rnd() - 0.5) * r, r * 0.8, r * (0.6 + rnd() * 0.4), r * (0.6 + rnd() * 0.4), r * (0.5 + rnd() * 0.3), (x, y, z) => ((x * 7 + y * 3 + z * 5) % 13 === 0 ? "#4e4840" : (x + y) % 5 === 0 ? "#7a6e60" : "#655c52"));
    return v;
}
function debrisVox(seed) {
    const v = new Vox();
    const rnd = rng(seed);
    const w = 4 + Math.floor(rnd() * 8);
    v.box(-w, -3, 2, w, 3, 3, (x, y) => ((x + y) % 4 === 0 ? "#8a8f9a" : "#5a606c"));
    v.box(-w, -1, 4, -w + 3, 1, 6, "#4a4f5a").set(w, 0, 3, "!#ff9040");
    return v;
}
function wreckVox() {
    const v = new Vox();
    for (let x = -12; x <= 10; x++) {
        const hw = x > 6 ? Math.round((10 - x) * 0.8) : 3;
        v.box(x, -hw, 0, x, hw, 2, x === 0 ? "#2a2c32" : "#4a3c34");
    }
    v.box(-4, -2, 3, 0, 2, 6, "#3a3430");
    return v;
}

function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const DEFS = {
    fighter: [fighterVox, 1.5], robot: [robotVox, 1.5],
    fighterBig: [fighterVox, 4.2], robotBig: [robotVox, 4.2],
    rivalF: [() => rivalColor(fighterVox()), 1.8], rivalR: [() => rivalColor(robotVox()), 1.8],
    drone: [droneVox, 1.5], lancer: [lancerVox, 1.5], walker: [walkerVox, 1.5],
    tankHull: [tankHullVox, 1.5], tankTop: [tankTopVox, 1.5],
    turretBase: [turretBaseVox, 1.5], turretTop: [turretTopVox, 1.5], bigTurretTop: [turretTopVox, 2.2], bigTurretBase: [turretBaseVox, 2.2],
    mine: [mineVox, 1.5], diver: [diverVox, 1.6], station: [stationVox, 1.5], heart: [heartVox, 1.2],
    repair: [() => capsuleVox("#2f8f4a", "#e8f8e8"), 1.3], ammo: [() => capsuleVox("#2a6aa8", "#ffd060"), 1.3],
    carrier: [carrierVox, 1.6], crawler: [crawlerVox, 1.8], crawlerLeg: [crawlerLegVox, 1.8],
    fortress: [fortressVox, 1.7], flagship: [flagshipVox, 1.6],
    hangar: [hangarVox, 1.5], wreck: [wreckVox, 1.5],
};
const VARIANTS = {
    island: islandVox, rock: (s) => rockVox(s), mesa: mesaVox, building: buildingVox, pine: pineVox, snowrock: snowRockVox, asteroid: asteroidVox, debris: debrisVox,
};
const cache = {};
/** モデルを取り出す。name か "island:3" のように種番号つき */
export function model(name) {
    if (cache[name]) return cache[name];
    const [base, seed] = name.split(":");
    let vox, px = 1.5;
    if (DEFS[base]) { vox = DEFS[base][0](); px = DEFS[base][1]; }
    else if (VARIANTS[base]) vox = VARIANTS[base](Number(seed) || 1);
    else throw new Error(`unknown model ${name}`);
    cache[name] = compile(vox, { px, name });
    return cache[name];
}

/** 変形の部位ごとの動き出しのずれ */
export const MORPH_DELAYS = { body: 0, leg: 0.06, legL: 0.06, legR: 0.06, head: 0.18, armL: 0.12, armR: 0.12, wingL: 0.22, wingR: 0.22, finL: 0.3, finR: 0.3, gun: 0.34 };

/**
 * Dungeon Heart: セラの立ち絵(ドット絵を Canvas 2D の矩形で描く)
 *   drawSera(g, x, y, scale, { weapon, armor, acc }, t, state)
 *   state: { hp, maxHp, pose: "stand" | "victory" | "flinch", blink }   (省略可)
 * 40×60 マスの絵。青い髪・ダークブラウンの目。
 * - 表情: HP が半分より上=笑顔 / 半分以下=困り顔と汗 / 4分の1以下=痛そう(片目をつぶる・歯を食いしばる)
 * - ポーズ: HP 5 以下は片膝をつく(剣を床に突き立てる)/ 勝ったとき=武器を掲げる / 攻撃を受けたとき=目をぎゅっとつぶる
 * - 鎧は look の部品(肩・胸・腰・足・頭)で形が変わる。武器も種類ごとに形が違う
 */

const HAIR = "#3a68d8", HAIR_D = "#22409a", HAIR_L = "#78a8f8";
const SKIN = "#f8c8a0", SKIN_D = "#d89870";
const EYE = "#3a2418", MOUTH = "#c85060", BLUSH = "#f8a0a0";
const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export const PORTRAIT_W = 40, PORTRAIT_H = 60;

/** HP から表情とポーズを決める */
export function seraMood(state = {}) {
    const known = Number.isFinite(state.hp);
    const hp = known ? state.hp : 999, max = Number.isFinite(state.maxHp) ? state.maxHp : hp;
    const ratio = max > 0 ? hp / max : 1;
    const kneel = known && hp <= 5;
    let face = ratio > 0.5 ? "fine" : ratio > 0.25 ? "worried" : "pain";
    if (state.pose === "victory") face = "happy";
    if (state.pose === "flinch") face = "flinch";
    const pose = kneel && state.pose !== "victory" ? "kneel" : state.pose === "victory" ? "victory" : "stand";
    return { face, pose, ratio };
}

export function drawSera(g, ox, oy, s, eq = {}, t = 0, state = {}) {
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(ox + x * s, oy + y * s, w * s, h * s); };
    const { face, pose } = seraMood(state);
    const dy = pose === "kneel" ? 8 : 0; // 片膝のときは上半身が下がる
    const U = (x, y, w, h, c) => r(x, y + dy, w, h, c);
    const armor = eq.armor?.look || { kind: "none" };
    const weapon = eq.weapon?.look || null;
    const acc = eq.acc?.look || null;
    const robe = armor.kind === "robe";
    const blink = state.blink || false;

    // ---- 1. 後ろのもの(マント・フード・後ろ髪) ----
    if (acc?.kind === "cape") {
        const len = pose === "kneel" ? 30 : 34;
        U(11, 17, 18, len, shade(acc.main, 0.75));
        U(12, 18, 16, len - 2, acc.main);
        for (let x = 12; x < 28; x += 3) U(x, 17 + len - 1, 2, 1, shade(acc.main, 0.55)); // すその切れ込み
    }
    if (robe && armor.hood) { U(12, 1, 16, 17, shade(armor.main, 0.8)); U(13, 2, 14, 15, armor.main); }
    U(12, 5, 16, 32, HAIR_D);
    U(13, 5, 14, 31, HAIR);
    if (face === "pain") { U(12, 35, 2, 3, HAIR_D); U(27, 34, 1, 3, HAIR_D); } // 乱れた髪

    // ---- 2. 脚 ----
    drawLegs(r, pose, armor, robe);

    // ---- 3. 胴・首・腕 ----
    U(15, 17, 11, 12, SKIN);
    U(16, 27, 9, 6, SKIN);
    U(15, 33, 11, 6, SKIN);
    U(18, 14, 5, 4, SKIN); U(18, 16, 5, 1, SKIN_D);
    // 左腕(画面の左)
    U(12, 18, 3, 16, SKIN); U(12, 18, 1, 16, SKIN_D);
    U(12, 34, 3, 2, SKIN);
    // 右腕: 勝ちポーズでは上に掲げる
    if (pose === "victory") { r(26, 6, 3, 13, SKIN); r(28, 6, 1, 13, SKIN_D); r(26, 4, 3, 2, SKIN); }
    else { U(26, 18, 3, 16, SKIN); U(28, 18, 1, 16, SKIN_D); }

    // ---- 4. 鎧 / ローブ(上半身) ----
    if (armor.kind === "bikini") drawBikini(U, armor, t, pose);
    else if (robe) drawRobe(U, r, armor, pose);

    // ---- 5. 頭と表情 ----
    U(14, 4, 12, 11, SKIN);
    U(15, 15, 10, 1, SKIN);
    U(14, 14, 1, 1, SKIN_D); U(25, 14, 1, 1, SKIN_D);
    drawFace(U, face, blink);
    // 前髪・横髪
    U(13, 2, 14, 4, HAIR);
    U(14, 1, 12, 1, HAIR);
    U(15, 2, 4, 1, HAIR_L);
    [14, 15, 17, 19, 21, 23, 24, 25].forEach((x, i) => U(x, 6, 1, i % 2 ? 1 : 2, HAIR));
    U(12, 4, 2, 20, HAIR); U(26, 4, 2, 20, HAIR);
    U(12, 4, 1, 20, HAIR_D); U(27, 4, 1, 20, HAIR_D);
    U(13, 24, 1, 2, HAIR); U(26, 24, 1, 2, HAIR);
    if (face === "pain") { U(16, 6, 1, 3, HAIR); U(23, 6, 1, 3, HAIR); } // 前髪が乱れる

    // ---- 6. 頭の飾り(鎧の部品・装飾品) ----
    if (armor.head === "horns") { U(13, 1, 14, 2, armor.trim); U(12, -1, 2, 3, armor.trim); U(26, -1, 2, 3, armor.trim); U(11, -2, 1, 2, armor.trim); U(28, -2, 1, 2, armor.trim); }
    if (armor.head === "circlet") { U(14, 3, 12, 1, armor.trim); U(19, 2, 2, 2, armor.gem || armor.trim); }
    if (armor.head === "star") { U(14, 3, 12, 1, armor.trim); U(19, 0, 3, 3, armor.gem); U(20, -1, 1, 5, armor.gem); }
    if (robe && armor.hood) { U(12, 2, 2, 14, armor.main); U(26, 2, 2, 14, armor.main); U(13, 1, 14, 1, armor.main); } // フードのふち
    if (acc?.kind === "tiara") { U(15, 3, 11, 1, acc.main); U(19, 2, 3, 1, acc.main); U(20, 1, 1, 2, acc.gem || "#58a8f8"); }
    if (acc?.kind === "feather") { U(26, 1, 2, 5, acc.main); U(28, 0, 1, 4, acc.main); U(25, 5, 2, 2, acc.gem || "#58c8a8"); }
    if (acc?.kind === "earrings") { U(13, 12, 1, 2, acc.main); U(26, 12, 1, 2, acc.main); U(13, 14, 1, 1, "#ffffff"); }
    if (acc?.kind === "cape") { U(15, 17, 2, 1, "#e8c040"); U(24, 17, 2, 1, "#e8c040"); }

    // ---- 7. 武器 ----
    drawWeapon(g, r, U, weapon, pose, t);
}

function drawLegs(r, pose, armor, robe) {
    const B = armor.kind === "bikini" ? armor : null;
    if (pose === "kneel") {
        // 左脚(画面左): ももは前へ、すねは下へ(立てひざ)
        r(10, 45, 9, 4, SKIN); r(10, 45, 9, 1, SKIN_D);
        r(10, 49, 4, 9, SKIN); r(13, 49, 1, 9, SKIN_D);
        // 右脚: ひざを床につき、すねは後ろへ
        r(21, 45, 4, 9, SKIN); r(21, 45, 1, 9, SKIN_D);
        r(21, 54, 10, 4, SKIN); r(21, 57, 10, 1, SKIN_D);
        if (B) {
            const D = shade(B.main, 0.7);
            r(10, 50, 4, 8, B.main); r(10, 50, 4, 1, B.trim); r(10, 57, 4, 1, D);
            r(24, 54, 7, 4, B.main); r(24, 54, 7, 1, B.trim);
            r(20, 52, 5, 3, B.trim); // ひざ当て
        }
        if (robe) { r(9, 44, 18, 8, armor.main); r(9, 51, 18, 1, armor.trim); }
        return;
    }
    r(15, 38, 4, 20, SKIN); r(22, 38, 4, 20, SKIN);
    r(18, 38, 1, 20, SKIN_D); r(22, 38, 1, 20, SKIN_D);
    if (B) drawBoots(r, B);
}

function drawBoots(r, A) {
    const M = A.main, T = A.trim, D = shade(M, 0.7);
    const style = A.boots || "greave";
    if (style === "sandal") {                       // 革ひものサンダル
        [52, 54, 56].forEach((y) => { r(15, y, 4, 1, T); r(22, y, 4, 1, T); });
        r(15, 57, 4, 1, M); r(22, 57, 4, 1, M);
        return;
    }
    const top = style === "gold" ? 46 : 49;
    r(15, top, 4, 58 - top, M); r(22, top, 4, 58 - top, M);
    r(15, top, 4, 1, T); r(22, top, 4, 1, T); r(15, 57, 4, 1, D); r(22, 57, 4, 1, D);
    if (style === "greave") { r(15, 48, 4, 2, T); r(22, 48, 4, 2, T); }              // ひざ当て
    if (style === "scale") { for (let y = top + 2; y < 57; y += 2) { r(16, y, 2, 1, D); r(23, y, 2, 1, D); } r(14, top, 1, 2, T); r(26, top, 1, 2, T); }
    if (style === "gold") { r(14, top - 1, 6, 1, "#f8f8f8"); r(21, top - 1, 6, 1, "#f8f8f8"); r(16, top + 4, 2, 2, A.gem || T); r(23, top + 4, 2, 2, A.gem || T); }
    if (style === "crystal") { r(15, top, 4, 58 - top, shade(M, 1.1)); r(16, top + 2, 1, 6, "#ffffff"); r(23, top + 2, 1, 6, "#ffffff"); r(17, 54, 1, 1, A.gem); r(24, 54, 1, 1, A.gem); }
}

function drawBikini(U, A, t, pose) {
    const M = A.main, T = A.trim, D = shade(M, 0.7);
    // 胸当て
    const chest = A.chest || "band";
    if (chest === "band") {                          // 布と革ひも
        U(15, 21, 11, 3, M); U(15, 23, 11, 1, D); U(19, 20, 3, 1, T); U(16, 20, 1, 1, T); U(24, 20, 1, 1, T);
    } else {
        U(16, 20, 9, 1, T);
        U(15, 21, 5, 4, M); U(21, 21, 5, 4, M);
        U(15, 24, 5, 1, D); U(21, 24, 5, 1, D);
        U(19, 21, 3, 3, T);
        if (chest === "scale") { [[16, 22], [18, 22], [22, 22], [24, 22], [17, 23], [23, 23]].forEach(([x, y]) => U(x, y, 1, 1, D)); }
        if (chest === "ornate") { U(15, 21, 5, 1, T); U(21, 21, 5, 1, T); U(19, 25, 3, 2, T); }
        if (chest === "crystal") { U(16, 21, 2, 2, "#ffffff"); U(22, 21, 2, 2, "#ffffff"); }
        if (A.gem) U(20, 22, 1, 1, A.gem);
    }
    // 肩
    const sh = A.shoulder || "none";
    if (sh === "round") { U(11, 17, 5, 4, M); U(25, 17, 5, 4, M); U(11, 17, 5, 1, T); U(25, 17, 5, 1, T); U(11, 20, 5, 1, D); U(25, 20, 5, 1, D); U(13, 18, 1, 1, A.gem || T); U(27, 18, 1, 1, A.gem || T); }
    if (sh === "spike") { U(10, 17, 6, 4, M); U(25, 17, 6, 4, M); U(10, 17, 6, 1, T); U(25, 17, 6, 1, T); U(9, 15, 1, 2, T); U(11, 14, 1, 3, T); U(30, 15, 1, 2, T); U(28, 14, 1, 3, T); }
    if (sh === "wing") {
        U(11, 17, 5, 4, M); U(25, 17, 5, 4, M); U(11, 17, 5, 1, T); U(25, 17, 5, 1, T);
        U(7, 13, 4, 6, "#f8f8f8"); U(8, 12, 2, 1, "#f8f8f8"); U(29, 13, 4, 6, "#f8f8f8"); U(30, 12, 2, 1, "#f8f8f8");
        U(8, 15, 1, 3, "#d0d0d8"); U(31, 15, 1, 3, "#d0d0d8");
    }
    if (sh === "crystal") { // 浮かぶ水晶
        const f = Math.round(Math.sin(t * 2.5));
        U(9, 15 + f, 3, 4, M); U(10, 14 + f, 1, 1, M); U(10, 16 + f, 1, 2, "#ffffff");
        U(28, 15 - f, 3, 4, M); U(29, 14 - f, 1, 1, M); U(29, 16 - f, 1, 2, "#ffffff");
    }
    if (sh === "none") { U(15, 18, 1, 3, T); U(25, 18, 1, 3, T); } // 肩ひもだけ
    // 籠手
    if (A.gauntlet !== false) { U(12, 29, 3, 5, M); U(12, 29, 3, 1, T); }
    if (A.gauntlet !== false && pose !== "victory") { U(26, 29, 3, 5, M); U(26, 29, 3, 1, T); }
    // 腰
    U(15, 32, 11, 2, T);
    if (A.gem) U(20, 32, 1, 2, A.gem);
    const sk = A.skirt || "loin";
    if (sk === "loin") { U(17, 34, 7, 7, shade(M, 0.85)); U(18, 40, 5, 1, D); U(17, 34, 1, 7, D); }            // 布の前垂れ
    if (sk === "plates") { U(15, 34, 3, 4, M); U(18, 34, 5, 6, M); U(23, 34, 3, 4, M); U(15, 37, 3, 1, T); U(18, 39, 5, 1, T); U(23, 37, 3, 1, T); }
    if (sk === "scale") { U(15, 34, 11, 5, M); for (let x = 15; x < 26; x += 2) U(x, 38, 1, 2, D); U(19, 39, 3, 3, M); }
    if (sk === "tabard") { U(17, 34, 7, 12, "#f8f8f0"); U(17, 34, 7, 1, T); U(17, 45, 7, 1, T); U(19, 38, 3, 3, A.gem || T); U(15, 34, 2, 3, M); U(24, 34, 2, 3, M); }
    if (sk === "crystal") {
        U(15, 34, 11, 6, shade(M, 1.05)); U(15, 34, 11, 1, T);
        [[16, 36], [19, 37], [23, 35], [21, 38]].forEach(([x, y]) => U(x, y, 1, 1, "#ffffff"));
        if (Math.sin(t * 4) > -0.3) { U(17, 39, 1, 1, A.gem); U(24, 37, 1, 1, A.gem); }
    }
}

function drawRobe(U, r, A, pose) {
    const M = A.main, T = A.trim, D = shade(M, 0.75);
    U(14, 17, 13, 14, M);
    if (pose === "kneel") { U(13, 31, 15, 7, M); }
    else { U(13, 31, 15, 26, M); U(13, 56, 15, 2, T); U(20, 20, 1, 36, T); }
    U(14, 17, 13, 1, T);
    U(10, 18, 5, 17, M); U(10, 18, 1, 17, D); U(10, 33, 5, 2, T);          // 左の袖(広い)
    if (pose !== "victory") { U(26, 18, 5, 17, M); U(30, 18, 1, 17, D); U(26, 33, 5, 2, T); }
    else { r(26, 8, 4, 11, M); r(26, 8, 4, 1, T); }
    U(15, 31, 11, 1, T);
    if (A.gem) U(20, 31, 1, 1, A.gem);
    if (A.emblem === "leaf") { U(17, 22, 1, 3, T); U(16, 23, 3, 1, T); U(23, 22, 1, 3, T); U(22, 23, 3, 1, T); [[16, 40], [24, 44], [16, 50]].forEach(([x, y]) => pose !== "kneel" && U(x, y, 1, 1, T)); }
    if (A.emblem === "moon") { U(18, 22, 3, 3, T); U(19, 22, 2, 2, M); [[16, 40], [24, 44], [16, 50], [24, 36]].forEach(([x, y]) => pose !== "kneel" && U(x, y, 1, 1, A.gem || T)); }
    if (A.collar) { U(15, 13, 11, 4, T); U(16, 14, 9, 2, M); }
}

function drawFace(U, face, blink) {
    // まゆ
    if (face === "worried" || face === "pain") { U(15, 8, 1, 1, HAIR_D); U(16, 7, 2, 1, HAIR_D); U(22, 7, 2, 1, HAIR_D); U(24, 8, 1, 1, HAIR_D); }
    else { U(15, 8, 3, 1, HAIR_D); U(22, 8, 3, 1, HAIR_D); }
    // 目
    if (face === "happy") { U(16, 10, 1, 1, EYE); U(17, 9, 1, 1, EYE); U(18, 10, 1, 1, EYE); U(21, 10, 1, 1, EYE); U(22, 9, 1, 1, EYE); U(23, 10, 1, 1, EYE); }
    else if (face === "flinch") { U(16, 9, 2, 1, EYE); U(17, 10, 1, 1, EYE); U(22, 9, 2, 1, EYE); U(22, 10, 1, 1, EYE); }
    else if (blink) { U(16, 10, 2, 1, EYE); U(22, 10, 2, 1, EYE); }
    else if (face === "pain") { U(16, 10, 2, 1, EYE); U(22, 9, 2, 2, EYE); U(22, 9, 1, 1, "#f8f8f8"); } // 片目をつぶる
    else { U(16, 9, 2, 2, EYE); U(22, 9, 2, 2, EYE); U(16, 9, 1, 1, "#f8f8f8"); U(22, 9, 1, 1, "#f8f8f8"); }
    // 口
    if (face === "fine") { U(19, 13, 2, 1, MOUTH); U(18, 12, 1, 1, MOUTH); U(21, 12, 1, 1, MOUTH); }
    else if (face === "happy") { U(18, 12, 4, 2, MOUTH); U(19, 12, 2, 1, "#ffffff"); }
    else if (face === "worried") { U(19, 13, 3, 1, MOUTH); }
    else if (face === "pain") { U(18, 12, 4, 2, "#601818"); U(18, 12, 4, 1, "#ffffff"); }
    else if (face === "flinch") { U(19, 12, 2, 2, "#601818"); }
    // ほお・汗・傷
    U(15, 11, 1, 1, face === "pain" || face === "flinch" ? "#f86060" : BLUSH); U(24, 11, 1, 1, face === "pain" || face === "flinch" ? "#f86060" : BLUSH);
    if (face === "worried" || face === "pain") { U(26, 7, 1, 2, "#a8e0ff"); U(26, 9, 1, 1, "#e8f8ff"); }
    if (face === "pain") { U(23, 13, 2, 1, "#e07070"); }
}

function drawWeapon(g, r, U, W, pose, t) {
    if (!W) { if (pose !== "victory") U(26, 34, 3, 2, SKIN); return; }
    const B = W.blade;
    // 位置: ふつう=右手に縦、勝ち=頭上に掲げる、片膝=床に突き立てる
    let x = 29, top = 8, len = 26, handY = 34;
    if (pose === "victory") { x = 26; top = -2; len = 8; handY = 4; }
    if (pose === "kneel") { top = 34; len = 24; handY = 30 + 8; }
    const R = pose === "victory" ? r : (pose === "kneel" ? r : U);
    const kind = W.kind;
    if (kind === "sword") {
        if (W.glow) { glowRect(g, R, x - 1, top - 1, 4, len + 2, W.glow, t); }
        R(x, top, 2, len, B); R(x, top, 1, len, shade(B, 1.15));
        if (W.flame) { for (let i = 0; i < len; i += 4) R(x - 1 + ((i / 4) % 2) * 3, top + i + Math.round(Math.sin(t * 8 + i)), 1, 2, W.glow || "#ffd060"); }
        if (W.zig) { for (let i = 0; i < len; i += 3) R(x + (i % 2 ? 2 : -1), top + i, 1, 2, B); }
        const gy = pose === "kneel" ? top - 1 : top + len;
        if (W.star) { R(x - 2, gy, 6, 1, "#f8e050"); R(x, gy - 1, 2, 3, "#f8e050"); R(x - 1, gy + 1, 1, 1, "#f8e050"); R(x + 2, gy + 1, 1, 1, "#f8e050"); }
        else R(x - 2, gy, 6, 1, "#e8c040");
        const hy = pose === "kneel" ? top - 4 : top + len + 1;
        R(x, hy, 2, 3, "#7a4a22");
    } else if (kind === "staff") {
        const sx = x, sTop = pose === "victory" ? -2 : pose === "kneel" ? 22 : 10, sLen = pose === "victory" ? 18 : pose === "kneel" ? 36 : 48;
        R(sx, sTop + 4, 2, sLen, "#7a4a22"); R(sx, sTop + 4, 1, sLen, "#9a6a3a");
        if (W.glow) glowRect(g, R, sx - 2, sTop - 2, 6, 8, W.glow, t);
        R(sx - 1, sTop, 4, 4, B); R(sx, sTop - 1, 2, 1, B); R(sx - 1, sTop, 1, 2, "#ffffff");
        R(sx - 2, sTop + 1, 1, 2, B); R(sx + 3, sTop + 1, 1, 2, B); // 水晶の房
    } else if (kind === "spear") {
        const sTop = pose === "victory" ? -2 : pose === "kneel" ? 18 : 4, sLen = pose === "victory" ? 20 : pose === "kneel" ? 40 : 54;
        R(x, sTop + 5, 2, sLen, "#4a4a58"); R(x, sTop + 5, 1, sLen, "#6a6a78");
        if (W.glow) glowRect(g, R, x - 2, sTop - 1, 6, 7, W.glow, t);
        R(x - 1, sTop + 1, 4, 4, B); R(x, sTop, 2, 1, B);
        if (W.zig) { R(x - 2, sTop + 2, 1, 1, B); R(x + 3, sTop + 3, 1, 1, B); if (Math.sin(t * 9) > 0.3) { R(x - 3, sTop + 4, 1, 1, "#ffffff"); R(x + 4, sTop + 1, 1, 1, "#ffffff"); } }
        R(x - 1, sTop + 5, 4, 1, "#e8c040");
    }
    // 握る手
    if (pose === "victory") r(26, 3, 3, 2, SKIN);
    else if (pose === "kneel") r(28, 30, 3, 2, SKIN);
    else U(27, handY, 3, 2, SKIN);
}
/** 光る武器: ゆらぐ半透明の光 */
function glowRect(g, R, x, y, w, h, color, t) {
    const prev = g.globalAlpha;
    g.globalAlpha = 0.3 + 0.25 * Math.sin(t * 5);
    R(x, y, w, h, color);
    g.globalAlpha = prev;
}

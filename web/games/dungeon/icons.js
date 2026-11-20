/**
 * Dungeon Heart: 手に入れたものの絵(16×16 マスのドット絵、Canvas 2D の矩形で描く)
 *   drawItemIcon(g, x, y, scale, loot)   loot = parseLoot() の結果({ kind, id } / { kind: "gold", amount })
 * 装備は items.js の look の色と部品で描くので、同じ種類でも色や形が変わる。
 */
import { EQUIP } from "./items.js";

const GEM_COLOR = { ruby: ["#f83848", "#ff98a0"], sapphire: ["#3870f8", "#a0c8ff"], emerald: ["#28c868", "#a0f0c0"], amethyst: ["#a050e8", "#e0b8ff"] };

export function drawItemIcon(g, ox, oy, s, loot) {
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(ox + x * s, oy + y * s, w * s, h * s); };
    if (!loot) return;
    if (loot.kind === "gem") {
        const [c, l] = GEM_COLOR[loot.id] || ["#f8f8f8", "#ffffff"];
        r(5, 3, 6, 1, l); r(4, 4, 8, 2, c); r(3, 6, 10, 2, c); r(4, 8, 8, 2, c); r(5, 10, 6, 2, c); r(6, 12, 4, 1, c); r(7, 13, 2, 1, c);
        r(5, 4, 2, 2, l); r(6, 6, 1, 3, "#ffffff");
        return;
    }
    if (loot.kind === "gold") {
        [[3, 9], [7, 9], [5, 6], [9, 7], [11, 10], [6, 11]].forEach(([x, y]) => { r(x, y, 4, 3, "#e8b830"); r(x, y, 4, 1, "#f8e070"); r(x + 1, y + 1, 2, 1, "#c08820"); });
        return;
    }
    if (loot.kind === "treasure") {
        if (loot.id === "crown") { r(2, 6, 12, 6, "#e8c040"); r(2, 3, 2, 3, "#e8c040"); r(7, 2, 2, 4, "#e8c040"); r(12, 3, 2, 3, "#e8c040"); r(2, 10, 12, 2, "#c89820"); r(4, 8, 2, 2, "#f83848"); r(7, 7, 2, 2, "#3870f8"); r(10, 8, 2, 2, "#28c868"); r(7, 1, 2, 1, "#f8f8f8"); }
        if (loot.id === "chalice") { r(3, 2, 10, 2, "#f8e070"); r(4, 4, 8, 4, "#e8c040"); r(5, 8, 6, 1, "#c89820"); r(7, 9, 2, 3, "#e8c040"); r(4, 12, 8, 2, "#e8c040"); r(5, 4, 2, 3, "#f8f0a0"); r(7, 5, 2, 2, "#f83848"); }
        if (loot.id === "necklace") { for (let i = 0; i < 9; i++) { const a = Math.PI * (0.1 + i * 0.1); r(Math.round(8 + Math.cos(a) * 6) - 1, Math.round(3 + Math.sin(a) * 8), 2, 2, "#f8f0f0"); } r(7, 12, 2, 3, "#f878b8"); }
        if (loot.id === "coins") { r(2, 6, 12, 8, "#7a4a22"); r(2, 6, 12, 1, "#9a6232"); [[3, 4], [6, 3], [9, 4], [5, 5], [8, 5]].forEach(([x, y]) => r(x, y, 3, 2, "#f8e070")); r(2, 9, 12, 1, "#e8c040"); }
        return;
    }
    if (loot.kind === "item") {
        if (loot.id === "herb") { r(7, 8, 2, 7, "#3a7a28"); r(3, 4, 5, 4, "#58c848"); r(9, 2, 5, 5, "#58c848"); r(4, 9, 4, 3, "#48a838"); r(5, 5, 1, 1, "#a0f080"); }
        if (loot.id === "ether") { r(6, 2, 4, 2, "#a07040"); r(7, 4, 2, 2, "#c8e8f8"); r(4, 6, 8, 8, "#58a8f8"); r(5, 7, 2, 4, "#c8e8ff"); r(4, 13, 8, 1, "#3878c8"); }
        if (loot.id === "key") { r(3, 3, 6, 6, "#e8c040"); r(5, 5, 2, 2, "#000010"); r(8, 6, 6, 2, "#e8c040"); r(11, 8, 1, 3, "#e8c040"); r(13, 8, 1, 2, "#e8c040"); }
        if (loot.id === "heart") { r(3, 4, 4, 3, "#f85898"); r(9, 4, 4, 3, "#f85898"); r(2, 5, 12, 4, "#f85898"); r(3, 9, 10, 2, "#f85898"); r(5, 11, 6, 2, "#f85898"); r(7, 13, 2, 1, "#f85898"); r(4, 5, 2, 2, "#ffc0d8"); }
        return;
    }
    if (loot.kind !== "equip") return;
    const it = EQUIP[loot.id];
    const L = it?.look || {};
    if (it.slot === "weapon") {
        const B = L.blade || "#c8c8d0";
        if (L.kind === "sword") {
            for (let i = 0; i < 9; i++) r(12 - i, 1 + i, 2, 2, B);
            if (L.flame) [[13, 0], [10, 2], [8, 5], [5, 6]].forEach(([x, y]) => r(x, y, 1, 2, "#ffd060"));
            if (L.star) { r(3, 9, 5, 1, "#f8e050"); r(5, 7, 1, 5, "#f8e050"); } else r(2, 10, 6, 2, "#e8c040");
            r(1, 12, 3, 3, "#7a4a22");
        } else if (L.kind === "staff") {
            for (let i = 0; i < 10; i++) r(11 - i, 5 + i, 2, 1, "#7a4a22");
            r(10, 1, 5, 5, B); r(11, 0, 3, 1, B); r(11, 2, 1, 2, "#ffffff");
        } else if (L.kind === "spear") {
            for (let i = 0; i < 12; i++) r(12 - i, 3 + i, 1, 1, "#5a5a68");
            r(12, 0, 4, 4, B); r(11, 3, 2, 2, "#e8c040");
            if (L.zig) { r(14, 4, 1, 1, "#ffffff"); r(10, 0, 1, 1, "#ffffff"); }
        }
        return;
    }
    if (it.slot === "armor") {
        const M = L.main || "#888", T = L.trim || "#ccc";
        if (L.kind === "robe") {
            r(5, 1, 6, 3, L.hood ? M : "#00000000"); r(4, 3, 8, 11, M); r(2, 4, 3, 7, M); r(11, 4, 3, 7, M); r(4, 13, 8, 1, T); r(7, 4, 2, 9, T); r(4, 7, 8, 1, T);
            if (L.collar) r(5, 2, 6, 2, T);
            return;
        }
        // 胸当て+腰当て(部品で形を変える)
        r(2, 2, 5, 4, M); r(9, 2, 5, 4, M); r(7, 3, 2, 2, T); r(2, 5, 5, 1, T); r(9, 5, 5, 1, T);
        if (L.gem) r(7, 3, 2, 2, L.gem);
        if (L.shoulder === "spike") { r(0, 0, 2, 3, T); r(14, 0, 2, 3, T); }
        if (L.shoulder === "round") { r(0, 2, 2, 3, T); r(14, 2, 2, 3, T); }
        if (L.shoulder === "wing") { r(0, 0, 2, 5, "#f8f8f8"); r(14, 0, 2, 5, "#f8f8f8"); }
        if (L.shoulder === "crystal") { r(0, 1, 1, 3, "#ffffff"); r(15, 1, 1, 3, "#ffffff"); }
        r(3, 8, 10, 2, T);
        if (L.skirt === "tabard") { r(6, 10, 4, 6, "#f8f8f0"); r(7, 12, 2, 2, L.gem || T); }
        else if (L.skirt === "loin") { r(6, 10, 4, 5, M); }
        else { r(3, 10, 3, 4, M); r(6, 10, 4, 5, M); r(10, 10, 3, 4, M); }
        if (L.chest === "scale") [[3, 3], [5, 4], [10, 3], [12, 4]].forEach(([x, y]) => r(x, y, 1, 1, "#00000060"));
        return;
    }
    // 装飾品
    const M = L.main || "#ddd";
    if (L.kind === "tiara") { r(2, 8, 12, 2, M); r(4, 6, 2, 2, M); r(7, 4, 2, 4, M); r(10, 6, 2, 2, M); r(7, 3, 2, 2, L.gem || "#58a8f8"); }
    if (L.kind === "cape") { r(4, 2, 8, 2, "#e8c040"); r(3, 4, 10, 10, M); r(2, 10, 12, 4, M); [3, 6, 9, 12].forEach((x) => r(x, 13, 1, 1, "#000010")); }
    if (L.kind === "feather") { for (let i = 0; i < 10; i++) r(4 + i, 12 - i, 2, 2, M); r(3, 12, 3, 3, L.gem || "#58c8a8"); r(8, 6, 1, 1, "#d0d0d8"); }
    if (L.kind === "earrings") { r(4, 3, 1, 3, "#e8c040"); r(11, 3, 1, 3, "#e8c040"); r(3, 6, 3, 3, M); r(10, 6, 3, 3, M); r(4, 9, 1, 1, M); r(11, 9, 1, 1, M); }
}

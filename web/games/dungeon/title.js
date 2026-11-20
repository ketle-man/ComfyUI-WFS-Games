/**
 * Dungeon Heart: タイトル画面
 *   const title = createTitle(); title.draw(g, t, { W, H, font, eq, state, labels, sel, disabled, subtitle, hint })
 * 320×200 の低い解像度の Canvas に場面を描いて、2倍に拡大して貼る(ドット感を残す)。
 * 場面: 夜空(グラデーション・月・またたく星・流れ星)、遠くの山、丘、星の井戸(石の井戸から光の柱と光の粒)、
 *       両わきのたいまつ、井戸のそばに立つセラ(セーブがあればその装備)。
 * ロゴ・メニューは等倍で描く(文字を読みやすく)。
 */
import { drawSera } from "./portrait.js";

const LW = 320, LH = 200;

function rand(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function createTitle() {
    const low = document.createElement("canvas");
    low.width = LW; low.height = LH;
    const c = low.getContext("2d");
    const r = rand(42);
    const stars = Array.from({ length: 90 }, () => ({ x: Math.floor(r() * LW), y: Math.floor(r() * 120), s: r() < 0.12 ? 2 : 1, ph: r() * 6.28, sp: 0.8 + r() * 2.5, gold: r() < 0.15 }));
    // 遠くの山(2層)
    const ridge = (seed, base, amp) => { const rr = rand(seed); const pts = []; let y = base; for (let x = 0; x <= LW; x += 4) { y += (rr() - 0.5) * amp; y = Math.max(base - amp * 2, Math.min(base + amp, y)); pts.push(y); } return pts; };
    const far = ridge(7, 118, 6), near = ridge(11, 136, 7);
    // 丘の草
    const tufts = Array.from({ length: 40 }, () => ({ x: Math.floor(r() * LW), y: 160 + Math.floor(r() * 38), h: 2 + Math.floor(r() * 3) }));
    const motes = Array.from({ length: 26 }, () => ({ x: 160 + (r() - 0.5) * 30, y: 140 - r() * 120, sp: 8 + r() * 18, ph: r() * 6.28 }));
    let shoot = { t: -1, x: 0, y: 0 };

    function px(x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }

    function drawScene(t, eq, state) {
        // ---- 空 ----
        const bands = ["#03031a", "#06062a", "#0c0a38", "#160e46", "#221250", "#321858", "#46205e"];
        bands.forEach((col, i) => px(0, i * 20, LW, 21, col));
        // ディザでバンドの境目をなじませる
        for (let i = 1; i < bands.length; i++) for (let x = (i % 2); x < LW; x += 2) px(x, i * 20 - 1, 1, 1, bands[i]);
        // 月
        const mx = 26, my = 22;
        c.fillStyle = "rgba(255,240,200,0.10)"; c.beginPath(); c.arc(mx, my, 26, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,240,200,0.16)"; c.beginPath(); c.arc(mx, my, 20, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#f8f0d0"; c.beginPath(); c.arc(mx, my, 15, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#e0d4b0"; [[-5, -4, 3], [4, 3, 4], [-2, 6, 2], [6, -6, 2]].forEach(([dx, dy, rr]) => { c.beginPath(); c.arc(mx + dx, my + dy, rr, 0, Math.PI * 2); c.fill(); });
        // 星
        stars.forEach((s) => {
            const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
            c.globalAlpha = a;
            px(s.x, s.y, s.s, s.s, s.gold ? "#f8e070" : "#e8e8ff");
            if (s.s === 2 && a > 0.85) { px(s.x - 1, s.y, 4, 1, "#ffffff"); px(s.x, s.y - 1, 1, 4, "#ffffff"); }
            c.globalAlpha = 1;
        });
        // 流れ星(数秒おき)
        if (shoot.t < 0 && Math.random() < 0.006) shoot = { t: 0, x: 40 + Math.random() * 180, y: 10 + Math.random() * 40 };
        if (shoot.t >= 0) {
            shoot.t += 1 / 60;
            const e = shoot.t / 0.7;
            for (let k = 0; k < 14; k++) { c.globalAlpha = (1 - k / 14) * (1 - e); px(shoot.x + e * 90 - k * 3, shoot.y + e * 35 - k * 1.2, 2, 1, "#ffffff"); }
            c.globalAlpha = 1;
            if (e >= 1) shoot.t = -1;
        }
        // ---- 山 ----
        const ridgeFill = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, LH); pts.forEach((y, i) => c.lineTo(i * 4, y)); c.lineTo(LW, LH); c.fill(); };
        ridgeFill(far, "#1a1236");
        ridgeFill(near, "#120c26");
        // ---- 丘 ----
        c.fillStyle = "#0c1a14"; c.beginPath(); c.moveTo(0, LH); c.lineTo(0, 158); c.quadraticCurveTo(160, 138, LW, 160); c.lineTo(LW, LH); c.fill();
        tufts.forEach((tf) => { px(tf.x, tf.y, 1, tf.h, "#1e3a26"); px(tf.x + 1, tf.y + 1, 1, tf.h - 1, "#2a4a30"); });
        // ---- 光の柱(井戸から) ----
        const glow = 0.5 + 0.2 * Math.sin(t * 1.7);
        c.globalCompositeOperation = "lighter";
        for (let i = 0; i < 6; i++) { c.globalAlpha = (0.05 + i * 0.012) * glow; px(160 - 26 + i * 4, 0, 52 - i * 8, 150, "#78b8ff"); }
        c.globalAlpha = 0.18 * glow; c.fillStyle = "#a8d8ff"; c.beginPath(); c.ellipse(160, 140, 48, 14, 0, 0, Math.PI * 2); c.fill();
        // 光の粒(上へ)
        motes.forEach((m) => {
            const y = ((m.y - t * m.sp) % 140 + 140) % 140;
            c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + m.ph));
            px(m.x + Math.sin(t + m.ph) * 4, y, 1, 1, Math.sin(m.ph) > 0 ? "#ffffff" : "#f8e070");
        });
        c.globalAlpha = 1;
        c.globalCompositeOperation = "source-over";
        // ---- 星の井戸(石の井戸と柱・屋根) ----
        drawWell(t);
        // ---- たいまつ ----
        [96, 224].forEach((tx, i) => drawTorch(tx, 118, t + i * 1.3));
        // ---- セラ ----
        drawSera(c, 46, 98, 1, eq, t, state);
        // 足元の影
        c.globalAlpha = 0.4; c.fillStyle = "#000"; c.beginPath(); c.ellipse(66, 158, 14, 3, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    }

    function drawWell(t) {
        const cx = 160, top = 128;
        // 柱と屋根
        px(cx - 40, 92, 5, 40, "#4a3420"); px(cx + 35, 92, 5, 40, "#4a3420");
        px(cx - 40, 92, 1, 40, "#6a4a2a"); px(cx + 35, 92, 1, 40, "#6a4a2a");
        c.fillStyle = "#3a1e18"; c.beginPath(); c.moveTo(cx - 52, 96); c.lineTo(cx, 74); c.lineTo(cx + 52, 96); c.lineTo(cx + 46, 99); c.lineTo(cx, 80); c.lineTo(cx - 46, 99); c.fill();
        for (let i = 0; i < 6; i++) px(cx - 44 + i * 16, 92 - Math.abs(3 - i) * 0, 1, 1, "#000000");
        px(cx - 36, 99, 72, 3, "#5a3a22");                       // はり
        // ロープと桶
        px(cx - 1, 102, 1, 14 + Math.round(Math.sin(t) * 1), "#a88858");
        px(cx - 4, 116 + Math.round(Math.sin(t)), 8, 5, "#6a4a2a"); px(cx - 4, 116 + Math.round(Math.sin(t)), 8, 1, "#9a7a4a");
        // 石の井戸(だ円の石積み)
        c.fillStyle = "#1a1612"; c.beginPath(); c.ellipse(cx, top, 34, 9, 0, 0, Math.PI * 2); c.fill();
        // 穴の中の光
        c.globalCompositeOperation = "lighter";
        c.fillStyle = `rgba(120,190,255,${0.55 + 0.2 * Math.sin(t * 2.2)})`; c.beginPath(); c.ellipse(cx, top, 28, 6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(230,245,255,0.6)"; c.beginPath(); c.ellipse(cx, top, 14, 3, 0, 0, Math.PI * 2); c.fill();
        c.globalCompositeOperation = "source-over";
        // 胴の石積み
        const stones = ["#6a6458", "#5a554a", "#7a7466", "#4e4a40"];
        for (let row = 0; row < 4; row++) {
            for (let k = 0; k < 9; k++) {
                const x = cx - 34 + k * 8 + (row % 2) * 4;
                if (x > cx + 30) continue;
                px(x, top + 2 + row * 6, 7, 5, stones[(k + row * 3) % stones.length]);
                px(x, top + 2 + row * 6, 7, 1, "#8a8476");
            }
        }
        // ふちの石
        for (let k = 0; k < 14; k++) { const a = Math.PI + (k / 13) * Math.PI; px(cx + Math.cos(a) * 34 - 3, top + Math.sin(a) * 9 - 2, 6, 3, stones[k % 4]); }
        px(cx - 36, top - 1, 72, 3, "#7a7466");
        // つた
        [[cx - 30, 4], [cx - 12, 6], [cx + 18, 5], [cx + 28, 3]].forEach(([x, len]) => { for (let i = 0; i < len * 3; i++) px(x + Math.round(Math.sin(i * 0.8) * 1.5), top + 2 + i, 1, 1, i % 3 === 0 ? "#3a8a3a" : "#2a6a2a"); });
    }

    function drawTorch(x, y, t) {
        px(x - 1, y, 3, 40, "#3a2a1a");
        px(x - 3, y - 2, 7, 3, "#6a6a72");
        const f = Math.sin(t * 13) * 0.5 + Math.sin(t * 29) * 0.3;
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = 0.25; c.fillStyle = "#ff9040"; c.beginPath(); c.arc(x, y - 7, 12 + f * 2, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        c.globalCompositeOperation = "source-over";
        px(x - 3, y - 9 + f, 7, 7, "#ff7020"); px(x - 2, y - 13 + f, 5, 5, "#ffa030"); px(x - 1, y - 15 + f * 1.5, 3, 4, "#ffd860"); px(x, y - 9, 1, 3, "#ffffff");
    }

    function draw(g, t, o) {
        const { W, H, font } = o;
        drawScene(t, o.eq, o.state);
        g.imageSmoothingEnabled = false;
        g.drawImage(low, 0, 0, LW, LH, 0, 0, W, H);
        // ---- ロゴ ----
        const ly = 34;
        g.font = font(56); g.textAlign = "center"; g.textBaseline = "top";
        const title = "DUNGEON HEART";
        // 文字を太く見せるため、少しずつずらして重ね書きする
        const bold = (fill, dx = 0, dy = 0, spread = 2) => { g.fillStyle = fill; for (let ox = -spread; ox <= spread; ox++) for (let oy = -1; oy <= 1; oy++) g.fillText(title, W / 2 + dx + ox, ly + dy + oy); };
        bold("#12041a", 5, 6, 3);                                                  // 影
        bold("#3a1050", 0, 0, 4);                                                  // ふち(紫)
        bold("#f8f0ff", 0, -1, 3);                                                 // ふちの光
        const grad = g.createLinearGradient(0, ly, 0, ly + 56);
        grad.addColorStop(0, "#fffbd8"); grad.addColorStop(0.42, "#f8d048"); grad.addColorStop(0.58, "#e89020"); grad.addColorStop(1, "#b85010");
        bold(grad, 0, 0, 2);
        // きらめき(斜めの光が左から右へ)
        const tw = g.measureText(title).width;
        const sweep = ((t * 0.45) % 1.6) - 0.3;
        g.save();
        g.beginPath(); g.rect(W / 2 - tw / 2, ly, tw, 56); g.clip();
        g.globalCompositeOperation = "lighter";
        const sx = W / 2 - tw / 2 + sweep * tw;
        const sg = g.createLinearGradient(sx - 30, 0, sx + 30, 0);
        sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,0.55)"); sg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = sg;
        g.font = font(56);
        for (let ox = -2; ox <= 2; ox++) g.fillText(title, W / 2 + ox, ly);
        g.restore();
        // ハートの飾りと副題
        const heart = (hx, hy, s, col) => { g.fillStyle = col; [[1, 0, 2, 1], [5, 0, 2, 1], [0, 1, 8, 3], [1, 4, 6, 1], [2, 5, 4, 1], [3, 6, 2, 1]].forEach(([x, y, w, h]) => g.fillRect(hx + x * s, hy + y * s, w * s, h * s)); };
        const pulse = 1 + 0.08 * Math.sin(t * 4);
        heart(W / 2 - tw / 2 - 42, ly + 18, 3 * pulse, "#f85898");
        heart(W / 2 + tw / 2 + 18, ly + 18, 3 * pulse, "#f85898");
        g.font = font(20); g.fillStyle = "#000"; g.fillText(o.subtitle, W / 2 + 2, ly + 66 + 2);
        g.fillStyle = "#a8e8ff"; g.fillText(o.subtitle, W / 2, ly + 66);
        // ---- メニュー ----
        const mw = 200, mh = o.labels.length * 28 + 18, mx = W - mw - 26, my = H - mh - 30;
        g.fillStyle = "rgba(0,0,24,0.78)"; g.fillRect(mx, my, mw, mh);
        g.strokeStyle = "#f8f8f8"; g.lineWidth = 2; g.strokeRect(mx + 1, my + 1, mw - 2, mh - 2);
        g.strokeStyle = "#5858a8"; g.strokeRect(mx + 4, my + 4, mw - 8, mh - 8);
        g.textAlign = "left"; g.font = font(18);
        o.labels.forEach((lab, i) => {
            const dis = o.disabled?.[i];
            const on = o.sel === i;
            const y = my + 12 + i * 28;
            if (on && !dis) { g.fillStyle = "rgba(248,208,72,0.18)"; g.fillRect(mx + 8, y - 2, mw - 16, 24); }
            g.fillStyle = dis ? "#505060" : on ? "#ffffff" : "#9898a8";
            g.fillText((on ? "▶ " : "  ") + lab, mx + 16, y);
        });
        g.font = font(12); g.textAlign = "right"; g.fillStyle = "#8888a0";
        g.fillText(o.hint, W - 14, H - 18);
        g.textAlign = "left";
    }

    return { draw };
}

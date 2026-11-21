/**
 * VARIANT HEART - ボクセルモデルとスプライトスタック描画
 *
 * モデルは「ボクセル(x, y, z, 色)」の集まりで作り、z の層ごとに 1px=1ボクセルの画像にして、
 * 層を少しずつ上にずらして回転描画する(スプライトスタック)。
 *   モデル座標: +x = 機首(前)、+y = 右、+z = 上
 *   画面: カメラは回らない斜め見下ろし。y は SQ でつぶし、z は LH ずつ上へずらす
 * 角度(ANGLES 段階)・傾き(バンク -2..2)ごとに描いた結果を遅延キャッシュする。
 * 光はその角度でのボクセルの法線から計算するので、旋回すると陰影も回る。
 * 変形は、2つのモデルの表面ボクセルを部位(tag)ごとに対応させて、1個ずつ飛ばして描く(drawMorph)。
 */

export const DPR = 2;          // キャッシュ画像は論理ピクセルの2倍で描く(細かいドット)
export const SQ = 0.78;        // 見下ろしの縦のつぶれ
export const LH = 0.82;        // 1層あたりの持ち上げ(ボクセル単位)
export const ANGLES = 64;
const TAU = Math.PI * 2;
const LIGHT = norm3(-0.45, -0.55, 0.85); // 画面の左上・上から

function norm3(x, y, z) { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }

/** "#rrggbb" / "!#rrggbb"(光る色、陰影なし) → [r, g, b, emissive] */
export function parseColor(c) {
    if (Array.isArray(c)) return c;
    const em = c[0] === "!";
    const h = em ? c.slice(2) : c.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), em ? 1 : 0];
}

/** ボクセルを積んでモデルを作る道具 */
export class Vox {
    constructor() { this.map = new Map(); this.tag = "body"; }
    key(x, y, z) { return `${x},${y},${z}`; }
    set(x, y, z, c) {
        x = Math.round(x); y = Math.round(y); z = Math.round(z);
        if (c == null) { this.map.delete(this.key(x, y, z)); return this; }
        this.map.set(this.key(x, y, z), { x, y, z, c: parseColor(c), tag: this.tag });
        return this;
    }
    has(x, y, z) { return this.map.has(this.key(x, y, z)); }
    T(tag) { this.tag = tag; return this; }
    box(x0, y0, z0, x1, y1, z1, c) {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
            for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
                for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, typeof c === "function" ? c(x, y, z) : c);
        return this;
    }
    /** 範囲の各点で fn(x,y,z) が色を返したら置く */
    fill(x0, x1, y0, y1, z0, z1, fn) {
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
            const c = fn(x, y, z);
            if (c) this.set(x, y, z, c);
        }
        return this;
    }
    ell(cx, cy, cz, rx, ry, rz, c) {
        return this.fill(Math.floor(cx - rx), Math.ceil(cx + rx), Math.floor(cy - ry), Math.ceil(cy + ry), Math.floor(cz - rz), Math.ceil(cz + rz), (x, y, z) => {
            const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
            return d <= 1 ? (typeof c === "function" ? c(x, y, z) : c) : null;
        });
    }
    /** z 方向の円柱 */
    cyl(cx, cy, z0, z1, r, c) {
        return this.fill(Math.floor(cx - r), Math.ceil(cx + r), Math.floor(cy - r), Math.ceil(cy + r), z0, z1, (x, y, z) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3 ? (typeof c === "function" ? c(x, y, z) : c) : null));
    }
    /** 左右対称: y>0 の側を y<0 に写す。tag の末尾 "*" は L/R に分ける */
    mirror() {
        const add = [];
        for (const v of this.map.values()) {
            if (v.y <= 0) continue;
            const isPair = v.tag.endsWith("*");
            const base = isPair ? v.tag.slice(0, -1) : v.tag;
            if (isPair) v.tag = base + "R";
            add.push({ ...v, y: -v.y, tag: isPair ? base + "L" : v.tag });
        }
        for (const v of this.map.values()) if (v.tag.endsWith("*")) v.tag = v.tag.slice(0, -1) + "R";
        add.forEach((v) => this.map.set(this.key(v.x, v.y, v.z), v));
        return this;
    }
    /** 色の置き換え(敵のカラバリ用) */
    recolor(fn) {
        for (const v of this.map.values()) { const c = fn(v.c, v); if (c) v.c = parseColor(c); }
        return this;
    }
    clone() {
        const o = new Vox();
        for (const [k, v] of this.map) o.map.set(k, { ...v, c: [...v.c] });
        return o;
    }
}

const shade = (c, k, add = 0) => (c[3] ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgb(${clamp8(c[0] * k + add)},${clamp8(c[1] * k + add)},${clamp8(c[2] * k + add)})`);
const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Vox を描画用モデルにする。px: 1ボクセルの論理ピクセル数
 */
export function compile(vox, { px = 1.5, name = "" } = {}) {
    const list = [...vox.map.values()];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    list.forEach((v) => { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); });
    // 法線(空いている隣の方向の合計)と表面フラグ
    const surf = [];
    list.forEach((v) => {
        let nx = 0, ny = 0, nz = 0, open = 0;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            if (!vox.has(v.x + dx, v.y + dy, v.z + dz)) { nx += dx; ny += dy; nz += dz; open++; }
        }
        // 斜めの空きも少し足して、角を丸く光らせる
        for (const [dx, dy, dz] of [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]]) {
            if (!vox.has(v.x + dx, v.y + dy, v.z + dz)) { nx += dx * 0.35; ny += dy * 0.35; nz += dz * 0.35; }
        }
        v.n = norm3(nx, ny, nz + 0.0001);
        v.top = !vox.has(v.x, v.y, v.z + 1);
        v.open = open;
        if (open > 0) surf.push(v);
    });
    const layers = [];
    for (let z = z0; z <= z1; z++) layers.push([]);
    surf.forEach((v) => layers[v.z - z0].push(v));
    const r = Math.max(Math.hypot(Math.max(Math.abs(x0), Math.abs(x1)) + 1, Math.max(Math.abs(y0), Math.abs(y1)) + 1), 2);
    const tags = {};
    surf.forEach((v) => { (tags[v.tag] ||= []).push(v); });
    return {
        name, px, x0, x1, y0, y1, z0, z1, r, layers, surf, tags, vox,
        bw: x1 - x0 + 1, bh: y1 - y0 + 1,
        cache: new Map(), shadowCache: new Map(), flashCache: new Map(),
    };
}

const angIndex = (a) => ((Math.round((a / TAU) * ANGLES) % ANGLES) + ANGLES) % ANGLES;

/** その角度での層ごとの画像(1px=1ボクセル)を作る */
function layerImages(m, ai) {
    const a = (ai / ANGLES) * TAU;
    // 光の向きをモデル座標へ(画面の y は下向き、モデルの +y は右)
    const ca = Math.cos(-a), sa = Math.sin(-a);
    const lx = LIGHT[0] * ca - LIGHT[1] * sa, ly = LIGHT[0] * sa + LIGHT[1] * ca, lz = LIGHT[2];
    const zr = Math.max(1, m.z1 - m.z0);
    return m.layers.map((layer, li) => {
        if (!layer.length) return null;
        const c = document.createElement("canvas");
        c.width = m.bw; c.height = m.bh;
        const g = c.getContext("2d");
        const img = g.createImageData(m.bw, m.bh);
        const d = img.data;
        layer.forEach((v) => {
            const i = ((v.y - m.y0) * m.bw + (v.x - m.x0)) * 4;
            let r = v.c[0], gg = v.c[1], b = v.c[2];
            if (!v.c[3]) {
                const dot = v.n[0] * lx + v.n[1] * ly + v.n[2] * lz;
                let k = 0.5 + 0.62 * Math.max(0, dot) + (v.top ? 0.1 : 0);
                k *= 0.78 + 0.22 * (li / zr);       // 下ほど暗い(簡易AO)
                const spec = dot > 0.86 ? 26 : 0;   // つや
                r = clamp8(r * k + spec); gg = clamp8(gg * k + spec); b = clamp8(b * k + spec);
            }
            d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
        });
        g.putImageData(img, 0, 0);
        return c;
    });
}

function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    return [c, g];
}

/** キャッシュ画像の大きさと原点(モデルの z=0 中心の位置) */
function frameOf(m, bankAbs = 0) {
    const s = m.px * DPR;
    const pad = 3 + bankAbs * (m.z1 - m.z0) * 0.5 * s;
    const w = m.r * 2 * s + pad * 2;
    const top = (m.z1 + 1.5) * LH * s;
    const bottom = Math.max(0, -m.z0) * LH * s;
    const h = m.r * 2 * SQ * s + top + bottom + 6;
    return { s, w, h, ox: w / 2, oy: m.r * SQ * s + top + 3 };
}

function drawLayers(g, m, ai, bank, imgs, { flat = false } = {}) {
    const a = (ai / ANGLES) * TAU;
    const f = frameOf(m, Math.abs(bank));
    const s = f.s;
    const px = -Math.sin(a), py = Math.cos(a); // 機体の右方向(画面)
    const zc = (m.z0 + m.z1) / 2;
    const step = LH * s;
    const subs = step > 1.2 ? Math.ceil(step / 1.2) : 1;
    imgs.forEach((img, li) => {
        if (!img) return;
        const z = m.z0 + li;
        for (let k = 0; k < subs; k++) {
            const zz = flat ? 0 : z + k / subs;
            const roll = bank * (z - zc) * 0.5 * s;
            g.setTransform(1, 0, 0, 1, f.ox + px * roll, f.oy - zz * step + py * roll * SQ);
            g.scale(1, SQ);
            g.rotate(a);
            g.drawImage(img, m.x0 * s, m.y0 * s, m.bw * s, m.bh * s);
        }
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
    return f;
}

/** 角度 a(ラジアン)・傾き bank(-2..2 の整数)の画像 { c, ox, oy, s } */
export function sprite(m, a, bank = 0) {
    const ai = angIndex(a);
    const key = ai * 8 + (bank + 3);
    let e = m.cache.get(key);
    if (e) return e;
    const imgs = m._imgs?.[ai] || layerImages(m, ai);
    (m._imgs ||= [])[ai] = imgs;
    const f = frameOf(m, Math.abs(bank));
    const [c, g] = makeCanvas(f.w, f.h);
    drawLayers(g, m, ai, bank, imgs);
    e = { c, ox: f.ox, oy: f.oy };
    m.cache.set(key, e);
    return e;
}

/** 真っ黒の影(地面に落とす) */
export function shadow(m, a) {
    const ai = angIndex(a);
    let e = m.shadowCache.get(ai);
    if (e) return e;
    const imgs = m._imgs?.[ai] || layerImages(m, ai);
    (m._imgs ||= [])[ai] = imgs;
    const f = frameOf(m, 0);
    const [c, g] = makeCanvas(f.w, f.h);
    drawLayers(g, m, ai, 0, imgs, { flat: true });
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    e = { c, ox: f.ox, oy: f.oy };
    m.shadowCache.set(ai, e);
    return e;
}

/** 被弾したときの白い姿 */
export function flash(m, a, bank = 0) {
    const ai = angIndex(a);
    const key = ai * 8 + (bank + 3);
    let e = m.flashCache.get(key);
    if (e) return e;
    const base = sprite(m, a, bank);
    const [c, g] = makeCanvas(base.c.width, base.c.height);
    g.drawImage(base.c, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    e = { c, ox: base.ox, oy: base.oy };
    m.flashCache.set(key, e);
    return e;
}

/**
 * 論理座標 (x, y) に置く。alt: 地面からの高さ(論理px)。影は地面に落とす。
 * opt: { bank, shadow(既定 true), flash, alpha, shadowAlpha }
 */
let SHADOW_K = 1;
/** 影の濃さの倍率(宇宙では 0 = 地面がないので影を落とさない) */
export function setShadowScale(k) { SHADOW_K = k; }

export function draw(g, m, x, y, a, opt = {}) {
    const alt = opt.alt || 0;
    if (opt.shadow !== false && SHADOW_K > 0) {
        const sh = shadow(m, a);
        g.globalAlpha = (opt.shadowAlpha ?? 0.32) * (opt.alpha ?? 1) * SHADOW_K;
        const off = alt * 0.55;
        g.drawImage(sh.c, x - sh.ox / DPR + off, y - sh.oy / DPR + off * 0.6, sh.c.width / DPR, sh.c.height / DPR);
        g.globalAlpha = 1;
    }
    const sp = opt.flash ? flash(m, a, opt.bank || 0) : sprite(m, a, opt.bank || 0);
    if (opt.alpha != null) g.globalAlpha = opt.alpha;
    g.drawImage(sp.c, x - sp.ox / DPR, y - alt * SQ - sp.oy / DPR, sp.c.width / DPR, sp.c.height / DPR);
    g.globalAlpha = 1;
}

/** 画面上でのモデルの高さ(ボクセル z を論理pxへ) */
export const zToScreen = (m, z) => z * LH * m.px;

/** モデル上の点 (mx, my, mz) が、角度 a で置いたときに画面のどこに来るか(原点からの差分) */
export function localToScreen(m, mx, my, mz, a) {
    const s = m.px;
    const c = Math.cos(a), sn = Math.sin(a);
    const wx = (mx * c - my * sn) * s, wy = (mx * sn + my * c) * s;
    return { x: wx, y: wy * SQ - mz * LH * s, gx: wx, gy: wy };
}

// ---------------- 変形(モーフ) ----------------

/** 主軸(いちばん長い向き)で並べる */
function sortByAxis(list) {
    let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity, az0 = Infinity, az1 = -Infinity;
    list.forEach((v) => { ax0 = Math.min(ax0, v.x); ax1 = Math.max(ax1, v.x); ay0 = Math.min(ay0, v.y); ay1 = Math.max(ay1, v.y); az0 = Math.min(az0, v.z); az1 = Math.max(az1, v.z); });
    const ex = ax1 - ax0, ey = ay1 - ay0, ez = az1 - az0;
    const k = ex >= ey && ex >= ez ? "x" : ez >= ey ? "z" : "y";
    const k2 = k === "x" ? "z" : "x";
    return [...list].sort((a, b) => a[k] - b[k] || a[k2] - b[k2] || a.y - b.y);
}

/**
 * A と B の表面ボクセルを部位ごとに対応させる。
 * delays: { tag: 0〜0.5 } 部位ごとに動き出す時間をずらす
 */
export function morphPairs(A, B, delays = {}) {
    const pairs = [];
    const tags = new Set([...Object.keys(A.tags), ...Object.keys(B.tags)]);
    for (const t of tags) {
        const la = sortByAxis(A.tags[t] || A.tags.body || A.surf);
        const lb = sortByAxis(B.tags[t] || B.tags.body || B.surf);
        if (!A.tags[t] && !B.tags[t]) continue;
        const n = Math.max(A.tags[t]?.length || 0, B.tags[t]?.length || 0);
        const d = delays[t] ?? 0;
        for (let k = 0; k < n; k++) {
            const a = la[Math.floor((k * la.length) / n)], b = lb[Math.floor((k * lb.length) / n)];
            pairs.push({
                a, b, d,
                ca: a.c, cb: b.c,
                fadeA: !A.tags[t], fadeB: !B.tags[t],
                lift: 2 + ((k * 7) % 5),
            });
        }
    }
    return pairs;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 変形の途中を描く。t: 0(A)〜1(B)。px: 1ボクセルの論理ピクセル */
export function drawMorph(g, pairs, x, y, a, t, { px = 1.5, alt = 0 } = {}) {
    const c = Math.cos(a), sn = Math.sin(a);
    const pts = [];
    for (const p of pairs) {
        const u = ease(Math.max(0, Math.min(1, (t - p.d) / Math.max(0.2, 1 - p.d - 0.1))));
        if ((p.fadeA && u < 0.15) || (p.fadeB && u > 0.85)) continue;
        const mx = p.a.x + (p.b.x - p.a.x) * u;
        const my = p.a.y + (p.b.y - p.a.y) * u;
        const mz = p.a.z + (p.b.z - p.a.z) * u + Math.sin(Math.PI * u) * p.lift;
        const wx = (mx * c - my * sn) * px, wy = (mx * sn + my * c) * px;
        const col = u < 0.5 ? p.ca : p.cb;
        const n = u < 0.5 ? p.a.n : p.b.n;
        pts.push({ sx: x + wx, sy: y + wy * SQ - mz * LH * px - alt * SQ, z: mz, d: wy, col, n, glow: Math.sin(Math.PI * u) });
    }
    pts.sort((p, q) => p.z - q.z || p.d - q.d);
    const sz = px * 1.25;
    const ca = Math.cos(-a), sa = Math.sin(-a);
    const lx = LIGHT[0] * ca - LIGHT[1] * sa, ly = LIGHT[0] * sa + LIGHT[1] * ca;
    for (const p of pts) {
        const dot = p.n[0] * lx + p.n[1] * ly + p.n[2] * LIGHT[2];
        const k = 0.55 + 0.6 * Math.max(0, dot);
        g.fillStyle = shade(p.col, k, p.glow * 70);
        g.fillRect(p.sx - sz / 2, p.sy - sz / 2, sz, sz);
    }
}

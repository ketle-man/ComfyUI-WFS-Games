/**
 * ゲーム共通の80年代風の表示部品
 * - ドットフォント(DotGothic16)の読み込みとテキスト
 * - アドベンチャーゲーム風の会話ウィンドウ(顔グラ・名前・1文字ずつ表示・▼)
 * - ブラウン管風の走査線
 * Phaser は呼び出し側から渡してもらう(このファイル自身は import しない)。
 */

export const FONT_NAME = "WFSDotGothic16";
const FONT_URL = new URL("../vendor/fonts/DotGothic16-Regular.ttf", import.meta.url);

// 80年代 PC 風の文字色
export const COL = {
    white: "#f8f8f8", yellow: "#f8f048", cyan: "#58e8f8", magenta: "#f858f8",
    green: "#58f858", gray: "#9898a8", red: "#f85858", orange: "#f89838",
};

export async function loadFont() {
    try {
        if (![...document.fonts].some((f) => f.family === FONT_NAME)) {
            document.fonts.add(new FontFace(FONT_NAME, `url(${FONT_URL.href})`));
        }
        await document.fonts.load(`16px "${FONT_NAME}"`);
    } catch (e) {
        console.warn("[wfs-games] font load failed, using monospace", e);
    }
}

export function txt(scene, x, y, str, size = 16, color = COL.white) {
    return scene.add.text(x, y, str, { fontFamily: `"${FONT_NAME}", monospace`, fontSize: `${size}px`, color, align: "center", lineSpacing: 6 });
}

export const pad = (n, w = 6) => String(Math.max(0, Math.floor(n))).padStart(w, "0");

/** ブラウン管風の走査線と周辺減光(表示のみ・クリックは透過) */
export function addScanlines(root) {
    const scan = document.createElement("div");
    scan.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:2;"
        + "background:repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px);"
        + "box-shadow: inset 0 0 80px rgba(0,0,0,0.55);";
    root.appendChild(scan);
    return scan;
}

/**
 * アドベンチャーゲーム風の会話ウィンドウ
 *   const box = new StoryBox(scene, { W, H, portrait: "misaki", speakerName: "ミサキ", nextLabel, loc, sfx })
 *   box.start(lines, onDone)   lines: [{ speaker: "heroine"|"narr", text: {en, ja, zh} }]
 *   box.update(dt, advance) -> advance を消費したら true
 */
export class StoryBox {
    constructor(scene, { W, H, portrait, speakerName, nextLabel, loc, sfx, depth = 20 }) {
        this.scene = scene;
        this.W = W;
        this.loc = loc;
        this.sfx = sfx || (() => {});
        this.speakerName = speakerName;
        const top = H - 176;
        this.top = top;
        const box = scene.add.container(0, 0).setDepth(depth).setVisible(false);
        const g = scene.add.graphics();
        g.fillStyle(0x000010, 1).fillRect(10, top, W - 20, 162);
        g.lineStyle(2, 0xf8f8f8, 1).strokeRect(12, top + 2, W - 24, 158);
        g.lineStyle(1, 0x58e8f8, 1).strokeRect(17, top + 7, W - 34, 148);
        const face = scene.add.container(0, 0);
        const fg = scene.add.graphics().lineStyle(2, 0xf8f8f8, 1).strokeRect(26, top + 20, 52, 52);
        face.add([fg, scene.add.image(52, top + 46, portrait)]);
        const name = txt(scene, 92, top + 18, "", 16, COL.yellow);
        const body = txt(scene, 92, top + 46, "", 16, COL.white).setAlign("left");
        const cursor = txt(scene, W - 34, top + 132, "▼", 16, COL.cyan);
        const hint = txt(scene, W - 52, top + 134, nextLabel || "", 16, COL.gray).setOrigin(1, 0).setScale(0.75);
        box.add([g, face, name, body, cursor, hint]);
        Object.assign(this, { box, face, name, body, cursor, lines: [], idx: -1, pos: 0, full: "", done: null, blink: 0 });
    }
    get active() { return this.box.visible; }
    start(lines, done) {
        this.lines = lines;
        this.idx = -1;
        this.done = done;
        this.box.setVisible(true);
        this.next();
    }
    hide() {
        this.box.setVisible(false);
        this.done = null;
    }
    next() {
        this.idx++;
        if (this.idx >= this.lines.length) {
            this.box.setVisible(false);
            const done = this.done;
            this.done = null;
            done?.();
            return;
        }
        const line = this.lines[this.idx];
        const isNarr = line.speaker === "narr";
        this.face.setVisible(!isNarr);
        this.name.setText(isNarr ? "" : this.speakerName);
        const x = isNarr ? 30 : 92;
        this.body.setPosition(x, isNarr ? this.top + 30 : this.top + 46);
        this.body.setWordWrapWidth(this.W - x - 34, true);
        this.full = this.loc(line.text);
        this.pos = 0;
        this.body.setText("");
        this.cursor.setVisible(false);
    }
    /** advance: このフレームに送り操作があったか。戻り値: 送り操作を使ったか */
    update(dt, advance) {
        if (this.pos < this.full.length) {
            const before = Math.floor(this.pos);
            this.pos = Math.min(this.full.length, this.pos + dt * 28);
            if (Math.floor(this.pos) !== before) {
                this.body.setText(this.full.slice(0, Math.floor(this.pos)));
                if (Math.floor(this.pos) % 2 === 0) this.sfx("text");
            }
        } else {
            this.blink += dt;
            this.cursor.setVisible(Math.floor(this.blink * 2.5) % 2 === 0);
        }
        if (!advance) return false;
        if (this.pos < this.full.length) { this.pos = this.full.length; this.body.setText(this.full); }
        else this.next();
        return true;
    }
}

/** 文字マップのドット絵をテクスチャにする。rows: ["..AB..", ...]、palette: { A: 0xRRGGBB } */
export function pixelTexture(scene, key, rows, palette, scale = 2) {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
            const col = palette[ch];
            if (col === undefined) return;
            g.fillStyle(col, 1);
            g.fillRect(x * scale, y * scale, scale, scale);
        });
    });
    g.generateTexture(key, rows[0].length * scale, rows.length * scale);
    g.destroy();
}

/** 決まった種から同じ乱数列を出す(コースを毎回同じ形にするため) */
export function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * SHUTTER HEART 用にその場で合成する効果音(シャッター・ピントの合図・ズーム)。
 * common/audio.js の addSynthSample / playSample を使う。ここに無い名前は audio.sfx() の共通音に回す。
 */

const DEFS = {
    // カシャッ: 2回のクリック + 巻き上げのモーター音
    shutter: (sr) => {
        const n = Math.floor(sr * 0.32);
        const d = new Float32Array(n);
        const click = (at, vol) => {
            const s = Math.floor(sr * at);
            for (let i = 0; i < sr * 0.012 && s + i < n; i++) d[s + i] += (Math.random() * 2 - 1) * vol * (1 - i / (sr * 0.012));
        };
        click(0, 0.7);
        click(0.065, 0.5);
        let ph = 0;
        for (let i = Math.floor(sr * 0.11); i < n; i++) {
            const t = (i - sr * 0.11) / (n - sr * 0.11);
            ph += (150 + 60 * Math.sin(t * 40)) / sr;
            const saw = 2 * (ph % 1) - 1;
            d[i] += saw * 0.08 * Math.sin(Math.PI * t);
        }
        return d;
    },
    // ピピッ: ピントが合った合図
    focus: (sr) => {
        const n = Math.floor(sr * 0.13);
        const d = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const t = i / sr;
            const on = t < 0.04 || (t > 0.07 && t < 0.11);
            d[i] = on ? Math.sin(2 * Math.PI * 2600 * t) * 0.12 : 0;
        }
        return d;
    },
    // チッ: ズーム・角度の切り替え
    tick: (sr) => {
        const n = Math.floor(sr * 0.02);
        const d = new Float32Array(n);
        for (let i = 0; i < n; i++) d[i] = (i % 40 < 20 ? 0.1 : -0.1) * (1 - i / n);
        return d;
    },
    // キラッ: 決めポーズの合図
    twinkle: (sr) => {
        const n = Math.floor(sr * 0.35);
        const d = new Float32Array(n);
        [1568, 2093, 2637].forEach((f, k) => {
            const s = Math.floor(sr * k * 0.05);
            for (let i = s; i < n; i++) {
                const t = (i - s) / sr;
                d[i] += Math.sin(2 * Math.PI * f * t) * 0.07 * Math.exp(-t * 9);
            }
        });
        return d;
    },
};

export function makeSfx(audio) {
    return (name, opts) => {
        const def = DEFS[name];
        if (!def) { audio.sfx(name); return; }
        if (!audio.hasSample(name)) audio.addSynthSample(name, def);
        audio.playSample(name, opts);
    };
}

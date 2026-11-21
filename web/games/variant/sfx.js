/**
 * VARIANT HEART の効果音(その場で合成)。ここに無い名前は audio.sfx() の共通音に回す。
 */
const noiseBurst = (d, sr, at, dur, vol, lp = 0.5, curve = 1) => {
    const s = Math.floor(sr * at), n = Math.floor(sr * dur);
    let y = 0;
    for (let i = 0; i < n && s + i < d.length; i++) {
        y += ((Math.random() * 2 - 1) - y) * lp;
        d[s + i] += y * vol * Math.pow(1 - i / n, curve);
    }
};
const osc = (d, sr, at, dur, f0, f1, vol, { decay = 4, type = "sine" } = {}) => {
    const s = Math.floor(sr * at), n = Math.floor(sr * dur);
    let ph = 0;
    for (let i = 0; i < n && s + i < d.length; i++) {
        const t = i / n;
        ph += (f0 * Math.pow(f1 / f0, t)) / sr;
        const p = ph % 1;
        const w = type === "saw" ? 2 * p - 1 : type === "square" ? (p < 0.5 ? 1 : -1) : type === "tri" ? 1 - 4 * Math.abs(p - 0.5) : Math.sin(2 * Math.PI * ph);
        d[s + i] += w * vol * Math.exp(-t * decay);
    }
};
const buf = (sr, sec) => new Float32Array(Math.floor(sr * sec));

const DEFS = {
    // 機銃: タタタ(短い乾いた破裂)
    gun: (sr) => { const d = buf(sr, 0.07); noiseBurst(d, sr, 0, 0.05, 0.4, 0.55, 2); osc(d, sr, 0, 0.04, 900, 300, 0.15, { type: "square", decay: 6 }); return d; },
    // ミサイル発射: シュボッ
    missile: (sr) => { const d = buf(sr, 0.5); noiseBurst(d, sr, 0, 0.45, 0.35, 0.35, 1.5); osc(d, sr, 0, 0.3, 300, 900, 0.08, { type: "saw", decay: 3 }); return d; },
    // ビームライフル: ビュン(高い音が下がる)
    beam: (sr) => { const d = buf(sr, 0.35); osc(d, sr, 0, 0.3, 2400, 380, 0.22, { type: "saw", decay: 3 }); osc(d, sr, 0, 0.25, 1800, 600, 0.14, { decay: 4 }); noiseBurst(d, sr, 0, 0.1, 0.15, 0.8); return d; },
    // ビームソードを振る: ヴォン
    saber: (sr) => {
        const d = buf(sr, 0.32), n = d.length;
        let ph = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            ph += (140 + 260 * Math.sin(Math.PI * t)) / sr;
            d[i] = (Math.sin(2 * Math.PI * ph) * 0.3 + Math.sin(4 * Math.PI * ph * 1.01) * 0.15) * Math.sin(Math.PI * t);
        }
        noiseBurst(d, sr, 0.02, 0.25, 0.12, 0.9);
        return d;
    },
    // ソードが当たる: ジャッ
    slash: (sr) => { const d = buf(sr, 0.25); noiseBurst(d, sr, 0, 0.2, 0.5, 0.9, 1.2); osc(d, sr, 0, 0.18, 1200, 200, 0.18, { type: "saw", decay: 5 }); return d; },
    // 弾を斬り払う: キン
    parry: (sr) => { const d = buf(sr, 0.3); osc(d, sr, 0, 0.28, 2600, 2500, 0.18, { decay: 7 }); osc(d, sr, 0, 0.28, 3900, 3800, 0.08, { decay: 9 }); return d; },
    // 変形: ガシャ・ウィーン・ガシャン
    transform: (sr) => {
        const d = buf(sr, 0.75);
        noiseBurst(d, sr, 0, 0.06, 0.45, 0.4);
        osc(d, sr, 0.02, 0.05, 240, 120, 0.25, { type: "square", decay: 8 });
        osc(d, sr, 0.08, 0.45, 300, 1100, 0.07, { type: "saw", decay: 1 });
        noiseBurst(d, sr, 0.3, 0.05, 0.35, 0.4);
        osc(d, sr, 0.3, 0.05, 330, 160, 0.2, { type: "square", decay: 8 });
        noiseBurst(d, sr, 0.56, 0.08, 0.55, 0.3);
        osc(d, sr, 0.56, 0.12, 180, 70, 0.35, { decay: 5 });
        return d;
    },
    // 小さい爆発
    pop: (sr) => { const d = buf(sr, 0.35); noiseBurst(d, sr, 0, 0.32, 0.55, 0.25, 1.5); osc(d, sr, 0, 0.2, 180, 50, 0.3, { decay: 4 }); return d; },
    // 大きい爆発
    blast: (sr) => { const d = buf(sr, 1.1); noiseBurst(d, sr, 0, 1.0, 0.7, 0.12, 1.2); osc(d, sr, 0, 0.6, 120, 30, 0.45, { decay: 3 }); noiseBurst(d, sr, 0.08, 0.5, 0.3, 0.5, 2); return d; },
    // 被弾: ガン
    damage: (sr) => { const d = buf(sr, 0.22); noiseBurst(d, sr, 0, 0.18, 0.5, 0.3); osc(d, sr, 0, 0.15, 260, 90, 0.3, { type: "square", decay: 6 }); return d; },
    // 敵に当たる: チッ
    tick: (sr) => { const d = buf(sr, 0.04); noiseBurst(d, sr, 0, 0.03, 0.25, 0.9); osc(d, sr, 0, 0.03, 2000, 1500, 0.06, { type: "square", decay: 5 }); return d; },
    // ロックオン: ピッ
    lock: (sr) => { const d = buf(sr, 0.07); osc(d, sr, 0, 0.06, 1760, 1760, 0.12, { type: "square", decay: 2 }); return d; },
    // ハート: キラリン
    heart: (sr) => { const d = buf(sr, 0.7); [1319, 1568, 2093, 2637].forEach((f, i) => osc(d, sr, i * 0.07, 0.4, f, f, 0.1, { type: "tri", decay: 4 })); return d; },
    // 回復
    repair: (sr) => { const d = buf(sr, 0.5); [523, 659, 784, 1047].forEach((f, i) => osc(d, sr, i * 0.06, 0.25, f, f, 0.12, { type: "square", decay: 5 })); return d; },
    // 決定・カーソル
    cursor: (sr) => { const d = buf(sr, 0.05); osc(d, sr, 0, 0.04, 1500, 1500, 0.1, { type: "square", decay: 3 }); return d; },
    // 空振り(弾切れ)
    empty: (sr) => { const d = buf(sr, 0.08); osc(d, sr, 0, 0.07, 300, 250, 0.1, { type: "square", decay: 4 }); return d; },
    // 敵のビーム充填
    chargeUp: (sr) => { const d = buf(sr, 1.2); osc(d, sr, 0, 1.2, 120, 900, 0.12, { type: "saw", decay: 0.2 }); return d; },
    // 敵の極太ビーム
    bigBeam: (sr) => { const d = buf(sr, 1.4); noiseBurst(d, sr, 0, 1.35, 0.4, 0.15, 0.6); osc(d, sr, 0, 1.3, 90, 70, 0.3, { type: "saw", decay: 0.8 }); return d; },
};

export function makeSfx(audio) {
    return (name, opts) => {
        const def = DEFS[name];
        if (!def) { audio.sfx(name); return; }
        if (!audio.hasSample(name)) audio.addSynthSample(name, def);
        audio.playSample(name, opts);
    };
}

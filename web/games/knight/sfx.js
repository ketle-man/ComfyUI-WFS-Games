/**
 * KNIGHT HEART 用にその場で合成する効果音(ジャンプ・バネ・踏みつけ・スライディング・鎧の割れる音など)。
 * common/audio.js の addSynthSample / playSample を使う。ここに無い名前は audio.sfx() の共通音に回す。
 */

function env(i, n, attack = 0.01, sr = 44100) {
    const a = Math.min(1, i / (attack * sr));
    return a * (1 - i / n);
}

const DEFS = {
    // ぴょん: 矩形波が上がる
    jump: (sr) => {
        const n = Math.floor(sr * 0.13);
        const d = new Float32Array(n);
        let ph = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            ph += (260 + 420 * t) / sr;
            d[i] = (ph % 1 < 0.5 ? 0.22 : -0.22) * env(i, n, 0.004, sr);
        }
        return d;
    },
    // ぼよーん: 揺れながら上がる三角波
    spring: (sr) => {
        const n = Math.floor(sr * 0.32);
        const d = new Float32Array(n);
        let ph = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            const f = 180 + 700 * t + Math.sin(t * 60) * 60;
            ph += f / sr;
            const tri = 1 - 4 * Math.abs((ph % 1) - 0.5);
            d[i] = tri * 0.3 * env(i, n, 0.003, sr);
        }
        return d;
    },
    // ぺしっ: 短いノイズ + 下がる音
    stomp: (sr) => {
        const n = Math.floor(sr * 0.14);
        const d = new Float32Array(n);
        let ph = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            ph += (480 - 360 * t) / sr;
            const sq = ph % 1 < 0.5 ? 1 : -1;
            const nz = i < sr * 0.03 ? (Math.random() * 2 - 1) * 0.35 : 0;
            d[i] = (sq * 0.22 + nz) * (1 - t);
        }
        return d;
    },
    // ずざざっ: こもったノイズ
    slide: (sr) => {
        const n = Math.floor(sr * 0.3);
        const d = new Float32Array(n);
        let lp = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            lp += ((Math.random() * 2 - 1) - lp) * 0.18;
            d[i] = lp * 0.9 * Math.min(1, t * 12) * (1 - t);
        }
        return d;
    },
    // ひゅっ: 武器を投げる
    throw: (sr) => {
        const n = Math.floor(sr * 0.1);
        const d = new Float32Array(n);
        let hp = 0, prev = 0, ph = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            const x = Math.random() * 2 - 1;
            hp = 0.7 * (hp + x - prev);
            prev = x;
            ph += (1100 - 500 * t) / sr;
            d[i] = (hp * 0.25 + (ph % 1 < 0.5 ? 0.08 : -0.08)) * (1 - t);
        }
        return d;
    },
    // がしゃーん: 鎧が割れる(金属の響き + ノイズ)
    armor: (sr) => {
        const n = Math.floor(sr * 0.55);
        const d = new Float32Array(n);
        const fs = [880, 1310, 2090, 2770];
        for (let i = 0; i < n; i++) {
            const t = i / sr;
            let v = 0;
            fs.forEach((f, k) => { v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (6 + k * 3)) * 0.12; });
            v += (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.3;
            d[i] = v;
        }
        return d;
    },
    // かきん: 武器が壁や岩に当たる
    clank: (sr) => {
        const n = Math.floor(sr * 0.12);
        const d = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const t = i / sr;
            d[i] = (Math.sin(2 * Math.PI * 1900 * t) + Math.sin(2 * Math.PI * 2650 * t) * 0.6) * Math.exp(-t * 40) * 0.18;
        }
        return d;
    },
    // ずしん: ボスの着地
    thud: (sr) => {
        const n = Math.floor(sr * 0.4);
        const d = new Float32Array(n);
        let ph = 0, lp = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            ph += (90 - 50 * t) / sr;
            lp += ((Math.random() * 2 - 1) - lp) * 0.08;
            d[i] = (Math.sin(ph * 2 * Math.PI) * 0.5 + lp * 0.6) * (1 - t) * (1 - t);
        }
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

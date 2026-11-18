/**
 * 靴の「キュッキュッ」という摩擦音をその場で合成する。
 * - 高め(2.3〜2.9kHz)で澄んだ音に、ゴムらしさを出す倍音(2倍・3倍)を少し足す
 *   (ギザギザの波形やノイズを多くするとラップのスクラッチのように聞こえるので控えめに)
 * - 鳥の鳴き声にならないよう、音の高さの上下は小さく(立ち上がりで少し上がって、あとはほぼ一定)
 * - ゴムが引っかかっては滑る細かい揺れ(数十Hz)を少しだけ
 * - コートで鳴ったときの短い反響(櫛形フィルタを3本)を足す
 */

function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * sr: サンプリング周波数、seed: 乱数の種
 * bursts: [[開始秒, 長さ秒], ...] (止まるときの「キュッキュッ」は2回)
 * f0: 基本の高さ(Hz)、room: 反響の量(0〜1)
 */
export function makeSqueak(sr, seed, { bursts = [[0, 0.07], [0.095, 0.085]], f0 = 2600, room = 0.35 } = {}) {
    const rnd = rng(seed);
    const last = bursts[bursts.length - 1];
    const tail = 0.18; // 反響の残り
    const dry = new Float32Array(Math.ceil((last[0] + last[1] + tail) * sr));
    for (const [start, dur] of bursts) {
        const n = Math.floor(dur * sr);
        const off = Math.floor(start * sr);
        const fb = f0 * (0.94 + rnd() * 0.12);
        const wobbleHz = 35 + rnd() * 30; // ゴムが引っかかっては滑る揺れ
        let phase = 0, jit = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            jit += (rnd() * 2 - 1 - jit) * 0.01;
            // 立ち上がりで少し上がってから、ほぼ一定(最後にわずかに下がる)
            const contour = 1 + 0.06 * Math.min(1, t / 0.15) - 0.03 * Math.max(0, (t - 0.7) / 0.3);
            const wobble = 1 + 0.025 * Math.sin((2 * Math.PI * wobbleHz * i) / sr) + jit * 0.02;
            phase += (fb * contour * wobble) / sr;
            const ph = 2 * Math.PI * phase;
            const tone = Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.4) + 0.12 * Math.sin(3 * ph + 1.1);
            const am = 0.85 + 0.15 * Math.sin((2 * Math.PI * wobbleHz * 0.5 * i) / sr);
            const env = Math.min(1, i / (0.003 * sr)) * Math.min(1, (n - i) / (0.012 * sr));
            dry[off + i] += tone * am * env;
        }
    }
    // 反響: 遅れ時間の違う3本の櫛形フィルタ(高音は少しずつ減らす)
    const out = new Float32Array(dry.length);
    const combs = [0.029, 0.037, 0.043].map((sec, k) => ({ buf: new Float32Array(Math.floor(sec * sr)), idx: 0, fb: 0.5 - k * 0.05, lp: 0 }));
    let peak = 0;
    for (let i = 0; i < dry.length; i++) {
        let wet = 0;
        for (const c of combs) {
            const y = c.buf[c.idx];
            c.lp = c.lp * 0.4 + y * 0.6;
            c.buf[c.idx] = dry[i] + c.lp * c.fb;
            c.idx = (c.idx + 1) % c.buf.length;
            wet += y;
        }
        out[i] = dry[i] + (wet / combs.length) * room;
        peak = Math.max(peak, Math.abs(out[i]));
    }
    if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.5 / peak;
    return out;
}

/** 3種類(止まる「キュッキュッ」、すべって止まる「キュー」、軽い「キュキュッ」) */
export const SQUEAKS = {
    squeak1: (sr) => makeSqueak(sr, 11, { bursts: [[0, 0.07], [0.095, 0.085]], f0: 2600 }),
    squeak2: (sr) => makeSqueak(sr, 23, { bursts: [[0, 0.12]], f0: 2350 }),
    squeak3: (sr) => makeSqueak(sr, 37, { bursts: [[0, 0.045], [0.065, 0.06]], f0: 2900 }),
};

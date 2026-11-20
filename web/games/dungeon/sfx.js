/**
 * DUNGEON HEART 用にその場で合成する効果音(足音・壁・扉・宝箱・泉・罠・階段・隠し通路)。
 * common/audio.js の addSynthSample / playSample を使う。ここに無い名前は audio.sfx() の共通音に回す。
 */

const noiseBurst = (d, sr, at, dur, vol, lp = 0.5) => {
    const s = Math.floor(sr * at), n = Math.floor(sr * dur);
    let y = 0;
    for (let i = 0; i < n && s + i < d.length; i++) {
        y += ((Math.random() * 2 - 1) - y) * lp; // 簡単なローパス
        d[s + i] += y * vol * (1 - i / n);
    }
};
const sine = (d, sr, at, dur, f0, f1, vol, decay = 6) => {
    const s = Math.floor(sr * at), n = Math.floor(sr * dur);
    let ph = 0;
    for (let i = 0; i < n && s + i < d.length; i++) {
        const t = i / n;
        ph += (f0 + (f1 - f0) * t) / sr;
        d[s + i] += Math.sin(2 * Math.PI * ph) * vol * Math.exp(-t * decay);
    }
};

const DEFS = {
    // コツ: 石の床の足音
    step: (sr) => { const d = new Float32Array(Math.floor(sr * 0.09)); noiseBurst(d, sr, 0, 0.07, 0.35, 0.18); sine(d, sr, 0, 0.06, 140, 90, 0.18); return d; },
    // ドン: 壁にぶつかる
    bump: (sr) => { const d = new Float32Array(Math.floor(sr * 0.16)); sine(d, sr, 0, 0.15, 110, 60, 0.4, 5); noiseBurst(d, sr, 0, 0.05, 0.25, 0.1); return d; },
    // ギィー: 木の扉が開く
    door: (sr) => {
        const n = Math.floor(sr * 0.55), d = new Float32Array(n);
        let ph = 0;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            ph += (180 + 140 * Math.sin(t * 9) + 60 * t) / sr;
            const saw = 2 * (ph % 1) - 1;
            d[i] = saw * 0.07 * Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.sin(i / sr * 70));
        }
        noiseBurst(d, sr, 0.45, 0.1, 0.3, 0.15);
        return d;
    },
    // カチャ: 鍵を開ける
    unlock: (sr) => { const d = new Float32Array(Math.floor(sr * 0.2)); noiseBurst(d, sr, 0, 0.02, 0.5, 0.9); noiseBurst(d, sr, 0.08, 0.025, 0.5, 0.9); sine(d, sr, 0.08, 0.1, 2400, 2200, 0.1); return d; },
    // パカッ: 宝箱
    chest: (sr) => { const d = new Float32Array(Math.floor(sr * 0.3)); noiseBurst(d, sr, 0, 0.06, 0.3, 0.3); sine(d, sr, 0.04, 0.2, 300, 520, 0.12, 4); return d; },
    // 泉: きらきら上がる和音
    heal: (sr) => {
        const d = new Float32Array(Math.floor(sr * 1.1));
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => sine(d, sr, i * 0.09, 0.6, f, f, 0.07, 4));
        return d;
    },
    // ガシャン: 罠
    trap: (sr) => { const d = new Float32Array(Math.floor(sr * 0.5)); noiseBurst(d, sr, 0, 0.4, 0.55, 0.6); sine(d, sr, 0, 0.3, 220, 80, 0.3, 4); return d; },
    // 階段を下りる足音
    stairs: (sr) => {
        const d = new Float32Array(Math.floor(sr * 1.2));
        for (let i = 0; i < 6; i++) { noiseBurst(d, sr, i * 0.18, 0.06, 0.3 * (1 - i * 0.12), 0.18); sine(d, sr, i * 0.18, 0.06, 150 - i * 12, 90, 0.15); }
        return d;
    },
    // ゴゴゴ: 隠し通路
    secret: (sr) => {
        const d = new Float32Array(Math.floor(sr * 1.0));
        noiseBurst(d, sr, 0, 0.9, 0.45, 0.04);
        [784, 988, 1175].forEach((f, i) => sine(d, sr, 0.6 + i * 0.08, 0.3, f, f, 0.06, 3));
        return d;
    },
    // 敵があらわれた: 下がる2音 + ざわめき
    encounter: (sr) => {
        const d = new Float32Array(Math.floor(sr * 0.6));
        [[0, 880], [0.09, 660], [0.18, 990], [0.27, 740]].forEach(([at, f]) => sine(d, sr, at, 0.12, f, f, 0.1, 2));
        noiseBurst(d, sr, 0.3, 0.3, 0.2, 0.3);
        return d;
    },
    // シュッ: 剣を振る
    slash: (sr) => { const d = new Float32Array(Math.floor(sr * 0.16)); noiseBurst(d, sr, 0, 0.14, 0.45, 0.85); return d; },
    // ひらり: よけた
    dodge: (sr) => { const d = new Float32Array(Math.floor(sr * 0.2)); sine(d, sr, 0, 0.18, 600, 1400, 0.08, 3); return d; },
    // ドッ: 攻撃を受けた
    hurt: (sr) => { const d = new Float32Array(Math.floor(sr * 0.25)); noiseBurst(d, sr, 0, 0.12, 0.5, 0.35); sine(d, sr, 0, 0.2, 180, 70, 0.3, 4); return d; },
    // ファイアボルト: ボッ(唱える)→ ゴウッ(着弾)
    fireCast: (sr) => { const d = new Float32Array(Math.floor(sr * 0.45)); noiseBurst(d, sr, 0, 0.42, 0.35, 0.25); sine(d, sr, 0, 0.4, 200, 500, 0.08, 2); return d; },
    fireHit: (sr) => { const d = new Float32Array(Math.floor(sr * 0.7)); noiseBurst(d, sr, 0, 0.65, 0.6, 0.18); sine(d, sr, 0, 0.5, 120, 50, 0.25, 3); return d; },
    // フロストランス: キィーン → パキッ
    frostCast: (sr) => { const d = new Float32Array(Math.floor(sr * 0.4)); sine(d, sr, 0, 0.35, 2400, 3200, 0.06, 2); sine(d, sr, 0.02, 0.33, 3600, 4200, 0.04, 2); return d; },
    frostHit: (sr) => {
        const d = new Float32Array(Math.floor(sr * 0.6));
        for (let i = 0; i < 6; i++) noiseBurst(d, sr, i * 0.05, 0.03, 0.4, 0.95);
        [1760, 2349, 2794].forEach((f, i) => sine(d, sr, 0.05 + i * 0.04, 0.4, f, f, 0.05, 4));
        return d;
    },
    // サンダーフォール: バリバリ → ゴロゴロ
    thunder: (sr) => {
        const d = new Float32Array(Math.floor(sr * 1.3));
        noiseBurst(d, sr, 0, 0.25, 0.8, 0.95);
        noiseBurst(d, sr, 0.1, 1.1, 0.5, 0.03);
        return d;
    },
    // ヒール: 魔法陣の和音
    healCast: (sr) => {
        const d = new Float32Array(Math.floor(sr * 1.0));
        [659, 784, 988, 1319].forEach((f, i) => sine(d, sr, i * 0.07, 0.8, f, f * 1.003, 0.06, 2.5));
        return d;
    },
    // スターフォール: きらめく高音が降りてくる
    starfall: (sr) => {
        const d = new Float32Array(Math.floor(sr * 1.4));
        for (let i = 0; i < 14; i++) { const f = 2600 - i * 120; sine(d, sr, i * 0.07, 0.35, f, f * 0.98, 0.05, 4); }
        noiseBurst(d, sr, 0.1, 1.2, 0.12, 0.6);
        return d;
    },
    // ぴょん: 飛び越える
    jump: (sr) => { const d = new Float32Array(Math.floor(sr * 0.35)); sine(d, sr, 0, 0.3, 300, 900, 0.12, 3); noiseBurst(d, sr, 0, 0.05, 0.2, 0.3); return d; },
    // ひゅー → どさっ: 落とし穴
    fall: (sr) => { const d = new Float32Array(Math.floor(sr * 0.8)); sine(d, sr, 0, 0.45, 900, 150, 0.1, 1); noiseBurst(d, sr, 0.45, 0.25, 0.6, 0.15); return d; },
    // ぐわっ: ミミック
    mimic: (sr) => {
        const d = new Float32Array(Math.floor(sr * 0.6));
        const n = Math.floor(sr * 0.5);
        let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / n; ph += (90 + 40 * Math.sin(t * 30)) / sr; d[i] = (2 * (ph % 1) - 1) * 0.18 * Math.sin(Math.PI * t); }
        noiseBurst(d, sr, 0, 0.08, 0.4, 0.5);
        return d;
    },
    // 決定・カーソル
    cursor: (sr) => { const d = new Float32Array(Math.floor(sr * 0.04)); sine(d, sr, 0, 0.035, 1500, 1500, 0.08, 3); return d; },
};

export function makeSfx(audio) {
    return (name, opts) => {
        const def = DEFS[name];
        if (!def) { audio.sfx(name); return; }
        if (!audio.hasSample(name)) audio.addSynthSample(name, def);
        audio.playSample(name, opts);
    };
}

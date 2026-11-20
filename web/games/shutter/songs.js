/**
 * SHUTTER HEART の BGM (オリジナル曲)
 * 書式は common/audio.js を参照。1トークン = 16分音符。
 *
 * ほかのゲーム(パルス波のチップチューン)と違う音にするため、
 * サイン波のエレピ(減衰音)・ビブラートのかかったフルート風の旋律・やまびこ(echo)・ハネるリズム(swing)で、
 * 撮影スタジオに流れていそうなボサノバ / ハウス / ジャズワルツ風にしている。パルス波は使わない。
 */

const rep = (s, n) => Array(n).fill(s).join(" ");

/** 1小節(len トークン)のうち steps の位置で note を鳴らす。hold で伸ばす長さ */
function at(note, steps, len = 16, hold = 1) {
    const a = Array(len).fill("-");
    for (const s of steps) {
        a[s] = note;
        for (let k = 1; k < hold && s + k < len; k++) if (a[s + k] === "-") a[s + k] = ".";
    }
    return a.join(" ");
}
/** コード進行(各小節の音の配列)から、和音の i 番目の音だけを並べたトラックを作る */
const voice = (chords, i, steps, len = 16, hold = 1) => chords.map((c) => at(c[i], steps, len, hold)).join(" ");

// エレピ(サイン波の減衰音)・フルート(三角波+ビブラート)・ベル(サイン波+やまびこ)の共通設定
const EP = { wave: "sine", vol: 0.05, gate: 0.9, decay: 0.22, attack: 0.006 };
const FLUTE = { wave: "triangle", vol: 0.1, gate: 0.92, vib: 0.18, vibRate: 5.2, attack: 0.03, echo: { time: 0.33, fb: 0.3, mix: 0.3 } };
const BELL = { wave: "sine", vol: 0.075, gate: 0.95, decay: 0.35, echo: { time: 0.42, fb: 0.4, mix: 0.4 } };

// ---- タイトル: ボサノバ (Fmaj7 Gm7 C9 Fmaj7 / Am7 D9 Gm7 C9) ----
const T_CH = [
    ["A3", "C4", "E4"], ["Bb3", "D4", "F4"], ["Bb3", "D4", "E4"], ["A3", "C4", "E4"],
    ["G3", "C4", "E4"], ["F#3", "C4", "E4"], ["F3", "Bb3", "D4"], ["E3", "Bb3", "D4"],
];
const T_BASS = [["F2", "C3"], ["G2", "D3"], ["C3", "G2"], ["F2", "C3"], ["A2", "E3"], ["D3", "A2"], ["G2", "D3"], ["C3", "G2"]];
const BOSSA_COMP = [0, 3, 6, 10, 13];

// ---- 昼の撮影: ランウェイ風ハウス (Bbmaj7 Am7 Gm7 C7sus) ----
const D_CH = [["D4", "F4", "A4"], ["C4", "E4", "G4"], ["Bb3", "D4", "F4"], ["Bb3", "C4", "F4"]];
const D_BASS = ["Bb1", "A1", "G1", "C2"];
const HOUSE_STAB = [2, 6, 9, 12];

// ---- 夜の撮影: ラウンジジャズ (Dm7 G7 Cmaj7 A7) スウィング ----
const N_CH = [["F3", "A3", "C4"], ["F3", "B3", "E4"], ["E3", "G3", "B3"], ["E3", "G3", "C#4"]];

// ---- コンタクトシート: オルゴールのジャズワルツ (3/4、1小節 = 12トークン) ----
const S_CH = [["E4", "G4"], ["C4", "E4"], ["A3", "C4"], ["B3", "D4"], ["E4", "G4"], ["C4", "E4"], ["A3", "D4"], ["B3", "D4"]];
const S_BASS = ["C3", "A2", "F2", "G2", "C3", "A2", "D3", "G2"];

export const SONGS = {
    title: {
        bpm: 74,
        loop: true,
        tracks: [
            {
                ...FLUTE,
                notes: [
                    "A4 . . C5 . . E5 . . . D5 . C5 . . .",
                    "D5 . . . . . F5 . . . E5 . D5 . . .",
                    "C5 . . . Bb4 . . . G4 . . . E4 . . .",
                    "F4 . . . . . . . - - A4 . C5 . E5 .",
                    "G5 . . . E5 . . C5 . . . E5 . . . .",
                    "F#5 . . . . . E5 . D5 . . . C5 . . .",
                    "Bb4 . . . D5 . . . F5 . . . A5 . . .",
                    "G5 . . . . . . . E5 . . . - - - -",
                ].join(" "),
            },
            { ...EP, notes: voice(T_CH, 0, BOSSA_COMP) },
            { ...EP, notes: voice(T_CH, 1, BOSSA_COMP) },
            { ...EP, notes: voice(T_CH, 2, BOSSA_COMP) },
            { wave: "sine", vol: 0.16, gate: 0.8, notes: T_BASS.map(([r, f]) => rep(`${r} . . ${f} ${r} . . ${f}`, 2)).join(" ") },
            { wave: "drum", vol: 0.06, notes: rep("r - - r - - r - - - r - - r - -", 8) },
            { wave: "drum", vol: 0.05, notes: rep("k c c k k c c k k c c k k c c k", 8) },
        ],
    },

    stage: {
        bpm: 122,
        loop: true,
        tracks: [
            {
                ...BELL,
                notes: [
                    "F5 . . D5 . . A5 . . . G5 . F5 . D5 .",
                    "E5 . . C5 . . G5 . . . . . E5 . . .",
                    "D5 . . Bb4 . . F5 . . . E5 . D5 . C5 .",
                    "C5 . . . . . . . - - - - - - - -",
                    "F5 . . D5 . . A5 . . . C6 . A5 . G5 .",
                    "G5 . . E5 . . C6 . . . . . G5 . . .",
                    "F5 . . D5 . . Bb5 . . . A5 . G5 . F5 .",
                    "G5 . . . . . F5 . . . . . - - - -",
                ].join(" "),
            },
            { ...EP, vol: 0.045, notes: rep(voice(D_CH, 0, HOUSE_STAB), 2) },
            { ...EP, vol: 0.045, notes: rep(voice(D_CH, 1, HOUSE_STAB), 2) },
            { ...EP, vol: 0.045, notes: rep(voice(D_CH, 2, HOUSE_STAB), 2) },
            { wave: "sawtooth", vol: 0.035, gate: 0.45, notes: rep(D_BASS.map((r) => { const o = r.replace("1", "2"); return `${r} - ${o} - ${r} - ${o} ${r} - ${r} ${o} - ${r} - ${o} -`; }).join(" "), 2) },
            { wave: "drum", vol: 0.075, notes: rep("k - o - k - o - k - o - k - o -", 8) },
            { wave: "drum", vol: 0.06, notes: rep("- - - - p - - - - - - - p - - c", 8) },
        ],
    },

    night: {
        bpm: 96,
        swing: 0.55,
        loop: true,
        tracks: [
            {
                wave: "square", vol: 0.022, gate: 0.9, vib: 0.15, vibRate: 4.8, attack: 0.02, echo: { time: 0.47, fb: 0.35, mix: 0.35 },
                notes: [
                    "- - A4 . C5 . E5 . . . D5 . C5 . A4 .",
                    "B4 . . . . . - - G4 . B4 . D5 . F5 .",
                    "E5 . . . . . . . D5 . C5 . B4 . G4 .",
                    "A4 . . . . . . . - - - - C#5 . E5 .",
                    "F5 . . . E5 . D5 . . . C5 . A4 . . .",
                    "G4 . B4 . D5 . F5 . . . E5 . D5 . . .",
                    "C5 . . . E5 . . . G5 . . . B5 . . .",
                    "A5 . . . G5 . . . E5 . . . C#5 . . .",
                ].join(" "),
            },
            { ...EP, vol: 0.05, notes: rep(voice(N_CH, 0, [6, 14]), 2) },
            { ...EP, vol: 0.05, notes: rep(voice(N_CH, 1, [6, 14]), 2) },
            { ...EP, vol: 0.05, notes: rep(voice(N_CH, 2, [6, 14]), 2) },
            {
                wave: "triangle", vol: 0.17, gate: 0.7,
                notes: rep("D2 . . . F2 . . . A2 . . . C3 . . . G2 . . . B2 . . . D3 . . . F2 . . . C2 . . . E2 . . . G2 . . . B2 . . . A2 . . . C#3 . . . E3 . . . G2 . . .", 2),
            },
            { wave: "drum", vol: 0.055, notes: rep("h - - - h - h - h - - - h - h -", 8) },
            { wave: "drum", vol: 0.05, notes: rep("k - - - - - - - - - - - - - r -", 8) },
        ],
    },

    sheet: {
        bpm: 88,
        loop: true,
        tracks: [
            {
                ...BELL, vol: 0.07,
                notes: [
                    "G5 . . . E5 . . . C6 . . .",
                    "B5 . . . A5 . . . E5 . . .",
                    "F5 . . . A5 . . . C6 . . .",
                    "B5 . . . . . . . G5 . . .",
                    "G5 . . . E5 . . . C6 . . .",
                    "E6 . . . D6 . . . C6 . . .",
                    "A5 . . . F5 . . . D5 . . .",
                    "G5 . . . . . . . - - - -",
                ].join(" "),
            },
            { ...EP, vol: 0.04, notes: voice(S_CH, 0, [4, 8], 12) },
            { ...EP, vol: 0.04, notes: voice(S_CH, 1, [4, 8], 12) },
            { wave: "sine", vol: 0.14, gate: 0.85, notes: S_BASS.map((r) => at(r, [0], 12, 4)).join(" ") },
            { wave: "drum", vol: 0.035, notes: rep("c - - - c - c - c - - -", 8) },
        ],
    },

    story: {
        bpm: 80,
        loop: true,
        tracks: [
            {
                ...FLUTE, vol: 0.09,
                notes: [
                    "E5 . . . . . D5 . C5 . . . G4 . . .",
                    "A4 . . . . . . . C5 . . . E5 . . .",
                    "D5 . . . . . C5 . A4 . . . F4 . . .",
                    "G4 . . . . . . . - - - - - - - -",
                ].join(" "),
            },
            { ...EP, vol: 0.04, decay: 0.5, notes: voice([["E3", "G3", "C4"], ["E3", "A3", "C4"], ["F3", "A3", "D4"], ["F3", "B3", "D4"]], 0, [0, 6, 10]) },
            { ...EP, vol: 0.04, decay: 0.5, notes: voice([["E3", "G3", "C4"], ["E3", "A3", "C4"], ["F3", "A3", "D4"], ["F3", "B3", "D4"]], 1, [0, 6, 10]) },
            { ...EP, vol: 0.04, decay: 0.5, notes: voice([["E3", "G3", "C4"], ["E3", "A3", "C4"], ["F3", "A3", "D4"], ["F3", "B3", "D4"]], 2, [0, 6, 10]) },
            { wave: "sine", vol: 0.13, gate: 0.9, notes: ["C3", "A2", "D3", "G2"].map((r) => at(r, [0, 10], 16, 6)).join(" ") },
        ],
    },

    clear: {
        bpm: 128,
        loop: false,
        tracks: [
            { ...BELL, vol: 0.08, notes: "C5 E5 G5 C6 . . E6 . . . D6 . C6 . . . A5 . C6 . . . . . . . . . - - - -" },
            { ...EP, vol: 0.06, decay: 0.6, notes: "E4 . . . . . . . . . . . . . . . F4 . . . . . . . . . . . - - - -" },
            { ...EP, vol: 0.06, decay: 0.6, notes: "G4 . . . . . . . . . . . . . . . A4 . . . . . . . . . . . - - - -" },
            { wave: "sine", vol: 0.15, notes: "C3 . . . . . . . . . . . . . . . F2 . . . . . . . . . . . - - - -" },
            { wave: "drum", vol: 0.06, notes: "k - - r - - r - k - - r - - p - k - - - - - - - - - - - - - - -" },
        ],
    },

    gameover: {
        bpm: 72,
        loop: false,
        tracks: [
            { ...FLUTE, vol: 0.09, notes: "E5 . . . D5 . C5 . B4 . . . . . . . A4 . . . . . . . . . . . - - - -" },
            { ...EP, vol: 0.05, decay: 0.8, notes: "A3 . . . . . . . G#3 . . . . . . . A3 . . . . . . . . . . . - - - -" },
            { ...EP, vol: 0.05, decay: 0.8, notes: "C4 . . . . . . . D4 . . . . . . . C4 . . . . . . . . . . . - - - -" },
            { wave: "sine", vol: 0.13, notes: "F2 . . . . . . . E2 . . . . . . . A2 . . . . . . . . . . . - - - -" },
        ],
    },
};

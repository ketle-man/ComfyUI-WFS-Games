/**
 * TURBO HEART の BGM (オリジナル曲)
 * 書式は common/audio.js を参照。1トークン = 16分音符。1小節 = 16トークン。
 */

const rep = (s, n) => Array(n).fill(s).join(" ");
const arp = (a, b, c, d) => rep(`${a} ${b} ${c} ${d}`, 4);
const octBass = (lo, hi) => rep(`${lo} . ${hi} .`, 4);
// 16分のスラップ風ベース1小節(root はオクターブ番号なしの音名、fifth は5度の音)
const slap = (r, fifth) => `${r}2 . ${r}3 ${r}2 . ${r}2 ${r}3 . ${r}2 . ${r}3 ${r}2 . ${fifth} ${r}3 .`;
// ゆったりしたシンコペーションのベース1小節
const slapHalf = (r, fifth) => `${r}2 . . . . . ${r}3 . . . ${r}2 . . . ${fifth} .`;
// 裏拍に短くコードを刻む1小節
const stab = (n) => `- - ${n} . - - ${n} - - - ${n} . - ${n} . -`;
// 音を n 個分のばす
const hold = (n, len) => [n, ...Array(len - 1).fill(".")].join(" ");
// タイトル曲の和音(声部ごと): Fmaj7, Em7, Dm7, G7, Cmaj7
const TITLE_CHORDS = [
    ["A4", "G4", "F4", "F4", "G4"],
    ["C5", "B4", "A4", "B4", "B4"],
    ["E5", "D5", "C5", "D5", "E5"],
];
// レース曲の和音(3声): Fmaj7 Em7 Dm7 G7 Am7 D7 Dm7 G7
const RACE_CHORDS = [
    ["A4", "C5", "E5"], ["G4", "B4", "D5"], ["F4", "A4", "C5"], ["F4", "B4", "D5"],
    ["G4", "C5", "E5"], ["F#4", "A4", "C5"], ["F4", "A4", "C5"], ["F4", "B4", "D5"],
];

export const SONGS = {
    // タイトル(シティポップ風のミディアム): Fmaj7 - Em7 - Dm7 G7 - Cmaj7
    title: {
        bpm: 112,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.05, gate: 0.95,
                notes: [
                    "A5 . . . G5 . E5 . . . . . C5 . D5 .",
                    "E5 . . . . . D5 . E5 . G5 . . . . .",
                    "F5 . . . E5 . D5 . . . B4 . . . G4 .",
                    "C5 . . . . . . . . . . . - - - -",
                ].join(" "),
            },
            // 和音(3声、各小節のばす): Fmaj7 / Em7 / Dm7→G7 / Cmaj7
            ...TITLE_CHORDS.map(([a, b, c1, c2, d]) => ({
                wave: "pulse12", vol: 0.014, gate: 0.97,
                notes: [hold(a, 16), hold(b, 16), `${hold(c1, 8)} ${hold(c2, 8)}`, hold(d, 16)].join(" "),
            })),
            {
                wave: "triangle", vol: 0.15, gate: 0.8,
                notes: [slapHalf("F", "C3"), slapHalf("E", "B2"), "D2 . . . . . D3 . G2 . . . . . D3 .", slapHalf("C", "G2")].join(" "),
            },
            { wave: "drum", vol: 0.1, notes: rep("k - h - s - h - k - h k s - h -", 4) },
        ],
    },

    // レース(80年代シティポップ/フュージョン風): Fmaj7 - Em7 - Dm7 - G7 - Am7 - D7 - Dm7 - G7
    // 16分のスラップ風ベース、裏拍のコードの刻み、シンコペーションのメロディ、16分のハイハット
    race: {
        bpm: 148,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.052, gate: 0.92,
                notes: [
                    "- - E5 . G5 . A5 . . . C6 . A5 . G5 .",
                    "E5 . . . D5 . E5 . . . G5 . . . . .",
                    "- - F5 . A5 . C6 . . . B5 . A5 . F5 .",
                    "G5 . . . . . F5 . E5 . D5 . . . B4 .",
                    "- - C6 . B5 . A5 . . . G5 . E5 . G5 .",
                    "F#5 . . . E5 . F#5 . . . A5 . . . . .",
                    "A5 . G5 . F5 . E5 . . . D5 . . . C5 .",
                    "D5 . . . . . . . - - B4 . D5 . G5 .",
                ].join(" "),
            },
            // コードの刻み(3声): 裏拍に短く
            ...[0, 1, 2].map((voice) => ({
                wave: "pulse12", vol: 0.018, gate: 0.45,
                notes: RACE_CHORDS.map((ch) => stab(ch[voice])).join(" "),
            })),
            {
                wave: "triangle", vol: 0.16, gate: 0.6,
                notes: [
                    slap("F", "C3"), slap("E", "B2"), slap("D", "A2"), slap("G", "D3"),
                    slap("A", "E3"), slap("D", "A2"), slap("D", "A2"), slap("G", "D3"),
                ].join(" "),
            },
            {
                wave: "drum", vol: 0.12,
                notes: [rep("k h h h s h h k k h h h s h h h", 7), "k h s h s h h k k h s s s - s s"].join(" "),
            },
        ],
    },

    // 会話: Am - F - C - G
    story: {
        bpm: 96,
        loop: true,
        tracks: [
            {
                wave: "triangle", vol: 0.11,
                notes: [
                    "C5 . . . . . B4 . A4 . . . E5 . . .",
                    "F5 . . . . . E5 . C5 . . . A4 . . .",
                    "G4 . . . C5 . . . E5 . . . G5 . E5 .",
                    "D5 . . . . . . . - - - - B4 . . .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.026, gate: 0.95,
                notes: [
                    "A2 . . . . . . . E3 . . . . . . .",
                    "F2 . . . . . . . C3 . . . . . . .",
                    "C3 . . . . . . . G2 . . . . . . .",
                    "G2 . . . . . . . D3 . . . . . . .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.015, gate: 0.5,
                notes: [
                    rep("A3 . C4 . E4 . C4 .", 2), rep("F3 . A3 . C4 . A3 .", 2),
                    rep("C4 . E4 . G4 . E4 .", 2), rep("G3 . B3 . D4 . B3 .", 2),
                ].join(" "),
            },
        ],
    },

    // ゴール(入賞)のジングル
    clear: {
        bpm: 150,
        loop: false,
        tracks: [
            { wave: "pulse25", vol: 0.06, notes: "G4 . C5 . E5 . G5 . . . E5 . G5 . . . C6 . . . . . . . - - - -" },
            { wave: "triangle", vol: 0.14, notes: "C3 . . . . . . . G2 . . . C3 . . . . . . . . . . . - - - -" },
        ],
    },

    // ゲームオーバー
    gameover: {
        bpm: 96,
        loop: false,
        tracks: [
            { wave: "pulse25", vol: 0.055, notes: "E5 . . . D5 . . . C5 . . . B4 . . . A4 . . . . . . . - - - -" },
            { wave: "triangle", vol: 0.13, notes: "A2 . . . . . . . F2 . . . . . . . E2 . . . . . . . - - - -" },
        ],
    },
};

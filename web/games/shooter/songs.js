/**
 * Star Formation の BGM (オリジナル曲)
 * 書式は audio.js を参照。1トークン = 16分音符。1小節 = 16トークン。
 */

const rep = (s, n) => Array(n).fill(s).join(" ");

// 4和音のアルペジオ1小節分 (16分 x16)
const arp = (a, b, c, d) => rep(`${a} ${b} ${c} ${d}`, 4);
// 8分のオクターブベース1小節分
const octBass = (lo, hi) => rep(`${lo} . ${hi} .`, 4);

export const SONGS = {
    // タイトル / エンディング: C - Am - F - G
    title: {
        bpm: 120,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.055,
                notes: [
                    "E5 . . . G5 . . . C6 . . . B5 . A5 .",
                    "A5 . . . E5 . . . A5 . . . G5 . E5 .",
                    "F5 . . . A5 . . . C6 . . . A5 . F5 .",
                    "G5 . . . . . . . D5 . E5 . F5 . G5 .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.03, gate: 0.95,
                notes: [
                    "C5 . . . . . . . E5 . . . . . . .",
                    "C5 . . . . . . . A4 . . . . . . .",
                    "A4 . . . . . . . C5 . . . . . . .",
                    "B4 . . . . . . . D5 . . . . . . .",
                ].join(" "),
            },
            {
                wave: "triangle", vol: 0.13,
                notes: [rep("C3 . G2 .", 4), rep("A2 . E2 .", 4), rep("F2 . C3 .", 4), rep("G2 . D3 .", 4)].join(" "),
            },
            { wave: "drum", vol: 0.12, notes: rep("k - - - s - - - k - k - s - - h", 4) },
        ],
    },

    // ステージ: Am - F - G - E (8小節)。ステージごとに移調・テンポを変えて使う
    stage: {
        bpm: 150,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.055,
                notes: [
                    "A4 . . C5 . . E5 . D5 . C5 . B4 . A4 .",
                    "A4 . . C5 . . F5 . E5 . D5 . C5 . A4 .",
                    "B4 . . D5 . . G5 . F5 . E5 . D5 . B4 .",
                    "G#4 . . B4 . . E5 . . . - - E5 . D5 .",
                    "E5 . . . A5 . . . G5 . E5 . C5 . D5 .",
                    "C5 . . . F5 . . . E5 . C5 . A4 . C5 .",
                    "D5 . . . G5 . . . F5 . D5 . B4 . D5 .",
                    "E5 . . . . . . . G#4 . B4 . E5 . . .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.022, gate: 0.6,
                notes: [
                    arp("A3", "C4", "E4", "C4"), arp("F3", "A3", "C4", "A3"), arp("G3", "B3", "D4", "B3"), arp("E3", "G#3", "B3", "G#3"),
                    arp("A3", "C4", "E4", "C4"), arp("F3", "A3", "C4", "A3"), arp("G3", "B3", "D4", "B3"), arp("E3", "G#3", "B3", "G#3"),
                ].join(" "),
            },
            {
                wave: "triangle", vol: 0.14, gate: 0.7,
                notes: [
                    octBass("A2", "A3"), octBass("F2", "F3"), octBass("G2", "G3"), octBass("E2", "E3"),
                    octBass("A2", "A3"), octBass("F2", "F3"), octBass("G2", "G3"), octBass("E2", "E3"),
                ].join(" "),
            },
            {
                wave: "drum", vol: 0.12,
                notes: [rep("k - h - s - h - k - h k s - h h", 7), "k - h - s - h - k - s s s - s s"].join(" "),
            },
        ],
    },

    // 会話シーン: Am - F - C - G (しっとり)
    story: {
        bpm: 92,
        loop: true,
        tracks: [
            {
                wave: "triangle", vol: 0.11,
                notes: [
                    "E5 . . . . . D5 . C5 . . . B4 . . .",
                    "C5 . . . . . A4 . F4 . . . A4 . . .",
                    "G4 . . . C5 . . . E5 . . . D5 . C5 .",
                    "D5 . . . . . . . - - - - B4 . . .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.028, gate: 0.95,
                notes: [
                    "A2 . . . . . . . E3 . . . . . . .",
                    "F2 . . . . . . . C3 . . . . . . .",
                    "C3 . . . . . . . G2 . . . . . . .",
                    "G2 . . . . . . . D3 . . . . . . .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.016, gate: 0.5,
                notes: [
                    rep("A3 . C4 . E4 . C4 .", 2), rep("F3 . A3 . C4 . A3 .", 2),
                    rep("C4 . E4 . G4 . E4 .", 2), rep("G3 . B3 . D4 . B3 .", 2),
                ].join(" "),
            },
        ],
    },

    // ボス戦: Em - Em - C - D (速く、せわしなく)。ステージごとに移調して使う
    boss: {
        bpm: 172,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.055,
                notes: [
                    "E5 . E5 . G5 . E5 . B5 . . . A5 . G5 .",
                    "F#5 . . . E5 . . . D5 . E5 . F#5 . . .",
                    "G5 . G5 . E5 . G5 . C6 . . . B5 . A5 .",
                    "B5 . . . A5 . . . F#5 . . . D5 . . .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.022, gate: 0.6,
                notes: [arp("E4", "G4", "B4", "G4"), arp("E4", "G4", "B4", "G4"), arp("C4", "E4", "G4", "E4"), arp("D4", "F#4", "A4", "F#4")].join(" "),
            },
            {
                wave: "triangle", vol: 0.15, gate: 0.6,
                notes: [octBass("E2", "E3"), octBass("E2", "E3"), octBass("C2", "C3"), octBass("D2", "D3")].join(" "),
            },
            { wave: "drum", vol: 0.13, notes: rep("k h s h k h s h k h s h k k s h", 4) },
        ],
    },

    // ステージクリアのジングル
    clear: {
        bpm: 140,
        loop: false,
        tracks: [
            { wave: "pulse25", vol: 0.06, notes: "C5 . E5 . G5 . C6 . . . G5 . C6 . . . . . . . - - - -" },
            { wave: "triangle", vol: 0.14, notes: "C3 . . . . . . . G2 . . . C3 . . . . . . . - - - -" },
        ],
    },

    // ゲームオーバー
    gameover: {
        bpm: 100,
        loop: false,
        tracks: [
            { wave: "pulse25", vol: 0.055, notes: "A4 . . . G4 . . . E4 . . . D4 . . . C4 . . . . . . . - - - -" },
            { wave: "triangle", vol: 0.13, notes: "A2 . . . . . . . F2 . . . . . . . E2 . . . . . . . - - - -" },
        ],
    },
};

/**
 * SKY HEART の BGM (オリジナル曲)
 * 書式は common/audio.js を参照。1トークン = 16分音符。1小節 = 16トークン。
 */

const rep = (s, n) => Array(n).fill(s).join(" ");
const arp = (a, b, c, d) => rep(`${a} ${b} ${c} ${d}`, 4);
const octBass = (lo, hi) => rep(`${lo} . ${hi} .`, 4);
const hold = (n, len) => [n, ...Array(len - 1).fill(".")].join(" ");

export const SONGS = {
    // タイトル(ゆったりした飛翔感): D - Bm - G - A
    title: {
        bpm: 116,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.05, gate: 0.95,
                notes: [
                    "F#5 . . . A5 . . . D6 . . . . . C#6 .",
                    "B5 . . . . . F#5 . . . D5 . . . . .",
                    "G5 . . . B5 . . . D6 . . . E6 . D6 .",
                    "C#6 . . . . . . . A5 . . . - - - -",
                ].join(" "),
            },
            { wave: "pulse12", vol: 0.016, gate: 0.6, notes: [arp("D4", "F#4", "A4", "F#4"), arp("B3", "D4", "F#4", "D4"), arp("G3", "B3", "D4", "B3"), arp("A3", "C#4", "E4", "C#4")].join(" ") },
            { wave: "triangle", vol: 0.15, gate: 0.85, notes: [octBass("D2", "D3"), octBass("B1", "B2"), octBass("G1", "G2"), octBass("A1", "A2")].join(" ") },
            { wave: "drum", vol: 0.09, notes: rep("k - h - s - h - k - h k s - h -", 4) },
        ],
    },

    // ステージ(疾走感): Em - C - D - B7 を2回、後半は高く
    stage: {
        bpm: 156,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.05, gate: 0.85,
                notes: [
                    "E5 . G5 . B5 . . . A5 . G5 . E5 . . .",
                    "C5 . E5 . G5 . . . A5 . G5 . E5 . C5 .",
                    "D5 . F#5 . A5 . . . B5 . A5 . F#5 . . .",
                    "D#5 . . . F#5 . . . B5 . . . A5 . F#5 .",
                    "G5 . B5 . E6 . . . D6 . B5 . G5 . . .",
                    "E5 . G5 . C6 . . . B5 . A5 . G5 . E5 .",
                    "F#5 . A5 . D6 . . . C6 . B5 . A5 . . .",
                    "B5 . . . . . . . D#5 . F#5 . A5 . B5 .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.016, gate: 0.45,
                notes: [arp("E4", "G4", "B4", "G4"), arp("C4", "E4", "G4", "E4"), arp("D4", "F#4", "A4", "F#4"), arp("B3", "D#4", "F#4", "A4"),
                    arp("E4", "G4", "B4", "G4"), arp("C4", "E4", "G4", "E4"), arp("D4", "F#4", "A4", "F#4"), arp("B3", "D#4", "F#4", "A4")].join(" "),
            },
            { wave: "triangle", vol: 0.15, gate: 0.7, notes: rep([octBass("E2", "E3"), octBass("C2", "C3"), octBass("D2", "D3"), octBass("B1", "B2")].join(" "), 2) },
            { wave: "drum", vol: 0.09, notes: rep("k - h - s - h k k - h - s - h h", 8) },
        ],
    },

    // ボス(緊迫感): Am - Bb の繰り返し
    boss: {
        bpm: 164,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.05, gate: 0.8,
                notes: [
                    "A4 . A4 . C5 . A4 . E5 . . . D#5 . E5 .",
                    "Bb4 . Bb4 . D5 . Bb4 . F5 . . . E5 . F5 .",
                    "A4 . A4 . C5 . A4 . G5 . F5 . E5 . C5 .",
                    "Bb4 . D5 . F5 . A5 . G#5 . . . . . . .",
                ].join(" "),
            },
            { wave: "pulse12", vol: 0.018, gate: 0.4, notes: [arp("A3", "C4", "E4", "C4"), arp("Bb3", "D4", "F4", "D4"), arp("A3", "C4", "E4", "C4"), arp("Bb3", "D4", "F4", "E4")].join(" ") },
            { wave: "triangle", vol: 0.16, gate: 0.6, notes: [rep("A1 A2", 8), rep("Bb1 Bb2", 8), rep("A1 A2", 8), rep("Bb1 Bb2", 8)].join(" ") },
            { wave: "drum", vol: 0.1, notes: rep("k h s h k k s h k h s h k k s s", 4) },
        ],
    },

    // 会話: F - G - Em - Am
    story: {
        bpm: 92,
        loop: true,
        tracks: [
            {
                wave: "triangle", vol: 0.11,
                notes: [
                    "A4 . . . C5 . . . F5 . . . E5 . . .",
                    "D5 . . . . . B4 . G4 . . . . . . .",
                    "G4 . . . B4 . . . E5 . . . D5 . . .",
                    "C5 . . . . . . . - - - - . . . .",
                ].join(" "),
            },
            { wave: "pulse12", vol: 0.024, gate: 0.95, notes: [hold("F3", 16), hold("G3", 16), hold("E3", 16), hold("A3", 16)].join(" ") },
            { wave: "pulse12", vol: 0.013, gate: 0.5, notes: [rep("F3 . A3 . C4 . A3 .", 2), rep("G3 . B3 . D4 . B3 .", 2), rep("E3 . G3 . B3 . G3 .", 2), rep("A3 . C4 . E4 . C4 .", 2)].join(" ") },
        ],
    },

    clear: {
        bpm: 150,
        loop: false,
        tracks: [
            { wave: "pulse25", vol: 0.06, notes: "D5 . F#5 . A5 . D6 . . . A5 . D6 . . . E6 . . . F#6 . . . . . . . - - - -" },
            { wave: "triangle", vol: 0.14, notes: "D3 . . . . . . . A2 . . . D3 . . . A2 . . . D3 . . . . . . . - - - -" },
        ],
    },

    gameover: {
        bpm: 92,
        loop: false,
        tracks: [
            { wave: "pulse25", vol: 0.055, notes: "B4 . . . A4 . . . G4 . . . F#4 . . . E4 . . . . . . . - - - -" },
            { wave: "triangle", vol: 0.13, notes: "E2 . . . . . . . C2 . . . . . . . B1 . . . . . . . - - - -" },
        ],
    },
};

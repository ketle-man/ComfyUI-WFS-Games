/**
 * KNIGHT HEART の BGM (オリジナル曲)
 * 書式は common/audio.js を参照。1トークン = 16分音符。1小節 = 16トークン。
 */

const rep = (s, n) => Array(n).fill(s).join(" ");
const arp = (a, b, c, d) => rep(`${a} ${b} ${c} ${d}`, 4);
const bounce = (lo, hi) => rep(`${lo} . ${hi} . ${hi} . ${lo} .`, 2);
const hold = (n, len) => [n, ...Array(len - 1).fill(".")].join(" ");

export const SONGS = {
    // タイトル(勇ましい行進曲風): C - F - G - C
    title: {
        bpm: 128,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.05, gate: 0.9,
                notes: [
                    "G4 . . C5 . . E5 . G5 . . . E5 . G5 .",
                    "A5 . . . F5 . . . C5 . . . F5 . A5 .",
                    "G5 . . . F5 . E5 . D5 . . . B4 . D5 .",
                    "C5 . . . . . . . G4 . C5 . - - - -",
                ].join(" "),
            },
            { wave: "pulse12", vol: 0.017, gate: 0.6, notes: [arp("C4", "E4", "G4", "E4"), arp("F4", "A4", "C5", "A4"), arp("G4", "B4", "D5", "B4"), arp("C4", "E4", "G4", "E4")].join(" ") },
            { wave: "triangle", vol: 0.15, gate: 0.8, notes: [bounce("C2", "C3"), bounce("F1", "F2"), bounce("G1", "G2"), bounce("C2", "C3")].join(" ") },
            { wave: "drum", vol: 0.09, notes: rep("k - h - s - h h k - k - s - h -", 4) },
        ],
    },

    // 野外ステージ(はずむ冒険曲): F - Dm - Bb - C を2回、後半は高く
    stage: {
        bpm: 150,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.05, gate: 0.75,
                notes: [
                    "C5 . F5 . A5 . F5 . C6 . . . A5 . . .",
                    "D5 . F5 . A5 . . . G5 . F5 . D5 . . .",
                    "Bb4 . D5 . F5 . Bb5 . A5 . G5 . F5 . D5 .",
                    "C5 . E5 . G5 . . . C6 . . . Bb5 . G5 .",
                    "A5 . C6 . F6 . C6 . A5 . . . F5 . . .",
                    "F5 . A5 . D6 . . . C6 . A5 . F5 . D5 .",
                    "D5 . F5 . Bb5 . D6 . C6 . Bb5 . A5 . G5 .",
                    "G5 . . . E5 . . . C5 . E5 . G5 . Bb5 .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.016, gate: 0.45,
                notes: rep([arp("F4", "A4", "C5", "A4"), arp("D4", "F4", "A4", "F4"), arp("Bb3", "D4", "F4", "D4"), arp("C4", "E4", "G4", "E4")].join(" "), 2),
            },
            { wave: "triangle", vol: 0.15, gate: 0.7, notes: rep([bounce("F2", "F3"), bounce("D2", "D3"), bounce("Bb1", "Bb2"), bounce("C2", "C3")].join(" "), 2) },
            { wave: "drum", vol: 0.09, notes: rep("k - h - s - h k - k h - s - h h", 8) },
        ],
    },

    // 洞窟・城のステージ(緊張感のある短調): Am - F - G - E
    dungeon: {
        bpm: 140,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.05, gate: 0.8,
                notes: [
                    "A4 . . C5 . . E5 . A5 . . . G5 . E5 .",
                    "F5 . . . E5 . . . C5 . . . A4 . . .",
                    "G4 . . B4 . . D5 . G5 . . . F5 . D5 .",
                    "E5 . . . . . G#4 . B4 . . . E5 . . .",
                    "A5 . . . E5 . . . C6 . . . B5 . A5 .",
                    "F5 . . . A5 . . . C6 . . . A5 . F5 .",
                    "G5 . . . D5 . . . B5 . . . A5 . G5 .",
                    "G#5 . . . E5 . . . B4 . . . G#4 . . .",
                ].join(" "),
            },
            {
                wave: "pulse12", vol: 0.016, gate: 0.45,
                notes: rep([arp("A3", "C4", "E4", "C4"), arp("F3", "A3", "C4", "A3"), arp("G3", "B3", "D4", "B3"), arp("E3", "G#3", "B3", "G#3")].join(" "), 2),
            },
            { wave: "triangle", vol: 0.15, gate: 0.6, notes: rep([rep("A1 . A2 .", 4), rep("F1 . F2 .", 4), rep("G1 . G2 .", 4), rep("E1 . E2 .", 4)].join(" "), 2) },
            { wave: "drum", vol: 0.09, notes: rep("k - h - s - h - k k h - s - h s", 8) },
        ],
    },

    // ボス(緊迫感): Dm - C - Bb - A
    boss: {
        bpm: 168,
        loop: true,
        tracks: [
            {
                wave: "pulse25", vol: 0.05, gate: 0.8,
                notes: [
                    "D5 . D5 . F5 . D5 . A5 . . . G#5 . A5 .",
                    "C5 . C5 . E5 . C5 . G5 . . . F#5 . G5 .",
                    "Bb4 . Bb4 . D5 . Bb4 . F5 . E5 . D5 . Bb4 .",
                    "A4 . C#5 . E5 . A5 . G5 . . . E5 . C#5 .",
                ].join(" "),
            },
            { wave: "pulse12", vol: 0.018, gate: 0.4, notes: [arp("D4", "F4", "A4", "F4"), arp("C4", "E4", "G4", "E4"), arp("Bb3", "D4", "F4", "D4"), arp("A3", "C#4", "E4", "C#4")].join(" ") },
            { wave: "triangle", vol: 0.16, gate: 0.6, notes: [rep("D2 D3", 8), rep("C2 C3", 8), rep("Bb1 Bb2", 8), rep("A1 A2", 8)].join(" ") },
            { wave: "drum", vol: 0.1, notes: rep("k h s h k k s h k h s h k k s s", 4) },
        ],
    },

    // 会話: C - Am - F - G
    story: {
        bpm: 96,
        loop: true,
        tracks: [
            {
                wave: "triangle", vol: 0.11,
                notes: [
                    "E5 . . . G5 . . . C6 . . . B5 . . .",
                    "A5 . . . . . E5 . C5 . . . . . . .",
                    "F5 . . . A5 . . . C6 . . . A5 . . .",
                    "G5 . . . . . . . D5 . . . - - - -",
                ].join(" "),
            },
            { wave: "pulse12", vol: 0.024, gate: 0.95, notes: [hold("C3", 16), hold("A2", 16), hold("F2", 16), hold("G2", 16)].join(" ") },
            { wave: "pulse12", vol: 0.013, gate: 0.5, notes: [rep("C4 . E4 . G4 . E4 .", 2), rep("A3 . C4 . E4 . C4 .", 2), rep("F3 . A3 . C4 . A3 .", 2), rep("G3 . B3 . D4 . B3 .", 2)].join(" ") },
        ],
    },

    clear: {
        bpm: 150,
        loop: false,
        tracks: [
            { wave: "pulse25", vol: 0.06, notes: "C5 . E5 . G5 . C6 . . . G5 . C6 . . . D6 . . . E6 . . . . . . . - - - -" },
            { wave: "triangle", vol: 0.14, notes: "C3 . . . . . . . G2 . . . C3 . . . G2 . . . C3 . . . . . . . - - - -" },
        ],
    },

    gameover: {
        bpm: 90,
        loop: false,
        tracks: [
            { wave: "pulse25", vol: 0.055, notes: "E5 . . . D5 . . . C5 . . . B4 . . . A4 . . . . . . . - - - -" },
            { wave: "triangle", vol: 0.13, notes: "A2 . . . . . . . F2 . . . . . . . E2 . . . . . . . - - - -" },
        ],
    },
};

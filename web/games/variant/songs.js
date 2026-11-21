/**
 * VARIANT HEART の BGM (オリジナル曲)
 * 書式は common/audio.js を参照。1トークン = 16分音符。1小節 = 16トークン。
 *
 * 他のゲーム(矩形波メロディ + 細かいアルペジオ + 三角波ベース)と聞き分けられるように、
 * この作品は「ノコギリ波のリフベース + 3-3-2 で刻む矩形波のスタブ + やまびこ付きのリード」で組む。
 */
const rep = (s, n) => Array(n).fill(s).join(" ");
/** 3-3-2 のスタブ(1小節): 音 a を 0・3・6・10・12 ステップに置く */
const stab = (a, b = a) => `${a} - - ${a} - - ${b} - - - ${b} - ${a} - - -`;

const LEAD = { wave: "pulse12", vol: 0.042, gate: 0.85, vib: 0.22, vibRate: 6, attack: 0.008, echo: { time: 0.256, fb: 0.3, mix: 0.28 } };
const BASS = { wave: "sawtooth", vol: 0.05, gate: 0.55 };
const STAB = { wave: "square", vol: 0.018, gate: 0.3 };

export const SONGS = {
    // タイトル(格納庫で出撃を待つ): D - C/D - Bb - C のミクソリディアン、ゆったりした半分のノリ
    title: {
        bpm: 118,
        loop: true,
        tracks: [
            {
                ...LEAD, vol: 0.045, echo: { time: 0.38, fb: 0.38, mix: 0.36 },
                notes: [
                    "A5 . . . . . F#5 . G5 . A5 . . . D6 .",
                    "E6 . . . . . D6 . C6 . . . G5 . . .",
                    "F5 . . . . . G5 . A5 . Bb5 . . . D6 .",
                    "C6 . . . . . . . E5 . G5 . C6 . E6 .",
                ].join(" "),
            },
            { wave: "square", vol: 0.012, gate: 0.98, notes: ["F#4 . . . . . . . . . . . . . . .", "E4 . . . . . . . . . . . . . . .", "D4 . . . . . . . . . . . . . . .", "E4 . . . . . . . . . . . . . . ."].join(" ") },
            { ...BASS, gate: 0.9, notes: ["D2 . . . . . . . D2 . . . D3 . . .", "C2 . . . . . . . C2 . . . C3 . . .", "Bb1 . . . . . . . Bb1 . . . Bb2 . . .", "C2 . . . . . . . C2 . . . C3 . G1 ."].join(" ") },
            { wave: "drum", vol: 0.085, notes: rep("k - - - c - - - s - - - c - k -", 3) + " k - - - c - - - s - - s p - p p" },
        ],
    },

    // ステージ(空戦の疾走感): 176BPM、Cm のリフ。3-3-2 のスタブとノコギリ波のベースで前へ押し出す
    stage: {
        bpm: 176,
        loop: true,
        tracks: [
            {
                ...LEAD,
                notes: [
                    "G5 . . . Eb5 . F5 . G5 . . Bb5 . . G5 .",
                    "Ab5 . . . G5 . F5 . Eb5 . . C5 . . Eb5 .",
                    "G5 . . . Bb5 . C6 . D6 . . C6 . Bb5 G5 .",
                    "B5 . . . . . D6 . F6 . . D6 . B5 . .",
                    "C6 . . . G5 . Ab5 . Bb5 . . Eb6 . . D6 .",
                    "C6 . . . Ab5 . Bb5 . C6 . . Eb6 . . F6 .",
                    "G6 . . . F6 . Eb6 . D6 . . Eb6 . . F6 .",
                    "D6 . . . B5 . G5 . - - - - G5 B5 D6 F6",
                ].join(" "),
            },
            { ...STAB, notes: rep([stab("G4", "Eb4"), stab("Ab4", "Eb4"), stab("G4", "Bb4"), stab("B4", "D5")].join(" "), 2) },
            {
                ...BASS,
                notes: rep([
                    "C2 . C3 C2 . C3 C2 . Bb1 . Bb2 Bb1 . Bb2 G1 .",
                    "Ab1 . Ab2 Ab1 . Ab2 Ab1 . Bb1 . Bb2 Bb1 . Bb2 B1 .",
                    "C2 . C3 C2 . C3 C2 . Eb2 . Eb3 Eb2 . Eb3 F2 .",
                    "G1 . G2 G1 . G2 G1 . G1 . B1 . D2 . F2 .",
                ].join(" "), 2),
            },
            { wave: "drum", vol: 0.09, notes: rep("k - o k s - c - k - c k s c p c", 7) + " k s - s k s - s s s s s s s s s" },
        ],
    },

    // ボス(重い緊張感): E フリジア、半音上の F と三全音の Bb でぶつける 184BPM
    boss: {
        bpm: 184,
        loop: true,
        tracks: [
            {
                ...LEAD, vol: 0.04, echo: { time: 0.163, fb: 0.25, mix: 0.25 },
                notes: [
                    "E6 . . . . . F6 . E6 . . . B5 . . .",
                    "C6 . . . . . B5 . A5 . G5 . A5 . B5 .",
                    "E6 . . . G6 . F6 . E6 . . . Bb5 . . .",
                    "B5 . . . . . . . - - - - B5 C6 D6 F6",
                ].join(" "),
            },
            { ...STAB, vol: 0.016, notes: ["E4 - E4 - F4 - E4 - E4 - E4 - Bb4 - B4 -", "E4 - E4 - G4 - F4 - E4 - E4 - D4 - C4 -", "E4 - E4 - F4 - E4 - E4 - E4 - Bb4 - B4 -", "B4 - B4 - C5 - B4 - Bb4 - Bb4 - A4 - B4 -"].join(" ") },
            {
                ...BASS, vol: 0.055,
                notes: [
                    "E2 E2 E3 E2 F2 . E2 . E2 E2 E3 E2 Bb1 . B1 .",
                    "E2 E2 E3 E2 G2 . F2 . E2 E2 E3 E2 D2 . C2 .",
                    "E2 E2 E3 E2 F2 . E2 . E2 E2 E3 E2 Bb1 . B1 .",
                    "B1 B1 B2 B1 C2 . B1 . Bb1 Bb1 Bb2 Bb1 A1 . B1 .",
                ].join(" "),
            },
            { wave: "drum", vol: 0.1, notes: rep("k c s c k k s c k c s c k k s o", 3) + " s s s s s s s s k k k k s s s s" },
        ],
    },

    // ステージクリア(短いファンファーレ)
    clear: {
        bpm: 150,
        loop: false,
        tracks: [
            { ...LEAD, vol: 0.05, notes: "C5 - Eb5 - G5 - C6 . . . Bb5 - C6 - D6 . . . Eb6 . . . . . D6 . . . . . . ." },
            { ...STAB, notes: "G4 - - G4 - - Bb4 - - - Bb4 - C5 - - - G4 . . . . . F4 . . . . . . . - -" },
            { ...BASS, gate: 0.9, notes: "C2 - - - C2 - - - Bb1 - - - Bb1 - - - Ab1 . . . . . G1 . . . . . . . - -" },
            { wave: "drum", vol: 0.09, notes: "k - - - s - - - k - k - s - s s k - - - - - k - - - - - - - - -" },
        ],
    },

    // ゲームオーバー
    over: {
        bpm: 90,
        loop: false,
        tracks: [
            { ...LEAD, vol: 0.045, echo: { time: 0.4, fb: 0.4, mix: 0.4 }, notes: "G5 . . . Eb5 . . . D5 . . . B4 . . . C5 . . . . . . . - - - - - - - -" },
            { ...BASS, gate: 0.95, notes: "C2 . . . . . . . Ab1 . . . G1 . . . C2 . . . . . . . - - - - - - - -" },
        ],
    },

    // エンディング(夜明けの帰還): Eb - Bb/D - Cm - Ab - Bb、エコーの長いリードでゆったり
    ending: {
        bpm: 100,
        loop: true,
        tracks: [
            {
                ...LEAD, vol: 0.046, echo: { time: 0.45, fb: 0.4, mix: 0.38 },
                notes: [
                    "G5 . . . Bb5 . Eb6 . . . D6 . . . Bb5 .",
                    "C6 . . . . . G5 . Ab5 . . . C6 . . .",
                    "Bb5 . . . G5 . Eb5 . F5 . . . G5 . Bb5 .",
                    "Ab5 . . . C6 . Bb5 . . . . . . . - .",
                ].join(" "),
            },
            { wave: "square", vol: 0.011, gate: 0.98, notes: ["G4 . . . . . . . F4 . . . . . . .", "Eb4 . . . . . . . Eb4 . . . . . . .", "G4 . . . . . . . F4 . . . . . . .", "Eb4 . . . . . . . D4 . . . . . . ."].join(" ") },
            { ...BASS, gate: 0.9, notes: [rep("Eb2 . . . Bb1 . . .", 1), rep("D2 . . . Bb1 . . .", 1), rep("C2 . . . G1 . . .", 1), rep("Ab1 . . . Eb2 . . .", 1), rep("Eb2 . . . Bb1 . . .", 1), rep("D2 . . . Bb1 . . .", 1), rep("Ab1 . . . Eb2 . . .", 1), rep("Bb1 . . . F2 . . .", 1)].join(" ") },
            { wave: "drum", vol: 0.065, notes: rep("k - c - s - c - k - c k s - c -", 4) },
        ],
    },
};

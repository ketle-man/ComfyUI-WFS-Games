/**
 * DUNGEON HEART の BGM(オリジナル曲)
 * 書式は common/audio.js を参照。1トークン = 16分音符。1曲の全トラックは同じ長さ。
 *
 * ほかのゲームと違う音にするため、パルス波は使わず、
 * オルガン風(サイン波+ゆっくり立ち上がる和音)・チェンバロ風(のこぎり波の短い減衰)・鐘(サイン波+やまびこ)の
 * 短調のダンジョンらしい曲にしている。
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
const voice = (chords, i, steps, len = 16, hold = 1) => chords.map((c) => at(c[i], steps, len, hold)).join(" ");
const hold = (chords, i) => chords.map((c) => `${c[i]} ${rep(".", 15)}`).join(" "); // 1小節伸ばす

const ORGAN = { wave: "sine", vol: 0.045, gate: 0.98, attack: 0.12, vib: 0.05, vibRate: 5 };
const ORGAN2 = { wave: "triangle", vol: 0.02, gate: 0.98, attack: 0.15 };
const HARPSI = { wave: "sawtooth", vol: 0.026, gate: 0.6, decay: 0.12, attack: 0.002 };
const BELL = { wave: "sine", vol: 0.07, gate: 0.95, decay: 0.45, echo: { time: 0.38, fb: 0.4, mix: 0.4 } };
const LEAD = { wave: "triangle", vol: 0.09, gate: 0.9, vib: 0.16, vibRate: 5, attack: 0.02, echo: { time: 0.3, fb: 0.28, mix: 0.3 } };

// ---- タイトル: 星の井戸 (Am F G E) ----
const T_CH = [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"], ["E3", "G#3", "B3"]];
// ---- 探索: (Dm Bb C A) ----
const E_CH = [["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["C3", "E3", "G3"], ["A2", "C#3", "E3"]];
// ---- 戦闘: (Em C D B) ----
const B_CH = [["E3", "G3", "B3"], ["C3", "E3", "G3"], ["D3", "F#3", "A3"], ["B2", "D#3", "F#3"]];
// ---- ボス: (Cm Ab Bb G) ----
const X_CH = [["C3", "Eb3", "G3"], ["Ab2", "C3", "Eb3"], ["Bb2", "D3", "F3"], ["G2", "B2", "D3"]];
// ---- エンディング: (C G Am F) ----
const N_CH = [["C4", "E4", "G4"], ["B3", "D4", "G4"], ["A3", "C4", "E4"], ["A3", "C4", "F4"]];

export const SONGS = {
    title: {
        bpm: 72, loop: true,
        tracks: [
            { ...LEAD, notes: [
                "E5 . . . . . A4 . C5 . . . B4 . A4 .",
                "C5 . . . . . F4 . A4 . . . C5 . . .",
                "D5 . . . B4 . . . G4 . . . B4 . D5 .",
                "E5 . . . . . . . D5 . C5 . B4 . . .",
            ].join(" ") },
            { ...ORGAN, notes: hold(T_CH, 0) }, { ...ORGAN, notes: hold(T_CH, 1) }, { ...ORGAN, notes: hold(T_CH, 2) },
            { ...ORGAN2, notes: hold(T_CH.map((c) => c.map((n) => n.replace(/\d/, (d) => d - 1))), 0) },
            { ...BELL, vol: 0.04, notes: voice(T_CH, 2, [0, 6, 12]) },
        ],
    },
    explore: {
        bpm: 84, loop: true,
        tracks: [
            { ...BELL, notes: [
                "A4 . . . - - D5 . . . C5 . - - A4 .",
                "Bb4 . . . - - F4 . . . G4 . - - F4 .",
                "G4 . . . - - C5 . . . E5 . - - D5 .",
                "C#5 . . . - - . . E5 . . . - - . .",
                "A4 . . . - - F4 . . . D4 . - - F4 .",
                "Bb4 . . . - - D5 . . . F5 . - - D5 .",
                "E5 . . . - - C5 . . . G4 . - - E4 .",
                "A4 . . . . . . . - - - - - - - -",
            ].join(" ") },
            { ...ORGAN, notes: rep(hold(E_CH, 0), 2) }, { ...ORGAN, notes: rep(hold(E_CH, 1), 2) }, { ...ORGAN, notes: rep(hold(E_CH, 2), 2) },
            { wave: "sine", vol: 0.15, gate: 0.85, notes: rep(E_CH.map((c) => { const r = c[0].replace(/\d/, (d) => d - 1); return `${r} . . . . . . . ${r} . . . c - - -`.replace("c", r); }).join(" "), 2) },
            { wave: "drum", vol: 0.04, notes: rep("r - - - - - - - r - - r - - - -", 8) },
        ],
    },
    battle: {
        bpm: 150, loop: true,
        tracks: [
            { ...HARPSI, notes: rep(B_CH.map((c) => `${c[0]} ${c[1]} ${c[2]} ${c[1]} ${c[0]} ${c[1]} ${c[2]} ${c[1]}`.replace(/^/, "") + " " + `${c[2]} ${c[1]} ${c[0]} ${c[1]} ${c[2]} ${c[1]} ${c[0]} ${c[1]}`).join(" "), 2) },
            { ...LEAD, vol: 0.075, echo: undefined, notes: [
                "B4 . . . G4 . E4 . F#4 . G4 . A4 . B4 .",
                "C5 . . . B4 . G4 . E4 . . . G4 . . .",
                "A4 . . . F#4 . D4 . E4 . F#4 . A4 . . .",
                "B4 . . . . . A4 . F#4 . D#4 . F#4 . . .",
                "E5 . . . D5 . B4 . G4 . A4 . B4 . . .",
                "C5 . . . E5 . . . D5 . C5 . B4 . G4 .",
                "A4 . . . D5 . . . C5 . B4 . A4 . F#4 .",
                "D#5 . . . . . . . B4 . . . . . . .",
            ].join(" ") },
            { wave: "sawtooth", vol: 0.04, gate: 0.5, notes: rep(B_CH.map((c) => { const r = c[0].replace(/\d/, (d) => d - 1); return rep(`${r} - ${r} ${r}`, 4); }).join(" "), 2) },
            { wave: "drum", vol: 0.07, notes: rep("k - h - s - h - k k h - s - h h", 8) },
        ],
    },
    boss: {
        bpm: 128, loop: true,
        tracks: [
            { wave: "square", vol: 0.018, gate: 0.95, attack: 0.03, notes: rep(hold(X_CH, 0), 2) },
            { wave: "square", vol: 0.018, gate: 0.95, attack: 0.03, notes: rep(hold(X_CH, 1), 2) },
            { wave: "square", vol: 0.018, gate: 0.95, attack: 0.03, notes: rep(hold(X_CH, 2), 2) },
            { ...LEAD, wave: "sawtooth", vol: 0.03, decay: 0.3, echo: { time: 0.35, fb: 0.3, mix: 0.3 }, notes: [
                "G4 . . . . . Eb4 . C4 . . . D4 . Eb4 .",
                "F4 . . . Eb4 . C4 . Ab3 . . . C4 . . .",
                "D4 . . . F4 . Bb4 . A4 . F4 . D4 . . .",
                "B3 . . . D4 . G4 . F4 . D4 . B3 . . .",
                "C5 . . . . . G4 . Eb5 . . . D5 . C5 .",
                "Ab4 . . . C5 . Eb5 . D5 . C5 . Ab4 . . .",
                "Bb4 . . . D5 . F5 . Eb5 . D5 . Bb4 . . .",
                "B4 . . . . . . . G4 . . . . . . .",
            ].join(" ") },
            { wave: "sine", vol: 0.18, gate: 0.9, notes: rep(X_CH.map((c) => { const r = c[0].replace(/\d/, (d) => d - 1); return rep(`${r} . ${r} -`, 4); }).join(" "), 2) },
            { wave: "drum", vol: 0.075, notes: rep("k - k - s - - k k - k - s - s s", 8) },
        ],
    },
    victory: {
        bpm: 140, loop: false,
        tracks: [
            { ...LEAD, echo: undefined, notes: "C5 - C5 - C5 - G4 . A4 . B4 . C5 . . . E5 . . . G5 . . . . . . . - - - -" },
            { ...ORGAN, notes: "C4 . . . . . . . F4 . . . G4 . . . C4 . . . . . . . . . . . - - - -" },
            { wave: "drum", vol: 0.06, notes: "k - - - s - - - k - - - s - - - k - - - - - - - - - - - - - - -" },
        ],
    },
    gameover: {
        bpm: 70, loop: false,
        tracks: [
            { ...BELL, notes: "E5 . . . D5 . . . C5 . . . B4 . . . A4 . . . . . . . - - - - - - - -" },
            { ...ORGAN, notes: "A3 . . . . . . . F3 . . . . . . . E3 . . . . . . . . . . . - - - -" },
        ],
    },
    ending: {
        bpm: 80, loop: true,
        tracks: [
            { ...LEAD, notes: [
                "E5 . . . D5 . C5 . G4 . . . C5 . E5 .",
                "D5 . . . . . B4 . G4 . . . B4 . D5 .",
                "C5 . . . B4 . A4 . E4 . . . A4 . C5 .",
                "F5 . . . E5 . D5 . C5 . . . . . . .",
            ].join(" ") },
            { ...ORGAN, notes: hold(N_CH, 0) }, { ...ORGAN, notes: hold(N_CH, 1) }, { ...ORGAN, notes: hold(N_CH, 2) },
            { ...BELL, vol: 0.045, notes: voice(N_CH, 2, [0, 4, 8, 12]) },
            { wave: "sine", vol: 0.15, gate: 0.85, notes: N_CH.map((c) => { const r = c[0].replace(/\d/, (d) => d - 2); return `${r} . . . . . . . ${r} . . . . . . .`; }).join(" ") },
        ],
    },
};

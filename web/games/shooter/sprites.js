/**
 * ドット絵スプライト (オリジナル)。文字1つ = 1ドット、"." は透明。
 * makePixelTextures() で Phaser のテクスチャに変換する(1ドット = scale px)。
 */

// MSX / PC-88 風の限られた色数
export const PALETTE = {
    K: 0x101018, // 輪郭
    W: 0xf8f8f8,
    C: 0x40c8f8, c: 0x1868b8, // 自機
    O: 0xf89838, o: 0xa84818, // guard
    M: 0xe858e8, m: 0x8828a8, // scout
    G: 0x58e858, g: 0x188838, // commander
    P: 0xf8a8f8,
    Y: 0xf8f048,
    R: 0xe83838,
    H: 0x3878f8, h: 0x1838a8, // 髪
    S: 0xf8d0a8, s: 0xd89878, // 肌
    E: 0xf8a818, // 瞳 (琥珀色)
    U: 0xa8b8c8, // ヘッドセット
    N: 0xc84828, // 口
};

export const SPRITES = {
    ship: [
        "......W......",
        "......W......",
        ".....CWC.....",
        ".....CWC.....",
        "....CCWCC....",
        "....CcWcC....",
        "c...CcCcC...c",
        "c..CCcCcCC..c",
        "cCCCCCCCCCCCc",
        "cCCcCCCCCcCCc",
        "c.ccCCCCCcc.c",
        "....cc.cc....",
        "....OY.YO....",
        ".....O.O.....",
    ],
    scout: [
        "m.........m",
        ".m.......m.",
        "..MMMMMMM..",
        ".MMYMMMYMM.",
        "MMMMMMMMMMM",
        "M.MMMMMMM.M",
        "M.M.....M.M",
        "...MM.MM...",
    ],
    guard: [
        "...ooooo...",
        "..OOOOOOO..",
        ".OOYOOOYOO.",
        "OOOOOOOOOOO",
        "OoOoOoOoOoO",
        "OOOOOOOOOOO",
        ".O.O...O.O.",
        "O..O...O..O",
    ],
    commander: [
        "......GGG......",
        ".....GPPPG.....",
        "..g..GPYPG..g..",
        ".ggGGGGGGGGGgg.",
        "ggGGGgGGGgGGGgg",
        "gGGGGGGGGGGGGGg",
        "g.GGgGGGGGgGG.g",
        "g..GG.GGG.GG..g",
        "...G..G.G..G...",
        "..G...G.G...G..",
    ],
    // ヒロイン「リナ」の顔グラフィック (16x16)
    rina: [
        "....KKKKKKK.....",
        "...KHHHHHHHK....",
        "..KHHHHHHHHHK...",
        "..KHHHHHHHHHKHH.",
        ".UKHSSHHHSSHKHHH",
        ".UKSSSSSSSSSKHHH",
        ".UKSKESSSKESK.HH",
        ".UKSSESSSSESK.HH",
        "..KSSSSSSSSSK..H",
        "..KsSSSNNSSsK..H",
        "...KsSSSSSsK....",
        "....KKSSSKK.....",
        "...KWWKSKWWK....",
        "..KWWWRWRWWWK...",
        ".KWWWWRRRWWWWK..",
        ".KWWWWWRWWWWWK..",
    ],
    // アイテム「思い出のハート」(リナの写真データ)
    heart: [
        ".MM...MM.",
        "MPPM.MPPM",
        "MPWPMPPPM",
        "MPPPPPPPM",
        ".MPPPPPM.",
        "..MPPPM..",
        "...MPM...",
        "....M....",
    ],
    shot: ["Y", "Y", "W", "W", "W"],
    ebullet: [".R.", "RWR", ".R."],
    spark: ["W"],
    star: ["W"],
};

export function makePixelTextures(scene, scale = 2) {
    const g = scene.add.graphics();
    const scales = { rina: 3, star: 1, spark: 2, heart_s: 1 };
    const all = { ...SPRITES, heart_s: SPRITES.heart }; // HUD 用の小さいハート
    for (const [key, rows] of Object.entries(all)) {
        if (scene.textures.exists(key)) continue;
        const s = scales[key] ?? scale;
        g.clear();
        rows.forEach((row, y) => {
            [...row].forEach((ch, x) => {
                const col = PALETTE[ch];
                if (col === undefined) return;
                g.fillStyle(col, 1);
                g.fillRect(x * s, y * s, s, s);
            });
        });
        g.generateTexture(key, rows[0].length * s, rows.length * s);
    }
    g.destroy();
}

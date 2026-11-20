/**
 * Dungeon Heart: 手に入るもの
 * 宝箱の中身は stages.json の objects に "herb" / "gold:120" / "gem:ruby" / "treasure:crown" / "equip:silver_armor" / "key" / "heart" のように書く。
 * 装備の prompt は、階をクリアしたときの生成画像の服装・持ち物になる。look は立ち絵(portrait.js)の色と部品。
 */

export const ITEMS = {
    herb: { type: "use", hp: 25, name: { en: "Healing Herb", ja: "薬草", zh: "药草" } },
    ether: { type: "use", mp: 10, name: { en: "Magic Water", ja: "魔法の水", zh: "魔法之水" } },
    key: { type: "key", name: { en: "Old Key", ja: "古い鍵", zh: "旧钥匙" } },
    heart: { type: "heart", name: { en: "Heart", ja: "ハート", zh: "爱心" } },
};

// 宝石(記念カットの小道具。value はスコアと「価値の高いもの」の判定に使う)
export const GEMS = {
    ruby: { value: 300, prompt: "holding a large ruby", name: { en: "Ruby", ja: "ルビー", zh: "红宝石" } },
    sapphire: { value: 300, prompt: "holding sapphires", name: { en: "Sapphire", ja: "サファイア", zh: "蓝宝石" } },
    emerald: { value: 300, prompt: "holding emeralds", name: { en: "Emerald", ja: "エメラルド", zh: "祖母绿" } },
    amethyst: { value: 400, prompt: "holding a glowing amethyst", name: { en: "Amethyst", ja: "アメジスト", zh: "紫水晶" } },
};

// 財宝(記念カットの小道具・背景)
export const TREASURES = {
    chalice: { value: 500, prompt: "golden chalice", name: { en: "Golden Chalice", ja: "黄金の杯", zh: "黄金圣杯" } },
    crown: { value: 800, prompt: "wearing a golden crown", name: { en: "Golden Crown", ja: "黄金の冠", zh: "黄金王冠" } },
    necklace: { value: 600, prompt: "pearl necklace", name: { en: "Pearl Necklace", ja: "真珠の首飾り", zh: "珍珠项链" } },
    coins: { value: 400, prompt: "pile of gold coins", name: { en: "Ancient Coins", ja: "古代の金貨", zh: "古代金币" } },
};
// ゴールドを拾った量が多いとき、記念カットに金貨の山を入れる
export const GOLD_PROMPT = { min: 100, prompt: "pile of gold coins" };

/**
 * 装備: slot = weapon / armor / acc
 * stats: atk / def / mag / agi(足し算)。el: 武器の属性(弱点を突くと1.5倍)
 * look(立ち絵): armor は kind(bikini / robe)と main / trim / gem の色、部品 shoulder(none/round/spike/wing/crystal)・chest(band/plate/scale/ornate/crystal)・
 *               skirt(loin/plates/scale/tabard/crystal)・boots(sandal/greave/scale/gold/crystal)・head(circlet/horns/star)、ローブは hood / collar / emblem(leaf/moon)。
 *               weapon は kind(sword / staff / spear)と blade の色、glow、flame(炎)/ zig(雷)/ star(星のつば)。acc は kind(tiara / cape / feather / earrings)
 */
export const EQUIP = {
    // ---- 武器 ----
    iron_sword: { slot: "weapon", stats: { atk: 4 }, prompt: "holding an iron sword", look: { kind: "sword", blade: "#c8c8d0" }, name: { en: "Iron Sword", ja: "鉄の剣", zh: "铁剑" } },
    flame_sword: { slot: "weapon", stats: { atk: 9 }, el: "fire", prompt: "holding a flaming sword, fire blade", look: { kind: "sword", blade: "#ff7030", glow: "#ffd060", flame: true }, name: { en: "Flame Sword", ja: "炎の剣", zh: "火焰剑" } },
    crystal_staff: { slot: "weapon", stats: { atk: 2, mag: 8 }, prompt: "holding a crystal staff", look: { kind: "staff", blade: "#a8e8ff", glow: "#e0f8ff" }, name: { en: "Crystal Staff", ja: "水晶の杖", zh: "水晶法杖" } },
    thunder_spear: { slot: "weapon", stats: { atk: 12, agi: 1 }, el: "thunder", prompt: "holding a lightning spear, electricity", look: { kind: "spear", blade: "#f8f070", glow: "#ffffa0", zig: true }, name: { en: "Thunder Spear", ja: "雷の槍", zh: "雷之枪" } },
    star_sword: { slot: "weapon", stats: { atk: 18, mag: 4 }, el: "light", prompt: "holding a glowing star sword", look: { kind: "sword", blade: "#f8f8ff", glow: "#fff090", star: true }, name: { en: "Star Sword", ja: "星の剣", zh: "星之剑" } },
    // ---- 防具(ビキニアーマー系) ----
    bronze_armor: { slot: "armor", stats: { def: 3 }, prompt: "bronze bikini armor, simple design, leather straps", look: { kind: "bikini", main: "#b06a30", trim: "#e0a860", shoulder: "none", chest: "band", skirt: "loin", boots: "sandal" }, name: { en: "Bronze Armor", ja: "銅の鎧", zh: "青铜铠甲" } },
    silver_armor: { slot: "armor", stats: { def: 6 }, prompt: "silver bikini armor, blue gemstones, ornate engraving", look: { kind: "bikini", main: "#c8cce0", trim: "#7880a8", gem: "#3870f8", shoulder: "round", chest: "plate", skirt: "plates", boots: "greave", head: "circlet" }, name: { en: "Silver Armor", ja: "銀の鎧", zh: "白银铠甲" } },
    dragon_armor: { slot: "armor", stats: { def: 10, agi: -1 }, prompt: "crimson dragon scale bikini armor, horn decorations, gold trim", look: { kind: "bikini", main: "#c02828", trim: "#f0c040", gem: "#f8e070", shoulder: "spike", chest: "scale", skirt: "scale", boots: "scale", head: "horns" }, name: { en: "Dragon Scale Armor", ja: "竜鱗の鎧", zh: "龙鳞铠甲" } },
    golden_armor: { slot: "armor", stats: { def: 13 }, prompt: "golden bikini armor, white feather ornaments, red gems", look: { kind: "bikini", main: "#e8c040", trim: "#f8f8f0", gem: "#f84878", shoulder: "wing", chest: "ornate", skirt: "tabard", boots: "gold" }, name: { en: "Golden Armor", ja: "黄金の鎧", zh: "黄金铠甲" } },
    star_armor: { slot: "armor", stats: { def: 17, mag: 4 }, prompt: "starlight bikini armor, glowing star patterns, translucent crystal parts", look: { kind: "bikini", main: "#90d0ff", trim: "#f8f8ff", gem: "#f8f070", shoulder: "crystal", chest: "crystal", skirt: "crystal", boots: "crystal", head: "star" }, name: { en: "Starlight Armor", ja: "星の鎧", zh: "星之铠甲" } },
    // ---- 防具(ローブ系: 魔法が強く、守りは弱い) ----
    apprentice_robe: { slot: "armor", stats: { def: 2, mag: 6 }, prompt: "white mage robe, green embroidery, hood", look: { kind: "robe", main: "#ececf0", trim: "#40a050", hood: true, emblem: "leaf" }, name: { en: "Apprentice Robe", ja: "見習いのローブ", zh: "见习长袍" } },
    night_robe: { slot: "armor", stats: { def: 5, mag: 12 }, prompt: "black robe, silver moon embroidery, high collar", look: { kind: "robe", main: "#282838", trim: "#c8c8e8", gem: "#f8f070", collar: true, emblem: "moon" }, name: { en: "Night Robe", ja: "夜のローブ", zh: "夜之长袍" } },
    // ---- 装飾品 ----
    silver_tiara: { slot: "acc", stats: { mag: 2 }, prompt: "silver tiara", look: { kind: "tiara", main: "#d8d8e8", gem: "#58a8f8" }, name: { en: "Silver Tiara", ja: "銀のティアラ", zh: "白银头冠" } },
    red_cape: { slot: "acc", stats: { def: 2 }, prompt: "red cape", look: { kind: "cape", main: "#c02030" }, name: { en: "Red Cape", ja: "赤いマント", zh: "红色斗篷" } },
    feather_ornament: { slot: "acc", stats: { agi: 2 }, prompt: "feather hair ornament", look: { kind: "feather", main: "#f8f8f8", gem: "#58c8a8" }, name: { en: "Feather Ornament", ja: "羽根の髪飾り", zh: "羽毛发饰" } },
    star_earrings: { slot: "acc", stats: { mag: 3, agi: 1 }, prompt: "star earrings", look: { kind: "earrings", main: "#f8e050" }, name: { en: "Star Earrings", ja: "星の耳飾り", zh: "星之耳环" } },
};
export const SLOTS = ["weapon", "armor", "acc"];
export const SLOT_NAMES = {
    weapon: { en: "Weapon", ja: "武器", zh: "武器" },
    armor: { en: "Armor", ja: "防具", zh: "防具" },
    acc: { en: "Accessory", ja: "装飾品", zh: "饰品" },
};

/** "gold:120" → { kind: "gold", amount: 120 } / "gem:ruby" / "treasure:crown" / "equip:silver_armor" / "herb" */
export function parseLoot(s) {
    const [kind, arg] = String(s || "").split(":");
    if (kind === "gold") return { kind: "gold", amount: Number(arg) || 0 };
    if (kind === "gem" && GEMS[arg]) return { kind: "gem", id: arg };
    if (kind === "treasure" && TREASURES[arg]) return { kind: "treasure", id: arg };
    if (kind === "equip" && EQUIP[arg]) return { kind: "equip", id: arg };
    if (ITEMS[kind]) return { kind: "item", id: kind };
    return null;
}

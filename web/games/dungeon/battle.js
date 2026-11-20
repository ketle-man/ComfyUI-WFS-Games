/**
 * Dungeon Heart: コマンド式ターン制バトル
 *   const battle = createBattle(env); const r = await battle.fight(["slime", "bat"], { boss: false }); // "win" | "lose" | "run"
 * env: {
 *   run, lang, loc, stats(), fx(magic.js), sfx(name),
 *   say(text, sec) … ログに1行足して少し待つ(SPACE で早送り) / clearLog()
 *   pick(kind, options, opts) … 選択肢(戻り値は番号、キャンセルは -1) / wait(sec)
 *   flash(color, a) / shake(n) / popup(target, text, color)  target: 敵の番号 または "player"
 *   diff: { enemyDmg, enemyHp }
 * }
 * コマンド: たたかう / まほう / ぼうぎょ / どうぐ / にげる(ボス戦は不可)
 */
import { ENEMIES } from "./enemies.js";
import { SPELLS, SPELL_ORDER } from "./magic.js";
import { ITEMS, GEMS } from "./items.js";

const BTEXT = {
    en: {
        appear: (n) => `${n} appeared!`, appearMany: (n) => `${n} and friends appeared!`, bossAppear: (n) => `${n} blocks the way!`,
        cmd: ["FIGHT", "MAGIC", "GUARD", "ITEM", "EQUIP", "RUN"], critMagic: "A critical spell!",
        attack: (h) => `${h} attacks!`, crit: "A critical hit!", miss: "Miss!", dmgTo: (n, d) => `${n} takes ${d} damage!`,
        defeated: (n) => `${n} is defeated!`, guard: (h) => `${h} raises her guard.`,
        cast: (h, s) => `${h} casts ${s}!`, weak: "It's super effective!", resist: "It's not very effective...",
        heal: (h, n) => `${h} recovers ${n} HP!`, mp: (h, n) => `${h} recovers ${n} MP!`, useItem: (h, i) => `${h} uses ${i}!`,
        enemyAttack: (n) => `${n} attacks!`, enemySkill: (n, s) => `${n} uses ${s}!`, charge: (n) => `${n} is gathering power...`,
        hurt: (h, d) => `${h} takes ${d} damage!`, dodge: (h) => `${h} dodges!`,
        runOk: "Sera got away safely!", runNg: "But the enemies cut her off!", noRun: "There's no escape!",
        win: "Victory!", reward: (e, g) => `Gained ${e} EXP and ${g} gold.`, gem: (n) => `The enemy dropped a ${n}!`,
        lvUp: (h, l) => `${h} reached level ${l}!`, learn: (s) => `She learned ${s}!`, noMp: "Not enough MP.",
        lose: (h) => `${h} has fallen...`, rage: (n) => `${n} is enraged!`, noItem: "No usable items.",
    },
    ja: {
        appear: (n) => `${n}があらわれた!`, appearMany: (n) => `${n}たちがあらわれた!`, bossAppear: (n) => `${n}が立ちはだかった!`,
        cmd: ["たたかう", "まほう", "ぼうぎょ", "どうぐ", "そうび", "にげる"], critMagic: "会心の魔法!",
        attack: (h) => `${h}の攻撃!`, crit: "会心の一撃!", miss: "ミス!", dmgTo: (n, d) => `${n}に${d}のダメージ!`,
        defeated: (n) => `${n}をたおした!`, guard: (h) => `${h}は身を守っている。`,
        cast: (h, s) => `${h}は${s}をとなえた!`, weak: "効果は抜群だ!", resist: "あまり効いていないようだ……",
        heal: (h, n) => `${h}のHPが${n}回復した!`, mp: (h, n) => `${h}のMPが${n}回復した!`, useItem: (h, i) => `${h}は${i}を使った!`,
        enemyAttack: (n) => `${n}の攻撃!`, enemySkill: (n, s) => `${n}の${s}!`, charge: (n) => `${n}は力をためている……`,
        hurt: (h, d) => `${h}は${d}のダメージを受けた!`, dodge: (h) => `${h}はひらりと身をかわした!`,
        runOk: "セラはうまく逃げきった!", runNg: "しかし回りこまれてしまった!", noRun: "逃げられない!",
        win: "勝利!", reward: (e, g) => `経験値${e}と${g}ゴールドを手に入れた。`, gem: (n) => `敵は${n}を落としていった!`,
        lvUp: (h, l) => `${h}はレベル${l}に上がった!`, learn: (s) => `${s}をおぼえた!`, noMp: "MPが足りない。",
        lose: (h) => `${h}は力尽きた……`, rage: (n) => `${n}は怒りくるっている!`, noItem: "使える道具がない。",
    },
    zh: {
        appear: (n) => `${n}出现了!`, appearMany: (n) => `${n}等敌人出现了!`, bossAppear: (n) => `${n}挡住了去路!`,
        cmd: ["战斗", "魔法", "防御", "道具", "装备", "逃跑"], critMagic: "会心魔法!",
        attack: (h) => `${h}发动攻击!`, crit: "会心一击!", miss: "未命中!", dmgTo: (n, d) => `${n}受到${d}点伤害!`,
        defeated: (n) => `打倒了${n}!`, guard: (h) => `${h}摆出防御姿态。`,
        cast: (h, s) => `${h}咏唱了${s}!`, weak: "效果拔群!", resist: "好像没什么效果……",
        heal: (h, n) => `${h}恢复了${n}点HP!`, mp: (h, n) => `${h}恢复了${n}点MP!`, useItem: (h, i) => `${h}使用了${i}!`,
        enemyAttack: (n) => `${n}发动攻击!`, enemySkill: (n, s) => `${n}使出了${s}!`, charge: (n) => `${n}正在蓄力……`,
        hurt: (h, d) => `${h}受到了${d}点伤害!`, dodge: (h) => `${h}轻巧地闪开了!`,
        runOk: "塞拉成功逃脱了!", runNg: "但是被敌人包围了!", noRun: "无法逃跑!",
        win: "胜利!", reward: (e, g) => `获得了${e}经验值和${g}金币。`, gem: (n) => `敌人掉落了${n}!`,
        lvUp: (h, l) => `${h}升到了${l}级!`, learn: (s) => `学会了${s}!`, noMp: "MP不足。",
        lose: (h) => `${h}倒下了……`, rage: (n) => `${n}暴怒了!`, noItem: "没有可用的道具。",
    },
};

const rnd = (a, b) => a + Math.random() * (b - a);
export const expToNext = (lv) => 10 + lv * lv * 6;
/** レベルごとの基本の強さ(装備は段取り4で足す) */
export function baseStats(lv) {
    return { atk: 3 + lv * 2, def: lv, mag: 4 + lv * 2, agi: 5 + lv };
}
export const knownSpells = (lv) => SPELL_ORDER.filter((id) => SPELLS[id].lv <= lv);

/** 経験値を足してレベルアップの文を返す */
export function gainExp(run, n, tx, heroName, loc) {
    const lines = [];
    run.exp += n;
    while (run.exp >= expToNext(run.lv)) {
        run.exp -= expToNext(run.lv);
        const before = knownSpells(run.lv);
        run.lv++;
        const hpUp = 6 + Math.floor(Math.random() * 3), mpUp = 3;
        run.maxHp += hpUp; run.hp += hpUp;
        run.maxMp += mpUp; run.mp += mpUp;
        lines.push(tx.lvUp(heroName, run.lv));
        knownSpells(run.lv).filter((s) => !before.includes(s)).forEach((s) => lines.push(tx.learn(loc(SPELLS[s].name))));
    }
    return lines;
}

export function createBattle(env) {
    const tx = BTEXT[env.lang] || BTEXT.en;
    const { loc, fx, sfx } = env;
    const hero = env.heroName;
    let curAction = "attack"; // とどめの一撃の記録用(ボスを倒した行動 → 記念カットのプロンプト)

    async function fight(ids, { boss = false } = {}) {
        const run = env.run();
        // 同じ敵が2体以上なら A/B/C を付ける
        const count = {};
        ids.forEach((id) => { count[id] = (count[id] || 0) + 1; });
        const seen = {};
        const foes = ids.map((id, i) => {
            const def = ENEMIES[id];
            seen[id] = (seen[id] || 0) + 1;
            const label = loc(def.name) + (count[id] > 1 ? "ABC"[seen[id] - 1] : "");
            const hp = Math.round(def.hp * (env.diff.enemyHp || 1));
            return { id, def, i, label, hp, maxHp: hp, alive: true, charging: null, raged: false };
        });
        env.setFoes(foes);
        fx.spawnEnemies(foes.map((f) => f.def));
        env.clearLog();
        sfx(boss ? "warning" : "encounter");
        await env.wait(0.35, false);
        const first = foes[0];
        await env.say(boss ? tx.bossAppear(first.label) : ids.length > 1 ? tx.appearMany(loc(first.def.name)) : tx.appear(first.label), 1.0);

        for (;;) {
            const st = env.stats();
            const cmd = await chooseCommand(foes, boss);
            const order = [{ hero: true, spd: st.agi * rnd(0.8, 1.2) }];
            foes.filter((f) => f.alive).forEach((f) => order.push({ foe: f, spd: f.def.agi * rnd(0.8, 1.2) }));
            order.sort((a, b) => b.spd - a.spd);
            const guarding = cmd.type === "guard";
            for (const a of order) {
                if (!foes.some((f) => f.alive) || run.hp <= 0) break;
                env.clearLog();
                if (a.hero) {
                    const r = await heroAct(cmd, foes, boss);
                    if (r === "run") { fx.clearEnemies(); env.setFoes(null); return "run"; }
                } else if (a.foe.alive) {
                    await foeAct(a.foe, guarding);
                }
            }
            if (run.hp <= 0) {
                await env.say(tx.lose(hero), 1.2);
                fx.clearEnemies(); env.setFoes(null);
                return "lose";
            }
            if (!foes.some((f) => f.alive)) {
                await victory(foes, boss);
                fx.clearEnemies(); env.setFoes(null);
                return "win";
            }
        }
    }

    async function pickTarget(foes) {
        const alive = foes.filter((f) => f.alive);
        if (alive.length === 1) return alive[0].i;
        const k = await env.pick("target", alive.map((f) => ({ label: f.label, foe: f.i })), { cancelable: true });
        return k < 0 ? -1 : alive[k].i;
    }

    async function chooseCommand(foes, boss) {
        const run = env.run();
        for (;;) {
            const c = await env.pick("command", tx.cmd.map((label, i) => ({ label, disabled: i === 5 && boss })), { cancelable: false });
            if (c === 0) {
                const t = await pickTarget(foes);
                if (t >= 0) return { type: "attack", target: t };
            } else if (c === 1) {
                const list = env.knownSpells().filter((id) => SPELLS[id].battle);
                const s = await env.pick("spell", list.map((id) => ({ label: loc(SPELLS[id].name), right: `${SPELLS[id].mp}`, disabled: run.mp < SPELLS[id].mp })), { cancelable: true });
                if (s < 0) continue;
                const id = list[s];
                const sp = SPELLS[id];
                if (sp.target === "one") {
                    const t = await pickTarget(foes);
                    if (t < 0) continue;
                    return { type: "spell", id, targets: [t] };
                }
                return { type: "spell", id, targets: sp.target === "all" ? foes.filter((f) => f.alive).map((f) => f.i) : [] };
            } else if (c === 2) {
                return { type: "guard" };
            } else if (c === 3) {
                const list = Object.keys(run.items).filter((id) => run.items[id] > 0 && ITEMS[id]?.type === "use");
                if (!list.length) { await env.say(tx.noItem, 0.8); env.clearLog(); continue; }
                const k = await env.pick("item", list.map((id) => ({ label: loc(ITEMS[id].name), right: `×${run.items[id]}` })), { cancelable: true });
                if (k >= 0) return { type: "item", id: list[k] };
            } else if (c === 4) {
                await env.equipMenu(); // 着替えはターンを使わない
                continue;
            } else if (c === 5) {
                if (boss) { sfx("bump"); continue; }
                return { type: "run" };
            }
        }
    }

    function retarget(foes, t) {
        if (foes[t]?.alive) return t;
        const a = foes.find((f) => f.alive);
        return a ? a.i : -1;
    }

    async function damageFoe(f, dmg, color = "#f8f8f8") {
        f.hp = Math.max(0, f.hp - dmg);
        fx.hitEnemy(f.i);
        env.popup(f.i, String(dmg), color);
        sfx("hit");
        await env.say(tx.dmgTo(f.label, dmg), 0.7);
        if (f.hp <= 0) {
            f.alive = false;
            fx.killEnemy(f.i, 0xffffff);
            if (f.def.boss) env.onBossDown?.(f.id, curAction);
            sfx("boom");
            await env.say(tx.defeated(f.label), 0.7);
        } else if (f.def.rage && !f.raged && f.hp / f.maxHp < f.def.rage.below) {
            f.raged = true;
            fx.tintEnemy(f.i, 0xff3030, 1.2);
            env.shake(0.06);
            await env.say(tx.rage(f.label), 0.9);
        }
    }

    async function heroAct(cmd, foes, boss) {
        const run = env.run();
        const st = env.stats();
        curAction = cmd.type === "spell" ? cmd.id : cmd.type;
        if (cmd.type === "guard") { await env.say(tx.guard(hero), 0.6); return; }
        if (cmd.type === "run") {
            const avg = foes.filter((f) => f.alive).reduce((s, f) => s + f.def.agi, 0) / Math.max(1, foes.filter((f) => f.alive).length);
            const chance = Math.max(0.25, Math.min(0.9, 0.55 + (st.agi - avg) * 0.05));
            if (Math.random() < chance) { sfx("stairs"); await env.say(tx.runOk, 0.9); return "run"; }
            await env.say(tx.runNg, 0.8);
            return;
        }
        if (cmd.type === "attack") {
            const t = retarget(foes, cmd.target);
            if (t < 0) return;
            const f = foes[t];
            await env.say(tx.attack(hero), 0.45);
            sfx("slash");
            env.slash();
            if (Math.random() < 0.04) { await env.say(tx.miss, 0.6); return; }
            const crit = Math.random() < (st.crit ?? 1 / 16); // 階と相性のよい装備で会心が出やすくなる
            let dmg = crit ? st.atk * 1.6 : (st.atk - f.def.def / 2) * rnd(0.85, 1.15);
            // 武器の属性(炎の剣・雷の槍・星の剣)
            let mult = 1;
            if (st.el && f.def.weak.includes(st.el)) mult = 1.5;
            if (st.el && f.def.resist.includes(st.el)) mult = 0.5;
            dmg = Math.max(1, Math.round(dmg * mult));
            if (crit) { env.flash("#ffffff", 0.4); env.shake(0.05); await env.say(tx.crit, 0.5); }
            if (mult > 1) await env.say(tx.weak, 0.4);
            if (mult < 1) await env.say(tx.resist, 0.4);
            await damageFoe(f, dmg, crit || mult > 1 ? "#f8f048" : mult < 1 ? "#9898a8" : "#f8f8f8");
            return;
        }
        if (cmd.type === "item") {
            const it = ITEMS[cmd.id];
            run.items[cmd.id]--;
            await env.say(tx.useItem(hero, loc(it.name)), 0.5);
            if (it.hp) { const n = Math.min(it.hp, run.maxHp - run.hp); run.hp += n; sfx("heal"); env.flash("#80ffb0", 0.25); env.popup("player", `+${n}`, "#58f858"); await env.say(tx.heal(hero, n), 0.7); }
            if (it.mp) { const n = Math.min(it.mp, run.maxMp - run.mp); run.mp += n; sfx("heal"); env.popup("player", `+${n}`, "#58e8f8"); await env.say(tx.mp(hero, n), 0.7); }
            return;
        }
        if (cmd.type === "spell") {
            const sp = SPELLS[cmd.id];
            if (run.mp < sp.mp) { await env.say(tx.noMp, 0.6); return; }
            let used = sp.mp;
            if (sp.allMp) used = run.mp; // 奥義は残りの MP を全部使う
            run.mp -= used;
            await env.say(tx.cast(hero, loc(sp.name)), 0.4);
            if (sp.heal) {
                const hitT = fx.cast(cmd.id, [], env.fxEnv);
                await env.wait(hitT, false);
                const n = Math.min(sp.heal + Math.round(st.mag * 0.5), run.maxHp - run.hp);
                run.hp += n;
                env.popup("player", `+${n}`, "#58f858");
                await env.say(tx.heal(hero, n), 0.8);
                return;
            }
            const targets = cmd.targets.map((t) => retarget(foes, t)).filter((t, k, a) => t >= 0 && a.indexOf(t) === k);
            if (!targets.length) return;
            const hitT = fx.cast(cmd.id, targets, env.fxEnv);
            await env.wait(hitT, false);
            for (const t of targets) {
                const f = foes[t];
                if (!f.alive) continue;
                let mult = 1;
                if (f.def.weak.includes(sp.el)) mult = 1.5;
                if (f.def.resist.includes(sp.el)) mult = 0.5;
                const power = sp.power + st.mag * 1.0 + (sp.allMp ? used * 2.5 : 0);
                const mcrit = Math.random() < (st.crit ?? 1 / 16);
                const dmg = Math.max(1, Math.round(power * rnd(0.9, 1.1) * mult * (mcrit ? 1.5 : 1)));
                if (mcrit) { env.flash("#ffffff", 0.35); await env.say(tx.critMagic, 0.4); }
                if (mult > 1) await env.say(tx.weak, 0.4);
                if (mult < 1) await env.say(tx.resist, 0.4);
                await damageFoe(f, dmg, mult > 1 ? "#f8f048" : mult < 1 ? "#9898a8" : "#f8f8f8");
            }
        }
    }

    function chooseAction(f) {
        const list = f.raged && f.def.rage ? f.def.rage.actions : f.def.actions;
        const total = list.reduce((s, a) => s + a.w, 0);
        let r = Math.random() * total;
        for (const a of list) { r -= a.w; if (r <= 0) return a; }
        return list[0];
    }

    async function foeAct(f, guarding) {
        const run = env.run();
        const st = env.stats();
        let act, power = 1;
        if (f.charging) { act = f.charging; power = act.power; f.charging = null; }
        else {
            act = chooseAction(f);
            if (act.type === "charge") {
                f.charging = act;
                fx.tintEnemy(f.i, 0xffd040, 1.0);
                sfx("charge");
                await env.say(tx.charge(f.label), 0.9);
                return;
            }
            if (act.type === "skill") power = act.power;
        }
        const isSpell = act.type === "spell";
        await env.say(act.type === "attack" ? tx.enemyAttack(f.label) : tx.enemySkill(f.label, loc(act.name)), 0.5);
        fx.lungeEnemy(f.i);
        await env.wait(0.18, false);
        if (!isSpell && Math.random() < 0.05 + Math.max(0, st.agi - f.def.agi) * 0.006) { sfx("dodge"); await env.say(tx.dodge(hero), 0.6); return; }
        let dmg = isSpell ? act.power * rnd(0.85, 1.15) : (f.def.atk * power - st.def / 2) * rnd(0.85, 1.15);
        dmg *= env.diff.enemyDmg || 1;
        if (guarding) dmg *= power > 2 ? 0.4 : 0.5;
        dmg = Math.max(1, Math.round(dmg));
        run.hp = Math.max(0, run.hp - dmg);
        sfx(power > 2 ? "boom" : "hurt");
        env.flash("#ff2020", power > 2 ? 0.5 : 0.3);
        env.shake(power > 2 ? 0.12 : 0.05);
        env.popup("player", String(dmg), "#f85858");
        await env.say(tx.hurt(hero, dmg), 0.7);
    }

    async function victory(foes, boss) {
        const run = env.run();
        const exp = foes.reduce((s, f) => s + f.def.exp, 0);
        const gold = foes.reduce((s, f) => s + f.def.gold, 0);
        env.clearLog();
        sfx("perfect");
        await env.say(tx.win, 0.6);
        run.gold += gold;
        run.score += gold + exp * 2;
        await env.say(tx.reward(exp, gold), 1.0);
        for (const f of foes) {
            const gm = f.def.gem;
            if (gm && Math.random() < gm.chance) {
                run.gems[gm.id] = (run.gems[gm.id] || 0) + 1;
                run.score += GEMS[gm.id].value;
                sfx("item");
                await env.say(tx.gem(loc(GEMS[gm.id].name)), 0.9);
            }
        }
        // 薬草・魔法の水を落とすことがある
        const drop = Math.random() < 0.14 ? "herb" : Math.random() < 0.07 ? "ether" : null;
        if (drop) { run.items[drop] = (run.items[drop] || 0) + 1; sfx("item"); await env.say(tx.gem(loc(ITEMS[drop].name)), 0.8); }
        for (const line of gainExp(run, exp, tx, hero, loc)) { sfx("perfect"); await env.say(line, 1.0); }
    }

    return { fight };
}

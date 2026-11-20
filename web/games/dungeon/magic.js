/**
 * Dungeon Heart: バトルの3D表示(敵のスプライト)と魔法の演出
 * - 敵はカメラの前に並べたドット絵の Sprite(壁に重なっても見えるよう depthTest なし・手前に描く)
 * - 演出は加算合成の粒(Sprite)・氷の槍(Cone)・稲妻(Line)・魔法陣(Sprite)・点光源の明滅で作る(ポストプロセスなし)
 * - 画面全体の色フラッシュとカメラの揺れは呼び出し側(UI)に任せる: env.flash(color, a) / env.shake(n)
 */
import * as THREE from "../../vendor/three/three.module.js";

export const SPELLS = {
    fire: { lv: 1, mp: 3, el: "fire", power: 12, target: "one", battle: true, prompt: "casting fire magic, flames, glowing magic circle", name: { en: "Fire Bolt", ja: "ファイアボルト", zh: "火焰箭" } },
    heal: { lv: 1, mp: 3, heal: 26, battle: true, field: true, name: { en: "Heal", ja: "ヒール", zh: "治愈" } },
    lumina: { lv: 2, mp: 2, field: true, light: 80, name: { en: "Lumina", ja: "ルミナ", zh: "光明" } },
    frost: { lv: 3, mp: 4, el: "ice", power: 19, target: "one", battle: true, prompt: "casting ice magic, ice crystals, frost", name: { en: "Frost Lance", ja: "フロストランス", zh: "冰霜长枪" } },
    thunder: { lv: 5, mp: 6, el: "thunder", power: 15, target: "all", battle: true, prompt: "casting lightning magic, electricity, lightning bolts", name: { en: "Thunder Fall", ja: "サンダーフォール", zh: "落雷" } },
    highheal: { lv: 8, mp: 7, heal: 90, battle: true, field: true, name: { en: "High Heal", ja: "ハイヒール", zh: "高级治愈" } },
    // 奥義: レベルではなく最下層に着いたときにおぼえる。残りの MP を全部使い、使った MP が多いほど強い
    starfall: { lv: 99, mp: 12, allMp: true, el: "light", power: 40, target: "all", battle: true, prompt: "casting starfall magic, shooting stars falling, starry sky, radiant light", name: { en: "Starfall", ja: "スターフォール", zh: "星落" } },
};
export const SPELL_ORDER = ["fire", "heal", "lumina", "frost", "thunder", "highheal", "starfall"];

function canvasTex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
export function spriteTexture(rows, palette) {
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    return canvasTex(w, h, (g) => {
        rows.forEach((r, y) => [...r].forEach((ch, x) => {
            if (ch === "." || !palette[ch]) return;
            g.fillStyle = palette[ch];
            g.fillRect(x, y, 1, 1);
        }));
    });
}

export function createMagic(world) {
    const res = { tex: [], mat: [], geo: [] };
    const T = (t) => { res.tex.push(t); return t; };
    // 粒: やわらかい光の玉(4段階のドット)
    const glowTex = T(canvasTex(8, 8, (g) => {
        [[0, 8, 0.25], [1, 6, 0.5], [2, 4, 0.8], [3, 2, 1]].forEach(([o, s, a]) => { g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(o, o, s, s); });
    }));
    // 魔法陣
    const ringTex = T(canvasTex(32, 32, (g) => {
        g.strokeStyle = "#ffffff"; g.lineWidth = 1;
        g.beginPath(); g.arc(16, 16, 14.5, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(16, 16, 10.5, 0, Math.PI * 2); g.stroke();
        g.beginPath();
        for (let i = 0; i <= 6; i++) { const a = i * Math.PI * 4 / 6; const x = 16 + Math.cos(a) * 10.5, y = 16 + Math.sin(a) * 10.5; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        g.fillStyle = "#ffffff";
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillRect(16 + Math.cos(a) * 12.5, 16 + Math.sin(a) * 12.5, 1, 1); }
    }));

    const group = new THREE.Group(); // 今の階の scene に付け替える
    let scene = null;
    const attach = () => {
        const s = world.getScene();
        if (s && s !== scene) { scene = s; scene.add(group); }
    };

    // ---------- 敵 ----------
    let foes = []; // { sprite, mat, base: Vector3, w, h, flash, alive, fade, lunge, tint }
    function clearEnemies() {
        foes.forEach((f) => { group.remove(f.sprite); f.mat.dispose(); f.tex.dispose(); });
        foes = [];
    }
    /** 敵を並べる(defs: ENEMIES の定義の配列) */
    function spawnEnemies(defs) {
        attach();
        clearEnemies();
        const cam = world.camera;
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        fwd.y = 0; fwd.normalize();
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const n = defs.length;
        const offs = n === 1 ? [0] : n === 2 ? [-0.3, 0.3] : [-0.52, 0, 0.52];
        defs.forEach((d, i) => {
            const tex = spriteTexture(d.sprite, d.palette);
            const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false, transparent: true });
            const sprite = new THREE.Sprite(mat);
            sprite.center.set(0.5, 0);
            sprite.renderOrder = 10;
            const px = 0.03 * (d.scale || 1);
            const w = tex.image.width * px, h = tex.image.height * px;
            sprite.scale.set(w, h, 1);
            const dist = d.boss ? 0.95 : 0.85;
            const base = new THREE.Vector3(cam.position.x, d.fly ? 0.3 : 0.06, cam.position.z).addScaledVector(fwd, dist).addScaledVector(right, offs[i] || 0);
            if (d.boss) base.y = 0.0;
            sprite.position.copy(base);
            group.add(sprite);
            foes.push({ sprite, mat, tex, base, w, h, flash: 0, alive: true, fade: 0, lunge: 0, tint: null, tintT: 0, appear: 0, phase: i * 1.3, fly: !!d.fly, fwd });
        });
    }
    const foePos = (i) => { const f = foes[i]; return f ? new THREE.Vector3(f.base.x, f.base.y + f.h * 0.55, f.base.z) : null; };
    /** 3D の位置 → 3D ビュー内の座標(0..1) */
    function project(i, top = true) {
        const f = foes[i];
        if (!f) return null;
        const v = new THREE.Vector3(f.base.x, f.base.y + (top ? f.h : f.h * 0.5), f.base.z).project(world.camera);
        return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    }
    function hitEnemy(i) { const f = foes[i]; if (f) { f.flash = 0.35; } }
    function tintEnemy(i, color, t = 0.6) { const f = foes[i]; if (f) { f.tint = new THREE.Color(color); f.tintT = t; } }
    function killEnemy(i, color = 0xffffff) {
        const f = foes[i];
        if (!f) return;
        f.alive = false; f.fade = 0.0001;
        burst(foePos(i), color, 26, 0.9, 0.5);
    }
    function lungeEnemy(i) { const f = foes[i]; if (f) f.lunge = 0.0001; }

    // ---------- 粒 ----------
    const parts = [];
    function particle(pos, color, { vel = new THREE.Vector3(), life = 0.6, size = 0.08, grow = 0, gravity = 0, drag = 0 } = {}) {
        const mat = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, transparent: true });
        const s = new THREE.Sprite(mat);
        s.renderOrder = 20;
        s.position.copy(pos);
        s.scale.set(size, size, 1);
        group.add(s);
        parts.push({ s, mat, vel, life, max: life, size, grow, gravity, drag });
        if (parts.length > 260) killPart(0);
    }
    function killPart(idx) { const p = parts[idx]; group.remove(p.s); p.mat.dispose(); parts.splice(idx, 1); }
    function burst(pos, color, n = 20, speed = 0.8, life = 0.5) {
        if (!pos) return;
        for (let k = 0; k < n; k++) {
            const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
            particle(pos, color, { vel: v, life: life * (0.6 + Math.random() * 0.6), size: 0.05 + Math.random() * 0.05, drag: 2 });
        }
    }

    // ---------- 効果(時間で動くもの) ----------
    const effects = []; // { t, dur, update(e, dt), done() }
    function effect(dur, update, done) { effects.push({ t: 0, dur, update, done }); }
    let flashLight = null;
    function lightPulse(pos, color, intensity, dur) {
        attach();
        if (!flashLight) { flashLight = new THREE.PointLight(color, 0, 4, 1.2); group.add(flashLight); }
        flashLight.color.set(color);
        flashLight.position.copy(pos);
        effect(dur, (e) => { flashLight.intensity = intensity * (1 - e); }, () => { flashLight.intensity = 0; });
    }
    // 杖の先(画面の右下あたり)
    function staffPos() {
        const cam = world.camera;
        return new THREE.Vector3(0.12, -0.12, -0.3).applyQuaternion(cam.quaternion).add(cam.position);
    }

    /**
     * 魔法の演出を始める。戻り値は「当たる」までの秒数(呼び出し側はこの時間だけ待ってからダメージを出す)
     * env: { flash(color, a), shake(n), sfx(name) }
     */
    function cast(id, targets, env) {
        attach();
        const cam = world.camera;
        if (id === "fire") {
            const from = staffPos();
            const ti = targets[0];
            const to = foePos(ti) || from.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion));
            const ball = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, blending: THREE.AdditiveBlending, depthTest: false, fog: false, transparent: true }));
            ball.renderOrder = 21;
            group.add(ball);
            const travel = 0.38;
            effect(travel, (e) => {
                ball.position.lerpVectors(from, to, e);
                const s = 0.12 + Math.sin(e * 30) * 0.015;
                ball.scale.set(s, s, 1);
                particle(ball.position, Math.random() < 0.5 ? 0xff6020 : 0xffd060, { vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.3, (Math.random() - 0.5) * 0.3), life: 0.3, size: 0.06 });
            }, () => {
                group.remove(ball); ball.material.dispose();
                // 着弾: 炎の柱 + 火の粉
                burst(to, 0xff7020, 30, 1.1, 0.5);
                effect(0.6, () => {
                    for (let k = 0; k < 4; k++) particle(new THREE.Vector3(to.x + (Math.random() - 0.5) * 0.25, to.y - 0.25, to.z + (Math.random() - 0.5) * 0.1), Math.random() < 0.6 ? 0xff5010 : 0xffc040, { vel: new THREE.Vector3(0, 0.9 + Math.random() * 0.6, 0), life: 0.45, size: 0.09, grow: -0.1 });
                });
                lightPulse(to, 0xff7030, 4, 0.6);
                env.flash("#ff6020", 0.35);
                env.shake(0.04);
                env.sfx("fireHit");
                tintEnemy(ti, 0xff6020, 0.5);
            });
            env.sfx("fireCast");
            return travel + 0.12;
        }
        if (id === "frost") {
            const ti = targets[0];
            const p = foePos(ti);
            const base = new THREE.Vector3(p.x, 0, p.z);
            const geo = new THREE.ConeGeometry(0.05, 0.5, 5);
            geo.translate(0, 0.25, 0);
            const mat = new THREE.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.9, depthTest: false, fog: false });
            const spikes = [];
            for (let k = 0; k < 7; k++) {
                const m = new THREE.Mesh(geo, mat);
                const a = k / 7 * Math.PI * 2;
                m.position.set(base.x + Math.cos(a) * 0.14, 0, base.z + Math.sin(a) * 0.08);
                m.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
                m.scale.set(1, 0.01, 1);
                m.renderOrder = 15;
                group.add(m);
                spikes.push(m);
            }
            env.sfx("frostCast");
            effect(0.25, (e) => spikes.forEach((m, k) => m.scale.set(1, Math.min(1, e * (1.1 + k * 0.08)) * (0.6 + (k % 3) * 0.25), 1)), () => {
                tintEnemy(ti, 0x80c0ff, 0.9);
                burst(p, 0xe0f8ff, 24, 0.7, 0.6);
                env.flash("#c8f0ff", 0.3);
                env.sfx("frostHit");
                effect(0.55, (e) => {
                    mat.opacity = 0.9 * (1 - e);
                    if (Math.random() < 0.5) particle(new THREE.Vector3(base.x + (Math.random() - 0.5) * 0.4, 0.05, base.z), 0xffffff, { vel: new THREE.Vector3(0, 0.2, 0), life: 0.6, size: 0.12 });
                }, () => { spikes.forEach((m) => group.remove(m)); geo.dispose(); mat.dispose(); });
            });
            return 0.32;
        }
        if (id === "thunder") {
            const lines = [];
            const mat = new THREE.LineBasicMaterial({ color: 0xfff8a0, depthTest: false, fog: false, transparent: true });
            targets.forEach((ti) => {
                const p = foePos(ti);
                for (const off of [-0.006, 0, 0.006]) {
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 14), 3));
                    const line = new THREE.Line(geo, mat);
                    line.renderOrder = 22;
                    group.add(line);
                    lines.push({ line, geo, p, off });
                }
            });
            const zig = () => {
                // 同じ稲妻の3本は同じ折れ線を共有する(太く見せる)
                const shapes = new Map();
                lines.forEach(({ geo, p, off }) => {
                    if (!shapes.has(p)) {
                        const pts = [];
                        for (let k = 0; k < 14; k++) {
                            const t = k / 13, j = k === 0 || k === 13 ? 0 : 0.08;
                            pts.push([p.x + (Math.random() - 0.5) * j * 2, 1.0 + (p.y - 1.0) * t, p.z + (Math.random() - 0.5) * j]);
                        }
                        shapes.set(p, pts);
                    }
                    const a = geo.attributes.position.array;
                    shapes.get(p).forEach(([x, y, z], k) => { a[k * 3] = x + off; a[k * 3 + 1] = y; a[k * 3 + 2] = z + off; });
                    geo.attributes.position.needsUpdate = true;
                });
            };
            env.sfx("thunder");
            effect(0.5, (e) => {
                zig();
                mat.opacity = e < 0.8 ? 1 : (1 - e) * 5;
                if (Math.random() < 0.4) env.flash("#ffffff", 0.45);
            }, () => { lines.forEach(({ line, geo }) => { group.remove(line); geo.dispose(); }); mat.dispose(); });
            targets.forEach((ti) => { const p = foePos(ti); lightPulse(p, 0xfff0a0, 5, 0.5); burst(p, 0xfff080, 16, 1.2, 0.4); tintEnemy(ti, 0xffff80, 0.4); });
            env.shake(0.08);
            return 0.3;
        }
        if (id === "heal" || id === "highheal") {
            // 足元(画面の下)に回る魔法陣 + 立ちのぼる光
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
            const center = cam.position.clone().addScaledVector(fwd, 0.55);
            center.y = 0.08;
            const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: id === "highheal" ? 0xfff0a0 : 0x80ffb0, blending: THREE.AdditiveBlending, depthTest: false, fog: false, transparent: true }));
            ring.renderOrder = 21;
            ring.position.copy(center);
            group.add(ring);
            env.sfx("healCast");
            effect(1.0, (e, dt) => {
                const s = 0.2 + e * 0.5;
                ring.scale.set(s, s, 1);
                ring.material.rotation += dt * 3;
                ring.material.opacity = e < 0.7 ? 1 : (1 - e) / 0.3;
                for (let k = 0; k < (id === "highheal" ? 3 : 2); k++) {
                    particle(new THREE.Vector3(center.x + (Math.random() - 0.5) * 0.9, 0.05, center.z + (Math.random() - 0.5) * 0.4), Math.random() < 0.5 ? 0xa0ffc0 : 0xffffff, { vel: new THREE.Vector3(0, 0.5 + Math.random() * 0.4, 0), life: 0.8, size: 0.05 });
                }
            }, () => { group.remove(ring); ring.material.dispose(); });
            env.flash(id === "highheal" ? "#fff0a0" : "#80ffb0", 0.25);
            return 0.5;
        }
        if (id === "starfall") {
            // 天井から流れ星が降りそそぎ、最後に敵ごとに光がはじける
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
            fwd.y = 0; fwd.normalize();
            const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
            env.sfx("starfall");
            env.flash("#f8e070", 0.4);
            effect(1.3, (e) => {
                for (let k = 0; k < 3; k++) {
                    const from = cam.position.clone().addScaledVector(fwd, 0.6 + Math.random() * 1.2).addScaledVector(right, (Math.random() - 0.5) * 1.6);
                    from.y = 1.0;
                    const v = new THREE.Vector3((Math.random() - 0.3) * 0.6, -2.6, 0).addScaledVector(fwd, 0.4);
                    particle(from, Math.random() < 0.5 ? 0xfff090 : 0xffffff, { vel: v, life: 0.45, size: 0.07 });
                    particle(from, 0xf8c040, { vel: v.clone().multiplyScalar(0.92), life: 0.5, size: 0.04 });
                }
                if (Math.random() < 0.15) env.flash("#fff0a0", 0.3);
            }, () => {
                targets.forEach((ti) => { const p = foePos(ti); if (p) { burst(p, 0xfff080, 34, 1.4, 0.7); lightPulse(p, 0xfff0a0, 6, 0.8); tintEnemy(ti, 0xffffa0, 0.8); } });
                env.flash("#ffffff", 0.6);
                env.shake(0.1);
                env.sfx("thunder");
            });
            return 1.35;
        }
        if (id === "lumina") {
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
            const c = cam.position.clone().addScaledVector(fwd, 1.2);
            for (let k = 0; k < 36; k++) {
                const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.6 + Math.random() * 0.6);
                particle(c, 0xffffe0, { vel: v, life: 0.7 + Math.random() * 0.4, size: 0.025 + Math.random() * 0.02, drag: 1.5 });
            }
            env.flash("#ffffe0", 0.5);
            env.sfx("healCast");
            return 0.4;
        }
        return 0.2;
    }

    function update(dt) {
        attach();
        const t = performance.now() / 1000;
        foes.forEach((f) => {
            let x = f.base.x, y = f.base.y, z = f.base.z;
            if (f.fly) y += Math.sin(t * 4 + f.phase) * 0.03;
            else y += Math.abs(Math.sin(t * 2 + f.phase)) * 0.008;
            if (f.lunge > 0) { // 飛びかかる
                f.lunge += dt;
                const e = Math.sin(Math.min(1, f.lunge / 0.3) * Math.PI);
                x -= f.fwd.x * e * 0.35; z -= f.fwd.z * e * 0.35;
                if (f.lunge >= 0.3) f.lunge = 0;
            }
            if (f.flash > 0) { f.flash -= dt; x += (Math.random() - 0.5) * 0.04; f.sprite.visible = Math.floor(f.flash * 20) % 2 === 0; } else f.sprite.visible = true;
            if (f.tintT > 0) { f.tintT -= dt; f.mat.color.copy(f.tint).lerp(new THREE.Color(1, 1, 1), 1 - Math.min(1, f.tintT * 2)); } else f.mat.color.set(0xffffff);
            if (f.fade > 0) {
                f.fade += dt;
                const e = Math.min(1, f.fade / 0.5);
                f.mat.opacity = 1 - e;
                f.sprite.scale.set(f.w * (1 + e * 0.3), f.h * (1 - e * 0.6), 1);
                if (e >= 1) f.sprite.visible = false;
            }
            f.sprite.position.set(x, y, z);
        });
        for (let i = effects.length - 1; i >= 0; i--) {
            const ef = effects[i];
            ef.t += dt;
            const e = Math.min(1, ef.t / ef.dur);
            ef.update?.(e, dt);
            if (e >= 1) { effects.splice(i, 1); ef.done?.(); }
        }
        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            p.life -= dt;
            if (p.life <= 0) { killPart(i); continue; }
            p.vel.y -= p.gravity * dt;
            if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
            p.s.position.addScaledVector(p.vel, dt);
            const k = p.life / p.max;
            p.mat.opacity = Math.min(1, k * 1.5);
            const s = Math.max(0.01, p.size + p.grow * (1 - k));
            p.s.scale.set(s, s, 1);
        }
    }

    function dispose() {
        clearEnemies();
        while (parts.length) killPart(0);
        effects.length = 0;
        if (flashLight) { group.remove(flashLight); flashLight.dispose?.(); flashLight = null; }
        scene?.remove(group);
        res.tex.forEach((t) => t.dispose());
    }

    return { spawnEnemies, clearEnemies, project, hitEnemy, killEnemy, lungeEnemy, tintEnemy, burst, cast, update, dispose, foePos };
}

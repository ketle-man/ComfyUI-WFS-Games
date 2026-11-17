/**
 * PSG 風チップ音源 (WebAudio)
 *
 * 曲はトラッカー風の文字列で書く。1トークン = 16分音符1つ。
 *   "C5" 音を鳴らす / "." 直前の音を伸ばす / "-" 休符
 *   ドラムトラックは "k"(キック) "s"(スネア) "h"(ハイハット)
 * 1曲の全トラックは同じ長さにする。
 *
 * 一時停止は AudioContext.suspend() で行う(時間ごと止まるので予約済みの音もずれない)。
 */

const NOTE_INDEX = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

function noteFreq(tok, transpose = 0) {
    const m = /^([A-G][#b]?)(\d)$/.exec(tok);
    if (!m) return null;
    const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]] + transpose;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function parseTrack(str) {
    const toks = str.trim().split(/\s+/);
    const byStep = new Map();
    for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t === "." || t === "-") continue;
        let len = 1;
        while (i + len < toks.length && toks[i + len] === ".") len++;
        byStep.set(i, { tok: t, len });
    }
    return { byStep, steps: toks.length };
}

function compileSong(def) {
    const tracks = def.tracks.map((tr) => ({ ...tr, ...parseTrack(tr.notes) }));
    return { ...def, tracks, steps: Math.max(...tracks.map((t) => t.steps)) };
}

export function createAudio({ sound = true, bgm = true, songs = {} } = {}) {
    let ac = null;
    let master = null;
    let musicGain = null;
    let sfxGain = null;
    let noiseBuf = null;
    const waves = {};
    const compiled = {};
    let paused = false;

    // エンジン音(レースゲーム用)。速度に合わせて音程を上げる
    let engine = null; // { oscA, oscB, filter, gain }
    let squeal = null; // タイヤのスキール音 { src, osc, lfo, gain }

    // 再生中の曲
    let cur = null; // { song, transpose, bpm, stepDur, startTime, nextStep, gain, onEnd, name }
    let timer = null;

    function pulseWave(duty) {
        const n = 32;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);
        for (let k = 1; k < n; k++) {
            real[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
            imag[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
        }
        return ac.createPeriodicWave(real, imag);
    }

    function ensure() {
        if (!ac) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            ac = new Ctx();
            master = ac.createGain();
            master.gain.value = 0.8;
            master.connect(ac.destination);
            musicGain = ac.createGain();
            musicGain.gain.value = bgm ? 0.5 : 0;
            musicGain.connect(master);
            sfxGain = ac.createGain();
            sfxGain.gain.value = sound ? 0.9 : 0;
            sfxGain.connect(master);
            noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            waves.pulse25 = pulseWave(0.25);
            waves.pulse12 = pulseWave(0.125);
        }
        if (ac.state === "suspended" && !paused) ac.resume().catch(() => {});
        return ac;
    }

    function setWave(osc, wave) {
        if (waves[wave]) osc.setPeriodicWave(waves[wave]);
        else osc.type = wave || "square";
    }

    function tone(dest, wave, freq, t, dur, vol, { slide = 0, attack = 0.004, release = 0.03 } = {}) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        setWave(o, wave);
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + attack);
        g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    function noise(dest, t, dur, vol, hp) {
        const src = ac.createBufferSource();
        src.buffer = noiseBuf;
        const f = ac.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = hp;
        const g = ac.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(dest);
        src.start(t);
        src.stop(t + dur + 0.02);
    }

    function drum(dest, tok, t, vol) {
        if (tok === "k") tone(dest, "sine", 150, t, 0.13, vol * 1.6, { slide: 0.28, attack: 0.002, release: 0.08 });
        else if (tok === "s") noise(dest, t, 0.13, vol * 0.9, 1200);
        else if (tok === "h") noise(dest, t, 0.04, vol * 0.4, 7000);
    }

    function scheduleStep(step, t) {
        for (const tr of cur.song.tracks) {
            const ev = tr.byStep.get(step);
            if (!ev) continue;
            if (tr.wave === "drum") { drum(cur.gain, ev.tok, t, tr.vol); continue; }
            const f = noteFreq(ev.tok, tr.fixed ? 0 : cur.transpose);
            if (f) tone(cur.gain, tr.wave, f, t, ev.len * cur.stepDur * (tr.gate ?? 0.9), tr.vol);
        }
    }

    function tick() {
        if (!cur || !ac) return;
        const ahead = ac.currentTime + 0.15;
        for (;;) {
            if (cur.nextStep >= cur.song.steps) {
                if (!cur.song.loop) {
                    const end = cur.onEnd;
                    const doneAt = cur.startTime + cur.song.steps * cur.stepDur;
                    if (ac.currentTime >= doneAt) { stopMusic(); end?.(); }
                    return;
                }
                cur.startTime += cur.song.steps * cur.stepDur;
                cur.nextStep = 0;
            }
            const t = cur.startTime + cur.nextStep * cur.stepDur;
            if (t > ahead) break;
            scheduleStep(cur.nextStep, t);
            cur.nextStep++;
        }
    }

    function stopMusic() {
        if (timer) { clearInterval(timer); timer = null; }
        if (cur && ac) {
            const g = cur.gain;
            g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
            setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, 400);
        }
        cur = null;
    }

    return {
        /** ユーザー操作のタイミングで呼ぶ(ブラウザの自動再生制限を解除する) */
        unlock() { ensure(); },

        playMusic(name, { transpose = 0, bpm = null, onEnd = null } = {}) {
            if (!ensure()) return;
            if (!bgm) { stopMusic(); onEnd?.(); return; }
            if (cur && cur.name === name && cur.transpose === transpose && cur.song.loop) return; // 同じ曲を鳴らし続ける
            stopMusic();
            const def = songs[name];
            if (!def) return;
            compiled[name] ||= compileSong(def);
            const song = compiled[name];
            const useBpm = bpm || song.bpm;
            const gain = ac.createGain();
            gain.gain.value = 1;
            gain.connect(musicGain);
            cur = { name, song, transpose, stepDur: 60 / useBpm / 4, startTime: ac.currentTime + 0.06, nextStep: 0, gain, onEnd };
            tick();
            timer = setInterval(tick, 25);
        },

        stopMusic,

        setPaused(on) {
            paused = on;
            if (!ac) return;
            if (on) ac.suspend().catch(() => {});
            else ac.resume().catch(() => {});
        },

        sfx(name) {
            if (!sound || !ensure() || paused) return;
            const t = ac.currentTime;
            const d = sfxGain;
            switch (name) {
                case "shoot": tone(d, "pulse25", 1400, t, 0.07, 0.05, { slide: 0.45, release: 0.04 }); break;
                case "hit": tone(d, "square", 520, t, 0.05, 0.05, { slide: 0.6 }); break;
                case "boom": noise(d, t, 0.3, 0.22, 300); tone(d, "triangle", 220, t, 0.25, 0.12, { slide: 0.3 }); break;
                case "playerDown": noise(d, t, 0.9, 0.3, 150); tone(d, "square", 330, t, 0.8, 0.07, { slide: 0.12 }); break;
                case "dive": tone(d, "pulse12", 900, t, 0.35, 0.025, { slide: 0.4 }); break;
                case "text": tone(d, "pulse12", 1800, t, 0.02, 0.02); break;
                case "warning": [0, 0.3, 0.6].forEach((dt) => { tone(d, "square", 880, t + dt, 0.14, 0.05); tone(d, "square", 660, t + dt + 0.15, 0.14, 0.05); }); break;
                case "bossDown": noise(d, t, 1.6, 0.35, 120); tone(d, "sawtooth", 260, t, 1.4, 0.08, { slide: 0.1 }); break;
                case "charge": tone(d, "pulse25", 200, t, 0.5, 0.05, { slide: 4 }); break;
                case "item": [1047, 1319, 1568, 2093].forEach((f, i) => tone(d, "pulse25", f, t + i * 0.05, 0.06, 0.04)); break;
                case "perfect": [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(d, "square", f, t + i * 0.08, 0.1, 0.045)); break;
                case "countdown": tone(d, "square", 660, t, 0.18, 0.05); break;
                case "go": tone(d, "square", 1320, t, 0.45, 0.06); break;
                case "pass": tone(d, "pulse25", 1200, t, 0.05, 0.035); tone(d, "pulse25", 1600, t + 0.05, 0.07, 0.035); break;
                case "crash": noise(d, t, 0.35, 0.3, 200); tone(d, "square", 140, t, 0.25, 0.06, { slide: 0.5 }); break;
                case "nitro": noise(d, t, 0.9, 0.18, 1500); tone(d, "sawtooth", 180, t, 0.8, 0.05, { slide: 3 }); break;
                case "start": [523, 784, 1047].forEach((f, i) => tone(d, "square", f, t + i * 0.07, 0.07, 0.05)); break;
                default: break;
            }
        },

        /** エンジン音を鳴らし始める(効果音の設定に従う) */
        startEngine() {
            if (!sound || !ensure() || engine) return;
            const oscA = ac.createOscillator();
            const oscB = ac.createOscillator();
            setWave(oscA, "sawtooth");
            setWave(oscB, "pulse25");
            const filter = ac.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = 900;
            const gain = ac.createGain();
            gain.gain.value = 0;
            oscA.connect(filter);
            oscB.connect(filter);
            filter.connect(gain).connect(sfxGain);
            oscA.start();
            oscB.start();
            engine = { oscA, oscB, filter, gain };
        },
        /** ratio: 0(停止)〜1(最高速)、boost: ニトロ中 */
        setEngine(ratio, boost = false) {
            if (!engine || !ac) return;
            const r = Math.max(0, Math.min(1.4, ratio));
            const t = ac.currentTime;
            // ギアが上がるたびに少し音程が戻る感じを出す
            const gearPos = (r * 4) % 1;
            const f = 55 + r * 150 + gearPos * 40;
            engine.oscA.frequency.setTargetAtTime(f, t, 0.05);
            engine.oscB.frequency.setTargetAtTime(f * 1.5, t, 0.05);
            engine.filter.frequency.setTargetAtTime(500 + r * 1600 + (boost ? 900 : 0), t, 0.05);
            engine.gain.gain.setTargetAtTime(paused ? 0 : 0.018 + r * 0.022, t, 0.05);
        },
        /** タイヤのスキール音。amount: 0(無音)〜1(最大)。エンジン音と同じく効果音の設定に従う */
        setSqueal(amount) {
            if (!sound || !ac || !engine) return;
            const a = Math.max(0, Math.min(1, amount));
            if (!squeal && a > 0) {
                // 高めの帯域のノイズ + 震える高い音(80年代アーケード風の「キュルル」)
                const src = ac.createBufferSource();
                src.buffer = noiseBuf;
                src.loop = true;
                const bp = ac.createBiquadFilter();
                bp.type = "bandpass";
                bp.frequency.value = 2600;
                bp.Q.value = 6;
                const osc = ac.createOscillator();
                setWave(osc, "triangle");
                osc.frequency.value = 1700;
                const lfo = ac.createOscillator();
                lfo.frequency.value = 17;
                const lfoGain = ac.createGain();
                lfoGain.gain.value = 140;
                lfo.connect(lfoGain).connect(osc.frequency);
                const oscGain = ac.createGain();
                oscGain.gain.value = 0.35;
                const gain = ac.createGain();
                gain.gain.value = 0;
                src.connect(bp).connect(gain);
                osc.connect(oscGain).connect(gain);
                gain.connect(sfxGain);
                src.start();
                osc.start();
                lfo.start();
                squeal = { src, osc, lfo, gain };
            }
            if (squeal) squeal.gain.gain.setTargetAtTime(paused ? 0 : a * 0.05, ac.currentTime, 0.04);
        },
        stopEngine() {
            if (squeal) {
                const q = squeal;
                squeal = null;
                try {
                    q.gain.gain.setTargetAtTime(0, ac.currentTime, 0.03);
                    setTimeout(() => { try { q.src.stop(); q.osc.stop(); q.lfo.stop(); q.gain.disconnect(); } catch { /* ignore */ } }, 250);
                } catch { /* ignore */ }
            }
            if (!engine) return;
            const e = engine;
            engine = null;
            try {
                e.gain.gain.setTargetAtTime(0, ac.currentTime, 0.05);
                setTimeout(() => { try { e.oscA.stop(); e.oscB.stop(); e.gain.disconnect(); } catch { /* ignore */ } }, 300);
            } catch { /* ignore */ }
        },

        close() {
            this.stopEngine?.();
            stopMusic();
            try { ac?.close(); } catch { /* ignore */ }
            ac = null;
        },
    };
}

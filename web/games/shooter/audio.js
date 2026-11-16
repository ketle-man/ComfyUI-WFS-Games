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
                case "start": [523, 784, 1047].forEach((f, i) => tone(d, "square", f, t + i * 0.07, 0.07, 0.05)); break;
                default: break;
            }
        },

        close() {
            stopMusic();
            try { ac?.close(); } catch { /* ignore */ }
            ac = null;
        },
    };
}

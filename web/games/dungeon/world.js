/**
 * Dungeon Heart: 3D の迷路(three.js)
 * - 低い解像度(VIEW_W×VIEW_H)で描いて、CSS でドットのまま拡大する
 * - 壁は InstancedMesh(1マス1個の箱)、床と天井は1枚の板にドット絵のテクスチャを繰り返す
 * - 扉・隠し壁・宝箱・泉・階段・罠は1マスごとのメッシュ(open() で開く動き)
 * - カメラはマス目単位で移動・90度回転し、その間を補間する
 * - 階が変わるたびに loadFloor() で作り直す。dispose() で GPU 資源と WebGL コンテキストを確実に手放す
 *
 * マップの文字: # 壁 / . 床 / @ 開始位置 / D 扉 / L 鍵の扉 / ? 隠し壁 / T 宝箱 / k 鍵の宝箱 / H ハートの宝箱
 *               F 回復の泉 / S 下り階段 / ^ 罠 / i 立て札(踏むと会話) / B ボス / R 回転床 / A 祭壇(最下層) / P 落とし穴
 * 飾り: 壁は3種類(ふつう / 苔・水晶・溶岩の筋・ルーン / ひび・崩れ)をマスごとに混ぜる。床の飾り(がれき・骨・水たまり・ひび・水晶のかけら)と壁のたいまつ
 */
import * as THREE from "../../vendor/three/three.module.js";

export const VIEW_W = 224;
export const VIEW_H = 144;

// 向き: 0=北(-z) 1=東(+x) 2=南(+z) 3=西(-x)
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function rand(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** ドット絵のテクスチャを Canvas で作る */
function canvasTexture(size, draw, h = size) {
    const c = document.createElement("canvas");
    c.width = size; c.height = h;
    const g = c.getContext("2d");
    draw(g, size, h);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const TEX = {
    wall: (th, variant = "base", seed = 7) => canvasTexture(32, (g, n) => {
        const r = rand(seed);
        g.fillStyle = th.mortar; g.fillRect(0, 0, n, n);
        for (let y = 0; y < n; y += 8) {
            const off = (y / 8) % 2 ? 8 : 0;
            for (let x = -off; x < n; x += 16) {
                g.fillStyle = th.stone[Math.floor(r() * th.stone.length)];
                g.fillRect(x + 1, y + 1, 14, 6);
                g.fillStyle = th.accent;
                if (r() < 0.35) g.fillRect(x + 2 + Math.floor(r() * 10), y + 5, 2, 1);
                g.fillStyle = "rgba(255,255,255,0.12)";
                g.fillRect(x + 1, y + 1, 14, 1);
            }
        }
        if (variant === "moss") {
            // 苔: 下のほうにかたまり、上から垂れる
            const moss = th.moss || ["#2c5a28", "#3c6a34", "#5a8a3a"];
            // 大きなかたまり(下半分に多い)
            for (let i = 0; i < 9; i++) {
                const cx = Math.floor(r() * n), cy = Math.floor(n - 2 - Math.pow(r(), 1.5) * 22), rr = 2 + Math.floor(r() * 3);
                for (let k = 0; k < 18; k++) {
                    const x = cx + Math.floor((r() - 0.5) * rr * 2), y = cy + Math.floor((r() - 0.5) * rr * 1.4);
                    g.fillStyle = moss[Math.floor(r() * moss.length)];
                    g.fillRect(((x % n) + n) % n, Math.max(0, Math.min(n - 1, y)), 2, 1);
                }
            }
            for (let i = 0; i < 60; i++) {
                const x = Math.floor(r() * n), y = Math.floor(n - 1 - Math.pow(r(), 1.8) * 18);
                g.fillStyle = moss[Math.floor(r() * moss.length)];
                g.fillRect(x, y, 1 + Math.floor(r() * 2), 1);
            }
            // 上から垂れる苔
            for (let i = 0; i < 12; i++) {
                const x = Math.floor(r() * n), len = 3 + Math.floor(r() * 11);
                g.fillStyle = moss[Math.floor(r() * moss.length)];
                g.fillRect(x, 0, 1, len);
                g.fillRect(x - 1 + Math.floor(r() * 3), len - 1, 1, 2);
                if (r() < 0.5) g.fillRect(x + 1, 0, 1, Math.floor(len / 2));
            }
        }
        if (variant === "crack") {
            // ひびと崩れたレンガ
            g.fillStyle = "#0a0806";
            [[4, 8], [20, 16]].forEach(([bx, by]) => { g.fillRect(bx + 1, by + 1, 10, 5); g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(bx + 1, by + 1, 10, 2); g.fillStyle = "#0a0806"; });
            g.fillStyle = th.mortar;
            let x = 10 + Math.floor(r() * 10), y = 0;
            while (y < n) { g.fillRect(x, y, 1, 2); x += Math.floor(r() * 3) - 1; y += 2; }
            g.fillStyle = "rgba(0,0,0,0.5)";
            for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * n), n - 2 - Math.floor(r() * 3), 2, 1);
        }
        if (variant === "crystal") {
            // 壁に埋まった水晶
            [[6, 20, 5], [22, 10, 4], [16, 26, 3]].forEach(([cx, cy, h]) => {
                for (let k = 0; k < h; k++) { g.fillStyle = k < h / 2 ? "#a8f8ff" : "#58c8e8"; g.fillRect(cx - (h - k) / 2, cy - k * 2, h - k, 2); }
                g.fillStyle = "#ffffff"; g.fillRect(cx - 1, cy - h * 2 + 3, 1, 2);
            });
        }
        if (variant === "vein") {
            // 溶岩の筋(光る)
            g.fillStyle = "#ff7020";
            let x = Math.floor(r() * n), y = 0;
            while (y < n) { g.fillRect(x, y, 1, 1); g.fillStyle = r() < 0.3 ? "#ffd060" : "#ff7020"; x = (x + Math.floor(r() * 3) - 1 + n) % n; y++; }
            g.fillStyle = "#c83010"; g.fillRect(0, n - 3, n, 1);
        }
        if (variant === "rune") {
            // 星のルーン
            g.fillStyle = "#f8e070";
            const cx = 16, cy = 14;
            g.fillRect(cx - 5, cy, 11, 1); g.fillRect(cx, cy - 5, 1, 11); g.fillRect(cx - 3, cy - 3, 1, 1); g.fillRect(cx + 3, cy - 3, 1, 1); g.fillRect(cx - 3, cy + 3, 1, 1); g.fillRect(cx + 3, cy + 3, 1, 1);
            g.fillRect(cx - 7, cy - 7, 15, 1); g.fillRect(cx - 7, cy + 7, 15, 1);
        }
    }),
    /** 床の飾り(透明な板に描く): rubble / bones / puddle / crack / shards / lavacrack / dust */
    deco: (kind, seed) => canvasTexture(16, (g, n) => {
        const r = rand(seed);
        g.clearRect(0, 0, n, n);
        if (kind === "rubble") { for (let i = 0; i < 9; i++) { const c = 60 + Math.floor(r() * 50); g.fillStyle = `rgb(${c},${c - 6},${c - 14})`; g.fillRect(Math.floor(r() * 12) + 2, Math.floor(r() * 12) + 2, 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)); } }
        if (kind === "bones") { g.fillStyle = "#e0d8c0"; g.fillRect(3, 8, 9, 1); g.fillRect(2, 7, 2, 3); g.fillRect(11, 7, 2, 3); g.fillRect(9, 3, 4, 3); g.fillStyle = "#302820"; g.fillRect(10, 4, 1, 1); g.fillRect(12, 4, 1, 1); }
        if (kind === "puddle") { g.fillStyle = "rgba(60,140,220,0.55)"; g.fillRect(3, 5, 10, 6); g.fillRect(5, 4, 6, 8); g.fillStyle = "rgba(200,240,255,0.7)"; g.fillRect(6, 6, 3, 1); }
        if (kind === "crack") { g.fillStyle = "rgba(0,0,0,0.6)"; let x = 2, y = 3; while (x < 14) { g.fillRect(x, y, 2, 1); x += 2; y += Math.floor(r() * 3) - 1; } g.fillRect(8, 6, 1, 5); }
        if (kind === "shards") { for (let i = 0; i < 5; i++) { g.fillStyle = r() < 0.5 ? "#a8f0ff" : "#c8a8ff"; const x = 2 + Math.floor(r() * 11), y = 2 + Math.floor(r() * 11); g.fillRect(x, y, 2, 1); g.fillRect(x, y - 1, 1, 1); } }
        if (kind === "lavacrack") { g.fillStyle = "#ff6010"; let x = 1, y = 8; while (x < 15) { g.fillRect(x, y, 2, 1); x += 2; y += Math.floor(r() * 3) - 1; } g.fillStyle = "#ffd050"; g.fillRect(7, 8, 2, 1); }
        if (kind === "dust") { for (let i = 0; i < 7; i++) { g.fillStyle = r() < 0.4 ? "#f8e070" : "#c8c8ff"; g.fillRect(Math.floor(r() * 15), Math.floor(r() * 15), 1, 1); } }
    }),
    halo: () => canvasTexture(16, (g, n) => {
        g.clearRect(0, 0, n, n);
        [[0, 16, 0.15], [2, 12, 0.3], [4, 8, 0.55], [6, 4, 0.9]].forEach(([o, sz, a]) => { g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(o, o, sz, sz); });
    }),
    pit: () => canvasTexture(16, (g, n) => {
        g.fillStyle = "#504838"; g.fillRect(0, 0, n, n);            // 縁の石
        g.fillStyle = "#38322a"; g.fillRect(1, 1, 14, 14);
        g.fillStyle = "#1a1612"; g.fillRect(2, 2, 12, 12);
        g.fillStyle = "#0a0806"; g.fillRect(3, 3, 10, 10);
        g.fillStyle = "#000000"; g.fillRect(4, 4, 8, 8);
        g.fillStyle = "#6a6250"; [[0, 0], [5, 0], [11, 0], [0, 6], [15, 9], [7, 15], [15, 3]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
    }),
    flame: () => canvasTexture(8, (g, n) => {
        g.clearRect(0, 0, n, n);
        g.fillStyle = "#ff8020"; g.fillRect(2, 3, 4, 5); g.fillRect(3, 1, 2, 2);
        g.fillStyle = "#ffd060"; g.fillRect(3, 4, 2, 3); g.fillRect(3, 2, 1, 2);
        g.fillStyle = "#ffffff"; g.fillRect(3, 5, 1, 1);
    }, 8),
    sconce: () => canvasTexture(8, (g, n) => {
        g.clearRect(0, 0, n, n);
        g.fillStyle = "#3a2a1a"; g.fillRect(3, 2, 2, 6); g.fillStyle = "#6a6a72"; g.fillRect(1, 1, 6, 2); g.fillRect(2, 0, 1, 1); g.fillRect(5, 0, 1, 1);
    }, 8),
    floor: (colors, seed = 11) => canvasTexture(32, (g, n) => {
        const r = rand(seed);
        g.fillStyle = colors[0]; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 60; i++) {
            g.fillStyle = colors[1 + Math.floor(r() * (colors.length - 1))];
            g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 2, 1);
        }
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(0, 0, n, 1); g.fillRect(0, 0, 1, n);
    }),
    door: (locked) => canvasTexture(32, (g, n) => {
        g.fillStyle = "#2a1a0e"; g.fillRect(0, 0, n, n);
        for (let x = 3; x < 29; x += 6) {                 // 板
            g.fillStyle = x % 12 === 3 ? "#7a4a26" : "#6a3e20";
            g.fillRect(x, 2, 5, 30);
            g.fillStyle = "#8a5a32"; g.fillRect(x, 2, 1, 30);
        }
        g.fillStyle = locked ? "#8890a0" : "#3a2a1a";      // 横木 / 鉄の帯
        g.fillRect(2, 7, 28, 3); g.fillRect(2, 22, 28, 3);
        g.fillStyle = "#1a1008"; g.fillRect(0, 0, n, 2); g.fillRect(0, 0, 2, n); g.fillRect(30, 0, 2, n);
        if (locked) {                                       // 錠前
            g.fillStyle = "#e8c040"; g.fillRect(13, 13, 7, 7);
            g.fillStyle = "#3a2a10"; g.fillRect(16, 15, 1, 3);
        } else {
            g.fillStyle = "#c8a040"; g.fillRect(24, 15, 2, 3); // 取っ手
        }
    }),
    chest: (heart) => canvasTexture(16, (g, n) => {
        g.fillStyle = heart ? "#c8407a" : "#7a4a22"; g.fillRect(0, 0, n, n);
        g.fillStyle = heart ? "#e870a0" : "#9a6232"; g.fillRect(1, 1, 14, 3);
        g.fillStyle = "#e8c040";
        g.fillRect(0, 0, n, 1); g.fillRect(0, 15, n, 1); g.fillRect(3, 0, 2, n); g.fillRect(11, 0, 2, n);
    }),
    stairs: () => canvasTexture(32, (g, n) => {
        g.fillStyle = "#000"; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 6; i++) {                       // 奥へ下っていく段
            const c = 120 - i * 18;
            g.fillStyle = `rgb(${c},${c * 0.9 | 0},${c * 0.75 | 0})`;
            g.fillRect(2 + i, 2 + i * 5, n - 4 - i * 2, 3);
        }
        g.strokeStyle = "#a89870"; g.lineWidth = 2; g.strokeRect(1, 1, n - 2, n - 2);
    }),
    trap: () => canvasTexture(16, (g, n) => {
        g.fillStyle = "#3a1010"; g.fillRect(0, 0, n, n);
        g.fillStyle = "#c83030";
        for (let i = 2; i < 14; i += 4) for (let j = 2; j < 14; j += 4) g.fillRect(i, j, 2, 2);
    }),
    swirl: () => canvasTexture(16, (g, n) => {
        g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, n, n);
        g.strokeStyle = "rgba(200,160,255,0.55)"; g.lineWidth = 1;
        g.beginPath();
        for (let a = 0; a < Math.PI * 5; a += 0.2) { const r = a * 1.0; const x = 8 + Math.cos(a) * r * 0.45, y = 8 + Math.sin(a) * r * 0.45; a ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
    }),
    stars: () => canvasTexture(32, (g, n) => {
        g.fillStyle = "#04040e"; g.fillRect(0, 0, n, n);
        const r = rand(5);
        for (let i = 0; i < 14; i++) { g.fillStyle = r() < 0.3 ? "#f8e070" : "#e8e8ff"; g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1, 1); }
        g.fillStyle = "#ffffff"; g.fillRect(20, 9, 1, 1); g.fillRect(19, 9, 3, 1); g.fillRect(20, 8, 1, 3);
    }),
    water: () => canvasTexture(16, (g, n) => {
        g.fillStyle = "#2050c8"; g.fillRect(0, 0, n, n);
        g.fillStyle = "#58a8f8"; g.fillRect(2, 3, 5, 1); g.fillRect(9, 9, 5, 1); g.fillRect(4, 13, 4, 1);
        g.fillStyle = "#c8f0ff"; g.fillRect(11, 4, 2, 1);
    }),
};

export const THEMES = {
    catacomb: {
        mortar: "#1a1812", stone: ["#5c5848", "#6a6452", "#525040", "#646050"], accent: "#3c6a34",
        floor: ["#38342a", "#2c2a22", "#46413a", "#3a4a30"], ceil: ["#1e1c18", "#26231d"],
        fog: 0x080604, light: 0xffb060,
        walls: ["moss", "crack"], decos: ["rubble", "bones", "crack", "rubble"], torch: 0xffa040,
    },
    waterway: {
        mortar: "#0c1418", stone: ["#3a5058", "#44606a", "#34484e", "#4a6670"], accent: "#2a7a8a",
        floor: ["#1c3440", "#163038", "#24404c", "#2a5060"], ceil: ["#10181c", "#162024"],
        fog: 0x02080c, light: 0xa0d8ff,
        walls: ["moss", "crack"], moss: ["#1a5a50", "#2a7a6a", "#3a9a80"], decos: ["puddle", "rubble", "puddle", "crack"], torch: 0x80c0ff,
    },
    crystal: {
        mortar: "#141028", stone: ["#4a4078", "#584a90", "#3e3668", "#625aa0"], accent: "#78f0ff",
        floor: ["#28204a", "#20183c", "#30285a", "#3a3070"], ceil: ["#140f28", "#1c1634"],
        fog: 0x06040e, light: 0xc8b8ff,
        walls: ["crystal", "crack"], decos: ["shards", "rubble", "shards"], torch: 0xc0a0ff,
    },
    lava: {
        mortar: "#1a0806", stone: ["#4a2418", "#58301e", "#3e1c12", "#603826"], accent: "#ff6020",
        floor: ["#3a1408", "#5a1c08", "#802808", "#c84010"], ceil: ["#140604", "#1c0a06"],
        fog: 0x080200, light: 0xff9858, dark: true, glowFloor: 0x401000,
        walls: ["vein", "crack"], decos: ["lavacrack", "rubble", "lavacrack", "bones"], torch: 0xff6020,
    },
    star: {
        mortar: "#0a0a1c", stone: ["#2a2a58", "#30306a", "#24244c", "#38387a"], accent: "#f8e070",
        floor: ["#141430", "#1a1a3c", "#22224a", "#f8e070"], ceil: ["#04040c", "#f8f8ff"],
        fog: 0x02020a, light: 0xd8e0ff, starCeil: true,
        walls: ["rune", "crack"], decos: ["dust", "dust", "crack"], torch: 0xfff0a0,
    },
};

export function createWorld(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(VIEW_W, VIEW_H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(70, VIEW_W / VIEW_H, 0.05, 30);

    // 階ごとに作り直すもの
    let scene = null, torch = null, floorRes = null, objects = new Map(), floorWater = null, theme = null, torches = [];

    const cam = { x: 1, z: 1, dir: 1, fx: 1, fz: 1, fa: 0, from: null, to: null, t: 1, dur: 0.16, shake: 0 };
    const angleOf = (dir) => -dir * Math.PI / 2; // 北向きが 0、東向きは -90°
    const shortest = (d) => Math.atan2(Math.sin(d), Math.cos(d));

    function disposeFloor() {
        if (!floorRes) return;
        scene.clear();
        floorRes.instanced.forEach((m) => m.dispose());
        floorRes.geometries.forEach((g) => g.dispose());
        floorRes.materials.forEach((m) => m.dispose());
        floorRes.textures.forEach((t) => t.dispose());
        floorRes = null;
        objects = new Map();
    }

    /**
     * rows: マップの文字列の配列 / theme: THEMES のキー / isOpen(x, z): 開いた扉・宝箱・見つけた隠し壁・作動した罠
     */
    function loadFloor(rows, themeKey, isOpen, info = () => ({})) {
        disposeFloor();
        const th = THEMES[themeKey] || THEMES.catacomb;
        theme = th;
        const res = { geometries: [], materials: [], textures: [], instanced: [] };
        floorRes = res;
        const geo = (gm) => { res.geometries.push(gm); return gm; };
        const mat = (m) => { res.materials.push(m); return m; };
        const tex = (t) => { res.textures.push(t); return t; };

        scene = new THREE.Scene();
        scene.background = new THREE.Color(th.fog);
        scene.fog = new THREE.Fog(th.fog, 0.6, 5.2);
        const h = rows.length, w = rows[0].length;
        const at = (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? "#" : rows[z][x]);

        // 壁(InstancedMesh)
        const variants = ["base", ...(th.walls || [])];
        const wallMats = variants.map((v, i) => mat(new THREE.MeshLambertMaterial({ map: tex(TEX.wall(th, v, 7 + i * 13)) })));
        const wallMat = wallMats[0];
        const box = geo(new THREE.BoxGeometry(1, 1, 1));
        const hash = (x, z, k = 0) => { let v = (x * 73856093) ^ (z * 19349663) ^ (k * 83492791); v = (v ^ (v >>> 13)) * 1274126177; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
        const cellsBy = variants.map(() => []);
        for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
            if (rows[z][x] !== "#") continue;
            const v = hash(x, z);
            cellsBy[Math.min(variants.length - 1, v < 0.6 ? 0 : v < 0.82 ? 1 : 2)].push([x, z]);
        }
        const m4 = new THREE.Matrix4();
        cellsBy.forEach((cells, vi) => {
            if (!cells.length) return;
            const im = new THREE.InstancedMesh(box, wallMats[vi], cells.length);
            res.instanced.push(im);
            cells.forEach(([x, z], i) => { m4.makeTranslation(x, 0.5, z); im.setMatrixAt(i, m4); });
            im.instanceMatrix.needsUpdate = true;
            scene.add(im);
        });
        // 床の飾り(マスごとに1つまで)と、壁のたいまつ
        const decoKinds = th.decos || [];
        const decoMats = decoKinds.map((k, i) => mat(new THREE.MeshBasicMaterial({ map: tex(TEX.deco(k, 31 + i * 7)), transparent: true, depthWrite: false, color: k === "lavacrack" || k === "dust" ? 0xffffff : 0xb0b0b0 })));
        const decoGeo = geo(new THREE.PlaneGeometry(0.7, 0.7));
        decoGeo.rotateX(-Math.PI / 2);
        const rubbleGeo = geo(new THREE.BoxGeometry(0.07, 0.05, 0.06));
        const rubbleMat = mat(new THREE.MeshLambertMaterial({ color: new THREE.Color(th.stone[0]) }));
        const rubble = [];
        for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
            const c = rows[z][x];
            if (c !== "." && c !== "@") continue;
            const v = hash(x, z, 1);
            if (decoKinds.length && v < 0.32) {
                const k = Math.floor(hash(x, z, 2) * decoKinds.length);
                const d = new THREE.Mesh(decoGeo, decoMats[k]);
                d.position.set(x + (hash(x, z, 3) - 0.5) * 0.3, 0.003 + k * 0.0005, z + (hash(x, z, 4) - 0.5) * 0.3);
                d.rotation.y = Math.floor(hash(x, z, 5) * 4) * Math.PI / 2;
                scene.add(d);
                if (decoKinds[k] === "rubble") {
                    // 崩れた石(立体): 壁ぎわに数個
                    const side = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([dx, dz]) => at(x + dx, z + dz) === "#");
                    if (side) for (let i = 0; i < 4; i++) rubble.push([x + side[0] * 0.38 + (hash(x, z, 10 + i) - 0.5) * 0.4, 0.025 + (i === 3 ? 0.04 : 0), z + side[1] * 0.38 + (hash(x, z, 20 + i) - 0.5) * 0.4, hash(x, z, 30 + i) * 3]);
                }
            }
        }
        if (rubble.length) {
            const im = new THREE.InstancedMesh(rubbleGeo, rubbleMat, rubble.length);
            res.instanced.push(im);
            const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
            rubble.forEach(([x, y, z, a], i) => { q.setFromEuler(new THREE.Euler(0, a, 0)); sc.set(0.7 + (a % 1), 0.8 + ((a * 3) % 1) * 0.6, 0.8 + ((a * 7) % 1)); pos.set(x, y, z); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); });
            im.instanceMatrix.needsUpdate = true;
            scene.add(im);
        }
        // たいまつ: 通路に面した壁に、まばらに
        const flameMat = mat(new THREE.SpriteMaterial({ map: tex(TEX.flame()), color: th.torch || 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
        const sconceMat = mat(new THREE.SpriteMaterial({ map: tex(TEX.sconce()), transparent: true }));
        const haloMat = mat(new THREE.SpriteMaterial({ map: tex(TEX.halo()), color: th.torch || 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
        torches = [];
        for (let z = 1; z < h - 1; z++) for (let x = 1; x < w - 1; x++) {
            if (rows[z][x] !== "#" || hash(x, z, 7) > 0.16) continue;
            const face = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([dx, dz]) => ".@".includes(at(x + dx, z + dz)));
            if (!face) continue;
            const px = x + face[0] * 0.52, pz = z + face[1] * 0.52;
            const sc2 = new THREE.Sprite(sconceMat); sc2.position.set(px, 0.55, pz); sc2.scale.set(0.12, 0.12, 1); scene.add(sc2);
            const fl = new THREE.Sprite(flameMat); fl.position.set(px, 0.66, pz); fl.scale.set(0.11, 0.13, 1); scene.add(fl);
            const halo = new THREE.Sprite(haloMat); halo.position.set(px + face[0] * 0.02, 0.64, pz + face[1] * 0.02); halo.scale.set(0.5, 0.5, 1); scene.add(halo);
            torches.push({ fl, halo, ph: hash(x, z, 8) * 10 });
        }

        // 床と天井
        const floorTex = tex(TEX.floor(th.floor));
        floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
        floorTex.repeat.set(w, h);
        const ceilTex = tex(th.starCeil ? TEX.stars() : TEX.floor(th.ceil, 23));
        ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
        ceilTex.repeat.set(w, h);
        const plane = geo(new THREE.PlaneGeometry(w, h));
        const floor = new THREE.Mesh(plane, mat(new THREE.MeshLambertMaterial({ map: floorTex, emissive: th.glowFloor || 0x000000 })));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(w / 2 - 0.5, 0, h / 2 - 0.5);
        scene.add(floor);
        const ceil = new THREE.Mesh(plane, mat(th.starCeil ? new THREE.MeshBasicMaterial({ map: ceilTex, fog: false }) : new THREE.MeshLambertMaterial({ map: ceilTex })));
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(w / 2 - 0.5, 1, h / 2 - 0.5);
        scene.add(ceil);
        floorWater = themeKey === "waterway" || th.glowFloor ? floorTex : null;

        // マスごとの物
        const doorMat = mat(new THREE.MeshLambertMaterial({ map: tex(TEX.door(false)) }));
        const lockMat = mat(new THREE.MeshLambertMaterial({ map: tex(TEX.door(true)) }));
        const chestMat = mat(new THREE.MeshLambertMaterial({ map: tex(TEX.chest(false)) }));
        const heartMat = mat(new THREE.MeshLambertMaterial({ map: tex(TEX.chest(true)) }));
        const chestBody = geo(new THREE.BoxGeometry(0.46, 0.26, 0.32));
        const chestLid = geo(new THREE.BoxGeometry(0.46, 0.08, 0.32));
        chestLid.translate(0, 0.04, 0.16); // 蝶番(奥の辺)を原点に
        const flat = geo(new THREE.PlaneGeometry(0.9, 0.9));
        flat.rotateX(-Math.PI / 2);
        const stairsMat = mat(new THREE.MeshLambertMaterial({ map: tex(TEX.stairs()) }));
        const trapMat = mat(new THREE.MeshLambertMaterial({ map: tex(TEX.trap()) }));
        const basin = geo(new THREE.CylinderGeometry(0.34, 0.38, 0.22, 12));
        const stoneMat = mat(new THREE.MeshLambertMaterial({ color: 0x8a8678 }));
        const waterTex = tex(TEX.water());
        waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
        const waterMat = mat(new THREE.MeshBasicMaterial({ map: waterTex }));
        const waterDisc = geo(new THREE.CircleGeometry(0.3, 12));
        waterDisc.rotateX(-Math.PI / 2);
        let fountainLight = null;
        const swirlMat = mat(new THREE.MeshBasicMaterial({ map: tex(TEX.swirl()), transparent: true, depthWrite: false }));
        const pitMat = mat(new THREE.MeshBasicMaterial({ map: tex(TEX.pit()) }));
        const gemGeo = geo(new THREE.OctahedronGeometry(0.12, 0));
        const gemMat = mat(new THREE.MeshBasicMaterial({ color: 0xfff080 }));
        const pedestal = geo(new THREE.CylinderGeometry(0.22, 0.3, 0.42, 8));

        for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
            const c = rows[z][x];
            const key = `${x},${z}`;
            const open = isOpen(x, z);
            let obj = null;
            if (c === "D" || c === "L") {
                const mesh = new THREE.Mesh(box, c === "L" ? lockMat : doorMat);
                mesh.position.set(x, open ? 1.5 : 0.5, z);
                mesh.visible = !open;
                obj = { type: "door", mesh };
            } else if (c === "?") {
                const mesh = new THREE.Mesh(box, wallMat);
                mesh.position.set(x, open ? -0.5 : 0.5, z);
                mesh.visible = !open;
                obj = { type: "hidden", mesh };
            } else if (c === "T" || c === "k" || c === "H") {
                const group = new THREE.Group();
                const m = c === "H" ? heartMat : chestMat;
                const body = new THREE.Mesh(chestBody, m);
                body.position.y = 0.13;
                const lidPivot = new THREE.Group();
                lidPivot.position.set(0, 0.26, -0.16);
                const lid = new THREE.Mesh(chestLid, m);
                lidPivot.add(lid);
                group.add(body, lidPivot);
                // 正面を通路側に向ける(開いている隣のマス)
                const face = [0, 1, 2, 3].find((d) => !"#?".includes(at(x + DIRS[d][0], z + DIRS[d][1])));
                group.rotation.y = face === undefined ? 0 : -face * Math.PI / 2 + Math.PI;
                group.position.set(x, 0, z);
                if (open) lidPivot.rotation.x = -1.9;
                obj = { type: "chest", mesh: group, lid: lidPivot, mimic: !open && !!info(x, z).mimic };
            } else if (c === "S") {
                const mesh = new THREE.Mesh(flat, stairsMat);
                mesh.position.set(x, 0.004, z);
                obj = { type: "stairs", mesh };
            } else if (c === "^") {
                const mesh = new THREE.Mesh(flat, trapMat);
                mesh.position.set(x, 0.004, z);
                mesh.visible = open; // 作動するまで見えない
                obj = { type: "trap", mesh };
            } else if (c === "F") {
                const group = new THREE.Group();
                const b = new THREE.Mesh(basin, stoneMat);
                b.position.y = 0.11;
                const wtr = new THREE.Mesh(waterDisc, waterMat);
                wtr.position.y = 0.2;
                group.add(b, wtr);
                group.position.set(x, 0, z);
                fountainLight = new THREE.PointLight(0x60b0ff, 1.4, 3.2, 1.5);
                fountainLight.position.set(x, 0.5, z);
                scene.add(fountainLight);
                obj = { type: "fountain", mesh: group, water: waterTex };
            }
            else if (c === "P") {
                const mesh = new THREE.Mesh(flat, pitMat);
                mesh.scale.set(1.1, 1, 1.1);
                mesh.position.set(x, 0.005, z);
                obj = { type: "pit", mesh };
            } else if (c === "R") {
                const mesh = new THREE.Mesh(flat, swirlMat);
                mesh.position.set(x, 0.006, z);
                obj = { type: "rotate", mesh };
            } else if (c === "A") {
                const group = new THREE.Group();
                const ped = new THREE.Mesh(pedestal, stoneMat);
                ped.position.y = 0.21;
                const gem = new THREE.Mesh(gemGeo, gemMat);
                gem.position.y = 0.6;
                group.add(ped, gem);
                group.position.set(x, 0, z);
                const l = new THREE.PointLight(0xfff0a0, 1.8, 3.5, 1.4);
                l.position.set(x, 0.6, z);
                scene.add(l);
                obj = { type: "altar", mesh: group, gem };
            }
            if (obj) { scene.add(obj.mesh); objects.set(key, obj); }
        }

        scene.add(new THREE.AmbientLight(0xffffff, 0.12));
        torch = new THREE.PointLight(th.light, 2.2, 6, 1.4);
        scene.add(torch);
        return { w, h, fountainLight };
    }

    function place(x, z, dir) {
        Object.assign(cam, { x, z, dir, fx: x, fz: z, fa: angleOf(dir), from: null, t: 1 });
    }
    function startMove(toX, toZ, toDir, dur) {
        cam.from = { x: cam.fx, z: cam.fz, a: cam.fa };
        cam.to = { x: toX, z: toZ, a: cam.from.a + shortest(angleOf(toDir) - cam.from.a) };
        cam.x = toX; cam.z = toZ; cam.dir = toDir;
        cam.t = 0; cam.dur = dur;
    }
    const busy = () => cam.t < 1 || cam.sink > 0;

    /** 前後・横に1マス。canEnter(x, z) が false なら動かない */
    function step(forward, side, canEnter) {
        if (busy()) return null;
        const [dx, dz] = DIRS[cam.dir];
        const [sx, sz] = DIRS[(cam.dir + 1) % 4];
        const nx = cam.x + dx * forward + sx * side, nz = cam.z + dz * forward + sz * side;
        if (!canEnter(nx, nz)) return { ok: false, x: nx, z: nz };
        startMove(nx, nz, cam.dir, 0.18);
        return { ok: true, x: nx, z: nz };
    }
    function turn(d) {
        if (busy()) return false;
        startMove(cam.x, cam.z, (cam.dir + d + 4) % 4, 0.15);
        return true;
    }
    /** 目の前のマス */
    function front() {
        const [dx, dz] = DIRS[cam.dir];
        return { x: cam.x + dx, z: cam.z + dz };
    }

    // 開く動き(扉は上へ、隠し壁は床へ沈む、宝箱はふたが開く、罠は姿を現す)
    const anims = [];
    function open(x, z) {
        const o = objects.get(`${x},${z}`);
        if (!o) return;
        if (o.type === "door") anims.push({ t: 0, dur: 0.45, f: (e) => { o.mesh.position.y = 0.5 + e; if (e >= 1) o.mesh.visible = false; } });
        if (o.type === "hidden") anims.push({ t: 0, dur: 0.8, f: (e) => { o.mesh.position.y = 0.5 - e; if (e >= 1) o.mesh.visible = false; } });
        if (o.type === "chest") { o.opening = true; o.mimic = false; anims.push({ t: 0, dur: 0.35, f: (e) => { o.lid.rotation.x = -1.9 * e; } }); }
        if (o.type === "trap") o.mesh.visible = true;
    }
    function shake(amount = 0.06) { cam.shake = amount; }
    /** 落とし穴を飛び越える: 2マス先へ、放物線で */
    function jump(toX, toZ) {
        cam.from = { x: cam.fx, z: cam.fz, a: cam.fa };
        cam.to = { x: toX, z: toZ, a: cam.fa };
        cam.x = toX; cam.z = toZ;
        cam.t = 0; cam.dur = 0.55; cam.arc = 0.32;
    }
    /** 落とし穴に落ちる: いったん沈んで、元のマスに戻る */
    function fall(backX, backZ, onDone) {
        cam.sink = 0.0001; cam.sinkBack = [backX, backZ]; cam.sinkDone = onDone;
    }
    /** 回転床: その場で何回か回って、ランダムな向きで止まる */
    function spin(toDir) {
        cam.from = { x: cam.fx, z: cam.fz, a: cam.fa };
        cam.to = { x: cam.x, z: cam.z, a: cam.fa - Math.PI * 4 + shortest(angleOf(toDir) - cam.fa) };
        cam.dir = toDir;
        cam.t = 0; cam.dur = 0.9;
    }

    let time = 0;
    let lightBoost = false; // ルミナ: たいまつの光が強く遠くまで届く
    function update(dt) {
        if (!scene) return;
        time += dt;
        if (cam.t < 1 && cam.from) {
            cam.t = Math.min(1, cam.t + dt / cam.dur);
            const e = cam.t < 0.5 ? 2 * cam.t * cam.t : 1 - Math.pow(-2 * cam.t + 2, 2) / 2;
            cam.fx = cam.from.x + (cam.to.x - cam.from.x) * e;
            cam.fz = cam.from.z + (cam.to.z - cam.from.z) * e;
            cam.fa = cam.from.a + (cam.to.a - cam.from.a) * e;
        }
        for (let i = anims.length - 1; i >= 0; i--) {
            const a = anims[i];
            a.t = Math.min(1, a.t + dt / a.dur);
            a.f(a.t);
            if (a.t >= 1) anims.splice(i, 1);
        }
        let bob = cam.t < 1 ? Math.sin(cam.t * Math.PI) * (cam.arc || 0.025) : 0;
        if (cam.t >= 1) cam.arc = 0;
        if (cam.sink > 0) {
            cam.sink += dt;
            const e = cam.sink / 0.7;
            bob = e < 0.5 ? -Math.pow(e * 2, 2) * 0.55 : -0.55 * (1 - (e - 0.5) * 2);
            if (e >= 0.5 && cam.sinkBack) { const [bx, bz] = cam.sinkBack; cam.x = bx; cam.z = bz; cam.fx = bx; cam.fz = bz; cam.sinkBack = null; }
            if (e >= 1) { cam.sink = 0; const d = cam.sinkDone; cam.sinkDone = null; d?.(); }
        }
        const sh = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
        cam.shake = Math.max(0, cam.shake - dt * 0.25);
        camera.position.set(cam.fx + sh, 0.5 + bob + sh * 0.5, cam.fz);
        camera.rotation.set(0, cam.fa, 0);
        torch.position.set(cam.fx, 0.55, cam.fz);
        torch.intensity = (2.1 + Math.sin(time * 9) * 0.12 + Math.sin(time * 23.7) * 0.08) * (lightBoost ? 1.5 : 1);
        torch.distance = lightBoost ? 10 : theme?.dark ? 3 : 6;
        if (scene.fog) scene.fog.far = theme?.dark ? (lightBoost ? 6 : 2.3) : (lightBoost ? 8.5 : 5.2);
        // 水のゆらぎ
        objects.forEach((o) => {
            if (o.water) o.water.offset.set(Math.sin(time) * 0.1, time * 0.08);
            if (o.gem) { o.gem.rotation.y = time * 1.5; o.gem.position.y = 0.6 + Math.sin(time * 2) * 0.03; }
            if (o.type === "rotate") o.mesh.rotation.y = time * 1.2;
            // ミミック: ときどきふたがピクッと動く(よく見ると分かる)
            if (o.mimic && o.lid && !o.opening) { const ph = (time + o.mesh.position.x * 1.7) % 4.2; o.lid.rotation.x = ph < 0.25 ? -Math.sin(ph / 0.25 * Math.PI) * 0.12 : 0; }
        });
        torches.forEach((tc) => { const f = 1 + Math.sin(time * 14 + tc.ph) * 0.12 + Math.sin(time * 31 + tc.ph) * 0.06; tc.fl.scale.set(0.11 * f, 0.13 * (2 - f), 1); tc.halo.scale.set(0.5 * f, 0.5 * f, 1); });
        if (floorWater) floorWater.offset.set(Math.sin(time * 0.7) * 0.02, theme?.glowFloor ? time * 0.01 : 0);
    }
    function render() { if (scene) renderer.render(scene, camera); }

    function dispose() {
        disposeFloor();
        renderer.renderLists.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
    }

    return { spin, jump, fall, renderer, camera, cam, getScene: () => scene, setLightBoost: (on) => { lightBoost = !!on; }, loadFloor, place, step, turn, front, open, shake, busy, update, render, dispose };
}

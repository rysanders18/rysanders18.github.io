/* Cookie: browser port of the Harder Hat cookie-clicker secret.
   The rules, tables, timings and chat text are lifted directly from the
   MSC scripts (Cookie.nms and the Cookie/ folder); only the rendering is
   new. Coordinates are kept in world units: the cookie sits at
   x = -9149.5, y = 100.5, one block = 80px, and the scene shows fifteen
   columns (x -9157..-9143) and seven rows (y 99..105) of the back wall. */

(() => {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Tables (Cookie.nms)                                                 */
  /* ------------------------------------------------------------------ */

  const T = {
    diamondPrices: [1000, 2000, 4000, 20000, 80000, 250000, 450000, 900000, 1600000, 3000000, 5000000, 7500000, 10000000],
    diamondChances: [100, 75, 50, 40, 32, 25, 20, 15, 10, 7, 5, 4, 3],
    goldenPrices: [100, 250, 1000, 3000, 7000, 12000, 25000, 50000, 125000, 250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000],
    goldenChances: [40, 30, 25, 20, 17, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    multiplierPrices: Array.from({ length: 500 }, (_, i) => 10 + 5 * i * (i + 1)),
    multiplierMultipliers: Array.from({ length: 500 }, (_, i) => i + 2),
    cooldownPrices: [10, 25, 100, 400, 800, 1300, 2000, 3000, 5000, 10000, 20000],
    cooldownCooldowns: [400, 300, 225, 175, 125, 100, 80, 65, 55, 51, 50],
    netheritePrice: 100000000,
    milkDurationPrices: [50000, 100000, 175000, 250000, 400000, 600000, 800000, 1150000, 1500000, 2000000],
    milkDurationDurations: [6, 7, 8, 9, 10, 12, 14, 16, 18, 20],
    milkMultiplierPrices: [100000, 200000, 400000, 600000, 900000, 1200000, 1500000, 2000000, 3500000, 5000000, 7500000],
    milkMultiplierMultipliers: [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20],
    milkUnlockPrice: 15000,
  };

  /* Golden cookie slots: (x, y) around the cookie, in the script's order */
  const GOLDEN_SLOTS = [
    [-9148.5, 101.5], [-9149.5, 101.5], [-9150.5, 101.5],
    [-9148.5, 100.5], [-9150.5, 100.5],
    [-9148.5, 99.5], [-9149.5, 99.5], [-9150.5, 99.5],
    [-9147.5, 101.5], [-9151.5, 101.5],
    [-9147.5, 100.5], [-9151.5, 100.5],
    [-9147.5, 99.5], [-9151.5, 99.5],
  ];

  /* Button positions (checkIfNewUpgrade.msc order) */
  const BUTTONS = [
    { key: "diamond", x: -9153, y: 102 },
    { key: "golden", x: -9153, y: 101 },
    { key: "multiplier", x: -9153, y: 100 },
    { key: "cooldown", x: -9153, y: 99 },
    { key: "netherite", x: -9147, y: 102 },
    { key: "milkDuration", x: -9147, y: 101 },
    { key: "milkMultiplier", x: -9147, y: 100 },
    { key: "milkUnlock", x: -9147, y: 99 },
  ];

  /* milkAnimation.msc, one entry per @delay group:
     [x, y, z, brown block, white block]. z 9300 = wall, y 98 = floor. */
  const MILK_STEPS = [
    [[-9150, 100, 9300, "brown_concrete_powder", "snow"]],
    [
      [-9149, 100, 9300, "brown_wool", "white_wool"],
      [-9150, 101, 9300, "brown_wool", "white_wool"],
      [-9151, 100, 9300, "brown_wool", "white_wool"],
      [-9150, 99, 9300, "brown_wool", "white_wool"],
    ],
    [
      [-9148, 100, 9300, "brown_concrete", "stripped_pale_oak_log"],
      [-9149, 101, 9300, "brown_concrete", "stripped_pale_oak_log"],
      [-9150, 102, 9300, "brown_concrete", "stripped_pale_oak_log"],
      [-9151, 101, 9300, "brown_concrete", "stripped_pale_oak_log"],
      [-9152, 100, 9300, "brown_concrete", "stripped_pale_oak_log"],
      [-9151, 99, 9300, "brown_concrete", "stripped_pale_oak_log"],
      [-9149, 99, 9300, "brown_concrete", "stripped_pale_oak_log"],
      [-9150, 98, 9301, "brown_wool", "white_wool"],
    ],
    [
      [-9148, 99, 9300, "brown_terracotta", "smooth_quartz"],
      [-9148, 101, 9300, "brown_terracotta", "smooth_quartz"],
      [-9149, 102, 9300, "brown_terracotta", "smooth_quartz"],
      [-9150, 103, 9300, "brown_terracotta", "smooth_quartz"],
      [-9151, 102, 9300, "brown_terracotta", "smooth_quartz"],
      [-9152, 101, 9300, "brown_terracotta", "smooth_quartz"],
      [-9152, 99, 9300, "brown_terracotta", "smooth_quartz"],
      [-9151, 98, 9301, "brown_concrete", "stripped_pale_oak_log_z"],
      [-9150, 98, 9302, "brown_wool", "white_wool"],
      [-9149, 98, 9301, "brown_concrete", "stripped_pale_oak_log_z"],
    ],
    [
      [-9148, 102, 9300, "dark_oak_planks", "bone_block"],
      [-9149, 103, 9300, "dark_oak_planks", "bone_block"],
      [-9150, 104, 9300, "dark_oak_planks", "bone_block"],
      [-9151, 103, 9300, "dark_oak_planks", "bone_block"],
      [-9152, 102, 9300, "dark_oak_planks", "bone_block"],
      [-9152, 98, 9301, "brown_terracotta", "smooth_quartz"],
      [-9151, 98, 9302, "brown_concrete", "stripped_pale_oak_log_z"],
      [-9150, 98, 9303, "brown_concrete", "stripped_pale_oak_log_z"],
      [-9149, 98, 9302, "brown_concrete", "stripped_pale_oak_log_z"],
      [-9148, 98, 9301, "brown_terracotta", "smooth_quartz"],
    ],
    [
      [-9148, 103, 9300, "dark_oak_log", "bone_block"],
      [-9152, 103, 9300, "dark_oak_log", "bone_block"],
      [-9148, 98, 9302, "brown_terracotta", "smooth_quartz"],
      [-9149, 98, 9303, "brown_terracotta", "smooth_quartz"],
      [-9150, 98, 9304, "brown_concrete", "stripped_pale_oak_log_z"],
      [-9151, 98, 9303, "brown_terracotta", "smooth_quartz"],
      [-9152, 98, 9302, "brown_terracotta", "smooth_quartz"],
    ],
    [
      [-9151, 98, 9304, "brown_terracotta", "smooth_quartz"],
      [-9150, 98, 9305, "brown_terracotta", "smooth_quartz"],
      [-9149, 98, 9304, "brown_terracotta", "smooth_quartz"],
    ],
    [[-9150, 98, 9306, "brown_terracotta", "smooth_quartz"]],
  ];

  /* ------------------------------------------------------------------ */
  /* Scene geometry                                                      */
  /* ------------------------------------------------------------------ */

  const B = 80; // px per block
  const X0 = -9157; // world x of the left-most column
  const YTOP = 105; // world y of the top-most wall row
  const WALL_ROWS = 7; // y 99..105
  const COLS = 15;
  const FLOOR_ROWS = 8; // z 9301..9308
  const COOKIE = { x: -9149.5, y: 100.5 };

  const px = (wx) => (wx - X0) * B; // world x → scene x
  const py = (wy) => (YTOP + 1 - wy) * B; // world y → scene y (a block y spans py(y+1)..py(y))
  const cx = (wx) => px(wx); // centre of an entity at wx
  const cy = (wy) => py(wy); // centre of an entity at wy

  /* ------------------------------------------------------------------ */
  /* Procedural block textures                                           */
  /* ------------------------------------------------------------------ */

  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  const TEX = {
    brown_concrete_powder: { base: "#6b4626", noise: 0.22, grain: true },
    brown_wool: { base: "#734a2a", noise: 0.08, pattern: "wool" },
    brown_concrete: { base: "#5f3a1d", noise: 0.05 },
    brown_terracotta: { base: "#4e3323", noise: 0.1 },
    dark_oak_planks: { base: "#43290f", noise: 0.06, pattern: "planks" },
    dark_oak_log: { base: "#3a2610", noise: 0.08, pattern: "logv" },
    snow: { base: "#f6fbfb", noise: 0.03 },
    white_wool: { base: "#e9ecec", noise: 0.05, pattern: "wool" },
    stripped_pale_oak_log: { base: "#e4dac6", noise: 0.05, pattern: "logv" },
    stripped_pale_oak_log_z: { base: "#e4dac6", noise: 0.05, pattern: "logh" },
    smooth_quartz: { base: "#ede9e3", noise: 0.02 },
    bone_block: { base: "#dedac4", noise: 0.04, pattern: "bone" },
    diamond_block: { base: "#62e2da", noise: 0.03, pattern: "gem", edge: "#3fb4ae", light: "#a9f4ef" },
    gold_block: { base: "#f7cf3f", noise: 0.03, pattern: "gem", edge: "#c48f1e", light: "#fff0a0" },
    lapis_block: { base: "#2557b9", noise: 0.05, pattern: "gem", edge: "#183a7c", light: "#4f83e0" },
    redstone_block: { base: "#b8251a", noise: 0.06, pattern: "gem", edge: "#7c150e", light: "#e0483a" },
    netherite_block: { base: "#3c3538", noise: 0.06, pattern: "gem", edge: "#221d1f", light: "#524a4d" },
    emerald_block: { base: "#2ecc71", noise: 0.04, pattern: "gem", edge: "#1a9a50", light: "#7de8a8" },
    quartz_block: { base: "#ebe5dd", noise: 0.03, pattern: "gem", edge: "#d5cfc5", light: "#f8f5f0" },
    stone_bricks: { base: "#7b7b7b", noise: 0.08, pattern: "bricks" },
    tuff: { base: "#5b5d57", noise: 0.14, grain: true },
    deepslate: { base: "#4b4b4f", noise: 0.1, pattern: "logv" },
    stone: { base: "#8a8a8a", noise: 0.08 },
    smooth_stone: { base: "#a0a0a0", noise: 0.04, pattern: "slab" },
    glass: { base: "#d3eef1", noise: 0.01, pattern: "glass" },
  };

  const texCache = {};
  function texture(name) {
    if (texCache[name]) return texCache[name];
    const spec = TEX[name];
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const g = c.getContext("2d");
    const img = g.createImageData(16, 16);
    const d = img.data;
    const base = hex(spec.base);
    const edge = spec.edge ? hex(spec.edge) : null;
    const light = spec.light ? hex(spec.light) : null;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let col = base;
        let shade = 1 + (rnd() * 2 - 1) * spec.noise;
        if (spec.grain && rnd() < 0.15) shade *= 0.8;
        switch (spec.pattern) {
          case "planks": {
            const row = Math.floor(y / 4);
            const off = (row % 2) * 8;
            if (y % 4 === 0) shade *= 0.6;
            if ((x + off) % 16 === 0) shade *= 0.6;
            break;
          }
          case "logv":
            if (x % 4 === 0) shade *= 0.8;
            if (x % 4 === 2) shade *= 1.06;
            break;
          case "logh":
            if (y % 4 === 0) shade *= 0.8;
            if (y % 4 === 2) shade *= 1.06;
            break;
          case "bone":
            if (x % 4 === 3) shade *= 0.82;
            if (y === 0 || y === 15) shade *= 0.85;
            break;
          case "wool":
            if ((x + y) % 4 === 0) shade *= 0.93;
            break;
          case "bricks": {
            const row = Math.floor(y / 4);
            const off = (row % 2) * 4;
            if (y % 4 === 3 || (x + off) % 8 === 7) shade *= 0.6;
            break;
          }
          case "slab":
            if (y === 7 || y === 8) shade *= 0.75;
            break;
          case "glass":
            if (x === 0 || y === 0 || x === 15 || y === 15) shade *= 0.72;
            else if (x < 6 && y < 6 && x + y > 5) shade *= 1.15;
            break;
          case "gem":
            if (x === 0 || y === 0 || x === 15 || y === 15) col = edge;
            else if (x === 1 || y === 1) col = light;
            else if (x === 14 || y === 14) col = edge;
            else if (x >= 4 && x <= 11 && y >= 4 && y <= 11) {
              if (x === 4 || y === 4) col = light;
              else if (x === 11 || y === 11) col = edge;
            }
            break;
        }
        const i = (y * 16 + x) * 4;
        d[i] = Math.max(0, Math.min(255, col[0] * shade));
        d[i + 1] = Math.max(0, Math.min(255, col[1] * shade));
        d[i + 2] = Math.max(0, Math.min(255, col[2] * shade));
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    texCache[name] = c.toDataURL();
    return texCache[name];
  }

  /* ------------------------------------------------------------------ */
  /* Item sprites                                                        */
  /* ------------------------------------------------------------------ */

  const SPRITES = {
    cookie: {
      pal: { "#": "#7a4a1e", o: "#d4985e", "@": "#3d2410", p: "#e5b47c" },
      rows: [
        "................",
        "....########....",
        "..##opoooooo##..",
        ".#ooo@oooooooo#.",
        ".#oooooo@ooopo#.",
        "#opo@ooooooooo#.",
        "#ooooooo@ooooo#.",
        "#oo@ooopooo@oo#.",
        "#oooooo@oooooo#.",
        "#op@oooooooooo#.",
        ".#oooo@ooo@ooo#.",
        ".#oopoooooooo#..",
        "..##ooo@ooo##...",
        "....########....",
        "................",
        "................",
      ],
    },
    golden_apple: {
      pal: { s: "#4a2a0e", g: "#e8b52a", G: "#fff08a", d: "#a87a12", l: "#5aa833" },
      rows: [
        "......ss........",
        "......s.l.......",
        "....ddggddd.....",
        "...dgGggggggd...",
        "..dgGGgggggggd..",
        "..dGGggggggggd..",
        "..dGgggggggggd..",
        "..dgggggggggggd.",
        "..dgggggggggggd.",
        "..dggggggggggd..",
        "...dgggggggggd..",
        "...dggggggggd...",
        "....dgggggggd...",
        ".....ddd.ddd....",
        "................",
        "................",
      ],
    },
    diamond: {
      pal: { d: "#2b8f8a", D: "#5fe0d6", L: "#c8fff9", e: "#1f6b68" },
      rows: [
        "................",
        "....dDDDDDd.....",
        "...dDDLLLDDd....",
        "..dDLLLLLLDDd...",
        ".dDLLLLLLLDDDd..",
        ".dDLLLLLLDDDDe..",
        "..dDLLLLDDDDe...",
        "..dDDLLLDDDDe...",
        "...dDDDDDDDe....",
        "....dDDDDDe.....",
        ".....dDDDe......",
        "......dDe.......",
        ".......e........",
        "................",
        "................",
        "................",
      ],
    },
    milk_bucket: {
      pal: { h: "#3c3c3c", w: "#ffffff", b: "#9c9c9c", B: "#6f6f6f", c: "#c4c4c4" },
      rows: [
        "................",
        "....hhhhhhhh....",
        "...h........h...",
        "..h..........h..",
        "..h.wwwwwwww.h..",
        "..hwwwwwwwwwwh..",
        "..hcbbbbbbbbbh..",
        "..hcbbbbbbbbBh..",
        "..hcbbbbbbbbBh..",
        "..hBbbbbbbbbBh..",
        "...hBbbbbbbBh...",
        "...hBBbbbbBBh...",
        "....hhhhhhhh....",
        "................",
        "................",
        "................",
      ],
    },
    bucket: {
      pal: { h: "#3c3c3c", b: "#9c9c9c", B: "#6f6f6f", c: "#c4c4c4", i: "#4a4a4a" },
      rows: [
        "................",
        "....hhhhhhhh....",
        "...h........h...",
        "..h..........h..",
        "..h.cccccccc.h..",
        "..hciiiiiiiich..",
        "..hcbbbbbbbbbh..",
        "..hcbbbbbbbbBh..",
        "..hcbbbbbbbbBh..",
        "..hBbbbbbbbbBh..",
        "...hBbbbbbbBh...",
        "...hBBbbbbBBh...",
        "....hhhhhhhh....",
        "................",
        "................",
        "................",
      ],
    },
  };

  const spriteCache = {};
  function sprite(name) {
    if (spriteCache[name]) return spriteCache[name];
    const s = SPRITES[name];
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const g = c.getContext("2d");
    s.rows.forEach((row, y) => {
      for (let x = 0; x < 16; x++) {
        const ch = row[x];
        if (ch === "." || !s.pal[ch]) continue;
        g.fillStyle = s.pal[ch];
        g.fillRect(x, y, 1, 1);
      }
    });
    spriteCache[name] = c.toDataURL();
    return spriteCache[name];
  }
  const spriteColors = (name) => Object.values(SPRITES[name].pal);

  /* ------------------------------------------------------------------ */
  /* Sound (synthesised stand-ins for the Minecraft sounds)              */
  /* ------------------------------------------------------------------ */

  let actx = null;
  let muted = false;
  try {
    muted = localStorage.getItem("harha-cookie-muted") === "1";
  } catch (e) {
    /* ignore */
  }

  function audio() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }

  const note = (i) => Math.pow(2, (i - 12) / 12); // Harha::musicNotes
  const rand = (a, b) => a + Math.random() * (b - a);

  function tone(type, freq, vol, dur, opts = {}) {
    const a = audio();
    if (!a || muted) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    const t = a.currentTime + (opts.delay || 0);
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(vol, dur, opts = {}) {
    const a = audio();
    if (!a || muted) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = opts.type || "bandpass";
    f.frequency.value = opts.freq || 1200;
    f.Q.value = opts.q || 0.8;
    const g = a.createGain();
    const t = a.currentTime + (opts.delay || 0);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }

  const SFX = {
    pling: (vol, pitch) => tone("sine", 880 * pitch, vol * 0.5, 0.6),
    chime: (vol, pitch) => {
      tone("triangle", 1046 * pitch, vol * 0.35, 0.9);
      tone("sine", 2093 * pitch, vol * 0.12, 0.5);
    },
    didgeridoo: (vol, pitch) => tone("sawtooth", 65 * pitch, vol * 0.35, 0.45, { slide: 50 * pitch }),
    eat: (vol, pitch) => {
      noise(vol * 0.5, 0.06, { freq: 900 * pitch, q: 0.6 });
      noise(vol * 0.35, 0.05, { freq: 1300 * pitch, q: 0.6, delay: 0.09 });
    },
    egg: (vol, pitch) => noise(vol * 0.45, 0.04, { freq: 2600 * pitch, q: 1.5 }),
    netheriteHit: (vol, pitch) => {
      tone("square", 420 * pitch, vol * 0.18, 0.06);
      noise(vol * 0.3, 0.04, { freq: 3000 * pitch, q: 1.2 });
    },
    levelup: (vol, pitch) => {
      [0, 4, 7, 12].forEach((n, i) => tone("sine", 660 * pitch * Math.pow(2, n / 12), vol * 0.35, 0.35, { delay: i * 0.07 }));
    },
    cat: (vol, pitch) => tone("sawtooth", 500 * pitch, vol * 0.12, 0.3, { slide: 750 * pitch, attack: 0.05 }),
    burp: (vol, pitch) => tone("sawtooth", 150 * pitch, vol * 0.25, 0.25, { slide: 80 * pitch }),
    firework: (vol, pitch) => noise(vol * 0.5, 0.35, { type: "lowpass", freq: 1600 * pitch, q: 0.5 }),
    firecharge: (vol, pitch) => noise(vol * 0.4, 0.25, { freq: 700 * pitch, q: 0.7 }),
    drinkMilk: (vol, pitch) => {
      [0, 0.12, 0.24].forEach((d) => tone("sine", 220 * pitch, vol * 0.3, 0.1, { delay: d, slide: 330 * pitch }));
    },
    goatMilk: (vol, pitch) => tone("triangle", 330 * pitch, vol * 0.3, 0.16, { slide: 260 * pitch }),
    goatScream: (vol, pitch) => tone("sawtooth", 380 * pitch, vol * 0.2, 0.5, { slide: 300 * pitch, attack: 0.03 }),
    witchDrink: (vol, pitch) => {
      [0, 0.15, 0.3].forEach((d) => tone("sine", 180 * pitch, vol * 0.3, 0.12, { delay: d, slide: 260 * pitch }));
    },
    toast: (vol, pitch) => {
      [0, 7, 12, 19].forEach((n, i) => tone("triangle", 523 * pitch * Math.pow(2, n / 12), vol * 0.3, 0.5, { delay: i * 0.12 }));
    },
    enderTeleport: (vol, pitch) => tone("sine", 300 * pitch, vol * 0.3, 0.5, { slide: 1200 * pitch }),
  };

  /* ------------------------------------------------------------------ */
  /* State (relative variables in Cookie.nms)                            */
  /* ------------------------------------------------------------------ */

  const SAVE_KEY = "harha-cookie-save";

  function freshState() {
    return {
      cookieCount: 0,
      timeSinceLastCookie: 10000,
      cookiesClicked: 0,
      totalCookiesEarned: 0,
      cookieLog: new Array(100).fill(0),
      cookieLogTimes: new Array(100).fill(0),
      cookieCooldown: 1000,
      cooldownStage: 0,
      lastAverageCPS: 0,
      cookieMultiplier: 1,
      multiplierStage: 0,
      goldenCookieChance: 50,
      goldenCookieMultiplier: 20,
      goldenCookieChanceStage: 0,
      goldenCookiesClicked: 0,
      diamondCookieChance: 500,
      diamondCookieChanceStage: 0,
      diamondCookiesClicked: 0,
      goldenCookieLocations: new Array(14).fill(false),
      diamondCookieLocations: new Array(14).fill(false),
      milkUnlocked: false,
      milkActivated: false,
      milkDuration: 5,
      milkDurationStage: 0,
      milkMultiplier: 2,
      milkMultiplierStage: 0,
      lastMilkActivationTime: -1e13,
      netheriteUnlocked: false,
    };
  }

  let S = freshState();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const fresh = freshState();
      for (const k of Object.keys(fresh)) if (k in saved) fresh[k] = saved[k];
      S = fresh;
    } catch (e) {
      /* ignore a bad save */
    }
  }

  let saveTimer = null;
  function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(S));
      } catch (e) {
        /* ignore */
      }
    }, 400);
  }

  const now = () => Date.now();
  const fmt = (n) => Math.trunc(n).toLocaleString("en-US");
  const rollOne = (chance) => Math.floor(Math.random() * chance) === 1; // Int(math::random(0, chance)) == 1

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);
  const scene = $("scene");
  const wallEl = $("wall");
  const floorEl = $("floor");
  const entEl = $("entities");
  const fx = $("fx");
  const fxg = fx.getContext("2d");
  const chatEl = $("chat");
  const actionbarEl = $("actionbar");

  const wallCells = {}; // "x,y" → element
  const floorCells = {}; // "x,z" → element

  function setBlock(el, name) {
    el.style.backgroundImage = `url(${texture(name)})`;
    el.dataset.block = name;
  }

  function buildWall() {
    // Default block at each wall position
    const brown = {};
    for (const step of MILK_STEPS) for (const [x, y, z, b] of step) if (z === 9300) brown[`${x},${y}`] = b;

    for (let c = 0; c < COLS; c++) {
      const x = X0 + c;
      for (let r = 0; r < WALL_ROWS; r++) {
        const y = YTOP - r;
        const el = document.createElement("div");
        el.className = "cell";
        el.style.left = px(x) + "px";
        el.style.top = py(y + 1) + "px";
        let name;
        const inAlcove = x >= -9152 && x <= -9148;
        if (brown[`${x},${y}`]) {
          name = brown[`${x},${y}`];
          el.classList.add("alcove");
        } else if (inAlcove) {
          name = "stone_bricks";
          el.classList.add("alcove");
        } else if (x === -9153) {
          name = { 102: "diamond_block", 101: "gold_block", 100: "lapis_block", 99: "redstone_block" }[y] || "stone_bricks";
          if (y <= 102) el.classList.add("col-left");
        } else if (x === -9147) {
          name = { 102: "netherite_block", 101: "emerald_block", 100: "quartz_block", 99: "quartz_block" }[y] || "stone_bricks";
          if (y <= 102) el.classList.add("col-right");
        } else if (x === -9154 || x === -9146) {
          name = "deepslate";
          el.classList.add("dim");
        } else {
          name = "tuff";
          el.classList.add(y >= 104 ? "dimmer" : "dim");
        }
        setBlock(el, name);
        wallEl.appendChild(el);
        wallCells[`${x},${y}`] = el;
      }
    }
  }

  function buildFloor() {
    const brown = {};
    for (const step of MILK_STEPS) for (const [x, y, z, b] of step) if (y === 98) brown[`${x},${z}`] = b;

    for (let c = 0; c < COLS; c++) {
      const x = X0 + c;
      for (let r = 0; r < FLOOR_ROWS; r++) {
        const z = 9301 + r;
        const el = document.createElement("div");
        el.className = "cell";
        el.style.left = px(x) + "px";
        el.style.top = r * B + "px";
        let name;
        if (brown[`${x},${z}`]) name = brown[`${x},${z}`];
        else if (x === -9150 && z >= 9303) name = "brown_concrete";
        else if ((x === -9151 || x === -9149) && z >= 9303) name = "brown_terracotta";
        else if (x >= -9152 && x <= -9148 && z <= 9302) name = "brown_terracotta";
        else if (x <= -9155 || x >= -9145) name = "glass";
        else name = "smooth_stone";
        if (name.startsWith("dark") || name === "brown_concrete") el.classList.add("dark");
        setBlock(el, name);
        floorEl.appendChild(el);
        floorCells[`${x},${z}`] = el;
      }
    }
  }

  /* Text displays */
  const tdCenter = document.createElement("div");
  tdCenter.className = "td center";
  const tdLeft = document.createElement("div");
  tdLeft.className = "td left";
  const tdRight = document.createElement("div");
  tdRight.className = "td right";

  /* Item displays */
  const cookieItem = document.createElement("div");
  cookieItem.className = "item";
  const milkItem = document.createElement("div");
  milkItem.className = "item";
  const goldenItems = new Array(14).fill(null);

  function setItem(el, name) {
    if (!name) {
      el.style.backgroundImage = "none";
      el.classList.remove("glint");
      el.dataset.item = "";
      return;
    }
    const url = `url(${sprite(name)})`;
    el.style.backgroundImage = url;
    el.style.setProperty("--mask", url);
    el.dataset.item = name;
    el.classList.toggle("glint", name === "golden_apple" || name === "diamond");
  }

  function place(el, wx, wy) {
    el.style.left = cx(wx) + "px";
    el.style.top = cy(wy) + "px";
  }

  const buttonEls = {};
  let milkUnlockButton = null;
  let resetButton = null;

  function buildEntities() {
    // Cookie
    place(cookieItem, COOKIE.x, COOKIE.y);
    setItem(cookieItem, "cookie");
    entEl.appendChild(cookieItem);

    // Milk item display at (-9146.5, 99.5)
    place(milkItem, -9146.5, 99.5);
    setItem(milkItem, null);
    entEl.appendChild(milkItem);

    // Text displays
    tdCenter.style.top = "0px";
    entEl.appendChild(tdCenter);
    tdLeft.style.left = "0px";
    tdLeft.style.width = px(-9153) - 14 + "px";
    tdLeft.style.top = "0px";
    entEl.appendChild(tdLeft);
    tdRight.style.left = px(-9146) + 14 + "px";
    tdRight.style.top = "0px";
    entEl.appendChild(tdRight);

    // Interaction entities: 5x3 grid around the cookie (goldens + the cookie)
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        const wx = -9147.5 - i;
        const wy = 101.5 - j;
        const hit = document.createElement("div");
        hit.className = "hit";
        place(hit, wx, wy);
        const slot = GOLDEN_SLOTS.findIndex(([sx, sy]) => sx === wx && sy === wy);
        if (wx === COOKIE.x && wy === COOKIE.y) {
          hit.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            clickCookie();
          });
        } else {
          hit.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            clickGolden(slot);
          });
        }
        entEl.appendChild(hit);
      }
    }

    // Upgrade buttons
    for (const b of BUTTONS) {
      const el = document.createElement("div");
      el.className = "stone-button";
      el.style.left = px(b.x) + B / 2 - 15 + "px";
      el.style.top = py(b.y + 1) + B / 2 - 10 + "px";
      el.title = b.key;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.classList.add("pressed");
        setTimeout(() => el.classList.remove("pressed"), 120);
        pressButton(b.key);
      });
      entEl.appendChild(el);
      buttonEls[b.key] = el;
      if (b.key === "milkUnlock") milkUnlockButton = el;
    }

    // Milk interaction (activation) sits in front of the unlock button
    const milkHit = document.createElement("div");
    milkHit.className = "hit";
    milkHit.style.width = "64px";
    milkHit.style.height = "64px";
    milkHit.style.margin = "-32px 0 0 -32px";
    place(milkHit, -9146.5, 99.5);
    milkHit.addEventListener("pointerdown", (e) => {
      if (!S.milkUnlocked) return; // the stone button underneath handles unlocking
      e.preventDefault();
      e.stopPropagation();
      milkActivation();
    });
    entEl.appendChild(milkHit);

    // Reset button, tucked on the far left of the bottom row
    resetButton = document.createElement("div");
    resetButton.className = "stone-button";
    resetButton.style.left = px(-9157) + B / 2 - 15 + "px";
    resetButton.style.top = py(100) + B / 2 - 10 + "px";
    resetButton.title = "Reset";
    resetButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resetButton.classList.add("pressed");
      setTimeout(() => resetButton.classList.remove("pressed"), 120);
      resetPrompt();
    });
    entEl.appendChild(resetButton);
    const resetLabel = document.createElement("div");
    resetLabel.className = "td tiny";
    resetLabel.style.left = px(-9157) + "px";
    resetLabel.style.width = B + "px";
    resetLabel.style.top = py(100) + 8 + "px";
    resetLabel.style.textAlign = "center";
    resetLabel.textContent = "Reset";
    entEl.appendChild(resetLabel);
  }

  /* ------------------------------------------------------------------ */
  /* Particles                                                           */
  /* ------------------------------------------------------------------ */

  const particles = [];

  function spawnParticle(p) {
    particles.push(Object.assign({ life: 1, age: 0, size: 5, gravity: 220, alpha: 1, shape: "square" }, p));
  }

  /* MC-style: at entity, offsets in blocks, upward drift */
  function burst(wx, wy, n, colors, opts = {}) {
    for (let i = 0; i < n; i++) {
      spawnParticle({
        x: cx(wx) + rand(-0.35, 0.35) * B,
        y: cy(wy) + rand(-0.3, 0.3) * B,
        vx: rand(-40, 40),
        vy: -rand(50, 130),
        gravity: opts.gravity ?? 200,
        life: rand(0.6, 1.1),
        size: opts.size ?? rand(4, 7),
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: opts.shape || "square",
      });
    }
  }

  function particleLine(fromX, fromY, toX, toY, count, color) {
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      spawnParticle({
        x: cx(fromX) + (cx(toX) - cx(fromX)) * t,
        y: cy(fromY) + (cy(toY) - cy(fromY)) * t,
        vx: 0,
        vy: 0,
        gravity: 0,
        life: 0.9,
        size: 6,
        color,
        delay: t * 0.25,
      });
    }
  }

  let lastFrame = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastFrame) / 1000 || 0);
    lastFrame = ts;
    fxg.clearRect(0, 0, fx.width, fx.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      fxg.globalAlpha = a * (p.alpha ?? 1);
      fxg.fillStyle = p.color;
      if (p.shape === "circle") {
        fxg.beginPath();
        fxg.arc(p.x, p.y, p.size * (0.6 + 0.4 * a), 0, Math.PI * 2);
        fxg.fill();
      } else {
        const s = p.size * (0.5 + 0.5 * a);
        fxg.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    fxg.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  const COLORS = {
    cookie: spriteColors("cookie"),
    milk: spriteColors("milk_bucket"),
    goldBlock: ["#f7cf3f", "#c48f1e", "#fff0a0"],
    diamondBlock: ["#62e2da", "#3fb4ae", "#a9f4ef"],
    eggCrack: ["#e9d8a6", "#d9c48a"],
    cooldown: ["#ff0000", "#ff5208", "#ff3b00"],
  };

  /* ------------------------------------------------------------------ */
  /* Chat, action bar                                                    */
  /* ------------------------------------------------------------------ */

  const CODES = {
    0: "#000000", 1: "#0000AA", 2: "#00AA00", 3: "#00AAAA", 4: "#AA0000", 5: "#AA00AA", 6: "#FFAA00", 7: "#AAAAAA",
    8: "#555555", 9: "#5555FF", a: "#55FF55", b: "#55FFFF", c: "#FF5555", d: "#FF55FF", e: "#FFFF55", f: "#FFFFFF",
  };

  /* Turn "&c&lText &#d4d4d4more" into spans */
  function formatCodes(text) {
    const frag = document.createDocumentFragment();
    let color = "#FFFFFF";
    let bold = false;
    let buf = "";
    const flush = () => {
      if (!buf) return;
      const sp = document.createElement("span");
      sp.style.color = color;
      if (bold) sp.style.fontWeight = "bold";
      sp.textContent = buf;
      frag.appendChild(sp);
      buf = "";
    };
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "&" && i + 1 < text.length) {
        const c = text[i + 1];
        if (c === "#" && /^[0-9a-fA-F]{6}$/.test(text.slice(i + 2, i + 8))) {
          flush();
          color = "#" + text.slice(i + 2, i + 8);
          bold = false;
          i += 7;
          continue;
        }
        if (CODES[c.toLowerCase()]) {
          flush();
          color = CODES[c.toLowerCase()];
          bold = false;
          i++;
          continue;
        }
        if (c === "l") {
          flush();
          bold = true;
          i++;
          continue;
        }
        if (c === "r") {
          flush();
          bold = false;
          color = "#FFFFFF";
          i++;
          continue;
        }
      }
      buf += text[i];
    }
    flush();
    return frag;
  }

  function chat(text = "") {
    const line = document.createElement("div");
    line.className = "line";
    line.appendChild(formatCodes(text));
    chatEl.appendChild(line);
    while (chatEl.children.length > 10) chatEl.removeChild(chatEl.firstChild);
    setTimeout(() => line.classList.add("fade"), 10000);
    setTimeout(() => line.remove(), 10800);
  }

  let actionbarTimer = null;
  function actionbar(parts) {
    actionbarEl.textContent = "";
    for (const [text, color] of parts) {
      const sp = document.createElement("span");
      sp.style.color = color;
      sp.textContent = text;
      actionbarEl.appendChild(sp);
    }
    actionbarEl.classList.add("show");
    clearTimeout(actionbarTimer);
    actionbarTimer = setTimeout(() => actionbarEl.classList.remove("show"), 2000);
  }

  /* ------------------------------------------------------------------ */
  /* Text display updates                                                */
  /* ------------------------------------------------------------------ */

  const GRAD = ["#FFA53D", "#FEA343", "#FEA04A", "#FD9E50", "#FD9B57", "#FC995D", "#FB9663", "#FA9170"];
  function gradientSpan(text, from = "#FFA53D", to = "#FA9170") {
    const frag = document.createDocumentFragment();
    const a = hex(from);
    const b = hex(to);
    const n = Math.max(1, text.length - 1);
    for (let i = 0; i < text.length; i++) {
      const t = i / n;
      const sp = document.createElement("span");
      sp.style.color = `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
      sp.textContent = text[i];
      frag.appendChild(sp);
    }
    return frag;
  }

  function span(text, color, bold = true) {
    const sp = document.createElement("span");
    sp.style.color = color;
    if (!bold) sp.className = "n";
    sp.textContent = text;
    return sp;
  }

  function cookieTextUpdate() {
    const currentTime = now();
    const timeWindow = 10000;
    let oldestCookieValue = S.cookieCount;
    let oldestTime = currentTime;
    let currentCPS = 0;
    let foundOldest = false;

    const startPos = (S.cookiesClicked + 1) % 100;
    for (let offset = 0; offset < 99; offset++) {
      const i = (startPos + offset) % 100;
      if (S.cookieLogTimes[i] > 0 && currentTime - S.cookieLogTimes[i] <= timeWindow && !foundOldest) {
        oldestCookieValue = S.cookieLog[i];
        oldestTime = S.cookieLogTimes[i];
        foundOldest = true;
      }
    }
    if (foundOldest && oldestTime < currentTime) {
      currentCPS = (S.cookieCount - oldestCookieValue) / ((currentTime - oldestTime) / 1000);
    }
    let averageCPS = S.lastAverageCPS > 0 ? (currentCPS + S.lastAverageCPS * 5) / 6 : currentCPS;
    if (averageCPS < 0) averageCPS = 0;
    S.lastAverageCPS = averageCPS;

    renderCenter(averageCPS);
    save();
  }

  function milkStrings() {
    let s10 = "";
    let s11 = "";
    if (!S.milkUnlocked) return [s10, s11];
    const t = now();
    const clock = (ms) => {
      const seconds = Math.trunc(ms / 1000);
      const centi = Math.trunc((ms % 1000) / 10);
      if (seconds >= 0 && centi >= 0) return `${seconds}.${centi < 10 ? "0" : ""}${centi}s`;
      return "0.00s";
    };
    if (S.milkActivated) {
      s10 = "Milk Time Remaining: ";
      s11 = clock(S.milkDuration * 1000 - (t - S.lastMilkActivationTime));
    } else {
      const cooldownMillis = 45000 - (t - S.lastMilkActivationTime);
      s11 = clock(cooldownMillis);
      if (cooldownMillis > 0) s10 = "Milk Cooldown: ";
      else {
        s10 = "Milk Ready!";
        s11 = "";
      }
    }
    return [s10, s11];
  }

  let lastCPS = 0;
  function renderCenter(averageCPS) {
    if (averageCPS !== undefined) lastCPS = averageCPS;
    const [s10, s11] = milkStrings();
    tdCenter.textContent = "";
    tdCenter.appendChild(gradientSpan("Cookies"));
    tdCenter.appendChild(span(":", "#FA9170"));
    tdCenter.appendChild(span(` ${fmt(S.cookieCount)}\n`, "#D4D4D4"));
    tdCenter.appendChild(gradientSpan("Cookies Per Second"));
    tdCenter.appendChild(span(": ", "#FA9170"));
    tdCenter.appendChild(span(`${fmt(lastCPS)}\n`, "#D4D4D4"));
    tdCenter.appendChild(gradientSpan("Total Cookies Earned"));
    tdCenter.appendChild(span(": ", "#FA9170"));
    tdCenter.appendChild(span(`${fmt(S.totalCookiesEarned)}\n\n`, "#D4D4D4"));
    tdCenter.appendChild(span("Golden Cookies:", "#FFD125"));
    tdCenter.appendChild(span(` ${fmt(S.goldenCookiesClicked)}\n`, "#D4D4D4"));
    tdCenter.appendChild(span("Diamond Cookies:", "#37FFE7"));
    tdCenter.appendChild(span(` ${fmt(S.diamondCookiesClicked)}\n`, "#D4D4D4"));
    tdCenter.appendChild(span(`${s10} `, "#FFFFFF"));
    tdCenter.appendChild(span(`${s11}\n`, "#D4D4D4"));
    // bottom-anchored at y = 102.15
    tdCenter.style.top = py(102.15) - tdCenter.offsetHeight + "px";
  }

  function upgradeTextUpdate() {
    const s = {};
    if (S.diamondCookieChanceStage >= T.diamondChances.length) {
      s[3] = `Current: 1/${S.diamondCookieChance} → MAXED OUT!`;
      s[4] = "Price: MAXED OUT!";
    } else {
      s[3] = `Current: 1/${S.diamondCookieChance} → 1/${T.diamondChances[S.diamondCookieChanceStage]}`;
      s[4] = `Price: ${fmt(T.diamondPrices[S.diamondCookieChanceStage])} Cookies`;
    }
    if (S.goldenCookieChanceStage >= T.goldenChances.length) {
      s[5] = `Current: 1/${S.goldenCookieChance} → MAXED OUT!`;
      s[6] = "Price: MAXED OUT!";
    } else {
      s[5] = `Current: 1/${S.goldenCookieChance} → 1/${T.goldenChances[S.goldenCookieChanceStage]}`;
      s[6] = `Price: ${fmt(T.goldenPrices[S.goldenCookieChanceStage])} Cookies`;
    }
    if (S.multiplierStage >= T.multiplierMultipliers.length) {
      s[7] = `Current: x${Math.trunc(S.cookieMultiplier)} → MAXED OUT!`;
      s[8] = "Price: MAXED OUT!";
    } else {
      s[7] = `Current: x${Math.trunc(S.cookieMultiplier)} → x${T.multiplierMultipliers[S.multiplierStage]}`;
      s[8] = `Price: ${fmt(T.multiplierPrices[S.multiplierStage])} Cookies`;
    }
    if (S.cooldownStage >= T.cooldownPrices.length) {
      s[9] = `Current: ${S.cookieCooldown} ms → MAXED OUT!`;
      s[10] = "Price: MAXED OUT!";
    } else {
      s[9] = `Current: ${S.cookieCooldown} ms → ${T.cooldownCooldowns[S.cooldownStage]} ms`;
      s[10] = `Price: ${fmt(T.cooldownPrices[S.cooldownStage])} Cookies`;
    }
    s[11] = "Requires: All Achievements";
    s[12] = `Price: ${fmt(T.netheritePrice)} Cookies`;
    if (S.milkDurationStage >= T.milkDurationDurations.length) {
      s[13] = `Current: ${S.milkDuration}s → MAXED OUT!`;
      s[14] = "Price: MAXED OUT!";
    } else {
      s[13] = `Current: ${S.milkDuration}s → ${T.milkDurationDurations[S.milkDurationStage]}s`;
      s[14] = `Price: ${fmt(T.milkDurationPrices[S.milkDurationStage])} Cookies`;
    }
    if (S.milkMultiplierStage >= T.milkMultiplierPrices.length) {
      s[15] = `Current: x${Math.trunc(S.milkMultiplier)} → MAXED OUT!`;
      s[16] = "Price: MAXED OUT!";
    } else {
      s[15] = `Current: x${Math.trunc(S.milkMultiplier)} → x${T.milkMultiplierMultipliers[S.milkMultiplierStage]}`;
      s[16] = `Price: ${fmt(T.milkMultiplierPrices[S.milkMultiplierStage])} Cookies`;
    }
    if (!S.milkUnlocked) {
      s[17] = "Click to unlock Milk";
      s[18] = "Price: 15,000 Cookies";
    } else {
      s[17] = "Milk Unlocked!";
      if (S.milkActivated || now() - S.lastMilkActivationTime < S.milkDuration * 1000) s[18] = "Ability on cooldown";
      else s[18] = "Click the Bucket to activate!";
    }
    s[19] = S.milkUnlocked ? "Activate Milk" : "Unlock Milk";

    const body = "#D4D4D4";
    tdLeft.textContent = "";
    tdLeft.appendChild(span("\n\n\n\n\n", "#2ED428"));
    tdLeft.appendChild(span("Diamond Cookie Percent\n", "#55FFFF"));
    tdLeft.appendChild(span(`${s[3]}\n`, body, false));
    tdLeft.appendChild(span(`${s[4]}\n\n\n`, body, false));
    tdLeft.appendChild(span("Golden Cookie Chances\n", "#FFFF55"));
    tdLeft.appendChild(span(`${s[5]}\n`, body, false));
    tdLeft.appendChild(span(`${s[6]}\n\n\n`, body, false));
    tdLeft.appendChild(span("Cookie Multiplier\n", "#5555FF"));
    tdLeft.appendChild(span(`${s[7]}\n`, body, false));
    tdLeft.appendChild(span(`${s[8]}\n\n\n`, body, false));
    tdLeft.appendChild(span("Cookie Cooldown\n", "#FF5555"));
    tdLeft.appendChild(span(`${s[9]}\n`, body, false));
    tdLeft.appendChild(span(s[10], body, false));

    tdRight.textContent = "";
    tdRight.appendChild(span("\n\n\n\n\n", "#2ED428"));
    tdRight.appendChild(span("Beat the Secret!\n", "#5C5C5C"));
    tdRight.appendChild(span(`${s[11]}\n`, body, false));
    tdRight.appendChild(span(`${s[12]}\n\n\n`, body, false));
    tdRight.appendChild(span("Milk Duration\n", "#59EBE1"));
    tdRight.appendChild(span(`${s[13]}\n`, body, false));
    tdRight.appendChild(span(`${s[14]}\n\n\n`, body, false));
    tdRight.appendChild(span("Milk Multiplier\n", "#F2FFFF"));
    tdRight.appendChild(span(`${s[15]}\n`, body, false));
    tdRight.appendChild(span(`${s[16]}\n\n\n`, body, false));
    tdRight.appendChild(span(`${s[19]}\n`, "#F5F5ED"));
    tdRight.appendChild(span(`${s[17]}\n`, body, false));
    tdRight.appendChild(span(s[18], body, false));

    // Both side displays are bottom-anchored at y = 99.15
    tdLeft.style.top = py(99.15) - tdLeft.offsetHeight + "px";
    tdRight.style.top = py(99.15) - tdRight.offsetHeight + "px";

    // Unlock button vanishes once milk is bought (cookieRoomSetup)
    milkUnlockButton.hidden = S.milkUnlocked;
    save();
  }

  /* ------------------------------------------------------------------ */
  /* Golden cookies                                                      */
  /* ------------------------------------------------------------------ */

  function trySpawnGolden() {
    if (!rollOne(S.goldenCookieChance)) return;
    const randIndex = Math.floor(Math.random() * 14);
    if (S.goldenCookieLocations[randIndex]) return;
    const [gx, gy] = GOLDEN_SLOTS[randIndex];
    const el = document.createElement("div");
    el.className = "item spawn";
    place(el, gx, gy);
    if (rollOne(S.diamondCookieChance)) {
      S.goldenCookieLocations[randIndex] = true;
      S.diamondCookieLocations[randIndex] = true;
      setItem(el, "diamond");
      SFX.levelup(0.6, 2);
      SFX.cat(0.5, 2);
      burst(gx, gy, 16, COLORS.diamondBlock);
    } else {
      S.goldenCookieLocations[randIndex] = true;
      setItem(el, "golden_apple");
      SFX.levelup(0.4, 1);
      burst(gx, gy, 8, COLORS.goldBlock);
    }
    if (goldenItems[randIndex]) goldenItems[randIndex].remove();
    goldenItems[randIndex] = el;
    entEl.appendChild(el);
    save();
  }

  function clickGolden(slot) {
    if (slot < 0 || !S.goldenCookieLocations[slot]) return;
    const prev = S.cookieCount;
    const [gx, gy] = GOLDEN_SLOTS[slot];
    const el = goldenItems[slot];
    const isDiamond = S.diamondCookieLocations[slot];
    const milk = S.milkActivated;
    const mult = S.cookieMultiplier;

    if (isDiamond) {
      if (milk) {
        burst(gx, gy, 16, ["#37ffe7"], { shape: "circle", gravity: -20 });
        burst(gx, gy, 16, ["#5ad2ff", "#8cf0ff"], { size: 4, gravity: -60 });
        burst(gx, gy, 3, ["#c8faff"], { shape: "circle", size: 22, gravity: 0 });
        SFX.burp(0.45, rand(1.2, 1.4));
        SFX.chime(0.75, note(24));
        SFX.chime(0.75, note(16));
        SFX.chime(0.75, note(19));
        SFX.eat(0.75, rand(1.3, 1.7));
        SFX.egg(0.4, rand(1.3, 1.7));
        SFX.firecharge(0.5, rand(1.4, 1.8));
        SFX.firework(0.5, rand(1.8, 2.0));
      } else {
        burst(gx, gy, 16, ["#37ffe7"], { shape: "circle", gravity: -20 });
        SFX.burp(0.45, rand(0.9, 1.1));
        SFX.chime(0.75, note(24));
        SFX.chime(0.75, note(16));
        SFX.chime(0.75, note(19));
        SFX.eat(0.75, rand(1.0, 1.4));
        SFX.egg(0.4, rand(1.0, 1.4));
      }
      const gain = milk ? S.goldenCookieMultiplier * 10 * S.milkMultiplier * mult : S.goldenCookieMultiplier * 10 * mult;
      S.cookieCount += Math.trunc(gain);
      S.totalCookiesEarned += Math.trunc(gain);
      S.cookieLog[S.cookiesClicked % 100] = S.cookieCount;
      S.cookieLogTimes[S.cookiesClicked % 100] = now();
      if (milk) {
        actionbar([["Total ", "#e7edff"], ["Cookies: ", "#d8efff"], [fmt(S.cookieCount), "#c6f2ff"], [`  + (20 x ${Math.trunc(mult)}) x ${S.milkMultiplier})`, "#adf6ff"]]);
      } else {
        actionbar([["Total ", "#ffd700"], ["Cookies: ", "#b2f055"], [fmt(S.cookieCount), "#67fca2"], [`  + (200 x ${Math.trunc(mult)})`, "#37ffe7"]]);
      }
    } else {
      if (milk) {
        burst(gx, gy, 8, ["#fff7ed"], { shape: "circle", gravity: -20 });
        burst(gx, gy, 8, ["#ff9a1f", "#ffd24a"], { size: 4, gravity: -60 });
        burst(gx, gy, 2, ["#ffcc80"], { shape: "circle", size: 22, gravity: 0 });
        SFX.burp(0.65, rand(1.5, 1.9));
        SFX.pling(0.35, note(10));
        SFX.pling(0.35, note(18));
        SFX.eat(0.75, rand(1.5, 1.9));
        SFX.egg(0.7, rand(1.4, 1.8));
        SFX.firework(0.5, rand(1.2, 1.4));
      } else {
        burst(gx, gy, 8, ["#fff708"], { shape: "circle", gravity: -20 });
        SFX.burp(0.65, rand(1.2, 1.6));
        SFX.pling(0.15, note(8));
        SFX.pling(0.15, note(16));
        SFX.eat(0.75, rand(1.2, 1.6));
        SFX.egg(0.7, rand(1.0, 1.4));
      }
      const gain = milk ? S.goldenCookieMultiplier * S.milkMultiplier * mult : S.goldenCookieMultiplier * mult;
      S.cookieCount += Math.trunc(gain);
      S.totalCookiesEarned += Math.trunc(gain);
      if (milk) {
        actionbar([["Total ", "#e7edff"], ["Cookies: ", "#d8efff"], [fmt(S.cookieCount), "#c6f2ff"], [`  + (20 x ${Math.trunc(mult)}) x ${S.milkMultiplier})`, "#adf6ff"]]);
      } else {
        actionbar([["Total ", "#ff7f37"], ["Cookies: ", "#ff9c27"], [fmt(S.cookieCount), "#ffb913"], [`  + (20 x ${Math.trunc(mult)})`, "#ffd700"]]);
      }
    }

    // Animation: grow, shrink, remove (four ticks), then the state clears
    if (el) {
      el.classList.remove("spawn", "pop");
      el.classList.add("vanish");
    }
    setTimeout(() => {
      if (el) el.remove();
      if (goldenItems[slot] === el) goldenItems[slot] = null;
      S.goldenCookieLocations[slot] = false;
      S.diamondCookieLocations[slot] = false;
      if (isDiamond) S.diamondCookiesClicked += 1;
      else S.goldenCookiesClicked += 1;
      cookieTextUpdate();
      checkIfNewUpgrade(prev);
      trySpawnGolden();
    }, 200);
  }

  /* ------------------------------------------------------------------ */
  /* Main click                                                          */
  /* ------------------------------------------------------------------ */

  function clickCookie() {
    const prev = S.cookieCount;
    const t = now();
    if (S.timeSinceLastCookie + S.cookieCooldown >= t) {
      const n = Math.floor(rand(2, 4)) + 2;
      for (let i = 0; i < n; i++) {
        spawnParticle({
          x: cx(COOKIE.x) + rand(-0.35, 0.35) * B,
          y: cy(COOKIE.y) + rand(-0.25, 0.25) * B,
          vx: 0,
          vy: 0,
          gravity: 0,
          life: 0.5,
          size: 6,
          color: COLORS.cooldown[i % 3],
        });
      }
      SFX.netheriteHit(0.5, 2);
      return;
    }

    if (S.milkActivated) {
      SFX.drinkMilk(0.6, rand(0.8, 1.2));
      SFX.egg(0.3, rand(0.8, 1.2));
      S.cookieCount += Math.trunc(S.milkMultiplier * S.cookieMultiplier);
      S.totalCookiesEarned += Math.trunc(S.milkMultiplier * S.cookieMultiplier);
    } else {
      SFX.eat(0.5, rand(0.8, 1.2));
      SFX.egg(0.2, rand(0.8, 1.2));
      S.cookieCount += Math.trunc(S.cookieMultiplier);
      S.totalCookiesEarned += Math.trunc(S.cookieMultiplier);
    }
    S.timeSinceLastCookie = t;

    cookieTextUpdate();

    S.cookiesClicked += 1;
    S.cookieLog[S.cookiesClicked % 100] = S.cookieCount;
    S.cookieLogTimes[S.cookiesClicked % 100] = t;

    if (S.milkActivated) {
      actionbar([["Total ", "#e7edff"], ["Cookies: ", "#d8efff"], [fmt(S.cookieCount), "#c6f2ff"], [`  + (${fmt(S.cookieMultiplier)} x ${S.milkMultiplier})`, "#adf6ff"]]);
      burst(COOKIE.x, COOKIE.y, 8, COLORS.milk);
    } else {
      actionbar([["Total ", "#ff6b48"], ["Cookies: ", "#ff7f37"], [fmt(S.cookieCount), "#ff9523"], [`  + (${fmt(S.cookieMultiplier)})`, "#d4d4d4"]]);
      burst(COOKIE.x, COOKIE.y, 4, COLORS.cookie);
    }

    trySpawnGolden();
    checkIfNewUpgrade(prev);

    // Animation: scale 1.3 then ease back over half a second
    cookieItem.classList.remove("pop");
    void cookieItem.offsetWidth;
    cookieItem.classList.add("pop");
  }

  /* ------------------------------------------------------------------ */
  /* Affordability notice                                                */
  /* ------------------------------------------------------------------ */

  function checkIfNewUpgrade(prev) {
    const cost = [
      S.diamondCookieChanceStage < T.diamondPrices.length ? T.diamondPrices[S.diamondCookieChanceStage] : 0,
      S.goldenCookieChanceStage < T.goldenPrices.length ? T.goldenPrices[S.goldenCookieChanceStage] : 0,
      S.multiplierStage < T.multiplierPrices.length ? T.multiplierPrices[S.multiplierStage] : 0,
      S.cooldownStage < T.cooldownPrices.length ? T.cooldownPrices[S.cooldownStage] : 0,
      T.netheritePrice,
      S.milkDurationStage < T.milkDurationPrices.length ? T.milkDurationPrices[S.milkDurationStage] : 0,
      S.milkMultiplierStage < T.milkMultiplierPrices.length ? T.milkMultiplierPrices[S.milkMultiplierStage] : 0,
      S.milkUnlocked ? 0 : T.milkUnlockPrice,
    ];
    for (let i = 0; i < cost.length; i++) {
      if (prev < cost[i] && S.cookieCount >= cost[i]) {
        const b = BUTTONS[i];
        particleLine(COOKIE.x, COOKIE.y, b.x + 0.5, b.y + 0.5, 20, COLORS.eggCrack[0]);
        SFX.chime(0.8, note(17));
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Upgrade buttons                                                     */
  /* ------------------------------------------------------------------ */

  const DASH = "&#d4d4d4--------------------------------------";

  function subtractFromLog(price) {
    for (let i = 0; i < 99; i++) S.cookieLog[i] -= price;
  }

  function maxedOut() {
    chat(DASH);
    chat("&cYou have reached the maximum upgrade for this button!");
    chat(DASH);
    SFX.didgeridoo(0.5, 1);
  }

  function cannotAfford(title, lines, price) {
    chat(DASH);
    chat(title);
    for (const l of lines) chat(l);
    chat();
    chat(`&#d4d4d4● Price: &#ff9523&l${fmt(price)} Cookies`);
    chat(DASH);
    chat(`&cYou need &l${fmt(price - S.cookieCount)}&c more Cookies to purchase this!`);
    SFX.didgeridoo(0.5, 1);
  }

  function purchased(title, lines, price) {
    chat(DASH);
    chat(title);
    for (const l of lines) chat(l);
    chat();
    chat(`&#d4d4d4● Cookies Remaining: &#ff9523&l${fmt(S.cookieCount)} → ${fmt(S.cookieCount - price)} Cookies`);
    chat(DASH);
    chat("&aUpgrade Purchased Successfully!");
    SFX.pling(0.5, 1);
    S.cookieCount -= price;
    subtractFromLog(price);
  }

  function pressButton(key) {
    switch (key) {
      case "cooldown": {
        const st = S.cooldownStage;
        if (st >= T.cooldownCooldowns.length) {
          maxedOut();
          break;
        }
        const price = T.cooldownPrices[st];
        if (S.cookieCount < price) {
          cannotAfford("&c&lCookie Cooldown Button&#d4d4d4", [`&#d4d4d4● Current Cooldown: &c${S.cookieCooldown}ms`, `&#d4d4d4● Next Cooldown: &c${T.cooldownCooldowns[st]}ms`], price);
        } else {
          purchased("&c&lCookie Cooldown Button&#d4d4d4", [`&#d4d4d4● New Cooldown: &c${S.cookieCooldown} → ${T.cooldownCooldowns[st]}ms`], price);
          S.cookieCooldown = T.cooldownCooldowns[st];
          S.cooldownStage += 1;
        }
        break;
      }
      case "multiplier": {
        const st = S.multiplierStage;
        if (st >= T.multiplierMultipliers.length) {
          maxedOut();
          break;
        }
        const price = T.multiplierPrices[st];
        if (S.cookieCount < price) {
          cannotAfford("&9&lCookie Multiplier Button", [`&#d4d4d4● Current Multiplier: &9${fmt(S.cookieMultiplier)}x`, `&#d4d4d4● Next Multiplier: &9${fmt(T.multiplierMultipliers[st])}x`], price);
        } else {
          purchased("&9&lCookie Multiplier Button", [`&#d4d4d4● New Multiplier: &9${fmt(S.cookieMultiplier)}x → ${fmt(T.multiplierMultipliers[st])}x`], price);
          S.cookieMultiplier = T.multiplierMultipliers[st];
          S.multiplierStage += 1;
        }
        break;
      }
      case "golden": {
        const st = S.goldenCookieChanceStage;
        if (st >= T.goldenChances.length) {
          maxedOut();
          break;
        }
        const price = T.goldenPrices[st];
        if (S.cookieCount < price) {
          cannotAfford("&e&lGolden Cookie Chances Button&#d4d4d4", [`&#d4d4d4● Current Chance: &e1/${S.goldenCookieChance}`, `&#d4d4d4● Next Upgrade: &e1/${T.goldenChances[st]}`], price);
        } else {
          purchased("&e&lGolden Cookie Chances Button&#d4d4d4", [`&#d4d4d4● New Upgrade: &e1/${S.goldenCookieChance} → 1/${T.goldenChances[st]}`], price);
          S.goldenCookieChance = T.goldenChances[st];
          S.goldenCookieChanceStage += 1;
        }
        break;
      }
      case "diamond": {
        const st = S.diamondCookieChanceStage;
        if (st >= T.diamondChances.length) {
          maxedOut();
          break;
        }
        const price = T.diamondPrices[st];
        if (S.cookieCount < price) {
          cannotAfford("&b&lDiamond Cookie Chances Button&#d4d4d4", [`&#d4d4d4● Current Portion of Golden Cookies: &b1/${S.diamondCookieChance}`, `&#d4d4d4● Next Upgrade: &b1/${T.diamondChances[st]}`], price);
        } else {
          purchased("&b&lDiamond Cookie Chances Button&#d4d4d4", [`&#d4d4d4● New Upgrade: &b1/${S.diamondCookieChance} → 1/${T.diamondChances[st]}`], price);
          S.diamondCookieChance = T.diamondChances[st];
          S.diamondCookieChanceStage += 1;
        }
        break;
      }
      case "milkDuration": {
        const st = S.milkDurationStage;
        if (st >= T.milkDurationDurations.length) {
          maxedOut();
          break;
        }
        const price = T.milkDurationPrices[st];
        if (S.cookieCount < price) {
          cannotAfford("&#59EBE1&lMilk Duration Button&#d4d4d4", [`&#d4d4d4● Current Milk Duration: &#59EBE1${S.milkDuration}s`, `&#d4d4d4● Next Upgrade: &#59EBE1${T.milkDurationDurations[st]}s`], price);
        } else {
          purchased("&#59EBE1&lMilk Duration Button&#d4d4d4", [`&#d4d4d4● New Upgrade: &#59EBE1${S.milkDuration}s → ${T.milkDurationDurations[st]}s`], price);
          S.milkDuration = T.milkDurationDurations[st];
          S.milkDurationStage += 1;
        }
        break;
      }
      case "milkMultiplier": {
        const st = S.milkMultiplierStage;
        if (st >= T.milkMultiplierMultipliers.length) {
          maxedOut();
          break;
        }
        const price = T.milkMultiplierPrices[st];
        if (S.cookieCount < price) {
          cannotAfford("&f&lMilk Multiplier Button&#d4d4d4", [`&#d4d4d4● Current Milk Multiplier: &f${S.milkMultiplier}x`, `&#d4d4d4● Next Upgrade: &f${T.milkMultiplierMultipliers[st]}x`], price);
        } else {
          purchased("&f&lMilk Multiplier Button&#d4d4d4", [`&#d4d4d4● New Upgrade: &f${S.milkMultiplier}x → ${T.milkMultiplierMultipliers[st]}x`], price);
          S.milkMultiplier = T.milkMultiplierMultipliers[st];
          S.milkMultiplierStage += 1;
        }
        break;
      }
      case "netherite": {
        const price = T.netheritePrice;
        if (S.cookieCount < price) {
          chat(DASH);
          chat("&#5C5C5C&lSecret Completion Button&#d4d4d4");
          chat("&#d4d4d4● Purchase this to beat the secret!");
          chat();
          chat("&#d4d4d4● Price: &#ff9523&l100,000,000 Cookies");
          chat(DASH);
          chat(`&cYou need &l${fmt(price - S.cookieCount)}&c more Cookies to purchase this!`);
          SFX.didgeridoo(0.5, 1);
        } else {
          chat(DASH);
          chat("&#5C5C5C&lSecret Completion Button&#d4d4d4");
          chat("&#d4d4d4● Secret Completed! Congratulations!");
          chat();
          chat(`&#d4d4d4● Cookies Remaining: &#ff9523&l${fmt(S.cookieCount)} → ${fmt(S.cookieCount - price)} Cookies`);
          chat(DASH);
          chat("&aUpgrade Purchased Successfully!");
          SFX.pling(0.5, 1);
          SFX.toast(0.75, 1);
          S.cookieCount -= price;
          subtractFromLog(price);
          S.netheriteUnlocked = true;
          showCompletion();
        }
        break;
      }
      case "milkUnlock": {
        if (S.milkUnlocked) break;
        if (S.cookieCount < 15000) {
          chat(DASH);
          chat("&#F5F5ED&lMilk Unlock Button");
          chat("&#d4d4d4● Unlocks Milk Ability");
          chat();
          chat("&#d4d4d4● Price: &#ff9523&l15,000 Cookies");
          chat(DASH);
          chat(`&cYou need &l${fmt(15000 - S.cookieCount)}&c more Cookies to purchase this!`);
          SFX.didgeridoo(0.5, 1);
        } else {
          chat(DASH);
          chat("&#F5F5ED&lMilk Unlock Button");
          chat("&#d4d4d4● Milk Ability Unlocked!");
          chat();
          chat(`&#d4d4d4● Cookies Remaining: &#ff9523&l${fmt(S.cookieCount)} → ${fmt(S.cookieCount - 15000)} Cookies`);
          chat(DASH);
          chat("&aUpgrade Purchased Successfully!");
          SFX.pling(0.5, 1);
          S.cookieCount -= 15000;
          S.milkUnlocked = true;
          subtractFromLog(15000);
          S.milkActivated = false;
          setItem(milkItem, "milk_bucket");
        }
        break;
      }
    }
    upgradeTextUpdate();
    cookieTextUpdate();
  }

  /* ------------------------------------------------------------------ */
  /* Milk                                                                */
  /* ------------------------------------------------------------------ */

  let milkScriptStart = -1e13; // the script's own @cooldown 45s
  let milkTimers = [];

  function milkAnimation(milkTrue) {
    const pitches = milkTrue ? [0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9] : [1.9, 1.7, 1.5, 1.3, 1.1, 0.9, 0.7];
    MILK_STEPS.forEach((step, i) => {
      setTimeout(() => {
        for (const [x, y, z, brown, white] of step) {
          const el = z === 9300 ? wallCells[`${x},${y}`] : floorCells[`${x},${z}`];
          if (el) setBlock(el, milkTrue ? white : brown);
        }
        if (i < pitches.length) SFX.goatMilk(0.85, pitches[i]);
      }, i * 50);
    });
  }

  function milkActivation() {
    const t = now();
    if (t - milkScriptStart < 45000) return;
    milkScriptStart = t;
    if (!S.milkUnlocked) return;
    if (S.milkActivated) return;

    S.lastMilkActivationTime = t;
    S.milkActivated = true;
    setItem(cookieItem, "milk_bucket");
    setItem(milkItem, "bucket");
    cookieTextUpdate();
    upgradeTextUpdate();
    milkAnimation(true);

    milkTimers.forEach(clearTimeout);
    milkTimers = [
      setTimeout(() => {
        S.milkActivated = false;
        setItem(cookieItem, "cookie");
        cookieTextUpdate();
        upgradeTextUpdate();
        milkAnimation(false);
      }, (20 * S.milkDuration - 7) * 50),
      setTimeout(() => {
        setItem(milkItem, "milk_bucket");
        upgradeTextUpdate();
        burst(-9146.5, 99.5, 12, ["#f2f2ff"], { shape: "circle", gravity: -20 });
        SFX.witchDrink(1, 1);
        SFX.goatScream(0.5, 1);
      }, 886 * 50),
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Completion, reset, room setup                                       */
  /* ------------------------------------------------------------------ */

  function showCompletion() {
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = `<h2>Secret Completed!</h2><p>Congratulations! You bought the 100,000,000 cookie button.</p><p>Total cookies earned: ${fmt(S.totalCookiesEarned)}</p>`;
    const btn = document.createElement("button");
    btn.textContent = "Back to the cookie";
    btn.addEventListener("click", () => {
      ov.remove();
      SFX.enderTeleport(0.8, 1);
    });
    ov.appendChild(btn);
    scene.appendChild(ov);
  }

  let resetInput = null;
  let resetTimeout = null;
  let resetCooldownUntil = 0;

  function resetPrompt() {
    if (now() < resetCooldownUntil || resetInput) return;
    resetCooldownUntil = now() + 10000;
    chat('&7Type &#D3D6E0"Yes"&7 in chat to confirm reset.');
    resetInput = document.createElement("input");
    resetInput.className = "chat-input";
    resetInput.placeholder = "Type here...";
    resetInput.maxLength = 32;
    scene.appendChild(resetInput);
    resetInput.focus();
    const finish = (answer) => {
      clearTimeout(resetTimeout);
      resetInput.remove();
      resetInput = null;
      if (answer === null) {
        chat("&cYou took too long!");
        return;
      }
      chat(`&7<you> ${answer}`);
      if (answer.trim().toLowerCase() === "yes") doReset();
    };
    resetInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(resetInput.value);
      if (e.key === "Escape") finish("");
    });
    resetTimeout = setTimeout(() => finish(null), 20000);
  }

  function doReset() {
    milkTimers.forEach(clearTimeout);
    milkTimers = [];
    S = freshState();
    milkScriptStart = -1e13;
    cookieRoomSetup();
    SFX.pling(0.75, 1);
    chat("&#d4d4d4---------------------------------");
    chat("&#d4d4d4● Reset all &6&lCookie Data &#d4d4d4successfully!");
    chat("&#d4d4d4---------------------------------");
    save();
  }

  function cookieRoomSetup() {
    S.goldenCookieLocations = new Array(14).fill(false);
    S.diamondCookieLocations = new Array(14).fill(false);
    goldenItems.forEach((el, i) => {
      if (el) el.remove();
      goldenItems[i] = null;
    });
    S.milkActivated = false;
    setItem(cookieItem, "cookie");
    setItem(milkItem, S.milkUnlocked ? "milk_bucket" : null);
    // Put the alcove back to brown in case a save was made mid-milk
    for (const step of MILK_STEPS) {
      for (const [x, y, z, brown] of step) {
        const el = z === 9300 ? wallCells[`${x},${y}`] : floorCells[`${x},${z}`];
        if (el) setBlock(el, brown);
      }
    }
    cookieTextUpdate();
    upgradeTextUpdate();
  }

  /* ------------------------------------------------------------------ */
  /* Layout, ticker, boot                                                */
  /* ------------------------------------------------------------------ */

  function fit() {
    const wrap = scene.parentElement;
    const w = wrap.clientWidth;
    const s = Math.min(1, w / 1200);
    scene.style.transform = `scale(${s})`;
    wrap.style.height = Math.round(800 * s) + "px";
  }

  function tick() {
    // Keep the milk clocks moving between clicks without touching the CPS
    if (S.milkUnlocked) {
      renderCenter();
      const s18 = tdRight.lastChild;
      if (s18) {
        const onCd = S.milkActivated || now() - S.lastMilkActivationTime < S.milkDuration * 1000;
        s18.textContent = onCd ? "Ability on cooldown" : "Click the Bucket to activate!";
      }
    }
  }

  function bindSoundToggle() {
    const btn = $("sound-toggle");
    const label = () => (btn.textContent = muted ? "sound: off" : "sound: on");
    label();
    btn.addEventListener("click", () => {
      muted = !muted;
      try {
        localStorage.setItem("harha-cookie-muted", muted ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
      label();
      if (!muted) SFX.pling(0.4, 1);
    });
  }

  function boot() {
    load();
    buildWall();
    buildFloor();
    buildEntities();
    cookieRoomSetup();
    bindSoundToggle();
    fit();
    window.addEventListener("resize", fit);
    setInterval(tick, 100);
    requestAnimationFrame(frame);

    // Keyboard: space clicks the cookie (handy for testing and for phones with keyboards)
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && document.activeElement !== resetInput) {
        e.preventDefault();
        clickCookie();
      }
    });
    scene.addEventListener("pointerdown", () => audio(), { once: true });
  }

  boot();
})();

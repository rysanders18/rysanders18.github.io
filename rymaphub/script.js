// RYmaphub - image -> Minecraft map art -> chat messages.
//
// Pipeline:
//   1. Crop and preprocess the source image (zoom/x/y, brightness, contrast,
//      saturation) onto a 128x128 canvas.
//   2. Quantise every pixel to the nearest map colour in CIE-L*a*b*, with
//      optional dithering. With staircasing on, every block has three tones
//      (dark / normal / light) chosen by the height step from the block to
//      its north, which triples the palette.
//   3. Encode the 16,384 colour indices (column-major) as a symbol stream,
//      one symbol per chat character, and split it into chat-sized messages
//      with an index and checksum on each.
//   4. The user pastes the messages into Minr chat; the rymaphub MSC
//      script decodes them, recomputes block heights (Valley mode) and
//      places the blocks.
//
// The encoding contract in the ENCODING section must match the MSC decoder
// (rymaphub namespace in the Minr-Scrips repo) exactly.

// ---------------------------------------------------------------------------
// PALETTE
// ---------------------------------------------------------------------------

// Map-art blocks and the base RGB of their map colour (the value the map
// shows at the "light" tone). Order matters: the MSC decoder holds the same
// list and palette entries refer to positions in it. Water is not included:
// its tone comes from water depth, not height, so it cannot be staircased.
const BLOCKS = [
    ["grass_block", [127, 178, 56]],
    ["sand", [247, 233, 163]],
    ["diorite", [255, 252, 245]],
    ["redstone_block", [255, 0, 0]],
    ["cobweb", [199, 199, 199]],
    ["big_dripleaf", [0, 124, 0]],
    ["packed_ice", [160, 160, 255]],
    ["iron_block", [167, 167, 167]],
    ["white_concrete", [255, 255, 255]],
    ["clay", [164, 168, 184]],
    ["dirt", [151, 109, 77]],
    ["stone", [112, 112, 112]],
    ["oak_planks", [143, 119, 72]],
    ["acacia_planks", [216, 127, 51]],
    ["magenta_wool", [178, 76, 216]],
    ["light_blue_wool", [102, 153, 216]],
    ["yellow_wool", [229, 229, 51]],
    ["lime_wool", [127, 204, 25]],
    ["pink_wool", [242, 127, 165]],
    ["light_gray_wool", [153, 153, 153]],
    ["cyan_wool", [76, 127, 153]],
    ["blue_wool", [51, 76, 178]],
    ["dark_oak_planks", [102, 76, 51]],
    ["green_wool", [102, 127, 51]],
    ["red_wool", [153, 51, 51]],
    ["black_wool", [25, 25, 25]],
    ["gold_block", [250, 238, 77]],
    ["diamond_block", [92, 219, 213]],
    ["lapis_block", [74, 128, 255]],
    ["emerald_block", [0, 217, 58]],
    ["podzol", [129, 86, 49]],
    ["netherrack", [112, 2, 0]],
    ["white_terracotta", [209, 177, 161]],
    ["orange_terracotta", [159, 82, 36]],
    ["magenta_terracotta", [149, 87, 108]],
    ["light_blue_terracotta", [112, 108, 138]],
    ["yellow_terracotta", [186, 133, 36]],
    ["lime_terracotta", [103, 117, 53]],
    ["pink_terracotta", [160, 77, 78]],
    ["gray_terracotta", [57, 41, 35]],
    ["light_gray_terracotta", [135, 107, 98]],
    ["cyan_terracotta", [87, 92, 92]],
    ["purple_terracotta", [122, 73, 88]],
    ["blue_terracotta", [76, 62, 92]],
    ["brown_terracotta", [76, 50, 35]],
    ["green_terracotta", [76, 82, 42]],
    ["red_terracotta", [142, 60, 46]],
    ["black_terracotta", [37, 22, 16]],
    ["crimson_nylium", [189, 48, 49]],
    ["warped_nylium", [22, 126, 134]],
    ["deepslate", [100, 100, 100]],
    ["raw_iron_block", [216, 175, 14]]
];
const BLOCK_NAMES = BLOCKS.map(b => b[0]);

// Tones. The map renderer multiplies a block's base colour by 180/255
// (dark), 220/255 (normal) or 255/255 (light) depending on whether the
// block is lower than, level with, or higher than the block to its north.
const TONE_MULT = [180, 220, 255];
const DARK = 0, NORMAL = 1, LIGHT = 2;

// Master colour index. 0 = transparent (no block). For m >= 1:
//   blockIdx = (m - 1) / 3 (integer),  tone = (m - 1) % 3.
const TRANSPARENT = 0;
const MASTER_COUNT = 1 + BLOCKS.length * 3;
const masterRGB = [[0, 0, 0]];
for (const [, base] of BLOCKS) {
    for (const mult of TONE_MULT) masterRGB.push(base.map(v => Math.floor(v * mult / 255)));
}
const masterOf = (blockIdx, tone) => 1 + blockIdx * 3 + tone;
const toneOf = m => (m - 1) % 3;
const blockOf = m => Math.floor((m - 1) / 3);

// ---------------------------------------------------------------------------
// COLOUR SPACE  (sRGB -> XYZ -> CIE-L*a*b*, see http://www.easyrgb.com/en/math.php)
// ---------------------------------------------------------------------------

function respaceToXYZ(x) {
    return x.map(val => (val > 0.04045 ? 100 * Math.pow((val + 0.055) / 1.055, 2.4) : val / 0.1292));
}

function respaceFromXYZ(x) {
    return x.map(val => (val > 0.008856 ? Math.pow(val, 1 / 3) : (7.787 * val) + (16 / 116)));
}

function multiplyMatrixVector(matrix, vector) {
    return matrix.map(row => row.reduce((sum, val, i) => sum + val * vector[i], 0));
}

// Euclidean distance in L*a*b* tracks human colour perception far better
// than distance in RGB, so nearest-colour lookups happen in this space.
function convertToCIELAB(rgb) {
    const M_1 = [
        [0.4124, 0.3576, 0.1805],
        [0.2126, 0.7152, 0.0722],
        [0.0193, 0.1192, 0.9505]
    ];
    const M_2 = [
        [0, 116, 0],
        [500, -500, 0],
        [0, 200, -200]
    ];
    const normalizedRGB = rgb.map(val => val / 255);
    const respacedRGB = respaceToXYZ(normalizedRGB);
    const XYZ = multiplyMatrixVector(M_1, respacedRGB).map((val, i) => val / [95.047, 100.000, 108.883][i]);
    const respacedXYZ = respaceFromXYZ(XYZ);
    return multiplyMatrixVector(M_2, respacedXYZ);
}

const masterLAB = masterRGB.map(convertToCIELAB);

// LAB conversion is the hot path with 16k pixels x 10 slider changes, so
// cache by packed RGB.
const labCache = new Map();
function labOf(rgb) {
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    let lab = labCache.get(key);
    if (!lab) {
        lab = convertToCIELAB(rgb);
        labCache.set(key, lab);
    }
    return lab;
}

// Candidate master indices for each set of allowed tones, keyed by a bit
// mask: 1 = dark, 2 = normal, 4 = light.
const CANDIDATES = [];
for (let mask = 0; mask < 8; mask++) {
    const list = [];
    for (let b = 0; b < BLOCKS.length; b++) {
        for (let tone = 0; tone < 3; tone++) if (mask & (1 << tone)) list.push(masterOf(b, tone));
    }
    CANDIDATES.push(list);
}
const MASK_DARK = 1, MASK_NORMAL = 2, MASK_LIGHT = 4;

// Nearest and second-nearest candidate to an RGB triple.
// Returns [bestM, bestDist, secondM, secondDist].
function closestTwo(rgb, candidates) {
    const lab = labOf(rgb);
    let m1 = candidates[0], d1 = Infinity, m2 = candidates[0], d2 = Infinity;
    for (const m of candidates) {
        const c = masterLAB[m];
        const d = (lab[0] - c[0]) ** 2 + (lab[1] - c[1]) ** 2 + (lab[2] - c[2]) ** 2;
        if (d < d1) {
            m2 = m1; d2 = d1;
            m1 = m; d1 = d;
        } else if (d < d2) {
            m2 = m; d2 = d;
        }
    }
    return [m1, d1, m2, d2];
}

// ---------------------------------------------------------------------------
// DITHERING  (matrices as in MapartCraft)
// ---------------------------------------------------------------------------
//
// Error-diffusion matrices are 3 rows x 5 columns with the current pixel at
// [0][2]; each entry is the share of the quantisation error pushed to that
// neighbour, divided by `divisor`. Ordered matrices hold thresholds 1..n^2.

const DITHERS = {
    None: { label: "None" },
    FloydSteinberg: { label: "Floyd-Steinberg", diffusion: [[0, 0, 0, 7, 0], [0, 3, 5, 1, 0], [0, 0, 0, 0, 0]], divisor: 16 },
    Bayer44: { label: "Bayer (4x4)", ordered: [[1, 9, 3, 11], [13, 5, 15, 7], [4, 12, 2, 10], [16, 8, 14, 6]] },
    Bayer22: { label: "Bayer (2x2)", ordered: [[1, 3], [4, 2]] },
    Ordered33: { label: "Ordered (3x3)", ordered: [[1, 7, 4], [5, 8, 3], [6, 2, 9]] },
    MinAvgErr: { label: "MinAvgErr", diffusion: [[0, 0, 0, 7, 5], [3, 5, 7, 5, 3], [1, 3, 5, 3, 1]], divisor: 48 },
    Burkes: { label: "Burkes", diffusion: [[0, 0, 0, 8, 4], [2, 4, 8, 4, 2], [0, 0, 0, 0, 0]], divisor: 32 },
    SierraLite: { label: "Sierra-Lite", diffusion: [[0, 0, 0, 2, 0], [0, 1, 1, 0, 0], [0, 0, 0, 0, 0]], divisor: 4 },
    Stucki: { label: "Stucki", diffusion: [[0, 0, 0, 8, 4], [2, 4, 8, 4, 2], [1, 2, 4, 2, 1]], divisor: 42 },
    Atkinson: { label: "Atkinson", diffusion: [[0, 0, 0, 1, 1], [0, 1, 1, 1, 0], [0, 0, 1, 0, 0]], divisor: 8 }
};

const STAIRCASE = {
    off: { label: "Off (2D)" },
    valley: { label: "On (Valley)" }
};

// ---------------------------------------------------------------------------
// QUANTISATION
// ---------------------------------------------------------------------------

const SIZE = 128;
const PIXELS = SIZE * SIZE;
const ALPHA_CUTOFF = 100;

// pixels: flat RGBA byte array of a 128x128 image.
// options: { staircase: "off"|"valley", dither: key of DITHERS, maxHeight }
// Returns a Uint8Array of master indices, row-major (z * 128 + x).
//
// Height limit: a run of light tones down a column climbs one block per
// pixel, so the classic (running-sum) height of every column is tracked
// and a tone is dropped from the candidates when it would push the
// column's classic range (max - min) past maxHeight. Valley heights never
// exceed the classic range, so the built column stays within the limit.
function quantise(pixels, options) {
    const out = new Uint8Array(PIXELS);
    const dither = DITHERS[options.dither] || DITHERS.None;
    const staircased = options.staircase === "valley";
    const maxHeight = options.maxHeight === undefined ? 1000 : options.maxHeight;
    const colCur = new Int32Array(SIZE), colMin = new Int32Array(SIZE), colMax = new Int32Array(SIZE);

    const work = new Float32Array(PIXELS * 3);
    const opaque = new Uint8Array(PIXELS);
    for (let p = 0; p < PIXELS; p++) {
        work[p * 3] = pixels[p * 4];
        work[p * 3 + 1] = pixels[p * 4 + 1];
        work[p * 3 + 2] = pixels[p * 4 + 2];
        opaque[p] = pixels[p * 4 + 3] >= ALPHA_CUTOFF ? 1 : 0;
    }
    const clamp = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);

    for (let z = 0; z < SIZE; z++) {
        for (let x = 0; x < SIZE; x++) {
            const p = z * SIZE + x;
            if (!opaque[p]) {
                out[p] = TRANSPARENT;
                continue;
            }
            // The map renderer compares each column with the column to its
            // north. A transparent pixel has no block, so the comparison sees
            // the void: the pixel south of it always renders light and its
            // height is unconstrained (it is not a step in the staircase).
            const northTransparent = z > 0 && out[p - SIZE] === TRANSPARENT;
            let mask;
            if (northTransparent) {
                mask = MASK_LIGHT;
            } else if (!staircased) {
                mask = MASK_NORMAL;
            } else {
                mask = MASK_NORMAL;
                if (colCur[x] + 1 - colMin[x] <= maxHeight) mask |= MASK_LIGHT;
                if (colMax[x] - (colCur[x] - 1) <= maxHeight) mask |= MASK_DARK;
            }
            const candidates = CANDIDATES[mask];

            const rgb = [clamp(work[p * 3]), clamp(work[p * 3 + 1]), clamp(work[p * 3 + 2])];
            const [m1, d1, m2, d2] = closestTwo(rgb, candidates);
            let chosen = m1;

            if (dither.ordered) {
                const mat = dither.ordered;
                const n = mat.length;
                const threshold = mat[x % n][z % n];
                if (d2 > 0 && (d1 * (n * n + 1)) / d2 > threshold) chosen = m2;
            }
            out[p] = chosen;
            if (!northTransparent) {
                colCur[x] += toneOf(chosen) - 1;
                if (colCur[x] < colMin[x]) colMin[x] = colCur[x];
                if (colCur[x] > colMax[x]) colMax[x] = colCur[x];
            }

            if (dither.diffusion) {
                const c = masterRGB[chosen];
                const err = [rgb[0] - c[0], rgb[1] - c[1], rgb[2] - c[2]];
                const mat = dither.diffusion;
                for (let r = 0; r < 3; r++) {
                    for (let k = 0; k < 5; k++) {
                        const w = mat[r][k];
                        if (!w) continue;
                        const xx = x + k - 2, zz = z + r;
                        if (xx < 0 || xx >= SIZE || zz >= SIZE) continue;
                        const q = zz * SIZE + xx;
                        if (!opaque[q]) continue;
                        const f = w / dither.divisor;
                        work[q * 3] += err[0] * f;
                        work[q * 3 + 1] += err[1] * f;
                        work[q * 3 + 2] += err[2] * f;
                    }
                }
            }
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// HEIGHTS  (Valley staircasing, after MapartCraft)
// ---------------------------------------------------------------------------
//
// A block's tone depends only on the SIGN of (its height - north height), so
// heights are free to choose as long as every light step goes up, every dark
// step goes down and every normal step stays level (a pixel south of a
// transparent one is compared with the void and imposes nothing). "Classic" heights are
// the running sum (+1 light, -1 dark). Valley mode then lowers the column:
// every non-plateau stretch is pulled down so its lowest block sits at 0,
// and every plateau (the flat top between an ascent and a descent) is pulled
// down by the smaller of its two neighbours' pull-downs. Result: valleys on
// the floor, peaks as low as the descents on either side allow.
//
// column: 128 master indices (north to south). Returns 129 heights, index 0
// being the "noobline" block north of the map that row 0 is compared with.

function classicHeights(column) {
    const h = [0];
    let cur = 0;
    for (let z = 0; z < column.length; z++) {
        const m = column[z];
        // A pixel south of a transparent one is compared with the void, not
        // with a block, so its tone does not impose a step.
        const northTransparent = z > 0 && column[z - 1] === TRANSPARENT;
        if (m !== TRANSPARENT && !northTransparent) cur += toneOf(m) - 1;
        h.push(cur);
    }
    return h;
}

// Segment formulation - this is the shape the MSC decoder implements.
function valleyHeights(column) {
    const h = classicHeights(column);
    const n = h.length;
    const inPlateau = new Uint8Array(n);
    let ascending = false;
    let plateauStart = 0;
    for (let i = 1; i < n; i++) {
        if (ascending && h[i] < h[i - 1]) {
            for (let j = plateauStart; j < i; j++) inPlateau[j] = 1;
            ascending = false;
        } else if (h[i] > h[i - 1]) {
            ascending = true;
            plateauStart = i;
        }
    }

    const BIG = 1000000;
    let segStart = 0;
    let segType = 0;
    let lastPull = BIG;
    let pendStart = -1, pendEnd = -1;
    for (let i = 1; i <= n; i++) {
        const curType = i < n ? inPlateau[i] : -1;
        if (curType === segType) continue;
        if (segType === 0) {
            let p = BIG;
            for (let j = segStart; j < i; j++) if (h[j] < p) p = h[j];
            for (let j = segStart; j < i; j++) h[j] -= p;
            if (pendStart >= 0) {
                const q = Math.min(lastPull, p);
                for (let j = pendStart; j < pendEnd; j++) h[j] -= q;
                pendStart = -1;
            }
            lastPull = p;
        } else {
            pendStart = segStart;
            pendEnd = i;
        }
        segStart = i;
        segType = curType;
    }
    if (pendStart >= 0) {
        for (let j = pendStart; j < pendEnd; j++) h[j] -= lastPull;
    }
    return h;
}

// Direct port of MapartCraft's plateau loop, kept for the round-trip test.
function valleyHeightsReference(column) {
    const h = classicHeights(column);
    const plateaus = [{ startIndex: 0, endIndex: 0 }];
    let ascending = false;
    let currentPlateauStartIndex = null;
    let visible = h[0];
    for (let i = 1; i < h.length; i++) {
        if (ascending && h[i] < visible) {
            ascending = false;
            plateaus.push({ startIndex: currentPlateauStartIndex, endIndex: i });
        } else if (h[i] > visible) {
            ascending = true;
            currentPlateauStartIndex = i;
        }
        visible = h[i];
    }
    plateaus.push({ startIndex: h.length, endIndex: h.length });
    const pulls = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    while (plateaus.length !== 1) {
        let pull = Number.MAX_SAFE_INTEGER;
        for (let i = plateaus[0].endIndex; i < plateaus[1].startIndex; i++) pull = Math.min(h[i], pull);
        for (let i = plateaus[0].endIndex; i < plateaus[1].startIndex; i++) h[i] -= pull;
        pulls[1] = pull;
        const plateauPull = Math.min(...pulls);
        for (let i = plateaus[0].startIndex; i < plateaus[0].endIndex; i++) h[i] -= plateauPull;
        plateaus.shift();
        pulls[0] = pulls[1];
    }
    return h;
}

// Heights for the whole map: returns { heights: Int32Array(129*128) indexed
// [x * 129 + zPlusOne], maxHeight }.
function mapHeights(masterIdx, staircase) {
    const heights = new Int32Array(129 * SIZE);
    let maxHeight = 0;
    for (let x = 0; x < SIZE; x++) {
        const column = new Array(SIZE);
        for (let z = 0; z < SIZE; z++) column[z] = masterIdx[z * SIZE + x];
        const h = staircase === "valley" ? valleyHeights(column) : new Array(SIZE + 1).fill(0);
        for (let i = 0; i < h.length; i++) {
            heights[x * 129 + i] = h[i];
            if (i > 0 && column[i - 1] !== TRANSPARENT && h[i] > maxHeight) maxHeight = h[i];
        }
    }
    return { heights, maxHeight };
}

// ---------------------------------------------------------------------------
// ENCODING  (contract shared with the MSC decoder - keep in sync)
// ---------------------------------------------------------------------------
//
// Alphabet: a symbol is one chat character; its value is its position in
// the alphabet string (the decoder uses String.indexOf, the only
// character->number primitive MSC has). The alphabet is every code point in
// CJK Extension A (U+3400..U+4DBF) followed by CJK Unified (U+4E00..U+9FFF):
// 27,584 symbols, each a single UTF-16 unit so each costs one chat character.
//
// Stream: pixels in column-major order (x = 0..127, then z = 0..127 within
// each column, so the decoder can finish one column's heights at a time).
// A pixel is a master colour index, 0..156, and K is that full count rather
// than a per-image palette: 157^2 already fits the alphabet, so packing two
// pixels per character needs no palette and the header stays 8 characters
// no matter how many colours the image uses. P = pixels per plain symbol
// (2 when K^2 fits the alphabet, else 1), base = K^P, N = alphabet size.
//   symbol s <  base : P pixels. P=1: s. P=2: floor(s/K) then s%K.
//   symbol s >= base : run code - repeat the previous PLAIN SYMBOL
//                      (s - base + 1) more times, so a run code repeats
//                      both pixels of a pair, not just the last one.
// Repeats are capped at MAX_REPS per code so the decoder's inner loops stay
// under the MSC 1000-element list limit.
//
// NO TWO ADJACENT CHARACTERS IN A MESSAGE ARE EVER EQUAL. Minr chat
// dropped one character out of a run of eight identical ones in protocol
// v2, so this is load-bearing, not cosmetic. Three things secure it:
//   - every repeated symbol becomes a run code, and consecutive run codes
//     are forced to differ, so payloads never repeat a character;
//   - counts that could collide with a neighbouring field (the message
//     index, nMsgs, K) are written from the TOP of the alphabet as
//     A[N-1-v], far above any symbol value;
//   - the checksum is taken mod N-1 and then written with the value of the
//     preceding character skipped over, so it can never equal it.
//
// Messages (each <= MSG_LEN characters), with C = N - 1:
//   header : "RYMH4" + A[N-1-nMsgs] + A[P] + skip(A, check)
//            check = (P + nMsgs) % C
//   data i : A[N-1-i] + payload + skip(A, check),  i = 1..nMsgs-1
//            check = (i + sum(payload symbol values)) % C
// skip(A, v) writes v as A[v] when v < prev and A[v+1] otherwise, where
// prev is the value of the character just before it.

// Characters per message. Minecraft's chat field holds 256, so 250 leaves
// headroom. Messages were measured arriving at Minr at full length (250 in,
// 250 out), so chat does not truncate them and this is a convenience
// control, not a workaround. Nothing in the decoder depends on the value.
const DEFAULT_MSG_LEN = 250;
const MAGIC = "RYMH5";
// Every pixel is a master colour index, so the symbol radix is fixed and no
// per-image palette has to be transmitted.
const COLOURS = MASTER_COUNT;
// A run code repeats a symbol, and a P=2 symbol is two pixels, so one code
// can ask emitPixels for 2 * MAX_REPS pixels. MSC lists cap at 1000.
const MAX_REPS = 499;
// Exactly the 2,980 characters protocol v1 used, and v1 imported into Minr
// and round-tripped every message correctly. Growing the alphabet to 27,584
// (adding CJK Extension A) is the only thing that changed under the hood
// when data messages started failing their checksums while the header still
// passed, so the alphabet is back to the size that is known to work.
// It holds only 2,980 symbols, so 157 colours cannot square inside it and
// P falls to 1 pixel per character. That roughly doubles the message count
// and is the price of an encoding that is known to survive the trip.
const ALPHABET_RANGES = [[0x4E00, 0x4E00 + 2979]];

const ALPHA = (() => {
    const parts = [];
    for (const [lo, hi] of ALPHABET_RANGES) {
        for (let c = lo; c <= hi; c++) parts.push(String.fromCharCode(c));
    }
    return parts.join("");
})();

// The checksum, written so it can never equal the character before it:
// values 0..N-2 map onto the N-1 alphabet positions other than `prev`.
function skipChar(prev, check) {
    return ALPHA[check < prev ? check : check + 1];
}

function unskip(prev, charVal) {
    return charVal < prev ? charVal : charVal - 1;
}

// Column-major master indices from a row-major image.
function toColumnMajor(masterIdx) {
    const out = new Uint8Array(PIXELS);
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) out[x * SIZE + z] = masterIdx[z * SIZE + x];
    return out;
}

function toRowMajor(columnMajor) {
    const out = new Uint8Array(PIXELS);
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) out[z * SIZE + x] = columnMajor[x * SIZE + z];
    return out;
}

// masterIdx: Uint8Array of PIXELS master indices, row-major.
function encodeMap(masterIdx, msgLen) {
    const MSG_LEN = msgLen || DEFAULT_MSG_LEN;
    const N = ALPHA.length;
    const px = toColumnMajor(masterIdx);

    const K = COLOURS;
    const P = K * K + 64 <= N ? 2 : 1;
    const base = K ** P;
    const maxReps = Math.min(N - base, MAX_REPS);
    if (maxReps < 2) throw new Error(`Palette of ${K} colours does not fit the alphabet`);

    // PIXELS is even, so P=2 always divides the stream into whole pairs.
    const nSym = P === 2 ? px.length / 2 : px.length;
    const symAt = j => (P === 2 ? px[2 * j] * K + px[2 * j + 1] : px[j]);

    const symbols = [];
    let j = 0;
    while (j < nSym) {
        const s = symAt(j);
        symbols.push(s);
        j++;
        let reps = 0;
        while (j < nSym && symAt(j) === s) { reps++; j++; }
        // Split the repeat count across run codes, never emitting the same
        // code twice in a row.
        let prevTake = -1;
        while (reps > 0) {
            let take = Math.min(reps, maxReps);
            if (take === prevTake) take = take > 1 ? take - 1 : 2;
            symbols.push(base + take - 1);
            reps -= take;
            prevTake = take;
        }
    }

    const payloadLen = MSG_LEN - 2;
    const nMsgs = 1 + Math.ceil(symbols.length / payloadLen);
    // The message index is written from the top of the alphabet and must
    // stay clear of every symbol value, so it can never equal its neighbour.
    if (N - 1 - nMsgs <= base + maxReps) throw new Error("Too many messages for alphabet");

    const messages = [];
    const headerVals = [N - 1 - nMsgs, P];
    const headerCheck = (P + nMsgs) % (N - 1);
    messages.push(MAGIC + headerVals.map(v => ALPHA[v]).join("") + skipChar(headerVals[headerVals.length - 1], headerCheck));

    for (let m = 1; m < nMsgs; m++) {
        const chunk = symbols.slice((m - 1) * payloadLen, m * payloadLen);
        const check = (m + chunk.reduce((a, b) => a + b, 0)) % (N - 1);
        const body = [N - 1 - m, ...chunk];
        messages.push(body.map(v => ALPHA[v]).join("") + skipChar(body[body.length - 1], check));
    }
    for (const msg of messages) {
        if (msg.length > MSG_LEN) throw new Error("Message exceeds chat limit");
    }
    return { messages, colours: new Set(px).size, pixelsPerSymbol: P, symbolCount: symbols.length };
}

// Reference decoder: mirrors the MSC decoder so the round trip can be tested
// outside the game. Returns row-major master indices.
function decodeMessages(messages) {
    const N = ALPHA.length;
    const header = messages[0];
    if (!header.startsWith(MAGIC)) throw new Error("Bad magic");
    const val = ch => {
        const v = ALPHA.indexOf(ch);
        if (v < 0) throw new Error(`Bad character ${JSON.stringify(ch)}`);
        return v;
    };
    let pos = MAGIC.length;
    const nMsgs = N - 1 - val(header[pos++]);
    const P = val(header[pos++]);
    const K = COLOURS;
    if (P < 1 || P > 2 || nMsgs < 2) throw new Error("Header fields");
    if (header.length !== pos + 1) throw new Error("Header length");
    const headerCheck = unskip(val(header[pos - 1]), val(header[pos]));
    if (headerCheck !== (P + nMsgs) % (N - 1)) throw new Error("Header checksum");
    if (messages.length !== nMsgs) throw new Error("Message count");

    const base = K ** P;
    const stream = new Uint8Array(PIXELS);
    let p = 0;
    let lastSym = 0;
    const emit = c => {
        // Like emitPixels in MSC: pixels past the end are dropped.
        if (p < PIXELS) stream[p++] = c;
    };
    const emitSym = s => {
        if (P === 2) {
            emit(Math.floor(s / K));
            emit(s % K);
        } else {
            emit(s);
        }
    };
    for (let m = 1; m < nMsgs; m++) {
        const msg = messages[m];
        if (N - 1 - val(msg[0]) !== m) throw new Error(`Message ${m} index mismatch`);
        let sum = m;
        for (let i = 1; i < msg.length - 1; i++) {
            const s = val(msg[i]);
            sum += s;
            if (s < base) {
                emitSym(s);
                lastSym = s;
            } else {
                const reps = s - base + 1;
                for (let r = 0; r < reps; r++) emitSym(lastSym);
            }
        }
        if (unskip(val(msg[msg.length - 2]), val(msg[msg.length - 1])) !== sum % (N - 1)) throw new Error(`Message ${m} checksum`);
    }
    if (p !== PIXELS) throw new Error(`Decoded ${p} pixels`);
    return toRowMajor(stream);
}

// ---------------------------------------------------------------------------
// PAGE LOGIC
// ---------------------------------------------------------------------------

let sourceImage = null;
let currentMessages = [];
let nextToCopy = 0;
let renderTimer = null;

function $(id) {
    return document.getElementById(id);
}

function readOptions() {
    return {
        crop: $("cropToggle").checked,
        zoom: parseFloat($("zoomSlider").value),
        cx: parseFloat($("xSlider").value) / 100,
        cy: parseFloat($("ySlider").value) / 100,
        brightness: parseInt($("brightnessSlider").value, 10),
        contrast: parseInt($("contrastSlider").value, 10),
        saturation: parseInt($("saturationSlider").value, 10),
        staircase: $("staircaseSelect").value,
        dither: $("ditherSelect").value,
        maxHeight: parseInt($("maxHeightSlider").value, 10),
        msgLen: parseInt($("msgLenSelect").value, 10)
    };
}

// Draws the source onto a 128x128 canvas with crop and colour adjustments.
function renderSource(img, o) {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.filter = `brightness(${o.brightness}%) contrast(${o.contrast}%) saturate(${o.saturation}%)`;
    if (o.crop) {
        const side = Math.min(img.naturalWidth, img.naturalHeight) / o.zoom;
        const sx = (img.naturalWidth - side) * o.cx;
        const sy = (img.naturalHeight - side) * o.cy;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
    } else {
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
    }
    return canvas;
}

function renderPreview(masterIdx) {
    const canvas = document.createElement("canvas");
    canvas.width = 2 * SIZE;
    canvas.height = 2 * SIZE;
    const ctx = canvas.getContext("2d");
    for (let z = 0; z < SIZE; z++) {
        for (let x = 0; x < SIZE; x++) {
            const idx = masterIdx[z * SIZE + x];
            if (idx === TRANSPARENT) continue;
            const [r, g, b] = masterRGB[idx];
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(2 * x, 2 * z, 2, 2);
        }
    }
    return canvas.toDataURL();
}

function updateCopyButton() {
    const btn = $("copy-next-btn");
    const progress = $("msg-progress");
    const total = currentMessages.length;
    if (nextToCopy >= total) {
        btn.textContent = "All messages copied";
        btn.disabled = true;
        progress.textContent = `${total} / ${total} copied`;
    } else {
        btn.textContent = `Copy message ${nextToCopy + 1} of ${total}`;
        btn.disabled = false;
        progress.textContent = `${nextToCopy} / ${total} copied`;
    }
}

// Clipboard API first; fall back to a temporary textarea + execCommand for
// browsers or embedding contexts that block navigator.clipboard.
function copyText(text) {
    const fallback = () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) { /* nothing more to try */ }
        document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(fallback);
    } else {
        fallback();
    }
}

function copyMessage(index) {
    if (index < 0 || index >= currentMessages.length) return;
    copyText(currentMessages[index]);
    document.querySelectorAll("#msg-list li").forEach((li, i) => {
        li.classList.toggle("done", i < index + 1);
        li.classList.toggle("current", i === index + 1);
    });
    nextToCopy = index + 1;
    updateCopyButton();
}

function copyNext() {
    copyMessage(nextToCopy);
}

function resetCopying() {
    nextToCopy = 0;
    document.querySelectorAll("#msg-list li").forEach((li, i) => {
        li.classList.remove("done");
        li.classList.toggle("current", i === 0);
    });
    updateCopyButton();
}

function showMessages(result) {
    currentMessages = result.messages;
    const list = $("msg-list");
    list.innerHTML = "";
    result.messages.forEach((msg, i) => {
        const li = document.createElement("li");
        li.title = "Click to copy";
        li.innerHTML = `<span class="msg-num">${i + 1}</span><code class="msg-body"></code>`;
        li.querySelector(".msg-body").textContent = msg;
        li.addEventListener("click", () => copyMessage(i));
        list.appendChild(li);
    });
    resetCopying();
}

// Full pipeline for the current controls. Debounced by scheduleRender so
// slider drags stay responsive.
function render() {
    if (!sourceImage) return;
    const o = readOptions();
    const src = renderSource(sourceImage, o);
    $("source-image").src = src.toDataURL();
    const pixels = src.getContext("2d").getImageData(0, 0, SIZE, SIZE).data;

    const masterIdx = quantise(pixels, o);
    const { maxHeight } = mapHeights(masterIdx, o.staircase);

    let result;
    try {
        result = encodeMap(masterIdx, o.msgLen);
    } catch (error) {
        $("stats-text").textContent = `Could not encode image: ${error.message}`;
        return;
    }

    const url = renderPreview(masterIdx);
    const mapImage = $("map-image");
    mapImage.src = url;
    mapImage.onclick = function () {
        const link = document.createElement("a");
        link.href = url;
        link.download = "minecraft-map.png";
        link.click();
    };

    showMessages(result);
    const heightNote = o.staircase === "valley" ? `, tallest column ${maxHeight} block${maxHeight === 1 ? "" : "s"} above the floor` : "";
    const longest = Math.max(...result.messages.map(m => m.length));
    $("stats-text").textContent =
        `${result.messages.length} messages, longest ${longest} characters, ${result.colours} colours, ${result.pixelsPerSymbol} pixel${result.pixelsPerSymbol === 1 ? "" : "s"} per character${heightNote}.`;
    $("output").style.display = "block";
}

// Paste a message back in to find out whether it survived the trip to
// Minecraft. Reports length, foreign characters, index and checksum, and
// diffs against the generated message when one matches.
function verifyMessage() {
    const raw = $("verify-input").value.trim();
    const out = $("verify-result");
    const say = (cls, text) => { out.className = cls; out.textContent = text; };
    if (!raw) {
        say("muted", "Paste a message above first.");
        return;
    }
    const N = ALPHA.length;
    const chars = Array.from(raw);
    const foreign = chars.map((c, i) => [i, c]).filter(([, c]) => ALPHA.indexOf(c) < 0 && !MAGIC.includes(c));
    const isHeader = raw.startsWith(MAGIC);

    // Compare against the generated set when we can identify the message.
    let mine = null;
    if (currentMessages.length) {
        if (isHeader) {
            mine = currentMessages[0];
        } else {
            const idx = N - 1 - ALPHA.indexOf(chars[0]);
            if (idx > 0 && idx < currentMessages.length) mine = currentMessages[idx];
        }
    }

    // The payload sum is what the in-game [diag] line prints, so quoting it
    // here lets the two be compared directly.
    const sumOf = cs => {
        const body = cs[0] === MAGIC[0] && raw.startsWith(MAGIC) ? cs.slice(MAGIC.length) : cs;
        let t = 0;
        for (let i = 1; i < body.length - 1; i++) t += ALPHA.indexOf(body[i]);
        return t;
    };
    if (mine && mine === raw) {
        say("ok-text", `Intact. ${chars.length} characters, payload sum ${sumOf(chars)}, matches the message on this page exactly.`);
        return;
    }
    if (mine) {
        const theirs = Array.from(mine);
        let k = 0;
        while (k < theirs.length && k < chars.length && theirs[k] === chars[k]) k++;
        const lenNote = chars.length === theirs.length
            ? `same length (${chars.length})`
            : `length ${chars.length}, should be ${theirs.length} (${theirs.length - chars.length} character${Math.abs(theirs.length - chars.length) === 1 ? "" : "s"} lost)`;
        const dropped = theirs[k] === undefined ? "" : ` First difference at position ${k + 1}: expected ${theirs[k]} (U+${theirs[k].codePointAt(0).toString(16).toUpperCase()}), got ${chars[k] === undefined ? "end of message" : chars[k] + " (U+" + chars[k].codePointAt(0).toString(16).toUpperCase() + ")"}.`;
        say("bad-text", `Damaged: ${lenNote}. Payload sum ${sumOf(chars)}, should be ${sumOf(theirs)}.${dropped}`);
        return;
    }

    // No matching generated message; fall back to self-consistency checks.
    if (foreign.length) {
        say("bad-text", `Damaged: ${foreign.length} character(s) are not part of the alphabet, first at position ${foreign[0][0] + 1}.`);
        return;
    }
    const body = isHeader ? chars.slice(MAGIC.length) : chars;
    const vals = body.map(c => ALPHA.indexOf(c));
    const check = unskip(vals[vals.length - 2], vals[vals.length - 1]);
    const payload = vals.slice(isHeader ? 0 : 1, vals.length - 1);
    const seed = isHeader ? 0 : N - 1 - vals[0];
    const expect = (seed + payload.reduce((a, b) => a + b, 0)) % (N - 1);
    if (check === expect) {
        say("ok-text", `Checksum is correct (${chars.length} characters). Generate the image again on this page to compare character by character.`);
    } else {
        const missing = (check - expect + N - 1) % (N - 1);
        say("bad-text", `Damaged: checksum is off by ${missing}, which is what one lost character of value ${missing} would do (${ALPHA[missing]}).`);
    }
}

function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 80);
}

function updateCropControls() {
    $("crop-controls").style.display = $("cropToggle").checked ? "" : "none";
    $("height-controls").style.display = $("staircaseSelect").value === "valley" ? "" : "none";
}

function resetAdjustments() {
    $("zoomSlider").value = 1;
    $("xSlider").value = 50;
    $("ySlider").value = 50;
    $("brightnessSlider").value = 100;
    $("contrastSlider").value = 100;
    $("saturationSlider").value = 100;
    updateSliderLabels();
    scheduleRender();
}

function updateSliderLabels() {
    for (const id of ["zoom", "x", "y", "brightness", "contrast", "saturation", "maxHeight"]) {
        const slider = $(id + "Slider");
        const label = $(id + "Value");
        if (!slider || !label) continue;
        if (id === "zoom") label.textContent = `${parseFloat(slider.value).toFixed(2)}x`;
        else if (id === "maxHeight") label.textContent = `${slider.value} blocks`;
        else label.textContent = `${slider.value}%`;
    }
}

function loadFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
        const image = new Image();
        image.onload = () => {
            sourceImage = image;
            render();
        };
        image.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        const ditherSelect = $("ditherSelect");
        for (const [key, d] of Object.entries(DITHERS)) {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = d.label;
            ditherSelect.appendChild(opt);
        }
        ditherSelect.value = "FloydSteinberg";
        const staircaseSelect = $("staircaseSelect");
        for (const [key, s] of Object.entries(STAIRCASE)) {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = s.label;
            staircaseSelect.appendChild(opt);
        }
        staircaseSelect.value = "valley";

        $("imageUpload").addEventListener("change", function () {
            $("file-label").textContent = this.files[0]?.name || "Choose File";
            loadFile(this.files[0]);
        });
        $("cropToggle").addEventListener("change", () => { updateCropControls(); scheduleRender(); });
        for (const id of ["zoomSlider", "xSlider", "ySlider", "brightnessSlider", "contrastSlider", "saturationSlider", "maxHeightSlider"]) {
            $(id).addEventListener("input", () => { updateSliderLabels(); scheduleRender(); });
        }
        $("msgLenSelect").addEventListener("change", scheduleRender);
        $("ditherSelect").addEventListener("change", scheduleRender);
        $("staircaseSelect").addEventListener("change", () => { updateCropControls(); scheduleRender(); });
        updateCropControls();
        updateSliderLabels();
    });
}

// Node export for the round-trip tests (ignored in the browser).
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        BLOCK_NAMES, MASTER_COUNT, COLOURS, masterRGB, ALPHA, ALPHABET_RANGES, DEFAULT_MSG_LEN, MAGIC, MAX_REPS, TRANSPARENT, skipChar, unskip,
        DITHERS, quantise, encodeMap, decodeMessages, classicHeights, valleyHeights, valleyHeightsReference, mapHeights,
        toneOf, blockOf, masterOf
    };
}

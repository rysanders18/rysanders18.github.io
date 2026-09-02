// Round-trip test for the RYmaphub encoder: encode synthetic images, decode
// with the reference decoder (mirror of the MSC decoder), compare, check the
// Valley height algorithm against a direct port of MapartCraft's, and check
// the MSC namespace file agrees with script.js.
// Run: NMS_DIR=<Minr-Scrips/rymaphub dir> node test_roundtrip.js
const fs = require("fs");
const path = require("path");
const M = require("./script.js");

const SIZE = 128, PIXELS = SIZE * SIZE;
let failures = 0;
function check(cond, what) { if (!cond) { failures++; console.log("FAIL:", what); } }

function photoLike(seed) {
    let s = seed;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const px = new Uint8ClampedArray(PIXELS * 4);
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
        const i = (z * SIZE + x) * 4;
        px[i] = 255 * (x / SIZE) * 0.8 + 40 * rnd();
        px[i + 1] = 255 * (z / SIZE) * 0.8 + 40 * rnd();
        px[i + 2] = 128 + 100 * Math.sin(x / 9) * Math.cos(z / 11) + 30 * rnd();
        px[i + 3] = 255;
    }
    return px;
}

function flatLogo() {
    const px = new Uint8ClampedArray(PIXELS * 4);
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
        const i = (z * SIZE + x) * 4;
        const inCircle = (x - 64) ** 2 + (z - 64) ** 2 < 40 ** 2;
        const stripe = ((x + z) >> 4) % 2 === 0;
        let c = inCircle ? [255, 0, 0] : stripe ? [255, 255, 255] : [51, 76, 178];
        if (z < 10 || (z > 60 && z < 70 && x < 30)) c = null; // transparent band and hole
        if (c) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; }
    }
    return px;
}

// Solid and near-solid images: a run of 8192 identical symbols forces many
// consecutive run codes, which must still never repeat a character.
function solid(colour, stripeEvery) {
    const px = new Uint8ClampedArray(PIXELS * 4);
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
        const i = (z * SIZE + x) * 4;
        const c = stripeEvery && z % stripeEvery === 0 ? [0, 0, 0] : colour;
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
    return px;
}

// Sign constraints every height assignment must satisfy.
function heightsValid(column, h) {
    if (h.length !== SIZE + 1) return false;
    for (let z = 0; z < SIZE; z++) {
        const m = column[z];
        if (h[z + 1] < 0) return false;
        if (m === M.TRANSPARENT) continue;
        if (z > 0 && column[z - 1] === M.TRANSPARENT) continue; // compared with the void
        const tone = M.toneOf(m);
        const d = h[z + 1] - h[z];
        if (tone === 0 && !(d < 0)) return false;
        if (tone === 1 && d !== 0) return false;
        if (tone === 2 && !(d > 0)) return false;
    }
    return h.every(v => v >= 0);
}

// 1. Valley heights: segment formulation vs MapartCraft port, random columns.
{
    let s = 7;
    const rnd = n => { s = (s * 1664525 + 1013904223) >>> 0; return s % n; };
    let mismatches = 0, invalid = 0;
    for (let t = 0; t < 3000; t++) {
        const column = new Array(SIZE);
        const bias = rnd(3);
        for (let z = 0; z < SIZE; z++) {
            const tone = bias === 0 ? rnd(3) : bias === 1 ? [0, 1, 1, 2][rnd(4)] : [2, 2, 1, 0][rnd(4)];
            column[z] = rnd(20) === 0 ? M.TRANSPARENT : M.masterOf(rnd(5), tone);
        }
        const a = M.valleyHeights(column);
        const b = M.valleyHeightsReference(column);
        if (a.join() !== b.join()) mismatches++;
        if (!heightsValid(column, a)) invalid++;
    }
    check(mismatches === 0, `valley segment vs reference: ${mismatches} mismatches`);
    check(invalid === 0, `valley heights violate tone constraints in ${invalid} columns`);
    console.log("valley heights: 3000 random columns agree with MapartCraft port");
}

// 2. Encode/decode round trips and size stats.
const cases = [
    ["photo, valley, Floyd-Steinberg", photoLike(1), { staircase: "valley", dither: "FloydSteinberg", maxHeight: 32 }],
    ["photo, valley, FS, unlimited", photoLike(1), { staircase: "valley", dither: "FloydSteinberg" }],
    ["photo, valley, Bayer 4x4", photoLike(1), { staircase: "valley", dither: "Bayer44", maxHeight: 32 }],
    ["photo, valley, none, h<=8", photoLike(1), { staircase: "valley", dither: "None", maxHeight: 8 }],
    ["photo, flat, Floyd-Steinberg", photoLike(1), { staircase: "off", dither: "FloydSteinberg" }],
    ["logo, valley, Atkinson", flatLogo(), { staircase: "valley", dither: "Atkinson", maxHeight: 32 }],
    ["logo, flat, none", flatLogo(), { staircase: "off", dither: "None" }],
    ["solid white, valley, none", solid([255, 255, 255], 0), { staircase: "valley", dither: "None", maxHeight: 32 }],
    ["solid white, flat, none", solid([255, 255, 255], 0), { staircase: "off", dither: "None" }],
    ["striped, flat, none", solid([255, 255, 255], 17), { staircase: "off", dither: "None" }],
];
for (const [name, px, opts] of cases) {
    const idx = M.quantise(px, opts);
    // flat mode may only use normal tones, except forced-light south of transparency
    if (opts.staircase === "off") {
        for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
            const m = idx[z * SIZE + x];
            if (m === M.TRANSPARENT) continue;
            const northT = z > 0 && idx[(z - 1) * SIZE + x] === M.TRANSPARENT;
            check(M.toneOf(m) === (northT ? 2 : 1), `${name}: tone rule broken at ${x},${z}`);
        }
    }
    const r = M.encodeMap(idx, 250);
    const maxLen = Math.max(...r.messages.map(m => m.length));
    for (const [i, m] of r.messages.entries()) {
        check(m.length <= 256, `${name} msg ${i} length ${m.length}`);
        const body = i === 0 ? m.slice(5) : m;
        for (const ch of body) check(M.ALPHA.includes(ch), `${name} msg ${i} char ${JSON.stringify(ch)} not in alphabet`);
    }
    // Protocol v3: no two adjacent characters may ever be equal, because
    // Minr chat dropped one character from a run of eight in v2.
    for (const [i, m] of r.messages.entries()) {
        const body = i === 0 ? m.slice(M.MAGIC.length) : m;
        for (let c = 1; c < body.length; c++) {
            check(body[c] !== body[c - 1], `${name} msg ${i}: repeated character at ${c}`);
        }
    }
    const back = M.decodeMessages(r.messages);
    check(back.length === idx.length && back.every((v, i) => v === idx[i]), `${name} round trip mismatch`);
    const { heights, maxHeight } = M.mapHeights(back, opts.staircase);
    let bad = 0;
    for (let x = 0; x < SIZE; x++) {
        const column = []; for (let z = 0; z < SIZE; z++) column.push(back[z * SIZE + x]);
        const h = Array.from(heights.subarray(x * 129, x * 129 + 129));
        if (!heightsValid(column, h)) bad++;
    }
    check(bad === 0, `${name}: ${bad} columns with invalid heights`);
    if (opts.maxHeight !== undefined) check(maxHeight <= opts.maxHeight, `${name}: max height ${maxHeight} exceeds limit ${opts.maxHeight}`);
    console.log(`${name.padEnd(32)} ${String(r.messages.length).padStart(3)} msgs, ${String(r.colours).padStart(3)} colours, ` +
        `P=${r.pixelsPerSymbol}, ${r.symbolCount} symbols, max len ${maxLen}, max height ${maxHeight}`);
}

// 3. Corruption must be detected.
{
    const r = M.encodeMap(M.quantise(photoLike(2), { staircase: "valley", dither: "FloydSteinberg" }), 250);
    const trunc = r.messages.slice(); trunc[5] = trunc[5].slice(0, -3);
    let caught = false; try { M.decodeMessages(trunc); } catch (e) { caught = true; }
    check(caught, "truncated message not detected");
    const subst = r.messages.slice(); subst[2] = subst[2].slice(0, 20) + M.ALPHA[0] + subst[2].slice(21);
    caught = false; try { M.decodeMessages(subst); } catch (e) { caught = true; }
    check(caught, "substituted character not detected");
    const hdr = r.messages.slice(); hdr[0] = hdr[0].slice(0, 7) + M.ALPHA[3] + hdr[0].slice(8);
    caught = false; try { M.decodeMessages(hdr); } catch (e) { caught = true; }
    check(caught, "header corruption not detected");
}

// 4. The MSC namespace file must agree with script.js.
if (process.env.NMS_DIR) {
    const nms = fs.readFileSync(path.join(process.env.NMS_DIR, "rymaphub.nms"), "utf8");
    const colours = parseInt(nms.match(/Int colours = (\d+)/)[1], 10);
    check(colours === M.COLOURS, `colours differs: .nms ${colours}, script.js ${M.COLOURS}`);
    const u = nms.match(/String alphaU = "(.*)"/)[1];
    check(u === M.ALPHA, `alphaU differs between .nms (${u.length}) and script.js (${M.ALPHA.length})`);
    const blocks = nms.match(/String\[\] blocks = String\[(.*)\]/)[1].split(", ").map(s => s.slice(1, -1));
    check(JSON.stringify(blocks) === JSON.stringify(M.BLOCK_NAMES), "block list differs between .nms and script.js");
    console.log("rymaphub.nms alphabet and block list match");
} else {
    console.log("NMS_DIR not set; skipping .nms consistency check");
}

// 5. Every message length setting must round-trip and keep the
// no-adjacent-duplicates property.
{
    const idx = M.quantise(photoLike(3), { staircase: "valley", dither: "FloydSteinberg", maxHeight: 32 });
    for (const len of [60, 80, 100, 150, 200, 250]) {
        const r = M.encodeMap(idx, len);
        const longest = Math.max(...r.messages.map(m => m.length));
        check(longest <= len, `msgLen ${len}: longest message is ${longest}`);
        for (const [i, m] of r.messages.entries()) {
            const body = i === 0 ? m.slice(M.MAGIC.length) : m;
            for (let c = 1; c < body.length; c++) {
                check(body[c] !== body[c - 1], `msgLen ${len} msg ${i}: repeated character at ${c}`);
            }
        }
        const back = M.decodeMessages(r.messages);
        check(back.every((v, k) => v === idx[k]), `msgLen ${len}: round trip mismatch`);
        console.log(`msgLen ${String(len).padStart(3)}: ${String(r.messages.length).padStart(4)} messages, longest ${longest}`);
    }
}

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURES`);
process.exit(failures ? 1 : 0);

// Round-trip test for the RYmaphub encoder: encode synthetic images, decode
// with the reference decoder (mirror of the MSC decoder), compare, and
// report message counts and command counts. Run: node test_roundtrip.js
const fs = require("fs");
const path = require("path");
const M = require("./script.js");

const SIZE = 128, PIXELS = SIZE * SIZE;

function photoLike(seed) {
    // Smooth gradients plus noise: a stand-in for a real photo.
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
        if (z < 10) c = null; // transparent band
        if (c) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; }
    }
    return px;
}

function commandCount(masterIdx) {
    let cmds = 0;
    for (let z = 0; z < SIZE; z++) {
        let prev = -1;
        for (let x = 0; x < SIZE; x++) {
            const v = masterIdx[z * SIZE + x];
            if (v !== prev) { if (v !== 0) cmds++; prev = v; }
        }
    }
    return cmds;
}

let failures = 0;
function check(cond, what) { if (!cond) { failures++; console.log("FAIL:", what); } }

const cases = [
    ["photo-like, dithered", photoLike(1), true],
    ["photo-like, no dither", photoLike(1), false],
    ["flat logo, dithered", flatLogo(), true],
];
for (const [name, px, dither] of cases) {
    const idx = M.quantise(px, 4, dither);
    for (const mode of ["U", "A"]) {
        const r = M.encodeMap(idx, mode);
        const alpha = M.MODES[mode].alpha;
        const maxLen = Math.max(...r.messages.map(m => m.length));
        for (const [i, m] of r.messages.entries()) {
            check(m.length <= 256, `${name}/${mode} msg ${i} length ${m.length}`);
            const body = i === 0 ? m.slice(6) : m;
            for (const ch of body) check(alpha.includes(ch), `${name}/${mode} msg ${i} char ${JSON.stringify(ch)} not in alphabet`);
            check(!/[\s"&\/\%{}#@!§]/.test(body), `${name}/${mode} msg ${i} unsafe char`);
        }
        const back = M.decodeMessages(r.messages);
        let same = back.length === idx.length && back.every((v, i) => v === idx[i]);
        check(same, `${name}/${mode} round trip mismatch`);
        console.log(`${name.padEnd(24)} mode ${mode}: ${String(r.messages.length).padStart(3)} messages, ` +
            `${r.palette.length} blocks, ${r.symbolCount} symbols, max len ${maxLen}, ${commandCount(idx)} commands`);
    }
}

// Corruption must be detected.
{
    const idx = M.quantise(photoLike(2), 4, true);
    const r = M.encodeMap(idx, "U");
    const msgs = r.messages.slice();
    const m = msgs[3];
    msgs[3] = m.slice(0, 10) + m[11] + m[10] + m.slice(12); // swap two chars: sum unchanged, pixels change
    // A swap keeps the checksum, so test truncation and substitution instead.
    const trunc = r.messages.slice(); trunc[5] = trunc[5].slice(0, -3);
    let caught = false; try { M.decodeMessages(trunc); } catch (e) { caught = /checksum|index|Bad/.test(e.message); }
    check(caught, "truncated message not detected");
    const subst = r.messages.slice(); subst[2] = subst[2].slice(0, 20) + M.ALPHA_U[0] + subst[2].slice(21);
    caught = false; try { M.decodeMessages(subst); } catch (e) { caught = true; }
    check(caught, "substituted character not detected");
}

// Alphabets in rymaphub.nms must match script.js.
const nms = fs.readFileSync(path.join(process.env.NMS_DIR, "rymaphub.nms"), "utf8");
const a = nms.match(/String alphaA = "(.*)"/)[1];
const u = nms.match(/String alphaU = "(.*)"/)[1];
check(a === M.ALPHA_A, "alphaA differs between .nms and script.js");
check(u === M.ALPHA_U, "alphaU differs between .nms and script.js");
const blocks = nms.match(/String\[\] blocks = String\[(.*)\]/)[1].split(", ").map(s => s.slice(1, -1));
check(JSON.stringify(blocks) === JSON.stringify(M.MASTER), "block list differs between .nms and script.js");

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURES`);
process.exit(failures ? 1 : 0);

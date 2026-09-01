// RYmaphub - image -> Minecraft map art -> chat messages.
//
// Pipeline:
//   1. Scale the image to 128x128 and quantise every pixel to the nearest
//      map-art block (distance measured in CIE-L*a*b*), optionally with
//      Floyd-Steinberg dithering.
//   2. Encode the 16,384 block indices as a stream of symbols (one symbol
//      = one chat character) and split that stream into chat-sized
//      messages with an index and checksum on each.
//   3. The user pastes the messages into Minr chat; the rymaphub MSC
//      script decodes them and places the blocks.
//
// The encoding contract in the ENCODING section below must match the
// MSC decoder (rymaphub::importMapArt / decodeMapArt) exactly. The
// decoder lives in the Minr-Scrips repo under rymaphub/.

// ---------------------------------------------------------------------------
// PALETTE
// ---------------------------------------------------------------------------

// Map-art blocks and the RGB colour they render on a map. Order matters:
// the MSC decoder holds the same list (with "glass" prepended) and the
// palette in the header message refers to positions in that list.
const colours = {
    "grass_block": [127, 178, 56],
    "sand": [247, 233, 163],
    "diorite": [255, 252, 245],
    "redstone_block": [255, 0, 0],
    "cobweb": [199, 199, 199],
    "big_dripleaf": [0, 124, 0],
    "packed_ice": [160, 160, 255],
    "iron_block": [167, 167, 167],
    "white_concrete": [255, 255, 255],
    "clay": [164, 168, 184],
    "dirt": [151, 109, 77],
    "stone": [112, 112, 112],
    "oak_leaves[waterlogged=true]": [64, 64, 225],
    "oak_planks": [143, 119, 72],
    "acacia_planks": [216, 127, 51],
    "magenta_wool": [178, 76, 216],
    "light_blue_wool": [102, 153, 216],
    "yellow_wool": [229, 229, 51],
    "lime_wool": [127, 204, 25],
    "pink_wool": [242, 127, 165],
    "light_gray_wool": [153, 153, 153],
    "cyan_wool": [76, 127, 153],
    "blue_wool": [51, 76, 178],
    "dark_oak_planks": [102, 76, 51],
    "green_wool": [102, 127, 51],
    "red_wool": [153, 51, 51],
    "black_wool": [25, 25, 25],
    "gold_block": [250, 238, 77],
    "diamond_block": [92, 219, 213],
    "lapis_block": [74, 128, 255],
    "emerald_block": [0, 217, 58],
    "podzol": [129, 86, 49],
    "netherrack": [112, 2, 0],
    "white_terracotta": [209, 177, 161],
    "orange_terracotta": [159, 82, 36],
    "magenta_terracotta": [149, 87, 108],
    "light_blue_terracotta": [112, 108, 138],
    "yellow_terracotta": [186, 133, 36],
    "lime_terracotta": [103, 117, 53],
    "pink_terracotta": [160, 77, 78],
    "gray_terracotta": [57, 41, 35],
    "light_gray_terracotta": [135, 107, 98],
    "cyan_terracotta": [87, 92, 92],
    "purple_terracotta": [122, 73, 88],
    "blue_terracotta": [76, 62, 92],
    "brown_terracotta": [76, 50, 35],
    "green_terracotta": [76, 82, 42],
    "red_terracotta": [142, 60, 46],
    "black_terracotta": [37, 22, 16],
    "crimson_nylium": [189, 48, 49],
    "warped_nylium": [22, 126, 134],
    "deepslate": [100, 100, 100],
    "raw_iron_block": [216, 175, 14]
};

// Master block list. Index 0 is the transparent "glass" pixel (the base
// block the hub area is filled with); the decoder never places it.
const MASTER = ["glass", ...Object.keys(colours)];
const TRANSPARENT = 0;

// RGB values in MASTER order (glass gets a placeholder).
const masterRGB = MASTER.map(name => name === "glass" ? [0, 0, 0] : colours[name]);

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
// (The constant -16 on L is omitted: only relative distances matter.)
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

function squaredDistance(c1, c2) {
    return (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2;
}

// Nearest opaque block (MASTER index >= 1) to an RGB triple.
function findClosestMaster(rgb) {
    const lab = convertToCIELAB(rgb);
    let best = 1;
    let bestDist = Infinity;
    for (let i = 1; i < MASTER.length; i++) {
        const d = squaredDistance(lab, masterLAB[i]);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return best;
}

// ---------------------------------------------------------------------------
// QUANTISATION
// ---------------------------------------------------------------------------

const SIZE = 128;
const PIXELS = SIZE * SIZE;
const ALPHA_CUTOFF = 100;

// pixels: flat RGBA (or RGB) byte array of a 128x128 image.
// Returns a Uint8Array of MASTER indices, row-major, z (row) then x.
function quantise(pixels, channels, dither) {
    const out = new Uint8Array(PIXELS);

    // Working copy of the RGB values as floats so dithering error can be
    // pushed into neighbouring pixels.
    const work = new Float32Array(PIXELS * 3);
    const opaque = new Uint8Array(PIXELS);
    for (let p = 0; p < PIXELS; p++) {
        const i = p * channels;
        work[p * 3] = pixels[i];
        work[p * 3 + 1] = pixels[i + 1];
        work[p * 3 + 2] = pixels[i + 2];
        opaque[p] = (channels === 4 ? pixels[i + 3] : 255) >= ALPHA_CUTOFF ? 1 : 0;
    }

    const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

    // Serpentine Floyd-Steinberg: alternate scan direction per row, which
    // avoids the diagonal streaking of a plain left-to-right scan.
    for (let z = 0; z < SIZE; z++) {
        const leftToRight = !dither || z % 2 === 0;
        for (let step = 0; step < SIZE; step++) {
            const x = leftToRight ? step : SIZE - 1 - step;
            const p = z * SIZE + x;
            if (!opaque[p]) {
                out[p] = TRANSPARENT;
                continue;
            }
            const r = clamp(work[p * 3]);
            const g = clamp(work[p * 3 + 1]);
            const b = clamp(work[p * 3 + 2]);
            const idx = findClosestMaster([r, g, b]);
            out[p] = idx;
            if (!dither) continue;

            const [pr, pg, pb] = masterRGB[idx];
            const err = [r - pr, g - pg, b - pb];
            const dx = leftToRight ? 1 : -1;
            const spread = (xx, zz, weight) => {
                if (xx < 0 || xx >= SIZE || zz >= SIZE) return;
                const q = zz * SIZE + xx;
                if (!opaque[q]) return;
                work[q * 3] += err[0] * weight;
                work[q * 3 + 1] += err[1] * weight;
                work[q * 3 + 2] += err[2] * weight;
            };
            spread(x + dx, z, 7 / 16);
            spread(x - dx, z + 1, 3 / 16);
            spread(x, z + 1, 5 / 16);
            spread(x + dx, z + 1, 1 / 16);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// ENCODING  (contract shared with the MSC decoder - keep in sync)
// ---------------------------------------------------------------------------
//
// Alphabets. A symbol is one chat character; its value is its position in
// the alphabet string. The decoder recovers it with String.indexOf, which
// is the only character->number primitive MSC has.
//
//   "A" (ASCII):   printable ASCII 33..126 minus characters that are unsafe
//                  in chat or MSC string literals. 84 symbols.
//   "U" (Unicode): 2980 consecutive CJK ideographs starting at U+4E00. One
//                  UTF-16 unit each, so 1 chat character each.
//
// Stream format. Let K = number of distinct blocks used, P = pixels per
// plain symbol (1 for ASCII, 2 for Unicode), base = K^P, N = alphabet size.
//   symbol s <  base : P pixels. P=1: s. P=2: floor(s/K) then s%K.
//   symbol s >= base : run code - repeat the previous pixel (s-base+2) more times.
// Runs may span rows and messages; the decoder keeps "last pixel" state.
//
// Messages (each <= MSG_LEN characters):
//   header : "RYMH1" + mode + A[nMsgs] + A[K] + A[palette[0..K-1]] + A[check]
//            check = (nMsgs + K + sum(palette)) % N
//   data i : A[i] + payload + A[check],  i = 1..nMsgs-1
//            check = (i + sum(payload symbol values)) % N
// palette[] entries are MASTER indices.

const MSG_LEN = 250;          // Minecraft chat allows 256; leave headroom
const MAGIC = "RYMH1";
const UNICODE_BASE = 0x4E00;
const UNICODE_SIZE = 2980;    // 54^2 pair symbols + 64 run codes

const ALPHA_A = (() => {
    const unsafe = '"&/\\%{}#@!';
    let s = "";
    for (let c = 33; c <= 126; c++) {
        const ch = String.fromCharCode(c);
        if (!unsafe.includes(ch)) s += ch;
    }
    return s;
})();

const ALPHA_U = (() => {
    let s = "";
    for (let i = 0; i < UNICODE_SIZE; i++) s += String.fromCharCode(UNICODE_BASE + i);
    return s;
})();

const MODES = {
    A: { alpha: ALPHA_A, pixelsPerSymbol: 1, label: "ASCII" },
    U: { alpha: ALPHA_U, pixelsPerSymbol: 2, label: "Unicode" }
};

// masterIdx: Uint8Array of PIXELS MASTER indices. mode: "A" or "U".
function encodeMap(masterIdx, mode) {
    const { alpha, pixelsPerSymbol: P } = MODES[mode];
    const N = alpha.length;

    // Per-image palette: the distinct MASTER indices, ascending.
    const palette = [...new Set(masterIdx)].sort((a, b) => a - b);
    const K = palette.length;
    const local = new Map(palette.map((m, i) => [m, i]));
    const px = Array.from(masterIdx, m => local.get(m));

    const base = K ** P;
    const runCodes = N - base;
    if (runCodes < 1) throw new Error(`Palette of ${K} blocks does not fit mode ${mode}`);
    const maxRun = runCodes + 1;

    // Symbol stream.
    const symbols = [];
    let i = 0;
    let last = -1;
    while (i < px.length) {
        if (P === 2) {
            // Runs can leave an odd number of pixels; a lone final pixel
            // is paired with itself and the decoder drops the overflow.
            const second = i + 1 < px.length ? px[i + 1] : px[i];
            symbols.push(px[i] * K + second);
            last = second;
            i += 2;
        } else {
            symbols.push(px[i]);
            last = px[i];
            i += 1;
        }
        // Absorb a following run of the same colour into run codes.
        while (i < px.length && px[i] === last) {
            let len = 0;
            while (i + len < px.length && px[i + len] === last && len < maxRun) len++;
            if (len < 2) break;
            symbols.push(base + len - 2);
            i += len;
        }
    }

    // Split into messages.
    const payloadLen = MSG_LEN - 2;
    const nMsgs = 1 + Math.ceil(symbols.length / payloadLen);
    if (nMsgs > N - 1) throw new Error("Too many messages for alphabet");

    const messages = [];
    const headerBody = [nMsgs, K, ...palette];
    const headerCheck = headerBody.reduce((a, b) => a + b, 0) % N;
    messages.push(MAGIC + mode + headerBody.map(v => alpha[v]).join("") + alpha[headerCheck]);

    for (let m = 1; m < nMsgs; m++) {
        const chunk = symbols.slice((m - 1) * payloadLen, m * payloadLen);
        const check = (m + chunk.reduce((a, b) => a + b, 0)) % N;
        messages.push(alpha[m] + chunk.map(v => alpha[v]).join("") + alpha[check]);
    }

    for (const msg of messages) {
        if (msg.length > MSG_LEN) throw new Error("Message exceeds chat limit");
    }

    return { messages, palette, symbolCount: symbols.length, mode };
}

// Reference decoder: mirrors the MSC decoder so the round trip can be
// tested outside the game. Returns a Uint8Array of MASTER indices.
function decodeMessages(messages) {
    const header = messages[0];
    if (!header.startsWith(MAGIC)) throw new Error("Bad magic");
    const mode = header[MAGIC.length];
    const { alpha, pixelsPerSymbol: P } = MODES[mode];
    const N = alpha.length;
    const val = ch => {
        const v = alpha.indexOf(ch);
        if (v < 0) throw new Error(`Bad character ${JSON.stringify(ch)}`);
        return v;
    };

    let pos = MAGIC.length + 1;
    const nMsgs = val(header[pos++]);
    const K = val(header[pos++]);
    const palette = [];
    for (let j = 0; j < K; j++) palette.push(val(header[pos++]));
    const headerCheck = val(header[pos++]);
    if (headerCheck !== (nMsgs + K + palette.reduce((a, b) => a + b, 0)) % N) throw new Error("Header checksum");
    if (messages.length !== nMsgs) throw new Error("Message count");

    const base = K ** P;
    const out = new Uint8Array(PIXELS);
    let p = 0;
    let last = 0;
    const emit = c => {
        // Like emitPixels in MSC: pixels past the end are dropped.
        if (p < PIXELS) out[p++] = palette[c];
        last = c;
    };
    for (let m = 1; m < nMsgs; m++) {
        const msg = messages[m];
        if (val(msg[0]) !== m) throw new Error(`Message ${m} index mismatch`);
        let sum = m;
        for (let i = 1; i < msg.length - 1; i++) {
            const s = val(msg[i]);
            sum += s;
            if (s < base) {
                if (P === 2) {
                    emit(Math.floor(s / K));
                    emit(s % K);
                } else {
                    emit(s);
                }
            } else {
                const n = s - base + 2;
                for (let r = 0; r < n; r++) emit(last);
            }
        }
        if (val(msg[msg.length - 1]) !== sum % N) throw new Error(`Message ${m} checksum`);
    }
    if (p !== PIXELS) throw new Error(`Decoded ${p} pixels`);
    return out;
}

// ---------------------------------------------------------------------------
// PAGE LOGIC
// ---------------------------------------------------------------------------

let currentMessages = [];
let nextToCopy = 0;

function renderPreview(masterIdx) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
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
    const btn = document.getElementById("copy-next-btn");
    const progress = document.getElementById("msg-progress");
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
    const items = document.querySelectorAll("#msg-list li");
    items.forEach((li, i) => {
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
    const list = document.getElementById("msg-list");
    list.innerHTML = "";
    result.messages.forEach((msg, i) => {
        const li = document.createElement("li");
        li.title = "Click to copy";
        li.innerHTML = `<span class="msg-num">${i + 1}</span><code class="msg-body"></code>`;
        li.querySelector(".msg-body").textContent = msg;
        li.addEventListener("click", () => copyMessage(i));
        list.appendChild(li);
    });
    const label = MODES[result.mode].label;
    document.getElementById("stats-text").textContent =
        `${result.messages.length} messages, ${result.palette.length} blocks, ${label} encoding.`;
    resetCopying();
}

async function processImage() {
    const imageUpload = document.getElementById("imageUpload");
    const file = imageUpload.files[0];
    if (!file) {
        alert("Please select an image to upload.");
        return;
    }
    const dither = document.getElementById("ditherToggle").checked;
    const mode = document.getElementById("modeSelect").value;

    const reader = new FileReader();
    reader.onload = function (event) {
        const image = new Image();
        image.onload = function () {
            const canvas = document.createElement("canvas");
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0, SIZE, SIZE);
            const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
            const pixels = imageData.data;
            const channels = pixels.length / PIXELS;

            const masterIdx = quantise(pixels, channels, dither);
            let result;
            try {
                result = encodeMap(masterIdx, mode);
            } catch (error) {
                alert(`Could not encode image: ${error.message}`);
                return;
            }

            const mapImage = document.getElementById("map-image");
            const url = renderPreview(masterIdx);
            mapImage.src = url;
            mapImage.onclick = function () {
                const link = document.createElement("a");
                link.href = url;
                link.download = "minecraft-map.png";
                link.click();
            };

            showMessages(result);
            document.getElementById("output").style.display = "block";
        };
        image.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

if (typeof document !== "undefined") {
    document.getElementById("imageUpload").addEventListener("change", function () {
        const label = document.querySelector(".file-upload-label");
        label.textContent = this.files[0]?.name || "Choose File";
    });
}

// Node export for the round-trip tests (ignored in the browser).
if (typeof module !== "undefined" && module.exports) {
    module.exports = { MASTER, ALPHA_A, ALPHA_U, MODES, MSG_LEN, MAGIC, quantise, encodeMap, decodeMessages, findClosestMaster };
}

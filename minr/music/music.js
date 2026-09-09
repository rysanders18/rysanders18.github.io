// nbs-to-msc, in the browser.
// A port of tools/nbs-to-msc.py from the Minr-Scrips repo. The .nbs parser
// follows pynbs (the library the Python version uses) so the two produce the
// same entries; the generator mirrors write_chunk() line for line.

"use strict";

const CHUNK_SIZE = 1000;

const INSTRUMENT_NAMES = [
  "harp", "bass", "basedrum", "snare", "hat", "guitar", "flute", "bell",
  "chime", "xylophone", "iron_xylophone", "cow_bell", "didgeridoo", "bit",
  "banjo", "pling",
];

// Note Block Studio's note blocks span F#3 (key 33) to F#5 (key 57); the game
// clamps playsound pitch to that two-octave window.
const KEY_MIN = 33;
const KEY_MAX = 57;

// ---------------------------------------------------------------------------
// .nbs parser (pynbs semantics)
// ---------------------------------------------------------------------------

function readNbs(buffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");
  let offset = 0;

  function need(n) {
    if (offset + n > buffer.byteLength) {
      throw new Error("file ended early; this does not look like a .nbs file");
    }
  }
  const u8 = () => { need(1); const v = view.getUint8(offset); offset += 1; return v; };
  const i16 = () => { need(2); const v = view.getInt16(offset, true); offset += 2; return v; };
  const u16 = () => { need(2); const v = view.getUint16(offset, true); offset += 2; return v; };
  const i32 = () => { need(4); const v = view.getInt32(offset, true); offset += 4; return v; };
  const str = () => {
    const len = i32();
    if (len < 0) throw new Error("negative string length; this does not look like a .nbs file");
    need(len);
    const s = decoder.decode(new Uint8Array(buffer, offset, len));
    offset += len;
    return s;
  };

  // Header. Old-format files start with the song length; new-format files
  // start with a zero short, then a version byte.
  let version = 0;
  const first = u16();
  if (first === 0) {
    version = u8();
    u8();                       // vanilla instrument count
    if (version >= 3) u16();    // song length (dropped in v1, back in v3)
  }
  u16();                        // layer count
  const name = str();
  const author = str();
  str();                        // original author
  str();                        // description
  const tempo = u16() / 100;    // ticks per second
  u8(); u8(); u8();             // auto-save, auto-save interval, time signature
  i32(); i32(); i32(); i32(); i32(); // editing stats
  str();                        // import name
  if (version >= 4) { u8(); u8(); u16(); } // loop settings

  // Notes: run-length coded by tick, then by layer within the tick.
  const notes = [];
  let tick = -1;
  for (;;) {
    const tickJump = u16();
    if (tickJump === 0) break;
    tick += tickJump;
    let layer = -1;
    for (;;) {
      const layerJump = u16();
      if (layerJump === 0) break;
      layer += layerJump;
      const instrument = u8();
      const key = u8();
      let velocity = 100;
      let panning = 0;
      if (version >= 4) {
        velocity = u8();
        panning = u8() - 100;   // stored 0..200, centre 100; pynbs recentres
        i16();                  // fine pitch, ignored
      }
      notes.push({ tick, layer, instrument, key, velocity, panning });
    }
  }

  const lastTick = notes.length ? notes[notes.length - 1].tick : 0;
  return {
    version, name, author, tempo, notes,
    durationSecs: tempo > 0 ? lastTick / tempo : 0,
  };
}

// ---------------------------------------------------------------------------
// Entries: (instrument, volume, pitch, panning), rests fold into one entry
// ---------------------------------------------------------------------------

function buildEntries(notes, options) {
  const entries = [];
  let noteCount = 0;
  let restCount = 0;
  let outOfRange = 0;
  let customInstruments = 0;
  let previousTick = 0;
  let first = true;
  let i = 0;

  while (i < notes.length) {
    const tick = notes[i].tick;
    if (!first) {
      const gap = tick - previousTick;
      if (gap > 0) {
        entries.push([gap, 0, 0, 0]);
        restCount += 1;
      }
    }
    first = false;

    for (; i < notes.length && notes[i].tick === tick; i += 1) {
      const note = notes[i];
      if (note.velocity === 0) continue;
      let instrument = note.instrument;
      if (instrument < 0 || instrument >= INSTRUMENT_NAMES.length) {
        instrument = 0;
        customInstruments += 1;
      }
      if (note.key < KEY_MIN || note.key > KEY_MAX) outOfRange += 1;
      const volume = note.velocity / 100;
      const pitch = Math.pow(2, (note.key - 33 - 12) / 12);
      const panning = options.stereo ? (note.panning / 100) * 2 : 0;
      entries.push([instrument, volume, pitch, panning]);
      noteCount += 1;
    }
    previousTick = tick;
  }

  return { entries, noteCount, restCount, outOfRange, customInstruments };
}

// ---------------------------------------------------------------------------
// MSC text
// ---------------------------------------------------------------------------

// Compact float: drop trailing zeros but keep one decimal, because MSC wants
// 1.0F rather than 1F.
function fmtNum(v) {
  let s = v.toFixed(3).replace(/0+$/, "");
  if (s.endsWith(".")) s += "0";
  if (s === "" || s === "-" || s === ".0" || s === "-.0") s = "0.0";
  return s;
}

function generateMsc(entries, options) {
  const out = [];
  const [ns, fn] = options.delay.split("::");
  const yawOffset = (idx) =>
    `~{{ panning${idx}[i] * math::cos(Double(player.getYaw() + 180)) }}` +
    ` ~ ~{{ panning${idx}[i] * math::sin(Double(player.getYaw() + 180)) }}`;

  out.push(`@using ${ns}`, "@fast", "");
  out.push(`@define String[] instrumentNames = String[${INSTRUMENT_NAMES.map((n) => `"${n}"`).join(",")}]`, "");

  let chunkCount = 0;
  for (let start = 0; start < entries.length; start += CHUNK_SIZE) {
    const chunk = entries.slice(start, start + CHUNK_SIZE);
    chunkCount += 1;
    const idx = chunkCount;
    const n = chunk.length;
    out.push(`# === Chunk ${idx} (${n} entries) ===`);
    out.push(`@define Int[] instrument${idx} = Int[${chunk.map((e) => e[0]).join(",")}]`);
    out.push(`@define Float[] volume${idx} = Float[${chunk.map((e) => fmtNum(e[1]) + "F").join(",")}]`);
    out.push(`@define Double[] pitch${idx} = Double[${chunk.map((e) => fmtNum(e[2]) + "D").join(",")}]`);
    out.push(`@define Double[] panning${idx} = Double[${chunk.map((e) => fmtNum(e[3]) + "D").join(",")}]`);
    out.push("");
    out.push(`@for Int i in list::range(0, ${n})`);
    out.push(`    @if volume${idx}[i] == 0.0F`);
    out.push(`        @var ${ns}::${fn}(instrument${idx}[i])`);
    out.push(`    @else`);
    out.push(`        @if panning${idx}[i] == 0.0D`);
    out.push(`            @bypass /playsound block.note_block.{{instrumentNames[instrument${idx}[i]]}} master @p ~ ~ ~ {{volume${idx}[i]}} {{pitch${idx}[i]}}`);
    out.push(`        @else`);
    out.push(`            @bypass /playsound block.note_block.{{instrumentNames[instrument${idx}[i]]}} master @p ${yawOffset(idx)} {{volume${idx}[i]}} {{pitch${idx}[i]}}`);
    if (options.particles) {
      out.push(`            @bypass /particle minecraft:flame ${yawOffset(idx)} 0 0 0 0 1`);
    }
    out.push(`        @fi`);
    out.push(`    @fi`);
    out.push("@done", "");
  }
  return { text: out.join("\n"), chunkCount };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const dropzone = $("dropzone");
const fileInput = $("file-input");
const outputEl = $("output");
const loaded = [];   // { file, buffer, card, url, text }

function options() {
  const delay = $("delay-fn").value.trim();
  return {
    stereo: document.querySelector(".mode-btn.active").dataset.mode === "stereo",
    particles: $("particles").checked,
    delay: /^[A-Za-z_]\w*::[A-Za-z_]\w*$/.test(delay) ? delay : "Harha::delay",
  };
}

function plural(n, word) {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

function clock(secs) {
  const total = Math.round(secs);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function render(item) {
  const { file, buffer, card } = item;
  if (item.url) { URL.revokeObjectURL(item.url); item.url = null; }
  const opts = options();
  let song;
  try {
    song = readNbs(buffer);
  } catch (err) {
    card.className = "out-error";
    card.textContent = `Could not read ${file.name}: ${err.message}`;
    return;
  }

  const built = buildEntries(song.notes, opts);
  const { text, chunkCount } = generateMsc(built.entries, opts);
  const outName = file.name.replace(/\.nbs$/i, "") + ".msc";
  const blob = new Blob([text], { type: "text/plain" });
  item.url = URL.createObjectURL(blob);
  item.text = text;

  const warnings = [];
  if (built.noteCount === 0) warnings.push("No audible notes were found.");
  if (built.outOfRange > 0) {
    warnings.push(`${plural(built.outOfRange, "note")} fall outside the two-octave note block range and will be clamped in game.`);
  }
  if (built.customInstruments > 0) {
    warnings.push(`${plural(built.customInstruments, "note")} use custom instruments; they were played on harp instead.`);
  }

  const title = song.name
    ? `${escapeHtml(song.name)}${song.author ? " &mdash; " + escapeHtml(song.author) : ""}`
    : escapeHtml(outName);
  const fileLine = song.name ? `<div class="out-file">${escapeHtml(outName)}</div>` : "";
  const preview = text.split("\n").slice(0, 6)
    .map((l) => (l.length > 96 ? l.slice(0, 93) + "..." : l))
    .join("\n");

  card.className = "out-card";
  card.innerHTML =
    `<div class="out-head">
       <div class="out-info">
         <div class="out-title">${title}</div>
         ${fileLine}
         <div class="out-stats">${clock(song.durationSecs)} at ${song.tempo} t/s &middot; ${plural(built.noteCount, "note")}, ${plural(built.restCount, "rest")}, ${plural(chunkCount, "chunk")} &middot; ${text.length.toLocaleString()} characters &middot; ${opts.stereo ? "stereo" : "mono"}</div>
       </div>
       <div class="out-actions">
         <button type="button" class="act copy" title="Copy script to clipboard">copy</button>
         <a class="act" href="${item.url}" download="${escapeHtml(outName)}" title="Download .msc">download</a>
       </div>
     </div>
     ${warnings.map((w) => `<div class="out-warn">${w}</div>`).join("")}
     <pre class="out-preview">${escapeHtml(preview)}\n&hellip;</pre>`;

  card.querySelector(".copy").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    try {
      await navigator.clipboard.writeText(item.text);
      btn.textContent = "copied";
    } catch {
      btn.textContent = "copy failed";
    }
    setTimeout(() => { btn.textContent = "copy"; }, 1500);
  });
}

function rerenderAll() {
  loaded.forEach(render);
}

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => /\.nbs$/i.test(f.name));
  if (files.length === 0) {
    const junk = [...fileList][0];
    if (junk) {
      const card = document.createElement("div");
      card.className = "out-error";
      card.textContent = `${junk.name} is not a .nbs file.`;
      outputEl.prepend(card);
      setTimeout(() => card.remove(), 4000);
    }
    return;
  }
  dropzone.querySelector(".drop-hint").textContent = "drop more files to convert them too";
  for (const file of files) {
    const card = document.createElement("div");
    card.className = "out-card";
    card.textContent = `Reading ${file.name}...`;
    outputEl.prepend(card);
    const item = { file, buffer: await file.arrayBuffer(), card, url: null, text: "" };
    loaded.push(item);
    render(item);
  }
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".mode-btn.active").classList.remove("active");
    btn.classList.add("active");
    rerenderAll();
  });
});
$("particles").addEventListener("change", rerenderAll);
$("delay-fn").addEventListener("change", rerenderAll);

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("over"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("over");
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });

// A tiny version of the Disco Zoo rescue puzzle from disco-zoo-rl.
// One animal pattern is hidden on the 5x5 grid; click tiles to find
// every cell of it before you learn nothing new about DQNs.

(function () {
  const grid = document.getElementById("puzzle-grid");
  const status = document.getElementById("puzzle-status");
  if (!grid || !status) return;

  // Real Disco Zoo patterns (offsets within a bounding box), from the
  // farm biome's pattern library.
  const PATTERNS = [
    { name: "rabbit", cells: [[0, 0], [1, 0], [2, 0]] }, // vertical 3
    { name: "sheep", cells: [[0, 0], [0, 1], [0, 2]] }, // horizontal 3
    { name: "pig", cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }, // 2x2 block
    { name: "horse", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] }, // horizontal 4
    { name: "cow", cells: [[0, 0], [0, 1], [1, 1], [1, 2]] }, // zigzag
  ];

  let animal = new Set();
  let found = 0;
  let moves = 0;
  let done = false;

  function place() {
    const p = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const maxR = Math.max(...p.cells.map((c) => c[0]));
    const maxC = Math.max(...p.cells.map((c) => c[1]));
    const r0 = Math.floor(Math.random() * (5 - maxR));
    const c0 = Math.floor(Math.random() * (5 - maxC));
    animal = new Set(p.cells.map(([r, c]) => (r0 + r) * 5 + (c0 + c)));
    return p.name;
  }

  function reset() {
    grid.textContent = "";
    found = 0;
    moves = 0;
    done = false;
    const name = place();
    for (let i = 0; i < 25; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.i = i;
      b.setAttribute("aria-label", "Hidden tile");
      grid.appendChild(b);
    }
    status.textContent =
      "A " + name + " is hiding somewhere. Click tiles to find it.";
  }

  grid.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (done) {
      reset();
      return;
    }
    const i = Number(b.dataset.i);
    b.disabled = true;
    moves++;
    if (animal.has(i)) {
      b.classList.add("hit");
      b.setAttribute("aria-label", "Animal tile");
      found++;
      if (found === animal.size) {
        done = true;
        status.textContent =
          "Rescued in " +
          moves +
          (moves === 1 ? " move. " : " moves. ") +
          "The agent gets exact probability heatmaps instead of guessing. Click any tile to go again.";
        grid.querySelectorAll("button").forEach((x) => (x.disabled = false));
        return;
      }
      status.textContent =
        found + " of " + animal.size + " tiles found in " + moves + " moves.";
    } else {
      b.classList.add("empty");
      b.setAttribute("aria-label", "Empty tile");
      status.textContent =
        "Nothing there. " + moves + (moves === 1 ? " move" : " moves") + " used.";
    }
  });

  reset();
})();

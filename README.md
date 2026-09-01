# rysanders18.github.io

RYgamer's site, served by GitHub Pages. Plain HTML, CSS, and JavaScript, no build step.

- `index.html` - landing page.
- `styles.css` - shared stylesheet.
- `rymaphub/` - RYmaphub, the Minr map art tool. `script.js` holds the image
  quantiser (CIELAB nearest colour, Floyd-Steinberg dithering) and the
  chat-message encoder. `test_roundtrip.js` checks that the encoder and the
  reference decoder agree (`node test_roundtrip.js`, with `NMS_DIR` pointing at
  the Minr-Scrips checkout to also check the MSC alphabets match).

The in-game decoder is the `rymaphub` namespace in the Minr-Scrips repo. The
encoding contract is documented in the comments at the top of the ENCODING
section of `rymaphub/script.js` and in `rymaphub/README.md` there; the two
must change together.

Preview locally with any static server from the repo root, e.g.
`python -m http.server 8000`, then open `http://localhost:8000/rymaphub/`.

# rysanders18.github.io

Ryan Sanders's personal site and portfolio, served by GitHub Pages. Plain HTML,
CSS, and JavaScript, no build step.

- `index.html` - sectioned homepage (games / minr / projects / maths / cv / other).
- `site.css` - stylesheet for the homepage and section pages.
- `games/`, `minr/`, `projects/`, `maths/`, `other/` - section pages, currently all to-do lists.
- `portfolio/` - the recruiter-facing portfolio page, linked from the nav as "cv".
- `portfolio.css` - stylesheet for the portfolio page.
- `puzzle.js` - the playable 5x5 rescue-puzzle demo in the portfolio hero
  (a miniature of [disco-zoo-rl](https://github.com/rysanders18/disco-zoo-rl)).
- `styles.css` - shared stylesheet for the tool pages.
- `rymaphub/` - RYmaphub, the Minr map art tool. `script.js` holds the image
  quantiser (CIELAB nearest colour, Floyd-Steinberg dithering) and the
  chat-message encoder. `test_roundtrip.js` checks that the encoder and the
  reference decoder agree (`node test_roundtrip.js`, with `NMS_DIR` pointing at
  the Minr-Scrips checkout to also check the MSC alphabets match).
- `principia-biscotica/` - a self-contained typeset paper.

The in-game decoder is the `rymaphub` namespace in the Minr-Scrips repo. The
encoding contract is documented in the comments at the top of the ENCODING
section of `rymaphub/script.js` and in `rymaphub/README.md` there; the two
must change together.

Preview locally with any static server from the repo root, e.g.
`python -m http.server 8000`.

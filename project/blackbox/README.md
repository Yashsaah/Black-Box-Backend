# Black Box — AI research group site

React + Vite. Five routes, one of them dynamic.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
```

## Where things live

```
src/
  data/content.js        <- ALL content. Projects, team, mentors, notes.
  lib/fit.js             <- least-squares polyfit + the Y-shaped dataset
  components/
    ForwardPass.jsx      <- the hero network animation (canvas)
    FitCanvas.jsx        <- the live least-squares fit (SVG)
    Tile.jsx             <- magnetic project tile
    SplitText.jsx        <- word-by-word heading reveal
    Layout.jsx           <- nav, footer, <Reveal>
    Plot.jsx             <- reusable SVG line plot, draws itself on scroll
  pages/                 <- one file per route
  index.css              <- design tokens at the top, then components
```

## Before you publish: replace the placeholders

`src/data/content.js` ships with FAKE emails and GitHub handles
(`yash@blackbox.dev`, `github.com/yashkumarsah`, etc). Swap every one for the
real thing, plus `contact.email` and `contact.github` near the top of the
roster. Nothing else needs touching — the team page, the contact rows and the
footer all read from those fields.

## Adding a blog post

Add an object to `posts` in `src/data/content.js` with a `slug`, `title`,
`date`, `author`, `read`, `excerpt` and a `body` array of paragraphs. It
appears on `/blog` and gets its own `/blog/<slug>` page automatically.

## Adding a project

Add an object to `projects` in `src/data/content.js`. It shows up on the home
page, the index, and gets its own `/projects/<slug>` route automatically. No
other file needs to change.

Give it a `pen`: `var(--pen-under)`, `var(--pen-fit)` or `var(--pen-over)`.
The pen colours mean the same thing everywhere on the site — amber is
underfitting, teal is a good fit, magenta is overfitting.

## Tuning the motion

| What | File | Knob |
| --- | --- | --- |
| Network speed | `components/ForwardPass.jsx` | `CYCLE` (ms per pass) |
| Network shape | `components/ForwardPass.jsx` | `LAYERS = [4, 7, 7, 3]` |
| Tile tilt | `components/Tile.jsx` | `-py * 5` / `px * 5` (degrees) |
| Text brightness | `index.css` | `--muted`, `--faint` at the top |

## Design notes

- Palette lives at the top of `index.css`. `--signal` (coral) is the live
  network and the cursor. The three pens — `--pen-under` amber, `--pen-fit`
  teal, `--pen-over` magenta — mean the same thing on every page.
- Fonts: Bricolage Grotesque (display), Newsreader (body), JetBrains Mono
  (labels and numbers). Loaded in `index.html`.
- The page background is graph paper drawn in CSS gradients, not an image.
- The hero network is a 2D canvas: fully-connected layers, static random
  weights, fresh activations every cycle. Only edges with |w| > 0.3 fire a
  visible pulse, so the pattern reads as sparse rather than uniform.
- The hero runs a real ridge-regularised least-squares fit in the browser and
  morphs the curve between degree 1, 4 and 13. Losses shown are computed, not
  hardcoded.
- `prefers-reduced-motion` disables the auto-cycle and all transitions.

## Deploying

`npm run build`, then push `dist/` to GitHub Pages, Netlify, or Vercel. `base`
is already set to `'./'` for subpath hosting. For GitHub Pages, add a `404.html`
that copies `index.html` so client-side routes resolve on refresh.

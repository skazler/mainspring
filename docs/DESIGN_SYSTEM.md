# MAINSPRING — Design System

Steampunk, restrained. Brass and copper instruments on dark iron, with patina and oxblood as the only accents. The data are gauge faces and engraved ledgers — let the brass glow, don't decorate everything. Tokens live in `packages/ui/theme/tokens.css` and map into Tailwind v4 via `@theme`.

---

## 1. Tokens

```css
@theme {
  /* surfaces — warm dark iron */
  --color-iron:      #161310;   /* page */
  --color-coal:      #0f0d0b;   /* deepest */
  --color-panel:     #1f1a15;   /* cards / gauge housings */
  --color-raised:    #2a231b;
  --color-etch:      #3a3023;   /* engraved borders, hairlines */

  /* metals — primary data */
  --color-brass:     #c9a24b;   /* primary: take-home, median path, active value */
  --color-gilt:      #e8c874;   /* highlight / active gauge */
  --color-copper:    #b87333;   /* secondary metal, contributions */

  /* accents — used sparingly, one per state */
  --color-patina:    #4a9e8f;   /* verdigris: caps hit / clamped / "locked in" */
  --color-oxblood:   #9b3b34;   /* outflow: tax, spend, warnings */
  --color-lime-rust: #8a9a3c;   /* success: FI reached */

  /* text — parchment on iron */
  --color-parchment: #ece0c6;   /* high */
  --color-soot:      #a89a82;   /* mid */
  --color-dim:       #6b5f4d;   /* low */

  /* metallic sheen (replaces neon glow) */
  --sheen-brass: 0 1px 0 rgba(232,200,116,.35), inset 0 0 12px rgba(201,162,75,.12);
  --bevel:       inset 0 1px 0 rgba(255,240,200,.10), inset 0 -1px 0 rgba(0,0,0,.55);

  /* type */
  --font-display: "Cinzel", "IM Fell English", serif;        /* engraved headers */
  --font-body:    "Spectral", "EB Garamond", serif;          /* prose, labels */
  --font-meter:   "JetBrains Mono", "IBM Plex Mono", monospace; /* all numbers, tabular */
}
```

All fonts are open-source (Google Fonts / self-host) → **$0**.

---

## 2. Rules of the theme

- **Numbers are instrument readings.** All money/percentages in `--font-meter`, `font-variant-numeric: tabular-nums`, parchment with a faint brass sheen. They should read like a gauge face or a ledger column.
- **Headers are engraved.** `--font-display`, letter-spaced, in brass or gilt, as if stamped into metal.
- **One accent per state, never a rainbow:** brass = your money, copper = contributions flowing, oxblood = what leaves (tax/spend), patina = a cap locked in, lime-rust = freedom reached.
- **Texture, lightly.** A barely-there brushed-metal or aged-paper texture on panels; engraved hairline borders (`--color-etch`); soft vignette toward the frame. Subtle — the gauges are the heroes.
- **Bevels over shadows.** Use `--bevel` and `--sheen-brass` so panels and gauge housings feel like machined parts, not flat cards.
- **Motion is mechanical.** Gauge needles ease with a slight settle (a touch of overshoot, ~140–200ms). Number transitions are quick and clean. Nothing animates that you read often.

---

## 3. The gauge

The dial is a brass pressure gauge:
- circular machined housing (`--color-panel` + `--bevel`), etched tick ring,
- a needle sweeping 0→100% of the bucket's base, in brass; the active gauge's needle and rim go gilt with `--sheen-brass`,
- the controlled dollar amount engraved beneath in `--font-meter`,
- clamp state (cap hit) tints the arc patina; an outflow gauge (tax) reads oxblood.

Keep the housing simple and the readout legible — minimalist steampunk, not a brass junkyard.

---

## 4. Layout

A console of gauges (the `DialConsole`) as the main screen, like an engine-room panel: take-home and FI summary as the large central readouts, the fan chart as a long engraved chart plate below. Generous dark space; instruments grouped by function (income → tax → retirement → savings).

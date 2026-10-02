# visualp — design system

A shared brand and token spec for the multi-page visualp website. The runtime web prototype seed (`template.html`) defines every layout class; this file binds the six `:root` tokens plus a small page-only extension palette.

## Source

Palette adapted from `app/app.vue` (the existing Nuxt prototype) — calm cream background, deep forest ink, lime accent. Typography inherits the seed's defaults (serif display, sans body, mono numerics).

## Tokens

| Role | OKLCH | Notes |
|---|---|---|
| `--bg`            | `oklch(97.5% 0.005 145)` | cream page background |
| `--surface`       | `oklch(100% 0 0)`        | card / panel surface |
| `--fg`            | `oklch(22% 0.015 165)`   | primary ink |
| `--muted`         | `oklch(50% 0.012 160)`   | secondary text |
| `--border`        | `oklch(88% 0.010 150)`   | hairlines |
| `--accent`        | `oklch(91% 0.18 130)`    | lime — eyebrow + primary CTA only |
| `--ink-deep`      | `oklch(18% 0.018 165)`   | button text on lime, dark card bg |
| `--state-ok-bg`   | `oklch(*)`               | soft lime wash — approved / on-target |
| `--state-warn-bg` | `oklch(94% 0.04 75)`     | soft amber wash — hold / drifting |
| `--state-warn-fg` | `oklch(40% 0.10 60)`     | deep amber text |
| `--state-hedge-bg`| `oklch(94% 0.04 25)`     | soft red wash — unhedged / escalating |
| `--state-hedge-fg`| `oklch(38% 0.12 25)`     | deep red text |

State colors are used for severity pills and risk deltas (`.delta-bad`, `.delta-warn`, `.delta-ok`). They never replace the single `--accent` rule — the lime accent still appears only on eyebrow + primary CTA.

## Type

- Display: `Iowan Old Style`, `Charter`, Georgia, serif
- Body: system sans
- Mono: `JetBrains Mono`, `SF Mono`, Menlo

## Rules

1. **One accent per page.** Lime shows on eyebrow + primary CTA. Anywhere else = demote to `--fg` or `--muted`.
2. **Mono for all numerics.** FCF, CCE %, tier indices, timestamps — always `.num`.
3. **Serif display for hero h1 + section h2.** Sans h3 only inside cards.
4. **No gradients, no emoji icons.** Inline monoline SVG marks only.
5. **Two-surface pattern for digital replicas.** Sovereign Pulse (state) and Dispatch (action) always shown as parallel panels with the same data structure but different controls.
6. **Honor the seven-tier taxonomy.** Every feature card, metric, or screen on the site declares which tier it touches. No eighth tier.
7. **Treat figures as planning scenarios.** The unit economics and revenue numbers on `business-activities.html` are explicitly labelled as illustrative.

## File map

```
website/
├── index.html                  ← launcher / overview
├── brand-spec.md               ← this file
├── design-system.css           ← shared token + chrome CSS, imported by every page
├── company.html                ← PCO operating activities
├── business-activities.html    ← revenue + CCE + reinvestment
├── sovereign-pulse.html        ← state surface (digital replica · read)
├── dispatch.html               ← action surface (digital replica · act)
├── digital-replicas.html       ← sim-laes / sim-refinery / replication pattern
└── taxonomy.html               ← seven-tier value taxonomy
```

All seven pages share `design-system.css` and the topnav / footer chrome. They are self-contained HTML files; no build step.

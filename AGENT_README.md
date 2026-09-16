# agent operating guide

## mission and scope
`jessiorg/visualp` is the canonical documentation, executable prototype, and visual-asset inventory for Kanay’s P1 (virtual people / household OS) and PCO (virtual companies / enterprise OS) lifecycle. Agents must preserve the distinction between documented concepts, illustrative assumptions, and executable code.

## system axioms

### p1 / pco isomorphism
P1 and PCO are different subjects with a shared operating grammar. Both maintain a balance sheet and P&L, commitments, risks, constraints, missions, evidence, settlement, and reinvestment. P1 serves a person or household; PCO serves an enterprise, site, or operating unit. Fragmented retail demand is aggregated into wholesale blocks before procurement, dispatch, and settlement where that creates value.

### north stars
- P1: WELLBY, the delta in life satisfaction and healthy life years. Report baseline, intervention, time horizon, attribution, uncertainty, and consented evidence.
- PCO: CCE, defined exactly as `free cash flow / gross operating profit`; the programme target is greater than 80%. Do not substitute revenue growth or EBITDA margin for CCE.

### seven-tier value taxonomy
1. Energy and power.
2. Shelter and facilities.
3. Health, biology, and biomarkers, including visceral fat, sleep, metabolic signals, and biomarker tracking. This is not a diagnostic or treatment claim.
4. Climate and regeneration: Scope 1–3, pollution, clean-energy displacement, and externalities.
5. Nutrition and COGS.
6. Mobility and logistics.
7. Capital, treasury, and identity, including ownership, cash conversion, Nostr, DuckDB, and x402 as implementation candidates.

Every new feature, document, metric, or diagram must identify its applicable tier(s) and avoid inventing an eighth tier.

### onboarding and surfaces
Occam onboarding is exactly: Statement Drop → Unhedged Risk Report → Zero-Risk Activation Switch. After evidence, richer telemetry and larger missions may be activated.

- Sovereign Pulse: telemetry, balance sheet, survival floor, unhedged risk, FCF ticker, and KPI delta. It answers what is true now.
- Dispatch: autonomous execution, missions, approval queues, wholesale block aggregation, settlement, and evidence. It answers what changes next.

Autonomy is bounded by permissions, spending limits, approval states, audit logs, and escalation. Pulse observes; Dispatch acts.

### unit economics multiplier
The planning hypothesis is that £1 of compute-floor spend on a Hetzner EX44 can yield £750–£900 liquid net FCF through shared P1/PCO infrastructure and 10–20% outcome spreads. This is not a guarantee or forecast. Validate utilisation, pricing, support, acquisition, tax, bad debt, verification, partner share, settlement timing, and all other costs before presenting it as a result.

## repository navigation

- `/docs/`: master specifications, seven-tier taxonomy, onboarding, two-surface model, WELLBY/CCE, unit economics, tax-gross-up models, and chronological case study.
- `/app/`: runnable Nuxt 3 / Vue 3 / Tailwind prototype. It represents the lifecycle screen family, including the current six-surface implementation and the intended 14–18 interactive lifecycle-screen expansion.
- `/assets/visualizations/`: editable high-resolution SVG diagrams corresponding to the canonical media references.
- `/media/`: original generated-media IDs and provenance notes.
- `/prototype/`: source inventory and export notes for the canonical hosted prototype.

Start with `/docs/README.md`, then `/docs/chronological-script.md`. Read the relevant topic specification before editing code or architecture.

## agent operating rules

1. Prefer lowercase paths and filenames. Do not create a second `DOCS/`, `Docs/`, or other case variant.
2. Write high-fact-density documentation. Use zero conversational fluff, no unsupported claims, and label scenarios, hypotheses, and verified facts distinctly.
3. Keep changes additive and atomic. Do not delete existing specifications, chronological material, formulas, media references, or diagrams. If consolidation is necessary, copy first, verify, then remove only a confirmed duplicate.
4. Preserve the seven-tier taxonomy and P1/PCO terminology exactly. Do not silently rename tiers or turn implementation candidates into commitments.
5. Preserve chronological scripts: append corrections or clearly dated amendments rather than rewriting history invisibly.
6. For `/app/`, use Vue 3 Composition API with `<script setup>`, TypeScript, Tailwind CSS, and Nuxt 3 conventions. Keep components composable, typed, accessible, and free of hard-coded claims that belong in documentation.
7. For diagrams, keep the source SVG editable, provide descriptive labels, and retain the matching canonical media ID in `/media/README.md`.
8. Never represent tax, health, financial, or autonomous-execution hypotheses as professional advice or guaranteed outcomes.

## exact formulas and documentation requirements

### WELLBY
Document WELLBY as an outcome delta, not merely a price:

`WELLBY delta = measured change in wellbeing-adjusted life-year outcome relative to baseline`

Include baseline, instrument, healthy-life-year assumption, time period, attribution, uncertainty, and consent. The historical planning value of £150–£250 per WELLBY is an illustrative modelling assumption.

### CCE
`CCE = FCF / Gross Operating Profit`

The planning target is `CCE > 80%` for PCO. Define the reporting period and reconcile operating profit to cash. Explain working capital, prepayments, exceptional items, and attribution.

### tax gross-up and ITEPA 2003 s204
For a net amount `N` and effective marginal burden `r`:

`gross = N / (1 - r)`

`tax component = N × r / (1 - r)`

At a simplified 40% rate, £3,600 net requires £6,000 gross, not £6,207. If £6,207 is used to produce £3,600 net, it implies an effective burden of approximately 42.0% or additional assumptions. ITEPA 2003 section 204 concerns benefit valuation in employment contexts; actual treatment requires the benefit classification, tax year, PAYE, NIC, thresholds, exemptions, and professional UK advice. Never present the formula as a universal BIK rule.

## setup and verification

Prerequisites: Node.js 18 or newer and npm or pnpm.

```bash
cd app
npm install
npm run dev
```

Production verification:

```bash
cd app
npm run build
npm run generate
npm run start
```

Before submitting a change:

1. Inspect the current tree and read the complete files being edited.
2. Confirm lowercase documentation paths and links.
3. Run the relevant build or generation command.
4. Check that formulas, tier labels, media references, and screen names remain intact.
5. Report changed files, verification commands, assumptions, and any unresolved limitation.

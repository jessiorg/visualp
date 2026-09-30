# Blanco & Gomez Wine Merchants: Virtual Company Case Study

## Status and pilot assumptions
This document translates the supplied pilot brief into a proposed architecture and operating workflow for the Visual Company platform. Blanco & Gomez in Chelsea, the 5,549 Shopify SKUs and eight departments/categories, and the proposed 50 ml vinotte program are planning inputs from the brief, not independently verified live merchant data. Confirm merchant identity, authorization and counts against a dated export before describing the pilot as deployed.

## Architecture overview
The experience joins four bounded domains: (1) merchant catalog and inventory, (2) canonical wine identity and origin entities, (3) curated/evidenced sensory profiles, and (4) visual discovery and physical sample interactions. Integrations should preserve source identifiers, provenance, timestamps and license constraints. Legal GIs, cadastral vineyard plots, producer locations and commercial product taxonomies are distinct entity types and should be linked, not collapsed.

### Data model
- Merchant product variant: Shopify product ID, variant ID, SKU, title, category path, vendor, vintage, size, price/currency, product status, inventory location and last-sync timestamp.
- Canonical wine: producer, brand/cuvée, vintage, wine style, grapes/blend, format and external identifiers (including licensed LWIN where allowed).
- Origin designation: source ID, official name, jurisdiction, legal tier, status, parent, source URL, specification version and effective dates.
- Place geometry: source feature ID, geometry, original CRS, geometry version/date, license and legal/illustrative classification.
- Sensory profile: five dimensions, scale version, value/range or null, evidence type, source/taster, confidence and review state.
- Sample unit/batch: QR token, canonical wine/variant, source lot, fill date, volume, process and stock movement.
- Inventory position: location/channel, owner/status, quantity, duty state, reservation, lead time, feed timestamp and fulfillment eligibility.
- Crosswalk: source object, target object, relation, method, confidence, reviewer and evidence.

Never use a display name as the only stable key. Preserve official spelling and source-native IDs. Do not convert opaque codes (including LWIN) to numeric values. Uncertain matches remain queued for review instead of silently merging separate vintages, cuvées, formats, regions or producers.

## Shopify SKU ingestion pipeline
1. Authorize least-privilege Shopify API access and record API version/scopes.
2. Page through products, variants and inventory locations; checkpoint cursors and retry transient failures idempotently.
3. Persist an immutable source snapshot or auditable checksum, retrieval time and source metadata.
4. Upsert variants by Shopify variant ID (not SKU alone); retain archived/discontinued rows for lineage.
5. Normalize category paths and vendor names into a versioned crosswalk; discover the eight departments from the merchant export rather than hard-coding them.
6. Resolve wine identity in order: source-native product identifiers; exact producer/cuvée/vintage/format; then assisted match with confidence and human review.
7. Attach origin and sensory links only with evidence. Route missing/ambiguous appellation, grape or vintage fields to a merchant/editor queue.
8. Reconcile per-location quantities and report stale/negative/discrepant inventory; expose “last checked” rather than implying real-time stock.

The 5,549-SKU scope should be validated against a dated Shopify export: count active, archived, duplicated, variant-only, and unmapped records separately. A target count does not equal coverage until reconciliation is complete.

## Three visual discovery surfaces

### Spatial terroir GIS
Navigate source-attributed appellation and sub-region polygons with jurisdiction, legal tier, source feature ID, version, CRS and license. A map click filters linked products and reveals the source hierarchy. Keep legal boundaries separate from generalized UI geometry and illustrative regional points. If no authoritative polygon is available, clearly mark geometry unavailable; do not draw an invented boundary.

### Grape varietal balance grid
Place grapes or blends on a two-dimensional body-versus-acidity matrix using a documented editorial scale and descriptors. Store constituent grapes and blend proportions only when supported. Display uncertainty and provenance; do not present broad style guidance as chemical measurement. Keep keyboard and text-based filtering equivalent to the visual controls.

### Organoleptic palate radar
Render five axes: sweetness, acidity, tannin intensity, alcohol/body, and oak/fruit balance. Use stable scales and explicit labels. Keep alcohol level and perceived body as separate source attributes even if combined for the requested visual axis. Null/unknown values should produce an incomplete profile, not fabricated scores. Include measurement/editorial origin, confidence, review state and accessible textual equivalents; compare wines only when profile scale versions align.

## Physical-to-digital taste bridge: vinottes
The pilot brief proposes 50 ml inert-argon sample tubes (“vinottes”). Each sample batch/unit should link by QR to a canonical wine/product page containing the map, varietal matrix, sensory profile and current availability. Include batch/source bottle, fill timestamp, volume, storage conditions, operator and sample stock movements. Sample inventory must remain distinct from retail bottle stock. Validate packaging/contact suitability, labeling, shelf life, licensing, alcohol regulations, safe argon handling and fulfillment with qualified operators before launch.

Unit economics should be measured, not assumed. For each sample, calculate net sample revenue less actual liquid cost (including fill loss), tube/closure/label, argon and filling labor, packing/payment/fulfillment, taxes and spoilage allowance. Track conversion attributable to QR only with appropriate notice and privacy controls. Report cohort-level contribution and repeatability before scaling.

## Inventory and fulfillment integration
Represent three separate supply channels:
- Bonded storage (Octavian/LCB are examples named in the brief): duty status, title/ownership, release constraints, location, available/reserved quantity and transfer lead time. Partner relationship/feed is unconfirmed; integrate only with authorized verified data.
- Retail physical stock: merchant/shop location, saleable quantity, count timestamp and reservation state.
- On-demand trade fulfillment: trade source, eligibility, expected lead time, price, allocation and order status.

Never show bonded stock as immediately retail-available until the applicable duty/tax release and transfer are confirmed. Keep availability states explicit and expose feed freshness. Reconcile partner feeds against Shopify and merchant records with exception queues and audit logs.

## Merchant onboarding and operations
1. Confirm pilot scope, merchant authorization, product data rights and Shopify access.
2. Receive a dated export and category tree; validate SKU and department totals.
3. Configure origin-source and polygon licenses; preserve source lineage and legal-tier distinctions.
4. Build canonical product crosswalk; review uncertain matches with merchant staff.
5. Agree sensory rubric and review workflow; populate only evidence-backed profile fields.
6. Set up QR batch generation and sample handling controls; validate compliance and unit economics.
7. Connect retail, bonded and on-demand availability as separate feeds; agree freshness SLAs.
8. Launch a reviewed cohort, monitor exceptions, then expand coverage.

Pilot metrics: SKU reconciliation coverage, verified origin coverage, unmapped SKU rate, stale-inventory rate, sensory-profile completion with evidence, sample contribution margin, QR scan-to-purchase conversion, and order discrepancy/complaint rate. No metric should be represented as measured until a source feed provides observations.
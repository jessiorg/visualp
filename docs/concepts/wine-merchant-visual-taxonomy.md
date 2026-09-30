# Blanco & Gomez: Wine Merchant Visual Taxonomy

## Purpose and operating model
This concept describes a visual discovery and inventory layer for the Blanco & Gomez pilot. It brings origin, grape composition, sensory profile, physical sampling, and live merchant availability into one navigable experience. It is a documentation-level architecture proposal, not a claim that integrations or catalog mappings are already implemented.

## Three-tier discovery

### 1. Spatial terroir navigation
Begin with an interactive map of appellation and sub-region polygons. A user can move from country to region, appellation, and sub-region, then inspect wines linked to those geographic entities. Polygon geometry and legal designation metadata must retain jurisdiction, source, source identifier, version/effective date, and license. Registry hierarchies are source-specific; never infer that similarly named regions or legal tiers are equivalent. Where verified polygons are unavailable, show a clearly marked approximate or unavailable state rather than fabricate boundaries.

### 2. Grape varietal matrix
Offer a two-dimensional body-versus-acidity grid to browse grape varieties and wines. Define axes consistently (for example, curated ordinal bands with labels and explanatory descriptors), and show that placements represent editorial or evidence-based profiles rather than objective laboratory measurements. Support multiple grapes in a blend and allow uncertainty/ranges. Filters and labels should remain accessible without relying on color alone.

### 3. Organoleptic palate radar
A product detail view uses a radar profile with five axes:
- Sweetness
- Acidity
- Tannin intensity
- Alcohol/body (display as the pilot's combined axis, with the stored attributes kept separate where evidence allows)
- Oak/fruit balance

Use a stable scale and disclose whether each point comes from producer data, structured tasting notes, expert curation, or inference. Missing attributes remain missing; do not render invented scores. The chart supplements, not replaces, plain-language notes and dietary/allergen information.

## Physical sampling loop
The pilot concept uses 50 ml inert-argon sample tubes (“vinottes”) for a try-before-purchase loop. Each tube receives a QR code resolving to a durable catalog/product identifier, with batch/lot and fill date where operationally available. Scan opens the same wine detail page, sensory profile, origin map, and current merchant stock/price view. Sampling inventory is distinct from saleable bottle inventory. Capture consent and avoid exposing personal tasting feedback by default. The 50 ml format and argon handling are proposed pilot requirements and need operational/food-safety validation before use.

## Inventory integration
The target inventory scope is 5,549 Shopify SKUs across 8 departments/categories, as supplied for this pilot. Treat these figures as an input assumption to reconcile against a dated Shopify export before launch; they are not a verified live count. The integration should ingest SKU, product/variant IDs, title, vendor/producer, category/department, vintage, bottle size, product type, price/currency, availability, and image references where permitted. Preserve the source payload and timestamp.

### Matching and canonical wine identity
Map each SKU/variant to a canonical wine identity, then attach optional links to producer, vintage, varietal blend, appellation, region, sensory profile, and licensed commercial identifiers such as LWIN. Matching priority: exact source IDs; exact normalized name plus producer and vintage; then assisted candidate matching with human review. Keep unresolved products in a review queue. Never merge distinct vintages, formats, cuvées, or producers based on title similarity alone.

### Eight department/category mapping
The eight Shopify departments/categories should be discovered from the export rather than hard-coded from assumptions. Maintain a versioned mapping table from Shopify category path to visual taxonomy facets, with source value, normalized value, mapping rule, confidence, reviewer, and effective date. A SKU may belong to multiple discovery facets while retaining its canonical Shopify category path.

## Component boundaries and data flow
1. Shopify connector supplies product/variant and availability snapshots.
2. Registry/geospatial adapters provide source-attributed GI metadata and vetted polygon geometry.
3. Wine identity resolver links catalog variants to canonical wines, grapes, regions, and taxonomy identifiers.
4. Profile service provides curated/evidenced sensory attributes with provenance and scale version.
5. Discovery UI composes the map, varietal matrix, radar, product page, QR sample path, and stock state.
6. Editorial/reconciliation workflow reviews uncertain geographic or product matches and leaves an audit trail.

Inventory prices and stock are time-sensitive; distinguish last-synced values from current checkout availability. Respect Shopify API permissions, image rights, source licenses, and Liv-ex terms. Measure pilot quality by SKU reconciliation coverage, unresolved-match rate, freshness of stock data, sample-to-product scan rate, and user ability to navigate from place or taste to an in-stock bottle.

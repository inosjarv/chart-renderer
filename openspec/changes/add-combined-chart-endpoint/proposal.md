## Why

Getting both chart representations today costs the consumer two full round
trips to `GET /chart` (`format=svg` then `format=png`), each independently
fetching pricing/diamond data. Beyond the extra latency, the stub data
functions (`fetchPricingData`/`fetchDiamondPoints`) generate random synthetic
data per call, so the two calls can silently return visually-different
charts for what the consumer expects to be "the same chart in two formats."
A single combined endpoint fetches the data once and renders both formats
from that one fetch, in one HTTP round trip.

## What Changes

- Add a new `GET /chart/combined` endpoint that accepts the same
  `width`/`height`/`dpi`/`title`/`symbol`/`from`/`to` query parameters as
  `GET /chart` (no `format` parameter — it always returns both formats),
  validated with the identical rules from `chart-request-validation`
  (same `400` error contract for invalid parameters, same combined
  raster-size guard).
- The endpoint fetches pricing/diamond data once and renders both `svg` and
  `png` from that single fetch, then responds with one JSON body:
  `{ "svg": "<svg markup as a string>", "png": "<base64-encoded PNG>" }`.
- The existing `GET /chart` endpoint is unchanged — this is purely additive.

## Capabilities

### New Capabilities
- `combined-chart-endpoint`: request/response contract for `GET
  /chart/combined`, which returns both SVG and PNG renderings of the same
  chart data in a single JSON response.

### Modified Capabilities
<!-- GET /chart itself is unchanged; chart-request-validation's existing
     requirements (scoped to /chart) still hold as-is. -->

## Impact

- `src/index.ts`: new `GET /chart/combined` route handler, reusing the
  existing validators (`src/validate.ts`) and render functions
  (`src/chart.ts`'s `renderSvg`/`renderPng`).
- `src/chart.ts`: refactored to extract a new exported `svgToPng` function
  out of `renderPng`, so `GET /chart/combined` can render the SVG once and
  rasterize it directly instead of building the same SVG twice.
- No new dependencies — base64 encoding of the PNG buffer uses Node's
  built-in `Buffer.toString('base64')`.
- Response payload for the new endpoint is larger than either individual
  `/chart` response (SVG string + base64-encoded PNG, the latter ~33%
  larger than raw binary) — an accepted trade-off in exchange for a single
  round trip and one consistent data fetch, per discussion with the user.

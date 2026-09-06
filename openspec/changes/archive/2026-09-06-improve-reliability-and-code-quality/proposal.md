## Why

`chart-renderer` was built as a proof of concept: it has zero test coverage, a
DPI parameter that shares a pixel-dimension clamp by accident (allowing a
single request to demand a raster on the order of 100k+ px on one axis), and
malformed caller input (typo'd `format`, garbage `width`/`height`/`dpi`) that
silently becomes a default instead of surfacing an error. At current volume
(~500–700 requests/day, one consumer) none of this has caused an incident,
but it's cheap to fix now and gets more expensive to retrofit once there are
more consumers or more load. This pass closes those reliability and
code-quality gaps and adds cheap, non-structural performance visibility;
per `IMPROVEMENTS.md`, structural performance work (caching, worker pools) is
explicitly out of scope until real load data justifies it.

## What Changes

- **BREAKING**: `dpi` gets its own validation range (72–600) independent of
  the `width`/`height` pixel-dimension clamp, instead of reusing `parseDim`'s
  0–4000 range and silently falling back to 192 when out of range. `renderPng`'s
  internal `Math.max(BASE_DPI, ...)` floor is also removed so density scales
  proportionally across the whole validated range instead of collapsing any
  `dpi` between 72–95 to the same output as `dpi=96`.
- Add a combined raster-size guard (`width * (dpi/96)` and same for height,
  bounded by a fixed maximum) so no combination of individually valid
  `width`/`height`/`dpi` values can still produce a runaway raster.
- **BREAKING**: Replace silent fallback-on-invalid-input with a real error
  contract for the `/chart` endpoint:
  - `format` explicitly provided but not `"svg"`/`"png"` → `400` with a
    descriptive JSON error body.
  - `width`/`height`/`dpi` explicitly provided but non-numeric or `≤ 0` →
    `400` with a descriptive JSON error body.
  - `width`/`height`/`dpi` numeric but above their max → unchanged: silently
    clamp (a reasonable reading of "give me the biggest chart you'll allow").
  - Validation logic is extracted into a small, pure, unit-testable module
    (`src/validate.ts`) returning a discriminated result per field.
- **BREAKING**: `title` gets a length cap (200 characters); a longer value is
  rejected with `400` rather than silently truncated or accepted unbounded.
  Add a unit test confirming `<`, `&`, `"` in `title` produce well-formed SVG
  output.
- Add per-request render-duration logging (data-fetch time vs.
  `renderSvg`/`renderPng` time, logged separately) — purely additive, no
  behavior change to responses.
- Add a Vitest test suite: unit tests for the new validation module, the
  existing `parseDim`/`parseFormat` helpers, `labelIndicesForCurrentMonth`,
  the DPI→`sharp`-density scale math, `buildOption`'s diamond-point mapping,
  and theme-registration idempotency; integration tests (via `supertest`)
  for `GET /chart` (both formats), `GET /health`, and the new `400` error
  paths.
- Housekeeping: add ESLint + Prettier (flat config, `@typescript-eslint`),
  pin `engines.node` in `package.json`, and add `exports`/`types` fields
  formalizing `renderSvg`/`renderPng` as consumable exports.

## Capabilities

### New Capabilities
- `chart-request-validation`: validation and error-contract behavior for the
  `/chart` endpoint's `format`, `width`, `height`, `dpi`, and `title`
  parameters, including the combined raster-size guard.
- `render-observability`: per-request logging of render duration, broken
  down by data-fetch phase and render phase.

### Modified Capabilities
<!-- No pre-existing specs in this repo; nothing to modify. -->

## Impact

- `src/index.ts`: route handler, `parseDim`/`parseFormat`, new error
  responses, timing instrumentation around the fetch/render calls.
- `src/chart.ts`: DPI→density scale math (validation moves upstream but the
  math itself is exercised by new unit tests), timing hooks inside
  `renderSvg`/`renderPng`.
- New `src/validate.ts`: pure validation module.
- `package.json`: new dev dependencies (`vitest`, `supertest`, `eslint`,
  `prettier`, `@typescript-eslint/*`, `@types/supertest`), a `test` script,
  `engines.node`, and `exports`/`types` fields. No production dependency
  changes.
- Callers of `GET /chart` sending invalid `format`/`width`/`height`/`dpi`/
  `title` values that previously got a silently-defaulted or silently-large
  chart now get a `400` — the one known consumer needs to be checked against
  the new error contract.

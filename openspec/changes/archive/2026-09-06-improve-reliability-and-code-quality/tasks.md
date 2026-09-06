## 1. Test tooling setup

- [x] 1.1 Add `vitest`, `supertest`, `@types/supertest` as dev dependencies and a `test` script in `package.json`; verify `npm test` runs (even with zero tests) without error
- [x] 1.2 Export the Express `app` instance from `src/index.ts` without binding to a port at import time (e.g. move `app.listen(...)` behind a `require.main === module` check or an explicit `start()` call), and verify the server still starts normally via the existing run command

## 2. Validation module (`src/validate.ts`)

- [x] 2.1 Implement `validateFormat`, `validateWidth`, `validateHeight`, `validateTitle` returning `{ ok: true, value } | { ok: false, error }` per `design.md` - Decisions - Validation module shape; verify with unit tests covering valid, invalid, and omitted input for each
- [x] 2.2 Implement `validateDpi` with its own 72–600 range (reject non-numeric, `≤ 0`, or out-of-range rather than clamp/default), per `specs/chart-request-validation/spec.md` - Requirement: DPI parameter validation independent of pixel dimensions; verify with unit tests for below-range, above-range, in-range, and omitted DPI
- [x] 2.3 Implement `validateRasterSize(width, height, dpi)` using the `20000`-px-implied-size guard from `design.md` - Decisions - DPI range and combined raster guard; verify with a unit test asserting an individually-valid `width`/`dpi` combination whose implied size exceeds the guard is rejected, and one within the guard is accepted

## 3. Wire validation into the route handler

- [x] 3.1 Replace `parseFormat`/`parseDim` calls in `src/index.ts`'s `GET /chart` handler with the new validators; on any `ok: false` result, respond `400` with `{ error }` and skip fetch/render, per `specs/chart-request-validation/spec.md` - Requirement: Validation error response shape; verify with an integration test hitting `/chart?format=pgn` (and similar for width/height/dpi/title) expecting `400`
- [x] 3.2 Call `validateRasterSize` after individual field validation passes and return `400` if it fails, per `specs/chart-request-validation/spec.md` - Requirement: Combined raster-size guard; verify with an integration test using individually-valid `width`/`dpi` values whose combination exceeds the guard
- [x] 3.3 Confirm `width`/`height` above-max values still silently clamp to 4000 (unchanged behavior) rather than erroring; verify with an integration test for `width=9000` expecting a successful clamped render

## 4. Title bound and XML-safety verification

- [x] 4.1 Enforce the 200-character `title` cap via `validateTitle` in the route handler, returning `400` for longer values; verify with an integration test for an over-length `title`
- [x] 4.2 Add a unit test rendering with a `title` containing `<`, `&`, and `"` and assert the resulting SVG is well-formed with those characters properly escaped in the title text node, per `specs/chart-request-validation/spec.md` - Requirement: Title special-character safety; if the assertion fails, add escaping in `buildOption`/`renderSvg` and re-verify

## 5. DPI-to-density math coverage

- [x] 5.1 Remove the stale `Math.max(BASE_DPI, ...)` floor in `renderPng` (dead/incorrect now that `validateDpi` guarantees the range upstream — see `design.md` - Decisions - Removing the stale DPI floor in `renderPng`), then add a unit test for the `dpi`→`sharp`-`density` scale math (`scale = dpi / BASE_DPI`, `density = SHARP_BASE_DENSITY * scale`) confirming density scales proportionally across the full 72–600 valid range, including values below 96

## 6. Render-duration logging

- [x] 6.1 Add timing around the combined `fetchPricingData`/`fetchDiamondPoints` calls and around `renderSvg`/`renderPng` in the `GET /chart` handler, logging both durations per request, per `specs/render-observability/spec.md`; verify by inspecting log output from a manual or integration-test request
- [x] 6.2 Verify the added logging does not change the HTTP status, body, or headers of any existing response, per `specs/render-observability/spec.md` - Requirement: Per-request render duration logging (non-functional scenario); confirm via the existing/integration tests for `GET /chart` still asserting the same response shape

## 7. Additional unit test coverage

- [x] 7.1 Add unit tests for `labelIndicesForCurrentMonth` and for `buildOption`'s diamond-point mapping (`diamondData` alignment against `dateToIndex`), covering matched and unmatched dates
- [x] 7.2 Add a unit test asserting `ensureTheme`/theme registration only registers the theme once across repeated calls

## 8. Integration test suite

- [x] 8.1 Add `supertest`-based integration tests for `GET /health` (`{ ok: true }`) and `GET /chart` success paths for both `format=svg` and `format=png`, asserting status and `content-type`
- [x] 8.2 Consolidate the `400` error-path integration tests from tasks 3.1/3.2/4.1 into the same suite so the full validation contract is exercised in one place; verify `npm test` passes end to end

## 9. Housekeeping

- [x] 9.1 Add ESLint (flat config) + `@typescript-eslint` + Prettier as dev dependencies with a `lint` script; verify `npm run lint` runs and resolve or explicitly document any pre-existing findings it surfaces
- [x] 9.2 Confirm the deployed Node.js major version and add a matching `engines.node` field to `package.json` (see `design.md` - Open Questions); verify `npm install` still succeeds locally
- [x] 9.3 Add `exports`/`types` fields to `package.json` formalizing `renderSvg`/`renderPng` as consumable exports from `src/chart.ts`; verify a local `require`/`import` of the package resolves both functions

# chart-renderer — Improvement Proposal

**Context:** `chart-renderer` is a small Express + TypeScript service that renders a
fixed pricing-line-with-diamond-markers chart via ECharts SSR (SVG) and `sharp`
(PNG rasterization). It currently has one upstream consumer, serves ~500–700
chart requests/day, has zero test coverage, and was built as a proof of concept.
Breaking changes are acceptable at this stage.

**Goals for this pass:** reliability and code quality. Performance gets only
cheap, low-risk attention — current volume (well under 1 req/min average)
doesn't justify structural work like caching or worker pooling.

**Non-goals for this pass:** visual/design changes, new chart types, wiring the
stub data functions to a real upstream source, and public API/DX ergonomics.
See "Out of scope" at the end for the full list with reasoning.

Each item below is meant to be liftable into a spec-tool change entry as-is.

---

## 1. Fix the DPI parameter reusing the pixel-dimension clamp

**Current behavior:** [src/index.ts:25](src/index.ts#L25) parses `dpi` with the
same `parseDim` helper used for `width`/`height` ([src/index.ts:15-18](src/index.ts#L15-L18)):
accepts any finite number `> 0`, clamps at 4000, else falls back to 192.
[src/chart.ts:126](src/chart.ts#L126) then floors it again via
`Math.max(BASE_DPI, opts.dpi ?? 192)` before computing `scale = dpi / 96` and
setting `sharp`'s `density` to `72 * scale`.

**Problem:** DPI and pixel dimensions are different units sharing one clamp by
accident, not design. A `dpi` value near the 4000 ceiling combined with
`width`/`height` near their own 4000 ceiling compounds multiplicatively —
`sharp` rasterizes at `svg-units × (density/72)`, so e.g. `width=4000&dpi=4000`
asks for a raster roughly 4000 × (4000/96) ≈ 166,000 px on one axis. That's a
plausible memory/CPU spike from a single request, and there's no floor
feedback either: requesting `dpi=10` silently becomes 96 with no signal to the
caller that their value was overridden.

**Proposed behavior:**
- Give `dpi` its own validation range independent of pixel dimensions — e.g.
  72–600 (covers screen through print-quality use; adjust if you have a real
  upper bound in mind).
- Reject out-of-range `dpi` the same way as other invalid input (see #2)
  rather than silently clamping, since a caller asking for `dpi=4000` almost
  certainly made a mistake rather than intending it.
- Add an explicit combined raster-size guard (e.g. `width * (dpi/96) ≤ N` and
  same for height) so no combination of valid-looking individual values can
  still produce a runaway raster size.

**Rationale:** closes a real (if currently low-probability, single-trusted-caller)
resource-exhaustion path, and makes DPI behavior legible instead of an
accidental side effect of the pixel-dimension clamp.

**Migration notes:** the default (`dpi=192`) is unaffected. Only requests
using extreme or very-low `dpi` values change behavior (rejected instead of
silently clamped/floored).

---

## 2. Replace silent fallback-on-invalid-input with a real error contract

**Current behavior:** [`parseFormat`](src/index.ts#L10-L13) maps anything
other than the literal string `"png"` to `"svg"` — including typos like
`format=pgn`. [`parseDim`](src/index.ts#L15-L18) maps any non-finite or
non-positive value to its default. Neither ever surfaces an error; the only
error path today is the try/catch around the whole handler
([src/index.ts:43-46](src/index.ts#L43-L46)), which only fires on a thrown
exception (e.g. from `sharp` or `echarts`), returning a 500.

**Problem:** malformed input from the caller is indistinguishable from
intentional defaults. A caller with a bug (bad param name, typo'd value) gets
a plausible-looking chart back instead of a signal that something's wrong —
this is exactly the kind of thing worth catching now, before there's more
than one consumer.

**Proposed behavior:** split "genuinely invalid" from "well-formed but out of
range":
- `format` explicitly provided but not `"svg"`/`"png"` → `400` with
  `{ "error": "invalid format: <value>" }`.
- `width` / `height` / `dpi` explicitly provided but non-numeric or `≤ 0` →
  `400` with a descriptive error.
- `width` / `height` / `dpi` numeric but above the max → keep today's
  behavior (silently clamp), since that's a reasonable interpretation of
  "give me the biggest chart you'll allow."
- Extract this into a small, pure, unit-testable validation module (e.g.
  `src/validate.ts`) returning a discriminated result (`{ ok: true, value }`
  or `{ ok: false, error }`) per field, consumed by the route handler.

**Rationale:** matches the agreed shape (structured error for invalid,
clamp for in-range-but-extreme), and gives the test suite (#4) something
concrete and pure to test without spinning up Express.

**Migration notes:** breaking for any caller currently relying on garbage
input silently becoming a default — acceptable given breaking changes are
fine right now, and there's one consumer to update.

---

## 3. Bound and verify the `title` parameter

**Current behavior:** `title` is accepted as any string with no length cap
([src/index.ts:26](src/index.ts#L26)) and passed directly into the ECharts
option's `title.text` ([src/chart.ts:54](src/chart.ts#L54)). There is no
explicit escaping code anywhere in the render path, and no test confirms how
ECharts' SVG SSR renderer handles characters like `<`, `&`, `"` in title text.

**Problem:** two separate risks bundled into one untested parameter — layout
distortion from an unbounded-length title, and unverified handling of
XML-special characters in SVG output (ECharts likely renders text as proper
SVG text nodes rather than string-concatenating markup, which would make this
safe by construction, but that's currently an assumption, not a verified
fact).

**Proposed behavior:**
- Cap `title` length (e.g. 200 characters) and route it through the same
  validation module as #2 — reject longer values with `400` rather than
  silently truncating.
- Add a unit test asserting that a title containing `<`, `&`, and `"`
  produces well-formed SVG output, turning the current assumption into a
  documented, enforced fact.

**Rationale:** small, cheap fix that closes an untested edge in the one field
that carries arbitrary caller-supplied text into the render.

**Migration notes:** only affects callers sending unusually long titles,
which doesn't fit the current single-consumer pricing-chart use case.

---

## 4. Add a test suite (unit + integration)

**Current behavior:** no test runner is configured, and no test file has ever
existed in this repo. This was built as a proof of concept.

**Proposed behavior:** add [Vitest](https://vitest.dev) as the test runner
(near-zero config for an existing TS/`ts-node` project, fast, no `ts-jest`
transform overhead) with two layers:

- **Unit tests** for pure logic:
  - `parseDim` / `parseFormat` and the new validation module (#2, #3).
  - `labelIndicesForCurrentMonth` and the DPI→`sharp` `density` scale math in
    `renderPng` (`dpi / BASE_DPI` → `SHARP_BASE_DENSITY * scale`).
  - `buildOption`'s diamond-point mapping (`diamondData` alignment against
    `dateToIndex`) — this is the trickiest pure logic in the codebase and has
    no coverage today.
  - Theme registration idempotency (`ensureTheme` only registers once).
- **Integration tests** against the Express app (e.g. via `supertest`):
  `GET /chart` for both formats returns the right status/content-type; `GET
  /health` returns `{ ok: true }`; the new 400 error paths from #2/#3 return
  the right status and body shape.

**Explicitly deferred (separate item, not committed here):** visual/snapshot
regression — snapshotting the SVG string and/or pixel-diffing the PNG so
future changes can't silently alter rendered output. This needs its own
decision on tooling (e.g. `pixelmatch`) and a workflow for reviewing/updating
baseline images, which is a real ongoing maintenance cost worth deciding on
its own rather than bundling in here.

**Rationale:** directly answers "this was a POC, needs tests" — prioritizes
the logic most likely to silently break (diamond-point alignment, DPI math)
over exhaustive coverage.

**Migration notes:** adds `vitest` and `supertest` (+ types) as dev
dependencies and a `test` script; no production code path changes.

---

## 5. Performance: instrument before optimizing, don't restructure

**Current behavior:** `renderSvg` creates a fresh `echarts.init(null, ...)`
SSR instance and disposes it on every call
([src/chart.ts:107-116](src/chart.ts#L107-L116)). There is no caching layer
anywhere. The route handler awaits `fetchPricingData`, then `fetchDiamondPoints`,
then (for PNG) `renderPng`, sequentially ([src/index.ts:28-36](src/index.ts#L28-L36)).

**Assessment:** at ~500–700 requests/day (well under 1/minute on average),
none of the usual levers — response caching, a render worker pool,
concurrency limiting — are justified; they'd add real complexity to solve a
problem that doesn't exist yet. The sequential awaits are also not a bug:
`fetchDiamondPoints(points)` depends on `points`, so parallelizing them isn't
legal as written.

**Proposed behavior:** no structural change. Instead, add lightweight timing:
log (or otherwise record) render duration per request (data fetch time vs.
`renderSvg`/`renderPng` time, separately). This is cheap, non-invasive, and
means that *if* volume grows, there's already real data to decide what (if
anything) is worth optimizing, instead of guessing now.

**Rationale:** matches "don't over-invest here, but do something sensible" —
visibility now is more valuable than speculative optimization.

**Migration notes:** none; purely additive logging.

---

## 6. Housekeeping / baseline hygiene

Separate from the above — low-effort, low-controversy, bundled here so it
doesn't dilute the meatier items:

- Add ESLint + Prettier (flat config, `@typescript-eslint`) — there is
  currently no lint/format configuration at all.
- Add `engines.node` to `package.json`, pinned to whatever version this is
  actually tested/deployed against (today's `@types/node` targets v20, but
  nothing declares a required runtime version).
- Add `exports`/`types` fields formalizing `renderSvg`/`renderPng` as
  consumable exports — they're already cleanly separated in
  [src/chart.ts](src/chart.ts), this just makes it official in case anything
  ever imports this module directly rather than hitting it over HTTP.

**Migration notes:** none functionally; may surface pre-existing lint
findings once ESLint is added, which would need a pass to clean up.

---

## Out of scope for this pass (explicit, not silently dropped)

- **Real upstream data source** for `fetchPricingData`/`fetchDiamondPoints` —
  currently intentional stubs (random synthetic data, `symbol`/`from`/`to`
  accepted but unused). Left alone on purpose; revisit once a real data
  source is identified.
- **Visual/snapshot regression testing** — deferred from #4 above pending a
  separate tooling + workflow decision.
- **Caching, worker pooling, concurrency limiting, rate limiting** — no
  current load justifies this (see #5); revisit if the instrumentation added
  there shows a real need.
- **Theming/customization API, new chart types, visual/design changes** —
  explicitly deprioritized this round in favor of performance/reliability/code
  quality.

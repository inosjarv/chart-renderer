## Context

`GET /chart` in `src/index.ts` currently parses all of `format`, `width`,
`height`, and `dpi` through two small helpers (`parseFormat`, `parseDim`)
that both fail closed into a default instead of raising an error, and `dpi`
reuses `parseDim`'s 0–4000 pixel-dimension range before `renderPng` in
`src/chart.ts` floors it again (`Math.max(BASE_DPI, opts.dpi ?? 192)`) and
turns it into a `sharp` `density` via `scale = dpi / BASE_DPI`. `title` is
passed through unbounded and unescaped-by-us into ECharts' `title.text`.
There is no test runner, no lint/format config, and no timing
instrumentation anywhere in the request path. See `proposal.md` - Why for
the motivating problems and `specs/chart-request-validation/spec.md` and
`specs/render-observability/spec.md` for the behavior contracts this design
implements.

## Goals / Non-Goals

**Goals:**
- Give `dpi` an independent, legible validation range and close the
  compounding-clamp resource-exhaustion path.
- Establish one small, pure, unit-testable validation module that the route
  handler consumes for all of `format`/`width`/`height`/`dpi`/`title`.
- Add test, lint, and format tooling without touching production
  dependencies.
- Add render-duration logging without changing any response.

**Non-Goals:**
- No caching, worker pooling, concurrency limiting, or rate limiting (see
  proposal.md - Out of scope reasoning carried over from `IMPROVEMENTS.md`).
- No change to the stub `fetchPricingData`/`fetchDiamondPoints` data
  functions.
- No visual/snapshot regression testing (deferred; needs its own tooling
  decision).
- No change to ECharts option structure, chart visuals, or theme.

## Decisions

### Validation module shape
Introduce `src/validate.ts` exporting one function per field
(`validateFormat`, `validateWidth`, `validateHeight`, `validateDpi`,
`validateTitle`) plus a combined `validateRasterSize(width, height, dpi)`
guard, each returning a discriminated result:
```ts
type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
```
The route handler in `src/index.ts` calls each validator, short-circuits on
the first `ok: false` with `res.status(400).json({ error })`, and otherwise
proceeds with the validated values. This keeps the validators pure and
directly unit-testable (per spec's "structured 400 body" requirement)
without spinning up Express, and keeps the route handler as a thin
orchestrator.

**Alternative considered:** a single `validateRequest(query)` function
returning one aggregate result. Rejected because per-field functions map
directly onto the spec's per-parameter requirements and are easier to unit
test in isolation; the route handler can still call them in sequence for a
"fail on first invalid field" ordering, which matches today's implicit
behavior of no request touching more than one field's worth of validation
work.

### DPI range and combined raster guard
`validateDpi` enforces 72–600 directly (independent of the `width`/`height`
0–4000 range), returning `ok: false` for non-numeric, `≤ 0`, or
out-of-range values — no flooring/ceiling fallback the way `parseDim` does
today. `validateWidth`/`validateHeight` keep today's shape (`ok: false` for
non-numeric or `≤ 0`, clamp to 4000 when numeric but above max) since that
behavior is explicitly preserved per proposal.md.

The combined guard computes `implied = value * (dpi / 96)` for both width
and height (mirroring the existing `scale = dpi / BASE_DPI` math in
`renderPng`) and rejects if either exceeds a fixed constant. Pick the
constant conservatively relative to today's worst already-possible case:
before this change, `width=4000&dpi=4000` (pre-fix `parseDim` clamp) implied
≈166,000px; post-fix, `dpi`'s own 600 ceiling makes the worst case
`4000 * (600/96)` ≈ 25,000px per axis. Set the guard constant at 20000 —
below that worst individually-valid-looking combination, so the guard has
real teeth, while comfortably above any legitimate use (a 4000px chart at
print-grade 600 DPI is already an extreme request). Document the constant
next to the other tunables in `src/validate.ts` so it's easy to revisit if
real usage needs differ.

**Alternative considered:** deriving the guard from `width`/`height` maxima
divided by a fixed DPI ceiling instead of an explicit pixel constant.
Rejected as more indirect for the same result — an explicit constant is
easier to reason about and to test against directly.

### Removing the stale DPI floor in `renderPng`
`renderPng` in `src/chart.ts` computed `dpi = Math.max(BASE_DPI, opts.dpi ??
192)` before scaling — a defensive floor from when `dpi` reused `parseDim`'s
free-form fallback and could be anything. Discovered during implementation
(task 5.1): with `validateDpi` now guaranteeing `dpi` is always in `[72,
600]` (or defaulted) before `renderPng` runs, that floor silently collapses
every requested `dpi` in **72–95** to the same output as `dpi=96`, which
contradicts the "DPI within range accepted → renders at that DPI" scenario
in `specs/chart-request-validation/spec.md` for that sub-range. Removed the
floor; `renderPng` now computes `scale = (opts.dpi ?? 192) / BASE_DPI`
unconditionally, so density scales proportionally across the full validated
range. This is a small, additional production-code change beyond what was
originally scoped for task 5.1 (which called for testing the existing math
unchanged) — approved during implementation since leaving it in place would
mean part of the validated DPI range doesn't actually do what the spec says.

### Title bound and XML-safety verification
`validateTitle` rejects (doesn't truncate) titles over 200 characters, per
proposal.md. Separately, add a unit test that renders through
`renderSvg`/`buildOption` with a title containing `<`, `&`, `"` and asserts
the returned string is well-formed (e.g., parses cleanly with an XML/SVG
parser available in the test toolchain, or at minimum asserts the raw `<`/
`&`/`"` do not appear unescaped outside of expected structural markup).
This is a verification task, not a code change — ECharts' SVG SSR renders
text as SVG `<text>` nodes already, so no new escaping code is expected to
be needed; the test turns that assumption into a documented fact per
proposal.md, and if it fails, escaping becomes an implementation task at
that point.

### Test tooling
Vitest, per proposal.md - near-zero config for the existing TS setup, fast,
no `ts-jest` transform overhead. `supertest` for the `GET /chart`/`GET
/health` integration tests against the Express `app` (exported from
`src/index.ts` if not already, or the app instance moved so it can be
imported without binding to a port in tests).

### Render-duration logging
Wrap the existing sequential awaits in the route handler
(`fetchPricingData` → `fetchDiamondPoints` → `renderSvg`/`renderPng`) with
`Date.now()` (or `process.hrtime.bigint()`) measurements around (a) the two
data-fetch calls combined and (b) the render call, then `console.log` (or an
equivalent already-used logging call) a structured line per request. No new
logging dependency; this is additive only and must not change the response
sent to the caller (per `render-observability` spec's non-functional
scenario).

### Lint/format and packaging
ESLint flat config with `@typescript-eslint`, plus Prettier, as dev
dependencies only. `engines.node` pinned to the version this project is
actually run against today (confirm the deployed Node major version before
picking one; `@types/node` currently targets v20, which is the best
available signal absent a runtime confirmation). `exports`/`types` fields in
`package.json` point at the existing `renderSvg`/`renderPng` exports from
`src/chart.ts` — no code reorganization needed, since they're already
cleanly separated.

## Risks / Trade-offs

- **[Risk]** The new `400` responses are a breaking change for the one
  existing consumer if it ever sends malformed `format`/`width`/`height`/
  `dpi`/`title` values today and relies on getting a chart back anyway. →
  **Mitigation:** proposal.md accepts this trade explicitly (breaking
  changes are acceptable at this stage); flag the new error contract to the
  consumer owner before/at deploy.
- **[Risk]** The chosen combined raster-size guard constant (20000) is a
  judgment call, not derived from a hard resource budget. → **Mitigation:**
  isolate it as a single named constant in `src/validate.ts` so it's a
  one-line change if real-world usage or a memory/CPU budget says otherwise.
- **[Risk]** Adding ESLint may surface pre-existing lint findings across the
  whole codebase (per proposal.md's migration notes for item 6). →
  **Mitigation:** budget a follow-up cleanup pass in tasks.md rather than
  scope-creeping it into this change's behavior-affecting work.
- **[Trade-off]** Per-field validator functions add a small amount of
  boilerplate versus one aggregate validator, in exchange for direct
  testability and a clean mapping to the spec's per-parameter requirements.

## Migration Plan

1. Land `src/validate.ts` and its unit tests first (pure, no route changes
   yet) so the module is verified in isolation.
2. Wire the route handler in `src/index.ts` to use the validators, replacing
   `parseFormat`/`parseDim` for the reject-vs-default split; keep the
   clamp-on-above-max behavior for `width`/`height`.
3. Add the combined raster-size guard and DPI's independent range.
4. Add render-duration logging.
5. Add the integration test suite (`supertest`) covering both success paths
   and the new `400` paths.
6. Add ESLint/Prettier, `engines.node`, and `exports`/`types` last, as
   isolated housekeeping commits, so any lint-cleanup churn is easy to
   separate from the behavior-affecting commits above.

No data migration or rollback state is involved (stateless HTTP service);
rollback is a plain revert/redeploy of the previous version if the new
error contract causes unexpected consumer breakage.

## Open Questions

None remaining. The deployed Node.js major version for `engines.node` was
confirmed during implementation as 24.x; `package.json` now declares
`"engines": { "node": ">=24" }` and `@types/node` was bumped from `^20.14.0`
to `^24.13.3` to match (also required to satisfy `vitest`'s peer range for
newer majors, though the 4.x line used here still accepts `^20.0.0`).

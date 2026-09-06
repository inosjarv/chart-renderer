## Context

`GET /chart` in `src/index.ts` currently runs one linear sequence per
request: validate `format`/`width`/`height`/`dpi`/`title` (via
`src/validate.ts`), fetch pricing/diamond data, then render exactly one of
`svg`/`png`. See `proposal.md` - Why for why a combined endpoint is needed,
and `specs/combined-chart-endpoint/spec.md` for the behavior contract this
design implements.

## Goals / Non-Goals

**Goals:**
- Reuse the existing validation module and render functions as-is — no
  duplicated validation logic between `/chart` and `/chart/combined`.
- Keep `/chart` completely unchanged.

**Non-Goals:**
- No change to response shape for the existing `/chart` endpoint.
- No caching or parallelization of the two renders — `renderSvg` is
  synchronous and cheap relative to `renderPng`'s `sharp` rasterization
  step; running them sequentially from the same already-fetched data is
  simple and matches the existing `/chart` handler's style.
- No streaming/chunked response — the JSON body is fully buffered before
  sending, consistent with how `/chart` already buffers its single-format
  response.

## Decisions

### Extract the shared validate-then-fetch steps into a helper
`GET /chart` and `GET /chart/combined` need identical
validate-`width`/`height`/`dpi`/`title`-then-`validateRasterSize`-then-fetch
steps; only what happens after (render one format vs. render both and
JSON-encode) differs. Extract a small helper in `src/index.ts` that runs
validation and the data fetch, returning either the validated
inputs+fetched data or `undefined` after already sending the `400`
response (same `unwrap`-based short-circuit style already used in the
`/chart` handler). Both route handlers call it and branch only on what to
do with the result.

**Alternative considered:** duplicate the validation block in the new
handler. Rejected — `specs/combined-chart-endpoint/spec.md` explicitly
requires byte-for-byte the same `400` contract as `/chart`, and keeping the
logic in one place is the direct way to guarantee that stays true as
validation evolves.

### Response encoding
`png` is encoded with Node's built-in `Buffer.toString('base64')` — no new
dependency. `svg` is sent as-is (`renderSvg` already returns a string).
Per the user's choice (see conversation), this is a single JSON body rather
than multipart or a zip archive, trading ~33% size overhead on the PNG for
trivial client-side parsing.

### Route path and parameters
New route: `GET /chart/combined`. Accepts the same `width`, `height`,
`dpi`, `title`, `symbol`, `from`, `to` query parameters as `/chart`, with
no `format` parameter (the endpoint always returns both). This mirrors
`/chart`'s existing parameter names so callers migrating from two `/chart`
calls to one `/chart/combined` call only drop `format`.

### Avoid duplicate SVG rendering in the combined endpoint
`renderPng` in `src/chart.ts` calls `renderSvg` internally to get the SVG
string it rasterizes. Calling `renderSvg` directly and then `renderPng` (as
originally implemented) therefore built and serialized the same ECharts
option to SVG twice per combined request. Extract the rasterization step
out of `renderPng` into a new exported function `svgToPng(svg: string, dpi?:
number): Promise<Buffer>` in `src/chart.ts` (the existing `dpi`-to-`sharp`-
density scale math, unchanged, just relocated). Reimplement `renderPng` as
`svgToPng(renderSvg(points, diamonds, opts), opts.dpi)` — its exported
signature and behavior for existing `/chart` callers are unchanged. `GET
/chart/combined` then calls `renderSvg` once and passes that same string
into `svgToPng` directly, instead of calling `renderPng`, eliminating the
duplicate render.

**Alternative considered:** give `renderPng` an optional parameter to accept
a pre-rendered SVG string (`renderPng(points, diamonds, opts,
precomputedSvg?)`). Rejected — mixes two different calling conventions on
one function and is less discoverable than a separate, single-purpose
`svgToPng` export.

## Risks / Trade-offs

- **[Risk]** Response payload is larger than either individual `/chart`
  response (full SVG string plus base64-PNG in one body). → **Mitigation**:
  accepted trade-off, per proposal.md - Impact; revisit only if a real
  bandwidth concern shows up.

## Migration Plan

Purely additive - no existing route or response shape changes. No rollback
concerns beyond removing the new route if needed.

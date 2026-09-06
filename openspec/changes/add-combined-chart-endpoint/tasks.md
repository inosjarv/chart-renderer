## 1. Shared validate-then-fetch helper

- [x] 1.1 Extract a helper in `src/index.ts` that runs `validateWidth`/`validateHeight`/`validateDpi`/`validateTitle`/`validateRasterSize` and, if all pass, fetches pricing/diamond data - returning the validated inputs and fetched data, or `undefined` after already sending a `400` response; verify the existing `GET /chart` handler still passes all of its current tests using this helper

## 2. Combined endpoint

- [x] 2.1 Add `GET /chart/combined` route calling the shared helper (task 1.1), then rendering both `renderSvg` and `renderPng` from the same fetched data, base64-encoding the PNG via `Buffer.toString('base64')`, and responding `200` with `{ svg, png }` as JSON; verify with an integration test asserting status `200`, `content-type: application/json`, and both fields present
- [x] 2.2 Verify `svg` and `png` in the response are rendered from the same fetched data (not two independent fetches) with a test that mocks/spies on the data-fetch functions and asserts they are each called exactly once per `GET /chart/combined` request
- [x] 2.3 Add integration tests for the `400` validation paths on `GET /chart/combined` (invalid `width`, `height`, `dpi`, `title`, and the combined raster-size guard), asserting the same error body shape as the equivalent `GET /chart` cases, per `specs/combined-chart-endpoint/spec.md`
- [x] 2.4 Add a regression test confirming `GET /chart` behavior and response shape are unchanged after introducing the shared helper

## 3. Timing/logging consistency

- [x] 3.1 Add the same per-request fetch/render duration logging used by `GET /chart` (see `render-observability`) to `GET /chart/combined`, logging both the SVG and PNG render durations; verify by inspecting log output from a manual or integration-test request

## 4. Documentation

- [x] 4.1 Update the startup console log in `src/index.ts` (and any README/usage text, if present) to mention `GET /chart/combined`; verify by starting the server and checking the printed URLs

## 5. Avoid duplicate SVG rendering

- [x] 5.1 Extract the `sharp` rasterization step out of `renderPng` in `src/chart.ts` into a new exported `svgToPng(svg: string, dpi?: number): Promise<Buffer>` function (unchanged dpi-to-density scale math); reimplement `renderPng` as `svgToPng(renderSvg(...), opts.dpi)` so its existing signature/behavior for `GET /chart` is unchanged; verify all existing `renderPng`/`renderSvg` unit tests still pass unchanged
- [x] 5.2 Update `GET /chart/combined` in `src/index.ts` to call `renderSvg` once and pass the result into `svgToPng` directly instead of calling `renderPng`, eliminating the duplicate SVG render/serialize per combined request; verify existing combined-endpoint integration tests still pass, and add a test confirming `renderSvg` is invoked only once per combined request (e.g. by spying on it)

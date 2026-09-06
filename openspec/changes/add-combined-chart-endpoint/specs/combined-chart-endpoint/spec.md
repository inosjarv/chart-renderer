## Purpose

Lets a caller retrieve both the SVG and PNG renderings of the same chart in
a single HTTP round trip, from a single underlying data fetch, instead of
issuing two separate `/chart` requests that could each fetch different data.

## ADDED Requirements

### Requirement: Combined endpoint returns both formats in one response
The system SHALL expose `GET /chart/combined`, which renders both an SVG
and a PNG representation of the chart and returns them together in a single
JSON response body: `{ "svg": "<svg markup as a string>", "png":
"<base64-encoded PNG>" }`. The endpoint SHALL NOT accept a `format`
parameter.

#### Scenario: Successful combined request
- **WHEN** a caller sends `GET /chart/combined` with valid parameters
- **THEN** the system responds `200` with `content-type: application/json`
  and a body containing both an `svg` string field and a `png` base64
  string field

#### Scenario: SVG and PNG reflect the same data
- **WHEN** a caller sends `GET /chart/combined`
- **THEN** the `svg` and `png` fields in the response are both rendered
  from the same fetched pricing and diamond-point data, so the two
  representations depict identical chart data

### Requirement: Combined endpoint reuses the shared request validation contract
The system SHALL validate `width`, `height`, `dpi`, and `title` on `GET
/chart/combined` using the same rules as `GET /chart` (see
`chart-request-validation`), including the combined raster-size guard.
Invalid parameters SHALL produce the same `400` JSON error contract as
`GET /chart`, and no data fetch or render SHALL occur for an invalid
request.

#### Scenario: Invalid parameter rejected the same way as /chart
- **WHEN** a caller sends `GET /chart/combined` with an invalid `width`,
  `height`, `dpi`, or `title` value
- **THEN** the system responds `400` with a JSON body describing the
  invalid parameter, without fetching data or rendering

#### Scenario: Combined raster-size guard applies
- **WHEN** a caller sends `GET /chart/combined` with individually-valid
  `width`/`height`/`dpi` values whose combined implied raster size exceeds
  the configured maximum
- **THEN** the system responds `400` describing the combined size limit,
  without fetching data or rendering

#### Scenario: Valid parameters are accepted
- **WHEN** a caller sends `GET /chart/combined` with valid or omitted
  `width`, `height`, `dpi`, and `title` values
- **THEN** the system proceeds to fetch data and render both formats

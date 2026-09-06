## Purpose

Defines the validation and error-contract behavior for the `/chart` endpoint's
`format`, `width`, `height`, `dpi`, and `title` parameters, so that malformed
caller input is rejected explicitly instead of silently becoming a default or
an unbounded/oversized render.

## ADDED Requirements

### Requirement: Format parameter validation
The system SHALL accept `format=svg` or `format=png`. If `format` is
explicitly provided with any other value, the system SHALL respond with
`400` and a descriptive JSON error body rather than silently falling back to
`svg`. If `format` is omitted, the system SHALL default to `svg`.

#### Scenario: Valid format accepted
- **WHEN** a request specifies `format=png` or `format=svg`
- **THEN** the system renders the chart in the requested format

#### Scenario: Invalid format rejected
- **WHEN** a request specifies `format=pgn` (or any value other than `svg`/`png`)
- **THEN** the system responds with `400` and a JSON body describing the invalid format

#### Scenario: Omitted format defaults to svg
- **WHEN** a request omits `format`
- **THEN** the system renders the chart as `svg`

### Requirement: Width and height parameter validation
The system SHALL accept `width` and `height` as positive finite numbers. If
either is explicitly provided but is non-numeric or `≤ 0`, the system SHALL
respond with `400` and a descriptive JSON error body. If either is numeric
but exceeds the maximum of 4000, the system SHALL clamp it to 4000 rather
than rejecting the request. If omitted, each SHALL default to its existing
default value.

#### Scenario: Non-numeric width rejected
- **WHEN** a request specifies `width=abc`
- **THEN** the system responds with `400` and a JSON body describing the invalid width

#### Scenario: Zero or negative height rejected
- **WHEN** a request specifies `height=0` or a negative height
- **THEN** the system responds with `400` and a JSON body describing the invalid height

#### Scenario: Width above maximum is clamped
- **WHEN** a request specifies `width=9000`
- **THEN** the system clamps the rendered width to 4000 and returns a successful response

### Requirement: DPI parameter validation independent of pixel dimensions
The system SHALL validate `dpi` against its own range of 72–600, independent
of the `width`/`height` pixel-dimension range. If `dpi` is explicitly
provided and is non-numeric, `≤ 0`, or outside the 72–600 range, the system
SHALL respond with `400` and a descriptive JSON error body rather than
silently clamping or falling back to a default. If `dpi` is omitted, the
system SHALL default to 192.

#### Scenario: DPI within range accepted
- **WHEN** a request specifies `dpi=300`
- **THEN** the system renders the chart at that DPI

#### Scenario: DPI above range rejected
- **WHEN** a request specifies `dpi=4000`
- **THEN** the system responds with `400` and a JSON body describing the invalid DPI, without rendering

#### Scenario: DPI below range rejected
- **WHEN** a request specifies `dpi=10`
- **THEN** the system responds with `400` and a JSON body describing the invalid DPI, without silently substituting a default

#### Scenario: Omitted DPI defaults to 192
- **WHEN** a request omits `dpi`
- **THEN** the system renders the chart at 192 DPI

### Requirement: Combined raster-size guard
Regardless of individually valid `width`, `height`, and `dpi` values, the
system SHALL enforce a fixed maximum on the combined raster size implied by
`width * (dpi / 96)` and `height * (dpi / 96)`. If either exceeds that
maximum, the system SHALL respond with `400` and a descriptive JSON error
body instead of attempting the render.

#### Scenario: Individually valid values produce an oversized raster
- **WHEN** a request specifies `width=4000` and `dpi=600` such that the
  implied raster size exceeds the configured maximum
- **THEN** the system responds with `400` and a JSON body describing the
  combined size limit, without attempting the render

#### Scenario: Combined size within guard succeeds
- **WHEN** a request specifies `width` and `dpi` values that are each within
  their individual ranges and whose combined implied raster size is within
  the configured maximum
- **THEN** the system renders the chart normally

### Requirement: Title length bound
The system SHALL accept `title` values up to 200 characters. If `title` is
explicitly provided and exceeds 200 characters, the system SHALL respond
with `400` and a descriptive JSON error body rather than silently
truncating it.

#### Scenario: Title within bound accepted
- **WHEN** a request specifies a `title` of 200 characters or fewer
- **THEN** the system renders the chart with that title

#### Scenario: Title exceeding bound rejected
- **WHEN** a request specifies a `title` longer than 200 characters
- **THEN** the system responds with `400` and a JSON body describing the invalid title, without truncating it

### Requirement: Title special-character safety
The system SHALL render `title` text such that characters including `<`,
`&`, and `"` produce well-formed SVG/XML output.

#### Scenario: Title with special characters renders well-formed SVG
- **WHEN** a request specifies a `title` containing `<`, `&`, and `"`
- **THEN** the system returns an SVG (or PNG rendered from that SVG) whose
  underlying markup is well-formed, with those characters properly escaped
  in the title text node

### Requirement: Validation error response shape
When any parameter fails validation, the system SHALL respond with HTTP
`400` and a JSON body identifying which parameter was invalid and why,
distinguishing this from the existing `500` response used for unexpected
rendering failures.

#### Scenario: Invalid parameter produces a structured 400 body
- **WHEN** any single request parameter (`format`, `width`, `height`, `dpi`,
  or `title`) fails validation
- **THEN** the system responds with HTTP status `400` and a JSON body
  containing an `error` field describing the invalid parameter and value

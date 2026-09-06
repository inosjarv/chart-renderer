# Render Observability Specification

## Purpose

Gives the render pipeline lightweight, per-request timing visibility so that
future capacity or performance decisions can be based on real data instead
of speculation, without changing any response behavior.

## Requirements

### Requirement: Per-request render duration logging
For every chart render request that reaches the render pipeline, the system
SHALL record the duration of the data-fetch phase (fetching pricing and
diamond-point data) and the duration of the render phase (`renderSvg` or
`renderPng`) as separate, distinguishable measurements. This logging SHALL
be purely additive: it SHALL NOT alter the HTTP status code, body, or
headers returned to the caller.

#### Scenario: SVG request logs both phases
- **WHEN** a request successfully renders an SVG chart
- **THEN** the system records the data-fetch duration and the SVG render
  duration as separate values, and the HTTP response is unaffected

#### Scenario: PNG request logs both phases
- **WHEN** a request successfully renders a PNG chart
- **THEN** the system records the data-fetch duration and the PNG render
  duration (including rasterization) as separate values, and the HTTP
  response is unaffected

#### Scenario: Logging does not alter the response
- **WHEN** render duration logging is active for a request
- **THEN** the response returned to the caller is byte-for-byte identical to
  what would have been returned with logging disabled

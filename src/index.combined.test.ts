import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Mock the data-fetch functions so we can assert exactly how many times each
// is called per request (task 2.2), and that they're skipped entirely for
// invalid requests (task 2.3 / spec's "without fetching data" scenarios).
const { fetchPricingDataMock, fetchDiamondPointsMock } = vi.hoisted(() => ({
  fetchPricingDataMock: vi.fn(async () => [
    { date: '2024-01-01', price: 100 },
    { date: '2024-01-02', price: 101 },
  ]),
  fetchDiamondPointsMock: vi.fn(async () => [{ date: '2024-01-01', price: 100 }]),
}));

vi.mock('./data', () => ({
  fetchPricingData: fetchPricingDataMock,
  fetchDiamondPoints: fetchDiamondPointsMock,
}));

// Spy on renderPng and svgToPng (keeping their real implementations) to
// confirm the combined endpoint rasterizes via `svgToPng` directly rather
// than `renderPng`, which would render a second, redundant SVG internally
// (task 5.2). Spying on `renderSvg` itself doesn't work for this: `renderPng`
// calls `renderSvg` via its own same-module reference, which bypasses a
// `vi.mock`-replaced export - only calls made *into* the module from outside
// (like these two) are observable this way.
const { renderPngSpy, svgToPngSpy } = vi.hoisted(() => ({
  renderPngSpy: vi.fn(),
  svgToPngSpy: vi.fn(),
}));

vi.mock('./chart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./chart')>();
  return {
    ...actual,
    renderPng: renderPngSpy.mockImplementation(actual.renderPng),
    svgToPng: svgToPngSpy.mockImplementation(actual.svgToPng),
  };
});

const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

describe('GET /chart/combined', () => {
  beforeEach(() => {
    fetchPricingDataMock.mockClear();
    fetchDiamondPointsMock.mockClear();
    renderPngSpy.mockClear();
    svgToPngSpy.mockClear();
  });

  it('returns both svg and png in a single JSON response', async () => {
    const { default: app } = await import('./index');
    const res = await request(app).get('/chart/combined');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(typeof res.body.svg).toBe('string');
    expect(res.body.svg).toContain('<svg');
    expect(typeof res.body.png).toBe('string');
    expect(BASE64_RE.test(res.body.png)).toBe(true);
  });

  it('fetches pricing and diamond data exactly once per request', async () => {
    const { default: app } = await import('./index');
    await request(app).get('/chart/combined');

    expect(fetchPricingDataMock).toHaveBeenCalledTimes(1);
    expect(fetchDiamondPointsMock).toHaveBeenCalledTimes(1);
  });

  it('rasterizes via svgToPng directly, not renderPng, avoiding a duplicate SVG render', async () => {
    const { default: app } = await import('./index');
    const res = await request(app).get('/chart/combined');

    expect(res.status).toBe(200);
    expect(svgToPngSpy).toHaveBeenCalledTimes(1);
    expect(renderPngSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid width without fetching data', async () => {
    const { default: app } = await import('./index');
    const res = await request(app).get('/chart/combined?width=abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('width');
    expect(fetchPricingDataMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid height without fetching data', async () => {
    const { default: app } = await import('./index');
    const res = await request(app).get('/chart/combined?height=0');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('height');
    expect(fetchPricingDataMock).not.toHaveBeenCalled();
  });

  it('rejects a dpi outside the valid range without fetching data', async () => {
    const { default: app } = await import('./index');
    const res = await request(app).get('/chart/combined?dpi=10');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('dpi');
    expect(fetchPricingDataMock).not.toHaveBeenCalled();
  });

  it('rejects a title over the length bound without fetching data', async () => {
    const { default: app } = await import('./index');
    const res = await request(app).get(`/chart/combined?title=${'a'.repeat(201)}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('title');
    expect(fetchPricingDataMock).not.toHaveBeenCalled();
  });

  it('rejects an individually-valid width/dpi combination whose combined raster size is too large, without fetching data', async () => {
    const { default: app } = await import('./index');
    const res = await request(app).get('/chart/combined?width=4000&dpi=600');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/raster|too large/i);
    expect(fetchPricingDataMock).not.toHaveBeenCalled();
  });

  it('does not accept a format parameter (always returns both formats)', async () => {
    const { default: app } = await import('./index');
    const res = await request(app).get('/chart/combined?format=png');

    // format is simply ignored/unused by this route - it still returns both.
    expect(res.status).toBe(200);
    expect(typeof res.body.svg).toBe('string');
    expect(typeof res.body.png).toBe('string');
  });
});

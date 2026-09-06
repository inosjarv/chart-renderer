import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from './index';

describe('GET /health', () => {
  it('returns ok: true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual({ ok: true });
  });
});

describe('GET /chart - success paths', () => {
  it('renders svg by default', async () => {
    const res = await request(app).get('/chart');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
  });

  it('renders svg when format=svg', async () => {
    const res = await request(app).get('/chart?format=svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
  });

  it('renders png when format=png', async () => {
    const res = await request(app).get('/chart?format=png');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  it('clamps width above the maximum instead of rejecting', async () => {
    const res = await request(app).get('/chart?width=9000');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
  });
});

describe('GET /chart - validation error paths', () => {
  it('rejects an invalid format', async () => {
    const res = await request(app).get('/chart?format=pgn');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('format');
  });

  it('rejects a non-numeric width', async () => {
    const res = await request(app).get('/chart?width=abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('width');
  });

  it('rejects a zero height', async () => {
    const res = await request(app).get('/chart?height=0');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('height');
  });

  it('rejects a dpi below the valid range', async () => {
    const res = await request(app).get('/chart?dpi=10');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('dpi');
  });

  it('rejects a dpi above the valid range', async () => {
    const res = await request(app).get('/chart?dpi=4000');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('dpi');
  });

  it('rejects a title over the length bound', async () => {
    const res = await request(app).get(`/chart?title=${'a'.repeat(201)}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('title');
  });

  it('rejects an individually-valid width/dpi combination whose combined raster size is too large', async () => {
    const res = await request(app).get('/chart?width=4000&dpi=600');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/raster|too large/i);
  });
});

describe('GET /chart - regression after extracting the shared validate-then-fetch helper', () => {
  // Guards against the /chart/combined refactor (which extracted
  // validateAndFetchChartData out of this handler) accidentally changing
  // /chart's own response shape.
  it('still returns a single-format response, not the combined JSON shape', async () => {
    const res = await request(app).get('/chart?format=svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.headers['content-type']).not.toContain('application/json');
  });

  it('still clamps width above the maximum the same way as before the refactor', async () => {
    const res = await request(app).get('/chart?format=png&width=9000');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });
});

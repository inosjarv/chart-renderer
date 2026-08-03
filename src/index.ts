import express, { Request, Response } from 'express';
import { fetchPricingData } from './data';
import { renderPng, renderSvg } from './chart';

const app = express();
const port = Number(process.env.PORT) || 3000;

type ChartFormat = 'svg' | 'png';

function parseFormat(raw: unknown): ChartFormat {
  const value = typeof raw === 'string' ? raw.toLowerCase() : 'svg';
  return value === 'png' ? 'png' : 'svg';
}

function parseDim(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 4000) : fallback;
}

app.get('/chart', async (req: Request, res: Response) => {
  try {
    const format = parseFormat(req.query.format);
    const width = parseDim(req.query.width, 800);
    const height = parseDim(req.query.height, 450);
    const title = typeof req.query.title === 'string' ? req.query.title : 'Pricing';

    const points = await fetchPricingData({
      symbol: typeof req.query.symbol === 'string' ? req.query.symbol : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
    });

    if (format === 'png') {
      const buf = await renderPng(points, { width, height, title });
      res.type('image/png').send(buf);
      return;
    }

    const svg = renderSvg(points, { width, height, title });
    res.type('image/svg+xml').send(svg);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'render failed';
    res.status(500).json({ error: message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`chart-renderer listening on http://localhost:${port}`);
  console.log(`  SVG: http://localhost:${port}/chart?format=svg`);
  console.log(`  PNG: http://localhost:${port}/chart?format=png`);
});

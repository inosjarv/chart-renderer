import express, { Request, Response } from 'express';
import { DiamondPoint, fetchDiamondPoints, fetchPricingData, PricePoint } from './data';
import { renderPng, renderSvg, svgToPng } from './chart';
import {
  ValidationResult,
  validateDpi,
  validateFormat,
  validateHeight,
  validateRasterSize,
  validateTitle,
  validateWidth,
} from './validate';

const app = express();
const port = Number(process.env.PORT) || 3000;

/**
 * Sends a 400 with the validation error and returns undefined if `result`
 * is invalid; otherwise returns the validated value. None of the validated
 * fields have a legitimate `undefined` value, so `undefined` is a safe
 * sentinel for "already responded, stop processing this request".
 */
function unwrap<T>(res: Response, result: ValidationResult<T>): T | undefined {
  if (result.ok) return result.value;
  res.status(400).json({ error: result.error });
  return undefined;
}

interface ValidatedChartRequest {
  width: number;
  height: number;
  dpi: number;
  title: string;
  points: PricePoint[];
  diamonds: DiamondPoint[];
  fetchMs: number;
}

/**
 * Shared by every `/chart*` route: validates `width`/`height`/`dpi`/`title`
 * and the combined raster-size guard, then fetches pricing/diamond data
 * once. On any validation failure, sends the `400` response itself and
 * returns undefined - callers should bail out immediately in that case.
 * `format` is validated separately per-route since not every route accepts it.
 */
async function validateAndFetchChartData(
  req: Request,
  res: Response,
): Promise<ValidatedChartRequest | undefined> {
  const width = unwrap(res, validateWidth(req.query.width));
  if (width === undefined) return undefined;
  const height = unwrap(res, validateHeight(req.query.height));
  if (height === undefined) return undefined;
  const dpi = unwrap(res, validateDpi(req.query.dpi));
  if (dpi === undefined) return undefined;
  const title = unwrap(res, validateTitle(req.query.title));
  if (title === undefined) return undefined;

  const rasterSize = validateRasterSize(width, height, dpi);
  if (!rasterSize.ok) {
    res.status(400).json({ error: rasterSize.error });
    return undefined;
  }

  const fetchStart = Date.now();
  const points = await fetchPricingData({
    symbol: typeof req.query.symbol === 'string' ? req.query.symbol : undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  });
  const diamonds = await fetchDiamondPoints(points);
  const fetchMs = Date.now() - fetchStart;

  return { width, height, dpi, title, points, diamonds, fetchMs };
}

app.get('/chart', async (req: Request, res: Response) => {
  try {
    const format = unwrap(res, validateFormat(req.query.format));
    if (format === undefined) return;

    const validated = await validateAndFetchChartData(req, res);
    if (validated === undefined) return;
    const { width, height, dpi, title, points, diamonds, fetchMs } = validated;

    const renderStart = Date.now();
    if (format === 'png') {
      const buf = await renderPng(points, diamonds, { width, height, title, dpi });
      const renderMs = Date.now() - renderStart;
      console.log(`[chart] format=png fetchMs=${fetchMs} renderMs=${renderMs}`);
      res.type('image/png').send(buf);
      return;
    }

    const svg = renderSvg(points, diamonds, { width, height, title });
    const renderMs = Date.now() - renderStart;
    console.log(`[chart] format=svg fetchMs=${fetchMs} renderMs=${renderMs}`);
    res.type('image/svg+xml').send(svg);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'render failed';
    res.status(500).json({ error: message });
  }
});

app.get('/chart/combined', async (req: Request, res: Response) => {
  try {
    const validated = await validateAndFetchChartData(req, res);
    if (validated === undefined) return;
    const { width, height, dpi, title, points, diamonds, fetchMs } = validated;

    const svgStart = Date.now();
    const svg = renderSvg(points, diamonds, { width, height, title });
    const svgRenderMs = Date.now() - svgStart;

    const pngStart = Date.now();
    const buf = await svgToPng(svg, dpi);
    const pngRenderMs = Date.now() - pngStart;

    console.log(
      `[chart-combined] fetchMs=${fetchMs} svgRenderMs=${svgRenderMs} pngRenderMs=${pngRenderMs}`,
    );
    res.json({ svg, png: buf.toString('base64') });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'render failed';
    res.status(500).json({ error: message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

if (require.main === module) {
  app.listen(port, () => {
    console.log(`chart-renderer listening on http://localhost:${port}`);
    console.log(`  SVG: http://localhost:${port}/chart?format=svg`);
    console.log(`  PNG: http://localhost:${port}/chart?format=png`);
    console.log(`  Combined (SVG+PNG JSON): http://localhost:${port}/chart/combined`);
  });
}

export default app;

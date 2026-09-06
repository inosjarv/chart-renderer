import { BASE_DPI } from './chart';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ChartFormat = 'svg' | 'png';

/** Pixel-dimension ceiling for `width`/`height`. Above this, silently clamp. */
const WIDTH_HEIGHT_MAX = 4000;

/** `dpi` has its own range, independent of `WIDTH_HEIGHT_MAX` - see design.md. */
const DPI_MIN = 72;
const DPI_MAX = 600;

const TITLE_MAX_LENGTH = 200;

/**
 * Maximum implied raster size (px) on either axis, computed as
 * `dimension * (dpi / BASE_DPI)`. Guards against individually-valid
 * width/height/dpi combinations still producing a runaway raster.
 * See design.md - Decisions - DPI range and combined raster guard.
 */
const MAX_RASTER_DIMENSION_PX = 20000;

export function validateFormat(raw: unknown): ValidationResult<ChartFormat> {
  if (raw === undefined) return { ok: true, value: 'svg' };
  if (typeof raw !== 'string') {
    return { ok: false, error: `invalid format: ${String(raw)}` };
  }
  const value = raw.toLowerCase();
  if (value === 'svg' || value === 'png') return { ok: true, value };
  return { ok: false, error: `invalid format: ${raw}` };
}

function validatePixelDimension(
  raw: unknown,
  field: string,
  fallback: number,
): ValidationResult<number> {
  if (raw === undefined) return { ok: true, value: fallback };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: `invalid ${field}: ${String(raw)}` };
  }
  return { ok: true, value: Math.min(n, WIDTH_HEIGHT_MAX) };
}

export function validateWidth(raw: unknown): ValidationResult<number> {
  return validatePixelDimension(raw, 'width', 800);
}

export function validateHeight(raw: unknown): ValidationResult<number> {
  return validatePixelDimension(raw, 'height', 450);
}

export function validateDpi(raw: unknown): ValidationResult<number> {
  if (raw === undefined) return { ok: true, value: 192 };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n < DPI_MIN || n > DPI_MAX) {
    return {
      ok: false,
      error: `invalid dpi: ${String(raw)} (must be between ${DPI_MIN} and ${DPI_MAX})`,
    };
  }
  return { ok: true, value: n };
}

export function validateTitle(raw: unknown): ValidationResult<string> {
  if (raw === undefined) return { ok: true, value: 'Pricing' };
  if (typeof raw !== 'string') {
    return { ok: false, error: `invalid title: ${String(raw)}` };
  }
  if (raw.length > TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `invalid title: exceeds ${TITLE_MAX_LENGTH} character limit`,
    };
  }
  return { ok: true, value: raw };
}

/**
 * Guards against `width`/`height`/`dpi` values that are each individually
 * valid but whose combined implied raster size is still too large.
 */
export function validateRasterSize(
  width: number,
  height: number,
  dpi: number,
): ValidationResult<true> {
  const scale = dpi / BASE_DPI;
  const impliedWidth = width * scale;
  const impliedHeight = height * scale;
  if (impliedWidth > MAX_RASTER_DIMENSION_PX || impliedHeight > MAX_RASTER_DIMENSION_PX) {
    return {
      ok: false,
      error: `requested raster size too large: ~${Math.round(impliedWidth)}x${Math.round(
        impliedHeight,
      )}px exceeds the ${MAX_RASTER_DIMENSION_PX}px-per-axis limit`,
    };
  }
  return { ok: true, value: true };
}

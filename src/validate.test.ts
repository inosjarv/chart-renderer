import { describe, expect, it } from 'vitest';
import {
  validateDpi,
  validateFormat,
  validateHeight,
  validateRasterSize,
  validateTitle,
  validateWidth,
} from './validate';

describe('validateFormat', () => {
  it('accepts svg', () => {
    expect(validateFormat('svg')).toEqual({ ok: true, value: 'svg' });
  });

  it('accepts png', () => {
    expect(validateFormat('png')).toEqual({ ok: true, value: 'png' });
  });

  it('accepts case-insensitively', () => {
    expect(validateFormat('PNG')).toEqual({ ok: true, value: 'png' });
  });

  it('defaults to svg when omitted', () => {
    expect(validateFormat(undefined)).toEqual({ ok: true, value: 'svg' });
  });

  it('rejects an unrecognized value', () => {
    const result = validateFormat('pgn');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('pgn');
  });

  it('rejects a non-string value', () => {
    const result = validateFormat(['png']);
    expect(result.ok).toBe(false);
  });
});

describe('validateWidth', () => {
  it('accepts a positive number', () => {
    expect(validateWidth('1024')).toEqual({ ok: true, value: 1024 });
  });

  it('defaults to 800 when omitted', () => {
    expect(validateWidth(undefined)).toEqual({ ok: true, value: 800 });
  });

  it('rejects a non-numeric value', () => {
    const result = validateWidth('abc');
    expect(result.ok).toBe(false);
  });

  it('rejects zero', () => {
    expect(validateWidth('0').ok).toBe(false);
  });

  it('rejects a negative value', () => {
    expect(validateWidth('-100').ok).toBe(false);
  });

  it('clamps values above the maximum instead of rejecting', () => {
    expect(validateWidth('9000')).toEqual({ ok: true, value: 4000 });
  });
});

describe('validateHeight', () => {
  it('defaults to 450 when omitted', () => {
    expect(validateHeight(undefined)).toEqual({ ok: true, value: 450 });
  });

  it('rejects zero or negative values', () => {
    expect(validateHeight('0').ok).toBe(false);
    expect(validateHeight('-5').ok).toBe(false);
  });

  it('clamps values above the maximum instead of rejecting', () => {
    expect(validateHeight('9000')).toEqual({ ok: true, value: 4000 });
  });
});

describe('validateDpi', () => {
  it('accepts a value within the 72-600 range', () => {
    expect(validateDpi('300')).toEqual({ ok: true, value: 300 });
  });

  it('defaults to 192 when omitted', () => {
    expect(validateDpi(undefined)).toEqual({ ok: true, value: 192 });
  });

  it('rejects a value below the range', () => {
    const result = validateDpi('10');
    expect(result.ok).toBe(false);
  });

  it('rejects a value above the range', () => {
    const result = validateDpi('4000');
    expect(result.ok).toBe(false);
  });

  it('rejects a non-numeric value', () => {
    expect(validateDpi('abc').ok).toBe(false);
  });

  it('rejects zero or negative values', () => {
    expect(validateDpi('0').ok).toBe(false);
    expect(validateDpi('-96').ok).toBe(false);
  });

  it('accepts the boundary values 72 and 600', () => {
    expect(validateDpi('72')).toEqual({ ok: true, value: 72 });
    expect(validateDpi('600')).toEqual({ ok: true, value: 600 });
  });
});

describe('validateTitle', () => {
  it('accepts a title within the length bound', () => {
    expect(validateTitle('Pricing')).toEqual({ ok: true, value: 'Pricing' });
  });

  it('defaults to "Pricing" when omitted', () => {
    expect(validateTitle(undefined)).toEqual({ ok: true, value: 'Pricing' });
  });

  it('accepts a title at exactly 200 characters', () => {
    const title = 'a'.repeat(200);
    expect(validateTitle(title)).toEqual({ ok: true, value: title });
  });

  it('rejects a title over 200 characters', () => {
    const title = 'a'.repeat(201);
    const result = validateTitle(title);
    expect(result.ok).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(validateTitle(['x']).ok).toBe(false);
  });
});

describe('validateRasterSize', () => {
  it('accepts individually-valid values whose combined size is within the guard', () => {
    // 800 * (192/96) = 1600px implied width - well under the guard.
    expect(validateRasterSize(800, 450, 192)).toEqual({ ok: true, value: true });
  });

  it('rejects an individually-valid combination whose implied raster size is too large', () => {
    // 4000 * (600/96) = 25000px implied width - exceeds the 20000px guard.
    const result = validateRasterSize(4000, 2250, 600);
    expect(result.ok).toBe(false);
  });

  it('accepts a combination right at the guard boundary', () => {
    // 4000 * (480/96) = 20000px implied width - exactly at the guard.
    expect(validateRasterSize(4000, 100, 480)).toEqual({ ok: true, value: true });
  });
});

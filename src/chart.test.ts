import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { renderPng, renderSvg } from './chart';
import type { PricePoint } from './data';

const points: PricePoint[] = [
  { date: '2024-01-01', price: 100 },
  { date: '2024-01-02', price: 101 },
];

describe('renderPng - dpi to sharp density scale math', () => {
  // scale = dpi / BASE_DPI (96); density = SHARP_BASE_DENSITY (72) * scale.
  it.each([
    [72, 54],
    [96, 72],
    [192, 144],
    [300, 225],
    [600, 450],
  ])(
    'dpi=%d produces density=%d, proportional across the full validated range',
    async (dpi, expectedDensity) => {
      const buf = await renderPng(points, [], { dpi });
      const meta = await sharp(buf).metadata();
      expect(meta.density).toBe(expectedDensity);
    },
  );

  it('defaults to 192 dpi (density 144) when dpi is omitted', async () => {
    const buf = await renderPng(points, []);
    const meta = await sharp(buf).metadata();
    expect(meta.density).toBe(144);
  });
});

describe('renderSvg - title special-character safety', () => {
  it('escapes <, &, and " in the title text node instead of producing malformed markup', () => {
    const title = 'Price <b>&"test"</b>';
    const svg = renderSvg(points, [], { title });

    // The raw special characters from the title must come through as their
    // XML entity equivalents, not as literal markup.
    expect(svg).toContain('&lt;b&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;test&quot;');

    // No unescaped '&' should appear anywhere in the document outside of a
    // recognized entity - a stray bare '&' would make the SVG/XML malformed.
    const unescapedAmpersand = /&(?!lt;|gt;|amp;|quot;|apos;|#\d+;)/;
    expect(unescapedAmpersand.test(svg)).toBe(false);

    // The raw, unescaped title text must not appear verbatim in the output.
    expect(svg).not.toContain(title);
  });
});

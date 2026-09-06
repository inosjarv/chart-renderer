import * as echarts from 'echarts';
import sharp from 'sharp';
import type { EChartsOption } from 'echarts';
import { baseChartOption, labelColor, seriesColor, themeDefinition, themeName } from './theme';
import type { DiamondPoint, PricePoint } from './data';

let themeRegistered = false;
export function ensureTheme(): void {
  if (themeRegistered) return;
  echarts.registerTheme(themeName, themeDefinition);
  themeRegistered = true;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  title?: string;
  /** Target DPI for raster (PNG) output. Baseline is 96; default 192 = 2x. */
  dpi?: number;
}

export const BASE_DPI = 96;
const SHARP_BASE_DENSITY = 72;

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function labelIndicesForCurrentMonth(points: PricePoint[]): Set<number> {
  const targetMonth = new Date().getMonth();
  const seenYears = new Set<number>();
  const indices = new Set<number>();
  points.forEach((p, i) => {
    const d = new Date(p.date);
    const year = d.getUTCFullYear();
    if (d.getUTCMonth() === targetMonth && !seenYears.has(year)) {
      seenYears.add(year);
      indices.add(i);
    }
  });
  return indices;
}

export function buildOption(
  points: PricePoint[],
  diamonds: DiamondPoint[],
  title: string,
): EChartsOption {
  const labeled = labelIndicesForCurrentMonth(points);
  const dateToIndex = new Map(points.map((p, i) => [p.date, i]));
  const diamondData = diamonds
    .map((d) => {
      const i = dateToIndex.get(d.date);
      return i === undefined ? null : [i, d.price];
    })
    .filter((v): v is [number, number] => v !== null);

  return {
    ...baseChartOption(),
    title: { text: title, left: 'center', top: 20, textStyle: { color: labelColor } },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.date),
      boundaryGap: false,
      axisLabel: {
        color: labelColor,
        margin: 14,
        interval: (index: number) => labeled.has(index),
        formatter: (value: string) => {
          const d = new Date(value);
          return `${MONTH_SHORT[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
        },
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: labelColor, margin: 12 },
    },
    series: [
      {
        name: 'Price',
        type: 'line',
        data: points.map((p) => p.price),
        smooth: false,
        showSymbol: false,
        lineStyle: { color: seriesColor, width: 2 },
        itemStyle: { color: seriesColor },
        z: 1,
      },
      {
        name: 'Diamonds',
        type: 'scatter',
        data: diamondData,
        symbol: 'diamond',
        symbolSize: 10,
        itemStyle: { color: '#000000', opacity: 1, borderWidth: 0 },
        emphasis: { disabled: true },
        z: 2,
      },
    ],
  };
}

export function renderSvg(
  points: PricePoint[],
  diamonds: DiamondPoint[],
  opts: RenderOptions = {},
): string {
  ensureTheme();
  const { width = 800, height = 450, title = 'Pricing' } = opts;

  const chart = echarts.init(null, themeName, {
    renderer: 'svg',
    ssr: true,
    width,
    height,
  });

  chart.setOption(buildOption(points, diamonds, title));
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}

/**
 * Rasterizes an already-rendered SVG string to PNG at the given DPI. Split
 * out of `renderPng` so a caller that already has the SVG (e.g. the
 * combined SVG+PNG endpoint) can rasterize it directly instead of paying
 * for a second `renderSvg` call.
 */
export async function svgToPng(svg: string, dpi?: number): Promise<Buffer> {
  // `dpi` is validated to [72, 600] (or defaulted) upstream in the route
  // handler via `validateDpi` - no floor needed here. Flooring to BASE_DPI
  // used to silently collapse any requested dpi below 96 to a fixed 96-DPI
  // output; scaling directly keeps density proportional across the full
  // validated range.
  const resolvedDpi = dpi ?? 192;
  const scale = resolvedDpi / BASE_DPI;
  return sharp(Buffer.from(svg), { density: SHARP_BASE_DENSITY * scale })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

export async function renderPng(
  points: PricePoint[],
  diamonds: DiamondPoint[],
  opts: RenderOptions = {},
): Promise<Buffer> {
  const svg = renderSvg(points, diamonds, opts);
  return svgToPng(svg, opts.dpi);
}

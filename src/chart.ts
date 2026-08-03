import * as echarts from 'echarts';
import sharp from 'sharp';
import type { EChartsOption } from 'echarts';
import { baseChartOption, labelColor, seriesColor, themeDefinition, themeName } from './theme';
import type { PricePoint } from './data';

let themeRegistered = false;
function ensureTheme(): void {
  if (themeRegistered) return;
  echarts.registerTheme(themeName, themeDefinition);
  themeRegistered = true;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  title?: string;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function labelIndicesForCurrentMonth(points: PricePoint[]): Set<number> {
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

function buildOption(points: PricePoint[], title: string): EChartsOption {
  const labeled = labelIndicesForCurrentMonth(points);

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
      },
    ],
  };
}

export function renderSvg(points: PricePoint[], opts: RenderOptions = {}): string {
  ensureTheme();
  const { width = 800, height = 450, title = 'Pricing' } = opts;

  const chart = echarts.init(null, themeName, {
    renderer: 'svg',
    ssr: true,
    width,
    height,
  });

  chart.setOption(buildOption(points, title));
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}

export async function renderPng(points: PricePoint[], opts: RenderOptions = {}): Promise<Buffer> {
  const svg = renderSvg(points, opts);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

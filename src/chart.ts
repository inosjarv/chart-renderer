import * as echarts from 'echarts';
import sharp from 'sharp';
import type { EChartsOption } from 'echarts';
import { baseChartOption, themeDefinition, themeName } from './theme';
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

function buildOption(points: PricePoint[], title: string): EChartsOption {
  return {
    ...baseChartOption(),
    title: { text: title, left: 'center' },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.date),
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { formatter: '{value}' },
    },
    series: [
      {
        name: 'Price',
        type: 'line',
        data: points.map((p) => p.price),
        areaStyle: { opacity: 0.15 },
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

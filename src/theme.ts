import type { EChartsOption } from 'echarts';

export const themeName = 'pricingLight';

export const seriesColor = '#DB0011';
export const labelColor = '#000000';

export const themeDefinition = {
  color: [seriesColor],
  backgroundColor: '#ffffff',
  textStyle: {
    fontFamily: 'Helvetica, Arial, sans-serif',
    color: labelColor,
  },
  title: {
    textStyle: { color: labelColor, fontWeight: 600, fontSize: 18 },
    subtextStyle: { color: labelColor, fontSize: 12 },
  },
  line: {
    itemStyle: { borderWidth: 2 },
    lineStyle: { width: 2 },
    symbol: 'none',
    smooth: false,
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#cccccc' } },
    axisTick: { lineStyle: { color: '#cccccc' } },
    axisLabel: { color: labelColor, margin: 12 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: labelColor, margin: 12 },
    splitLine: { lineStyle: { color: '#eeeeee', type: 'dashed' } },
  },
};

export function baseChartOption(): Partial<EChartsOption> {
  return {
    grid: { left: 72, right: 40, top: 96, bottom: 64, containLabel: true },
    tooltip: { trigger: 'axis' },
    animation: false,
  };
}

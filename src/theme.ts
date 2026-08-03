import type { EChartsOption } from 'echarts';

export const themeName = 'pricingLight';

export const themeDefinition = {
  color: ['#2f7ed8', '#0d233a', '#8bbc21', '#910000', '#1aadce'],
  backgroundColor: '#ffffff',
  textStyle: {
    fontFamily: 'Helvetica, Arial, sans-serif',
    color: '#333333',
  },
  title: {
    textStyle: { color: '#1a1a1a', fontWeight: 600, fontSize: 18 },
    subtextStyle: { color: '#666666', fontSize: 12 },
  },
  line: {
    itemStyle: { borderWidth: 2 },
    lineStyle: { width: 2 },
    symbolSize: 6,
    symbol: 'circle',
    smooth: true,
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#cccccc' } },
    axisTick: { lineStyle: { color: '#cccccc' } },
    axisLabel: { color: '#555555' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#555555' },
    splitLine: { lineStyle: { color: '#eeeeee', type: 'dashed' } },
  },
};

export function baseChartOption(): Partial<EChartsOption> {
  return {
    grid: { left: 60, right: 30, top: 60, bottom: 50, containLabel: true },
    tooltip: { trigger: 'axis' },
    animation: false,
  };
}

import { describe, expect, it } from 'vitest';
import { buildOption, labelIndicesForCurrentMonth } from './chart';
import type { DiamondPoint, PricePoint } from './data';

describe('labelIndicesForCurrentMonth', () => {
  it('labels one index per year that falls in the current month', () => {
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const otherMonth = (currentMonth + 6) % 12;

    const points: PricePoint[] = [
      { date: `2022-${String(otherMonth + 1).padStart(2, '0')}-15`, price: 1 },
      { date: `2022-${String(currentMonth + 1).padStart(2, '0')}-10`, price: 2 },
      { date: `2023-${String(currentMonth + 1).padStart(2, '0')}-05`, price: 3 },
    ];

    const labeled = labelIndicesForCurrentMonth(points);
    expect(labeled.has(0)).toBe(false);
    expect(labeled.has(1)).toBe(true);
    expect(labeled.has(2)).toBe(true);
  });

  it('labels only the first matching point within a given year', () => {
    const currentMonth = new Date().getUTCMonth();
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const points: PricePoint[] = [
      { date: `2024-${monthStr}-05`, price: 1 },
      { date: `2024-${monthStr}-20`, price: 2 },
    ];

    const labeled = labelIndicesForCurrentMonth(points);
    expect(labeled.has(0)).toBe(true);
    expect(labeled.has(1)).toBe(false);
  });

  it('returns an empty set when no point falls in the current month', () => {
    const currentMonth = new Date().getUTCMonth();
    const otherMonth = (currentMonth + 6) % 12;
    const points: PricePoint[] = [
      { date: `2024-${String(otherMonth + 1).padStart(2, '0')}-01`, price: 1 },
    ];

    expect(labelIndicesForCurrentMonth(points).size).toBe(0);
  });
});

describe('buildOption - diamond-point mapping', () => {
  const points: PricePoint[] = [
    { date: '2024-01-01', price: 100 },
    { date: '2024-01-02', price: 101 },
    { date: '2024-01-03', price: 102 },
  ];

  it('maps each diamond to the index of its matching date in points', () => {
    const diamonds: DiamondPoint[] = [
      { date: '2024-01-01', price: 100 },
      { date: '2024-01-03', price: 102 },
    ];

    const option = buildOption(points, diamonds, 'Title');
    const series = option.series as Array<{ name: string; data: unknown }>;
    const diamondSeries = series.find((s) => s.name === 'Diamonds');

    expect(diamondSeries?.data).toEqual([
      [0, 100],
      [2, 102],
    ]);
  });

  it('drops diamonds whose date has no matching point', () => {
    const diamonds: DiamondPoint[] = [
      { date: '2024-01-02', price: 101 },
      { date: '2099-01-01', price: 999 }, // no matching point
    ];

    const option = buildOption(points, diamonds, 'Title');
    const series = option.series as Array<{ name: string; data: unknown }>;
    const diamondSeries = series.find((s) => s.name === 'Diamonds');

    expect(diamondSeries?.data).toEqual([[1, 101]]);
  });

  it('produces an empty diamond series when there are no diamonds', () => {
    const option = buildOption(points, [], 'Title');
    const series = option.series as Array<{ name: string; data: unknown }>;
    const diamondSeries = series.find((s) => s.name === 'Diamonds');

    expect(diamondSeries?.data).toEqual([]);
  });
});

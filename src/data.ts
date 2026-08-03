export interface PricePoint {
  date: string;
  price: number;
}

export interface FetchOptions {
  symbol?: string;
  from?: string;
  to?: string;
  years?: number;
}

export interface DiamondPoint {
  date: string;
  price: number;
}

export async function fetchPricingData(opts: FetchOptions = {}): Promise<PricePoint[]> {
  // Replace this with a real upstream call (e.g. fetch from an API).
  // Stub generates ~3 years of daily points so the label logic is exercisable.
  const years = opts.years ?? 3;
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(end.getFullYear() - years);

  const points: PricePoint[] = [];
  let price = 100;
  const cursor = new Date(start);
  while (cursor <= end) {
    price = Math.max(10, price + (Math.random() - 0.48) * 2);
    points.push({
      date: cursor.toISOString().slice(0, 10),
      price: Number(price.toFixed(2)),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export async function fetchDiamondPoints(points: PricePoint[]): Promise<DiamondPoint[]> {
  // Real upstream would return its own dates; for the stub we sample 2-3
  // points per calendar year from the pricing series so the markers sit
  // exactly on the line.
  const byYear = new Map<number, PricePoint[]>();
  for (const p of points) {
    const year = new Date(p.date).getUTCFullYear();
    const bucket = byYear.get(year) ?? [];
    bucket.push(p);
    byYear.set(year, bucket);
  }

  const diamonds: DiamondPoint[] = [];
  for (const bucket of byYear.values()) {
    if (bucket.length === 0) continue;
    const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    const picked = new Set<number>();
    while (picked.size < Math.min(count, bucket.length)) {
      picked.add(Math.floor(Math.random() * bucket.length));
    }
    for (const idx of [...picked].sort((a, b) => a - b)) {
      diamonds.push({ date: bucket[idx].date, price: bucket[idx].price });
    }
  }
  return diamonds;
}

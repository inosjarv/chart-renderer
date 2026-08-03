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

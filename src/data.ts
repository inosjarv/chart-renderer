export interface PricePoint {
  date: string;
  price: number;
}

export interface FetchOptions {
  symbol?: string;
  from?: string;
  to?: string;
}

export async function fetchPricingData(opts: FetchOptions = {}): Promise<PricePoint[]> {
  // Replace this with a real upstream call (e.g. fetch from an API).
  // Kept as a stub so the rendering pipeline is testable without network.
  const _ = opts;
  return [
    { date: '2026-07-01', price: 128.4 },
    { date: '2026-07-02', price: 130.1 },
    { date: '2026-07-03', price: 129.7 },
    { date: '2026-07-04', price: 132.5 },
    { date: '2026-07-05', price: 135.2 },
    { date: '2026-07-06', price: 134.0 },
    { date: '2026-07-07', price: 137.8 },
    { date: '2026-07-08', price: 140.3 },
    { date: '2026-07-09', price: 139.1 },
    { date: '2026-07-10', price: 142.6 },
  ];
}

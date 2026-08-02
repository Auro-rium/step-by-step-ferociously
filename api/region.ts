export default function handler(_request: unknown, response: any) {
  response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  response.status(200).json({
    country: 'GLOBAL',
    countryName: 'Global',
    provider: 'paypal',
    currency: 'USD',
    market: 'global',
  });
}

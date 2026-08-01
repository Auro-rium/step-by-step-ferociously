const countryNames: Record<string, string> = {
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  SG: 'Singapore',
  AE: 'United Arab Emirates',
  DE: 'Germany',
  FR: 'France',
};

export default function handler(request: any, response: any) {
  const raw = request.headers['x-vercel-ip-country'];
  const country = String(Array.isArray(raw) ? raw[0] : raw || 'ZZ').toUpperCase().slice(0, 2);
  const india = country === 'IN';

  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Vary', 'x-vercel-ip-country');
  response.status(200).json({
    country,
    countryName: countryNames[country] || 'International',
    provider: india ? 'razorpay' : 'stripe',
    currency: india ? 'INR' : 'USD',
    market: india ? 'india' : 'international',
  });
}

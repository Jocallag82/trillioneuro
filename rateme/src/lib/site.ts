// Public-safe site URL helper (no secrets). Used for canonical URLs and metadata.
export function siteUrl(): string {
  return (process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3100')).replace(/\/$/, '');
}
export const PUBLIC_INDEXING = () => (process.env.APP_ENV || process.env.VERCEL_ENV) === 'production' && process.env.ALLOW_INDEXING === 'true';

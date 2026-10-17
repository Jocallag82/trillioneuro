import 'server-only';

// Server-only configuration. Nothing here is ever sent to the browser.
function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export const env = {
  get databaseUrl() {
    const v = opt('DATABASE_URL');
    if (!v) throw new Error('DATABASE_URL is not configured');
    return v;
  },
  /** production | preview | development | test */
  appEnv: (opt('APP_ENV') ?? (process.env.VERCEL_ENV || process.env.NODE_ENV || 'development')) as string,
  appUrl: (opt('APP_URL') ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3100')).replace(/\/$/, ''),
  get secret() {
    const v = opt('APP_SECRET');
    if (!v) {
      if ((process.env.VERCEL_ENV || process.env.NODE_ENV) === 'production') throw new Error('APP_SECRET is not configured');
      return 'dev-only-secret-not-for-production';
    }
    return v;
  },
  stripeSecretKey: opt('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: opt('STRIPE_WEBHOOK_SECRET'),
  stripeAutomaticTax: opt('STRIPE_AUTOMATIC_TAX') === 'true',
  /** Second gate: live keys are refused unless this is explicitly "true". */
  allowLivePayments: opt('ALLOW_LIVE_PAYMENTS') === 'true',
  resendApiKey: opt('RESEND_API_KEY'),
  emailFrom: opt('EMAIL_FROM') ?? 'RateMe.ie <hello@rateme.ie>',
  cronSecret: opt('CRON_SECRET'),
  supportEmail: opt('SUPPORT_EMAIL') ?? 'support@rateme.ie',
};

export const isProduction = () => env.appEnv === 'production';

export function paymentsStatus(): { enabled: boolean; mode: 'test' | 'live' | 'off'; reason?: string } {
  const key = env.stripeSecretKey;
  if (!key || !env.stripeWebhookSecret) return { enabled: false, mode: 'off', reason: 'Payments are not configured yet.' };
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
    if (!env.allowLivePayments) return { enabled: false, mode: 'off', reason: 'Live payments are disabled until ALLOW_LIVE_PAYMENTS=true.' };
    return { enabled: true, mode: 'live' };
  }
  return { enabled: true, mode: 'test' };
}

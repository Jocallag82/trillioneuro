import 'server-only';
import Stripe from 'stripe';
import { env, paymentsStatus } from './env';

let client: Stripe | null = null;

export function stripe(): Stripe {
  const status = paymentsStatus();
  if (!status.enabled) throw new Error(status.reason || 'Payments are not configured');
  if (!client) client = new Stripe(env.stripeSecretKey!, { maxNetworkRetries: 2, timeout: 15000 });
  return client;
}

/** Verifies the Stripe-Signature header against the raw body. Throws on any mismatch. */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event {
  if (!env.stripeWebhookSecret) throw new Error('webhook secret not configured');
  if (!signature) throw new Error('missing signature');
  return Stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret, 300);
}

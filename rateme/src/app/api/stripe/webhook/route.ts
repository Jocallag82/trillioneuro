import { NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/stripe';
import { processStripeEvent } from '@/lib/billing';

export const runtime = 'nodejs';

// Membership is granted ONLY from here, after the Stripe signature is verified —
// never from the browser's success redirect.
export async function POST(req: Request) {
  const raw = await req.text();
  let event;
  try {
    event = verifyWebhook(raw, req.headers.get('stripe-signature'));
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }
  try {
    const result = await processStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (e) {
    console.error('stripe webhook processing failed', event.type, (e as Error).message);
    // 500 makes Stripe retry; the event id claim was rolled back with the transaction.
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}

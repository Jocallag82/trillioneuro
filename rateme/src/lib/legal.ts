// Operator details shown in legal pages. Set these env vars before launch.
export const operator = {
  name: process.env.LEGAL_ENTITY_NAME || 'the operator of RateMe.ie',
  address: process.env.LEGAL_ADDRESS || null,
  cro: process.env.LEGAL_CRO_NUMBER || null,
  vat: process.env.LEGAL_VAT_NUMBER || null,
  email: process.env.SUPPORT_EMAIL || 'support@rateme.ie',
  privacyEmail: process.env.PRIVACY_EMAIL || process.env.SUPPORT_EMAIL || 'privacy@rateme.ie',
  complete: !!(process.env.LEGAL_ENTITY_NAME && process.env.LEGAL_ADDRESS),
};
export const LEGAL_UPDATED = '17 October 2026';

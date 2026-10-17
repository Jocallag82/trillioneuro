import 'server-only';
import QRCode from 'qrcode';
import { sql } from './db';
import type { Tx } from './db';
import { env } from './env';
import { randomCode } from './util';

/** Every business gets one permanent short code. The QR encodes only the public URL /r/<code>. */
export async function ensureQrCode(businessId: string, tx?: Tx): Promise<string> {
  const q = tx ?? sql;
  const [existing] = await q<{ code: string }[]>`select code from qr_codes where business_id = ${businessId} and revoked_at is null`;
  if (existing) return existing.code;
  for (let i = 0; i < 5; i++) {
    const code = randomCode(8);
    const rows = await q<{ code: string }[]>`
      insert into qr_codes (business_id, code) values (${businessId}, ${code})
      on conflict do nothing returning code`;
    if (rows[0]) return rows[0].code;
    const [again] = await q<{ code: string }[]>`select code from qr_codes where business_id = ${businessId} and revoked_at is null`;
    if (again) return again.code;
  }
  throw new Error('could not allocate QR code');
}

export const qrUrl = (code: string) => `${env.appUrl}/r/${code}`;

const QR_COLOURS = { dark: '#10202BFF', light: '#FFFFFFFF' };

export async function qrPng(code: string, width = 1200): Promise<Buffer> {
  return QRCode.toBuffer(qrUrl(code), { type: 'png', width, margin: 2, errorCorrectionLevel: 'Q', color: QR_COLOURS });
}

export async function qrSvg(code: string): Promise<string> {
  return QRCode.toString(qrUrl(code), { type: 'svg', margin: 2, errorCorrectionLevel: 'Q', color: QR_COLOURS });
}

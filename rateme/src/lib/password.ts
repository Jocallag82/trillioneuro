import crypto from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 64;

export function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`)));
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return Promise.resolve(false);
  const expected = Buffer.from(hashB64, 'base64');
  return new Promise((resolve) =>
    crypto.scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
      (err, key) => resolve(!err && crypto.timingSafeEqual(key, expected))));
}

/** Basic strength rule: 10+ characters, not a trivially common password. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (pw.length > 200) return 'That password is too long.';
  if (/^(.)\1+$/.test(pw) || ['password123', '1234567890', 'qwertyuiop', 'rateme1234'].includes(pw.toLowerCase()))
    return 'That password is too easy to guess.';
  return null;
}

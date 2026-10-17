/**
 * Signed, HTTP-only demo session cookies. Web Crypto only, so it runs in middleware (edge) and Node.
 *
 * Cookie payload: { d: demoId, f: fingerprint of the access code used, e: expiry (unix s) }.
 * A session is valid only while its code's fingerprint is still listed for that demo,
 * so removing a code from DEMO_TOKENS_* revokes every session opened with it.
 */
import { DEMOS, getDemoById, getDemoTokens, type DemoConfig } from "./demos";

export const SESSION_COOKIE = "bb_demo_session";

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function getSecret(): string | null {
  const s = process.env.DEMO_SESSION_SECRET ?? "";
  return s.length >= 32 ? s : null;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function fingerprint(token: string): Promise<string> {
  return (await sha256Hex("bb-demo-token:" + token)).slice(0, 32);
}

export function sessionTtlSeconds(): number {
  const hours = Number(process.env.DEMO_SESSION_TTL_HOURS ?? "168");
  return Math.round((Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 90) : 168) * 3600);
}

/** True when the platform has the configuration it needs to grant any access at all. */
export function isConfigured(): boolean {
  return getSecret() !== null;
}

/** Finds the active demo an access code unlocks. Compares fingerprints, not raw codes. */
export async function resolveAccessCode(code: string): Promise<{ demo: DemoConfig; fp: string } | null> {
  const candidate = code.trim();
  if (candidate.length < 12 || candidate.length > 200) return null;
  const fp = await fingerprint(candidate);
  let match: { demo: DemoConfig; fp: string } | null = null;
  for (const demo of DEMOS) {
    if (demo.status !== "active") continue;
    for (const t of getDemoTokens(demo.id)) {
      // Evaluate every code so timing does not depend on which one matched.
      if ((await fingerprint(t)) === fp) match = { demo, fp };
    }
  }
  return match;
}

export async function createSessionValue(demoId: string, fp: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const payload = b64url(
    enc.encode(JSON.stringify({ d: demoId, f: fp, e: Math.floor(Date.now() / 1000) + sessionTtlSeconds() })),
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload)));
  return payload + "." + b64url(sig);
}

export interface VerifiedSession {
  demo: DemoConfig;
}

/** Verifies signature, expiry, demo status and that the originating code has not been revoked. */
export async function verifySessionValue(value: string | undefined): Promise<VerifiedSession | null> {
  const secret = getSecret();
  if (!secret || !value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), enc.encode(payload));
  } catch {
    return null;
  }
  if (!ok) return null;
  let data: { d?: unknown; f?: unknown; e?: unknown };
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    return null;
  }
  if (typeof data.d !== "string" || typeof data.f !== "string" || typeof data.e !== "number") return null;
  if (data.e < Math.floor(Date.now() / 1000)) return null;
  const demo = getDemoById(data.d);
  if (!demo) return null;
  const current = await Promise.all(getDemoTokens(demo.id).map(fingerprint));
  if (!current.includes(data.f)) return null;
  return { demo };
}

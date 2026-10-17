import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, createSessionValue, isConfigured, resolveAccessCode, sessionTtlSeconds } from "@/lib/session";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function clientKey(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
}

function back(req: NextRequest, error: string): NextResponse {
  const url = new URL("/access", req.url);
  url.searchParams.set("error", error);
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function grant(req: NextRequest, code: string | null): Promise<NextResponse> {
  if (!isConfigured()) return back(req, "unavailable");
  const key = clientKey(req);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    const res = back(req, "rate");
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return res;
  }
  const match = code ? await resolveAccessCode(code) : null;
  if (!match) return back(req, "invalid");
  const value = await createSessionValue(match.demo.id, match.fp);
  if (!value) return back(req, "unavailable");
  clearRateLimit(key);

  const res = NextResponse.redirect(new URL(`/demos/${match.demo.slug}`, req.url), 303);
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds(),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Shareable link: /access/enter?code=… — redirects immediately so the code leaves the address bar. */
export async function GET(req: NextRequest) {
  return grant(req, req.nextUrl.searchParams.get("code"));
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const code = form?.get("code");
  return grant(req, typeof code === "string" ? code : null);
}

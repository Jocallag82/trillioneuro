import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

function signOut(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/access?signed-out=1", req.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// POST only, so prefetchers and crawlers can't trigger it.
export const POST = signOut;

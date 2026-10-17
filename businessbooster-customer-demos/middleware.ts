import { NextResponse, type NextRequest } from "next/server";
import { getDemoBySlug } from "@/lib/demos";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/session";

const ROBOTS = "noindex, nofollow, noarchive, nosnippet, noimageindex";

function privateHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", ROBOTS);
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  res.headers.set("Vary", "Cookie");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const slug = pathname.split("/")[2] ?? "";
  const demo = getDemoBySlug(slug);
  const session = await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);

  // Unknown slugs, missing/invalid sessions and sessions for a different demo all look identical,
  // so the gate never confirms whether a given prospect has a demo.
  if (!demo || !session || session.demo.id !== demo.id) {
    const url = req.nextUrl.clone();
    url.pathname = "/access";
    url.search = "";
    return privateHeaders(NextResponse.redirect(url, 303));
  }

  if (demo.status !== "active") {
    const url = req.nextUrl.clone();
    url.pathname = "/unavailable";
    url.search = "";
    return privateHeaders(NextResponse.rewrite(url, { status: 410 }));
  }

  return privateHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/demos", "/demos/:path*"],
};

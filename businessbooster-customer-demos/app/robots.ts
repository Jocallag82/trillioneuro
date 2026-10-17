import type { MetadataRoute } from "next";

// No sitemap is generated or referenced. Demo routes also send X-Robots-Tag: noindex on every response.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: ["/demos/", "/access", "/logout"] }] };
}

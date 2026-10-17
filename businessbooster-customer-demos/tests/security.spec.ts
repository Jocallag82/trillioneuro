import { expect, test } from "@playwright/test";
import { TEST_CODE } from "../playwright.config";
import { BASE } from "./helpers";

const ROBOTS_RE = /noindex.*nofollow.*noarchive/;
const PROTECTED = [BASE, `${BASE}/cakes`, `${BASE}/cakes/fresh-cream-sponge`, `${BASE}/locations/trinity-street-drogheda`, `${BASE}/trade`, `${BASE}/nope`, "/demos/some-other-prospect", "/demos"];

test.describe("access gate", () => {
  for (const path of PROTECTED) {
    test(`unauthenticated ${path} is redirected without content`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(303);
      expect(res.headers()["location"]).toMatch(/\/access$/);
      expect(res.headers()["x-robots-tag"]).toMatch(ROBOTS_RE);
      expect(res.headers()["cache-control"]).toContain("no-store");
      expect(await res.text()).not.toMatch(/McCloskey/i);
    });
  }

  test("RSC / prefetch requests are gated too", async ({ request }) => {
    const res = await request.get(`${BASE}/cakes`, { maxRedirects: 0, headers: { RSC: "1", "Next-Router-Prefetch": "1" } });
    expect(res.status()).toBe(303);
  });

  test("wrong code is rejected with a generic error", async ({ page }) => {
    await page.goto("/access");
    await page.getByLabel("Access code").fill("definitely-not-a-valid-code");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/access\?error=invalid/);
    await expect(page.locator("p[role=alert]")).toContainText("wasn't recognised");
  });

  test("tampered session cookie is rejected", async ({ context, request, baseURL }) => {
    await context.addCookies([{ name: "bb_demo_session", value: "eyJkIjoibWNjbG9za2V5cy1iYWtlcnkifQ.forged", url: baseURL! }]);
    const res = await request.get(BASE, { maxRedirects: 0, headers: { cookie: "bb_demo_session=eyJkIjoibWNjbG9za2V5cy1iYWtlcnkifQ.forged" } });
    expect(res.status()).toBe(303);
  });

  test("valid code opens the demo; cookie is HttpOnly; logout ends the session", async ({ page, context }) => {
    await page.goto("/access");
    await page.getByLabel("Access code").fill(TEST_CODE);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === "bb_demo_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("bb_demo_session");

    const res = await page.request.get(BASE);
    expect(res.headers()["cache-control"]).toContain("private");
    expect(res.headers()["x-robots-tag"]).toMatch(ROBOTS_RE);

    await page.getByRole("button", { name: "Exit preview" }).click();
    await expect(page).toHaveURL(/\/access\?signed-out=1/);
    await page.goto(BASE);
    await expect(page).toHaveURL(/\/access$/);
  });

  test("shareable link signs in and strips the code from the URL", async ({ page }) => {
    await page.goto(`/access/enter?code=${encodeURIComponent(TEST_CODE)}`);
    await expect(page).toHaveURL(new RegExp(`${BASE}$`));
    expect(page.url()).not.toContain(TEST_CODE);
  });

  test("repeated bad attempts are rate limited", async ({ request }) => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}`;
    let last = 0;
    let retryAfter: string | undefined;
    for (let i = 0; i < 10; i++) {
      const res = await request.post("/access/enter", { form: { code: "wrong-code-wrong-code" }, maxRedirects: 0, headers: { "x-forwarded-for": ip } });
      last = res.status();
      retryAfter = res.headers()["retry-after"];
      if (res.headers()["location"]?.includes("error=rate")) break;
    }
    expect(last).toBe(303);
    expect(retryAfter).toBeTruthy();
  });
});

test.describe("search-engine exclusion", () => {
  test("robots.txt disallows demo and gate routes and lists no sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toMatch(/Disallow: \/demos\//);
    expect(body).toMatch(/Disallow: \/access/);
    expect(body.toLowerCase()).not.toContain("sitemap");
  });

  test("no sitemap is served", async ({ request }) => {
    expect((await request.get("/sitemap.xml")).status()).toBe(404);
  });

  for (const path of ["/", "/access", "/robots.txt", "/does-not-exist"]) {
    test(`X-Robots-Tag on ${path}`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.headers()["x-robots-tag"]).toMatch(ROBOTS_RE);
    });
  }

  test("public pages never name a prospect", async ({ request }) => {
    for (const path of ["/", "/access", "/robots.txt"]) {
      expect(await (await request.get(path)).text()).not.toMatch(/McCloskey/i);
    }
  });

  test("demo HTML has noindex meta, no canonical, no Open Graph, no JSON-LD", async ({ page }) => {
    await page.goto(`/access/enter?code=${encodeURIComponent(TEST_CODE)}`);
    for (const path of [BASE, `${BASE}/cakes/fresh-cream-mandarin`, `${BASE}/locations/navan-shopping-centre`]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      await expect(page.locator('meta[property^="og:"]')).toHaveCount(0);
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    }
  });
});

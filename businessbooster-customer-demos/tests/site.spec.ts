import { expect, test, type Page } from "@playwright/test";
import { BASE, NOTICE, signIn, watchErrors } from "./helpers";

const PAGES = [
  BASE,
  `${BASE}/cakes`,
  `${BASE}/cakes/fresh-cream-sponge`,
  `${BASE}/cakes/chocolate-sponge`,
  `${BASE}/bakery`,
  `${BASE}/locations`,
  `${BASE}/locations?town=Dundalk`,
  `${BASE}/locations/moorland-cafe-drogheda`,
  `${BASE}/locations/ballymakenny-bakery`,
  `${BASE}/trade`,
  `${BASE}/our-story`,
  `${BASE}/contact`,
];

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => signIn(page));

for (const path of PAGES) {
  test(`renders ${path}: notice, single h1, no overflow, no console errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByText(NOTICE.replace("'", "’")).first().or(page.getByText(NOTICE).first())).toBeVisible();
    await noHorizontalOverflow(page);
    // images/svgs all have accessible labels
    const unlabeled = await page.locator('svg[role="img"]:not([aria-label])').count();
    expect(unlabeled).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("primary navigation reaches every section", async ({ page, isMobile }) => {
  const targets = [
    ["Celebration cakes", /\/cakes$/],
    ["Bread & bakery", /\/bakery$/],
    ["Cafés & shops", /\/locations$/],
    ["Trade", /\/trade$/],
    ["Our story", /\/our-story$/],
  ] as const;
  for (const [label, url] of targets) {
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: label, exact: true }).click();
    } else {
      await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label, exact: true }).click();
    }
    await expect(page).toHaveURL(url);
  }
});

test("cake catalogue → detail → demo order journey never submits", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => r.method() !== "GET" && posts.push(r.url()));
  await page.goto(`${BASE}/cakes`);
  await page.getByRole("link", { name: /Fresh Cream Mandarin/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fresh Cream Mandarin");

  const form = page.getByRole("form", { name: /Order Fresh Cream Mandarin/ });
  await expect(form.getByRole("button", { name: "Continue" })).toBeDisabled();
  await form.getByLabel("Collect from").selectOption({ label: "Navan Shopping Centre, Navan" });
  await form.getByLabel("Collection date").fill("2026-12-24");
  await form.getByRole("button", { name: "Continue" }).click();
  await form.getByLabel(/Message on the cake/).fill("Happy Birthday");
  await form.getByRole("button", { name: "Continue" }).click();
  await expect(form).toContainText("Navan Shopping Centre, Navan");
  await form.getByRole("button", { name: /Continue to payment/ }).click();
  await expect(page.getByRole("status")).toContainText("no order has been placed");
  expect(posts).toEqual([]);
});

test("trade enquiry form is demonstration-only", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => r.method() !== "GET" && posts.push(r.url()));
  await page.goto(`${BASE}/trade`);
  const form = page.getByRole("form", { name: /Trade enquiry/ });
  await form.getByLabel("Business name").fill("Example Café");
  await form.getByLabel("Type of business").selectOption("Café / deli");
  await form.getByLabel("Contact name").fill("Test");
  await form.getByText("Soda breads").click();
  await form.getByRole("button", { name: /Send enquiry/ }).click();
  await expect(page.getByRole("status")).toContainText("nothing has been transmitted");
  expect(posts).toEqual([]);
});

test("location finder filters by town", async ({ page }) => {
  await page.goto(`${BASE}/locations`);
  await page.getByRole("link", { name: "Navan", exact: true }).click();
  await expect(page).toHaveURL(/town=Navan/);
  await expect(page.getByText("1 location")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Navan Shopping Centre" })).toBeVisible();
});

test("unknown demo sub-route shows the demo 404 with notice", async ({ page }) => {
  const res = await page.goto(`${BASE}/missing-page`);
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /gone a bit stale/ })).toBeVisible();
  const res2 = await page.goto(`${BASE}/cakes/no-such-cake`);
  expect(res2?.status()).toBe(404);
});

test("keyboard: skip link is first focus and moves to main", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard test on desktop");
  await page.goto(BASE);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("all internal links resolve", async ({ page, isMobile }) => {
  test.skip(isMobile, "crawl once");
  const seen = new Set<string>();
  const queue = [BASE];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") || ""));
    for (const h of hrefs) {
      if (h.startsWith("/demos/") && !h.includes("#")) queue.push(h);
      else if (h.startsWith("/demos/") && h.includes("#")) queue.push(h.split("#")[0]!);
    }
  }
  expect(seen.size).toBeGreaterThan(15);
});

test("text contrast of key elements meets WCAG AA", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  await page.goto(BASE);
  const ratios = await page.evaluate(() => {
    // Normalise any CSS colour (oklab, color-mix, rgba…) via canvas, then composite over white.
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, getAlpha(css)] as const;
    };
    const getAlpha = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return ctx.getImageData(0, 0, 1, 1).data[3]! / 255;
    };
    const lum = ([r, g, b]: readonly number[]) => {
      const f = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const bgOf = (el: Element | null): string => {
      while (el) {
        const bg = getComputedStyle(el).backgroundColor;
        if (getAlpha(bg) > 0.5) return bg;
        el = el.parentElement;
      }
      return "rgb(255,255,255)";
    };
    return Array.from(document.querySelectorAll("p, a, li, h1, h2, span"))
      .filter((e) => e.textContent?.trim() && (e as HTMLElement).offsetParent !== null && e.children.length === 0)
      .map((e) => {
        const a = lum(rgba(getComputedStyle(e).color)), b = lum(rgba(bgOf(e)));
        return { t: e.textContent!.trim().slice(0, 40), r: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      })
      .filter((x) => x.r < 4.5);
  });
  expect(ratios).toEqual([]);
});

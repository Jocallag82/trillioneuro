import { expect, type Page } from "@playwright/test";
import { TEST_CODE } from "../playwright.config";

export const BASE = "/demos/mccloskeys-bakery";
export const NOTICE = "This is an independent demonstration and is not the official McCloskey's Bakery website.";

export async function signIn(page: Page) {
  await page.goto("/access");
  await page.getByLabel("Access code").fill(TEST_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}$`));
}

/** Collects console errors and failed same-origin requests for the life of the page. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === new URL(page.url() || r.url()).origin && !r.url().includes("/missing-page")) {
      errors.push(`${r.status()} ${r.url()}`);
    }
  });
  return errors;
}

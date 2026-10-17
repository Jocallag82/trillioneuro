// Unit-level checks of the session layer (revocation, expiry, disabled demos) run in Node.
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("revoking a code invalidates sessions opened with it, not others", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "runs once");
  process.env.DEMO_SESSION_SECRET = "unit-secret-0123456789-0123456789-abcd";
  process.env.DEMO_TOKENS_MCCLOSKEYS_BAKERY = "code-one-aaaaaaaaaa,code-two-bbbbbbbbbb";
  const s = await import("../lib/session");

  const one = await s.resolveAccessCode("code-one-aaaaaaaaaa");
  const two = await s.resolveAccessCode("code-two-bbbbbbbbbb");
  expect(one?.demo.id).toBe("mccloskeys-bakery");
  expect(await s.resolveAccessCode("code-three-cccccccc")).toBeNull();
  expect(await s.resolveAccessCode("short")).toBeNull();

  const c1 = (await s.createSessionValue(one!.demo.id, one!.fp))!;
  const c2 = (await s.createSessionValue(two!.demo.id, two!.fp))!;
  expect(await s.verifySessionValue(c1)).not.toBeNull();

  process.env.DEMO_TOKENS_MCCLOSKEYS_BAKERY = "code-two-bbbbbbbbbb";
  expect(await s.verifySessionValue(c1)).toBeNull();
  expect(await s.verifySessionValue(c2)).not.toBeNull();

  // Rotating the signing secret signs everyone out.
  process.env.DEMO_SESSION_SECRET = "rotated-secret-0123456789-0123456789-xy";
  expect(await s.verifySessionValue(c2)).toBeNull();

  // Missing/short secret: nothing can be granted.
  process.env.DEMO_SESSION_SECRET = "short";
  expect(s.isConfigured()).toBe(false);
  expect(await s.createSessionValue("mccloskeys-bakery", two!.fp)).toBeNull();
});

test("expired and disabled demos are rejected", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "runs once");
  process.env.DEMO_SESSION_SECRET = "unit-secret-0123456789-0123456789-abcd";
  process.env.DEMO_TOKENS_MCCLOSKEYS_BAKERY = "code-one-aaaaaaaaaa";
  process.env.DEMO_SESSION_TTL_HOURS = "0.0001";
  const s = await import("../lib/session");
  const { DEMOS } = await import("../lib/demos");
  const m = (await s.resolveAccessCode("code-one-aaaaaaaaaa"))!;
  const v = (await s.createSessionValue(m.demo.id, m.fp))!;
  await new Promise((r) => setTimeout(r, 1500));
  expect(await s.verifySessionValue(v)).toBeNull();
  delete process.env.DEMO_SESSION_TTL_HOURS;

  const demo = DEMOS[0] as { status: string };
  demo.status = "disabled";
  expect(await s.resolveAccessCode("code-one-aaaaaaaaaa")).toBeNull();
  demo.status = "active";
});

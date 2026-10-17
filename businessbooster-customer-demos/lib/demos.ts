/**
 * Demo registry. Imported only by middleware and server code — never by client components —
 * so prospect names and statuses never reach a public JavaScript bundle.
 *
 * Adding a demo: add an entry here, add its route folder under app/demos/<slug>/,
 * and set DEMO_TOKENS_<ID> in the environment.
 */

export type DemoStatus = "active" | "disabled" | "withdrawn";

export interface DemoConfig {
  /** Internal identifier; also derives the token env var name. */
  id: string;
  /** URL segment under /demos/. */
  slug: string;
  /** Prospect name, for server-rendered pages only. */
  prospectName: string;
  status: DemoStatus;
  /** Shown on every page of the demo. */
  disclaimer: string;
}

export const DEMOS: readonly DemoConfig[] = [
  {
    id: "mccloskeys-bakery",
    slug: "mccloskeys-bakery",
    prospectName: "McCloskey's Bakery",
    status: "active",
    disclaimer:
      "Website concept by BusinessBooster.ie. This is an independent demonstration and is not the official McCloskey's Bakery website.",
  },
];

export function getDemoBySlug(slug: string): DemoConfig | undefined {
  return DEMOS.find((d) => d.slug === slug);
}

export function getDemoById(id: string): DemoConfig | undefined {
  return DEMOS.find((d) => d.id === id);
}

export function tokenEnvName(demoId: string): string {
  return "DEMO_TOKENS_" + demoId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/** Current access codes for a demo, read at request time so revocation needs only an env change + redeploy. */
export function getDemoTokens(demoId: string): string[] {
  const raw = process.env[tokenEnvName(demoId)] ?? "";
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length >= 12);
}

// Prints a fresh, URL-safe demo access code. Add it to the demo's DEMO_TOKENS_* variable.
import { randomBytes } from "node:crypto";
const code = randomBytes(18).toString("base64url");
console.log(code);
console.error("\nAdd to DEMO_TOKENS_<DEMO_ID> (comma-separated), redeploy, then share:\n  https://<host>/access/enter?code=" + code);

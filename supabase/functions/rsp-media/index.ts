// rsp-media — image uploads for RipeStream posts, and purging unused files.
//
// Upload: POST multipart/form-data { key, file } from the app. The member key
// is resolved server-side (rs_member_from_key); only confirmed, unsuspended
// members with a profile may upload. The file type is decided from its bytes,
// not its name or Content-Type. Files get random names in the public
// rsp-media bucket and a row in rsp_uploads; rsp_post attaches one to a post.
//
// Purge: POST JSON { "purge": true } — sent by the rsp_posts delete trigger
// and run after every upload. Removes files whose post was deleted, and files
// never attached to a post after an hour. Safe to call by anyone: it only
// deletes what the database says is unused.
//
// Deployed with verify_jwt = false; it authenticates members itself.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "rsp-media";
const MAX_BYTES = 5 * 1024 * 1024;
const PER_HOUR = 30;
const ORIGINS = ["https://www.ripestream.com", "https://ripestream.com"];
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function cors(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

function sniff(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { ext: "gif", type: "image/gif" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: "webp", type: "image/webp" };
  return null;
}

async function purge() {
  const cutoff = new Date(Date.now() - 3600_000).toISOString();
  const { data } = await db.from("rsp_uploads").select("path")
    .is("post_id", null).or(`used.eq.true,created_at.lt.${cutoff}`).limit(100);
  const paths = (data ?? []).map((r) => r.path as string);
  if (!paths.length) return 0;
  const { error } = await db.storage.from(BUCKET).remove(paths);
  if (error) { console.error("purge", error.message); return 0; }
  await db.from("rsp_uploads").delete().in("path", paths);
  return paths.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { message: "method" });

  if ((req.headers.get("Content-Type") ?? "").startsWith("application/json")) {
    return json(req, 200, { purged: await purge() });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return json(req, 400, { message: "BAD_REQUEST: send a file" }); }
  const key = form.get("key"), file = form.get("file");
  if (typeof key !== "string" || !(file instanceof File)) return json(req, 400, { message: "BAD_REQUEST: send a file" });
  if (file.size > MAX_BYTES) return json(req, 413, { message: "TOO_BIG: images can be up to 5 MB" });

  const { data: member } = await db.rpc("rs_member_from_key", { p_key: key });
  if (typeof member !== "string") return json(req, 401, { message: "INVALID_KEY: sign in again from your member link" });
  const [{ data: m }, { data: susp }, { data: prof }] = await Promise.all([
    db.from("rs_members").select("status").eq("id", member).maybeSingle(),
    db.from("rsp_suspensions").select("member_id").eq("member_id", member).maybeSingle(),
    db.from("rsp_profiles").select("member_id").eq("member_id", member).maybeSingle(),
  ]);
  if (m?.status !== "member" || susp || !prof) return json(req, 403, { message: "NOT_ALLOWED: members with a profile only" });

  const { count } = await db.from("rsp_uploads").select("path", { count: "exact", head: true })
    .eq("member_id", member).gt("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= PER_HOUR) return json(req, 429, { message: "RATE_LIMIT: too many uploads, try again later" });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return json(req, 415, { message: "BAD_TYPE: use a JPEG, PNG, GIF or WebP image" });

  const path = `${crypto.randomUUID()}.${kind.ext}`;
  const { error: up } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: kind.type, cacheControl: "31536000" });
  if (up) return json(req, 500, { message: "UPLOAD_FAILED: try again" });
  const { error: ins } = await db.from("rsp_uploads").insert({ path, member_id: member });
  if (ins) { await db.storage.from(BUCKET).remove([path]); return json(req, 500, { message: "UPLOAD_FAILED: try again" }); }

  purge().catch(() => {});
  return json(req, 200, { path, url: `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${BUCKET}/${path}` });
});

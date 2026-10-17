// rsp-mail — emails a member when someone replies to their post or mentions them.
//
// Called by the rsp_notifications insert trigger (pg_net) with {"id": <bigint>}.
// Safe without auth, like rs-member: the body is only a notification id, the
// recipient comes from the database, and the row is claimed (emailed_at set)
// before sending, so replays send nothing.
//
// Skipped (but still claimed) when the recipient turned email off, isn't an
// active member, or was already emailed in the last 15 minutes — a busy
// thread sends one email, not dozens. The app shows everything regardless.
//
// SMTP: the same Vault secrets as rs-member, via rs_mail_config().
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const SITE = "https://www.ripestream.com";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
type Cfg = { smtp_user: string | null; smtp_pass: string | null; mail_from: string | null };
let cfg: Cfg | null = null;
let mailer: ReturnType<typeof nodemailer.createTransport> | null = null;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  let id: unknown;
  try { ({ id } = await req.json()); } catch { return json(400, { error: "body" }); }
  if (typeof id !== "number" || !Number.isSafeInteger(id)) return json(400, { error: "id" });

  const { data: claimed } = await db.from("rsp_notifications")
    .update({ emailed_at: new Date().toISOString() }).eq("id", id).is("emailed_at", null)
    .in("kind", ["reply", "mention"]).select("id,member_id,kind,actor,post_id");
  const n = claimed?.[0];
  if (!n) return json(200, { skipped: "claimed" });

  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const [{ data: to }, { data: prefs }, { data: susp }, { count: recent }, { data: actor }, { data: post }] = await Promise.all([
    db.from("rs_members").select("email,status").eq("id", n.member_id).maybeSingle(),
    db.from("rsp_prefs").select("email_notify").eq("member_id", n.member_id).maybeSingle(),
    db.from("rsp_suspensions").select("member_id").eq("member_id", n.member_id).maybeSingle(),
    db.from("rsp_notifications").select("id", { count: "exact", head: true })
      .eq("member_id", n.member_id).neq("id", n.id).gt("emailed_at", since),
    db.from("rsp_profiles").select("handle,display_name").eq("member_id", n.actor).maybeSingle(),
    n.post_id ? db.from("rsp_posts").select("body").eq("id", n.post_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!to || to.status !== "member" || susp || prefs?.email_notify === false) return json(200, { skipped: "recipient" });
  if ((recent ?? 0) > 0) return json(200, { skipped: "throttled" });
  if (!actor) return json(200, { skipped: "actor" });

  if (!cfg) {
    const { data, error } = await db.rpc("rs_mail_config");
    if (error) return json(500, { error: error.message });
    cfg = (Array.isArray(data) ? data[0] : data) as Cfg;
  }
  if (!cfg?.smtp_user || !cfg?.smtp_pass) { cfg = null; return json(503, { error: "SMTP credentials not in Vault" }); }
  mailer ??= nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: cfg.smtp_user, pass: cfg.smtp_pass } });

  const who = actor.display_name || actor.handle;
  const what = n.kind === "reply" ? "replied to your post" : "mentioned you";
  const link = n.post_id ? `${SITE}/app#/p/${n.post_id}` : `${SITE}/app#/notifications`;
  const snippet = String(post?.body ?? "").slice(0, 200);
  const foot = "You get these for replies and mentions. Turn them off in RipeStream under Feed & profile.";
  const html = `<!doctype html><html><body style="margin:0;background:#0c0a09;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161312;border-radius:24px;border:1px solid #2a2522">
<tr><td style="padding:32px 32px 0;font-size:20px;font-weight:800;color:#f3eee6">Ripe<span style="color:#ff5b1f">Stream</span></td></tr>
<tr><td style="padding:22px 32px 0;font-size:24px;line-height:1.2;font-weight:800;color:#f3eee6">${esc(who)} ${what}.</td></tr>
${snippet ? `<tr><td style="padding:14px 32px 0;font-size:15px;line-height:1.6;color:#cfc8bd;white-space:pre-wrap">${esc(snippet)}</td></tr>` : ""}
<tr><td style="padding:24px 32px 32px"><a href="${link}" style="display:inline-block;background:#ff5b1f;color:#0c0a09;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px">Open in RipeStream</a></td></tr>
</table>
<p style="max-width:520px;margin:18px auto 0;font-size:12px;line-height:1.6;color:#7b746c">${foot} · <a href="${SITE}/privacy" style="color:#a8a096">Privacy</a></p>
</td></tr></table></body></html>`;
  try {
    await mailer.sendMail({
      from: cfg.mail_from || `RipeStream <${cfg.smtp_user}>`,
      replyTo: "hello@ripestream.com",
      to: to.email,
      subject: `${who} ${what} on RipeStream`,
      text: `${who} ${what}.\n\n${snippet}\n\nOpen: ${link}\n\n${foot}`,
      html,
    });
  } catch (e) {
    await db.from("rsp_notifications").update({ emailed_at: null }).eq("id", n.id);
    return json(502, { error: String(e) });
  }
  return json(200, { sent: true });
});

// rs-notify — emails for the RipeStream interest list.
//
// Called by the rs_interests AFTER INSERT trigger (pg_net) with {"id": "<uuid>"}.
// Sends the registrant a confirmation and the owner an alert.
//
// Deployed with verify_jwt = false, so anyone can call the URL. That is safe
// because the body carries only a row id (an unguessable uuid) and the row's
// `notified_at` makes every send one-shot: a replayed or forged call finds
// nothing to send. The email address is always read from the database, never
// taken from the request.
//
// Sends through Google Workspace SMTP (smtp.gmail.com:465 — Edge Functions
// block 25/587). Credentials live in Supabase Vault, read by the service-role-
// only RPC rs_mail_config(); nothing secret is in this file or the repo:
//   rs_smtp_user     Workspace account that authenticates (e.g. hello@conjora.ie)
//   rs_smtp_pass     its Google app password
//   rs_admin_email   where the "new sign-up" alert goes
//   rs_from          From header; hello@ripestream.com must be a "Send mail as"
//                    alias on that account or Gmail rewrites it to the account
// Missing password -> 503 and notified_at stays null; rs_notify_backlog()
// sends those later.
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
type Cfg = { smtp_user: string | null; smtp_pass: string | null; admin_email: string | null; mail_from: string | null };
let cfg: Cfg | null = null;
let mailer: ReturnType<typeof nodemailer.createTransport> | null = null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// "JONATHAN" / "jonathan" -> "Jonathan"; leaves "McKenna" alone.
const tidy = (n: string | null) => {
  if (!n) return "";
  const t = n.trim();
  return t === t.toUpperCase() || t === t.toLowerCase() ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
};

async function send(msg: { to: string; subject: string; html: string; text: string }) {
  await mailer!.sendMail({
    from: cfg!.mail_from || `RipeStream <${cfg!.smtp_user}>`,
    replyTo: "hello@ripestream.com",
    ...msg,
  });
}

function welcome(name: string) {
  const hi = name ? `You're on the list, ${esc(name)}.` : "You're on the list.";
  const text = `${hi.replace(/&#39;/g, "'")}

You're officially interested in RipeStream.
We'll let you know when there's something worth seeing.

RipeStream is a new kind of social network, being built right now. This is an
interest list — not an account — so there's nothing else to do.

Didn't sign up? Reply to this email and we'll remove you.

RipeStream · https://ripestream.com`;
  const html = `<!doctype html><html><body style="margin:0;background:#0c0a09;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161312;border-radius:24px;border:1px solid #2a2522">
<tr><td style="padding:36px 36px 8px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:30px;height:30px;border-radius:50%;background:#ff5b1f"></td>
<td style="padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-.5px;color:#f3eee6">Ripe<span style="color:#ff5b1f">Stream</span></td>
</tr></table></td></tr>
<tr><td style="padding:28px 36px 0;font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-1px;color:#f3eee6">${hi}</td></tr>
<tr><td style="padding:18px 36px 0;font-size:16px;line-height:1.6;color:#cfc8bd">You're officially interested in RipeStream.<br>We'll let you know when there's something worth seeing.</td></tr>
<tr><td style="padding:24px 36px 0"><div style="height:4px;width:64px;background:#ff5b1f;border-radius:2px"></div></td></tr>
<tr><td style="padding:24px 36px 0;font-size:14px;line-height:1.6;color:#a8a096">RipeStream is a new kind of social network, being built right now. This is an interest list, not an account — there's nothing else you need to do.</td></tr>
<tr><td style="padding:28px 36px 36px"><a href="https://ripestream.com" style="display:inline-block;background:#ff5b1f;color:#0c0a09;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:999px">Visit ripestream.com</a></td></tr>
</table>
<p style="max-width:520px;margin:18px auto 0;font-size:12px;line-height:1.6;color:#7b746c">Didn't sign up? Reply to this email and we'll remove you. · <a href="https://ripestream.com/privacy" style="color:#a8a096">Privacy</a></p>
</td></tr></table></body></html>`;
  return { html, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  let id: unknown;
  try { ({ id } = await req.json()); } catch { return json(400, { error: "body" }); }
  if (typeof id !== "string" || !UUID.test(id)) return json(400, { error: "id" });
  if (!cfg) {
    const { data, error: e } = await db.rpc("rs_mail_config");
    if (e) return json(500, { error: e.message });
    cfg = (Array.isArray(data) ? data[0] : data) as Cfg;
  }
  if (!cfg?.smtp_user || !cfg?.smtp_pass) { cfg = null; return json(503, { error: "SMTP credentials not in Vault" }); }
  mailer ??= nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
  });

  const { data: row, error } = await db.from("rs_interests")
    .select("id,email,first_name,source,created_at").eq("id", id).is("notified_at", null).maybeSingle();
  if (error) return json(500, { error: error.message });
  if (!row) return json(200, { skipped: true });            // unknown id or already sent

  // Claim the row before sending so two concurrent calls can't both send.
  const { data: claimed } = await db.from("rs_interests")
    .update({ notified_at: new Date().toISOString() }).eq("id", id).is("notified_at", null).select("id");
  if (!claimed?.length) return json(200, { skipped: true });

  const name = tidy(row.first_name);
  try {
    const w = welcome(name);
    await send({ to: row.email, subject: name ? `You're on the list, ${name}.` : "You're on the list.", ...w });
  } catch (e) {
    await db.from("rs_interests").update({ notified_at: null }).eq("id", id);   // retry later
    return json(502, { error: String(e) });
  }

  const ADMIN = cfg.admin_email;
  if (ADMIN) {
    const { count } = await db.from("rs_interests").select("id", { count: "exact", head: true });
    const who = `${name || "(no name)"} <${row.email}>`;
    await send({
      to: ADMIN,
      subject: `New RipeStream sign-up: ${name || row.email}`,
      text: `${who}\nForm: ${row.source ?? "?"}\nWhen: ${row.created_at}\nTotal on the list: ${count ?? "?"}`,
      html: `<p style="font-family:sans-serif;font-size:15px"><b>${esc(who)}</b><br>Form: ${esc(row.source ?? "?")}<br>When: ${esc(row.created_at)}<br>Total on the list: <b>${count ?? "?"}</b></p>`,
    }).catch((e) => console.error("admin alert failed", e));    // never fails the user's email
  }
  return json(200, { sent: true });
});

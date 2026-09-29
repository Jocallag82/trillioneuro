// rs-member — member emails for RipeStream's founding-member / invite launch.
//
// Called by the rs_members mail trigger (pg_net) with {"id": "<uuid>"} whenever
// a row's mail_kind is set:
//   confirm  first email after joining: "confirm your email to claim your place"
//   link     a known member asked for their link again
// Both carry a freshly minted member key (https://ripestream.com/member#k=…).
// Opening it is what confirms the email, and it's the only way into the member
// area — so the key never exists anywhere but this email and the member's
// browser. The database keeps only its SHA-256.
//
// Deployed with verify_jwt = false, like rs-notify. Safe for the same reasons:
// the body is only a row id, the email address is read from the database, and
// the row is claimed (mail_kind cleared) before sending, so a replayed or
// forged call finds nothing to send.
//
// SMTP credentials: the same Vault secrets rs-notify uses, via rs_mail_config().
// Missing password -> 503 and mail_kind stays set; after adding it run
//   select public.rs_member_mail_backlog();
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const SITE = "https://ripestream.com";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
type Cfg = { smtp_user: string | null; smtp_pass: string | null; admin_email: string | null; mail_from: string | null };
type Row = { id: string; email: string; first_name: string | null; status: string; founding_number: number | null; mail_kind: "confirm" | "link"; source: string | null; invited_by: string | null };
let cfg: Cfg | null = null;
let mailer: ReturnType<typeof nodemailer.createTransport> | null = null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const tidy = (n: string | null) => {
  if (!n) return "";
  const t = n.trim();
  return t === t.toUpperCase() || t === t.toLowerCase() ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
};

function frame(title: string, bodyHtml: string, cta: { href: string; label: string }, foot: string) {
  return `<!doctype html><html><body style="margin:0;background:#0c0a09;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161312;border-radius:24px;border:1px solid #2a2522">
<tr><td style="padding:36px 36px 8px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:30px;height:30px;border-radius:50%;background:#ff5b1f"></td>
<td style="padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-.5px;color:#f3eee6">Ripe<span style="color:#ff5b1f">Stream</span></td>
</tr></table></td></tr>
<tr><td style="padding:28px 36px 0;font-size:32px;line-height:1.05;font-weight:800;letter-spacing:-1px;color:#f3eee6">${title}</td></tr>
${bodyHtml}
<tr><td style="padding:28px 36px 12px"><a href="${cta.href}" style="display:inline-block;background:#ff5b1f;color:#0c0a09;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.04em;text-transform:uppercase;padding:15px 24px;border-radius:999px">${cta.label}</a></td></tr>
<tr><td style="padding:0 36px 36px;font-size:12px;line-height:1.6;color:#7b746c">This link is personal — it's your way into RipeStream while accounts are being built. Don't forward it.</td></tr>
</table>
<p style="max-width:520px;margin:18px auto 0;font-size:12px;line-height:1.6;color:#7b746c">${foot} · <a href="${SITE}/privacy" style="color:#a8a096">Privacy</a></p>
</td></tr></table></body></html>`;
}
const para = (html: string) =>
  `<tr><td style="padding:16px 36px 0;font-size:16px;line-height:1.6;color:#cfc8bd">${html}</td></tr>`;

function compose(row: Row, key: string, open: boolean) {
  const name = tidy(row.first_name);
  const link = `${SITE}/member#k=${key}`;
  const foot = "Didn't ask for this? Ignore it — nothing happens until the link is opened.";
  if (row.mail_kind === "confirm") {
    const title = name ? `One click, ${esc(name)}.` : "One click.";
    const lead = open
      ? "Confirm your email to claim your place. The first 10,000 people to confirm become RipeStream's Founding Members — numbered in the order they confirm, and kept for good."
      : "Confirm your email to take your place on RipeStream. Founding membership has closed, so your place comes from the invitation you used.";
    const text = `${title.replace(/&#39;/g, "'")}

${lead}

Confirm: ${link}

This link is personal — it's your way into RipeStream while accounts are being built.
${foot}

RipeStream · ${SITE}`;
    return {
      subject: open ? "Confirm your founding place on RipeStream" : "Confirm your place on RipeStream",
      text,
      html: frame(title, para(esc(lead)), { href: link, label: "Confirm my place" }, foot),
    };
  }
  const title = name ? `Your link, ${esc(name)}.` : "Your member link.";
  const lead = row.founding_number
    ? `Here's your way back in, Founding Member #${String(row.founding_number).padStart(4, "0")}. Your invitations are waiting.`
    : "Here's your way back into RipeStream.";
  return {
    subject: "Your RipeStream member link",
    text: `${title.replace(/&#39;/g, "'")}\n\n${lead}\n\nOpen: ${link}\n\n${foot}\n\nRipeStream · ${SITE}`,
    html: frame(title, para(esc(lead)), { href: link, label: "Open RipeStream" }, foot),
  };
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

  const { data: row, error } = await db.from("rs_members")
    .select("id,email,first_name,status,founding_number,mail_kind,source,invited_by")
    .eq("id", id).not("mail_kind", "is", null).maybeSingle<Row>();
  if (error) return json(500, { error: error.message });
  if (!row) return json(200, { skipped: true });

  // Claim before sending so two concurrent calls can't both send.
  const { data: claimed } = await db.from("rs_members")
    .update({ mail_kind: null, mailed_at: new Date().toISOString() })
    .eq("id", id).eq("mail_kind", row.mail_kind).select("id");
  if (!claimed?.length) return json(200, { skipped: true });

  const restore = () => db.from("rs_members").update({ mail_kind: row.mail_kind, mailed_at: null }).eq("id", id);
  const { data: key, error: ke } = await db.rpc("rs_issue_member_key", { p_member: id });
  if (ke || typeof key !== "string") { await restore(); return json(500, { error: ke?.message ?? "key" }); }

  const { data: status } = await db.rpc("rs_founding_status");
  const open = !!(status as { open?: boolean } | null)?.open;
  try {
    await mailer!.sendMail({
      from: cfg!.mail_from || `RipeStream <${cfg!.smtp_user}>`,
      replyTo: "hello@ripestream.com",
      to: row.email,
      ...compose(row, key, open),
    });
  } catch (e) {
    await restore();                                           // retry later via the backlog
    return json(502, { error: String(e) });
  }

  if (row.mail_kind === "confirm" && cfg.admin_email) {
    const { count } = await db.from("rs_members").select("id", { count: "exact", head: true });
    const name = tidy(row.first_name);
    const who = `${name || "(no name)"} <${row.email}>`;
    const claimedPlaces = (status as { claimed?: number } | null)?.claimed ?? "?";
    await mailer!.sendMail({
      from: cfg!.mail_from || `RipeStream <${cfg!.smtp_user}>`,
      to: cfg.admin_email,
      subject: `New RipeStream join: ${name || row.email}`,
      text: `${who}\nForm: ${row.source ?? "?"}\nInvited: ${row.invited_by ? "yes" : "no"}\nMembers (incl. unconfirmed): ${count ?? "?"}\nFounding places confirmed: ${claimedPlaces}`,
      html: `<p style="font-family:sans-serif;font-size:15px"><b>${esc(who)}</b><br>Form: ${esc(row.source ?? "?")}<br>Invited: ${row.invited_by ? "yes" : "no"}<br>Members (incl. unconfirmed): <b>${count ?? "?"}</b><br>Founding places confirmed: <b>${claimedPlaces}</b></p>`,
    }).catch((e) => console.error("admin alert failed", e));
  }
  return json(200, { sent: row.mail_kind });
});

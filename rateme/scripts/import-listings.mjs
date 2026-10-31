// Validates and (optionally) imports researched business listings from a CSV.
// Dry run by default: prints a data-quality report and writes nothing.
//   node scripts/import-listings.mjs listings.csv            (report only)
//   node scripts/import-listings.mjs listings.csv --apply    (insert as PENDING listings for admin review)
// Columns: name,category_slug,county_slug,locality,phone,website,public_email,address_line1,eircode,data_source,data_source_url
// Rules: every row needs a source; nothing is invented; personal-looking emails and home addresses are not imported.
import fs from 'node:fs';
import postgres from 'postgres';

const [file, flag] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/import-listings.mjs <file.csv> [--apply]'); process.exit(1); }
const apply = flag === '--apply';
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exit(1); }

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const FREE = /@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|eircom|gmx|aol|proton|protonmail|msn)\./i;
const ROLE = /^(info|hello|contact|office|admin|sales|enquiries|bookings|reception|accounts|team|support)@/i;
const titleCase = (s) => s.replace(/\s+/g, ' ').trim().replace(/\b(LTD|LIMITED)\b\.?/gi, 'Ltd');
const phoneOk = (p) => /^(\+353|0)[1-9][\d ]{6,12}$/.test(p.replace(/[-()]/g, ' ').replace(/\s+/g, ' ').trim());
const eircodeOk = (e) => /^[A-Z][0-9][0-9W] ?[0-9AC-FHKNPRTV-Y]{4}$/i.test(e);
const domainOf = (w) => { try { return new URL(/^https?:/.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, ''); } catch { return null; } };
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

const sql = postgres(url, { max: 1, onnotice: () => {}, connection: { search_path: 'rateme,extensions,public' } });
try {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const cats = new Map((await sql`select id, slug from categories where active`).map((c) => [c.slug, c.id]));
  const counties = new Map((await sql`select id, slug from counties`).map((c) => [c.slug, c.id]));
  const report = { ok: 0, rejected: 0, warnings: 0, duplicates: 0 };
  const seen = new Set();
  for (const [i, r] of rows.entries()) {
    const problems = [], warnings = [];
    const name = titleCase(r.name ?? '');
    if (name.length < 2) problems.push('missing name');
    const category_id = cats.get(r.category_slug); if (!category_id) problems.push(`unknown category "${r.category_slug}"`);
    const county_id = counties.get(r.county_slug); if (!county_id) problems.push(`unknown county "${r.county_slug}"`);
    if (!r.data_source) problems.push('missing data_source (provenance is required)');
    let website = r.website || null, website_domain = null;
    if (website) { website_domain = domainOf(website); if (!website_domain) { warnings.push('invalid website dropped'); website = null; } else if (!/^https?:/.test(website)) website = `https://${website}`; }
    let phone = r.phone || null; if (phone && !phoneOk(phone)) { warnings.push('invalid phone dropped'); phone = null; }
    let email = r.public_email?.toLowerCase() || null;
    if (email && (FREE.test(email) || !ROLE.test(email))) { warnings.push('personal-looking email not imported'); email = null; }
    let eircode = r.eircode?.toUpperCase() || null; if (eircode && !eircodeOk(eircode)) { warnings.push('invalid eircode dropped'); eircode = null; }
    let locality_id = null;
    if (r.locality && county_id) {
      const [l] = await sql`select id from localities where county_id = ${county_id} and rateme.norm(name) = rateme.norm(${r.locality})`;
      if (l) locality_id = l.id; else warnings.push(`unknown locality "${r.locality}" ignored`);
    }
    const key = `${slugify(name)}|${county_id}`;
    if (seen.has(key)) problems.push('duplicate row in file'); seen.add(key);
    if (!problems.length) {
      const [d] = await sql`select slug from businesses where county_id = ${county_id} and status <> 'removed'
        and (rateme.norm(name) = rateme.norm(${name}) or similarity(rateme.norm(name), rateme.norm(${name})) >= 0.6) limit 1`;
      if (d) { problems.push(`possible duplicate of /business/${d.slug}`); report.duplicates++; }
    }
    if (problems.length) { report.rejected++; console.log(`row ${i + 2} REJECT ${name}: ${problems.join('; ')}`); continue; }
    if (warnings.length) { report.warnings++; console.log(`row ${i + 2} WARN ${name}: ${warnings.join('; ')}`); }
    report.ok++;
    if (apply) {
      let slug = slugify(name) || 'business';
      for (let n = 2; (await sql`select 1 from businesses where slug = ${slug} union select 1 from business_slug_history where slug = ${slug}`).length; n++) slug = `${slugify(name)}-${n}`;
      await sql`insert into businesses (slug, name, category_id, county_id, locality_id, address_line1, eircode, show_address, phone, public_email, website, website_domain,
          status, source, data_source, data_source_url, last_verified_at)
        values (${slug}, ${name}, ${category_id}, ${county_id}, ${locality_id}, ${r.address_line1 || null}, ${eircode}, false, ${phone}, ${email}, ${website}, ${website_domain},
          'pending', 'admin', ${r.data_source}, ${r.data_source_url || null}, now())`;
    }
  }
  console.log(`\n${apply ? 'IMPORTED as pending' : 'DRY RUN'}: ${report.ok} ok, ${report.warnings} with warnings, ${report.rejected} rejected (${report.duplicates} possible duplicates).`);
  if (!apply) console.log('Re-run with --apply to insert. Listings stay pending until an admin publishes them; addresses are hidden by default.');
} finally { await sql.end(); }

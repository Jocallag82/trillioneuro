// Imports Find It in Ireland's OpenStreetMap listings (v-eco: src/data/fii/osm/ie.jsonl.gz) as
// unclaimed RateMe businesses. Factual fields only: no ratings, reviews or descriptions.
// Idempotent: re-running updates contact details by external_id and never touches claimed listings.
// Usage: DATABASE_URL=… node scripts/import-findit.mjs <path-to-ie.jsonl.gz> [--dry-run]
import fs from 'node:fs';
import zlib from 'node:zlib';
import postgres from 'postgres';

const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dry = process.argv.includes('--dry-run');
if (!file) { console.error('Usage: node scripts/import-findit.mjs <ie.jsonl.gz> [--dry-run]'); process.exit(1); }

// Find It (Google-style) category → RateMe subcategory slug. Unmapped categories are skipped.
const CATEGORY = {
  'Pub': 'pubs', 'Cafe': 'cafes', 'Restaurant': 'restaurants', 'Pharmacy': 'pharmacies',
  'Fitness center': 'fitness', 'Accountant': 'accountants', 'Dentist': 'dentists', 'Hair salon': 'hair-salons',
  'Optician': 'opticians', 'Photographer': 'photography', 'Real estate agency': 'estate-agents',
  'Construction company': 'builders', 'Insurance broker': 'insurance-brokers', 'Auto repair shop': 'garages-mechanics',
  'Internet marketing service': 'marketing-web', 'Physical therapy clinic': 'physiotherapy', 'Law firm': 'solicitors',
  'Electrician': 'electricians', 'Pet groomer': 'pet-care', 'Veterinarian': 'pet-care', 'Painter': 'painters-decorators',
  'Landscaper': 'landscapers', 'House cleaning service': 'cleaning', 'Plumber': 'plumbers',
  'Heating contractor': 'heating-solar', 'Roofing contractor': 'roofers',
};

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const EIRCODE = /^([A-Z][0-9][0-9W]) ?([0-9AC-FHKNPRTV-Y]{4})$/;
const eircode = (p) => { const m = p?.toUpperCase().trim().match(EIRCODE); return m ? `${m[1]} ${m[2]}` : null; };
const website = (w) => { try { const u = new URL(w); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } };

const rows = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {}, connection: { search_path: 'rateme,extensions,public' } });

try {
  const cats = new Map((await sql`select slug, id from categories`).map((r) => [r.slug, r.id]));
  const counties = new Map((await sql`select slug, id from counties`).map((r) => [r.slug, r.id]));
  const localities = new Map((await sql`select county_id, slug, id from localities`).map((r) => [`${r.county_id}:${r.slug}`, r.id]));
  const taken = new Set((await sql`select slug from businesses union select slug from business_slug_history`).map((r) => r.slug));

  const stats = { inserted: 0, updated: 0, skipped: {} };
  const skip = (why) => { stats.skipped[why] = (stats.skipped[why] ?? 0) + 1; };

  await sql.begin(async (tx) => {
    for (const r of rows) {
      const name = r.name?.trim();
      if (!name || name.length < 2 || name.length > 120) { skip('bad name'); continue; }
      const categoryId = cats.get(CATEGORY[r.googleCategory]);
      if (!categoryId) { skip(`unmapped category: ${r.googleCategory}`); continue; }
      const countyId = counties.get(r.region);
      if (!countyId) { skip('unknown county'); continue; }
      const city = r.city?.trim();
      const localityId = (city && (localities.get(`${countyId}:${slugify(city)}`) ?? localities.get(`${countyId}:${slugify(city)}-city`))) || null;
      const site = r.website ? website(r.website) : null;
      const fields = {
        address_line1: r.street?.trim() || null,
        address_line2: city || null,
        eircode: eircode(r.postcode),
        phone: r.phone?.trim() || null,
        website: site?.href ?? null,
        website_domain: site ? site.hostname.replace(/^www\./, '') : null,
      };

      const [existing] = await tx`select id, ownership_verified_at, source from businesses where external_id = ${r.id}`;
      if (existing) {
        if (existing.ownership_verified_at || existing.source !== 'import') { skip('claimed or edited'); continue; }
        await tx`update businesses set ${tx(fields)}, updated_at = now() where id = ${existing.id}`;
        stats.updated++;
        continue;
      }

      const base = slugify(`${name} ${city ?? r.region}`) || slugify(name);
      let slug = base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
      const [row] = await tx`
        insert into businesses ${tx({ ...fields, slug, name, category_id: categoryId, county_id: countyId, locality_id: localityId,
          show_address: Boolean(fields.address_line1), status: 'published', source: 'import', external_id: r.id })}
        on conflict do nothing returning id`;
      if (!row) { skip('duplicate name in area'); continue; }
      await tx`update businesses set published_at = now() where id = ${row.id}`;
      taken.add(slug);
      stats.inserted++;
    }
    if (dry) throw Object.assign(new Error('dry run'), { dry: true });
  }).catch((e) => { if (!e.dry) throw e; console.log('Dry run: rolled back.'); });

  console.log(JSON.stringify(stats, null, 2));
} finally {
  await sql.end();
}

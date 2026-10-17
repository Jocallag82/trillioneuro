// Seeds CLEARLY LABELLED test data into a LOCAL development/test database only.
// Refuses to run against anything that isn't localhost, or when APP_ENV=production.
import crypto from 'node:crypto';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL required'); process.exit(1); }
const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host) || process.env.APP_ENV === 'production') {
  console.error(`Refusing to seed test data into ${host} (APP_ENV=${process.env.APP_ENV}). Test data must never reach production.`);
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {}, connection: { search_path: 'rateme,extensions,public' } });

function scrypt(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

const admin = await sql`insert into users (email, password_hash, display_name, role, email_verified_at)
  values ('admin@test.rateme.local', ${scrypt('admin-password-123')}, 'Test Admin', 'admin', now())
  on conflict (email) do update set role = 'admin' returning id`;
await sql`insert into users (email, password_hash, display_name, role, email_verified_at)
  values ('moderator@test.rateme.local', ${scrypt('moderator-password-123')}, 'Test Moderator', 'moderator', now()) on conflict (email) do nothing`;

const samples = [
  ['Test Sample Garage', 'garages-mechanics', 'cork', 'cork-city', 'Sample listing for development. Not a real business.'],
  ['Test Sample Café', 'cafes', 'dublin', 'dublin-city', 'Sample listing for development. Not a real business.'],
  ['Test Sample Plumbing', 'plumbers', 'galway', 'galway-city', 'Sample listing for development. Not a real business.'],
  ['Test Sample Salon', 'hair-salons', 'limerick', 'limerick-city', 'Sample listing for development. Not a real business.'],
];
for (const [name, cat, county, loc, desc] of samples) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await sql`insert into businesses (slug, name, category_id, county_id, locality_id, description, status, source, is_test_data, published_at)
    select ${slug}, ${name}, c.id, co.id, l.id, ${desc}, 'published', 'admin', true, now()
    from categories c, counties co left join localities l on l.county_id = co.id and l.slug = ${loc}
    where c.slug = ${cat} and co.slug = ${county}
    on conflict do nothing`;
}
const [cafe] = await sql`select id from businesses where slug = 'test-sample-cafe'`;
if (cafe) {
  const rows = [[5, 'Lovely flat white', 'Test review — sample data.'], [4, 'Good spot', 'Test review — sample data.'], [2, 'Slow service', 'Test review — sample data.']];
  let i = 0;
  for (const [rating, title, body] of rows) {
    i++;
    await sql`insert into reviews (business_id, rating, title, body, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at, status, confirmed_at, published_at, is_test_data)
      values (${cafe.id}, ${rating}, ${title}, ${body}, date_trunc('month', now())::date, ${'Test Reviewer ' + i}, ${`reviewer${i}@test.rateme.local`},
              ${crypto.createHash('sha256').update(`reviewer:reviewer${i}@test.rateme.local`).digest('hex')}, now(), 'published', now(), now() - make_interval(days => ${i}), true)
      on conflict do nothing`;
  }
}
console.log('Seeded test data (admin@test.rateme.local / admin-password-123).', admin[0].id);
await sql.end();

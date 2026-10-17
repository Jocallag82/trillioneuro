import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Notice } from '@/components/ui';
import { saveCategory } from '../actions';

type Cat = { id: number; parent_id: number | null; slug: string; name: string; description: string | null; sort_order: number; active: boolean; n: number };

function Row({ c, tops }: { c?: Cat; tops: Cat[] }) {
  return (
    <form action={saveCategory} className={`grid items-center gap-2 border-b border-line py-2 sm:grid-cols-[1.4fr_1fr_1fr_5rem_5rem_auto] ${c?.parent_id ? 'sm:pl-6' : ''}`}>
      <input type="hidden" name="id" value={c?.id ?? ''} />
      <input name="name" defaultValue={c?.name} className="input py-1.5" placeholder="Name" aria-label="Name" required />
      <input name="slug" defaultValue={c?.slug} className="input py-1.5" placeholder="slug (auto)" aria-label="Slug" />
      <select name="parent_id" defaultValue={c?.parent_id ?? ''} className="select py-1.5" aria-label="Parent"><option value="">Top level</option>{tops.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <input name="sort_order" type="number" defaultValue={c?.sort_order ?? 100} className="input py-1.5" aria-label="Sort order" />
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> active</label>
      <button className="btn btn-ghost btn-sm">{c ? 'Save' : 'Add'}</button>
    </form>
  );
}

export default async function Categories({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff('admin');
  const { msg } = await searchParams;
  const cats = await sql<Cat[]>`
    select c.*, (select count(*)::int from businesses b where b.category_id = c.id) n from categories c order by coalesce(c.parent_id, c.id), c.parent_id nulls first, c.sort_order`;
  const tops = cats.filter((c) => !c.parent_id);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Categories</h1>
      <p className="mt-1 text-sm text-muted">Changes apply immediately — no deploy needed. Deactivate rather than delete categories that have businesses.</p>
      {msg && <div className="mt-4"><Notice kind="info">{msg}</Notice></div>}
      <div className="card mt-6 p-4"><p className="mb-2 font-semibold">Add a category</p><Row tops={tops} /></div>
      <div className="card mt-6 p-4">{cats.map((c) => <Row key={c.id} c={c} tops={tops} />)}</div>
    </div>
  );
}

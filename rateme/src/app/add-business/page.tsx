import type { Metadata } from 'next';
import Link from 'next/link';
import { getCategories, getCounties, getLocalities } from '@/lib/catalog';
import { BusinessFormFields } from '@/components/BusinessFormFields';
import { PageHeader } from '@/components/ui';
import { AddBusinessForm } from './AddBusinessForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Suggest a business', description: 'Add an Irish business to RateMe.ie so you and others can rate it.', alternates: { canonical: '/add-business' } };

export default async function AddBusiness({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  const [cats, counties, localities] = await Promise.all([getCategories(), getCounties(), getLocalities()]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHeader eyebrow="For customers" title="Suggest a business to rate">
        Can’t find a business you’ve used? Add the basics. We check every suggestion before it’s published, and the owner can claim it later.
      </PageHeader>
      <p className="mb-6 text-sm text-muted">Own the business? <Link className="text-sea underline" href="/register?intent=business">Create a business account instead</Link> so you can manage the listing.</p>
      <AddBusinessForm fields={<BusinessFormFields cats={cats} counties={counties} localities={localities} d={{ name: name?.slice(0, 120) }} mode="community" />} />
    </div>
  );
}

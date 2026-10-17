import 'server-only';
import { cache } from 'react';
import { sql } from './db';

export type Category = { id: number; parent_id: number | null; slug: string; name: string; description: string | null; sort_order: number; active: boolean };
export type County = { id: number; slug: string; name: string; province: string };
export type Locality = { id: number; county_id: number; name: string; slug: string };

export const getCategories = cache(async (): Promise<Category[]> =>
  sql<Category[]>`select id, parent_id, slug, name, description, sort_order, active from categories where active order by sort_order, name`);

export const getCounties = cache(async (): Promise<County[]> =>
  sql<County[]>`select id, slug, name, province from counties order by name`);

export const getLocalities = cache(async (): Promise<Locality[]> =>
  sql<Locality[]>`select id, county_id, name, slug from localities order by name`);

export function topLevel(cats: Category[]) {
  return cats.filter((c) => c.parent_id === null);
}

export function childrenOf(cats: Category[], parentId: number) {
  return cats.filter((c) => c.parent_id === parentId);
}

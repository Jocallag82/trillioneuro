import 'server-only';
import postgres from 'postgres';
import { env } from './env';

type Sql = postgres.Sql<Record<string, never>>;
const g = globalThis as unknown as { __ratemeSql?: Sql };

function make(): Sql {
  return postgres(env.databaseUrl, {
    max: Number(process.env.DB_POOL_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // compatible with transaction-mode poolers (Supavisor / PgBouncer)
    connection: { search_path: 'rateme,extensions,public', application_name: 'rateme' },
    onnotice: () => {},
    transform: { undefined: null },
  }) as unknown as Sql;
}

export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  get(_t, prop) {
    if (!g.__ratemeSql) g.__ratemeSql = make();
    const v = (g.__ratemeSql as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(g.__ratemeSql) : v;
  },
  apply(_t, _this, args) {
    if (!g.__ratemeSql) g.__ratemeSql = make();
    return (g.__ratemeSql as unknown as (...a: unknown[]) => unknown)(...args);
  },
}) as Sql;

export function db(): Sql {
  if (!g.__ratemeSql) g.__ratemeSql = make();
  return g.__ratemeSql;
}

export type Tx = postgres.TransactionSql<Record<string, never>>;

import 'server-only';
import { sql } from './db';
import type { Tx } from './db';

/** Record a sensitive action. Never pass passwords, tokens or card data in metadata. */
export async function audit(
  actorUserId: string | null,
  action: string,
  entityType: string | null,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  tx?: Tx,
) {
  const q = tx ?? sql;
  await q`insert into audit_events (actor_user_id, action, entity_type, entity_id, metadata)
          values (${actorUserId}, ${action}, ${entityType}, ${entityId}, ${q.json(metadata as never)})`;
}

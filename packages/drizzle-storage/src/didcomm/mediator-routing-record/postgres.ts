import type { DidCommMediatorRoutingRecordRoutingKey } from '@credo-ts/didcomm'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommMediatorRouting = pgTable(
  'DidcommMediatorRouting',
  {
    ...getPostgresBaseRecordTable(),

    routingKeys: jsonb('routing_keys').$type<Array<string | DidCommMediatorRoutingRecordRoutingKey>>().notNull(),
    routingKeyFingerprints: text('routing_key_fingerprints').array().notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'didcommMediatorRouting')
)

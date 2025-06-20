import { MediatorRoutingRecordRoutingKey } from '@credo-ts/didcomm'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommMediatorRouting = pgTable(
  'DidcommMediatorRouting',
  {
    ...postgresBaseRecordTable,

    routingKeys: jsonb('routing_keys').$type<Array<string | MediatorRoutingRecordRoutingKey>>().notNull(),
    routingKeyFingerprints: text('routing_key_fingerprints').array().notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'didcommMediatorRouting')
)

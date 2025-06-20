import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { MediatorRoutingRecordRoutingKey } from '@credo-ts/didcomm'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommMediatorRouting = sqliteTable(
  'DidcommMediatorRouting',
  {
    ...sqliteBaseRecordTable,

    routingKeys: text('routing_keys', { mode: 'json' })
      .$type<Array<string | MediatorRoutingRecordRoutingKey>>()
      .notNull(),
    routingKeyFingerprints: text('routing_key_fingerprints', { mode: 'json' }).$type<string[]>().notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'didcommMediatorRouting')
)

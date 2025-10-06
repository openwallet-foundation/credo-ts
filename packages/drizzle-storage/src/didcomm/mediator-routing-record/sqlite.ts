import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { DidCommMediatorRoutingRecordRoutingKey } from '@credo-ts/didcomm'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommMediatorRouting = sqliteTable(
  'DidcommMediatorRouting',
  {
    ...getSqliteBaseRecordTable(),

    routingKeys: text('routing_keys', { mode: 'json' })
      .$type<Array<string | DidCommMediatorRoutingRecordRoutingKey>>()
      .notNull(),
    routingKeyFingerprints: text('routing_key_fingerprints', { mode: 'json' }).$type<string[]>().notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'didcommMediatorRouting')
)

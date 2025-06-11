import { foreignKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type {
  ActionMenuOptions,
  ActionMenuRole,
  ActionMenuSelectionOptions,
  ActionMenuState,
} from '@credo-ts/action-menu'
import { didcommConnection } from '../../didcomm/connection/sqlite'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommActionMenu = sqliteTable(
  'DidcommActionMenu',
  {
    ...sqliteBaseRecordTable,

    state: text('state').$type<ActionMenuState>().notNull(),
    role: text('role').$type<ActionMenuRole>().notNull(),

    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').unique().notNull(),

    menu: text('menu', { mode: 'json' }).$type<ActionMenuOptions>(),
    performedAction: text('performed_action', { mode: 'json' }).$type<ActionMenuSelectionOptions>(),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommConnection'),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)

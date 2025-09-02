import { foreignKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

import type {
  ActionMenuOptions,
  ActionMenuRole,
  ActionMenuSelectionOptions,
  ActionMenuState,
} from '@credo-ts/action-menu'
import { didcommConnection } from '../../didcomm/connection/sqlite'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommActionMenu = sqliteTable(
  'DidcommActionMenu',
  {
    ...getSqliteBaseRecordTable(),

    state: text('state').$type<ActionMenuState>().notNull(),
    role: text('role').$type<ActionMenuRole>().notNull(),

    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').notNull(),

    menu: text('menu', { mode: 'json' }).$type<ActionMenuOptions>(),
    performedAction: text('performed_action', { mode: 'json' }).$type<ActionMenuSelectionOptions>(),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommActionMenu'),
    unique().on(table.contextCorrelationId, table.threadId),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)

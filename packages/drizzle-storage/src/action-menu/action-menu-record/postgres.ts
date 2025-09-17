import { ActionMenuOptions, ActionMenuRole, ActionMenuSelectionOptions, ActionMenuState } from '@credo-ts/action-menu'
import { foreignKey, jsonb, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { didcommConnection } from '../../didcomm/connection-record/postgres'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommActionMenuStateEnum = pgEnum('DidcommActionMenuState', ActionMenuState)
export const didcommActionMenuRoleEnum = pgEnum('DidcommActionMenuRole', ActionMenuRole)

export const didcommActionMenu = pgTable(
  'DidcommActionMenu',
  {
    ...getPostgresBaseRecordTable(),

    state: didcommActionMenuStateEnum().notNull(),
    role: didcommActionMenuRoleEnum().notNull(),

    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').notNull(),

    menu: jsonb('menu').$type<ActionMenuOptions>(),
    performedAction: jsonb('performed_action').$type<ActionMenuSelectionOptions>(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommActionMenu'),
    unique().on(table.contextCorrelationId, table.threadId),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)

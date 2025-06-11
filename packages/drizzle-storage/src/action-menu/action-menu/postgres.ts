import { ActionMenuOptions, ActionMenuRole, ActionMenuSelectionOptions, ActionMenuState } from '@credo-ts/action-menu'
import { foreignKey, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { didcommConnection } from '../../didcomm/connection/postgres'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommActionMenuStateEnum = pgEnum('DidcommActionMenuState', ActionMenuState)
export const didcommActionMenuRoleEnum = pgEnum('DidcommActionMenuRole', ActionMenuRole)

export const didcommActionMenu = pgTable(
  'DidcommActionMenu',
  {
    ...postgresBaseRecordTable,

    state: didcommActionMenuStateEnum().notNull(),
    role: didcommActionMenuRoleEnum().notNull(),

    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').unique().notNull(),

    menu: jsonb('menu').$type<ActionMenuOptions>(),
    performedAction: jsonb('performed_action').$type<ActionMenuSelectionOptions>(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommConnection'),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)

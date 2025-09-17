import type {
  ActionMenuOptions,
  ActionMenuRole,
  ActionMenuSelectionOptions,
  ActionMenuState,
} from '@credo-ts/action-menu'
import { foreignKey, jsonb, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { didcommConnection } from '../../didcomm/connection-record/postgres'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

const actionMenuStates = exhaustiveArray(
  {} as ActionMenuState,
  ['null', 'awaiting-root-menu', 'preparing-root-menu', 'preparing-selection', 'awaiting-selection', 'done'] as const
)
export const didcommActionMenuStateEnum = pgEnum('DidcommActionMenuState', actionMenuStates)

const actionMenuRoles = exhaustiveArray({} as ActionMenuRole, ['requester', 'responder'] as const)
export const didcommActionMenuRoleEnum = pgEnum('DidcommActionMenuRole', actionMenuRoles)

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

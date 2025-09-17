import { foreignKey, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

import { QuestionAnswerRole, QuestionAnswerState, ValidResponse } from '@credo-ts/question-answer'
import { didcommConnection } from '../../didcomm/connection-record/sqlite'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommQuestionAnswer = sqliteTable(
  'DidcommQuestionAnswer',
  {
    ...getSqliteBaseRecordTable(),

    state: text('state').$type<QuestionAnswerState>().notNull(),
    role: text('role').$type<QuestionAnswerRole>().notNull(),

    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').notNull(),

    questionText: text('question_text').notNull(),
    questionDetail: text('question_detail'),
    validResponses: text('valid_responses', { mode: 'json' }).notNull().$type<ValidResponse[]>(),
    signatureRequired: integer('signature_required', { mode: 'boolean' }).notNull(),
    response: text(),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommQuestionAnswer'),
    unique().on(table.contextCorrelationId, table.threadId),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)

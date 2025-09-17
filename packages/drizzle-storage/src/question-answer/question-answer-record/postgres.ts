import { QuestionAnswerRole, QuestionAnswerState, ValidResponse } from '@credo-ts/question-answer'
import { boolean, foreignKey, jsonb, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { didcommConnection } from '../../didcomm/connection-record/postgres'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommQuestionAnswerStateEnum = pgEnum('DidcommQuestionAnswerState', QuestionAnswerState)
export const didcommQuestionAnswerRoleEnum = pgEnum('DidcommQuestionAnswerRole', QuestionAnswerRole)

export const didcommQuestionAnswer = pgTable(
  'DidcommQuestionAnswer',
  {
    ...getPostgresBaseRecordTable(),

    state: didcommQuestionAnswerStateEnum().notNull(),
    role: didcommQuestionAnswerRoleEnum().notNull(),

    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').notNull(),

    questionText: text('question_text').notNull(),
    questionDetail: text('question_detail'),
    validResponses: jsonb('valid_responses').notNull().$type<ValidResponse[]>(),
    signatureRequired: boolean('signature_required').notNull(),
    response: text(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommQuestionAnswer'),
    unique().on(table.contextCorrelationId, table.threadId),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)

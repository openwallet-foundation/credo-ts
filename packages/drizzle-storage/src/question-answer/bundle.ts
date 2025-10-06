import type { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { didcommQuestionAnswerDrizzleRecord } from './question-answer-record'

export default {
  name: 'question-answer',
  records: [didcommQuestionAnswerDrizzleRecord],

  migrations: bundleMigrationDefinition('question-answer'),
} as const satisfies DrizzleRecordBundle

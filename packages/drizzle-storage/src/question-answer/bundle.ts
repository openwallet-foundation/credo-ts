import { DrizzleRecordBundle } from '../DrizzleRecord'
import { didcommQuestionAnswerDrizzleRecord } from './question-answer'

export default {
  name: 'question-answer',
  records: [didcommQuestionAnswerDrizzleRecord],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/question-answer/postgres',
      migrationsPath: '../../migrations/question-answer/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/question-answer/sqlite',
      migrationsPath: '../../migrations/question-answer/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle

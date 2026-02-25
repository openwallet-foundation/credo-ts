import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommQuestionAnswerRecordAdapter } from './DrizzleDidcommQuestionAnswerRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommQuestionAnswerDrizzleRecord = {
  adapter: DrizzleDidcommQuestionAnswerRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord

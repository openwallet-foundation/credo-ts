import { QuestionAnswerRecord } from '@credo-ts/question-answer'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleDidcommQuestionAnswerRecordAdapter extends BaseDrizzleRecordAdapter<
  QuestionAnswerRecord,
  typeof postgres.didcommQuestionAnswer,
  typeof postgres,
  typeof sqlite.didcommQuestionAnswer,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.didcommQuestionAnswer, sqlite: sqlite.didcommQuestionAnswer },
      QuestionAnswerRecord
    )
  }
}

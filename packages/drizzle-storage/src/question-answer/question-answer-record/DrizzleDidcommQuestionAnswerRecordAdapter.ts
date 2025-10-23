import { JsonTransformer, type TagsBase } from '@credo-ts/core'

import { QuestionAnswerRecord } from '@credo-ts/question-answer'
import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommQuestionAnswerAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommQuestionAnswer']>
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

  public getValues(record: QuestionAnswerRecord) {
    const { connectionId, role, state, threadId, ...customTags } = record.getTags()

    return {
      state,
      role,
      connectionId,
      threadId,

      questionText: record.questionText,
      questionDetail: record.questionDetail,
      validResponses: record.validResponses,
      signatureRequired: record.signatureRequired,
      response: record.response,

      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommQuestionAnswerAdapterValues): QuestionAnswerRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, QuestionAnswerRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}

import { JsonTransformer, MdocVerificationSessionRecord, type TagsBase } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleMdocVerificationSessionAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['mdocVerificationSession']
>
export class DrizzleMdocVerificationSessionRecordAdapter extends BaseDrizzleRecordAdapter<
  MdocVerificationSessionRecord,
  typeof postgres.mdocVerificationSession,
  typeof postgres,
  typeof sqlite.mdocVerificationSession,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.mdocVerificationSession, sqlite: sqlite.mdocVerificationSession },
      MdocVerificationSessionRecord
    )
  }

  public getValues(
    record: MdocVerificationSessionRecord
  ): DrizzleAdapterValues<(typeof sqlite)['mdocVerificationSession']> {
    const { nonce, state, sessionTranscriptType, ...customTags } = record.getTags()

    return {
      state,
      nonce,
      sessionTranscriptType,
      errorMessage: record.errorMessage,
      deviceRequestBase64Url: record.deviceRequestBase64Url,
      sessionTranscript: record.sessionTranscript,
      sessionKeyId: record.sessionKeyId,
      expiresAt: record.expiresAt,
      customTags,
    }
  }

  public toRecord(values: DrizzleMdocVerificationSessionAdapterValues): MdocVerificationSessionRecord {
    // `nonce` and `sessionTranscriptType` are indexed copies of values inside `sessionTranscript`
    const { customTags, nonce, sessionTranscriptType, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, MdocVerificationSessionRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}

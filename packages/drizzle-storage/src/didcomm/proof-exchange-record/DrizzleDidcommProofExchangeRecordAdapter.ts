import { JsonTransformer, TagsBase } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'

import { ProofExchangeRecord } from '@credo-ts/didcomm'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommProofExchangeAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommProofExchange']>
export class DrizzleDidcommProofExchangeRecordAdapter extends BaseDrizzleRecordAdapter<
  ProofExchangeRecord,
  typeof postgres.didcommProofExchange,
  typeof postgres,
  typeof sqlite.didcommProofExchange,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.didcommProofExchange, sqlite: sqlite.didcommProofExchange },
      ProofExchangeRecord
    )
  }

  public getValues(record: ProofExchangeRecord): DrizzleAdapterValues<(typeof sqlite)['didcommProofExchange']> {
    const { role, connectionId, parentThreadId, threadId, state, ...customTags } = record.getTags()

    return {
      connectionId,
      threadId,
      protocolVersion: record.protocolVersion,
      parentThreadId,
      isVerified: record.isVerified,
      state,
      role,
      autoAcceptProof: record.autoAcceptProof,
      errorMessage: record.errorMessage,
      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommProofExchangeAdapterValues): ProofExchangeRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, ProofExchangeRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}

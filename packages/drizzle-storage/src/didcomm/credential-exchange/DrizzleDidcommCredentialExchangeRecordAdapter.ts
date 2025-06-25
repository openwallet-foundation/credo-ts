import { JsonObject, JsonTransformer, TagsBase } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'

import { CredentialExchangeRecord } from '@credo-ts/didcomm'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommCredentialExchangeAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['didcommCredentialExchange']
>
export class DrizzleDidcommCredentialExchangeRecordAdapter extends BaseDrizzleRecordAdapter<
  CredentialExchangeRecord,
  typeof postgres.didcommCredentialExchange,
  typeof postgres,
  typeof sqlite.didcommCredentialExchange,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.didcommCredentialExchange, sqlite: sqlite.didcommCredentialExchange },
      'CredentialRecord'
    )
  }

  public getValues(
    record: CredentialExchangeRecord
  ): DrizzleAdapterValues<(typeof sqlite)['didcommCredentialExchange']> {
    const { connectionId, threadId, parentThreadId, state, role, credentialIds, ...customTags } = record.getTags()

    return {
      connectionId,
      threadId,
      parentThreadId,
      state,
      role,
      autoAcceptCredential: record.autoAcceptCredential,
      revocationNotification: JsonTransformer.toJSON(record.revocationNotification),
      errorMessage: record.errorMessage,
      protocolVersion: record.protocolVersion,
      credentials: record.credentials,
      credentialIds,
      credentialAttributes: JsonTransformer.toJSON(record.credentialAttributes) as JsonObject[],
      linkedAttachments: record.linkedAttachments?.map((a) => JsonTransformer.toJSON(a)),

      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommCredentialExchangeAdapterValues): CredentialExchangeRecord {
    const { customTags, credentialIds, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, CredentialExchangeRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}

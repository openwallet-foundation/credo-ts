import { JsonTransformer, TagsBase } from '@credo-ts/core'

import { OpenId4VcVerifierRecord } from '@credo-ts/openid4vc'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleOpenid4vcVerifierAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['openid4vcVerifier']>
export class DrizzleOpenid4vcVerifierRecordAdapter extends BaseDrizzleRecordAdapter<
  OpenId4VcVerifierRecord,
  typeof postgres.openid4vcVerifier,
  typeof postgres,
  typeof sqlite.openid4vcVerifier,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.openid4vcVerifier, sqlite: sqlite.openid4vcVerifier }, OpenId4VcVerifierRecord)
  }

  public getValues(record: OpenId4VcVerifierRecord) {
    const { verifierId, ...customTags } = record.getTags()

    return {
      verifierId,
      clientMetadata: record.clientMetadata,
      customTags,
    }
  }

  public toRecord(values: DrizzleOpenid4vcVerifierAdapterValues): OpenId4VcVerifierRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, OpenId4VcVerifierRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}

import { JsonTransformer, W3cV2CredentialRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleW3cV2CredentialAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['w3cV2Credential']>
export class DrizzleW3cV2CredentialRecordAdapter extends BaseDrizzleRecordAdapter<
  W3cV2CredentialRecord,
  typeof postgres.w3cV2Credential,
  typeof postgres,
  typeof sqlite.w3cV2Credential,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.w3cV2Credential, sqlite: sqlite.w3cV2Credential }, W3cV2CredentialRecord)
  }

  public getValues(record: W3cV2CredentialRecord) {
    const {
      // Default Tags
      issuerId,
      subjectIds,
      schemaIds,
      contexts,
      types,
      givenId,
      claimFormat,
      cryptosuites,
      algs,

      // Custom Tags
      expandedTypes,
      ...customTags
    } = record.getTags()

    return {
      // JWT vc is string, JSON-LD vc is object
      credential: record.credential.encoded,

      // Tags
      issuerId,
      subjectIds,
      schemaIds,
      contexts,
      types,
      givenId,
      claimFormat,
      cryptosuites,
      algs,
      customTags,
    }
  }

  public toRecord(values: DrizzleW3cV2CredentialAdapterValues): W3cV2CredentialRecord {
    const {
      // Tags
      issuerId,
      subjectIds,
      schemaIds,
      contexts,
      types,
      givenId,
      claimFormat,
      algs,
      customTags,
      ...remainingValues
    } = values

    const record = JsonTransformer.fromJSON(remainingValues, W3cV2CredentialRecord)
    record.setTags({
      issuerId,
      subjectIds,
      schemaIds,
      contexts,
      types,
      givenId: givenId ?? undefined,
      claimFormat,
      algs: algs ?? undefined,
      ...customTags,
    })

    return record
  }
}

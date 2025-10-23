import { JsonTransformer, W3cCredentialRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleW3cCredentialAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['w3cCredential']>
export class DrizzleW3cCredentialRecordAdapter extends BaseDrizzleRecordAdapter<
  W3cCredentialRecord,
  typeof postgres.w3cCredential,
  typeof postgres,
  typeof sqlite.w3cCredential,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.w3cCredential, sqlite: sqlite.w3cCredential }, W3cCredentialRecord)
  }

  public getValues(record: W3cCredentialRecord) {
    const {
      // Default Tags
      issuerId,
      subjectIds,
      schemaIds,
      contexts,
      types,
      givenId,
      claimFormat,
      proofTypes,
      cryptosuites,
      algs,

      // Custom Tags
      expandedTypes,
      ...customTags
    } = record.getTags()

    return {
      // JWT vc is string, JSON-LD vc is object
      credential: record.credential.encoded,
      expandedTypes,

      // Tags
      issuerId,
      subjectIds,
      schemaIds,
      contexts,
      types,
      givenId,
      claimFormat,
      proofTypes,
      cryptosuites,
      algs,
      customTags,
    }
  }

  public toRecord(values: DrizzleW3cCredentialAdapterValues): W3cCredentialRecord {
    const {
      // Tags
      issuerId,
      subjectIds,
      schemaIds,
      contexts,
      types,
      givenId,
      claimFormat,
      proofTypes,
      cryptosuites,
      algs,
      expandedTypes,
      customTags,
      ...remainingValues
    } = values

    const record = JsonTransformer.fromJSON(remainingValues, W3cCredentialRecord)
    record.setTags({
      issuerId,
      subjectIds,
      schemaIds,
      contexts,
      types,
      givenId: givenId ?? undefined,
      claimFormat,
      proofTypes: proofTypes ?? undefined,
      cryptosuites: cryptosuites ?? undefined,
      algs: algs ?? undefined,
      expandedTypes: expandedTypes ?? undefined,
      ...customTags,
    })

    return record
  }
}

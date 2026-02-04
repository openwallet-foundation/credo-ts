import { DidRecord, JsonTransformer } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['did']>
export class DrizzleDidRecordAdapter extends BaseDrizzleRecordAdapter<
  DidRecord,
  typeof postgres.did,
  typeof postgres,
  typeof sqlite.did,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.did, sqlite: sqlite.did }, DidRecord)
  }

  public getValues(record: DidRecord) {
    const {
      // Default Tags
      recipientKeyFingerprints,
      method,
      methodSpecificIdentifier,
      alternativeDids,
      did,
      legacyUnqualifiedDid,

      role,
      ...customTags
    } = record.getTags()

    return {
      did: record.did,
      role: role,
      didDocument: record.didDocument,
      keys: record.keys,

      // Tags
      recipientKeyFingerprints,
      method,
      methodSpecificIdentifier,
      alternativeDids,
      customTags,
    }
  }

  public toRecord(values: DrizzleDidAdapterValues): DidRecord {
    const {
      // Default Tags
      recipientKeyFingerprints,
      method,
      methodSpecificIdentifier,
      alternativeDids,
      customTags,
      ...remainingValues
    } = values

    const record = JsonTransformer.fromJSON(remainingValues, DidRecord)
    record.setTags({
      recipientKeyFingerprints: recipientKeyFingerprints ?? undefined,
      method,
      methodSpecificIdentifier,
      alternativeDids: alternativeDids ?? undefined,
      ...customTags,
    })

    return record
  }
}

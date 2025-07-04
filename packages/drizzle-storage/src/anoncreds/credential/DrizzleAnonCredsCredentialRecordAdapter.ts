import { JsonTransformer, TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { AnonCredsCredentialRecord } from '@credo-ts/anoncreds'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleAnonCredsCredentialAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['anonCredsCredential']>
export class DrizzleAnonCredsCredentialRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsCredentialRecord,
  typeof postgres.anonCredsCredential,
  typeof postgres,
  typeof sqlite.anonCredsCredential,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.anonCredsCredential, sqlite: sqlite.anonCredsCredential },
      'AnonCredsCredentialRecord'
    )
  }

  public getValues(record: AnonCredsCredentialRecord) {
    const {
      credentialId,
      linkSecretId,
      credentialDefinitionId,
      credentialRevocationId,
      revocationRegistryId,
      schemaId,
      methodName,
      schemaName,
      schemaVersion,
      schemaIssuerId,
      issuerId,
      ...customTags
    } = record.getTags()

    const { schema_id, cred_def_id, rev_reg_id, ...credentialRest } = record.credential

    return {
      credentialId,
      credentialRevocationId,
      linkSecretId,
      methodName,

      credential: credentialRest,
      credentialDefinitionId,
      revocationRegistryId,
      schemaId,

      schemaName,
      schemaVersion,
      schemaIssuerId,
      issuerId,

      customTags,
    }
  }

  public toRecord(values: DrizzleAnonCredsCredentialAdapterValues): AnonCredsCredentialRecord {
    const {
      customTags,
      schemaId,
      revocationRegistryId,
      credentialDefinitionId,
      schemaName,
      schemaVersion,
      schemaIssuerId,
      issuerId,
      ...remainingValues
    } = values

    const record = JsonTransformer.fromJSON(
      {
        ...remainingValues,
        credential: {
          ...remainingValues.credential,
          schema_id: schemaId,
          cred_def_id: credentialDefinitionId,
          rev_reg_id: revocationRegistryId,
        },
      },
      AnonCredsCredentialRecord
    )
    record.setTags({ ...customTags, schemaName, schemaVersion, schemaIssuerId, issuerId } as TagsBase)

    return record
  }
}

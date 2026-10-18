import { AnonCredsCredentialRecord } from '@credo-ts/anoncreds'
import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
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
  public customTagColumns = ['schemaName', 'schemaVersion', 'schemaIssuerId', 'issuerId']

  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.anonCredsCredential, sqlite: sqlite.anonCredsCredential },
      AnonCredsCredentialRecord
    )
  }

  // The schema id, credential definition id and revocation registry id of the credential are stored in separate columns
  public getValues(record: AnonCredsCredentialRecord) {
    const { schema_id: _, cred_def_id: __, rev_reg_id: ___, ...credential } = record.credential

    return { ...super.getValues(record), credential }
  }

  public toRecord(values: DrizzleAnonCredsCredentialAdapterValues): AnonCredsCredentialRecord {
    const { credential, schemaId, credentialDefinitionId, revocationRegistryId } = values

    return super.toRecord({
      ...values,
      credential: {
        ...credential,
        schema_id: schemaId,
        cred_def_id: credentialDefinitionId,
        rev_reg_id: revocationRegistryId,
      } as typeof credential,
    })
  }
}

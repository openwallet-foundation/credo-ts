import { AnonCredsCredentialDefinitionRecord } from '@credo-ts/anoncreds'
import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleAnonCredsCredentialDefinitionAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['anonCredsCredentialDefinition']
>
export class DrizzleAnonCredsCredentialDefinitionRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsCredentialDefinitionRecord,
  typeof postgres.anonCredsCredentialDefinition,
  typeof postgres,
  typeof sqlite.anonCredsCredentialDefinition,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.anonCredsCredentialDefinition, sqlite: sqlite.anonCredsCredentialDefinition },
      AnonCredsCredentialDefinitionRecord
    )
  }

  // The issuer id, schema id and tag of the credential definition are stored in separate columns
  public getValues(record: AnonCredsCredentialDefinitionRecord) {
    const { issuerId: _, schemaId: __, tag: ___, ...credentialDefinition } = record.credentialDefinition

    return { ...super.getValues(record), credentialDefinition }
  }

  public toRecord(values: DrizzleAnonCredsCredentialDefinitionAdapterValues): AnonCredsCredentialDefinitionRecord {
    const { credentialDefinition, issuerId, schemaId, tag } = values

    return super.toRecord({
      ...values,
      credentialDefinition: { ...credentialDefinition, issuerId, schemaId, tag } as typeof credentialDefinition,
    })
  }

  // Only some fields are stored differently, so the rest of the mapping is validated as well
  public validateRecordMapping() {
    this.validateDefaultMapping()
  }
}

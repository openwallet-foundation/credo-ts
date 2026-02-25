import { AnonCredsCredentialDefinitionRecord } from '@credo-ts/anoncreds'
import { JsonTransformer, type TagsBase } from '@credo-ts/core'
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

  public getValues(record: AnonCredsCredentialDefinitionRecord) {
    const {
      schemaId: schemaIdTag,
      credentialDefinitionId,
      issuerId: issuerIdTag,
      tag: tagTag,
      methodName,
      unqualifiedCredentialDefinitionId,
      ...customTags
    } = record.getTags()

    const { issuerId, schemaId, tag, ...credentialDefinitionRest } = record.credentialDefinition

    return {
      credentialDefinitionId,
      methodName,
      unqualifiedCredentialDefinitionId,

      schemaId,
      issuerId,
      tag,
      credentialDefinition: credentialDefinitionRest,

      customTags,
    }
  }

  public toRecord(values: DrizzleAnonCredsCredentialDefinitionAdapterValues): AnonCredsCredentialDefinitionRecord {
    const { customTags, unqualifiedCredentialDefinitionId, issuerId, schemaId, tag, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(
      {
        ...remainingValues,
        credentialDefinition: { ...remainingValues.credentialDefinition, issuerId, schemaId, tag },
      },
      AnonCredsCredentialDefinitionRecord
    )
    record.setTags({
      ...customTags,
      unqualifiedCredentialDefinitionId: unqualifiedCredentialDefinitionId ?? undefined,
    } as TagsBase)

    return record
  }
}

import { AnonCredsSchemaRecord } from '@credo-ts/anoncreds'
import { JsonTransformer, type TagsBase } from '@credo-ts/core'
import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleAnonCredsSchemaAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['anonCredsSchema']>
export class DrizzleAnonCredsSchemaRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsSchemaRecord,
  typeof postgres.anonCredsSchema,
  typeof postgres,
  typeof sqlite.anonCredsSchema,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.anonCredsSchema, sqlite: sqlite.anonCredsSchema }, AnonCredsSchemaRecord)
  }

  public getValues(record: AnonCredsSchemaRecord) {
    const { schemaId, issuerId, schemaName, schemaVersion, methodName, ...customTags } = record.getTags()

    const { issuerId: _, name: __, version: ___, ...restSchema } = record.schema
    return {
      schemaId,
      schema: restSchema,
      issuerId,
      schemaName,
      schemaVersion,
      methodName,
      customTags,
    }
  }

  public toRecord(values: DrizzleAnonCredsSchemaAdapterValues): AnonCredsSchemaRecord {
    const { customTags, issuerId, schemaName, schemaVersion, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(
      { ...remainingValues, schema: { ...remainingValues.schema, issuerId, name: schemaName, version: schemaVersion } },
      AnonCredsSchemaRecord
    )

    record.setTags({ ...customTags } as TagsBase)

    return record
  }
}

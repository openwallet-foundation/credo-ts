import { AnonCredsSchemaRecord } from '@credo-ts/anoncreds'
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

  // The issuer id, name and version of the schema are stored in separate columns
  public getValues(record: AnonCredsSchemaRecord) {
    const { issuerId: _, name: __, version: ___, ...schema } = record.schema

    return { ...super.getValues(record), schema }
  }

  public toRecord(values: DrizzleAnonCredsSchemaAdapterValues): AnonCredsSchemaRecord {
    const { schema, issuerId, schemaName, schemaVersion } = values

    return super.toRecord({
      ...values,
      schema: { ...schema, issuerId, name: schemaName, version: schemaVersion } as typeof schema,
    })
  }
}

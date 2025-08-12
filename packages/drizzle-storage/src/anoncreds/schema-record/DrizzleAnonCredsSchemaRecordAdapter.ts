import { JsonTransformer } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { AnonCredsSchemaRecord } from '@credo-ts/anoncreds'
import { DrizzleDatabase } from '../../DrizzleDatabase'
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
    super(database, { postgres: postgres.anonCredsSchema, sqlite: sqlite.anonCredsSchema }, 'AnonCredsSchemaRecord')
  }

  public getValues(record: AnonCredsSchemaRecord) {
    const { schemaId, issuerId, schemaName, schemaVersion, methodName, unqualifiedSchemaId, ...customTags } =
      record.getTags()

    const { issuerId: _, name: __, version: ___, ...restSchema } = record.schema
    return {
      schemaId,
      schema: restSchema,
      issuerId,
      schemaName,
      schemaVersion,
      methodName,
      unqualifiedSchemaId,
      customTags,
    }
  }

  public toRecord(values: DrizzleAnonCredsSchemaAdapterValues): AnonCredsSchemaRecord {
    const { customTags, unqualifiedSchemaId, issuerId, schemaName, schemaVersion, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(
      { ...remainingValues, schema: { ...remainingValues.schema, issuerId, name: schemaName, version: schemaVersion } },
      AnonCredsSchemaRecord
    )

    record.setTags({
      ...customTags,
      unqualifiedSchemaId: unqualifiedSchemaId ?? undefined,
    })

    return record
  }
}

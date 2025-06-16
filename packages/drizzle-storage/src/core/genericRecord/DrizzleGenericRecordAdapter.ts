import { GenericRecord, JsonTransformer, TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleGenericRecordAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['genericRecord']>
export class DrizzleGenericRecordAdapter extends BaseDrizzleRecordAdapter<
  GenericRecord,
  typeof postgres.genericRecord,
  typeof postgres,
  typeof sqlite.genericRecord,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.genericRecord, sqlite: sqlite.genericRecord }, 'GenericRecord')
  }

  public getValues(record: GenericRecord) {
    return {
      content: record.content,
      customTags: record.getTags() as Record<string, string>,
    }
  }

  public toRecord(values: DrizzleGenericRecordAdapterValues): GenericRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, GenericRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}

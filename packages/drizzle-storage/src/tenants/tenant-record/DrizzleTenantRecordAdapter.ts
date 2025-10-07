import { JsonTransformer, type TagsBase } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'

import { TenantRecord } from '@credo-ts/tenants'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleTenantAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['tenant']>
export class DrizzleTenantRecordAdapter extends BaseDrizzleRecordAdapter<
  TenantRecord,
  typeof postgres.tenant,
  typeof postgres,
  typeof sqlite.tenant,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.tenant, sqlite: sqlite.tenant }, TenantRecord)
  }

  public getValues(record: TenantRecord): DrizzleAdapterValues<(typeof sqlite)['tenant']> {
    const { label, storageVersion, ...customTags } = record.getTags()

    return {
      label,
      storageVersion,
      config: record.config,
      customTags,
    }
  }

  public toRecord(values: DrizzleTenantAdapterValues): TenantRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, TenantRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}

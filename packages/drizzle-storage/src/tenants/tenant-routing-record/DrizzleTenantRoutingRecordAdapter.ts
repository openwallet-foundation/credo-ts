import { JsonTransformer, type TagsBase } from '@credo-ts/core'
import { TenantRoutingRecord } from '@credo-ts/tenants'
import {
  BaseDrizzleRecordAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleTenantRoutingAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['tenantRouting']>
export class DrizzleTenantRoutingRecordAdapter extends BaseDrizzleRecordAdapter<
  TenantRoutingRecord,
  typeof postgres.tenantRouting,
  typeof postgres,
  typeof sqlite.tenantRouting,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.tenantRouting, sqlite: sqlite.tenantRouting }, TenantRoutingRecord)
  }

  public getValues(record: TenantRoutingRecord): DrizzleAdapterValues<(typeof sqlite)['tenantRouting']> {
    const { recipientKeyFingerprint, tenantId, ...customTags } = record.getTags()

    return {
      recipientKeyFingerprint,
      tenantId,
      customTags,
    }
  }

  public toRecord(values: DrizzleTenantRoutingAdapterValues): TenantRoutingRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, TenantRoutingRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}

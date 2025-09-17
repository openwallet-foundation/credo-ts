import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { tenantDrizzleRecord } from './tenant-record'
import { tenantRoutingDrizzleRecord } from './tenant-routing-record'

export default {
  name: 'tenants',
  records: [tenantDrizzleRecord, tenantRoutingDrizzleRecord],

  migrations: bundleMigrationDefinition('tenants'),
} as const satisfies DrizzleRecordBundle

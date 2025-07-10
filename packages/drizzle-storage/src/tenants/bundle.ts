import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { tenantDrizzleRecord } from './tenant'
import { tenantRoutingDrizzleRecord } from './tenant-routing'

export default {
  name: 'tenants',
  records: [tenantDrizzleRecord, tenantRoutingDrizzleRecord],

  migrations: bundleMigrationDefinition('tenants'),
} as const satisfies DrizzleRecordBundle

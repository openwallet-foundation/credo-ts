import { DrizzleRecordBundle } from '../DrizzleRecord'
import { tenantDrizzleRecord } from './tenant'
import { tenantRoutingDrizzleRecord } from './tenant-routing'

export default {
  name: 'tenants',
  records: [tenantDrizzleRecord, tenantRoutingDrizzleRecord],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/tenants/postgres',
      migrationsPath: '../../migrations/tenants/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/tenants/sqlite',
      migrationsPath: '../../migrations/tenants/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle

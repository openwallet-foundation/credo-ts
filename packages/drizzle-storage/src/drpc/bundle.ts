import { DrizzleRecordBundle } from '../DrizzleRecord'
import { didcommDrpcDrizzleRecord } from './drpc'

export default {
  name: 'drpc',
  records: [didcommDrpcDrizzleRecord],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/drpc/postgres',
      migrationsPath: '../../migrations/drpc/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/drpc/sqlite',
      migrationsPath: '../../migrations/drpc/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle

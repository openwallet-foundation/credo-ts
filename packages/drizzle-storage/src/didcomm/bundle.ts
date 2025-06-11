import { DrizzleRecordBundle } from '../DrizzleRecord'
import { didcommConnectionDrizzleRecord } from './connection'

export default {
  name: 'didcomm',
  records: [didcommConnectionDrizzleRecord],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/didcomm/postgres',
      migrationsPath: '../../migrations/didcomm/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/didcomm/sqlite',
      migrationsPath: '../../migrations/didcomm/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle

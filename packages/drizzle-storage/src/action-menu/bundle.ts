import { DrizzleRecordBundle } from '../DrizzleRecord'
import { didcommActionMenuDrizzleRecord } from './action-menu'

export default {
  name: 'action-menu',
  records: [didcommActionMenuDrizzleRecord],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/action-menu/postgres',
      migrationsPath: '../../migrations/action-menu/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/action-menu/sqlite',
      migrationsPath: '../../migrations/action-menu/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle

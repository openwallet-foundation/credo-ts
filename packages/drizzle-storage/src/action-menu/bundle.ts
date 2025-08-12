import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { didcommActionMenuDrizzleRecord } from './action-menu-record'

export default {
  name: 'action-menu',
  records: [didcommActionMenuDrizzleRecord],

  migrations: bundleMigrationDefinition('action-menu'),
} as const satisfies DrizzleRecordBundle

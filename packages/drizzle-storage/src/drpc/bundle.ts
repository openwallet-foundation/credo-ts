import type { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { didcommDrpcDrizzleRecord } from './drpc-record'

export default {
  name: 'drpc',
  records: [didcommDrpcDrizzleRecord],

  migrations: bundleMigrationDefinition('drpc'),
} as const satisfies DrizzleRecordBundle

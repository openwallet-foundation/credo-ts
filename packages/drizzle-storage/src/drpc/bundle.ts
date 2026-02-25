import type { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { didcommDrpcDrizzleRecord } from './drpc-record'

export const drpcBundle = {
  name: 'drpc',
  records: [didcommDrpcDrizzleRecord],

  migrations: bundleMigrationDefinition('drpc'),
} as const satisfies DrizzleRecordBundle

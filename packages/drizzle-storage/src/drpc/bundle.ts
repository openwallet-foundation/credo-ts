import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { didcommDrpcDrizzleRecord } from './drpc'

export default {
  name: 'drpc',
  records: [didcommDrpcDrizzleRecord],

  migrations: bundleMigrationDefinition('drpc'),
} as const satisfies DrizzleRecordBundle

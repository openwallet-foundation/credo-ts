import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleStorageVersionRecordAdapter } from './DrizzleStorageVersionRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const storageVersionDrizzleRecord = {
  adapter: DrizzleStorageVersionRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord

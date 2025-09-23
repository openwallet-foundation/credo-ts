import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleSingleContextLruCacheRecordAdapter } from './DrizzleSingleContextLruCacheRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const singleContextLruCacheDrizzleRecord = {
  adapter: DrizzleSingleContextLruCacheRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord

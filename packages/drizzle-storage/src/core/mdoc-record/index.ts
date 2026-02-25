import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleMdocRecordAdapter } from './DrizzleMdocRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const mdocDrizzleRecord = {
  adapter: DrizzleMdocRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord

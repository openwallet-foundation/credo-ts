import type { DrizzleRecord } from '../../DrizzleRecord'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const contextDrizzleRecord = {
  postgres,
  sqlite,
} satisfies DrizzleRecord

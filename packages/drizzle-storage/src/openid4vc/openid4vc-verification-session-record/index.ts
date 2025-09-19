import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleOpenId4VcVerificationSessionRecordAdapter } from './DrizzleOpenId4VcVerificationSessionRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const openId4VcVerificationSessionDrizzleRecord = {
  adapter: DrizzleOpenId4VcVerificationSessionRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord

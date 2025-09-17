import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleAnonCredsKeyCorrectnessProofRecordAdapter } from './DrizzleAnonCredsKeyCorrectnessProofRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const anonCredsKeyCorrectnessProofDrizzleRecord = {
  adapter: DrizzleAnonCredsKeyCorrectnessProofRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord

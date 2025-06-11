import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleAnonCredsSchemaRecordAdapter } from './DrizzleAnonCredsSchemaRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const anonCredsSchemaDrizzleRecord: DrizzleRecord = {
  adapter: DrizzleAnonCredsSchemaRecordAdapter,
  postgres,
  sqlite,
}

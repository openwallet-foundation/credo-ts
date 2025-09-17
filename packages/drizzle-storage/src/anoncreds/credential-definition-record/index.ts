import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleAnonCredsCredentialDefinitionRecordAdapter } from './DrizzleAnonCredsCredentialDefinitionRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const anonCredsCredentialDefinitionDrizzleRecord = {
  adapter: DrizzleAnonCredsCredentialDefinitionRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord

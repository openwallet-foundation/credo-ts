import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleAnonCredsCredentialDefinitionPrivateRecordAdapter } from './DrizzleAnonCredsCredentialDefinitionPrivateRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const anonCredsCredentialDefinitionPrivateDrizzleRecord = {
  adapter: DrizzleAnonCredsCredentialDefinitionPrivateRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord

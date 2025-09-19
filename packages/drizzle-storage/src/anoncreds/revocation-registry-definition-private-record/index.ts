import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleAnonCredsRevocationRegistryDefinitionPrivateRecordAdapter } from './DrizzleAnonCredsRevocationRegistryDefinitionPrivateRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const anonCredsRevocationRegistryDefinitionPrivateDrizzleRecord: DrizzleRecord = {
  adapter: DrizzleAnonCredsRevocationRegistryDefinitionPrivateRecordAdapter,
  postgres,
  sqlite,
}

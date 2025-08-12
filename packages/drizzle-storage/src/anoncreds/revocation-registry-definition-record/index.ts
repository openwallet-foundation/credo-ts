import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleAnonCredsRevocationRegistryDefinitionRecordAdapter } from './DrizzleAnonCredsRevocationRegistryDefinitionRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const anonCredsRevocationRegistryDefinitionDrizzleRecord: DrizzleRecord = {
  adapter: DrizzleAnonCredsRevocationRegistryDefinitionRecordAdapter,
  postgres,
  sqlite,
}

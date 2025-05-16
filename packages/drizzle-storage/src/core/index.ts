import { genericRecordDrizzleRecord } from './genericRecord'
import { mdocDrizzleRecord } from './mdoc'
import { sdJwtVcDrizzleRecord } from './sdJwtVc'
import { storageVersionDrizzleRecord } from './storageVersion'

export const coreDrizzleRecords = [
  sdJwtVcDrizzleRecord,
  mdocDrizzleRecord,
  storageVersionDrizzleRecord,
  genericRecordDrizzleRecord,
] as const

import { mdocDrizzleRecord } from './mdoc'
import { sdJwtVcDrizzleRecord } from './sdJwtVc'

export const coreDrizzleRecords = [sdJwtVcDrizzleRecord, mdocDrizzleRecord] as const

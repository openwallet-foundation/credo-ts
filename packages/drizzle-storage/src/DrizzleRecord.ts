import { AnyDrizzleAdapter } from './adapter/BaseDrizzleRecordAdapter'

export interface DrizzleRecord {
  postgres: Record<string, unknown>
  sqlite: Record<string, unknown>
  adapter: new (
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    database: any
  ) => AnyDrizzleAdapter
}

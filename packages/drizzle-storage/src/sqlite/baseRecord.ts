import { utils } from '@credo-ts/core'
import { integer, text } from 'drizzle-orm/sqlite-core'

export const baseRecordTable = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => utils.uuid()),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),

  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),

  metadata: text({ mode: 'json' }).$type<Record<string, Record<string, unknown> | undefined>>(),
  customTags: text('custom_tags', { mode: 'json' }).$type<
    Record<string, string | number | boolean | null | string[]>
  >(),
} as const

import { jsonb, timestamp, uuid } from 'drizzle-orm/pg-core'

export const baseRecordTable = {
  id: uuid().primaryKey().defaultRandom(),

  createdAt: timestamp('created_at', {
    withTimezone: true,
    precision: 3,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    precision: 3,
  })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),

  metadata: jsonb().$type<Record<string, Record<string, unknown> | undefined>>(),
  customTags: jsonb('custom_tags').$type<Record<string, string | number | boolean | null | string[]>>(),
} as const

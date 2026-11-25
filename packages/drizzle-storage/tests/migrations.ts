import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { migrate as migrateSqlite } from 'drizzle-orm/libsql/migrator'
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator'
import { isDrizzlePostgresDatabase } from '../src/DrizzleDatabase'
import type { DrizzleRecordBundle } from '../src/DrizzleRecord'
import type { AnyDrizzleDatabase } from '../src/DrizzleStorageModuleConfig'

/**
 * Copies the migrations of a bundle to a temporary folder, without the migrations after `lastTag`.
 */
function copyMigrationsUntil(migrationsFolder: string, lastTag: string) {
  const folder = mkdtempSync(path.join(tmpdir(), 'credo-drizzle-migrations-'))
  cpSync(migrationsFolder, folder, { recursive: true })

  const journalPath = path.join(folder, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as { entries: Array<{ tag: string }> }
  const lastIndex = journal.entries.findIndex((entry) => entry.tag === lastTag)
  if (lastIndex === -1) throw new Error(`Migration ${lastTag} not found`)
  journal.entries = journal.entries.slice(0, lastIndex + 1)
  writeFileSync(journalPath, JSON.stringify(journal))

  return folder
}

export async function migrate(
  database: AnyDrizzleDatabase,
  bundle: DrizzleRecordBundle,
  options: { untilTag?: string } = {}
) {
  const dialect = isDrizzlePostgresDatabase(database) ? 'postgres' : 'sqlite'
  const migrationsFolder = options.untilTag
    ? copyMigrationsUntil(bundle.migrations[dialect].migrationsPath, options.untilTag)
    : bundle.migrations[dialect].migrationsPath
  const config = { migrationsFolder, migrationsTable: `credo_migrations__${bundle.name}` }

  try {
    if (isDrizzlePostgresDatabase(database)) await migratePostgres(database, config)
    else await migrateSqlite(database as Parameters<typeof migrateSqlite>[0], config)
  } finally {
    if (options.untilTag) rmSync(migrationsFolder, { recursive: true })
  }
}

export async function insertRow(database: AnyDrizzleDatabase, table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row)
  const query = sql`INSERT INTO ${sql.identifier(table)} (${sql.join(
    columns.map((column) => sql.identifier(column)),
    sql`, `
  )}) VALUES (${sql.join(
    columns.map((column) => sql`${row[column]}`),
    sql`, `
  )})`

  if (isDrizzlePostgresDatabase(database)) await database.execute(query)
  // biome-ignore lint/suspicious/noExplicitAny: the sqlite database type depends on the driver
  else await (database as any).run(query)
}

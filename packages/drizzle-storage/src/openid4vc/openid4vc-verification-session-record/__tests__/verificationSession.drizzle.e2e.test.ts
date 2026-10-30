import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AgentContext } from '@credo-ts/core'
import { sql } from 'drizzle-orm'
import { migrate as migrateSqlite } from 'drizzle-orm/libsql/migrator'
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
} from '../../../../tests/testDatabase'
import { coreBundle } from '../../../core/bundle'
import { isDrizzlePostgresDatabase } from '../../../DrizzleDatabase'
import type { DrizzleRecordBundle } from '../../../DrizzleRecord'
import type { AnyDrizzleDatabase } from '../../../DrizzleStorageModuleConfig'
import { openid4vcBundle } from '../../bundle'
import { openId4VcVerificationSessionDrizzleRecord } from '../index'

const agentContext = { contextCorrelationId: 'default' } as AgentContext

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

async function migrate(database: AnyDrizzleDatabase, bundle: DrizzleRecordBundle, options: { untilTag?: string } = {}) {
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

async function insertRow(database: AnyDrizzleDatabase, table: string, row: Record<string, unknown>) {
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

describe.each(['postgres', 'sqlite'] as const)('OpenId4VcVerificationSessionRecord with %s', (type) => {
  let database: AnyDrizzleDatabase
  let postgresDatabase: DrizzlePostgresTestDatabase | undefined

  beforeAll(async () => {
    postgresDatabase = type === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined
    database = postgresDatabase?.drizzle ?? (await inMemoryDrizzleSqliteDatabase())
  })

  afterAll(async () => {
    await postgresDatabase?.teardown()
  })

  test('restores the openId4VpVersion of sessions stored before the 0008 migration', async () => {
    await migrate(database, coreBundle)
    await migrate(database, openid4vcBundle, { untilTag: '0007_add_credential_request_encryption' })

    // Before 0008 the version had no column, so it was stored in the custom tags
    const date = type === 'postgres' ? new Date('2026-01-01T00:00:00.000Z') : Date.parse('2026-01-01T00:00:00.000Z')
    const json = (value: unknown) => JSON.stringify(value)
    await insertRow(database, 'Context', { context_correlation_id: 'default' })
    await insertRow(database, 'Openid4vcVerifier', {
      context_correlation_id: 'default',
      id: 'verifier-record-id',
      created_at: date,
      updated_at: date,
      verifier_id: 'verifier-id',
    })
    await insertRow(database, 'OpenId4VcVerificationSession', {
      context_correlation_id: 'default',
      id: 'session-id',
      created_at: date,
      updated_at: date,
      custom_tags: json({ openId4VpVersion: 'v1.draft24' }),
      verifier_id: 'verifier-id',
      state: 'RequestCreated',
      authorization_request_id: 'request-id',
      authorization_request_uri: 'openid4vp://?request_uri=https://example.com',
      authorization_request_payload: json({
        response_type: 'vp_token',
        client_id: 'client-id',
        nonce: 'nonce',
        state: 'state',
      }),
      nonce: 'nonce',
      payload_state: 'state',
    })

    await migrate(database, openid4vcBundle)

    if (!openId4VcVerificationSessionDrizzleRecord.adapter) throw new Error('Drizzle record has no adapter')
    const adapter = new openId4VcVerificationSessionDrizzleRecord.adapter(database as never)
    const record = await adapter.getById(agentContext, 'session-id')

    expect(record.openId4VpVersion).toEqual('v1.draft24')
    expect(record.getTags().openId4VpVersion).toEqual('v1.draft24')
  })
})

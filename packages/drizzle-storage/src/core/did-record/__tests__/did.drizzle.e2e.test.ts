import { type AgentContext, DidDocumentRole, DidRecordStatus } from '@credo-ts/core'
import { insertRow, migrate } from '../../../../tests/migrations'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
} from '../../../../tests/testDatabase'
import type { AnyDrizzleDatabase } from '../../../DrizzleStorageModuleConfig'
import { coreBundle } from '../../bundle'
import { didDrizzleRecord } from '../index'

const agentContext = { contextCorrelationId: 'default' } as AgentContext

describe.each(['postgres', 'sqlite'] as const)('DidRecord with %s', (type) => {
  let database: AnyDrizzleDatabase
  let postgresDatabase: DrizzlePostgresTestDatabase | undefined

  beforeAll(async () => {
    postgresDatabase = type === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined
    database = postgresDatabase?.drizzle ?? (await inMemoryDrizzleSqliteDatabase())
  })

  afterAll(async () => {
    await postgresDatabase?.teardown()
  })

  test('sets the status of dids stored before the 0007 migration to active', async () => {
    await migrate(database, coreBundle, { untilTag: '0006_kms_key_references' })

    const date = type === 'postgres' ? new Date('2026-01-01T00:00:00.000Z') : Date.parse('2026-01-01T00:00:00.000Z')
    await insertRow(database, 'Context', { context_correlation_id: 'default' })
    await insertRow(database, 'Did', {
      id: 'old-did',
      context_correlation_id: 'default',
      created_at: date,
      updated_at: date,
      did: 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
      role: DidDocumentRole.Created,
      method: 'key',
      method_specific_identifier: 'z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
    })

    await migrate(database, coreBundle)

    if (!didDrizzleRecord.adapter) throw new Error('Drizzle record has no adapter')
    const adapter = new didDrizzleRecord.adapter(database as never)

    expect((await adapter.getById(agentContext, 'old-did')).status).toEqual(DidRecordStatus.Active)
    expect(await adapter.query(agentContext, { $not: { status: DidRecordStatus.Deactivated } })).toHaveLength(1)
  })
})

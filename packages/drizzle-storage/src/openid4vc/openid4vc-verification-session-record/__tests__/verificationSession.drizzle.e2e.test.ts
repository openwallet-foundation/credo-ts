import type { AgentContext } from '@credo-ts/core'
import { insertRow, migrate } from '../../../../tests/migrations'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
} from '../../../../tests/testDatabase'
import { coreBundle } from '../../../core/bundle'
import type { AnyDrizzleDatabase } from '../../../DrizzleStorageModuleConfig'
import { openid4vcBundle } from '../../bundle'
import { openId4VcVerificationSessionDrizzleRecord } from '../index'

const agentContext = { contextCorrelationId: 'default' } as AgentContext

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

  test('restores the openId4VpVersion of sessions stored before the 0009 migration', async () => {
    await migrate(database, coreBundle)
    await migrate(database, openid4vcBundle, { untilTag: '0008_add_failed_tx_code_attempts' })

    // Before 0009 the version had no column, so it was stored in the custom tags
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

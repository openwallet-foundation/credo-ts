import { type AgentContext, MdocVerificationSessionRecord, MdocVerificationSessionState } from '@credo-ts/core'
import { insertRow, migrate } from '../../../../tests/migrations'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
} from '../../../../tests/testDatabase'
import type { AnyDrizzleDatabase } from '../../../DrizzleStorageModuleConfig'
import { coreBundle } from '../../bundle'
import { mdocVerificationSessionDrizzleRecord } from '../index'

const agentContext = { contextCorrelationId: 'default' } as AgentContext

describe.each(['postgres', 'sqlite'] as const)('MdocVerificationSessionRecord with %s', (type) => {
  let database: AnyDrizzleDatabase
  let postgresDatabase: DrizzlePostgresTestDatabase | undefined

  beforeAll(async () => {
    postgresDatabase = type === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined
    database = postgresDatabase?.drizzle ?? (await inMemoryDrizzleSqliteDatabase())
  })

  afterAll(async () => {
    await postgresDatabase?.teardown()
  })

  test('loads sessions stored before the 0006 migration, and stores new sessions without session_key_id', async () => {
    await migrate(database, coreBundle, { untilTag: '0005_add_mdoc_verification_session' })

    const date = type === 'postgres' ? new Date('2026-01-01T00:00:00.000Z') : Date.parse('2026-01-01T00:00:00.000Z')
    const json = (value: unknown) => JSON.stringify(value)
    const row = {
      context_correlation_id: 'default',
      created_at: date,
      updated_at: date,
      state: MdocVerificationSessionState.RequestCreated,
      device_request_base64_url: 'ZGV2aWNlLXJlcXVlc3Q',
      device_request_definition: json({ docRequests: [] }),
      session_transcript: json({ type: 'isoMdocDcApi', encryptionInfoBase64Url: 'ZW5jcnlwdGlvbi1pbmZv', nonce: 'n' }),
      session_transcript_type: 'isoMdocDcApi',
      expires_at: date,
    }
    await insertRow(database, 'Context', { context_correlation_id: 'default' })
    await insertRow(database, 'MdocVerificationSession', { ...row, id: 'old-session', session_key_id: 'old-key-id' })

    await migrate(database, coreBundle)

    // A server that is not upgraded yet still writes only session_key_id
    await insertRow(database, 'MdocVerificationSession', { ...row, id: 'not-upgraded', session_key_id: 'other-key-id' })

    if (!mdocVerificationSessionDrizzleRecord.adapter) throw new Error('Drizzle record has no adapter')
    const adapter = new mdocVerificationSessionDrizzleRecord.adapter(database as never)

    expect((await adapter.getById(agentContext, 'old-session')).sessionKey).toEqual({ keyId: 'old-key-id' })
    expect((await adapter.getById(agentContext, 'not-upgraded')).sessionKey).toEqual({ keyId: 'other-key-id' })

    const record = new MdocVerificationSessionRecord({
      state: MdocVerificationSessionState.RequestCreated,
      deviceRequestBase64Url: 'ZGV2aWNlLXJlcXVlc3Q',
      deviceRequestDefinition: {
        docRequests: [],
      } as unknown as MdocVerificationSessionRecord['deviceRequestDefinition'],
      sessionTranscript: { type: 'isoMdocDcApi', encryptionInfoBase64Url: 'ZW5jcnlwdGlvbi1pbmZv', nonce: 'n' },
      sessionKey: { keyId: 'new-key-id', kmsBackend: 'node' },
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    record.updatedAt = new Date()
    await adapter.insert(agentContext, record)

    expect((await adapter.getById(agentContext, record.id)).sessionKey).toEqual({
      keyId: 'new-key-id',
      kmsBackend: 'node',
    })
  })
})

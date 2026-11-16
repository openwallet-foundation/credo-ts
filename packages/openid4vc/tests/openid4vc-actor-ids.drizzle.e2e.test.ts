import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { DrizzleStorageModule } from '../../drizzle-storage/src'
import { openid4vcBundle } from '../../drizzle-storage/src/openid4vc/bundle'
import { tenantsBundle } from '../../drizzle-storage/src/tenants/bundle'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  pushDrizzleSchema,
} from '../../drizzle-storage/tests/testDatabase'
import { TenantsModule } from '../../tenants/src'
import { OpenId4VcModule } from '../src'
import { createAgentFromModules, createTenantForAgent } from './utils'

describe('OpenID4VC issuer and verifier ids with tenants on Postgres', () => {
  let postgresDatabase: DrizzlePostgresTestDatabase

  beforeAll(async () => {
    postgresDatabase = await createDrizzlePostgresTestDatabase()
  })

  afterAll(async () => {
    await postgresDatabase.teardown()
  })

  it('keeps every id when a tenant creates verifiers concurrently', async () => {
    const drizzleModule = new DrizzleStorageModule({
      database: postgresDatabase.drizzle,
      bundles: [openid4vcBundle, tenantsBundle],
    })
    await pushDrizzleSchema(drizzleModule)

    const openid4vc = new OpenId4VcModule({ verifier: { baseUrl: 'http://localhost:1234/oid4vp' } })
    const { agent } = await createAgentFromModules({
      inMemory: new InMemoryWalletModule({ enableStorage: false }),
      drizzle: drizzleModule,
      openid4vc,
      tenants: new TenantsModule<{ openid4vc: typeof openid4vc }>(),
    })
    const { tenantId } = await createTenantForAgent(agent, 'tenant')

    const tenantAgent = await agent.modules.tenants.getTenantAgent({ tenantId })
    const verifiers = await Promise.all(
      Array.from({ length: 10 }, () => tenantAgent.openid4vc.verifier.createVerifier())
    )
    await tenantAgent.endSession()

    const tenantRecord = await agent.modules.tenants.getTenantById(tenantId)
    expect(tenantRecord.metadata.get<string[]>('_openid4vc/openId4VcActorIds')?.sort()).toEqual(
      verifiers.map(({ verifierId }) => verifierId).sort()
    )

    await agent.shutdown()
    await agent.dependencyManager.deleteAgentContext(agent.context)
  })
})

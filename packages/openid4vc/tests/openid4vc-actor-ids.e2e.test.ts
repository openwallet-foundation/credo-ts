import { type AgentContextProvider, InjectionSymbols } from '@credo-ts/core'
import express from 'express'
import type { MockInstance } from 'vitest'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { TenantsModule } from '../../tenants/src'
import { OpenId4VcModule } from '../src'
import { createAgentFromModules, createTenantForAgent, type TenantType } from './utils'
import { universityDegreeCredentialConfigurationSupported } from './utilsVci'

const baseUrl = 'http://localhost:1234'
const issuanceBaseUrl = `${baseUrl}/oid4vci`
const verificationBaseUrl = `${baseUrl}/oid4vp`
const credentialConfigurationsSupported = { universityDegree: universityDegreeCredentialConfigurationSupported }

const createAgent = (app: express.Express) => {
  const openid4vc = new OpenId4VcModule({
    app,
    issuer: {
      baseUrl: issuanceBaseUrl,
      credentialRequestToCredentialMapper: () => {
        throw new Error('Not implemented')
      },
    },
    verifier: { baseUrl: verificationBaseUrl },
  })

  return createAgentFromModules(
    { inMemory: new InMemoryWalletModule(), openid4vc, tenants: new TenantsModule<{ openid4vc: typeof openid4vc }>() },
    '96213c3d7fc8d4d6754c7a0fd969598g',
    global.fetch
  )
}

describe('OpenID4VC issuer and verifier ids with tenants', () => {
  let agent: Awaited<ReturnType<typeof createAgent>>
  let tenant1: TenantType
  let tenant2: TenantType
  let clearNock: () => void
  let getAgentContextSpy: MockInstance<AgentContextProvider['getAgentContextForContextCorrelationId']>
  const openedContextCorrelationIds = () =>
    getAgentContextSpy.mock.calls.map(([contextCorrelationId]) => contextCorrelationId)

  const getTenantAgent = (tenant: TenantType) =>
    agent.agent.modules.tenants.getTenantAgent({ tenantId: tenant.tenantId })
  const getActorIds = async (tenant: TenantType) =>
    (await agent.agent.modules.tenants.getTenantById(tenant.tenantId)).metadata.get('_openid4vc/openId4VcActorIds') ??
    []

  // Requests for an id that is not mapped to a tenant are handled in the root context
  const fetchIssuerMetadata = async (issuerId: string) => {
    getAgentContextSpy.mockClear()
    return (await fetch(`${issuanceBaseUrl}/${issuerId}/.well-known/openid-credential-issuer`)).status
  }
  const fetchAuthorizationRequest = async (verifierId: string) => {
    getAgentContextSpy.mockClear()
    return (await fetch(`${verificationBaseUrl}/${verifierId}/authorization-requests/unknown`)).status
  }

  beforeEach(async () => {
    const app = express()
    agent = await createAgent(app)
    tenant1 = await createTenantForAgent(agent.agent, 'tenant1')
    tenant2 = await createTenantForAgent(agent.agent, 'tenant2')
    clearNock = setupNockToExpress(baseUrl, app)

    const agentContextProvider = agent.agent.dependencyManager.resolve<AgentContextProvider>(
      InjectionSymbols.AgentContextProvider
    )
    getAgentContextSpy = vi.spyOn(agentContextProvider, 'getAgentContextForContextCorrelationId')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    clearNock()
    await agent.agent.shutdown()
  })

  it('no longer routes requests for a deleted issuer to the tenant, and allows reusing its id in another tenant', async () => {
    const tenant1Agent = await getTenantAgent(tenant1)
    const { issuerId } = await tenant1Agent.openid4vc.issuer.createIssuer({ credentialConfigurationsSupported })

    expect(await fetchIssuerMetadata(issuerId)).toBe(200)
    expect(openedContextCorrelationIds()).toEqual([`tenant-${tenant1.tenantId}`])

    await tenant1Agent.openid4vc.issuer.deleteIssuer(issuerId)
    await tenant1Agent.endSession()

    expect(await getActorIds(tenant1)).toEqual([])
    expect(await fetchIssuerMetadata(issuerId)).toBe(404)
    expect(openedContextCorrelationIds()).toEqual([])

    const tenant2Agent = await getTenantAgent(tenant2)
    await tenant2Agent.openid4vc.issuer.createIssuer({ issuerId, credentialConfigurationsSupported })
    await tenant2Agent.endSession()

    expect(await fetchIssuerMetadata(issuerId)).toBe(200)
    expect(openedContextCorrelationIds()).toEqual([`tenant-${tenant2.tenantId}`])
  })

  it('rejects an issuer or verifier id that is already in use', async () => {
    const tenant1Agent = await getTenantAgent(tenant1)
    const { issuerId } = await tenant1Agent.openid4vc.issuer.createIssuer({ credentialConfigurationsSupported })
    const { verifierId } = await tenant1Agent.openid4vc.verifier.createVerifier()

    await expect(
      tenant1Agent.openid4vc.issuer.createIssuer({ issuerId, credentialConfigurationsSupported })
    ).rejects.toThrow(`An issuer with issuer id '${issuerId}' already exists`)
    await expect(tenant1Agent.openid4vc.verifier.createVerifier({ verifierId })).rejects.toThrow(
      `A verifier with verifier id '${verifierId}' already exists`
    )
    await tenant1Agent.endSession()

    const tenant2Agent = await getTenantAgent(tenant2)
    for (const id of [issuerId, verifierId]) {
      const alreadyExists = `An issuer or verifier with id '${id}' already exists`
      await expect(
        tenant2Agent.openid4vc.issuer.createIssuer({ issuerId: id, credentialConfigurationsSupported })
      ).rejects.toThrow(alreadyExists)
      await expect(tenant2Agent.openid4vc.verifier.createVerifier({ verifierId: id })).rejects.toThrow(alreadyExists)
      await expect(
        agent.agent.openid4vc.issuer.createIssuer({ issuerId: id, credentialConfigurationsSupported })
      ).rejects.toThrow(alreadyExists)
    }
    await tenant2Agent.endSession()

    expect(await getActorIds(tenant1)).toEqual([issuerId, verifierId])
    expect(await getActorIds(tenant2)).toEqual([])
  })

  it('keeps routing an id to the tenant while an issuer or verifier in the tenant still uses it', async () => {
    const tenant1Agent = await getTenantAgent(tenant1)
    const { issuerId } = await tenant1Agent.openid4vc.issuer.createIssuer({ credentialConfigurationsSupported })
    await tenant1Agent.openid4vc.verifier.createVerifier({ verifierId: issuerId })
    expect(await getActorIds(tenant1)).toEqual([issuerId])

    await tenant1Agent.openid4vc.issuer.deleteIssuer(issuerId)
    expect(await getActorIds(tenant1)).toEqual([issuerId])
    expect(await fetchAuthorizationRequest(issuerId)).toBe(404)
    expect(openedContextCorrelationIds()).toEqual([`tenant-${tenant1.tenantId}`])

    await tenant1Agent.openid4vc.verifier.deleteVerifier(issuerId)
    await tenant1Agent.endSession()
    expect(await getActorIds(tenant1)).toEqual([])
    expect(await fetchAuthorizationRequest(issuerId)).toBe(404)
    expect(openedContextCorrelationIds()).toEqual([])
  })
})

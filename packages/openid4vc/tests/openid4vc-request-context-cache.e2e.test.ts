import { CacheModule, InjectionSymbols, InMemoryLruCache, type StorageService, X509Module } from '@credo-ts/core'
import express from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { TenantStatus, TenantsModule } from '../../tenants/src'
import {
  type OpenId4VcIssuerModuleConfigOptions,
  OpenId4VcModule,
  type OpenId4VcVerifierModuleConfigOptions,
} from '../src'
import { OpenId4VcIssuerRepository } from '../src/openid4vc-issuer/repository'
import { type AgentType, createAgentFromModules, createTenantForAgent } from './utils'
import { universityDegreeCredentialConfigurationSupported } from './utilsVci'

const baseUrl = 'http://localhost:1234'

type OpenId4Vc = OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, OpenId4VcVerifierModuleConfigOptions>

describe('OpenId4Vc request context cache', () => {
  test('serves the tenant and issuer or verifier record from the cache until they change', async () => {
    const expressApp = express()

    const { agent } = (await createAgentFromModules({
      x509: new X509Module(),
      inMemory: new InMemoryWalletModule(),
      cache: new CacheModule({ cache: new InMemoryLruCache({ limit: 100 }) }),
      openid4vc: new OpenId4VcModule({
        app: expressApp,
        requestContextCache: { expiryInSeconds: 60 },
        issuer: {
          baseUrl: `${baseUrl}/oid4vci`,
          credentialRequestToCredentialMapper: () => {
            throw new Error('Not used')
          },
        },
        verifier: { baseUrl: `${baseUrl}/oid4vp` },
      }),
      tenants: new TenantsModule(),
    })) as unknown as AgentType<{ openid4vc: OpenId4Vc; tenants: TenantsModule<{ openid4vc: OpenId4Vc }> }>
    const { tenantId } = await createTenantForAgent(agent, 'tenant')
    const clearNock = setupNockToExpress(baseUrl, expressApp)

    const tenant = await agent.modules.tenants.getTenantAgent({ tenantId })
    const issuer = await tenant.modules.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { universityDegree: universityDegreeCredentialConfigurationSupported },
      display: [{ name: 'Before' }],
    })
    const issuerToDelete = await tenant.modules.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { universityDegree: universityDegreeCredentialConfigurationSupported },
    })
    const verifier = await tenant.modules.openid4vc.verifier.createVerifier()
    await tenant.endSession()

    const storageService = agent.dependencyManager.resolve<StorageService<never>>(InjectionSymbols.StorageService)
    const findByQuery = vi.spyOn(storageService, 'findByQuery')
    const getById = vi.spyOn(storageService, 'getById')
    const fetchIssuerDisplay = async (issuerId = issuer.issuerId) => {
      const response = await fetch(`${baseUrl}/.well-known/openid-credential-issuer/oid4vci/${issuerId}`)
      return response.status === 200 ? ((await response.json()) as { display: unknown }).display : response.status
    }

    // The first request fills the cache: tenant by issuer id and issuer record
    expect(await fetchIssuerDisplay()).toEqual([{ name: 'Before' }])
    expect(findByQuery).toHaveBeenCalledTimes(2)
    expect(getById).toHaveBeenCalledTimes(1)

    findByQuery.mockClear()
    getById.mockClear()
    expect(await fetchIssuerDisplay()).toEqual([{ name: 'Before' }])
    expect(findByQuery).not.toHaveBeenCalled()
    expect(getById).not.toHaveBeenCalled()

    // An unknown request id still needs the verifier, which is the only read left after the first request
    const requestVerifier = () => fetch(`${baseUrl}/oid4vp/${verifier.verifierId}/authorization-requests/unknown`)
    await requestVerifier()
    findByQuery.mockClear()
    await requestVerifier()
    expect(findByQuery.mock.calls.map(([, recordClass]) => (recordClass as { type: string }).type)).toEqual([
      'OpenId4VcVerificationSessionRecord',
    ])

    // A verifier updated through the api is read from storage again
    const tenantForVerifierUpdate = await agent.modules.tenants.getTenantAgent({ tenantId })
    await tenantForVerifierUpdate.modules.openid4vc.verifier.updateVerifierMetadata({
      verifierId: verifier.verifierId,
      clientMetadata: { client_name: 'After' },
    })
    await tenantForVerifierUpdate.endSession()
    findByQuery.mockClear()
    await requestVerifier()
    expect(findByQuery.mock.calls.map(([, recordClass]) => (recordClass as { type: string }).type)).toEqual([
      'OpenId4VcVerifierRecord',
      'OpenId4VcVerificationSessionRecord',
    ])

    // An issuer updated through the api is served updated at once
    const tenantForUpdate = await agent.modules.tenants.getTenantAgent({ tenantId })
    await tenantForUpdate.modules.openid4vc.issuer.updateIssuerMetadata({
      issuerId: issuer.issuerId,
      credentialConfigurationsSupported: { universityDegree: universityDegreeCredentialConfigurationSupported },
      display: [{ name: 'After' }],
    })
    await tenantForUpdate.endSession()
    expect(await fetchIssuerDisplay()).toEqual([{ name: 'After' }])

    // A deleted issuer is not found at once
    expect(await fetchIssuerDisplay(issuerToDelete.issuerId)).toBeUndefined()
    const tenantForDelete = await agent.modules.tenants.getTenantAgent({ tenantId })
    await tenantForDelete.dependencyManager
      .resolve(OpenId4VcIssuerRepository)
      .delete(tenantForDelete.context, issuerToDelete)
    await tenantForDelete.endSession()
    expect(await fetchIssuerDisplay(issuerToDelete.issuerId)).toEqual(404)

    // A tenant deactivated through the api is rejected at once
    await agent.modules.tenants.updateTenantStatus(tenantId, TenantStatus.Inactive)
    expect(await fetchIssuerDisplay()).toEqual(404)

    clearNock()
    await agent.shutdown()
  })
})

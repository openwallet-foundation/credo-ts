import type { AgentContext } from '@credo-ts/core'
import { Agent, CacheModule, InMemoryLruCache, JsonEncoder } from '@credo-ts/core'
import type { ClientAuthenticationCallbackOptions } from '@openid4vc/oauth2'
import nock from 'nock'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { agentDependencies } from '../../../../node/src'
import { OpenId4VcModule } from '../../OpenId4VcModule'
import { dynamicOid4vciClientAuthentication } from '../../shared/callbacks'
import {
  decodeUnverifiedAccessToken,
  getExternalAuthorizationServerCacheCallbacks,
} from '../externalAuthorizationServerCache'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuerRepository } from '../repository'

const authorizationServer = 'https://authorization-server.example'
const authorizationServerMetadata = {
  issuer: authorizationServer,
  token_endpoint: `${authorizationServer}/token`,
  jwks_uri: `${authorizationServer}/jwks`,
  token_endpoint_auth_methods_supported: ['client_secret_post'],
}

const jwk = (kid: string) => ({ kty: 'OKP', crv: 'Ed25519', x: '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo', kid })

const agent = new Agent({
  config: {},
  dependencies: agentDependencies,
  modules: {
    openid4vc: new OpenId4VcModule({
      issuer: {
        baseUrl: 'https://issuer.example',
        credentialRequestToCredentialMapper: () => {
          throw new Error('Not used')
        },
      },
    }),
    inMemory: new InMemoryWalletModule(),
    cache: new CacheModule({ cache: new InMemoryLruCache({ limit: 100 }) }),
  },
})

describe('external authorization server cache', () => {
  let agentContext: AgentContext

  beforeAll(async () => {
    await agent.initialize()
    agentContext = agent.context
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  test('reads the issuer and kid of a jwt access token, and nothing from an opaque one', () => {
    const jwt = `${JsonEncoder.toBase64Url({ alg: 'EdDSA', kid: 'key-1' })}.${JsonEncoder.toBase64Url({ iss: authorizationServer })}.signature`

    expect(decodeUnverifiedAccessToken(`Bearer ${jwt}`)).toEqual({ issuer: authorizationServer, kid: 'key-1' })
    expect(decodeUnverifiedAccessToken('DPoP opaque-token')).toEqual({})
    expect(decodeUnverifiedAccessToken(undefined)).toEqual({})
  })

  test('returns no callbacks when the cache is disabled', () => {
    expect(getExternalAuthorizationServerCacheCallbacks(agentContext, 0)).toEqual({})
  })

  test('fetches the authorization server metadata once', async () => {
    // Only one response is mocked, so a second fetch would throw
    const scope = nock(authorizationServer)
      .get('/.well-known/oauth-authorization-server')
      .reply(200, authorizationServerMetadata)

    const { getAuthorizationServerMetadata } = getExternalAuthorizationServerCacheCallbacks(agentContext, 60)
    for (let i = 0; i < 2; i++) {
      expect(await getAuthorizationServerMetadata?.(authorizationServer)).toEqual(authorizationServerMetadata)
    }
    expect(scope.isDone()).toBe(true)
  })

  test('fetches the jwks again for an access token with an unknown kid, a few times per cooldown', async () => {
    let fetches = 0
    const scope = nock(authorizationServer)
      .get('/jwks')
      .times(4)
      .reply(() => {
        fetches++
        return [200, { keys: [jwk('key-1')] }]
      })
      .get('/jwks')
      .reply(200, { keys: [jwk('key-1'), jwk('key-2')] })

    const getJwks = (kid?: string) =>
      getExternalAuthorizationServerCacheCallbacks(agentContext, 60, kid).getJwks?.(`${authorizationServer}/jwks`)

    // One fetch, then served from the cache
    expect((await getJwks('key-1'))?.keys).toHaveLength(1)
    expect((await getJwks('key-1'))?.keys).toHaveLength(1)
    expect((await getJwks())?.keys).toHaveLength(1)
    expect(fetches).toBe(1)

    // Three fetches for the unknown kid, then the cached JWK Set until the cooldown has passed
    for (let i = 0; i < 5; i++) expect((await getJwks('key-2'))?.keys).toHaveLength(1)
    expect(fetches).toBe(4)

    const now = Date.now()
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 31_000)
    expect((await getJwks('key-2'))?.keys).toHaveLength(2)
    expect(scope.isDone()).toBe(true)
    dateNow.mockRestore()
  })

  test('fetches the metadata of the listed authorization servers only, and of all of them when not listed', async () => {
    const metadataFor = (issuer: string) => ({
      ...authorizationServerMetadata,
      issuer,
      token_endpoint: `${issuer}/token`,
    })
    const first = 'https://first-authorization-server.example'
    const second = 'https://second-authorization-server.example'
    const firstScope = nock(first).get('/.well-known/oauth-authorization-server').reply(200, metadataFor(first))
    const secondScope = nock(second).get('/.well-known/oauth-authorization-server').reply(200, metadataFor(second))

    const issuerRecord = await agent.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: {},
      authorizationServerConfigs: [
        { type: 'direct', issuer: first },
        { type: 'direct', issuer: second },
      ],
    })
    const issuerService = agentContext.resolve(OpenId4VcIssuerService)
    const getAuthorizationServerIssuers = async (fetchExternalAuthorizationServerMetadata: boolean | string[]) =>
      (
        await issuerService.getIssuerMetadata(agentContext, issuerRecord, fetchExternalAuthorizationServerMetadata)
      ).authorizationServers.map(({ issuer }) => issuer)

    // A jwt access token names its authorization server
    expect(await getAuthorizationServerIssuers([first])).toEqual([expect.any(String), first])
    expect(firstScope.isDone()).toBe(true)
    expect(secondScope.isDone()).toBe(false)

    // An opaque access token can come from any of them
    expect(await getAuthorizationServerIssuers(true)).toEqual([expect.any(String), first, second])
    expect(secondScope.isDone()).toBe(true)
  })

  test('throws when neither the cached nor the stored issuer record has the client secret', async () => {
    const { issuerId } = await agent.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: {},
      authorizationServerConfigs: [
        {
          type: 'direct',
          issuer: authorizationServer,
          clientAuthentication: { clientId: 'client', clientSecret: 'removed-later' },
        },
      ],
    })

    const repository = agentContext.resolve(OpenId4VcIssuerRepository)
    await repository.getCachedByIssuerId(agentContext, issuerId)
    const cachedIssuer = await repository.getCachedByIssuerId(agentContext, issuerId)

    // Removed from storage after the issuer was read from the cache
    const storedIssuer = await repository.getByIssuerId(agentContext, issuerId)
    storedIssuer.authorizationServerConfigs = []
    await repository.update(agentContext, storedIssuer)

    await expect(
      dynamicOid4vciClientAuthentication(
        agentContext,
        cachedIssuer
      )({
        authorizationServerMetadata,
        url: authorizationServerMetadata.token_endpoint,
        method: 'POST',
        headers: new Headers(),
        contentType: 'application/x-www-form-urlencoded',
        body: {},
      } as unknown as ClientAuthenticationCallbackOptions)
    ).rejects.toThrow(`No 'clientSecret' is stored for the authorization server on the issuer record.`)
  })

  test('keeps client secrets out of the cached issuer record and reads them from storage to authenticate', async () => {
    const { issuerId } = await agent.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: {},
      authorizationServerConfigs: [
        {
          type: 'direct',
          issuer: authorizationServer,
          clientAuthentication: { clientId: 'client', clientSecret: 'not-in-the-cache' },
        },
      ],
    })

    const repository = agentContext.resolve(OpenId4VcIssuerRepository)
    const storedIssuer = await repository.getCachedByIssuerId(agentContext, issuerId)
    expect(JSON.stringify(storedIssuer.toJSON())).toContain('not-in-the-cache')

    const cachedIssuer = await repository.getCachedByIssuerId(agentContext, issuerId)

    expect(JSON.stringify(cachedIssuer.toJSON())).not.toContain('not-in-the-cache')
    expect(cachedIssuer.authorizationServerConfigs?.[0].clientAuthentication?.clientId).toEqual('client')

    const body: Record<string, unknown> = {}
    await dynamicOid4vciClientAuthentication(
      agentContext,
      cachedIssuer
    )({
      authorizationServerMetadata,
      url: authorizationServerMetadata.token_endpoint,
      method: 'POST',
      headers: new Headers(),
      contentType: 'application/x-www-form-urlencoded',
      body,
    } as unknown as ClientAuthenticationCallbackOptions)

    expect(body).toMatchObject({ client_id: 'client', client_secret: 'not-in-the-cache' })
  })
})

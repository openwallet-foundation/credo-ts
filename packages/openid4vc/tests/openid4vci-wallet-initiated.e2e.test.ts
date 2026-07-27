import type { SdJwtVcRecord } from '@credo-ts/core'
import { CredoError, DidsApi, JwsService, JwtPayload, Kms, TypedArrayEncoder } from '@credo-ts/core'
import type { AuthorizationServerMetadata, Jwk, JwtSigner, SignJwtCallback } from '@openid4vc/oauth2'
import { jwtHeaderFromJwtSigner, Oauth2AuthorizationServer } from '@openid4vc/oauth2'
import { AuthorizationFlow } from '@openid4vc/openid4vci'
import { randomUUID } from 'crypto'
import express, { type Express } from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { TenantsModule } from '../../tenants/src'
import type {
  OpenId4VcIssuerModuleConfigOptions,
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciGetDynamicIssuanceSession,
  OpenId4VciResolvedCredentialOffer,
} from '../src'
import {
  authorizationCodeGrantIdentifier,
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuerService,
  OpenId4VcModule,
} from '../src'
import type { OpenId4VciCredentialBindingResolver } from '../src/openid4vc-holder'
import { getOid4vcCallbacks } from '../src/shared/callbacks'
import type { AgentType, TenantType } from './utils'
import { createAgentFromModules, createTenantForAgent, waitForCredentialIssuanceSessionRecordSubject } from './utils'
import { universityDegreeCredentialConfigurationSupported } from './utilsVci'

const serverPort = 1234
const baseUrl = `http://localhost:${serverPort}`
const issuanceBaseUrl = `${baseUrl}/oid4vci`

describe('OpenId4Vc (Wallet Initiated Issuance)', () => {
  let expressApp: Express
  let clearNock: () => void

  let issuer: AgentType<{
    openid4vc: OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, undefined>
    tenants: TenantsModule<{ openid4vc: OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, undefined> }>
  }>
  let issuer1: TenantType

  let holder: AgentType<{
    openid4vc: OpenId4VcModule<undefined, undefined>
    tenants: TenantsModule<{ openid4vc: OpenId4VcModule<undefined, undefined> }>
  }>
  let holder1: TenantType

  const credentialRequestToCredentialMapper: OpenId4VciCredentialRequestToCredentialMapper = async ({
    agentContext,
    credentialConfiguration,
    holderBinding,
  }) => {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    const [firstDidKeyDid] = await didsApi.getCreatedDids({ method: 'key' })
    const didDocument = await didsApi.resolveDidDocument(firstDidKeyDid.did)
    const verificationMethod = didDocument.verificationMethod?.[0]
    if (!verificationMethod) {
      throw new Error('No verification method found')
    }

    if (credentialConfiguration.format === 'vc+sd-jwt' && credentialConfiguration.vct) {
      return {
        type: 'credentials',
        format: 'dc+sd-jwt',
        credentials: holderBinding.keys.map((holderBinding) => ({
          payload: { vct: credentialConfiguration.vct, university: 'innsbruck', degree: 'bachelor' },
          holder: holderBinding,
          issuer: {
            method: 'did',
            didUrl: verificationMethod.id,
          },
          disclosureFrame: { _sd: ['university', 'degree'] },
        })),
      }
    }

    throw new Error('Invalid request')
  }

  const credentialBindingResolver: OpenId4VciCredentialBindingResolver = async ({
    supportsJwk,
    agentContext,
    proofTypes,
  }) => {
    if (!supportsJwk) throw new CredoError('Only JWK binding is supported in this test')

    const kms = agentContext.resolve(Kms.KeyManagementApi)
    return {
      method: 'jwk',
      keys: [
        Kms.PublicJwk.fromPublicJwk(
          (
            await kms.createKeyForSignatureAlgorithm({
              algorithm: proofTypes.jwt?.supportedSignatureAlgorithms[0] ?? 'EdDSA',
            })
          ).publicJwk
        ),
      ],
    }
  }

  beforeEach(async () => {
    expressApp = express()

    holder = (await createAgentFromModules(
      {
        openid4vc: new OpenId4VcModule(),
        inMemory: new InMemoryWalletModule(),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598e',
      global.fetch
    )) as unknown as typeof holder
    holder1 = await createTenantForAgent(holder.agent, 'hTenant1')

    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()

    await issuer.agent.shutdown()
    await holder.agent.shutdown()
  })

  /**
   * Sets up a mock external IDP authorization server that signs id tokens and access tokens.
   */
  async function setupExternalIdp(options: { idpClientId: string; idpClientSecret: string }) {
    const { idpClientId, idpClientSecret } = options

    const idpServerKey = await issuer.agent.kms.createKey({
      type: { kty: 'EC', crv: 'P-256' },
    })
    const idpServerJwk = Kms.PublicJwk.fromPublicJwk(idpServerKey.publicJwk)
    const idpSignJwt: SignJwtCallback = async (_signer, { header, payload }) => {
      const jwsService = issuer.agent.dependencyManager.resolve(JwsService)
      const compact = await jwsService.createJwsCompact(issuer.agent.context, {
        keyId: idpServerKey.keyId,
        payload: JwtPayload.fromJson(payload),
        protectedHeaderOptions: { ...header, jwk: undefined, alg: 'ES256', kid: 'first' },
      })

      return { jwt: compact, signerJwk: idpServerKey.publicJwk as Jwk }
    }
    const idpServer = new Oauth2AuthorizationServer({
      callbacks: { ...getOid4vcCallbacks(issuer.agent.context), signJwt: idpSignJwt },
    })

    const idpApp = express()
    idpApp.get('/.well-known/oauth-authorization-server', (_req, res) =>
      res.json({
        jwks_uri: 'http://localhost:4747/jwks.json',
        issuer: 'http://localhost:4747',
        token_endpoint: 'http://localhost:4747/token',
        authorization_endpoint: 'http://localhost:4747/authorize',
      } satisfies AuthorizationServerMetadata)
    )
    idpApp.get('/jwks.json', (_req, res) =>
      res.setHeader('Content-Type', 'application/jwk-set+json').send(
        JSON.stringify({
          keys: [{ ...idpServerJwk.toJson(), kid: 'first' }],
        })
      )
    )
    idpApp.get('/authorize', (req, res) => {
      expect(req.query.client_id).toBe(idpClientId)
      expect(req.query.redirect_uri).toBeDefined()
      expect(req.query.state).toBeDefined()

      const redirect = new URL(req.query.redirect_uri as string)
      redirect.searchParams.set('state', req.query.state as string)
      redirect.searchParams.set('code', randomUUID())

      return res.redirect(redirect.toString())
    })
    idpApp.post('/token', async (req, res) => {
      const authorizationHeader = req.headers.authorization?.split(' ')
      if (
        !authorizationHeader ||
        authorizationHeader[0] !== 'Basic' ||
        authorizationHeader.length !== 2 ||
        TypedArrayEncoder.toUtf8String(TypedArrayEncoder.fromBase64Url(authorizationHeader[1])) !==
          `${idpClientId}:${idpClientSecret}`
      ) {
        return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid authorization header' })
      }

      const signer = {
        method: 'jwk',
        publicJwk: idpServerJwk.toJson() as Jwk,
        alg: 'ES256',
      } satisfies JwtSigner
      const { jwt } = await idpSignJwt(signer, {
        header: { ...jwtHeaderFromJwtSigner(signer), alg: 'ES256', typ: 'JWT' },
        payload: {
          iss: 'http://localhost:4747',
          aud: [idpClientId],
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          sub: 'user-123',
          name: 'John Doe',
        },
      })

      return res.json(
        await idpServer.createAccessTokenResponse({
          authorizationServer: 'http://localhost:4747',
          clientId: idpClientId,
          audience: idpClientId,
          expiresInSeconds: 5000,
          subject: 'externalIdpSubject',
          scope: 'UniversityDegreeCredential',
          signer,
          additionalAccessTokenResponsePayload: { id_token: jwt },
        })
      )
    })
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

    // Holder redirect endpoint that just returns the code
    const holderApp = express()
    holderApp.get('/redirect', (req, res) => res.json({ code: req.query.code }))
    const clearHolderNock = setupNockToExpress('http://localhost:5757', holderApp)

    return {
      clearNocks: () => {
        clearIdpNock()
        clearHolderNock()
      },
    }
  }

  /**
   * Builds a synthetic resolved credential offer pointing at the issuer metadata, with an
   * `authorization_code` grant that does NOT include an `issuer_state`. Passing this through the
   * holder authorization flow results in a Pushed Authorization Request without `issuer_state`,
   * i.e. a wallet-initiated issuance request.
   */
  async function resolveWalletInitiatedOffer(
    holderTenant: Awaited<ReturnType<typeof holder.agent.modules.tenants.getTenantAgent>>,
    issuerId: string
  ): Promise<OpenId4VciResolvedCredentialOffer> {
    const metadata = await holderTenant.openid4vc.holder.resolveIssuerMetadata(`${issuanceBaseUrl}/${issuerId}`)

    return {
      metadata,
      offeredCredentialConfigurations: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      credentialOfferPayload: {
        credential_issuer: metadata.credentialIssuer.credential_issuer,
        credential_configuration_ids: ['universityDegree'],
        grants: {
          [authorizationCodeGrantIdentifier]: {},
        },
      },
    } as OpenId4VciResolvedCredentialOffer
  }

  async function createIssuer(
    getDynamicIssuanceSession?: OpenId4VciGetDynamicIssuanceSession,
    extraIssuerConfig?: Partial<OpenId4VcIssuerModuleConfigOptions>
  ) {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
            getDynamicIssuanceSession,
            ...extraIssuerConfig,
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')
  }

  it('issues a credential through wallet-initiated chained authorization', async () => {
    const idpClientId = 'foo'
    const idpClientSecret = 'bar'
    const walletClientId = 'wallet'

    const getDynamicIssuanceSession: OpenId4VciGetDynamicIssuanceSession = async ({
      requestedScopes,
      requestedCredentialConfigurations,
      supportedAuthorizationFlows,
    }) => {
      expect(requestedScopes).toEqual(['UniversityDegreeCredential'])
      expect(supportedAuthorizationFlows).toContain('chained')

      return {
        authorizationFlow: 'chained',
        authorizationServerUrl: 'http://localhost:4747',
        credentialConfigurationIds: Object.keys(requestedCredentialConfigurations),
      }
    }

    await createIssuer(getDynamicIssuanceSession)
    const { clearNocks } = await setupExternalIdp({ idpClientId, idpClientSecret })

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })

    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: { type: 'clientSecret', clientId: idpClientId, clientSecret: idpClientSecret },
          scopesMapping: {
            UniversityDegreeCredential: ['UniversityDegreeCredential'],
          },
        },
      ],
    })

    await issuerTenant.endSession()

    const resolvedCredentialOffer = await resolveWalletInitiatedOffer(holderTenant, openIdIssuerTenant.issuerId)
    const resolvedAuthorization = await holderTenant.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(
      resolvedCredentialOffer,
      {
        clientId: walletClientId,
        redirectUri: 'http://localhost:5757/redirect',
        scope: ['UniversityDegreeCredential'],
      }
    )

    if (resolvedAuthorization.authorizationFlow !== AuthorizationFlow.Oauth2Redirect) {
      throw new Error(`Expected Oauth2Redirect flow, got ${resolvedAuthorization.authorizationFlow}`)
    }

    const authorizationResponse = await fetch(resolvedAuthorization.authorizationRequestUrl, { redirect: 'follow' })
    expect(authorizationResponse.ok).toBe(true)
    const code = ((await authorizationResponse.json()) as Record<string, string>)?.code
    expect(code).toBeDefined()

    const tokenResponseTenant = await holderTenant.openid4vc.holder.requestToken({
      resolvedCredentialOffer,
      clientId: walletClientId,
      codeVerifier: resolvedAuthorization.codeVerifier,
      code,
      redirectUri: 'http://localhost:5757/redirect',
    })

    const credentialResponse = await holderTenant.openid4vc.holder.requestCredentials({
      resolvedCredentialOffer,
      ...tokenResponseTenant,
      credentialBindingResolver,
      clientId: walletClientId,
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    const firstSdJwtVc = (credentialResponse.credentials[0].record as SdJwtVcRecord).firstCredential
    expect(firstSdJwtVc.payload.vct).toEqual('UniversityDegreeCredential')

    await holderTenant.endSession()
    clearNocks()
  })

  it('rejects wallet-initiated issuance when the callback denies the request', async () => {
    const idpClientId = 'foo'
    const idpClientSecret = 'bar'
    const walletClientId = 'wallet'

    // Callback returns null -> denied
    await createIssuer(async () => undefined)
    const { clearNocks } = await setupExternalIdp({ idpClientId, idpClientSecret })

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })

    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: { type: 'clientSecret', clientId: idpClientId, clientSecret: idpClientSecret },
          scopesMapping: { UniversityDegreeCredential: ['UniversityDegreeCredential'] },
        },
      ],
    })

    await issuerTenant.endSession()

    const resolvedCredentialOffer = await resolveWalletInitiatedOffer(holderTenant, openIdIssuerTenant.issuerId)

    await expect(
      holderTenant.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(resolvedCredentialOffer, {
        clientId: walletClientId,
        redirectUri: 'http://localhost:5757/redirect',
        scope: ['UniversityDegreeCredential'],
      })
    ).rejects.toThrow()

    await holderTenant.endSession()
    clearNocks()
  })

  it('rejects wallet-initiated issuance when no callback is configured', async () => {
    const idpClientId = 'foo'
    const idpClientSecret = 'bar'
    const walletClientId = 'wallet'

    // No getWalletInitiatedIssuanceSession callback configured
    await createIssuer(undefined)
    const { clearNocks } = await setupExternalIdp({ idpClientId, idpClientSecret })

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })

    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: { type: 'clientSecret', clientId: idpClientId, clientSecret: idpClientSecret },
          scopesMapping: { UniversityDegreeCredential: ['UniversityDegreeCredential'] },
        },
      ],
    })

    await issuerTenant.endSession()

    const resolvedCredentialOffer = await resolveWalletInitiatedOffer(holderTenant, openIdIssuerTenant.issuerId)

    await expect(
      holderTenant.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(resolvedCredentialOffer, {
        clientId: walletClientId,
        redirectUri: 'http://localhost:5757/redirect',
        scope: ['UniversityDegreeCredential'],
      })
    ).rejects.toThrow()

    await holderTenant.endSession()
    clearNocks()
  })

  it('creates a dynamic issuance session for the external authorization server flow', async () => {
    const getDynamicIssuanceSession: OpenId4VciGetDynamicIssuanceSession = async ({
      requestedCredentialConfigurations,
      supportedAuthorizationFlows,
      accessTokenPayload,
    }) => {
      expect(supportedAuthorizationFlows).toEqual(['external'])
      // For the external flow the access token is already present
      expect(accessTokenPayload?.sub).toBe('external-subject')

      return {
        authorizationFlow: 'external',
        credentialConfigurationIds: Object.keys(requestedCredentialConfigurations),
      }
    }

    await createIssuer(getDynamicIssuanceSession)

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })

    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
    })
    const issuerRecord = await issuerTenant.openid4vc.issuer.getIssuerByIssuerId(openIdIssuerTenant.issuerId)

    const service = issuerTenant.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuanceSession = await service.getDynamicIssuanceSession(issuerTenant.context, {
      origin: 'credentialRequest',
      issuer: issuerRecord,
      clientId: 'wallet',
      requestedScopes: ['UniversityDegreeCredential'],
      requestedCredentialConfigurations: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      supportedAuthorizationFlows: ['external'],
      // biome-ignore lint/suspicious/noExplicitAny: minimal access token payload for the test
      accessTokenPayload: { sub: 'external-subject' } as any,
    })

    expect(issuanceSession).not.toBeNull()
    expect(issuanceSession?.state).toBe(OpenId4VcIssuanceSessionState.CredentialRequestReceived)
    expect(issuanceSession?.authorization?.subject).toBe('external-subject')
    expect(issuanceSession?.chainedIdentity).toBeUndefined()
    expect(issuanceSession?.presentation).toBeUndefined()
    expect(issuanceSession?.credentialOfferPayload.credential_configuration_ids).toEqual(['universityDegree'])

    await issuerTenant.endSession()
  })

  it('rejects an external flow at an endpoint that only supports chained', async () => {
    // The callback returns an 'external' flow, but the (PAR-like) caller only supports 'chained'
    const getDynamicIssuanceSession: OpenId4VciGetDynamicIssuanceSession = async ({
      requestedCredentialConfigurations,
    }) => ({
      authorizationFlow: 'external',
      credentialConfigurationIds: Object.keys(requestedCredentialConfigurations),
    })

    await createIssuer(getDynamicIssuanceSession)

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })

    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
    })
    const issuerRecord = await issuerTenant.openid4vc.issuer.getIssuerByIssuerId(openIdIssuerTenant.issuerId)

    const service = issuerTenant.context.dependencyManager.resolve(OpenId4VcIssuerService)
    await expect(
      service.getDynamicIssuanceSession(issuerTenant.context, {
        origin: 'pushedAuthorizationRequest',
        issuer: issuerRecord,
        requestedScopes: ['UniversityDegreeCredential'],
        requestedCredentialConfigurations: {
          universityDegree: universityDegreeCredentialConfigurationSupported,
        },
        supportedAuthorizationFlows: ['chained'],
        request: { headers: new Headers(), method: 'POST', url: 'http://localhost/par' },
      })
    ).rejects.toThrow('only the following flows are supported at this endpoint: chained')

    await issuerTenant.endSession()
  })

  it('falls back to allowDynamicIssuanceSessions for the external flow when no callback is configured', async () => {
    // No callback, but the deprecated `allowDynamicIssuanceSessions` flag is enabled.
    await createIssuer(undefined, { allowDynamicIssuanceSessions: true })

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })

    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
    })
    const issuerRecord = await issuerTenant.openid4vc.issuer.getIssuerByIssuerId(openIdIssuerTenant.issuerId)

    const service = issuerTenant.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuanceSession = await service.getDynamicIssuanceSession(issuerTenant.context, {
      origin: 'credentialRequest',
      issuer: issuerRecord,
      clientId: 'wallet',
      requestedScopes: ['UniversityDegreeCredential'],
      requestedCredentialConfigurations: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      supportedAuthorizationFlows: ['external'],
      // biome-ignore lint/suspicious/noExplicitAny: minimal access token payload for the test
      accessTokenPayload: { sub: 'external-subject' } as any,
    })

    expect(issuanceSession).not.toBeNull()
    expect(issuanceSession?.state).toBe(OpenId4VcIssuanceSessionState.CredentialRequestReceived)
    expect(issuanceSession?.authorization?.subject).toBe('external-subject')

    await issuerTenant.endSession()
  })

  it('rejects the external flow when neither callback nor allowDynamicIssuanceSessions is configured', async () => {
    await createIssuer(undefined)

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })

    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
    })
    const issuerRecord = await issuerTenant.openid4vc.issuer.getIssuerByIssuerId(openIdIssuerTenant.issuerId)

    const service = issuerTenant.context.dependencyManager.resolve(OpenId4VcIssuerService)
    await expect(
      service.getDynamicIssuanceSession(issuerTenant.context, {
        origin: 'credentialRequest',
        issuer: issuerRecord,
        requestedScopes: ['UniversityDegreeCredential'],
        requestedCredentialConfigurations: {
          universityDegree: universityDegreeCredentialConfigurationSupported,
        },
        supportedAuthorizationFlows: ['external'],
        // biome-ignore lint/suspicious/noExplicitAny: minimal access token payload for the test
        accessTokenPayload: { sub: 'external-subject' } as any,
      })
    ).rejects.toThrow()

    await issuerTenant.endSession()
  })
})

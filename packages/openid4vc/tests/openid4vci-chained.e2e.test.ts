import type { SdJwtVcRecord } from '@credo-ts/core'
import { CredoError, DidsApi, JwsService, JwtPayload, Kms, TypedArrayEncoder, utils } from '@credo-ts/core'
import type { AuthorizationServerMetadata, Jwk, JwtSigner, SignJwtCallback } from '@openid4vc/oauth2'
import {
  clientAuthenticationDynamic,
  createDpopHeadersForRequest,
  decodeJwt,
  jwtHeaderFromJwtSigner,
  Oauth2AuthorizationServer,
  Oauth2Client,
} from '@openid4vc/oauth2'
import { AuthorizationFlow } from '@openid4vc/openid4vci'
import { randomUUID } from 'crypto'
import express, { type Express } from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { TenantsModule } from '../../tenants/src'
import { TenantSessionCoordinator } from '../../tenants/src/context/TenantSessionCoordinator'
import type { OpenId4VcIssuerModuleConfigOptions, OpenId4VciCredentialRequestToCredentialMapper } from '../src'
import { OpenId4VcIssuanceSessionState, OpenId4VcModule } from '../src'
import type { OpenId4VciCredentialBindingResolver } from '../src/openid4vc-holder'
import { OpenId4VcIssuerModuleConfig } from '../src/openid4vc-issuer/OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../src/openid4vc-issuer/OpenId4VcIssuerService'
import type { OpenId4VcIssuanceSessionChainedIdentity, OpenId4VcIssuerRecord } from '../src/openid4vc-issuer/repository'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuanceSessionRepository } from '../src/openid4vc-issuer/repository'
import { getOid4vcCallbacks } from '../src/shared/callbacks'
import type { OpenId4VciChainedAuthorizationServerConfig } from '../src/shared/models/OpenId4VciAuthorizationServerConfig'
import type { AgentType, TenantType } from './utils'
import { createAgentFromModules, createTenantForAgent, waitForCredentialIssuanceSessionRecordSubject } from './utils'
import { universityDegreeCredentialConfigurationSupported } from './utilsVci'

const serverPort = 1234
const baseUrl = `http://localhost:${serverPort}`
const issuanceBaseUrl = `${baseUrl}/oid4vci`

describe('OpenId4Vc (Chained Authorization)', () => {
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
    issuanceSession,
    holderBinding,
    authorization,
  }) => {
    // We sign the request with the first did:key did we have
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    const [firstDidKeyDid] = await didsApi.getCreatedDids({ method: 'key' })
    const didDocument = await didsApi.resolveDidDocument(firstDidKeyDid.did)
    const verificationMethod = didDocument.verificationMethod?.[0]
    if (!verificationMethod) {
      throw new Error('No verification method found')
    }

    let name = authorization.accessToken.payload.sub
    if (typeof issuanceSession.chainedIdentity?.externalAccessTokenResponse?.id_token === 'string') {
      // This token has already been validated by Credo, so we can just decode it.
      const { payload } = decodeJwt({
        jwt: issuanceSession.chainedIdentity.externalAccessTokenResponse.id_token,
      })
      if (typeof payload.name === 'string') {
        name = payload.name
      }
    }

    if (credentialConfiguration.format === 'vc+sd-jwt' && credentialConfiguration.vct) {
      return {
        type: 'credentials',
        format: 'dc+sd-jwt',
        credentials: holderBinding.keys.map((holderBinding) => ({
          payload: { vct: credentialConfiguration.vct, university: 'innsbruck', degree: 'bachelor', name },
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

    if (issuer) await issuer.agent.shutdown()
    if (holder) await holder.agent.shutdown()
  })

  const credentialBindingResolver: OpenId4VciCredentialBindingResolver = async ({
    supportsJwk,
    agentContext,
    issuerMaxBatchSize,
    proofTypes,
  }) => {
    if (!supportsJwk) throw new CredoError('Only JWK binding is supported in this test')
    if (issuerMaxBatchSize !== 1) throw new CredoError('This test only supports batch size of 1')

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

  it('e2e flow with tenants, issuer endpoints requesting a sd-jwt-vc using authorization code flow, openid, id tokens', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const walletClientId = 'wallet'
    const idpClientId = 'foo'
    const idpClientSecret = 'bar'

    // Setup External IDP Authorization Server
    const idpServerKey = await issuer.agent.kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const idpServerJwk = Kms.PublicJwk.fromPublicJwk(idpServerKey.publicJwk)
    const idpSignJwt: SignJwtCallback = async (_signer, { header, payload }) => {
      const jwsService = issuer.agent.dependencyManager.resolve(JwsService)
      const compact = await jwsService.createJwsCompact(issuer.agent.context, {
        keyId: idpServerKey.keyId,
        payload: JwtPayload.fromJson(payload),
        protectedHeaderOptions: {
          ...header,
          jwk: undefined,
          alg: 'ES256',
          kid: 'first',
        },
      })

      return {
        jwt: compact,
        signerJwk: idpServerKey.publicJwk as Jwk,
      }
    }
    const idpServer = new Oauth2AuthorizationServer({
      callbacks: {
        ...getOid4vcCallbacks(issuer.agent.context),
        signJwt: idpSignJwt,
      },
    })

    const idpApp = express()
    idpApp.get('/.well-known/oauth-authorization-server', (_req, res) =>
      res.json({
        jwks_uri: 'http://localhost:4747/jwks.json',
        issuer: 'http://localhost:4747',
        token_endpoint: 'http://localhost:4747/token',
        authorization_endpoint: 'http://localhost:4747/authorize',
        dpop_signing_alg_values_supported: [Kms.KnownJwaSignatureAlgorithms.ES256],
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
      // Check params
      expect(req.query.client_id).toBe(idpClientId)
      expect(req.query.redirect_uri).toBeDefined()
      expect(req.query.state).toBeDefined()
      const scope = (req.query.scope as string).split(' ')
      expect(scope).toContain('MappedUniversityDegreeCredential')
      expect(scope).toContain('openid')

      const redirect = new URL(req.query.redirect_uri as string)
      const searchParams = redirect.searchParams
      searchParams.set('state', req.query.state as string)
      searchParams.set('code', randomUUID())
      redirect.search = searchParams.toString()

      return res.redirect(redirect.toString())
    })
    const usedDpopJtis = new Set<string>()
    idpApp.post('/token', async (req, res) => {
      const authorizationHeader = req.headers.authorization?.split(' ')
      if (authorizationHeader?.[0] !== 'Basic' || authorizationHeader.length !== 2) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid authorization header',
        })
      }

      if (
        TypedArrayEncoder.toUtf8String(TypedArrayEncoder.fromBase64Url(authorizationHeader[1])) !==
        `${idpClientId}:${idpClientSecret}`
      ) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Unauthorized user',
        })
      }

      const dpopJwt = req.header('DPoP')
      if (!dpopJwt) {
        return res.status(400).json({
          error: 'invalid_dpop_proof',
          error_description: 'Missing DPoP proof',
        })
      }

      let dpopVerification: Awaited<ReturnType<typeof idpServer.verifyDpopJwt>>
      try {
        dpopVerification = await idpServer.verifyDpopJwt({
          dpopJwt,
          request: {
            headers: new Headers(),
            method: 'POST',
            url: 'http://localhost:4747/token',
          },
          allowedSigningAlgs: [Kms.KnownJwaSignatureAlgorithms.ES256],
        })
        if (usedDpopJtis.has(dpopVerification.payload.jti)) {
          return res.status(400).json({
            error: 'invalid_dpop_proof',
            error_description: 'DPoP proof replayed',
          })
        }
        usedDpopJtis.add(dpopVerification.payload.jti)
      } catch (error) {
        return res.status(400).json({
          error: 'invalid_dpop_proof',
          error_description: error instanceof Error ? error.message : 'Invalid DPoP proof',
        })
      }

      // Create id_token
      const signer = {
        method: 'jwk',
        publicJwk: idpServerJwk.toJson() as Jwk,
        alg: 'ES256',
      } satisfies JwtSigner

      const header = {
        ...jwtHeaderFromJwtSigner(signer),
        alg: 'ES256',
        typ: 'JWT',
      }

      const payload = {
        iss: 'http://localhost:4747',
        aud: [idpClientId],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        sub: 'user-123',
        name: 'John Doe',
        nickname: 'marmite',
        website: 'https://example.com',
      }

      const { jwt } = await idpSignJwt(signer, {
        header,
        payload,
      })

      const accessToken = await issuer.agent.dependencyManager
        .resolve(JwsService)
        .createJwsCompact(issuer.agent.context, {
          keyId: idpServerKey.keyId,
          payload: JwtPayload.fromJson({
            iss: 'http://localhost:4747',
            aud: idpClientId,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            jti: randomUUID(),
            sub: 'externalIdpSubject',
            scope: 'MappedUniversityDegreeCredential openid',
            cnf: { jkt: dpopVerification.jwkThumbprint },
          }),
          protectedHeaderOptions: {
            typ: 'at+jwt',
            alg: 'ES256',
            kid: 'first',
          },
        })

      return res.json({
        access_token: accessToken,
        token_type: 'DPoP',
        expires_in: 5000,
        scope: 'MappedUniversityDegreeCredential openid',
        id_token: jwt,
      })
    })
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

    // Setup Holder Redirect
    const holderApp = express()
    holderApp.get('/redirect', (req, res) => {
      // For testing, we just return the code directly. On a real use case, the user
      // will see this page, and therefore should be provided with some HTML.
      res.json({
        code: req.query.code,
        error: req.query.error,
        error_description: req.query.error_description,
      })
    })
    const clearHolderNock = setupNockToExpress('http://localhost:5757', holderApp)

    // Setup issuer and holder
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
          requireDpop: true,
          clientAuthentication: {
            type: 'clientSecret',
            clientId: idpClientId,
            clientSecret: idpClientSecret,
          },
          scopesMapping: {
            UniversityDegreeCredential: ['MappedUniversityDegreeCredential', 'openid'],
          },
        },
      ],
    })

    const {
      issuanceSession: { id: issuanceSessionId },
      credentialOffer,
    } = await issuerTenant.openid4vc.issuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:4747',
        issuerState: utils.uuid(),
      },
    })

    await issuerTenant.endSession()

    const resolvedCredentialOffer = await holderTenant.openid4vc.holder.resolveCredentialOffer(credentialOffer)
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

    const authorizationResponse = await fetch(resolvedAuthorization.authorizationRequestUrl, {
      redirect: 'follow',
    })
    expect(authorizationResponse.ok).toBe(true)
    const authorizationResponseBody = (await authorizationResponse.json()) as Record<string, string>
    const code = authorizationResponseBody.code

    if (!code) {
      throw new Error(`Authorization failed: ${JSON.stringify(authorizationResponseBody)}`)
    }

    // The pkce code challenge from the pushed authorization request is bound to the authorization code,
    // so it can't be redeemed without the (correct) code verifier
    expect(resolvedAuthorization.codeVerifier).toEqual(expect.any(String))
    for (const codeVerifier of [undefined, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']) {
      await expect(
        holderTenant.openid4vc.holder.requestToken({
          dpop: resolvedAuthorization.dpop,
          resolvedCredentialOffer,
          clientId: walletClientId,
          codeVerifier,
          code,
          redirectUri: 'http://localhost:5757/redirect',
        })
      ).rejects.toThrow('Received token error response with status 400')
    }

    const tokenResponseTenant = await holderTenant.openid4vc.holder.requestToken({
      dpop: resolvedAuthorization.dpop,
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
      issuanceSessionId,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    const firstSdJwtVcTenant1 = (credentialResponse.credentials[0].record as SdJwtVcRecord).firstCredential
    expect(firstSdJwtVcTenant1.payload.vct).toEqual('UniversityDegreeCredential')
    expect(firstSdJwtVcTenant1.payload.name).toEqual('John Doe')

    await holderTenant.endSession()

    // The authorization and redirect endpoints must not leave issuer tenant sessions open
    const sessionCoordinator = issuer.agent.dependencyManager.resolve(TenantSessionCoordinator)
    await vi.waitFor(() => expect(sessionCoordinator.getSessionCountForTenant(issuer1.tenantId)).toBe(0))

    clearIdpNock()
    clearHolderNock()
  })

  it('e2e flow with tenants, issuer endpoints requesting a sd-jwt-vc using authorization code flow, openid, additional parameter, id tokens (callback)', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
            getChainedAuthorizationRequestParameters: async () => {
              return {
                scopes: ['ScopeFoo', 'ScopeBar'],
                additionalPayload: {
                  foo: 'bar',
                },
              }
            },
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const walletClientId = 'wallet'
    const idpClientId = 'foo'
    const idpClientSecret = 'bar'

    // Setup External IDP Authorization Server
    const idpServerKey = await issuer.agent.kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const idpServerJwk = Kms.PublicJwk.fromPublicJwk(idpServerKey.publicJwk)
    const idpSignJwt: SignJwtCallback = async (_signer, { header, payload }) => {
      const jwsService = issuer.agent.dependencyManager.resolve(JwsService)
      const compact = await jwsService.createJwsCompact(issuer.agent.context, {
        keyId: idpServerKey.keyId,
        payload: JwtPayload.fromJson(payload),
        protectedHeaderOptions: {
          ...header,
          jwk: undefined,
          alg: 'ES256',
          kid: 'first',
        },
      })

      return {
        jwt: compact,
        signerJwk: idpServerKey.publicJwk as Jwk,
      }
    }
    const idpServer = new Oauth2AuthorizationServer({
      callbacks: {
        ...getOid4vcCallbacks(issuer.agent.context),
        signJwt: idpSignJwt,
      },
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
      // Check params
      expect(req.query.client_id).toBe(idpClientId)
      expect(req.query.redirect_uri).toBeDefined()
      expect(req.query.state).toBeDefined()
      expect(req.query.foo).toBe('bar')

      const scope = (req.query.scope as string).split(' ')
      expect(scope).toContain('ScopeFoo')
      expect(scope).toContain('ScopeBar')

      const redirect = new URL(req.query.redirect_uri as string)
      const searchParams = redirect.searchParams
      searchParams.set('state', req.query.state as string)
      searchParams.set('code', randomUUID())
      redirect.search = searchParams.toString()

      return res.redirect(redirect.toString())
    })
    idpApp.post('/token', async (req, res) => {
      const authorizationHeader = req.headers.authorization?.split(' ')
      if (authorizationHeader?.[0] !== 'Basic' || authorizationHeader.length !== 2) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid authorization header',
        })
      }

      if (
        TypedArrayEncoder.toUtf8String(TypedArrayEncoder.fromBase64Url(authorizationHeader[1])) !==
        `${idpClientId}:${idpClientSecret}`
      ) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Unauthorized user',
        })
      }

      // Create id_token
      const signer = {
        method: 'jwk',
        publicJwk: idpServerJwk.toJson() as Jwk,
        alg: 'ES256',
      } satisfies JwtSigner

      const header = {
        ...jwtHeaderFromJwtSigner(signer),
        alg: 'ES256',
        typ: 'JWT',
      }

      const payload = {
        iss: 'http://localhost:4747',
        aud: [idpClientId],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        sub: 'user-123',
        name: 'John Doe',
        nickname: 'marmite',
        website: 'https://example.com',
      }

      const { jwt } = await idpSignJwt(signer, {
        header,
        payload,
      })

      return res.json(
        await idpServer.createAccessTokenResponse({
          authorizationServer: 'http://localhost:4747',
          clientId: idpClientId,
          audience: idpClientId,
          expiresInSeconds: 5000,
          subject: 'externalIdpSubject',
          scope: 'MappedUniversityDegreeCredential openid',
          signer: {
            method: 'jwk',
            publicJwk: idpServerJwk.toJson() as Jwk,
            alg: 'ES256',
          },
          additionalAccessTokenResponsePayload: {
            id_token: jwt,
          },
        })
      )
    })
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

    // Setup Holder Redirect
    const holderApp = express()
    holderApp.get('/redirect', (req, res) => {
      // For testing, we just return the code directly. On a real use case, the user
      // will see this page, and therefore should be provided with some HTML.
      res.json({
        code: req.query.code,
      })
    })
    const clearHolderNock = setupNockToExpress('http://localhost:5757', holderApp)

    // Setup issuer and holder
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
          clientAuthentication: {
            type: 'clientSecret',
            clientId: idpClientId,
            clientSecret: idpClientSecret,
          },
        },
      ],
    })

    const {
      issuanceSession: { id: issuanceSessionId },
      credentialOffer,
    } = await issuerTenant.openid4vc.issuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:4747',
        issuerState: utils.uuid(),
      },
    })

    await issuerTenant.endSession()

    const resolvedCredentialOffer = await holderTenant.openid4vc.holder.resolveCredentialOffer(credentialOffer)
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

    const authorizationResponse = await fetch(resolvedAuthorization.authorizationRequestUrl, {
      redirect: 'follow',
    })
    expect(authorizationResponse.ok).toBe(true)
    const code = ((await authorizationResponse.json()) as Record<string, string>)?.code

    expect(code).toBeDefined()

    const tokenResponseTenant = await holderTenant.openid4vc.holder.requestToken({
      dpop: resolvedAuthorization.dpop,
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
      issuanceSessionId,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    const firstSdJwtVcTenant1 = (credentialResponse.credentials[0].record as SdJwtVcRecord).firstCredential
    expect(firstSdJwtVcTenant1.payload.vct).toEqual('UniversityDegreeCredential')
    expect(firstSdJwtVcTenant1.payload.name).toEqual('John Doe')

    await holderTenant.endSession()

    // The authorization and redirect endpoints must not leave issuer tenant sessions open
    const sessionCoordinator = issuer.agent.dependencyManager.resolve(TenantSessionCoordinator)
    await vi.waitFor(() => expect(sessionCoordinator.getSessionCountForTenant(issuer1.tenantId)).toBe(0))

    clearIdpNock()
    clearHolderNock()
  })

  it('e2e flow with tenants, issuer endpoints fails when redirect uri is not allowed', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const walletClientId = 'wallet'
    const idpClientId = 'foo'
    const idpClientSecret = 'bar'

    // Setup External IDP Authorization Server
    const idpServerKey = await issuer.agent.kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const idpServerJwk = Kms.PublicJwk.fromPublicJwk(idpServerKey.publicJwk)

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
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

    // Setup Holder Redirect
    const holderApp = express()
    holderApp.get('/redirect', (req, res) => {
      // For testing, we just return the code directly. On a real use case, the user
      // will see this page, and therefore should be provided with some HTML.
      res.json({
        code: req.query.code,
      })
    })
    const clearHolderNock = setupNockToExpress('http://localhost:5757', holderApp)

    // Setup issuer and holder
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
          clientAuthentication: {
            type: 'clientSecret',
            clientId: idpClientId,
            clientSecret: idpClientSecret,
          },
          scopesMapping: {
            UniversityDegreeCredential: ['ScopeFoo', 'ScopeBar'],
          },
          redirectUris: ['http://localhost:5757/the-other-one'],
        },
      ],
    })

    const { credentialOffer } = await issuerTenant.openid4vc.issuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:4747',
        issuerState: utils.uuid(),
      },
    })

    await issuerTenant.endSession()

    const resolvedCredentialOffer = await holderTenant.openid4vc.holder.resolveCredentialOffer(credentialOffer)

    await expect(
      holderTenant.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(resolvedCredentialOffer, {
        clientId: walletClientId,
        redirectUri: 'http://localhost:5757/redirect',
        scope: ['UniversityDegreeCredential'],
      })
    ).to.rejects.toThrow(`Invalid 'redirect_uri' parameter`)

    await holderTenant.endSession()

    clearIdpNock()
    clearHolderNock()
  })

  it('e2e flow with tenants, issuer endpoints fails when redirect uri is not allowed (callback)', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
            getChainedAuthorizationRequestParameters: async () => {
              return {
                scopes: ['ScopeFoo', 'ScopeBar'],
                additionalPayload: {
                  foo: 'bar',
                },
                redirectUris: ['http://localhost:5757/the-other-one'],
              }
            },
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const walletClientId = 'wallet'
    const idpClientId = 'foo'
    const idpClientSecret = 'bar'

    // Setup External IDP Authorization Server
    const idpServerKey = await issuer.agent.kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const idpServerJwk = Kms.PublicJwk.fromPublicJwk(idpServerKey.publicJwk)

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
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

    // Setup Holder Redirect
    const holderApp = express()
    holderApp.get('/redirect', (req, res) => {
      // For testing, we just return the code directly. On a real use case, the user
      // will see this page, and therefore should be provided with some HTML.
      res.json({
        code: req.query.code,
      })
    })
    const clearHolderNock = setupNockToExpress('http://localhost:5757', holderApp)

    // Setup issuer and holder
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
          clientAuthentication: {
            type: 'clientSecret',
            clientId: idpClientId,
            clientSecret: idpClientSecret,
          },
        },
      ],
    })

    const { credentialOffer } = await issuerTenant.openid4vc.issuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:4747',
        issuerState: utils.uuid(),
      },
    })

    await issuerTenant.endSession()

    const resolvedCredentialOffer = await holderTenant.openid4vc.holder.resolveCredentialOffer(credentialOffer)

    await expect(
      holderTenant.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(resolvedCredentialOffer, {
        clientId: walletClientId,
        redirectUri: 'http://localhost:5757/redirect',
        scope: ['UniversityDegreeCredential'],
      })
    ).to.rejects.toThrow(`Invalid 'redirect_uri' parameter`)

    await holderTenant.endSession()

    clearIdpNock()
    clearHolderNock()
  })

  it('rejects a chained authorization-code offer when a static scope mapping is incomplete', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: {
            type: 'clientSecret',
            clientId: 'issuer-client',
            clientSecret: 'issuer-secret',
          },
          scopesMapping: {},
        },
      ],
    })

    await expect(
      issuerTenant.openid4vc.issuer.createCredentialOffer({
        issuerId: openIdIssuerTenant.issuerId,
        credentialConfigurationIds: ['universityDegree'],
        authorizationCodeFlowConfig: {
          authorizationServerUrl: 'http://localhost:4747',
        },
      })
    ).rejects.toThrow(
      "Issuer does not have a scope mapping for 'UniversityDegreeCredential' for chained authorization server 'http://localhost:4747'."
    )

    await issuerTenant.endSession()
  })

  it('rejects a chained authorization-code offer when no static scope mapping is configured', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: {
            type: 'clientSecret',
            clientId: 'issuer-client',
            clientSecret: 'issuer-secret',
          },
        },
      ],
    })

    await expect(
      issuerTenant.openid4vc.issuer.createCredentialOffer({
        issuerId: openIdIssuerTenant.issuerId,
        credentialConfigurationIds: ['universityDegree'],
        authorizationCodeFlowConfig: {
          authorizationServerUrl: 'http://localhost:4747',
        },
      })
    ).rejects.toThrow(
      "Issuer does not have a static scope mapping for chained authorization server 'http://localhost:4747'."
    )

    await issuerTenant.endSession()
  })

  it('responds with 201 Created to a successful pushed authorization request', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: {
            type: 'clientSecret',
            clientId: 'issuer-client',
            clientSecret: 'issuer-secret',
          },
          scopesMapping: {
            UniversityDegreeCredential: ['openid'],
          },
        },
      ],
    })

    const idpApp = express()
    idpApp.get('/.well-known/oauth-authorization-server', (_req, res) =>
      res.json({
        issuer: 'http://localhost:4747',
        authorization_endpoint: 'http://localhost:4747/authorize',
        token_endpoint: 'http://localhost:4747/token',
      } satisfies AuthorizationServerMetadata)
    )
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

    const { issuanceSession } = await issuerTenant.openid4vc.issuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:4747',
      },
    })

    const response = await fetch(`${issuanceBaseUrl}/${openIdIssuerTenant.issuerId}/par`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'wallet',
        response_type: 'code',
        redirect_uri: 'http://localhost:5757/redirect',
        scope: 'UniversityDegreeCredential',
        state: 'wallet-state',
        issuer_state: issuanceSession.authorization?.issuerState,
        code_challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        code_challenge_method: 'S256',
        dpop_jkt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      request_uri: expect.any(String),
      expires_in: expect.any(Number),
    })

    clearIdpNock()

    await issuerTenant.endSession()
  })

  it('returns invalid_request from PAR when redirect_uri is missing', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: {
            type: 'clientSecret',
            clientId: 'issuer-client',
            clientSecret: 'issuer-secret',
          },
          scopesMapping: {
            UniversityDegreeCredential: ['openid'],
          },
        },
      ],
    })

    const idpApp = express()
    idpApp.get('/.well-known/oauth-authorization-server', (_req, res) =>
      res.json({
        issuer: 'http://localhost:4747',
        authorization_endpoint: 'http://localhost:4747/authorize',
        token_endpoint: 'http://localhost:4747/token',
      } satisfies AuthorizationServerMetadata)
    )
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

    const { issuanceSession } = await issuerTenant.openid4vc.issuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:4747',
      },
    })

    const response = await fetch(`${issuanceBaseUrl}/${openIdIssuerTenant.issuerId}/par`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'wallet',
        response_type: 'code',
        scope: 'UniversityDegreeCredential',
        issuer_state: issuanceSession.authorization?.issuerState,
        code_challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        code_challenge_method: 'S256',
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'invalid_request',
      error_description: `Missing required 'redirect_uri' parameter.`,
    })

    clearIdpNock()
    await issuerTenant.endSession()
  })

  it('returns an OAuth error from PAR when a previously valid static scope mapping is removed', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: {
            type: 'clientSecret',
            clientId: 'issuer-client',
            clientSecret: 'issuer-secret',
          },
          scopesMapping: {
            UniversityDegreeCredential: ['openid'],
          },
        },
      ],
    })

    const idpApp = express()
    idpApp.get('/.well-known/oauth-authorization-server', (_req, res) =>
      res.json({
        issuer: 'http://localhost:4747',
        authorization_endpoint: 'http://localhost:4747/authorize',
        token_endpoint: 'http://localhost:4747/token',
      } satisfies AuthorizationServerMetadata)
    )
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

    const { issuanceSession } = await issuerTenant.openid4vc.issuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:4747',
      },
    })

    await issuerTenant.openid4vc.issuer.updateIssuerMetadata({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          type: 'chained',
          issuer: 'http://localhost:4747',
          clientAuthentication: {
            type: 'clientSecret',
            clientId: 'issuer-client',
            clientSecret: 'issuer-secret',
          },
        },
      ],
    })

    const response = await fetch(`${issuanceBaseUrl}/${openIdIssuerTenant.issuerId}/par`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'wallet',
        response_type: 'code',
        redirect_uri: 'http://localhost:5757/redirect',
        scope: 'UniversityDegreeCredential',
        state: 'wallet-state',
        issuer_state: issuanceSession.authorization?.issuerState,
        code_challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        code_challenge_method: 'S256',
        dpop_jkt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    })

    const responseBody = await response.json()
    expect(response.status).toBe(400)
    expect(responseBody).toMatchObject({
      error: 'server_error',
    })

    clearIdpNock()

    await issuerTenant.endSession()
  })

  it.each([
    { name: 'by default', pkceRequired: undefined, requirePkce: undefined },
    { name: 'globally', pkceRequired: true, requirePkce: undefined },
    { name: 'for the issuance session', pkceRequired: false, requirePkce: true },
  ])(
    'rejects a pushed authorization request without S256 pkce when pkce is required $name',
    async ({ pkceRequired, requirePkce }) => {
      issuer = (await createAgentFromModules(
        {
          inMemory: new InMemoryWalletModule(),
          openid4vc: new OpenId4VcModule({
            app: expressApp,
            issuer: {
              baseUrl: issuanceBaseUrl,
              credentialRequestToCredentialMapper,
              pkceRequired,
            },
          }),
          tenants: new TenantsModule(),
        },
        '96213c3d7fc8d4d6754c7a0fd969598g',
        global.fetch
      )) as unknown as typeof issuer
      issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

      const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
      const openIdIssuerTenant = await issuerTenant.openid4vc.issuer.createIssuer({
        issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
        credentialConfigurationsSupported: {
          universityDegree: universityDegreeCredentialConfigurationSupported,
        },
        authorizationServerConfigs: [
          {
            type: 'chained',
            issuer: 'http://localhost:4747',
            clientAuthentication: {
              type: 'clientSecret',
              clientId: 'issuer-client',
              clientSecret: 'issuer-secret',
            },
            scopesMapping: {
              UniversityDegreeCredential: ['openid'],
            },
          },
        ],
      })

      const createCredentialOffer = (requirePkce?: boolean) =>
        issuerTenant.openid4vc.issuer.createCredentialOffer({
          issuerId: openIdIssuerTenant.issuerId,
          credentialConfigurationIds: ['universityDegree'],
          authorizationCodeFlowConfig: {
            authorizationServerUrl: 'http://localhost:4747',
          },
          authorization: {
            requirePkce,
          },
        })

      const sendPushedAuthorizationRequest = (issuerState: string | undefined, pkce: Record<string, string>) =>
        fetch(`${issuanceBaseUrl}/${openIdIssuerTenant.issuerId}/par`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'wallet',
            response_type: 'code',
            redirect_uri: 'http://localhost:5757/redirect',
            scope: 'UniversityDegreeCredential',
            issuer_state: issuerState,
            dpop_jkt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            ...pkce,
          }),
        })

      const idpApp = express()
      idpApp.get('/.well-known/oauth-authorization-server', (_req, res) =>
        res.json({
          issuer: 'http://localhost:4747',
          authorization_endpoint: 'http://localhost:4747/authorize',
          token_endpoint: 'http://localhost:4747/token',
        } satisfies AuthorizationServerMetadata)
      )
      const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

      const { issuanceSession } = await createCredentialOffer(requirePkce)
      const issuerState = issuanceSession.authorization?.issuerState

      const missingPkceResponse = await sendPushedAuthorizationRequest(issuerState, {})
      expect(missingPkceResponse.status).toBe(400)
      expect(await missingPkceResponse.json()).toEqual({
        error: 'invalid_request',
        error_description: `Missing required 'code_challenge' parameter.`,
      })

      const plainPkceResponse = await sendPushedAuthorizationRequest(issuerState, {
        code_challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        code_challenge_method: 'plain',
      })
      expect(plainPkceResponse.status).toBe(400)
      expect(await plainPkceResponse.json()).toEqual({
        error: 'invalid_request',
        error_description: `Unsupported 'code_challenge_method' 'plain'. Only 'S256' is supported.`,
      })

      const missingMethodResponse = await sendPushedAuthorizationRequest(issuerState, {
        code_challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      })
      expect(missingMethodResponse.status).toBe(400)
      expect(await missingMethodResponse.json()).toEqual({
        error: 'invalid_request',
        error_description: `Unsupported 'code_challenge_method' 'plain'. Only 'S256' is supported.`,
      })

      // `requirePkce: false` on the issuance session disables the requirement, also when required globally
      const { issuanceSession: issuanceSessionPkceNotRequired } = await createCredentialOffer(false)
      expect(issuanceSessionPkceNotRequired.pkce).toEqual({ required: false })
      const pkceNotRequiredResponse = await sendPushedAuthorizationRequest(
        issuanceSessionPkceNotRequired.authorization?.issuerState,
        {}
      )
      expect(pkceNotRequiredResponse.ok).toBe(true)
      expect(await pkceNotRequiredResponse.json()).toMatchObject({ request_uri: expect.any(String) })

      clearIdpNock()

      await issuerTenant.endSession()
    }
  )

  describe('chained authorization server DPoP', () => {
    const upstreamAuthorizationServerMetadata = {
      issuer: 'https://upstream.example.com',
      token_endpoint: 'https://upstream.example.com/token',
      dpop_signing_alg_values_supported: [Kms.KnownJwaSignatureAlgorithms.ES256],
    } satisfies AuthorizationServerMetadata

    const tokenRequest = {
      headers: new Headers(),
      method: 'POST',
      url: 'https://upstream.example.com/token',
    } as const

    let dpopAgent: AgentType<{
      openid4vc: OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, undefined>
    }>
    let issuerService: OpenId4VcIssuerService
    let clearDpopNock: (() => void) | undefined

    beforeEach(async () => {
      const app = express()
      dpopAgent = (await createAgentFromModules(
        {
          inMemory: new InMemoryWalletModule(),
          openid4vc: new OpenId4VcModule({
            app,
            issuer: {
              baseUrl: 'http://localhost:3000/oid4vci',
              credentialRequestToCredentialMapper,
            },
          }),
        },
        '96213c3d7fc8d4d6754c7a0fd969598e',
        global.fetch
      )) as typeof dpopAgent
      issuerService = dpopAgent.agent.dependencyManager.resolve(OpenId4VcIssuerService)
      clearDpopNock = setupNockToExpress('http://localhost:3000', app)
    })

    afterEach(async () => {
      clearDpopNock?.()
      await dpopAgent.agent.shutdown()
    })

    it.each([
      {
        mode: 'supported DPoP with a JWT access token',
        requireDpop: true,
        tokenType: 'dpop',
        opaqueAccessToken: false,
        introspectionAvailable: false,
        introspectionHasJkt: false,
      },
      {
        mode: 'supported DPoP with a JWT access token bound to another key',
        requireDpop: true,
        tokenType: 'DPoP',
        opaqueAccessToken: false,
        introspectionAvailable: false,
        introspectionHasJkt: false,
        mismatchedJkt: true,
      },
      {
        mode: 'uses supported DPoP when it is not required',
        requireDpop: false,
        tokenType: 'DPoP',
        opaqueAccessToken: true,
        introspectionAvailable: true,
        introspectionHasJkt: true,
      },
      {
        mode: 'supported DPoP with an opaque token and no introspection endpoint',
        requireDpop: true,
        tokenType: 'DPoP',
        opaqueAccessToken: true,
        introspectionAvailable: false,
        introspectionHasJkt: false,
      },
      {
        mode: 'supported DPoP with an opaque token without an introspected jkt',
        requireDpop: true,
        tokenType: 'DPoP',
        opaqueAccessToken: true,
        introspectionAvailable: true,
        introspectionHasJkt: false,
      },
      {
        mode: 'supported DPoP with an inactive opaque token',
        requireDpop: true,
        tokenType: 'DPoP',
        opaqueAccessToken: true,
        introspectionAvailable: true,
        introspectionHasJkt: true,
        introspectionActive: false,
      },
      {
        mode: 'required DPoP support with a non-DPoP token type',
        requireDpop: true,
        tokenType: 'Bearer',
        opaqueAccessToken: true,
      },
      {
        mode: 'optional DPoP support with a non-DPoP token type',
        requireDpop: false,
        tokenType: 'Bearer',
        opaqueAccessToken: true,
      },
    ])(
      'preserves upstream nonce from authorization initiation through token exchange with $mode',
      async ({
        requireDpop,
        tokenType,
        opaqueAccessToken,
        introspectionAvailable,
        introspectionHasJkt,
        introspectionActive = true,
        mismatchedJkt,
      }) => {
        const issuerId = `chained-dpop-${utils.uuid()}`
        const upstreamIssuer = 'http://localhost:4748'
        const nonce = 'authorization-challenge-nonce'
        const redirectUri = 'http://localhost:5757/redirect'
        const tokenProofs: string[] = []
        let upstreamDpopJkt: string | undefined
        let authorizationChallengeState: string | undefined
        let authorizationChallengeRedirectUri: string | undefined

        const upstreamServer = new Oauth2AuthorizationServer({
          callbacks: getOid4vcCallbacks(dpopAgent.agent.context),
        })
        const upstreamKey = await dpopAgent.agent.kms.createKey({
          type: { kty: 'EC', crv: 'P-256' },
        })
        const upstreamApp = express()
        upstreamApp.use(express.urlencoded({ extended: false }))
        upstreamApp.get('/.well-known/oauth-authorization-server', (_req, res) =>
          res.json({
            ...upstreamAuthorizationServerMetadata,
            issuer: upstreamIssuer,
            authorization_endpoint: `${upstreamIssuer}/authorize`,
            authorization_challenge_endpoint: `${upstreamIssuer}/authorization-challenge`,
            token_endpoint: `${upstreamIssuer}/token`,
            jwks_uri: `${upstreamIssuer}/jwks`,
            ...(introspectionAvailable ? { introspection_endpoint: `${upstreamIssuer}/introspect` } : {}),
          } satisfies AuthorizationServerMetadata)
        )
        upstreamApp.get('/jwks', (_req, res) =>
          res.json({
            keys: [{ ...Kms.PublicJwk.fromPublicJwk(upstreamKey.publicJwk).toJson(), kid: upstreamKey.keyId }],
          })
        )
        if (introspectionAvailable) {
          upstreamApp.post('/introspect', (_req, res) =>
            res.json({
              active: introspectionActive,
              token_type: 'DPoP',
              ...(introspectionHasJkt && upstreamDpopJkt ? { cnf: { jkt: upstreamDpopJkt } } : {}),
            })
          )
        }
        upstreamApp.post('/authorization-challenge', async (req, res) => {
          authorizationChallengeState = req.body.state
          authorizationChallengeRedirectUri = req.body.redirect_uri

          const proof = req.header('DPoP')
          if (!proof) return res.status(400).json({ error: 'invalid_dpop_proof' })

          try {
            await upstreamServer.verifyDpopJwt({
              dpopJwt: proof,
              request: {
                headers: new Headers(),
                method: 'POST',
                url: `${upstreamIssuer}/authorization-challenge`,
              },
            })
          } catch (error) {
            return res.status(400).json({
              error: 'invalid_dpop_proof',
              error_description: error instanceof Error ? error.message : 'Invalid DPoP proof',
            })
          }

          return res
            .status(400)
            .set('DPoP-Nonce', nonce)
            .json({ error: 'redirect_to_web', request_uri: `${upstreamIssuer}/request/1` })
        })
        upstreamApp.post('/token', async (req, res) => {
          const proof = req.header('DPoP')
          if (!proof) return res.status(400).json({ error: 'invalid_dpop_proof' })
          tokenProofs.push(proof)

          try {
            const verified = await upstreamServer.verifyDpopJwt({
              dpopJwt: proof,
              request: {
                headers: new Headers(),
                method: 'POST',
                url: `${upstreamIssuer}/token`,
              },
              expectedNonce: nonce,
            })
            upstreamDpopJkt = verified.jwkThumbprint
          } catch (error) {
            return res
              .status(400)
              .set('DPoP-Nonce', nonce)
              .json({
                error: 'use_dpop_nonce',
                error_description: error instanceof Error ? error.message : 'DPoP nonce required',
              })
          }

          const accessToken = opaqueAccessToken
            ? 'opaque-upstream-access-token'
            : await dpopAgent.agent.dependencyManager.resolve(JwsService).createJwsCompact(dpopAgent.agent.context, {
                keyId: upstreamKey.keyId,
                payload: JwtPayload.fromJson({
                  iss: upstreamIssuer,
                  aud: 'upstream-client',
                  sub: 'upstream-user',
                  jti: utils.uuid(),
                  cnf: { jkt: mismatchedJkt ? 'another-key-thumbprint' : upstreamDpopJkt },
                  exp: Math.floor(Date.now() / 1000) + 300,
                  iat: Math.floor(Date.now() / 1000),
                }),
                protectedHeaderOptions: {
                  typ: 'at+jwt',
                  alg: 'ES256',
                  kid: upstreamKey.keyId,
                },
              })

          return res.json({
            access_token: accessToken,
            token_type: tokenType,
            expires_in: 300,
            scope: 'MappedUniversityDegreeCredential',
          })
        })
        clearDpopNock = setupNockToExpress(upstreamIssuer, upstreamApp)

        const openIdIssuer = await dpopAgent.agent.modules.openid4vc.issuer.createIssuer({
          issuerId,
          credentialConfigurationsSupported: {
            universityDegree: universityDegreeCredentialConfigurationSupported,
          },
          authorizationServerConfigs: [
            createDpopConfig({
              issuer: upstreamIssuer,
              requireDpop,
              clientAuthentication: {
                type: 'clientSecret',
                clientId: 'upstream-client',
                clientSecret: 'upstream-secret',
              },
              scopesMapping: {
                UniversityDegreeCredential: ['MappedUniversityDegreeCredential'],
              },
            }),
          ],
        })
        const { issuanceSession } = await dpopAgent.agent.modules.openid4vc.issuer.createCredentialOffer({
          issuerId: openIdIssuer.issuerId,
          credentialConfigurationIds: ['universityDegree'],
          authorizationCodeFlowConfig: {
            authorizationServerUrl: upstreamIssuer,
          },
        })

        const pushedAuthorizationResponse = await fetch(`http://localhost:3000/oid4vci/${issuerId}/par`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'wallet-client',
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: 'UniversityDegreeCredential',
            state: 'wallet-state',
            issuer_state: issuanceSession.authorization?.issuerState,
            code_challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            code_challenge_method: 'S256',
          }),
        })
        expect(pushedAuthorizationResponse.status).toBe(201)
        const sessionAfterAuthorization = await dpopAgent.agent.modules.openid4vc.issuer.getIssuanceSessionById(
          issuanceSession.id
        )
        expect(sessionAfterAuthorization.chainedIdentity?.chainedAuthorizationServerDpop?.nonce).toBe(nonce)
        if (!authorizationChallengeState || !authorizationChallengeRedirectUri) {
          throw new Error('Expected the upstream authorization challenge request to be sent')
        }

        const upstreamRedirect = new URL(authorizationChallengeRedirectUri)
        upstreamRedirect.searchParams.set('state', authorizationChallengeState)
        upstreamRedirect.searchParams.set('code', 'upstream-authorization-code')
        const tokenExchangeResponse = await fetch(upstreamRedirect, { redirect: 'manual' })

        expect(tokenExchangeResponse.status, await tokenExchangeResponse.clone().text()).toBe(302)
        expect(tokenProofs).toHaveLength(1)
        const issuerRedirectLocation = tokenExchangeResponse.headers.get('location')
        if (!issuerRedirectLocation) throw new Error('Expected the issuer to redirect the authorization response')
        const issuerRedirect = new URL(issuerRedirectLocation)
        const dpopTokenResponse = tokenType.toLowerCase() === 'dpop'
        const shouldReject =
          !dpopTokenResponse ||
          mismatchedJkt ||
          (opaqueAccessToken && (!introspectionAvailable || !introspectionHasJkt || !introspectionActive))
        if (!dpopTokenResponse) {
          expect(issuerRedirect.searchParams.get('error')).toBe('server_error')
          expect(issuerRedirect.searchParams.get('error_description')).toBe(
            'Upstream authorization server did not return a DPoP-bound access token.'
          )
        } else if (shouldReject) {
          expect(issuerRedirect.searchParams.get('error')).toBe('server_error')
          expect(issuerRedirect.searchParams.get('error_description')).toBe(
            'Unable to verify upstream DPoP-bound access token.'
          )
        } else {
          expect(issuerRedirect.searchParams.get('code')).toEqual(expect.any(String))
        }

        const sessionAfterTokenExchange = await dpopAgent.agent.modules.openid4vc.issuer.getIssuanceSessionById(
          issuanceSession.id
        )
        expect(sessionAfterTokenExchange.chainedIdentity?.chainedAuthorizationServerDpop?.nonce).toBe(
          shouldReject ? nonce : undefined
        )
      }
    )

    describe('stable session keys', () => {
      let upstreamMetadata: AuthorizationServerMetadata
      let sessionIssuer: OpenId4VcIssuerRecord
      let clearUpstreamNock: () => void

      beforeEach(async () => {
        upstreamMetadata = {
          ...upstreamAuthorizationServerMetadata,
          authorization_endpoint: 'https://upstream.example.com/authorize',
        }
        const upstreamApp = express()
        upstreamApp.get('/.well-known/oauth-authorization-server', (_req, res) => res.json(upstreamMetadata))
        clearUpstreamNock = setupNockToExpress(upstreamMetadata.issuer, upstreamApp)
        sessionIssuer = await dpopAgent.agent.modules.openid4vc.issuer.createIssuer({
          credentialConfigurationsSupported: {
            universityDegree: universityDegreeCredentialConfigurationSupported,
          },
          authorizationServerConfigs: [
            createDpopConfig({ scopesMapping: { UniversityDegreeCredential: ['UniversityDegreeCredential'] } }),
          ],
        })
        dpopAgent.agent.context.resolve(OpenId4VcIssuerModuleConfig).getDynamicIssuanceSession = async () => ({
          authorizationFlow: 'chained',
          authorizationServerUrl: upstreamMetadata.issuer,
          credentialConfigurationIds: ['universityDegree'],
        })
      })

      afterEach(() => clearUpstreamNock())

      const createSession = async (flow: 'offer' | 'dynamic' = 'offer') => {
        if (flow === 'dynamic') {
          return issuerService.getDynamicIssuanceSession(dpopAgent.agent.context, {
            issuer: sessionIssuer,
            origin: 'pushedAuthorizationRequest',
            supportedAuthorizationFlows: ['chained'],
            requestedScopes: ['UniversityDegreeCredential'],
            requestedCredentialConfigurations: {
              universityDegree: universityDegreeCredentialConfigurationSupported,
            },
            request: tokenRequest,
          })
        }

        const { issuanceSession } = await dpopAgent.agent.modules.openid4vc.issuer.createCredentialOffer({
          issuerId: sessionIssuer.issuerId,
          credentialConfigurationIds: ['universityDegree'],
          authorizationCodeFlowConfig: { authorizationServerUrl: upstreamMetadata.issuer },
        })
        return issuanceSession
      }

      it.each(['offer', 'dynamic'] as const)(
        'persists a unique key at %s session creation and reuses it across concurrent requests',
        async (flow) => {
          const sessions = await Promise.all([createSession(flow), createSession(flow)])
          const keys = sessions.map((session) => session.chainedIdentity?.chainedAuthorizationServerDpop)
          expect(keys[0]).toMatchObject({ keyId: expect.any(String), keyGeneratedForSession: true })
          expect(keys[1]?.keyId).not.toBe(keys[0]?.keyId)

          const createKey = vi.spyOn(dpopAgent.agent.kms, 'createKeyForSignatureAlgorithm')
          const createDpopOptions = vi.spyOn(issuerService, 'createChainedAuthorizationServerDpopOptions')
          const results = await Promise.all(
            sessions.flatMap((session) =>
              [0, 1].map(async () => {
                const persisted = await dpopAgent.agent.modules.openid4vc.issuer.getIssuanceSessionById(session.id)
                expect(persisted.chainedIdentity?.chainedAuthorizationServerDpop).toEqual(
                  session.chainedIdentity?.chainedAuthorizationServerDpop
                )
                return issuerService.getChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
                  issuanceSession: persisted,
                  chainedAuthorizationServerConfig: createDpopConfig(),
                  authorizationServerMetadata: upstreamMetadata,
                })
              })
            )
          )
          expect(results.map((result) => result.session?.keyId)).toEqual([
            keys[0]?.keyId,
            keys[0]?.keyId,
            keys[1]?.keyId,
            keys[1]?.keyId,
          ])
          expect(createKey).not.toHaveBeenCalled()
          expect(createDpopOptions).not.toHaveBeenCalled()
        }
      )

      it('keeps the creation-time key through PAR even if the configured key changes', async () => {
        const issuanceSession = await createSession()
        const originalDpop = issuanceSession.chainedIdentity?.chainedAuthorizationServerDpop
        expect(originalDpop).toBeDefined()
        const rotatedKey = await dpopAgent.agent.kms.createKeyForSignatureAlgorithm({ algorithm: 'ES256' })
        await dpopAgent.agent.modules.openid4vc.issuer.updateIssuerMetadata({
          issuerId: sessionIssuer.issuerId,
          credentialConfigurationsSupported: sessionIssuer.credentialConfigurationsSupported,
          authorizationServerConfigs: [
            createDpopConfig({
              dpop: { keyId: rotatedKey.keyId },
              scopesMapping: { UniversityDegreeCredential: ['UniversityDegreeCredential'] },
            }),
          ],
        })
        const createKey = vi.spyOn(dpopAgent.agent.kms, 'createKeyForSignatureAlgorithm')

        const response = await fetch(`http://localhost:3000/oid4vci/${sessionIssuer.issuerId}/par`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'wallet',
            response_type: 'code',
            redirect_uri: 'http://localhost:5757/redirect',
            scope: 'UniversityDegreeCredential',
            issuer_state: issuanceSession.authorization?.issuerState,
            code_challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            code_challenge_method: 'S256',
          }),
        })
        expect(response.status, await response.clone().text()).toBe(201)
        const persisted = await dpopAgent.agent.modules.openid4vc.issuer.getIssuanceSessionById(issuanceSession.id)
        expect(persisted.chainedIdentity?.chainedAuthorizationServerDpop).toEqual(originalDpop)
        expect(createKey).not.toHaveBeenCalled()

        const newSession = await createSession()
        expect(newSession.chainedIdentity?.chainedAuthorizationServerDpop).toMatchObject({
          keyId: rotatedKey.keyId,
          keyGeneratedForSession: false,
        })
      })

      it.each(['offer', 'dynamic'] as const)(
        'deletes the generated key if saving a new %s session fails',
        async (flow) => {
          const repository = dpopAgent.agent.context.resolve(OpenId4VcIssuanceSessionRepository)
          const saveError = new Error('Session save failed')
          vi.spyOn(repository, 'save').mockRejectedValueOnce(saveError)
          const createKey = vi.spyOn(dpopAgent.agent.kms, 'createKeyForSignatureAlgorithm')
          const deleteKey = vi.spyOn(dpopAgent.agent.kms, 'deleteKey')

          await expect(createSession(flow)).rejects.toBe(saveError)
          expect(createKey).toHaveBeenCalledTimes(1)
          const key = await createKey.mock.results[0].value
          expect(deleteKey).toHaveBeenCalledExactlyOnceWith({ keyId: key.keyId })
          await expect(dpopAgent.agent.kms.getPublicKey({ keyId: key.keyId })).rejects.toThrow()
        }
      )

      it('retains a configured key if saving the new session fails', async () => {
        const key = await dpopAgent.agent.kms.createKeyForSignatureAlgorithm({ algorithm: 'ES256' })
        await dpopAgent.agent.modules.openid4vc.issuer.updateIssuerMetadata({
          issuerId: sessionIssuer.issuerId,
          credentialConfigurationsSupported: sessionIssuer.credentialConfigurationsSupported,
          authorizationServerConfigs: [
            createDpopConfig({
              dpop: { keyId: key.keyId },
              scopesMapping: { UniversityDegreeCredential: ['UniversityDegreeCredential'] },
            }),
          ],
        })
        const repository = dpopAgent.agent.context.resolve(OpenId4VcIssuanceSessionRepository)
        const saveError = new Error('Session save failed')
        vi.spyOn(repository, 'save').mockRejectedValueOnce(saveError)
        const deleteKey = vi.spyOn(dpopAgent.agent.kms, 'deleteKey')

        await expect(createSession()).rejects.toBe(saveError)
        expect(deleteKey).not.toHaveBeenCalled()
        await expect(dpopAgent.agent.kms.getPublicKey({ keyId: key.keyId })).resolves.toBeDefined()
      })

      it('reports cleanup failure without hiding the session save error', async () => {
        const repository = dpopAgent.agent.context.resolve(OpenId4VcIssuanceSessionRepository)
        const saveError = new Error('Session save failed')
        const cleanupError = new Error('Key deletion failed')
        vi.spyOn(repository, 'save').mockRejectedValueOnce(saveError)
        vi.spyOn(dpopAgent.agent.kms, 'deleteKey').mockRejectedValueOnce(cleanupError)
        const logError = vi.spyOn(dpopAgent.agent.context.config.logger, 'error')

        await expect(createSession()).rejects.toBe(saveError)
        expect(logError).toHaveBeenCalledWith('Failed to delete DPoP key after issuance session creation failed', {
          keyId: expect.any(String),
          error: cleanupError,
        })
      })

      it.each(['missing key', 'unsupported algorithm', 'missing DPoP support'] as const)(
        'fails without replacing the session key after %s',
        async (failure) => {
          const issuanceSession = await createSession()
          const originalDpop = issuanceSession.chainedIdentity?.chainedAuthorizationServerDpop
          if (!originalDpop) throw new Error('Expected generated chained DPoP metadata')
          if (failure === 'missing key') {
            await dpopAgent.agent.kms.deleteKey({ keyId: originalDpop.keyId })
          } else if (failure === 'unsupported algorithm') {
            upstreamMetadata.dpop_signing_alg_values_supported = ['EdDSA']
          } else {
            upstreamMetadata.dpop_signing_alg_values_supported = undefined
          }
          const createKey = vi.spyOn(dpopAgent.agent.kms, 'createKeyForSignatureAlgorithm')

          await expect(
            issuerService.getChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
              issuanceSession,
              chainedAuthorizationServerConfig: createDpopConfig(),
              authorizationServerMetadata: upstreamMetadata,
            })
          ).rejects.toThrow()
          expect(createKey).not.toHaveBeenCalled()
          const persisted = await dpopAgent.agent.modules.openid4vc.issuer.getIssuanceSessionById(issuanceSession.id)
          expect(persisted.chainedIdentity?.chainedAuthorizationServerDpop).toEqual(originalDpop)
        }
      )

      it('does not generate a key during requests for a session created without DPoP support', async () => {
        upstreamMetadata.dpop_signing_alg_values_supported = undefined
        const issuanceSession = await createSession()
        expect(issuanceSession.chainedIdentity?.chainedAuthorizationServerDpop).toBeUndefined()
        const createKey = vi.spyOn(dpopAgent.agent.kms, 'createKeyForSignatureAlgorithm')

        await expect(
          issuerService.getChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
            issuanceSession,
            chainedAuthorizationServerConfig: createDpopConfig(),
            authorizationServerMetadata: upstreamMetadata,
          })
        ).resolves.toEqual({})
        await expect(
          issuerService.getChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
            issuanceSession,
            chainedAuthorizationServerConfig: createDpopConfig(),
            authorizationServerMetadata: upstreamAuthorizationServerMetadata,
          })
        ).rejects.toThrow('Chained DPoP key was not initialized during issuance session creation.')
        expect(createKey).not.toHaveBeenCalled()
      })

      it('fails session creation before saving when required DPoP is unavailable', async () => {
        upstreamMetadata.dpop_signing_alg_values_supported = undefined
        await dpopAgent.agent.modules.openid4vc.issuer.updateIssuerMetadata({
          issuerId: sessionIssuer.issuerId,
          credentialConfigurationsSupported: sessionIssuer.credentialConfigurationsSupported,
          authorizationServerConfigs: [
            createDpopConfig({
              requireDpop: true,
              scopesMapping: { UniversityDegreeCredential: ['UniversityDegreeCredential'] },
            }),
          ],
        })
        const repository = dpopAgent.agent.context.resolve(OpenId4VcIssuanceSessionRepository)
        const save = vi.spyOn(repository, 'save')
        const createKey = vi.spyOn(dpopAgent.agent.kms, 'createKeyForSignatureAlgorithm')

        await expect(createSession()).rejects.toThrow('Authorization server does not support DPoP.')
        expect(save).not.toHaveBeenCalled()
        expect(createKey).not.toHaveBeenCalled()
      })
    })

    it('creates a DPoP proof that the chained authorization server can verify', async () => {
      const result = await issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
        issuanceSession: createDpopIssuanceSession(),
        chainedAuthorizationServerConfig: createDpopConfig(),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })

      expect(result.dpop).toBeDefined()
      const jwkThumbprint = result.session?.jwkThumbprint
      expect(jwkThumbprint).toBeDefined()
      expect(result.session?.keyGeneratedForSession).toBe(true)
      if (!result.dpop) throw new Error('Expected DPoP options')

      const headers = await createDpopHeadersForRequest({
        request: tokenRequest,
        signer: result.dpop.signer,
        callbacks: getOid4vcCallbacks(dpopAgent.agent.context),
        nonce: result.dpop.nonce,
      })
      const verified = await new Oauth2AuthorizationServer({
        callbacks: getOid4vcCallbacks(dpopAgent.agent.context),
      }).verifyDpopJwt({
        dpopJwt: headers.DPoP,
        request: tokenRequest,
        allowedSigningAlgs: [Kms.KnownJwaSignatureAlgorithms.ES256],
      })

      expect(verified.jwkThumbprint).toBe(jwkThumbprint)
      expect(verified.payload.htm).toBe('POST')
      expect(verified.payload.htu).toBe('https://upstream.example.com/token')
    })

    it('reuses the configured DPoP key across chained requests', async () => {
      const key = await dpopAgent.agent.kms.createKeyForSignatureAlgorithm({
        algorithm: Kms.KnownJwaSignatureAlgorithms.ES256,
      })
      const result = await issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
        issuanceSession: createDpopIssuanceSession(),
        chainedAuthorizationServerConfig: createDpopConfig({
          dpop: { keyId: key.keyId },
        }),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })

      expect(result.session?.keyId).toBe(key.keyId)
      expect(result.session?.keyGeneratedForSession).toBe(false)
    })

    it('uses a rotated configured key for new sessions while retaining existing session keys', async () => {
      const issuanceSession = createDpopIssuanceSession()
      const originalDpop = await issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
        issuanceSession,
        chainedAuthorizationServerConfig: createDpopConfig(),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })
      if (!originalDpop.session) throw new Error('Expected generated chained DPoP metadata')
      if (!issuanceSession.chainedIdentity) throw new Error('Expected chained identity metadata')
      issuanceSession.chainedIdentity.chainedAuthorizationServerDpop = originalDpop.session

      const rotatedKey = await dpopAgent.agent.kms.createKeyForSignatureAlgorithm({
        algorithm: Kms.KnownJwaSignatureAlgorithms.ES256,
      })
      const rotatedConfig = createDpopConfig({
        dpop: { keyId: rotatedKey.keyId },
      })
      const existingSessionOptions = await issuerService.getChainedAuthorizationServerDpopOptions(
        dpopAgent.agent.context,
        {
          issuanceSession,
          chainedAuthorizationServerConfig: rotatedConfig,
          authorizationServerMetadata: upstreamAuthorizationServerMetadata,
        }
      )
      const newSessionOptions = await issuerService.createChainedAuthorizationServerDpopOptions(
        dpopAgent.agent.context,
        {
          issuanceSession: createDpopIssuanceSession(),
          chainedAuthorizationServerConfig: rotatedConfig,
          authorizationServerMetadata: upstreamAuthorizationServerMetadata,
        }
      )

      expect(existingSessionOptions.session?.keyId).toBe(originalDpop.session.keyId)
      expect(newSessionOptions.session?.keyId).toBe(rotatedKey.keyId)
    })

    it('creates a unique chained DPoP key per session and deletes it with that session', async () => {
      const issuanceSessions = [createDpopIssuanceSession(), createDpopIssuanceSession()]
      const dpopOptions = await Promise.all(
        issuanceSessions.map((issuanceSession) =>
          issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
            issuanceSession,
            chainedAuthorizationServerConfig: createDpopConfig(),
            authorizationServerMetadata: upstreamAuthorizationServerMetadata,
          })
        )
      )
      for (const [index, { session }] of dpopOptions.entries()) {
        if (!session) throw new Error('Expected generated chained DPoP metadata')
        const issuanceSession = issuanceSessions[index]
        if (!issuanceSession.chainedIdentity) throw new Error('Expected chained identity metadata')
        issuanceSession.chainedIdentity.chainedAuthorizationServerDpop = session
      }

      const repository = dpopAgent.agent.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
      await Promise.all(
        issuanceSessions.map((issuanceSession) => repository.save(dpopAgent.agent.context, issuanceSession))
      )

      const firstDpop = dpopOptions[0].session
      const secondDpop = dpopOptions[1].session
      if (!firstDpop || !secondDpop) throw new Error('Expected generated chained DPoP metadata')
      expect(firstDpop.keyId).not.toBe(secondDpop.keyId)

      const findByQuery = vi.spyOn(repository, 'findByQuery')
      await issuerService.deleteIssuanceSessionById(dpopAgent.agent.context, issuanceSessions[0].id)

      expect(findByQuery).not.toHaveBeenCalled()
      await expect(dpopAgent.agent.kms.getPublicKey({ keyId: firstDpop.keyId })).rejects.toThrow()
      await expect(dpopAgent.agent.kms.getPublicKey({ keyId: secondDpop.keyId })).resolves.toBeDefined()
    })

    it('keeps a generated chained DPoP key when deleteChainedDpopKey is false', async () => {
      const issuanceSession = createDpopIssuanceSession()
      const dpop = await issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
        issuanceSession,
        chainedAuthorizationServerConfig: createDpopConfig(),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })
      if (!dpop.session) throw new Error('Expected generated chained DPoP metadata')
      expect(dpop.session.keyGeneratedForSession).toBe(true)

      if (!issuanceSession.chainedIdentity) throw new Error('Expected chained identity metadata')
      issuanceSession.chainedIdentity.chainedAuthorizationServerDpop = dpop.session
      const repository = dpopAgent.agent.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
      await repository.save(dpopAgent.agent.context, issuanceSession)

      await issuerService.deleteIssuanceSessionById(dpopAgent.agent.context, issuanceSession.id, {
        deleteChainedDpopKey: false,
      })

      await expect(repository.findById(dpopAgent.agent.context, issuanceSession.id)).resolves.toBeNull()
      await expect(dpopAgent.agent.kms.getPublicKey({ keyId: dpop.session.keyId })).resolves.toBeDefined()
    })

    it('does not delete a configured chained DPoP key with its session', async () => {
      const key = await dpopAgent.agent.kms.createKeyForSignatureAlgorithm({
        algorithm: Kms.KnownJwaSignatureAlgorithms.ES256,
      })
      const issuanceSession = createDpopIssuanceSession()
      const dpop = await issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
        issuanceSession,
        chainedAuthorizationServerConfig: createDpopConfig({
          dpop: { keyId: key.keyId },
        }),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })
      if (!dpop.session) throw new Error('Expected configured chained DPoP metadata')
      expect(dpop.session.keyGeneratedForSession).toBe(false)

      if (!issuanceSession.chainedIdentity) throw new Error('Expected chained identity metadata')
      issuanceSession.chainedIdentity.chainedAuthorizationServerDpop = dpop.session
      const repository = dpopAgent.agent.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
      await repository.save(dpopAgent.agent.context, issuanceSession)

      await issuerService.deleteIssuanceSessionById(dpopAgent.agent.context, issuanceSession.id)

      await expect(dpopAgent.agent.kms.getPublicKey({ keyId: key.keyId })).resolves.toBeDefined()
    })

    it('fails when the upstream supports DPoP but Credo has no compatible algorithm', async () => {
      await expect(
        issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
          issuanceSession: createDpopIssuanceSession(),
          chainedAuthorizationServerConfig: createDpopConfig({
            requireDpop: false,
            dpop: {
              // Upstream only advertises ES256
              signingAlgValuesSupported: [Kms.KnownJwaSignatureAlgorithms.EdDSA],
            },
          }),
          authorizationServerMetadata: upstreamAuthorizationServerMetadata,
        })
      ).rejects.toThrow('No supported dpop signature algorithms')
    })

    it('fails when the upstream advertises DPoP without signing algorithms', async () => {
      await expect(
        issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
          issuanceSession: createDpopIssuanceSession(),
          chainedAuthorizationServerConfig: createDpopConfig(),
          authorizationServerMetadata: {
            ...upstreamAuthorizationServerMetadata,
            dpop_signing_alg_values_supported: [],
          },
        })
      ).rejects.toThrow('Authorization server advertises DPoP support without any signing algorithms.')
    })

    it('allows optional DPoP downgrade when the upstream does not advertise support', async () => {
      const result = await issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
        issuanceSession: createDpopIssuanceSession(),
        chainedAuthorizationServerConfig: createDpopConfig(),
        authorizationServerMetadata: {
          issuer: upstreamAuthorizationServerMetadata.issuer,
          token_endpoint: upstreamAuthorizationServerMetadata.token_endpoint,
        } as AuthorizationServerMetadata,
      })

      expect(result.dpop).toBeUndefined()
      expect(result.session).toBeUndefined()
    })

    it('requires DPoP when configured and the upstream does not advertise support', async () => {
      await expect(
        issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
          issuanceSession: createDpopIssuanceSession(),
          chainedAuthorizationServerConfig: createDpopConfig({ requireDpop: true }),
          authorizationServerMetadata: {
            issuer: upstreamAuthorizationServerMetadata.issuer,
            token_endpoint: upstreamAuthorizationServerMetadata.token_endpoint,
          } as AuthorizationServerMetadata,
        })
      ).rejects.toThrow('Authorization server does not support DPoP')
    })

    it('does not silently fall back when a configured DPoP key cannot be resolved', async () => {
      await expect(
        issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
          issuanceSession: createDpopIssuanceSession(),
          chainedAuthorizationServerConfig: createDpopConfig({
            dpop: { keyId: 'missing-key' },
          }),
          authorizationServerMetadata: upstreamAuthorizationServerMetadata,
        })
      ).rejects.toThrow("Key with key id 'missing-key' not found")
    })

    it('carries the persisted nonce into the next upstream DPoP request', async () => {
      const session = createDpopIssuanceSession({
        chainedAuthorizationServerDpop: {
          keyId: 'persisted-key',
          alg: Kms.KnownJwaSignatureAlgorithms.ES256,
          jwkThumbprint: 'persisted-thumbprint',
          nonce: 'upstream-nonce',
        },
      })
      const key = await dpopAgent.agent.kms.createKeyForSignatureAlgorithm({
        algorithm: Kms.KnownJwaSignatureAlgorithms.ES256,
      })
      const chainedAuthorizationServerDpop = session.chainedIdentity?.chainedAuthorizationServerDpop
      if (!chainedAuthorizationServerDpop) throw new Error('Expected persisted chained DPoP metadata')
      chainedAuthorizationServerDpop.keyId = key.keyId

      const result = await issuerService.getChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
        issuanceSession: session,
        chainedAuthorizationServerConfig: createDpopConfig(),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })

      expect(result.dpop?.nonce).toBe('upstream-nonce')
    })

    it('retries a nonce challenge with a fresh nonce-bound proof', async () => {
      const nonce = 'upstream-retry-nonce'
      const seenJtis = new Set<string>()
      const proofs: string[] = []
      let requestCount = 0
      const upstreamApp = express()
      const upstreamServer = new Oauth2AuthorizationServer({
        callbacks: getOid4vcCallbacks(dpopAgent.agent.context),
      })

      upstreamApp.post('/token', async (req, res) => {
        requestCount += 1
        const proof = req.header('DPoP')
        if (!proof) return res.status(400).json({ error: 'invalid_dpop_proof' })
        proofs.push(proof)

        try {
          const verification = await upstreamServer.verifyDpopJwt({
            dpopJwt: proof,
            request: {
              headers: new Headers(),
              method: 'POST',
              url: 'http://localhost:4748/token',
            },
            expectedNonce: requestCount === 1 ? undefined : nonce,
          })

          if (seenJtis.has(verification.payload.jti)) {
            return res.status(400).json({
              error: 'invalid_dpop_proof',
              error_description: 'DPoP proof replayed',
            })
          }
          seenJtis.add(verification.payload.jti)

          if (requestCount === 1) {
            return res.status(400).set('DPoP-Nonce', nonce).json({ error: 'use_dpop_nonce' })
          }

          return res.json({
            access_token: `token-${verification.jwkThumbprint}`,
            token_type: 'DPoP',
            expires_in: 300,
          })
        } catch (error) {
          return res.status(400).json({
            error: 'invalid_dpop_proof',
            error_description: error instanceof Error ? error.message : 'Invalid DPoP proof',
          })
        }
      })
      const clearUpstreamNock = setupNockToExpress('http://localhost:4748', upstreamApp)

      try {
        const result = await issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
          issuanceSession: createDpopIssuanceSession(),
          chainedAuthorizationServerConfig: createDpopConfig(),
          authorizationServerMetadata: {
            ...upstreamAuthorizationServerMetadata,
            issuer: 'http://localhost:4748',
            token_endpoint: 'http://localhost:4748/token',
          },
        })
        const tokenResponse = await new Oauth2Client({
          callbacks: {
            ...getOid4vcCallbacks(dpopAgent.agent.context),
            clientAuthentication: clientAuthenticationDynamic({
              clientId: 'client',
              clientSecret: 'secret',
            }),
          },
        }).retrieveAuthorizationCodeAccessToken({
          authorizationCode: 'authorization-code',
          authorizationServerMetadata: {
            ...upstreamAuthorizationServerMetadata,
            issuer: 'http://localhost:4748',
            token_endpoint: 'http://localhost:4748/token',
          },
          dpop: result.dpop,
        })

        expect(tokenResponse.accessTokenResponse.token_type).toBe('DPoP')
        expect(requestCount).toBe(2)
        expect(proofs).toHaveLength(2)
        expect(proofs[0]).not.toBe(proofs[1])
      } finally {
        clearUpstreamNock()
      }
    })

    it('rejects a replayed DPoP proof at the upstream verifier', async () => {
      const result = await issuerService.createChainedAuthorizationServerDpopOptions(dpopAgent.agent.context, {
        issuanceSession: createDpopIssuanceSession(),
        chainedAuthorizationServerConfig: createDpopConfig(),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })
      if (!result.dpop) throw new Error('Expected DPoP options')

      const proof = (
        await createDpopHeadersForRequest({
          request: tokenRequest,
          signer: result.dpop.signer,
          callbacks: getOid4vcCallbacks(dpopAgent.agent.context),
        })
      ).DPoP
      const seenJtis = new Set<string>()
      const upstreamServer = new Oauth2AuthorizationServer({
        callbacks: getOid4vcCallbacks(dpopAgent.agent.context),
      })
      const verify = async () => {
        const verification = await upstreamServer.verifyDpopJwt({
          dpopJwt: proof,
          request: tokenRequest,
        })
        if (seenJtis.has(verification.payload.jti)) throw new Error('DPoP proof replayed')
        seenJtis.add(verification.payload.jti)
        return verification
      }

      await verify()
      await expect(verify()).rejects.toThrow('DPoP proof replayed')
    })
  })
})

function createDpopConfig(
  overrides: Partial<OpenId4VciChainedAuthorizationServerConfig> = {}
): OpenId4VciChainedAuthorizationServerConfig {
  return {
    type: 'chained',
    issuer: 'https://upstream.example.com',
    clientAuthentication: {
      type: 'clientSecret',
      clientId: 'client',
      clientSecret: 'secret',
    },
    ...overrides,
  }
}

function createDpopIssuanceSession(
  chainedIdentity: Partial<OpenId4VcIssuanceSessionChainedIdentity> = {}
): OpenId4VcIssuanceSessionRecord {
  return new OpenId4VcIssuanceSessionRecord({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    issuerId: 'issuer',
    state: OpenId4VcIssuanceSessionState.AuthorizationInitiated,
    credentialOfferId: 'offer',
    credentialOfferPayload: {
      credential_issuer: 'https://issuer.example.com',
      credential_configuration_ids: [],
    },
    openId4VciVersion: 'v1',
    chainedIdentity: {
      externalAuthorizationServerUrl: 'https://upstream.example.com',
      ...chainedIdentity,
    },
  })
}

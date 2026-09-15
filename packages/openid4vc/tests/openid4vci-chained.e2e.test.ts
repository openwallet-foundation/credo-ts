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
import type { OpenId4VcIssuerModuleConfigOptions, OpenId4VciCredentialRequestToCredentialMapper } from '../src'
import { OpenId4VcIssuanceSessionState, OpenId4VcModule } from '../src'
import type { OpenId4VciCredentialBindingResolver } from '../src/openid4vc-holder'
import { OpenId4VcIssuerService } from '../src/openid4vc-issuer/OpenId4VcIssuerService'
import type { OpenId4VcIssuanceSessionChainedIdentity } from '../src/openid4vc-issuer/repository'
import { OpenId4VcIssuanceSessionRecord } from '../src/openid4vc-issuer/repository'
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

    await issuer.agent.shutdown()
    await holder.agent.shutdown()
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
      if (!authorizationHeader || authorizationHeader[0] !== 'Basic' || authorizationHeader.length !== 2) {
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
          dpop: {
            required: true,
          },
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
      issuanceSessionId,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    const firstSdJwtVcTenant1 = (credentialResponse.credentials[0].record as SdJwtVcRecord).firstCredential
    expect(firstSdJwtVcTenant1.payload.vct).toEqual('UniversityDegreeCredential')
    expect(firstSdJwtVcTenant1.payload.name).toEqual('John Doe')

    await holderTenant.endSession()

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
      if (!authorizationHeader || authorizationHeader[0] !== 'Basic' || authorizationHeader.length !== 2) {
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

    const idpApp = express()
    idpApp.get('/.well-known/oauth-authorization-server', (_req, res) =>
      res.json({
        issuer: 'http://localhost:4747',
        authorization_endpoint: 'http://localhost:4747/authorize',
        token_endpoint: 'http://localhost:4747/token',
      } satisfies AuthorizationServerMetadata)
    )
    const clearIdpNock = setupNockToExpress('http://localhost:4747', idpApp)

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

  describe('upstream DPoP', () => {
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

    beforeEach(async () => {
      dpopAgent = (await createAgentFromModules(
        {
          inMemory: new InMemoryWalletModule(),
          openid4vc: new OpenId4VcModule({
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
    })

    afterEach(async () => {
      await dpopAgent.agent.shutdown()
    })

    it('creates a DPoP proof that an upstream authorization server can verify', async () => {
      const result = await issuerService.getChainedUpstreamDpopRequestOptions(dpopAgent.agent.context, {
        issuanceSession: createDpopIssuanceSession(),
        chainedAuthorizationServerConfig: createDpopConfig(),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })

      expect(result.dpop).toBeDefined()
      expect(result.session?.jwkThumbprint).toBe(result.jwkThumbprint)
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

      expect(verified.jwkThumbprint).toBe(result.jwkThumbprint)
      expect(verified.payload.htm).toBe('POST')
      expect(verified.payload.htu).toBe('https://upstream.example.com/token')
    })

    it('reuses the configured DPoP key across chained requests', async () => {
      const key = await dpopAgent.agent.kms.createKeyForSignatureAlgorithm({
        algorithm: Kms.KnownJwaSignatureAlgorithms.ES256,
      })
      const result = await issuerService.getChainedUpstreamDpopRequestOptions(dpopAgent.agent.context, {
        issuanceSession: createDpopIssuanceSession(),
        chainedAuthorizationServerConfig: createDpopConfig({
          dpop: { required: false, keyId: key.keyId },
        }),
        authorizationServerMetadata: upstreamAuthorizationServerMetadata,
      })

      expect(result.keyId).toBe(key.keyId)
      expect(result.session?.keyId).toBe(key.keyId)
    })

    it('fails closed when required DPoP has no compatible upstream algorithm', async () => {
      await expect(
        issuerService.getChainedUpstreamDpopRequestOptions(dpopAgent.agent.context, {
          issuanceSession: createDpopIssuanceSession(),
          chainedAuthorizationServerConfig: createDpopConfig({
            dpop: {
              required: true,
              // Upstream only advertises ES256
              allowedAlgorithms: [Kms.KnownJwaSignatureAlgorithms.EdDSA],
            },
          }),
          authorizationServerMetadata: upstreamAuthorizationServerMetadata,
        })
      ).rejects.toThrow('No supported dpop signature algorithms')
    })

    it('allows optional DPoP downgrade when the upstream does not advertise support', async () => {
      const result = await issuerService.getChainedUpstreamDpopRequestOptions(dpopAgent.agent.context, {
        issuanceSession: createDpopIssuanceSession(),
        chainedAuthorizationServerConfig: createDpopConfig(),
        authorizationServerMetadata: {
          issuer: upstreamAuthorizationServerMetadata.issuer,
          token_endpoint: upstreamAuthorizationServerMetadata.token_endpoint,
        } as AuthorizationServerMetadata,
      })

      expect(result.required).toBe(false)
      expect(result.dpop).toBeUndefined()
      expect(result.session).toBeUndefined()
    })

    it('carries the persisted nonce into the next upstream DPoP request', async () => {
      const session = createDpopIssuanceSession({
        upstreamDpop: {
          keyId: 'persisted-key',
          alg: Kms.KnownJwaSignatureAlgorithms.ES256,
          jwkThumbprint: 'persisted-thumbprint',
          nonce: 'upstream-nonce',
        },
      })
      const key = await dpopAgent.agent.kms.createKeyForSignatureAlgorithm({
        algorithm: Kms.KnownJwaSignatureAlgorithms.ES256,
      })
      const upstreamDpop = session.chainedIdentity?.upstreamDpop
      if (!upstreamDpop) throw new Error('Expected persisted upstream DPoP metadata')
      upstreamDpop.keyId = key.keyId

      const result = await issuerService.getChainedUpstreamDpopRequestOptions(dpopAgent.agent.context, {
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
        const result = await issuerService.getChainedUpstreamDpopRequestOptions(dpopAgent.agent.context, {
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
      const result = await issuerService.getChainedUpstreamDpopRequestOptions(dpopAgent.agent.context, {
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

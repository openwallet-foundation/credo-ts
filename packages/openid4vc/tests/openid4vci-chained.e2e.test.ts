import type { SdJwtVcRecord } from '@credo-ts/core'
import { CredoError, DidsApi, JwsService, JwtPayload, Kms, TypedArrayEncoder, utils } from '@credo-ts/core'
import type { AuthorizationServerMetadata, Jwk, JwtSigner, SignJwtCallback } from '@openid4vc/oauth2'
import { decodeJwt, jwtHeaderFromJwtSigner, Oauth2AuthorizationServer } from '@openid4vc/oauth2'
import { AuthorizationFlow } from '@openid4vc/openid4vci'
import { randomUUID } from 'crypto'
import express, { type Express } from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { TenantsModule } from '../../tenants/src'
import type { OpenId4VcIssuerModuleConfigOptions, OpenId4VciCredentialRequestToCredentialMapper } from '../src'
import { OpenId4VcIssuanceSessionState, OpenId4VcModule } from '../src'
import type { OpenId4VciCredentialBindingResolver } from '../src/openid4vc-holder'
import { getOid4vcCallbacks } from '../src/shared/callbacks'
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
    idpApp.post('/token', async (req, res) => {
      const authorizationHeader = req.headers.authorization?.split(' ')
      if (!authorizationHeader || authorizationHeader[0] !== 'Basic' || authorizationHeader.length !== 2) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid authorization header',
        })
      }

      if (TypedArrayEncoder.fromBase64(authorizationHeader[1]).toString() !== `${idpClientId}:${idpClientSecret}`) {
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

  it('e2e flow with tenants, issuer endpoints requesting a sd-jwt-vc using authorization code flow, openid, additional parameter, id tokens (callback)', async () => {
    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper,
            getChainedAuthorizationOptionsForIssuanceSessionAuthorization: async () => {
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

      if (TypedArrayEncoder.fromBase64(authorizationHeader[1]).toString() !== `${idpClientId}:${idpClientSecret}`) {
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
})

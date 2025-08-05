import { randomUUID } from 'crypto'
import type { Mdoc, SdJwtVc } from '@credo-ts/core'
import {
  ClaimFormat,
  CredoError,
  DidsApi,
  JwsService,
  Jwt,
  JwtPayload,
  Kms,
  X509Certificate,
  X509Module,
  getPublicJwkFromVerificationMethod,
} from '@credo-ts/core'
import type { AuthorizationServerMetadata, Jwk } from '@openid4vc/oauth2'
import {
  HashAlgorithm,
  Oauth2AuthorizationServer,
  calculateJwkThumbprint,
  preAuthorizedCodeGrantIdentifier,
} from '@openid4vc/oauth2'
import { AuthorizationFlow, CredentialRequest } from '@openid4vc/openid4vci'
import express, { type Express } from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { TenantsModule } from '../../tenants/src'
import type { OpenId4VciSignMdocCredentials, VerifiedOpenId4VcCredentialHolderBinding } from '../src'
import { OpenId4VcHolderModule, OpenId4VcIssuanceSessionState, OpenId4VcIssuerModule } from '../src'
import type { OpenId4VciCredentialBindingResolver } from '../src/openid4vc-holder'
import { getOid4vcCallbacks } from '../src/shared/callbacks'
import type { AgentType, TenantType } from './utils'
import { createAgentFromModules, createTenantForAgent, waitForCredentialIssuanceSessionRecordSubject } from './utils'
import {
  universityDegreeCredentialConfigurationSupported,
  universityDegreeCredentialConfigurationSupportedMdoc,
} from './utilsVci'

const serverPort = 1234
const baseUrl = `http://localhost:${serverPort}`
const issuanceBaseUrl = `${baseUrl}/oid4vci`

describe('OpenId4Vci (Deferred)', () => {
  let expressApp: Express
  let clearNock: () => void

  let issuer: AgentType<{
    openId4VcIssuer: OpenId4VcIssuerModule
    tenants: TenantsModule<{ openId4VcIssuer: OpenId4VcIssuerModule }>
    x509: X509Module
  }>
  let issuer1: TenantType

  let holder: AgentType<{
    openId4VcHolder: OpenId4VcHolderModule
    tenants: TenantsModule<{ openId4VcHolder: OpenId4VcHolderModule }>
  }>
  let holder1: TenantType

  let credentialIssuerCertificate: X509Certificate

  const storage: Record<
    string,
    {
      credentialRequest: CredentialRequest
      holderBinding: VerifiedOpenId4VcCredentialHolderBinding
    }
  > = {}

  beforeEach(async () => {
    expressApp = express()

    issuer = (await createAgentFromModules(
      'issuer',
      {
        x509: new X509Module(),
        inMemory: new InMemoryWalletModule(),
        openId4VcIssuer: new OpenId4VcIssuerModule({
          baseUrl: issuanceBaseUrl,

          credentialRequestToCredentialMapper: async ({ credentialRequest, holderBinding }) => {
            const uuid = randomUUID()

            storage[uuid] = {
              credentialRequest,
              holderBinding,
            }

            return {
              transactionId: uuid,
              interval: 2000,
            }
          },

          deferredCredentialRequestToCredentialMapper: async ({ agentContext, deferredCredentialRequest }) => {
            if (!storage[deferredCredentialRequest.transaction_id]) {
              throw new Error('No credential request found for transaction id')
            }
            const { credentialRequest, holderBinding } = storage[deferredCredentialRequest.transaction_id]

            // We sign the request with the first did:key did we have
            const didsApi = agentContext.dependencyManager.resolve(DidsApi)
            const [firstDidKeyDid] = await didsApi.getCreatedDids({ method: 'key' })
            const didDocument = await didsApi.resolveDidDocument(firstDidKeyDid.did)
            const verificationMethod = didDocument.verificationMethod?.[0]
            if (!verificationMethod) {
              throw new Error('No verification method found')
            }

            if (credentialRequest.format === 'vc+sd-jwt') {
              return {
                format: credentialRequest.format,
                credentials: holderBinding.keys.map((holderBinding) => ({
                  payload: { vct: credentialRequest.vct, university: 'innsbruck', degree: 'bachelor' },
                  holder: holderBinding,
                  issuer: {
                    method: 'did',
                    didUrl: verificationMethod.id,
                  },
                  disclosureFrame: { _sd: ['university', 'degree'] },
                })),
              }
            }
            if (credentialRequest.format === 'mso_mdoc') {
              return {
                format: ClaimFormat.MsoMdoc,
                credentials: holderBinding.keys.map((holderBinding) => ({
                  docType: universityDegreeCredentialConfigurationSupportedMdoc.doctype,
                  issuerCertificate: credentialIssuerCertificate,
                  holderKey: holderBinding.jwk,
                  namespaces: {
                    'Leopold-Franzens-University': {
                      degree: 'bachelor',
                    },
                  },
                })),
              } satisfies OpenId4VciSignMdocCredentials
            }
            throw new Error('Invalid request')
          },
        }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g',
      global.fetch
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')

    holder = (await createAgentFromModules(
      'holder',
      {
        openId4VcHolder: new OpenId4VcHolderModule(),
        inMemory: new InMemoryWalletModule(),
        tenants: new TenantsModule(),
        x509: new X509Module({
          trustedCertificates: [
            `-----BEGIN CERTIFICATE-----
MIIBdTCCARugAwIBAgIUHsSmbGuWAVZVXjqoidqAVClGx4YwCgYIKoZIzj0EAwIw
GzEZMBcGA1UEAwwQR2VybWFuIFJlZ2lzdHJhcjAeFw0yNTAzMzAxOTU4NTFaFw0y
NjAzMzAxOTU4NTFaMBsxGTAXBgNVBAMMEEdlcm1hbiBSZWdpc3RyYXIwWTATBgcq
hkjOPQIBBggqhkjOPQMBBwNCAASQWCESFd0Ywm9sK87XxqxDP4wOAadEKgcZFVX7
npe3ALFkbjsXYZJsTGhVp0+B5ZtUao2NsyzJCKznPwTz2wJcoz0wOzAaBgNVHREE
EzARgg9mdW5rZS13YWxsZXQuZGUwHQYDVR0OBBYEFMxnKLkGifbTKrxbGXcFXK6R
FQd3MAoGCCqGSM49BAMCA0gAMEUCIQD4RiLJeuVDrEHSvkPiPfBvMxAXRC6PuExo
pUGCFdfNLQIgHGSa5u5ZqUtCrnMiaEageO71rjzBlov0YUH4+6ELioY=
-----END CERTIFICATE-----`,
          ],
        }),
      },
      '96213c3d7fc8d4d6754c7a0fd969598e',
      global.fetch
    )) as unknown as typeof holder
    holder1 = await createTenantForAgent(holder.agent, 'hTenant1')

    // We let AFJ create the router, so we have a fresh one each time
    expressApp.use('/oid4vci', issuer.agent.modules.openId4VcIssuer.config.router)

    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()

    await issuer.agent.shutdown()
    await holder.agent.shutdown()
  })

  const credentialBindingResolver: OpenId4VciCredentialBindingResolver = ({ supportsJwk, supportedDidMethods }) => {
    // prefer did:key
    if (supportedDidMethods?.includes('did:key')) {
      return {
        method: 'did',
        didUrls: [holder1.verificationMethod.id],
      }
    }

    // otherwise fall back to JWK
    if (supportsJwk) {
      return {
        method: 'jwk',
        keys: [getPublicJwkFromVerificationMethod(holder1.verificationMethod)],
      }
    }

    // otherwise throw an error
    throw new CredoError('Issuer does not support did:key or JWK for credential binding')
  }

  it('e2e flow with tenants, issuer endpoints requesting a sd-jwt-vc using authorization code flow', async () => {
    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })

    const authorizationServerKey = await issuer.agent.kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const authorizationServerJwk = Kms.PublicJwk.fromPublicJwk(authorizationServerKey.publicJwk)
    const authorizationServer = new Oauth2AuthorizationServer({
      callbacks: {
        ...getOid4vcCallbacks(issuer.agent.context),

        signJwt: async (_signer, { header, payload }) => {
          const jwsService = issuer.agent.dependencyManager.resolve(JwsService)
          const compact = await jwsService.createJwsCompact(issuer.agent.context, {
            keyId: authorizationServerKey.keyId,
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
            signerJwk: authorizationServerKey.publicJwk as Jwk,
          }
        },
      },
    })

    const app = express()
    app.get('/.well-known/oauth-authorization-server', (_req, res) =>
      res.json({
        jwks_uri: 'http://localhost:4747/jwks.json',
        issuer: 'http://localhost:4747',
        token_endpoint: 'http://localhost:4747/token',
        authorization_endpoint: 'http://localhost:4747/authorize',
      } satisfies AuthorizationServerMetadata)
    )
    app.get('/jwks.json', (_req, res) =>
      res.setHeader('Content-Type', 'application/jwk-set+json').send(
        JSON.stringify({
          keys: [{ ...authorizationServerJwk.toJson(), kid: 'first' }],
        })
      )
    )
    app.post('/token', async (_req, res) =>
      res.json(
        await authorizationServer.createAccessTokenResponse({
          authorizationServer: 'http://localhost:4747',
          audience: 'http://localhost:1234/oid4vci/8bc91672-6a32-466c-96ec-6efca8760068',
          expiresInSeconds: 5000,
          subject: 'something',
          scope: 'UniversityDegreeCredential',
          additionalAccessTokenPayload: {
            issuer_state: 'dbf99eea-0131-48b0-9022-17f7ebe25ea7',
          },
          signer: {
            method: 'jwk',
            publicJwk: authorizationServerJwk.toJson() as Jwk,
            alg: 'ES256',
          },
        })
      )
    )

    const clearNock = setupNockToExpress('http://localhost:4747', app)

    const openIdIssuerTenant = await issuerTenant.modules.openId4VcIssuer.createIssuer({
      issuerId: '8bc91672-6a32-466c-96ec-6efca8760068',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      authorizationServerConfigs: [
        {
          issuer: 'http://localhost:4747',
        },
      ],
    })

    const { issuanceSession, credentialOffer } = await issuerTenant.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        authorizationServerUrl: 'http://localhost:4747',
        issuerState: 'dbf99eea-0131-48b0-9022-17f7ebe25ea7',
      },
      version: 'v1.draft15',
    })

    await issuerTenant.endSession()

    const resolvedCredentialOffer = await holderTenant.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)
    const resolvedAuthorization = await holderTenant.modules.openId4VcHolder.resolveOpenId4VciAuthorizationRequest(
      resolvedCredentialOffer,
      {
        clientId: 'foo',
        redirectUri: 'http://localhost:1234/redirect',
        scope: ['UniversityDegreeCredential'],
      }
    )
    if (resolvedAuthorization.authorizationFlow === AuthorizationFlow.PresentationDuringIssuance) {
      throw new Error('Not supported')
    }

    // Bind to JWK
    const tokenResponseTenant = await holderTenant.modules.openId4VcHolder.requestToken({
      resolvedCredentialOffer,
      // Mock the authorization code flow part,
      code: 'some-authorization-code',
      clientId: 'foo',
      redirectUri: 'http://localhost:1234/redirect',
      codeVerifier: resolvedAuthorization.codeVerifier,
    })
    const credentialResponse = await holderTenant.modules.openId4VcHolder.requestCredentials({
      resolvedCredentialOffer,
      ...tokenResponseTenant,
      credentialBindingResolver,
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Deferred,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(credentialResponse.deferredCredentials).toHaveLength(1)
    expect(credentialResponse.credentials).toHaveLength(0)
    expect(credentialResponse.deferredCredentials[0].interval).toEqual(2000)

    const deferredCredentialResponse = await holderTenant.modules.openId4VcHolder.requestDeferredCredentials({
      ...tokenResponseTenant,
      ...credentialResponse.deferredCredentials[0],
      issuerMetadata: resolvedCredentialOffer.metadata,
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(deferredCredentialResponse.deferredCredentials).toHaveLength(0)
    expect(deferredCredentialResponse.credentials).toHaveLength(1)

    const compactSdJwtVcTenant1 = (deferredCredentialResponse.credentials[0].credentials[0] as SdJwtVc).compact
    const sdJwtVcTenant1 = holderTenant.sdJwtVc.fromCompact(compactSdJwtVcTenant1)
    expect(sdJwtVcTenant1.payload.vct).toEqual('UniversityDegreeCredential')

    await holderTenant.endSession()
    clearNock()
  })

  it('e2e flow with tenants, issuer endpoints requesting a mdoc', async () => {
    const issuerTenant = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })

    const issuerCertificate = await issuerTenant.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await issuerTenant.kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })).publicJwk
      ),
      issuer: 'C=DE',
    })
    credentialIssuerCertificate = issuerCertificate

    const openIdIssuerTenant = await issuerTenant.modules.openId4VcIssuer.createIssuer({
      dpopSigningAlgValuesSupported: [Kms.KnownJwaSignatureAlgorithms.ES256],
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupportedMdoc,
      },
    })
    const issuer1Record = await issuerTenant.modules.openId4VcIssuer.getIssuerByIssuerId(openIdIssuerTenant.issuerId)
    expect(issuer1Record.dpopSigningAlgValuesSupported).toEqual(['ES256'])

    expect(issuer1Record.credentialConfigurationsSupported).toEqual({
      universityDegree: {
        format: 'mso_mdoc',
        cryptographic_binding_methods_supported: ['did:key', 'jwk'],
        proof_types_supported: {
          jwt: {
            proof_signing_alg_values_supported: ['ES256', 'EdDSA'],
          },
        },
        doctype: universityDegreeCredentialConfigurationSupportedMdoc.doctype,
        scope: universityDegreeCredentialConfigurationSupportedMdoc.scope,
      },
    })

    const { issuanceSession, credentialOffer } = await issuerTenant.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: openIdIssuerTenant.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      preAuthorizedCodeFlowConfig: {},
      version: 'v1.draft15',
    })

    await issuerTenant.endSession()

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.OfferCreated,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    holderTenant.x509.config.setTrustedCertificates([issuerCertificate.toString('pem')])

    const resolvedCredentialOffer = await holderTenant.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)

    expect(resolvedCredentialOffer.metadata.credentialIssuer?.dpop_signing_alg_values_supported).toEqual(['ES256'])
    expect(resolvedCredentialOffer.offeredCredentialConfigurations).toEqual({
      universityDegree: {
        doctype: 'UniversityDegreeCredential',
        cryptographic_binding_methods_supported: ['did:key', 'jwk'],
        format: 'mso_mdoc',
        scope: universityDegreeCredentialConfigurationSupportedMdoc.scope,
        proof_types_supported: {
          jwt: {
            proof_signing_alg_values_supported: ['ES256', 'EdDSA'],
          },
        },
      },
    })

    expect(resolvedCredentialOffer.credentialOfferPayload.credential_issuer).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant.issuerId}`
    )
    expect(resolvedCredentialOffer.metadata.credentialIssuer?.token_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant.issuerId}/token`
    )
    expect(resolvedCredentialOffer.metadata.credentialIssuer?.credential_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant.issuerId}/credential`
    )
    expect(resolvedCredentialOffer.metadata.credentialIssuer?.deferred_credential_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant.issuerId}/deferred-credential`
    )

    // Bind to JWK
    const tokenResponseTenant = await holderTenant.modules.openId4VcHolder.requestToken({
      resolvedCredentialOffer: resolvedCredentialOffer,
    })

    expect(tokenResponseTenant.accessToken).toBeDefined()
    expect(tokenResponseTenant.dpop?.jwk).toBeInstanceOf(Kms.PublicJwk)
    const { payload } = Jwt.fromSerializedJwt(tokenResponseTenant.accessToken)

    expect(payload.toJson()).toEqual({
      cnf: {
        jkt: await calculateJwkThumbprint({
          hashAlgorithm: HashAlgorithm.Sha256,
          hashCallback: getOid4vcCallbacks(holderTenant.context).hash,
          jwk: tokenResponseTenant.dpop?.jwk.toJson() as Jwk,
        }),
      },
      'pre-authorized_code':
        resolvedCredentialOffer.credentialOfferPayload.grants?.[preAuthorizedCodeGrantIdentifier]?.[
          'pre-authorized_code'
        ],

      aud: `http://localhost:1234/oid4vci/${openIdIssuerTenant.issuerId}`,
      exp: expect.any(Number),
      iat: expect.any(Number),
      iss: `http://localhost:1234/oid4vci/${openIdIssuerTenant.issuerId}`,
      jti: expect.any(String),
      nbf: undefined,
      sub: expect.stringContaining('credo:'),
    })

    const credentialsTenant1 = await holderTenant.modules.openId4VcHolder.requestCredentials({
      resolvedCredentialOffer: resolvedCredentialOffer,
      ...tokenResponseTenant,
      credentialBindingResolver,
    })

    // Wait for all events
    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.AccessTokenRequested,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })
    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.AccessTokenCreated,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })
    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.CredentialRequestReceived,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })
    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Deferred,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(credentialsTenant1.deferredCredentials).toHaveLength(1)
    expect(credentialsTenant1.credentials).toHaveLength(0)
    expect(credentialsTenant1.deferredCredentials[0].interval).toEqual(2000)

    const deferredCredentialResponse = await holderTenant.modules.openId4VcHolder.requestDeferredCredentials({
      ...tokenResponseTenant,
      ...credentialsTenant1.deferredCredentials[0],
      issuerMetadata: resolvedCredentialOffer.metadata,
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(deferredCredentialResponse.deferredCredentials).toHaveLength(0)
    expect(deferredCredentialResponse.credentials).toHaveLength(1)

    expect(deferredCredentialResponse.credentials).toHaveLength(1)
    const mdocBase64Url = (deferredCredentialResponse.credentials[0].credentials[0] as Mdoc).base64Url
    const mdoc = holderTenant.mdoc.fromBase64Url(mdocBase64Url)
    expect(mdoc.docType).toEqual('UniversityDegreeCredential')

    await holderTenant.endSession()
  })
})

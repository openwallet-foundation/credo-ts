import type { DcqlQuery, DifPresentationExchangeDefinitionV2, Mdoc, MdocDeviceResponse, SdJwtVc } from '@credo-ts/core'
import {
  ClaimFormat,
  CredoError,
  DateOnly,
  DidsApi,
  JwsService,
  Jwt,
  JwtPayload,
  Kms,
  MdocRecord,
  SdJwtVcRecord,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  X509Certificate,
  X509Module,
  X509Service,
  getPublicJwkFromVerificationMethod,
  parseDid,
  w3cDate,
} from '@credo-ts/core'
import type { AuthorizationServerMetadata, Jwk } from '@openid4vc/oauth2'
import {
  HashAlgorithm,
  Oauth2AuthorizationServer,
  calculateJwkThumbprint,
  preAuthorizedCodeGrantIdentifier,
} from '@openid4vc/oauth2'
import { AuthorizationFlow } from '@openid4vc/openid4vci'
import express, { type Express } from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { TenantsModule } from '../../tenants/src'
import type { OpenId4VciSignMdocCredentials } from '../src'
import {
  OpenId4VcHolderModule,
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuerModule,
  OpenId4VcVerificationSessionState,
  OpenId4VcVerifierModule,
} from '../src'
import type { OpenId4VciCredentialBindingResolver } from '../src/openid4vc-holder'
import { getOid4vcCallbacks } from '../src/shared/callbacks'
import type { AgentType, TenantType } from './utils'
import {
  createAgentFromModules,
  createTenantForAgent,
  waitForCredentialIssuanceSessionRecordSubject,
  waitForVerificationSessionRecordSubject,
} from './utils'
import {
  universityDegreeCredentialConfigurationSupported,
  universityDegreeCredentialConfigurationSupportedMdoc,
} from './utilsVci'
import { openBadgePresentationDefinition, universityDegreePresentationDefinition } from './utilsVp'

const serverPort = 1234
const baseUrl = `http://localhost:${serverPort}`
const issuanceBaseUrl = `${baseUrl}/oid4vci`
const verificationBaseUrl = `${baseUrl}/oid4vp`

describe('OpenId4Vc', () => {
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

  let verifier: AgentType<{
    openId4VcVerifier: OpenId4VcVerifierModule
    tenants: TenantsModule<{ openId4VcVerifier: OpenId4VcVerifierModule }>
  }>
  let verifier1: TenantType
  let verifier2: TenantType

  let credentialIssuerCertificate: X509Certificate

  beforeEach(async () => {
    expressApp = express()

    issuer = (await createAgentFromModules(
      'issuer',
      {
        x509: new X509Module(),
        inMemory: new InMemoryWalletModule(),
        openId4VcIssuer: new OpenId4VcIssuerModule({
          baseUrl: issuanceBaseUrl,

          credentialRequestToCredentialMapper: async ({ agentContext, credentialRequest, holderBinding }) => {
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

    verifier = (await createAgentFromModules(
      'verifier',
      {
        openId4VcVerifier: new OpenId4VcVerifierModule({
          baseUrl: verificationBaseUrl,
        }),
        inMemory: new InMemoryWalletModule(),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598f',
      global.fetch
    )) as unknown as typeof verifier
    verifier1 = await createTenantForAgent(verifier.agent, 'vTenant1')
    verifier2 = await createTenantForAgent(verifier.agent, 'vTenant2')

    // We let AFJ create the router, so we have a fresh one each time
    expressApp.use('/oid4vci', issuer.agent.modules.openId4VcIssuer.config.router)
    expressApp.use('/oid4vp', verifier.agent.modules.openId4VcVerifier.config.router)

    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()

    await issuer.agent.shutdown()
    await holder.agent.shutdown()
    await verifier.agent.shutdown()
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
      state: OpenId4VcIssuanceSessionState.Completed,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuerTenant.context.contextCorrelationId,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    const compactSdJwtVcTenant1 = (credentialResponse.credentials[0].credentials[0] as SdJwtVc).compact
    const sdJwtVcTenant1 = holderTenant.sdJwtVc.fromCompact(compactSdJwtVcTenant1)
    expect(sdJwtVcTenant1.payload.vct).toEqual('UniversityDegreeCredential')

    await holderTenant.endSession()
    clearNock()
  })

  it('e2e flow with tenants, holder verification callback for authorization request fails', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.modules.openId4VcVerifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.modules.openId4VcVerifier.createVerifier()

    const signedCredential1 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    const signedCredential2 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential2 })

    const { authorizationRequest: authorizationRequestUri1, verificationSession: verificationSession1 } =
      await verifierTenant1.modules.openId4VcVerifier.createAuthorizationRequest({
        verifierId: openIdVerifierTenant1.verifierId,
        requestSigner: {
          method: 'did',
          didUrl: verifier1.verificationMethod.id,
        },
        presentationExchange: {
          definition: openBadgePresentationDefinition,
        },
      })

    expect(authorizationRequestUri1).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(verifier1.did)}&request_uri=${encodeURIComponent(
        verificationSession1.authorizationRequestUri as string
      )}`
    )

    const { authorizationRequest: authorizationRequestUri2, verificationSession: verificationSession2 } =
      await verifierTenant2.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier2.verificationMethod.id,
        },
        presentationExchange: {
          definition: universityDegreePresentationDefinition,
        },
        verifierId: openIdVerifierTenant2.verifierId,
      })

    expect(authorizationRequestUri2).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(verifier2.did)}&request_uri=${encodeURIComponent(
        verificationSession2.authorizationRequestUri as string
      )}`
    )

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()
  })

  it('e2e flow with tenants, verifier endpoints verifying a jwt-vc', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.modules.openId4VcVerifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.modules.openId4VcVerifier.createVerifier()

    const signedCredential1 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    const signedCredential2 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential2 })

    const { authorizationRequest: authorizationRequestUri1, verificationSession: verificationSession1 } =
      await verifierTenant1.modules.openId4VcVerifier.createAuthorizationRequest({
        verifierId: openIdVerifierTenant1.verifierId,
        requestSigner: {
          method: 'did',
          didUrl: verifier1.verificationMethod.id,
        },
        presentationExchange: {
          definition: openBadgePresentationDefinition,
        },
      })

    expect(authorizationRequestUri1).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(verifier1.did)}&request_uri=${encodeURIComponent(
        verificationSession1.authorizationRequestUri as string
      )}`
    )

    const { authorizationRequest: authorizationRequestUri2, verificationSession: verificationSession2 } =
      await verifierTenant2.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier2.verificationMethod.id,
        },
        presentationExchange: {
          definition: universityDegreePresentationDefinition,
        },
        verifierId: openIdVerifierTenant2.verifierId,
      })

    expect(authorizationRequestUri2).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(verifier2.did)}&request_uri=${encodeURIComponent(
        verificationSession2.authorizationRequestUri as string
      )}`
    )

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()

    const resolvedProofRequest1 =
      await holderTenant.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequestUri1)

    expect(resolvedProofRequest1.presentationExchange?.credentialsForRequest).toMatchObject({
      areRequirementsSatisfied: true,
      requirements: [
        {
          submissionEntry: [
            {
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.JwtVc,
                  credentialRecord: {
                    credential: {
                      type: ['VerifiableCredential', 'OpenBadgeCredential'],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    const resolvedProofRequest2 =
      await holderTenant.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequestUri2)

    expect(resolvedProofRequest2.presentationExchange?.credentialsForRequest).toMatchObject({
      areRequirementsSatisfied: true,
      requirements: [
        {
          submissionEntry: [
            {
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.JwtVc,
                  credentialRecord: {
                    credential: {
                      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    if (!resolvedProofRequest1.presentationExchange || !resolvedProofRequest2.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedProofRequest1.presentationExchange.credentialsForRequest
    )

    const { authorizationResponsePayload: authorizationREsponsePayload1, serverResponse: serverResponse1 } =
      await holderTenant.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedProofRequest1.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
      })

    expect(authorizationREsponsePayload1).toEqual({
      presentation_submission: {
        definition_id: 'OpenBadgeCredential',
        descriptor_map: [
          {
            format: 'jwt_vp',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$',
            path_nested: {
              format: 'jwt_vc',
              id: 'OpenBadgeCredentialDescriptor',
              path: '$.vp.verifiableCredential[0]',
            },
          },
        ],
        id: expect.any(String),
      },
      state: expect.any(String),
      vp_token: expect.any(String),
    })
    expect(serverResponse1).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant1_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifierTenant1_2.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession1.id,
    })

    const { presentationExchange: presentationExchange1 } =
      await verifierTenant1_2.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(verificationSession1.id)

    expect(presentationExchange1).toMatchObject({
      definition: openBadgePresentationDefinition,
      submission: {
        definition_id: 'OpenBadgeCredential',
      },
      presentations: [
        {
          verifiableCredential: [
            {
              type: ['VerifiableCredential', 'OpenBadgeCredential'],
            },
          ],
        },
      ],
    })

    const selectedCredentials2 = holder.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedProofRequest2.presentationExchange.credentialsForRequest
    )

    const { serverResponse: serverResponse2 } =
      await holderTenant.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedProofRequest2.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials2,
        },
      })
    expect(serverResponse2).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant2_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifierTenant2_2.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession2.id,
    })
    const { presentationExchange: presentationExchange2 } =
      await verifierTenant2_2.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(verificationSession2.id)

    expect(presentationExchange2).toMatchObject({
      definition: universityDegreePresentationDefinition,
      submission: {
        definition_id: 'UniversityDegreeCredential',
      },
      presentations: [
        {
          verifiableCredential: [
            {
              type: ['VerifiableCredential', 'UniversityDegreeCredential'],
            },
          ],
        },
      ],
    })
  })

  it('e2e flow (jarm) with verifier endpoints verifying a sd-jwt-vc with selective disclosure (transaction data)', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const signedSdJwtVc = await issuer.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: issuer.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential',
        university: 'innsbruck',
        degree: 'bachelor',
        name: 'John Doe',
      },
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })

    const certificate = await verifier.agent.x509.createCertificate({
      issuer: { commonName: 'Credo', countryName: 'NL' },
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'localhost' }] } },
    })

    const rawCertificate = certificate.toString('base64')
    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)

    holder.agent.x509.config.addTrustedCertificate(rawCertificate)
    verifier.agent.x509.config.addTrustedCertificate(rawCertificate)

    const presentationDefinition = {
      id: 'OpenBadgeCredential',
      input_descriptors: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: {
            'vc+sd-jwt': {
              'sd-jwt_alg_values': ['EdDSA'],
            },
          },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: ['$.vct'],
                filter: {
                  type: 'string',
                  const: 'OpenBadgeCredential',
                },
              },
              {
                path: ['$.university'],
              },
            ],
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        verifierId: openIdVerifier.verifierId,
        responseMode: 'direct_post.jwt',
        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        transactionData: [
          {
            type: 'OpenBadgeTx',
            credential_ids: ['OpenBadgeCredentialDescriptor'],
            transaction_data_hashes_alg: ['sha-256'],
            some_extra_prop: 'is_allowed',
          },
        ],
        presentationExchange: {
          definition: presentationDefinition,
        },
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)
    expect(resolvedAuthorizationRequest.authorizationRequestPayload.response_mode).toEqual('direct_post.jwt')

    expect(resolvedAuthorizationRequest.presentationExchange?.credentialsForRequest).toEqual({
      areRequirementsSatisfied: true,
      name: undefined,
      purpose: undefined,
      requirements: [
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              name: undefined,
              purpose: undefined,
              inputDescriptorId: 'OpenBadgeCredentialDescriptor',
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.SdJwtVc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc.compact,
                  }),
                  // Name is NOT in here
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    degree: 'bachelor',
                    iat: expect.any(Number),
                    iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
                    university: 'innsbruck',
                    vct: 'OpenBadgeCredential',
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    if (!resolvedAuthorizationRequest.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedAuthorizationRequest.presentationExchange.credentialsForRequest
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
        transactionData: [{ credentialId: 'OpenBadgeCredentialDescriptor' }],
      })

    // path_nested should not be used for sd-jwt
    expect(authorizationResponsePayload.presentation_submission?.descriptor_map[0].path_nested).toBeUndefined()
    expect(authorizationResponsePayload).toEqual({
      presentation_submission: {
        definition_id: 'OpenBadgeCredential',
        descriptor_map: [
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$',
          },
        ],
        id: expect.any(String),
      },
      state: expect.any(String),
      vp_token: expect.any(String),
    })
    expect(serverResponse).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession.id,
    })
    const { presentationExchange, transactionData: _transactionData } =
      await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(verificationSession.id)

    const presentation = presentationExchange?.presentations[0] as SdJwtVc
    expect(_transactionData).toEqual([
      {
        credentialHashIndex: 0,
        credentialId: 'OpenBadgeCredentialDescriptor',
        decoded: {
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          transaction_data_hashes_alg: ['sha-256'],
          type: 'OpenBadgeTx',
          some_extra_prop: 'is_allowed',
        },
        encoded:
          'eyJ0eXBlIjoiT3BlbkJhZGdlVHgiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvciJdLCJ0cmFuc2FjdGlvbl9kYXRhX2hhc2hlc19hbGciOlsic2hhLTI1NiJdLCJzb21lX2V4dHJhX3Byb3AiOiJpc19hbGxvd2VkIn0',
        hash: 'PJEyHCQYjSKqKyd1mIpBPWs8ocD5GvBhxvAR_opoM0Y',
        hashAlg: 'sha-256',
        transactionDataIndex: 0,
      },
    ])

    const signedTransactionDataHashes = {
      transaction_data_hashes: ['PJEyHCQYjSKqKyd1mIpBPWs8ocD5GvBhxvAR_opoM0Y'],
      transaction_data_hashes_alg: 'sha-256',
    }
    expect(presentation?.kbJwt?.payload).toMatchObject(signedTransactionDataHashes)

    // name SHOULD NOT be disclosed
    expect(presentation.prettyClaims).not.toHaveProperty('name')

    // university and name SHOULD NOT be in the signed payload
    expect(presentation.payload).not.toHaveProperty('university')
    expect(presentation.payload).not.toHaveProperty('name')

    expect(presentationExchange).toEqual({
      definition: presentationDefinition,
      submission: {
        definition_id: 'OpenBadgeCredential',
        descriptor_map: [
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$',
          },
        ],
        id: expect.any(String),
      },
      presentations: [
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtVc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            typ: 'dc+sd-jwt',
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          kbJwt: {
            header: {
              alg: 'EdDSA',
              typ: 'kb+jwt',
            },
            payload: {
              aud: 'x509_san_dns:localhost',
              iat: expect.any(Number),
              nonce: verificationSession.requestPayload.nonce,
              sd_hash: expect.any(String),
              transaction_data_hashes: ['PJEyHCQYjSKqKyd1mIpBPWs8ocD5GvBhxvAR_opoM0Y'],
              transaction_data_hashes_alg: 'sha-256',
            },
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
            university: 'innsbruck',
          },
        },
      ],
      descriptors: expect.any(Array),
    })
  })

  it('e2e flow with verifier endpoints verifying a sd-jwt-vc with selective disclosure', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const signedSdJwtVc = await issuer.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: issuer.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential',
        university: 'innsbruck',
        degree: 'bachelor',
        name: 'John Doe',
      },
      headerType: 'vc+sd-jwt',
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })

    const certificate = await verifier.agent.x509.createCertificate({
      issuer: { commonName: 'Credo', countryName: 'NL' },
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'localhost' }] } },
    })

    const rawCertificate = certificate.toString('base64')
    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)

    holder.agent.x509.config.addTrustedCertificate(rawCertificate)
    verifier.agent.x509.config.addTrustedCertificate(rawCertificate)

    const presentationDefinition = {
      id: 'OpenBadgeCredential',
      input_descriptors: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: {
            'vc+sd-jwt': {
              'sd-jwt_alg_values': ['EdDSA'],
            },
          },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: ['$.vct'],
                filter: {
                  type: 'string',
                  const: 'OpenBadgeCredential',
                },
              },
              {
                path: ['$.university'],
              },
            ],
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        transactionData: [
          {
            type: 'OpenBadgeTx',
            credential_ids: ['OpenBadgeCredentialDescriptor'],
            transaction_data_hashes_alg: ['sha-256'],
          },
        ],
        presentationExchange: {
          definition: presentationDefinition,
        },
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.presentationExchange?.credentialsForRequest).toEqual({
      areRequirementsSatisfied: true,
      name: undefined,
      purpose: undefined,
      requirements: [
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              name: undefined,
              purpose: undefined,
              inputDescriptorId: 'OpenBadgeCredentialDescriptor',
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.SdJwtVc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc.compact,
                  }),
                  // Name is NOT in here
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    degree: 'bachelor',
                    iat: expect.any(Number),
                    iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
                    university: 'innsbruck',
                    vct: 'OpenBadgeCredential',
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    if (!resolvedAuthorizationRequest.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedAuthorizationRequest.presentationExchange.credentialsForRequest
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
        transactionData: [{ credentialId: 'OpenBadgeCredentialDescriptor' }],
      })

    // path_nested should not be used for sd-jwt
    expect(authorizationResponsePayload.presentation_submission?.descriptor_map[0].path_nested).toBeUndefined()
    expect(authorizationResponsePayload).toEqual({
      presentation_submission: {
        definition_id: 'OpenBadgeCredential',
        descriptor_map: [
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$',
          },
        ],
        id: expect.any(String),
      },
      state: expect.any(String),
      vp_token: expect.any(String),
    })
    expect(serverResponse).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession.id,
    })
    const { presentationExchange } = await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(
      verificationSession.id
    )

    const presentation = presentationExchange?.presentations[0] as SdJwtVc

    const signedTransactionDataHashes = {
      transaction_data_hashes: ['XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s'],
      transaction_data_hashes_alg: 'sha-256',
    }
    expect(presentation.kbJwt?.payload).toMatchObject(signedTransactionDataHashes)

    // name SHOULD NOT be disclosed
    expect(presentation.prettyClaims).not.toHaveProperty('name')

    // university and name SHOULD NOT be in the signed payload
    expect(presentation.payload).not.toHaveProperty('university')
    expect(presentation.payload).not.toHaveProperty('name')

    expect(presentationExchange).toEqual({
      definition: presentationDefinition,
      submission: {
        definition_id: 'OpenBadgeCredential',
        descriptor_map: [
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$',
          },
        ],
        id: expect.any(String),
      },
      presentations: [
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtVc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            typ: 'vc+sd-jwt',
          },
          kbJwt: {
            header: {
              alg: 'EdDSA',
              typ: 'kb+jwt',
            },
            payload: {
              aud: 'x509_san_dns:localhost',
              iat: expect.any(Number),
              nonce: verificationSession.requestPayload.nonce,
              sd_hash: expect.any(String),
              transaction_data_hashes: ['XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s'],
              transaction_data_hashes_alg: 'sha-256',
            },
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
            university: 'innsbruck',
          },
        },
      ],
      descriptors: expect.any(Array),
    })
  })

  it('e2e flow with verifier endpoints verifying two sd-jwt-vcs with selective disclosure', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const signedSdJwtVc = await issuer.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: issuer.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential',
        university: 'innsbruck',
        degree: 'bachelor',
        name: 'John Doe',
      },
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })

    const signedSdJwtVc2 = await issuer.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: issuer.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential2',
        university: 'innsbruck2',
        degree: 'bachelor2',
        name: 'John Doe2',
      },
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })

    const certificate = await verifier.agent.x509.createCertificate({
      issuer: { commonName: 'Credo', countryName: 'NL' },
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'localhost' }] } },
    })

    const rawCertificate = certificate.toString('base64')
    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)
    await holder.agent.sdJwtVc.store(signedSdJwtVc2.compact)

    holder.agent.x509.config.addTrustedCertificate(rawCertificate)
    verifier.agent.x509.config.addTrustedCertificate(rawCertificate)

    const presentationDefinition = {
      id: 'OpenBadgeCredentials',
      input_descriptors: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: {
            'vc+sd-jwt': {
              'sd-jwt_alg_values': ['EdDSA'],
            },
          },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: ['$.vct'],
                filter: {
                  type: 'string',
                  const: 'OpenBadgeCredential',
                },
              },
              {
                path: ['$.university'],
              },
            ],
          },
        },
        {
          id: 'OpenBadgeCredentialDescriptor2',
          format: {
            'vc+sd-jwt': {
              'sd-jwt_alg_values': ['EdDSA'],
            },
          },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: ['$.vct'],
                filter: {
                  type: 'string',
                  const: 'OpenBadgeCredential2',
                },
              },
              {
                path: ['$.name'],
              },
            ],
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        verifierId: openIdVerifier.verifierId,

        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        presentationExchange: {
          definition: presentationDefinition,
        },
        transactionData: [
          { type: 'type1', credential_ids: ['OpenBadgeCredentialDescriptor'] },
          { type: 'type2', credential_ids: ['OpenBadgeCredentialDescriptor2'] },
        ],
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.transactionData).toEqual([
      {
        matchedCredentialIds: ['OpenBadgeCredentialDescriptor'],
        entry: {
          encoded: 'eyJ0eXBlIjoidHlwZTEiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvciJdfQ',
          transactionData: {
            credential_ids: ['OpenBadgeCredentialDescriptor'],
            type: 'type1',
          },
          transactionDataIndex: 0,
        },
      },
      {
        entry: {
          encoded: 'eyJ0eXBlIjoidHlwZTIiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvcjIiXX0',
          transactionData: {
            credential_ids: ['OpenBadgeCredentialDescriptor2'],
            type: 'type2',
          },
          transactionDataIndex: 1,
        },
        matchedCredentialIds: ['OpenBadgeCredentialDescriptor2'],
      },
    ])

    expect(resolvedAuthorizationRequest.presentationExchange?.credentialsForRequest).toEqual({
      areRequirementsSatisfied: true,
      name: undefined,
      purpose: undefined,
      requirements: expect.arrayContaining([
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              name: undefined,
              purpose: undefined,
              inputDescriptorId: 'OpenBadgeCredentialDescriptor',
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.SdJwtVc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc.compact,
                  }),
                  // Name is NOT in here
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    degree: 'bachelor',
                    iat: expect.any(Number),
                    iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
                    university: 'innsbruck',
                    vct: 'OpenBadgeCredential',
                  },
                },
              ],
            },
          ],
        },
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              name: undefined,
              purpose: undefined,
              inputDescriptorId: 'OpenBadgeCredentialDescriptor2',
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.SdJwtVc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc2.compact,
                  }),
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    iat: expect.any(Number),
                    iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
                    vct: 'OpenBadgeCredential2',
                    degree: 'bachelor2',
                    name: 'John Doe2',
                  },
                },
              ],
            },
          ],
        },
      ]),
    })

    if (!resolvedAuthorizationRequest.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedAuthorizationRequest.presentationExchange.credentialsForRequest
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
        transactionData: [
          {
            credentialId: 'OpenBadgeCredentialDescriptor',
          },
          {
            credentialId: 'OpenBadgeCredentialDescriptor2',
          },
        ],
      })

    // path_nested should not be used for sd-jwt
    expect(authorizationResponsePayload.presentation_submission?.descriptor_map[0].path_nested).toBeUndefined()
    expect(authorizationResponsePayload).toEqual({
      presentation_submission: {
        definition_id: 'OpenBadgeCredentials',
        descriptor_map: [
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$[0]',
          },
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor2',
            path: '$[1]',
          },
        ],
        id: expect.any(String),
      },
      state: expect.any(String),
      vp_token: [expect.any(String), expect.any(String)],
    })
    expect(serverResponse).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession.id,
    })
    const { presentationExchange, transactionData: tdResult } =
      await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(verificationSession.id)

    expect(tdResult).toEqual([
      {
        credentialHashIndex: 0,
        credentialId: 'OpenBadgeCredentialDescriptor',
        decoded: {
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          type: 'type1',
        },
        encoded: 'eyJ0eXBlIjoidHlwZTEiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvciJdfQ',
        hash: 'TU8fKqfA_X6SXn3RCGR9ENeO1h4KXacyAPpxxhzBwJ4',
        hashAlg: 'sha-256',
        transactionDataIndex: 0,
      },
      {
        credentialHashIndex: 0,
        credentialId: 'OpenBadgeCredentialDescriptor2',
        decoded: {
          credential_ids: ['OpenBadgeCredentialDescriptor2'],
          type: 'type2',
        },
        encoded: 'eyJ0eXBlIjoidHlwZTIiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvcjIiXX0',
        hash: '_W3dA7YK86o2y2JjRzgbsWnc8IJD3OJd9Rk7sGUlars',
        hashAlg: 'sha-256',
        transactionDataIndex: 1,
      },
    ])

    const presentation = presentationExchange?.presentations[0] as SdJwtVc
    // name SHOULD NOT be disclosed
    expect(presentation.prettyClaims).not.toHaveProperty('name')

    const signedTransactionDataHashes = {
      transaction_data_hashes: ['TU8fKqfA_X6SXn3RCGR9ENeO1h4KXacyAPpxxhzBwJ4'],
      transaction_data_hashes_alg: 'sha-256',
    }
    expect(presentation.kbJwt?.payload).toMatchObject(signedTransactionDataHashes)

    const signedTransactionDataHashes2 = {
      transaction_data_hashes: ['_W3dA7YK86o2y2JjRzgbsWnc8IJD3OJd9Rk7sGUlars'],
      transaction_data_hashes_alg: 'sha-256',
    }
    expect((presentationExchange?.presentations[1] as SdJwtVc).kbJwt?.payload).toMatchObject(
      signedTransactionDataHashes2
    )

    // university and name SHOULD NOT be in the signed payload
    expect(presentation.payload).not.toHaveProperty('university')
    expect(presentation.payload).not.toHaveProperty('name')

    expect(presentationExchange).toEqual({
      definition: presentationDefinition,
      submission: {
        definition_id: 'OpenBadgeCredentials',
        descriptor_map: [
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$[0]',
          },
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor2',
            path: '$[1]',
          },
        ],
        id: expect.any(String),
      },
      presentations: [
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtVc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            typ: 'dc+sd-jwt',
          },
          kbJwt: {
            header: {
              alg: 'EdDSA',
              typ: 'kb+jwt',
            },
            payload: {
              aud: 'x509_san_dns:localhost',
              iat: expect.any(Number),
              nonce: verificationSession.requestPayload.nonce,
              sd_hash: expect.any(String),
              transaction_data_hashes: ['TU8fKqfA_X6SXn3RCGR9ENeO1h4KXacyAPpxxhzBwJ4'],
              transaction_data_hashes_alg: 'sha-256',
            },
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
            university: 'innsbruck',
          },
        },
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtVc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            typ: 'dc+sd-jwt',
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential2',
            degree: 'bachelor2',
          },
          kbJwt: {
            header: {
              alg: 'EdDSA',
              typ: 'kb+jwt',
            },
            payload: {
              aud: 'x509_san_dns:localhost',
              iat: expect.any(Number),
              nonce: verificationSession.requestPayload.nonce,
              sd_hash: expect.any(String),
              transaction_data_hashes: ['_W3dA7YK86o2y2JjRzgbsWnc8IJD3OJd9Rk7sGUlars'],
              transaction_data_hashes_alg: 'sha-256',
            },
          },
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential2',
            name: 'John Doe2',
            degree: 'bachelor2',
          },
        },
      ],
      descriptors: expect.any(Array),
    })
  })

  it('e2e flow with tenants, issuer endpoints requesting a mdoc', async () => {
    const issuerTenant1 = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })

    const issuerCertificate = await issuerTenant1.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await issuerTenant1.kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })).publicJwk
      ),
      issuer: 'C=DE',
    })
    credentialIssuerCertificate = issuerCertificate

    const openIdIssuerTenant1 = await issuerTenant1.modules.openId4VcIssuer.createIssuer({
      dpopSigningAlgValuesSupported: [Kms.KnownJwaSignatureAlgorithms.ES256],
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupportedMdoc,
      },
    })
    const issuer1Record = await issuerTenant1.modules.openId4VcIssuer.getIssuerByIssuerId(openIdIssuerTenant1.issuerId)
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

    const { issuanceSession: issuanceSession1, credentialOffer: credentialOffer1 } =
      await issuerTenant1.modules.openId4VcIssuer.createCredentialOffer({
        issuerId: openIdIssuerTenant1.issuerId,
        credentialConfigurationIds: ['universityDegree'],
        preAuthorizedCodeFlowConfig: {},
        version: 'v1.draft15',
      })

    await issuerTenant1.endSession()

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.OfferCreated,
      issuanceSessionId: issuanceSession1.id,
      contextCorrelationId: issuerTenant1.context.contextCorrelationId,
    })

    const holderTenant1 = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    holderTenant1.x509.config.setTrustedCertificates([issuerCertificate.toString('pem')])

    const resolvedCredentialOffer1 =
      await holderTenant1.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer1)

    expect(resolvedCredentialOffer1.metadata.credentialIssuer?.dpop_signing_alg_values_supported).toEqual(['ES256'])
    expect(resolvedCredentialOffer1.offeredCredentialConfigurations).toEqual({
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

    expect(resolvedCredentialOffer1.credentialOfferPayload.credential_issuer).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant1.issuerId}`
    )
    expect(resolvedCredentialOffer1.metadata.credentialIssuer?.token_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant1.issuerId}/token`
    )
    expect(resolvedCredentialOffer1.metadata.credentialIssuer?.credential_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant1.issuerId}/credential`
    )

    // Bind to JWK
    const tokenResponseTenant1 = await holderTenant1.modules.openId4VcHolder.requestToken({
      resolvedCredentialOffer: resolvedCredentialOffer1,
    })

    expect(tokenResponseTenant1.accessToken).toBeDefined()
    expect(tokenResponseTenant1.dpop?.jwk).toBeInstanceOf(Kms.PublicJwk)
    const { payload } = Jwt.fromSerializedJwt(tokenResponseTenant1.accessToken)

    expect(payload.toJson()).toEqual({
      cnf: {
        jkt: await calculateJwkThumbprint({
          hashAlgorithm: HashAlgorithm.Sha256,
          hashCallback: getOid4vcCallbacks(holderTenant1.context).hash,
          jwk: tokenResponseTenant1.dpop?.jwk.toJson() as Jwk,
        }),
      },
      'pre-authorized_code':
        resolvedCredentialOffer1.credentialOfferPayload.grants?.[preAuthorizedCodeGrantIdentifier]?.[
          'pre-authorized_code'
        ],

      aud: `http://localhost:1234/oid4vci/${openIdIssuerTenant1.issuerId}`,
      exp: expect.any(Number),
      iat: expect.any(Number),
      iss: `http://localhost:1234/oid4vci/${openIdIssuerTenant1.issuerId}`,
      jti: expect.any(String),
      nbf: undefined,
      sub: expect.stringContaining('credo:'),
    })

    const credentialsTenant1 = await holderTenant1.modules.openId4VcHolder.requestCredentials({
      resolvedCredentialOffer: resolvedCredentialOffer1,
      ...tokenResponseTenant1,
      credentialBindingResolver,
    })

    // Wait for all events
    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.AccessTokenRequested,
      issuanceSessionId: issuanceSession1.id,
      contextCorrelationId: issuerTenant1.context.contextCorrelationId,
    })
    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.AccessTokenCreated,
      issuanceSessionId: issuanceSession1.id,
      contextCorrelationId: issuerTenant1.context.contextCorrelationId,
    })
    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.CredentialRequestReceived,
      issuanceSessionId: issuanceSession1.id,
      contextCorrelationId: issuerTenant1.context.contextCorrelationId,
    })
    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
      issuanceSessionId: issuanceSession1.id,
      contextCorrelationId: issuerTenant1.context.contextCorrelationId,
    })

    expect(credentialsTenant1.credentials).toHaveLength(1)
    const mdocBase64Url = (credentialsTenant1.credentials[0].credentials[0] as Mdoc).base64Url
    const mdoc = holderTenant1.mdoc.fromBase64Url(mdocBase64Url)
    expect(mdoc.docType).toEqual('UniversityDegreeCredential')

    await holderTenant1.endSession()
  })

  it('e2e flow with verifier endpoints verifying a mdoc fails without direct_post.jwt', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const issuerCertificate = await X509Service.createCertificate(issuer.agent.context, {
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await issuer.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      ),
      issuer: 'C=DE',
    })

    verifier.agent.x509.config.setTrustedCertificates([issuerCertificate.toString('pem')])

    const holderKey = Kms.PublicJwk.fromPublicJwk(
      (
        await holder.agent.kms.createKey({
          type: {
            kty: 'EC',
            crv: 'P-256',
          },
        })
      ).publicJwk
    )
    const signedMdoc = await issuer.agent.mdoc.sign({
      docType: 'org.eu.university',
      holderKey,
      issuerCertificate,
      namespaces: {
        'eu.europa.ec.eudi.pid.1': {
          university: 'innsbruck',
          degree: 'bachelor',
          name: 'John Doe',
          not: 'disclosed',
        },
      },
    })

    const certificate = await verifier.agent.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'localhost' }] } },
      issuer: { commonName: 'Credo', countryName: 'NL' },
    })

    const rawCertificate = certificate.toString('base64')
    await holder.agent.mdoc.store(signedMdoc)

    holder.agent.x509.config.addTrustedCertificate(rawCertificate)
    verifier.agent.x509.config.addTrustedCertificate(rawCertificate)

    const presentationDefinition = {
      id: 'mDL-sample-req',
      input_descriptors: [
        {
          id: 'org.eu.university',
          format: {
            mso_mdoc: {
              alg: ['ES256', 'ES384', 'ES512', 'EdDSA', 'ESB256', 'ESB320', 'ESB384', 'ESB512'],
            },
          },
          constraints: {
            fields: [
              {
                path: ["$['eu.europa.ec.eudi.pid.1']['name']"],
                intent_to_retain: false,
              },
              {
                path: ["$['eu.europa.ec.eudi.pid.1']['degree']"],
                intent_to_retain: false,
              },
            ],
            limit_disclosure: 'required',
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const { authorizationRequest } = await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
      responseMode: 'direct_post.jwt',
      verifierId: openIdVerifier.verifierId,
      requestSigner: {
        method: 'x5c',
        x5c: [certificate],
      },
      presentationExchange: { definition: presentationDefinition },
    })

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    if (!resolvedAuthorizationRequest.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedAuthorizationRequest.presentationExchange.credentialsForRequest
    )

    const requestPayload = resolvedAuthorizationRequest.authorizationRequestPayload
    // setting this to direct_post to simulate the result of sending a non encrypted response to an authorization request that requires enryption
    requestPayload.response_mode = 'direct_post'

    const result = await holder.agent.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
      presentationExchange: {
        credentials: selectedCredentials,
      },
    })

    expect(result.ok).toBe(false)
    expect(result.serverResponse?.body).toMatchObject({
      error: 'invalid_request',
      error_description: 'Invalid response mode for openid4vp response. Expected jarm response.',
    })
  })

  it('e2e flow with verifier endpoints verifying a mdoc and sd-jwt (jarm)', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const signedSdJwtVc = await issuer.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: issuer.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential',
        university: 'innsbruck',
        degree: 'bachelor',
        name: 'John Doe',
      },
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })
    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)

    const issuerCertificate = await X509Service.createCertificate(issuer.agent.context, {
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await issuer.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      ),
      issuer: 'C=DE',
    })

    verifier.agent.x509.config.setTrustedCertificates([issuerCertificate.toString('pem')])

    const parsedDid = parseDid(issuer.kid)
    if (!parsedDid.fragment) {
      throw new Error(`didUrl '${parsedDid.didUrl}' does not contain a '#'. Unable to derive key from did document.`)
    }

    const holderKey = Kms.PublicJwk.fromPublicJwk(
      (
        await holder.agent.kms.createKey({
          type: {
            kty: 'EC',
            crv: 'P-256',
          },
        })
      ).publicJwk
    )

    const signedMdoc = await issuer.agent.mdoc.sign({
      docType: 'org.eu.university',
      holderKey,
      issuerCertificate,
      namespaces: {
        'eu.europa.ec.eudi.pid.1': {
          university: 'innsbruck',
          degree: 'bachelor',
          name: 'John Doe',
          not: 'disclosed',
        },
      },
    })

    const certificate = await verifier.agent.x509.createCertificate({
      issuer: { commonName: 'Credo', countryName: 'NL' },
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'localhost' }] } },
    })

    const rawCertificate = certificate.toString('base64')
    await holder.agent.mdoc.store(signedMdoc)

    holder.agent.x509.config.addTrustedCertificate(rawCertificate)
    verifier.agent.x509.config.addTrustedCertificate(rawCertificate)

    const presentationDefinition = {
      id: 'mDL-sample-req',
      input_descriptors: [
        {
          id: 'org.eu.university',
          format: {
            mso_mdoc: {
              alg: ['ES256', 'ES384', 'ES512', 'EdDSA', 'ESB256', 'ESB320', 'ESB384', 'ESB512'],
            },
          },
          constraints: {
            fields: [
              {
                path: ["$['eu.europa.ec.eudi.pid.1']['name']"],
                intent_to_retain: false,
              },
              {
                path: ["$['eu.europa.ec.eudi.pid.1']['degree']"],
                intent_to_retain: false,
              },
            ],
            limit_disclosure: 'required',
          },
        },
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: {
            'vc+sd-jwt': {
              'sd-jwt_alg_values': ['EdDSA'],
            },
          },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: ['$.vct'],
                filter: {
                  type: 'string',
                  const: 'OpenBadgeCredential',
                },
              },
              {
                path: ['$.university'],
              },
            ],
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        responseMode: 'direct_post.jwt',
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        presentationExchange: {
          definition: presentationDefinition,
        },
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.presentationExchange?.credentialsForRequest).toEqual({
      areRequirementsSatisfied: true,
      name: undefined,
      purpose: undefined,
      requirements: expect.arrayContaining([
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              name: undefined,
              purpose: undefined,
              inputDescriptorId: 'org.eu.university',
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.MsoMdoc,
                  credentialRecord: expect.objectContaining({
                    base64Url: expect.any(String),
                  }),
                  // Name is NOT in here
                  disclosedPayload: {
                    'eu.europa.ec.eudi.pid.1': {
                      degree: 'bachelor',
                      name: 'John Doe',
                    },
                  },
                },
              ],
            },
          ],
        },

        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              name: undefined,
              purpose: undefined,
              inputDescriptorId: 'OpenBadgeCredentialDescriptor',
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.SdJwtVc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc.compact,
                  }),
                  // Name is NOT in here
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    degree: 'bachelor',
                    iat: expect.any(Number),
                    iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
                    university: 'innsbruck',
                    vct: 'OpenBadgeCredential',
                  },
                },
              ],
            },
          ],
        },
      ]),
    })

    if (!resolvedAuthorizationRequest.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedAuthorizationRequest.presentationExchange.credentialsForRequest
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
      })

    // path_nested should not be used for sd-jwt
    expect(authorizationResponsePayload.presentation_submission?.descriptor_map[0].path_nested).toBeUndefined()
    expect(authorizationResponsePayload).toEqual({
      presentation_submission: {
        id: expect.any(String),
        definition_id: 'mDL-sample-req',
        descriptor_map: [
          {
            id: 'org.eu.university',
            format: 'mso_mdoc',
            path: '$[0]',
          },
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$[1]',
          },
        ],
      },
      state: expect.any(String),
      vp_token: expect.any(Array<string>),
    })
    expect(serverResponse).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession.id,
    })
    const { presentationExchange } = await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(
      verificationSession.id
    )

    const presentation = presentationExchange?.presentations[0] as MdocDeviceResponse
    expect(presentation.documents).toHaveLength(1)

    const mdocResponse = presentation.documents[0]

    // name SHOULD NOT be disclosed
    expect(mdocResponse.issuerSignedNamespaces).toStrictEqual({
      'eu.europa.ec.eudi.pid.1': {
        degree: 'bachelor',
        name: 'John Doe',
      },
    })

    expect(presentationExchange).toEqual({
      definition: presentationDefinition,
      submission: {
        id: expect.any(String),
        definition_id: 'mDL-sample-req',
        descriptor_map: [
          {
            id: 'org.eu.university',
            format: 'mso_mdoc',
            path: '$[0]',
          },
          {
            id: 'OpenBadgeCredentialDescriptor',
            format: 'vc+sd-jwt',
            path: '$[1]',
          },
        ],
      },
      presentations: [
        {
          base64Url: expect.any(String),
          documents: [
            {
              issuerSignedDocument: {
                docType: 'org.eu.university',
                issuerSigned: {
                  nameSpaces: new Map([['eu.europa.ec.eudi.pid.1', [{}, {}]]]),
                  issuerAuth: expect.any(Object),
                },
                deviceSigned: expect.any(Object),
              },
              base64Url: expect.any(String),
            },
          ],
        },
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtVc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            typ: 'dc+sd-jwt',
          },
          kbJwt: {
            header: {
              alg: 'EdDSA',
              typ: 'kb+jwt',
            },
            payload: {
              aud: 'x509_san_dns:localhost',
              iat: expect.any(Number),
              nonce: verificationSession.requestPayload.nonce,
              sd_hash: expect.any(String),
            },
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
            university: 'innsbruck',
          },
        },
      ],
      descriptors: expect.any(Array),
    })
  })

  it('e2e flow with verifier endpoints verifying two sd-jwt-vcs with selective disclosure', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const signedSdJwtVc = await issuer.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: issuer.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential',
        university: 'innsbruck',
        degree: 'bachelor',
        name: 'John Doe',
      },
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })

    const signedSdJwtVc2 = await issuer.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: issuer.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential2',
        university: 'innsbruck2',
        degree: 'bachelor2',
        name: 'John Doe2',
      },
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })

    const certificate = await verifier.agent.x509.createCertificate({
      issuer: { commonName: 'Credo', countryName: 'NL' },
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'localhost' }] } },
    })

    const rawCertificate = certificate.toString('base64')
    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)
    await holder.agent.sdJwtVc.store(signedSdJwtVc2.compact)

    holder.agent.x509.config.addTrustedCertificate(rawCertificate)
    verifier.agent.x509.config.addTrustedCertificate(rawCertificate)

    const presentationDefinition = {
      id: 'OpenBadgeCredentials',
      input_descriptors: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: {
            'vc+sd-jwt': {
              'sd-jwt_alg_values': ['EdDSA'],
            },
          },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: ['$.vct'],
                filter: {
                  type: 'string',
                  const: 'OpenBadgeCredential',
                },
              },
              {
                path: ['$.university'],
              },
            ],
          },
        },
        {
          id: 'OpenBadgeCredentialDescriptor2',
          format: {
            'vc+sd-jwt': {
              'sd-jwt_alg_values': ['EdDSA'],
            },
          },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: ['$.vct'],
                filter: {
                  type: 'string',
                  const: 'OpenBadgeCredential2',
                },
              },
              {
                path: ['$.name'],
              },
            ],
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        verifierId: openIdVerifier.verifierId,

        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        presentationExchange: {
          definition: presentationDefinition,
        },
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.presentationExchange?.credentialsForRequest).toEqual({
      areRequirementsSatisfied: true,
      name: undefined,
      purpose: undefined,
      requirements: expect.arrayContaining([
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              name: undefined,
              purpose: undefined,
              inputDescriptorId: 'OpenBadgeCredentialDescriptor',
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.SdJwtVc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc.compact,
                  }),
                  // Name is NOT in here
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    degree: 'bachelor',
                    iat: expect.any(Number),
                    iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
                    university: 'innsbruck',
                    vct: 'OpenBadgeCredential',
                  },
                },
              ],
            },
          ],
        },
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              name: undefined,
              purpose: undefined,
              inputDescriptorId: 'OpenBadgeCredentialDescriptor2',
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.SdJwtVc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc2.compact,
                  }),
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    iat: expect.any(Number),
                    iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
                    vct: 'OpenBadgeCredential2',
                    degree: 'bachelor2',
                    name: 'John Doe2',
                  },
                },
              ],
            },
          ],
        },
      ]),
    })

    if (!resolvedAuthorizationRequest.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedAuthorizationRequest.presentationExchange.credentialsForRequest
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
      })

    // path_nested should not be used for sd-jwt
    expect(authorizationResponsePayload.presentation_submission?.descriptor_map[0].path_nested).toBeUndefined()
    expect(authorizationResponsePayload).toEqual({
      presentation_submission: {
        definition_id: 'OpenBadgeCredentials',
        descriptor_map: [
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$[0]',
          },
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor2',
            path: '$[1]',
          },
        ],
        id: expect.any(String),
      },
      state: expect.any(String),
      vp_token: [expect.any(String), expect.any(String)],
    })
    expect(serverResponse).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession.id,
    })
    const { presentationExchange } = await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(
      verificationSession.id
    )

    const presentation = presentationExchange?.presentations[0] as SdJwtVc

    // name SHOULD NOT be disclosed
    expect(presentation.prettyClaims).not.toHaveProperty('name')

    // university and name SHOULD NOT be in the signed payload
    expect(presentation.payload).not.toHaveProperty('university')
    expect(presentation.payload).not.toHaveProperty('name')

    expect(presentationExchange).toEqual({
      definition: presentationDefinition,
      submission: {
        definition_id: 'OpenBadgeCredentials',
        descriptor_map: [
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$[0]',
          },
          {
            format: 'vc+sd-jwt',
            id: 'OpenBadgeCredentialDescriptor2',
            path: '$[1]',
          },
        ],
        id: expect.any(String),
      },
      presentations: [
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtVc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            typ: 'dc+sd-jwt',
          },
          kbJwt: {
            header: {
              alg: 'EdDSA',
              typ: 'kb+jwt',
            },
            payload: {
              aud: 'x509_san_dns:localhost',
              iat: expect.any(Number),
              nonce: verificationSession.requestPayload.nonce,
              sd_hash: expect.any(String),
            },
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
            university: 'innsbruck',
          },
        },
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtVc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            typ: 'dc+sd-jwt',
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential2',
            degree: 'bachelor2',
          },
          kbJwt: {
            header: {
              alg: 'EdDSA',
              typ: 'kb+jwt',
            },
            payload: {
              aud: 'x509_san_dns:localhost',
              iat: expect.any(Number),
              nonce: verificationSession.requestPayload.nonce,
              sd_hash: expect.any(String),
            },
          },
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
            vct: 'OpenBadgeCredential2',
            name: 'John Doe2',
            degree: 'bachelor2',
          },
        },
      ],
      descriptors: expect.any(Array),
    })
  })

  it('e2e flow with verifier endpoints verifying a mdoc and sd-jwt (jarm) (dcql) (transaction data)', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const signedSdJwtVc = await issuer.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: issuer.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential',
        university: 'innsbruck',
        degree: 'bachelor',
        name: 'John Doe',
      },
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })
    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)

    const selfSignedCertificate = await X509Service.createCertificate(issuer.agent.context, {
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await issuer.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      ),
      issuer: {
        countryName: 'DE',
      },
    })

    verifier.agent.x509.config.setTrustedCertificates([selfSignedCertificate.toString('pem')])

    const parsedDid = parseDid(issuer.kid)
    if (!parsedDid.fragment) {
      throw new Error(`didUrl '${parsedDid.didUrl}' does not contain a '#'. Unable to derive key from did document.`)
    }

    const holderKey = Kms.PublicJwk.fromPublicJwk(
      (
        await holder.agent.kms.createKey({
          type: {
            kty: 'EC',
            crv: 'P-256',
          },
        })
      ).publicJwk
    )

    const date = new DateOnly(new DateOnly().toISOString())

    const signedMdoc = await issuer.agent.mdoc.sign({
      docType: 'org.eu.university',
      holderKey,
      issuerCertificate: selfSignedCertificate,
      namespaces: {
        'eu.europa.ec.eudi.pid.1': {
          university: 'innsbruck',
          degree: 'bachelor',
          date: date,
          name: 'John Doe',
          not: 'disclosed',
        },
      },
    })

    const certificate = await verifier.agent.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      issuer: { commonName: 'Test' },
      extensions: {
        subjectAlternativeName: {
          name: [{ type: 'dns', value: 'localhost' }],
        },
      },
    })

    const rawCertificate = certificate.toString('base64')
    await holder.agent.mdoc.store(signedMdoc)

    holder.agent.x509.config.addTrustedCertificate(rawCertificate)
    verifier.agent.x509.config.addTrustedCertificate(rawCertificate)

    const dcqlQuery = {
      credentials: [
        {
          id: 'orgeuuniversity',
          format: ClaimFormat.MsoMdoc,
          meta: { doctype_value: 'org.eu.university' },
          claims: [
            { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'name' },
            { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'degree' },
            { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'date' },
          ],
        },
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: 'dc+sd-jwt',
          meta: { vct_values: ['OpenBadgeCredential'] },
          claims: [{ path: ['university'] }],
        },
      ],
    } satisfies DcqlQuery

    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        responseMode: 'direct_post.jwt',
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        dcql: {
          query: dcqlQuery,
        },
        transactionData: [
          {
            type: 'OpenBadgeTx',
            credential_ids: ['OpenBadgeCredentialDescriptor'],
            transaction_data_hashes_alg: ['sha-256'],
          },
        ],
      })

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.dcql).toEqual({
      queryResult: {
        credentials: [
          {
            id: 'orgeuuniversity',
            format: 'mso_mdoc',
            claims: [
              { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'name' },
              { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'degree' },
              { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'date' },
            ],
            meta: { doctype_value: 'org.eu.university' },
          },
          {
            id: 'OpenBadgeCredentialDescriptor',
            format: 'dc+sd-jwt',
            claims: [{ path: ['university'] }],
            meta: { vct_values: ['OpenBadgeCredential'] },
          },
        ],
        canBeSatisfied: true,
        credential_matches: {
          orgeuuniversity: {
            typed: true,
            success: true,
            output: {
              doctype: 'org.eu.university',
              credential_format: 'mso_mdoc',
              namespaces: {
                'eu.europa.ec.eudi.pid.1': {
                  date: expect.any(DateOnly),
                  name: 'John Doe',
                  degree: 'bachelor',
                },
              },
            },
            input_credential_index: 0,
            claim_set_index: undefined,
            all: expect.any(Array),
            record: expect.any(MdocRecord),
          },
          OpenBadgeCredentialDescriptor: {
            typed: true,
            success: true,
            output: {
              credential_format: 'dc+sd-jwt',
              vct: 'OpenBadgeCredential',
              claims: {
                cnf: {
                  kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                },
                degree: 'bachelor',
                iat: expect.any(Number),
                iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
                university: 'innsbruck',
                vct: 'OpenBadgeCredential',
              },
            },
            input_credential_index: 1,
            claim_set_index: undefined,
            all: expect.any(Array),
            record: expect.any(SdJwtVcRecord),
          },
        },
        credential_sets: undefined,
      },
    })

    if (!resolvedAuthorizationRequest.dcql) {
      throw new Error('Dcql not defined')
    }

    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        dcql: {
          credentials: selectedCredentials,
        },
        transactionData: [{ credentialId: 'OpenBadgeCredentialDescriptor' }],
      })

    // path_nested should not be used for sd-jwt
    expect(authorizationResponsePayload.presentation_submission).toBeUndefined()
    expect(authorizationResponsePayload).toEqual({ state: expect.any(String), vp_token: expect.any(Object) })
    expect(serverResponse).toMatchObject({ status: 200 })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession.id,
    })

    const { dcql, transactionData } = await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(
      verificationSession.id
    )

    expect(transactionData).toEqual([
      {
        credentialHashIndex: 0,
        credentialId: 'OpenBadgeCredentialDescriptor',
        decoded: {
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          transaction_data_hashes_alg: ['sha-256'],
          type: 'OpenBadgeTx',
        },
        encoded:
          'eyJ0eXBlIjoiT3BlbkJhZGdlVHgiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvciJdLCJ0cmFuc2FjdGlvbl9kYXRhX2hhc2hlc19hbGciOlsic2hhLTI1NiJdfQ',
        hash: 'XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s',
        hashAlg: 'sha-256',
        transactionDataIndex: 0,
      },
    ])
    const sdJwtPresentation = dcql?.presentations.OpenBadgeCredentialDescriptor as SdJwtVc

    expect(sdJwtPresentation.kbJwt?.payload).toMatchObject({
      transaction_data_hashes: ['XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s'],
      transaction_data_hashes_alg: 'sha-256',
    })
    expect(sdJwtPresentation.prettyClaims).toEqual({
      vct: 'OpenBadgeCredential',
      degree: 'bachelor',
      cnf: expect.any(Object),
      iss: 'did:key:z6MkrzQPBr4pyqC776KKtrz13SchM5ePPbssuPuQZb5t4uKQ',
      iat: expect.any(Number),
      university: 'innsbruck', // TODO: I Think this should be disclosed
    })

    const presentation = dcql?.presentations.orgeuuniversity as MdocDeviceResponse
    expect(presentation.documents).toHaveLength(1)

    expect(presentation.documents[0].issuerSignedNamespaces).toEqual({
      'eu.europa.ec.eudi.pid.1': {
        date,
        name: 'John Doe',
        degree: 'bachelor',
      },
    })
  })
})

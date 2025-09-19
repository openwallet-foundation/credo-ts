import { randomUUID } from 'crypto'
import type { DcqlQuery, DifPresentationExchangeDefinitionV2, MdocDeviceResponse, SdJwtVc } from '@credo-ts/core'
import {
  ClaimFormat,
  DateOnly,
  Kms,
  MdocRecord,
  SdJwtVcRecord,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  X509Module,
  X509Service,
  parseDid,
  w3cDate,
} from '@credo-ts/core'
import { TenantsModule } from '@credo-ts/tenants'
import express, { type Express } from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { DrizzleStorageModule } from '../../drizzle-storage/src'
import openid4vcBundle from '../../drizzle-storage/src/openid4vc/bundle'
import tenantsBundle from '../../drizzle-storage/src/tenants/bundle'
import { inMemoryDrizzleSqliteDatabase, pushDrizzleSchema } from '../../drizzle-storage/tests/testDatabase'
import {
  DrizzlePostgresTestDatabase,
  createDrizzlePostgresTestDatabase,
} from '../../drizzle-storage/tests/testDatabase'
import { OpenId4VcHolderModule, OpenId4VcVerificationSessionState, OpenId4VcVerifierModule } from '../src'

import type { AgentType, TenantType } from './utils'
import { createAgentFromModules, createTenantForAgent, waitForVerificationSessionRecordSubject } from './utils'
import { openBadgePresentationDefinition, universityDegreePresentationDefinition } from './utilsVp'

const serverPort = 1234
const baseUrl = `http://localhost:${serverPort}`
const verificationBaseUrl = `${baseUrl}/oid4vp`

describe('OpenID4VP Draft 24', () => {
  let expressApp: Express
  let clearNock: () => void

  let holderPostgresDatabase: DrizzlePostgresTestDatabase

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

  let holderDrizzleModule: DrizzleStorageModule
  // Use SQLite for verifier
  const verifierDrizzleModule = new DrizzleStorageModule({
    database: inMemoryDrizzleSqliteDatabase(),
    bundles: [openid4vcBundle, tenantsBundle],
  })

  beforeAll(async () => {
    holderPostgresDatabase = await createDrizzlePostgresTestDatabase()
    holderDrizzleModule = new DrizzleStorageModule({
      database: holderPostgresDatabase.drizzle,
      bundles: [openid4vcBundle, tenantsBundle],
    })

    await pushDrizzleSchema(holderDrizzleModule)
    await pushDrizzleSchema(verifierDrizzleModule)
  })

  beforeEach(async () => {
    expressApp = express()

    holder = (await createAgentFromModules(
      {
        openId4VcHolder: new OpenId4VcHolderModule(),
        inMemory: new InMemoryWalletModule({ enableStorage: false }),
        holderDrizzleModule,
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
      {
        openId4VcVerifier: new OpenId4VcVerifierModule({
          baseUrl: verificationBaseUrl,
          federation: {},
        }),
        inMemory: new InMemoryWalletModule({ enableStorage: false }),
        verifierDrizzleModule,
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598f',
      global.fetch
    )) as unknown as typeof verifier
    verifier1 = await createTenantForAgent(verifier.agent, 'vTenant1')
    verifier2 = await createTenantForAgent(verifier.agent, 'vTenant2')

    // We let AFJ create the router, so we have a fresh one each time
    expressApp.use('/oid4vp', verifier.agent.modules.openId4VcVerifier.config.router)

    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()

    await holder.agent.shutdown()
    await verifier.agent.shutdown()

    // Should we add a public/higher level method to the Credo API to delete the root agent?
    await holder.agent.dependencyManager.deleteAgentContext(holder.agent.context)
    await verifier.agent.dependencyManager.deleteAgentContext(verifier.agent.context)
  })

  afterAll(async () => {
    await holderPostgresDatabase.teardown()
  })

  it('e2e flow with tenants, holder verification callback for authorization request fails', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.modules.openId4VcVerifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.modules.openId4VcVerifier.createVerifier()

    const signedCredential1 = await verifier.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: verifier.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: verifier.verificationMethod.id,
    })

    const signedCredential2 = await verifier.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: new W3cIssuer({ id: verifier.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: verifier.verificationMethod.id,
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
        version: 'v1.draft24',
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
        version: 'v1.draft24',
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

    const signedCredential1 = await verifier.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: verifier.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: verifier.verificationMethod.id,
    })

    const signedCredential2 = await verifier.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: new W3cIssuer({ id: verifier.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: verifier.verificationMethod.id,
    })

    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential2 })
    const authorizationResponseRedirectUri = `https://my-website.com/${randomUUID()}`

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
        version: 'v1.draft24',
        authorizationResponseRedirectUri,
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
        version: 'v1.draft24',
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
      body: {
        redirect_uri: authorizationResponseRedirectUri,
      },
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

    const signedSdJwtVc = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
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
        version: 'v1.draft24',
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
                  claimFormat: ClaimFormat.SdJwtDc,
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
                    iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
        credentialId: 'OpenBadgeCredentialDescriptor',
        decoded: {
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          transaction_data_hashes_alg: ['sha-256'],
          type: 'OpenBadgeTx',
          some_extra_prop: 'is_allowed',
        },
        encoded:
          'eyJ0eXBlIjoiT3BlbkJhZGdlVHgiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvciJdLCJ0cmFuc2FjdGlvbl9kYXRhX2hhc2hlc19hbGciOlsic2hhLTI1NiJdLCJzb21lX2V4dHJhX3Byb3AiOiJpc19hbGxvd2VkIn0',
        presentations: [
          {
            presentationHashIndex: 0,
            hash: 'PJEyHCQYjSKqKyd1mIpBPWs8ocD5GvBhxvAR_opoM0Y',
            hashAlg: 'sha-256',
          },
        ],
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
          claimFormat: ClaimFormat.SdJwtDc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            typ: 'dc+sd-jwt',
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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

    const signedSdJwtVc = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
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
        version: 'v1.draft24',
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
                  claimFormat: ClaimFormat.SdJwtDc,
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
                    iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
          claimFormat: ClaimFormat.SdJwtDc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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

    const signedSdJwtVc = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
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

    const signedSdJwtVc2 = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
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
        version: 'v1.draft24',
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
                  claimFormat: ClaimFormat.SdJwtDc,
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
                    iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
                  claimFormat: ClaimFormat.SdJwtDc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc2.compact,
                  }),
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    iat: expect.any(Number),
                    iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
        credentialId: 'OpenBadgeCredentialDescriptor',
        decoded: {
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          type: 'type1',
        },
        encoded: 'eyJ0eXBlIjoidHlwZTEiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvciJdfQ',
        presentations: [
          {
            presentationHashIndex: 0,
            hash: 'TU8fKqfA_X6SXn3RCGR9ENeO1h4KXacyAPpxxhzBwJ4',
            hashAlg: 'sha-256',
          },
        ],
        transactionDataIndex: 0,
      },
      {
        credentialId: 'OpenBadgeCredentialDescriptor2',
        decoded: {
          credential_ids: ['OpenBadgeCredentialDescriptor2'],
          type: 'type2',
        },
        encoded: 'eyJ0eXBlIjoidHlwZTIiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvcjIiXX0',
        presentations: [
          {
            presentationHashIndex: 0,
            hash: '_W3dA7YK86o2y2JjRzgbsWnc8IJD3OJd9Rk7sGUlars',
            hashAlg: 'sha-256',
          },
        ],
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
          claimFormat: ClaimFormat.SdJwtDc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
            university: 'innsbruck',
          },
        },
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtDc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            typ: 'dc+sd-jwt',
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            vct: 'OpenBadgeCredential2',
            name: 'John Doe2',
            degree: 'bachelor2',
          },
        },
      ],
      descriptors: expect.any(Array),
    })
  })

  it('e2e flow with verifier endpoints verifying a mdoc fails without direct_post.jwt', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const issuerCertificate = await X509Service.createCertificate(verifier.agent.context, {
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
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
    const signedMdoc = await verifier.agent.mdoc.sign({
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
      version: 'v1.draft24',
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

    const signedSdJwtVc = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
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

    const issuerCertificate = await X509Service.createCertificate(verifier.agent.context, {
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      ),
      issuer: 'C=DE',
    })

    verifier.agent.x509.config.setTrustedCertificates([issuerCertificate.toString('pem')])

    const parsedDid = parseDid(verifier.kid)
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

    const signedMdoc = await verifier.agent.mdoc.sign({
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
        version: 'v1.draft24',
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
                  claimFormat: ClaimFormat.SdJwtDc,
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
                    iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
          claimFormat: ClaimFormat.SdJwtDc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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

    const signedSdJwtVc = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
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

    const signedSdJwtVc2 = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
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
        version: 'v1.draft24',
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
                  claimFormat: ClaimFormat.SdJwtDc,
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
                    iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
                  claimFormat: ClaimFormat.SdJwtDc,
                  credentialRecord: expect.objectContaining({
                    compactSdJwtVc: signedSdJwtVc2.compact,
                  }),
                  disclosedPayload: {
                    cnf: {
                      kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                    },
                    iat: expect.any(Number),
                    iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
          claimFormat: ClaimFormat.SdJwtDc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
          },
          // university SHOULD be disclosed
          prettyClaims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            vct: 'OpenBadgeCredential',
            degree: 'bachelor',
            university: 'innsbruck',
          },
        },
        {
          encoded: expect.any(String),
          claimFormat: ClaimFormat.SdJwtDc,
          compact: expect.any(String),
          header: {
            alg: 'EdDSA',
            kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            typ: 'dc+sd-jwt',
          },
          payload: {
            _sd: [expect.any(String), expect.any(String)],
            _sd_alg: 'sha-256',
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            iat: expect.any(Number),
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
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
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            vct: 'OpenBadgeCredential2',
            name: 'John Doe2',
            degree: 'bachelor2',
          },
        },
      ],
      descriptors: expect.any(Array),
    })
  })

  it('e2e flow with tenants and federation, verifier endpoints verifying a jwt-vc', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.modules.openId4VcVerifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.modules.openId4VcVerifier.createVerifier()

    const signedCredential1 = await verifier.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: verifier.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: verifier.verificationMethod.id,
    })

    const signedCredential2 = await verifier.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: new W3cIssuer({ id: verifier.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: verifier.verificationMethod.id,
    })

    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential2 })

    const { authorizationRequest: authorizationRequestUri1, verificationSession: verificationSession1 } =
      await verifierTenant1.modules.openId4VcVerifier.createAuthorizationRequest({
        verifierId: openIdVerifierTenant1.verifierId,
        requestSigner: {
          method: 'federation',
        },
        presentationExchange: {
          definition: openBadgePresentationDefinition,
        },
        version: 'v1.draft24',
      })

    expect(authorizationRequestUri1).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(
        `http://localhost:1234/oid4vp/${openIdVerifierTenant1.verifierId}`
      )}&request_uri=${encodeURIComponent(verificationSession1.authorizationRequestUri as string)}`
    )

    const { authorizationRequest: authorizationRequestUri2, verificationSession: verificationSession2 } =
      await verifierTenant2.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: {
          method: 'federation',
        },
        presentationExchange: {
          definition: universityDegreePresentationDefinition,
        },
        verifierId: openIdVerifierTenant2.verifierId,
        version: 'v1.draft24',
      })

    expect(authorizationRequestUri2).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(
        `http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`
      )}&request_uri=${encodeURIComponent(verificationSession2.authorizationRequestUri as string)}`
    )

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()

    const resolvedProofRequest1 = await holderTenant.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequestUri1,
      {
        trustedFederationEntityIds: [`http://localhost:1234/oid4vp/${openIdVerifierTenant1.verifierId}`],
      }
    )

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

    const resolvedProofRequest2 = await holderTenant.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequestUri2,
      {
        trustedFederationEntityIds: [`http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`],
      }
    )

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

    const selectedCredentials = holderTenant.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
      resolvedProofRequest1.presentationExchange.credentialsForRequest
    )

    const { authorizationResponsePayload, serverResponse: serverResponse1 } =
      await holderTenant.modules.openId4VcHolder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedProofRequest1.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
      })

    expect(authorizationResponsePayload).toEqual({
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

    const selectedCredentials2 = holderTenant.modules.openId4VcHolder.selectCredentialsForPresentationExchangeRequest(
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

  it('e2e flow with verifier endpoints verifying a mdoc and sd-jwt (jarm) (dcql) (transaction data)', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const signedSdJwtVc = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
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

    const selfSignedCertificate = await X509Service.createCertificate(verifier.agent.context, {
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      ),
      issuer: {
        countryName: 'DE',
      },
    })

    verifier.agent.x509.config.setTrustedCertificates([selfSignedCertificate.toString('pem')])

    const parsedDid = parseDid(verifier.kid)
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

    const signedMdoc = await verifier.agent.mdoc.sign({
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
        version: 'v1.draft24',
      })

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.dcql).toEqual({
      queryResult: {
        credentials: [
          {
            multiple: false,
            require_cryptographic_holder_binding: true,
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
            multiple: false,
            require_cryptographic_holder_binding: true,
            id: 'OpenBadgeCredentialDescriptor',
            format: 'dc+sd-jwt',
            claims: [{ path: ['university'] }],
            meta: { vct_values: ['OpenBadgeCredential'] },
          },
        ],
        can_be_satisfied: true,
        credential_matches: {
          orgeuuniversity: {
            credential_query_id: 'orgeuuniversity',
            success: true,
            failed_credentials: expect.any(Array),
            valid_credentials: [
              {
                trusted_authorities: {
                  success: true,
                },
                record: expect.any(MdocRecord),
                input_credential_index: 0,
                success: true,
                meta: {
                  success: true,
                  output: {
                    doctype: 'org.eu.university',
                    credential_format: 'mso_mdoc',
                    cryptographic_holder_binding: true,
                  },
                },
                claims: {
                  success: true,
                  failed_claim_sets: undefined,
                  failed_claims: undefined,
                  valid_claims: expect.any(Array),
                  valid_claim_sets: [
                    {
                      claim_set_index: undefined,
                      success: true,
                      valid_claim_indexes: [0, 1, 2],
                      output: {
                        'eu.europa.ec.eudi.pid.1': {
                          date: expect.any(DateOnly),
                          name: 'John Doe',
                          degree: 'bachelor',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
          OpenBadgeCredentialDescriptor: {
            success: true,
            credential_query_id: 'OpenBadgeCredentialDescriptor',
            failed_credentials: expect.any(Array),

            valid_credentials: [
              {
                record: expect.any(SdJwtVcRecord),
                input_credential_index: 1,
                success: true,
                trusted_authorities: { success: true },
                meta: {
                  output: {
                    credential_format: 'dc+sd-jwt',
                    vct: 'OpenBadgeCredential',
                    cryptographic_holder_binding: true,
                  },
                  success: true,
                },
                claims: {
                  success: true,
                  failed_claim_sets: undefined,
                  failed_claims: undefined,
                  valid_claims: [
                    {
                      output: {
                        university: 'innsbruck',
                      },
                      claim_index: 0,
                      claim_id: undefined,
                      success: true,
                    },
                  ],
                  valid_claim_sets: [
                    {
                      claim_set_index: undefined,
                      valid_claim_indexes: [0],
                      success: true,
                      output: {
                        cnf: {
                          kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                        },
                        degree: 'bachelor',
                        iat: expect.any(Number),
                        iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
                        university: 'innsbruck',
                        vct: 'OpenBadgeCredential',
                      },
                    },
                  ],
                },
              },
            ],
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
        credentialId: 'OpenBadgeCredentialDescriptor',
        decoded: {
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          transaction_data_hashes_alg: ['sha-256'],
          type: 'OpenBadgeTx',
        },
        encoded:
          'eyJ0eXBlIjoiT3BlbkJhZGdlVHgiLCJjcmVkZW50aWFsX2lkcyI6WyJPcGVuQmFkZ2VDcmVkZW50aWFsRGVzY3JpcHRvciJdLCJ0cmFuc2FjdGlvbl9kYXRhX2hhc2hlc19hbGciOlsic2hhLTI1NiJdfQ',
        transactionDataIndex: 0,
        presentations: [
          {
            presentationHashIndex: 0,
            hash: 'XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s',
            hashAlg: 'sha-256',
          },
        ],
      },
    ])
    const sdJwtPresentation = dcql?.presentations.OpenBadgeCredentialDescriptor?.[0] as SdJwtVc

    expect(sdJwtPresentation.kbJwt?.payload).toMatchObject({
      transaction_data_hashes: ['XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s'],
      transaction_data_hashes_alg: 'sha-256',
    })
    expect(sdJwtPresentation.prettyClaims).toEqual({
      vct: 'OpenBadgeCredential',
      degree: 'bachelor',
      cnf: expect.any(Object),
      iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
      iat: expect.any(Number),
      university: 'innsbruck', // TODO: I Think this should be disclosed
    })

    const presentation = dcql?.presentations.orgeuuniversity?.[0] as MdocDeviceResponse
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

import type { DcqlQuery, MdocDeviceResponse, SdJwtVc, W3cV2SdJwtVerifiablePresentation } from '@credo-ts/core'
import {
  ClaimFormat,
  DateOnly,
  Kms,
  MdocRecord,
  SdJwtVcRecord,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  W3cV2Credential,
  W3cV2CredentialSubject,
  W3cV2Issuer,
  X509Module,
  X509Service,
  asArray,
  parseDid,
  w3cDate,
} from '@credo-ts/core'
import express, { type Express } from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { TenantsModule } from '../../tenants/src'
import { OpenId4VcModule, OpenId4VcVerificationSessionState, type OpenId4VcVerifierModuleConfigOptions } from '../src'
import type { AgentType, TenantType } from './utils'
import { createAgentFromModules, createTenantForAgent, waitForVerificationSessionRecordSubject } from './utils'
import { openBadgeDcqlQuery, universityDegreeDcqlQuery } from './utilsVp'

const serverPort = 1234
const baseUrl = `http://localhost:${serverPort}`
const verificationBaseUrl = `${baseUrl}/oid4vp`

describe('OpenID4VP 1.0', () => {
  let expressApp: Express
  let clearNock: () => void

  let holder: AgentType<{
    openid4vc: OpenId4VcModule
    tenants: TenantsModule<{ openid4vc: OpenId4VcModule }>
  }>
  let holder1: TenantType

  let verifier: AgentType<{
    openid4vc: OpenId4VcModule<undefined, OpenId4VcVerifierModuleConfigOptions>
    tenants: TenantsModule<{ openid4vc: OpenId4VcModule<undefined, OpenId4VcVerifierModuleConfigOptions> }>
  }>
  let verifier1: TenantType
  let verifier2: TenantType

  beforeEach(async () => {
    expressApp = express()

    holder = (await createAgentFromModules(
      {
        openid4vc: new OpenId4VcModule(),
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
      {
        openid4vc: new OpenId4VcModule({
          verifier: {
            baseUrl: verificationBaseUrl,
          },
        }),
        inMemory: new InMemoryWalletModule(),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598f',
      global.fetch
    )) as unknown as typeof verifier
    verifier1 = await createTenantForAgent(verifier.agent, 'vTenant1')
    verifier2 = await createTenantForAgent(verifier.agent, 'vTenant2')

    expressApp.use('/oid4vp', verifier.agent.openid4vc.verifier.config.router)

    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()

    await holder.agent.shutdown()
    await verifier.agent.shutdown()
  })

  it('e2e flow with tenants, verifier endpoints verifying a jwt-vc', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.openid4vc.verifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.openid4vc.verifier.createVerifier()

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
      await verifierTenant1.openid4vc.verifier.createAuthorizationRequest({
        verifierId: openIdVerifierTenant1.verifierId,
        requestSigner: {
          method: 'did',
          didUrl: verifier1.verificationMethod.id,
        },
        dcql: {
          query: openBadgeDcqlQuery,
        },
        version: 'v1',
      })

    expect(authorizationRequestUri1).toEqual(
      `openid4vp://?client_id=decentralized_identifier%3A${encodeURIComponent(verifier1.did)}&request_uri=${encodeURIComponent(
        verificationSession1.authorizationRequestUri as string
      )}`
    )

    const { authorizationRequest: authorizationRequestUri2, verificationSession: verificationSession2 } =
      await verifierTenant2.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier2.verificationMethod.id,
        },
        dcql: {
          query: universityDegreeDcqlQuery,
        },
        verifierId: openIdVerifierTenant2.verifierId,
        version: 'v1',
      })

    expect(authorizationRequestUri2).toEqual(
      `openid4vp://?client_id=decentralized_identifier%3A${encodeURIComponent(verifier2.did)}&request_uri=${encodeURIComponent(
        verificationSession2.authorizationRequestUri as string
      )}`
    )

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()

    const resolvedProofRequest1 =
      await holderTenant.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequestUri1)

    expect(resolvedProofRequest1.dcql?.queryResult).toMatchObject({
      can_be_satisfied: true,
      credential_matches: {
        OpenBadgeCredentialDescriptor: {
          success: true,
          valid_credentials: [
            {
              record: {
                credential: {
                  type: ['VerifiableCredential', 'OpenBadgeCredential'],
                },
              },
            },
          ],
        },
      },
    })

    const resolvedProofRequest2 =
      await holderTenant.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequestUri2)

    expect(resolvedProofRequest2.dcql?.queryResult).toMatchObject({
      can_be_satisfied: true,
      credential_matches: {
        UniversityDegree: {
          success: true,
          valid_credentials: [
            {
              record: {
                credential: {
                  type: ['VerifiableCredential', 'UniversityDegreeCredential'],
                },
              },
            },
          ],
        },
      },
    })

    if (!resolvedProofRequest1.dcql || !resolvedProofRequest2.dcql) {
      throw new Error('dcql not defined')
    }

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedProofRequest1.dcql.queryResult
    )

    const { authorizationResponsePayload: authorizationREsponsePayload1, serverResponse: serverResponse1 } =
      await holderTenant.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedProofRequest1.authorizationRequestPayload,
        dcql: {
          credentials: selectedCredentials,
        },
      })

    expect(authorizationREsponsePayload1).toEqual({
      state: expect.any(String),
      vp_token: {
        OpenBadgeCredentialDescriptor: [expect.any(String)],
      },
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

    const { dcql } = await verifierTenant1_2.openid4vc.verifier.getVerifiedAuthorizationResponse(
      verificationSession1.id
    )
    expect(dcql).toMatchObject({
      query: openBadgeDcqlQuery,
      presentations: {
        OpenBadgeCredentialDescriptor: [
          {
            verifiableCredential: [
              {
                type: ['VerifiableCredential', 'OpenBadgeCredential'],
                credentialSubject: {
                  id: holder1.did,
                },
              },
            ],
          },
        ],
      },
    })

    const selectedCredentials2 = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedProofRequest2.dcql.queryResult
    )

    const { serverResponse: serverResponse2 } = await holderTenant.openid4vc.holder.acceptOpenId4VpAuthorizationRequest(
      {
        authorizationRequestPayload: resolvedProofRequest2.authorizationRequestPayload,
        dcql: {
          credentials: selectedCredentials2,
        },
      }
    )
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
    const { dcql: dcql2 } = await verifierTenant2_2.openid4vc.verifier.getVerifiedAuthorizationResponse(
      verificationSession2.id
    )

    expect(dcql2).toMatchObject({
      query: universityDegreeDcqlQuery,
      presentations: {
        UniversityDegree: [
          {
            verifiableCredential: [
              {
                type: ['VerifiableCredential', 'UniversityDegreeCredential'],
                credentialSubject: {
                  id: holder1.did,
                },
              },
            ],
          },
        ],
      },
    })
  })

  it('e2e flow with tenants, verifier endpoints verifying a W3C V2 SD-JWT', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.modules.openid4vc.verifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.modules.openid4vc.verifier.createVerifier()

    const signedCredential1 = await verifier.agent.w3cV2Credentials.signCredential({
      format: ClaimFormat.SdJwtW3cVc,
      credential: new W3cV2Credential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cV2Issuer({ id: verifier.did }),
        credentialSubject: new W3cV2CredentialSubject({ id: holder1.did, name: 'Hello' }),
        validFrom: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: verifier.verificationMethod.id,
      disclosureFrame: {
        credentialSubject: {
          _sd: ['name'],
        },
      },
      holder: { method: 'did', didUrl: holder1.kid },
    })

    const signedCredential2 = await verifier.agent.w3cV2Credentials.signCredential({
      format: ClaimFormat.SdJwtW3cVc,
      credential: new W3cV2Credential({
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: new W3cV2Issuer({ id: verifier.did }),
        credentialSubject: new W3cV2CredentialSubject({ id: holder1.did, name: 'World' }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: verifier.verificationMethod.id,
      disclosureFrame: {
        credentialSubject: {
          _sd: ['name'],
        },
      },
      holder: { method: 'did', didUrl: holder1.kid },
    })

    await holderTenant.w3cV2Credentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cV2Credentials.storeCredential({ credential: signedCredential2 })

    const { authorizationRequest: authorizationRequestUri1, verificationSession: verificationSession1 } =
      await verifierTenant1.modules.openid4vc.verifier.createAuthorizationRequest({
        verifierId: openIdVerifierTenant1.verifierId,
        requestSigner: {
          method: 'did',
          didUrl: verifier1.verificationMethod.id,
        },
        dcql: {
          query: {
            credentials: [
              {
                id: 'OpenBadgeCredentialDescriptor',
                format: 'vc+sd-jwt',
                meta: {
                  type_values: [['OpenBadgeCredential']],
                },
                claims: [
                  {
                    path: ['credentialSubject', 'name'],
                  },
                ],
              },
            ],
          },
        },
        version: 'v1',
      })

    expect(authorizationRequestUri1).toEqual(
      `openid4vp://?client_id=decentralized_identifier%3A${encodeURIComponent(verifier1.did)}&request_uri=${encodeURIComponent(
        verificationSession1.authorizationRequestUri as string
      )}`
    )

    const { authorizationRequest: authorizationRequestUri2, verificationSession: verificationSession2 } =
      await verifierTenant2.modules.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier2.verificationMethod.id,
        },
        dcql: {
          query: {
            credentials: [
              {
                id: 'UniversityDegree',
                format: 'vc+sd-jwt',
                meta: {
                  type_values: [['UniversityDegreeCredential']],
                },
                claims: [
                  {
                    path: ['credentialSubject', 'name'],
                  },
                ],
              },
            ],
          },
        },
        verifierId: openIdVerifierTenant2.verifierId,
        version: 'v1',
      })

    expect(authorizationRequestUri2).toEqual(
      `openid4vp://?client_id=decentralized_identifier%3A${encodeURIComponent(verifier2.did)}&request_uri=${encodeURIComponent(
        verificationSession2.authorizationRequestUri as string
      )}`
    )

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()

    const resolvedProofRequest1 =
      await holderTenant.modules.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequestUri1)

    expect(resolvedProofRequest1.dcql?.queryResult).toMatchObject({
      can_be_satisfied: true,
      credential_matches: {
        OpenBadgeCredentialDescriptor: {
          success: true,
          valid_credentials: [
            {
              record: {
                credential: {
                  resolvedCredential: {
                    type: ['VerifiableCredential', 'OpenBadgeCredential'],
                  },
                },
              },
            },
          ],
        },
      },
    })

    const resolvedProofRequest2 =
      await holderTenant.modules.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequestUri2)

    expect(resolvedProofRequest2.dcql?.queryResult).toMatchObject({
      can_be_satisfied: true,
      credential_matches: {
        UniversityDegree: {
          success: true,
          valid_credentials: [
            {
              record: {
                credential: {
                  resolvedCredential: {
                    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
                  },
                },
              },
            },
          ],
        },
      },
    })

    if (!resolvedProofRequest1.dcql || !resolvedProofRequest2.dcql) {
      throw new Error('dcql not defined')
    }

    const selectedCredentials = holder.agent.modules.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedProofRequest1.dcql.queryResult
    )

    const { authorizationResponsePayload: authorizationREsponsePayload1, serverResponse: serverResponse1 } =
      await holderTenant.modules.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedProofRequest1.authorizationRequestPayload,
        dcql: {
          credentials: selectedCredentials,
        },
      })

    expect(authorizationREsponsePayload1).toEqual({
      state: expect.any(String),
      vp_token: {
        OpenBadgeCredentialDescriptor: [expect.any(String)],
      },
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

    const { dcql } = await verifierTenant1_2.modules.openid4vc.verifier.getVerifiedAuthorizationResponse(
      verificationSession1.id
    )
    expect(dcql).toMatchObject({
      query: {
        credentials: [
          {
            format: 'vc+sd-jwt',
            meta: {
              type_values: [['OpenBadgeCredential']],
            },
            id: 'OpenBadgeCredentialDescriptor',
          },
        ],
      },
      presentations: {
        OpenBadgeCredentialDescriptor: [
          {
            resolvedPresentation: {
              verifiableCredential: [
                {
                  type: 'EnvelopedVerifiableCredential',
                },
              ],
            },
          },
        ],
      },
    })
    expect(
      asArray(
        (dcql?.presentations.OpenBadgeCredentialDescriptor[0] as W3cV2SdJwtVerifiablePresentation).resolvedPresentation
          .verifiableCredential
      )[0].resolvedCredential
    ).toMatchObject({
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      credentialSubject: {
        id: holder1.did,
      },
    })

    const selectedCredentials2 = holder.agent.modules.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedProofRequest2.dcql.queryResult
    )

    const { serverResponse: serverResponse2 } =
      await holderTenant.modules.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedProofRequest2.authorizationRequestPayload,
        dcql: {
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
    const { dcql: dcql2 } = await verifierTenant2_2.modules.openid4vc.verifier.getVerifiedAuthorizationResponse(
      verificationSession2.id
    )

    expect(dcql2).toMatchObject({
      query: {
        credentials: [
          {
            format: 'vc+sd-jwt',
            meta: {
              type_values: [['UniversityDegreeCredential']],
            },
            id: 'UniversityDegree',
          },
        ],
      },
      presentations: {
        UniversityDegree: [
          {
            resolvedPresentation: {
              verifiableCredential: [
                {
                  type: 'EnvelopedVerifiableCredential',
                },
              ],
            },
          },
        ],
      },
    })
    expect(
      asArray(
        (dcql2?.presentations.UniversityDegree[0] as W3cV2SdJwtVerifiablePresentation).resolvedPresentation
          .verifiableCredential
      )[0].resolvedCredential
    ).toMatchObject({
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
      credentialSubject: {
        id: holder1.did,
      },
    })
  })

  it('Invalid verifier attestation in combination with dcql', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

    const certificate = await verifier.agent.x509.createCertificate({
      issuer: { commonName: 'Credo', countryName: 'NL' },
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'localhost' }] } },
    })

    verifier.agent.x509.config.addTrustedCertificate(certificate.toString('base64'))

    await expect(
      verifier.agent.openid4vc.verifier.createAuthorizationRequest({
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
            transaction_data_hasheks_alg: ['sha-256'],
            some_extra_prop: 'is_allowed',
          },
        ],
        dcql: {
          query: {
            credentials: [{ id: 'SomeDifferentId', format: 'mso_mdoc' }],
          },
        },
        verifierInfo: [{ format: 'jwt', data: { hello: 'world' }, credential_ids: ['SomeOtherId'] }],
        version: 'v1',
      })
    ).rejects.toThrow(
      'Verifier info (attestations) were provided, but the verifier info used credential ids that are not present in the query'
    )
  })

  it('e2e flow (jarm) with verifier endpoints verifying a sd-jwt-vc with selective disclosure (transaction data)', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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

    const dcqlQuery = {
      credentials: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: 'dc+sd-jwt',
          meta: {
            vct_values: ['OpenBadgeCredential'],
          },
          claims: [
            {
              path: ['university'],
            },
          ],
        },
      ],
    } satisfies DcqlQuery

    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
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
        dcql: {
          query: dcqlQuery,
        },
        verifierInfo: [{ format: 'jwt', data: { hello: 'world' }, credential_ids: ['OpenBadgeCredentialDescriptor'] }],
        version: 'v1',
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)
    expect(resolvedAuthorizationRequest.authorizationRequestPayload.response_mode).toEqual('direct_post.jwt')

    expect(resolvedAuthorizationRequest.authorizationRequestPayload).toMatchObject({
      verifier_info: [{ format: 'jwt', data: { hello: 'world' } }],
    })

    expect(resolvedAuthorizationRequest.dcql?.queryResult).toEqual({
      can_be_satisfied: true,
      credentials: expect.any(Array),
      credential_sets: undefined,
      credential_matches: {
        OpenBadgeCredentialDescriptor: {
          success: true,
          credential_query_id: 'OpenBadgeCredentialDescriptor',
          failed_credentials: expect.any(Array),
          valid_credentials: [
            {
              input_credential_index: 0,
              success: true,
              claims: {
                failed_claim_sets: undefined,
                failed_claims: undefined,
                valid_claims: expect.any(Array),
                success: true,
                valid_claim_sets: [
                  {
                    claim_set_index: undefined,
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
                    valid_claim_indexes: [0],
                  },
                ],
              },
              trusted_authorities: {
                success: true,
              },
              meta: expect.any(Object),
              record: expect.any(SdJwtVcRecord),
            },
          ],
        },
      },
    })

    if (!resolvedAuthorizationRequest.dcql) {
      throw new Error('DCQL not defined')
    }

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        dcql: {
          credentials: selectedCredentials,
        },
        transactionData: [{ credentialId: 'OpenBadgeCredentialDescriptor' }],
      })

    expect(authorizationResponsePayload).toEqual({
      state: expect.any(String),
      vp_token: {
        OpenBadgeCredentialDescriptor: [expect.any(String)],
      },
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
    const { dcql, transactionData: _transactionData } =
      await verifier.agent.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession.id)

    const presentation = dcql?.presentations.OpenBadgeCredentialDescriptor[0] as SdJwtVc
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

    expect(dcql).toEqual({
      query: expect.any(Object),
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
      presentations: {
        OpenBadgeCredentialDescriptor: [
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
      },
    })
  })

  it('e2e flow with unsiged request (redirect_uri)', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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

    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)
    const dcqlQuery = {
      credentials: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: 'dc+sd-jwt',
          meta: {
            vct_values: ['OpenBadgeCredential'],
          },
          claims: [
            {
              path: ['university'],
            },
          ],
        },
      ],
    } satisfies DcqlQuery

    const { authorizationRequest, authorizationRequestObject, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'none',
        },
        responseMode: 'direct_post',
        dcql: {
          query: dcqlQuery,
        },
        version: 'v1',
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?response_type=vp_token&client_id=redirect_uri%3A${encodeURIComponent(authorizationRequestObject.response_uri as string)}&response_uri=${encodeURIComponent(authorizationRequestObject.response_uri as string)}&response_mode=direct_post&nonce=${authorizationRequestObject.nonce}&dcql_query=%7B%22credentials%22%3A%5B%7B%22id%22%3A%22OpenBadgeCredentialDescriptor%22%2C%22format%22%3A%22dc%2Bsd-jwt%22%2C%22meta%22%3A%7B%22vct_values%22%3A%5B%22OpenBadgeCredential%22%5D%7D%2C%22claims%22%3A%5B%7B%22path%22%3A%5B%22university%22%5D%7D%5D%7D%5D%7D&client_metadata=%7B%22vp_formats_supported%22%3A%7B%22dc%2Bsd-jwt%22%3A%7B%22sd-jwt_alg_values%22%3A%5B%22HS256%22%2C%22HS384%22%2C%22HS512%22%2C%22RS256%22%2C%22RS384%22%2C%22RS512%22%2C%22ES256%22%2C%22ES384%22%2C%22ES512%22%2C%22PS256%22%2C%22PS384%22%2C%22PS512%22%2C%22EdDSA%22%2C%22ES256K%22%5D%2C%22kb-jwt_alg_values%22%3A%5B%22HS256%22%2C%22HS384%22%2C%22HS512%22%2C%22RS256%22%2C%22RS384%22%2C%22RS512%22%2C%22ES256%22%2C%22ES384%22%2C%22ES512%22%2C%22PS256%22%2C%22PS384%22%2C%22PS512%22%2C%22EdDSA%22%2C%22ES256K%22%5D%7D%7D%2C%22response_types_supported%22%3A%5B%22vp_token%22%5D%7D&state=${authorizationRequestObject.state}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.signedAuthorizationRequest).toBeUndefined()
    expect(resolvedAuthorizationRequest.verifier).toEqual({
      clientIdPrefix: 'redirect_uri',
      clientMetadata: expect.any(Object),
      effectiveClientId: `redirect_uri:${authorizationRequestObject.response_uri}`,
    })

    expect(resolvedAuthorizationRequest.dcql?.queryResult.can_be_satisfied).toEqual(true)
    if (!resolvedAuthorizationRequest.dcql) {
      throw new Error('dcql not defined')
    }

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        dcql: {
          credentials: selectedCredentials,
        },
      })

    expect(authorizationResponsePayload).toEqual({
      state: expect.any(String),
      vp_token: {
        OpenBadgeCredentialDescriptor: [expect.any(String)],
      },
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
  })

  it('e2e flow with verifier endpoints verifying a sd-jwt-vc with selective disclosure', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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

    const dcqlQuery = {
      credentials: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: 'dc+sd-jwt',
          meta: {
            vct_values: ['OpenBadgeCredential'],
          },
          claims: [
            {
              path: ['university'],
            },
          ],
        },
      ],
    } satisfies DcqlQuery

    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
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
        dcql: {
          query: dcqlQuery,
        },
        version: 'v1',
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.dcql?.queryResult).toEqual({
      can_be_satisfied: true,
      credentials: expect.any(Array),
      credential_sets: undefined,
      credential_matches: {
        OpenBadgeCredentialDescriptor: {
          success: true,
          credential_query_id: 'OpenBadgeCredentialDescriptor',
          failed_credentials: expect.any(Array),
          valid_credentials: [
            {
              input_credential_index: 0,
              success: true,
              claims: {
                failed_claim_sets: undefined,
                failed_claims: undefined,
                valid_claims: expect.any(Array),
                success: true,
                valid_claim_sets: [
                  {
                    claim_set_index: undefined,
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
                    valid_claim_indexes: [0],
                  },
                ],
              },
              trusted_authorities: {
                success: true,
              },
              meta: expect.any(Object),
              record: expect.any(SdJwtVcRecord),
            },
          ],
        },
      },
    })

    if (!resolvedAuthorizationRequest.dcql) {
      throw new Error('DCQL not defined')
    }

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        dcql: {
          credentials: selectedCredentials,
        },
        transactionData: [{ credentialId: 'OpenBadgeCredentialDescriptor' }],
      })

    expect(authorizationResponsePayload).toEqual({
      state: expect.any(String),
      vp_token: {
        OpenBadgeCredentialDescriptor: [expect.any(String)],
      },
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
    const { dcql } = await verifier.agent.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession.id)

    const presentation = dcql?.presentations.OpenBadgeCredentialDescriptor[0] as SdJwtVc

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

    expect(dcql).toEqual({
      query: expect.any(Object),
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
      presentations: {
        OpenBadgeCredentialDescriptor: [
          {
            encoded: expect.any(String),
            claimFormat: ClaimFormat.SdJwtDc,
            compact: expect.any(String),
            header: {
              alg: 'EdDSA',
              kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
              typ: 'vc+sd-jwt',
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
                transaction_data_hashes: ['XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s'],
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
      },
    })
  })

  it('e2e flow with verifier endpoints verifying multiple sd-jwt-vc for a single credential query', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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
    const signedSdJwtVc2 = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential',
        university: 'utrecht',
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
    await holder.agent.sdJwtVc.store(signedSdJwtVc2.compact)

    holder.agent.x509.config.addTrustedCertificate(rawCertificate)
    verifier.agent.x509.config.addTrustedCertificate(rawCertificate)

    const dcqlQuery = {
      credentials: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: 'dc+sd-jwt',
          meta: {
            vct_values: ['OpenBadgeCredential'],
          },
          multiple: true,
          claims: [
            {
              path: ['university'],
            },
          ],
        },
      ],
    } satisfies DcqlQuery

    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
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
        dcql: {
          query: dcqlQuery,
        },
        version: 'v1',
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.dcql?.queryResult).toEqual({
      can_be_satisfied: true,
      credentials: expect.any(Array),
      credential_sets: undefined,
      credential_matches: {
        OpenBadgeCredentialDescriptor: {
          success: true,
          credential_query_id: 'OpenBadgeCredentialDescriptor',
          failed_credentials: expect.any(Array),
          valid_credentials: [
            {
              input_credential_index: 0,
              success: true,
              claims: {
                failed_claim_sets: undefined,
                failed_claims: undefined,
                valid_claims: expect.any(Array),
                success: true,
                valid_claim_sets: [
                  {
                    claim_set_index: undefined,
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
                    valid_claim_indexes: [0],
                  },
                ],
              },
              trusted_authorities: {
                success: true,
              },
              meta: expect.any(Object),
              record: expect.any(SdJwtVcRecord),
            },
            {
              input_credential_index: 2,
              success: true,
              claims: {
                failed_claim_sets: undefined,
                failed_claims: undefined,
                valid_claims: expect.any(Array),
                success: true,
                valid_claim_sets: [
                  {
                    claim_set_index: undefined,
                    success: true,
                    output: {
                      cnf: {
                        kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                      },
                      degree: 'bachelor',
                      iat: expect.any(Number),
                      iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
                      university: 'utrecht',
                      vct: 'OpenBadgeCredential',
                    },
                    valid_claim_indexes: [0],
                  },
                ],
              },
              trusted_authorities: {
                success: true,
              },
              meta: expect.any(Object),
              record: expect.any(SdJwtVcRecord),
            },
          ],
        },
      },
    })

    if (!resolvedAuthorizationRequest.dcql) {
      throw new Error('DCQL not defined')
    }

    const validCredentials =
      resolvedAuthorizationRequest.dcql?.queryResult.credential_matches.OpenBadgeCredentialDescriptor.valid_credentials

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        dcql: {
          credentials: {
            OpenBadgeCredentialDescriptor: [
              {
                claimFormat: ClaimFormat.SdJwtDc,
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                credentialRecord: (validCredentials?.[0] as any).record,
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                disclosedPayload: (validCredentials?.[0] as any).claims.valid_claim_sets[0].output,
              },
              {
                claimFormat: ClaimFormat.SdJwtDc,
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                credentialRecord: (validCredentials?.[1] as any).record,
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                disclosedPayload: (validCredentials?.[1] as any).claims.valid_claim_sets[0].output,
              },
            ],
          },
        },
        transactionData: [{ credentialId: 'OpenBadgeCredentialDescriptor' }],
      })

    expect(authorizationResponsePayload).toEqual({
      state: expect.any(String),
      vp_token: {
        OpenBadgeCredentialDescriptor: [expect.any(String), expect.any(String)],
      },
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
    const { dcql } = await verifier.agent.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession.id)

    const presentation = dcql?.presentations.OpenBadgeCredentialDescriptor[0] as SdJwtVc
    const presentation1 = dcql?.presentations.OpenBadgeCredentialDescriptor[1] as SdJwtVc

    const signedTransactionDataHashes = {
      transaction_data_hashes: ['XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s'],
      transaction_data_hashes_alg: 'sha-256',
    }
    expect(presentation.kbJwt?.payload).toMatchObject(signedTransactionDataHashes)
    expect(presentation1.kbJwt?.payload).toMatchObject(signedTransactionDataHashes)

    // name SHOULD NOT be disclosed
    expect(presentation.prettyClaims).not.toHaveProperty('name')
    expect(presentation1.prettyClaims).not.toHaveProperty('name')

    // university and name SHOULD NOT be in the signed payload
    expect(presentation.payload).not.toHaveProperty('university')
    expect(presentation.payload).not.toHaveProperty('name')

    expect(presentation1.payload).not.toHaveProperty('university')
    expect(presentation1.payload).not.toHaveProperty('name')

    expect(dcql).toEqual({
      query: expect.any(Object),
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
      presentations: {
        OpenBadgeCredentialDescriptor: [
          {
            encoded: expect.any(String),
            claimFormat: ClaimFormat.SdJwtDc,
            compact: expect.any(String),
            header: {
              alg: 'EdDSA',
              kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
              typ: 'vc+sd-jwt',
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
                transaction_data_hashes: ['XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s'],
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
          {
            encoded: expect.any(String),
            claimFormat: ClaimFormat.SdJwtDc,
            compact: expect.any(String),
            header: {
              alg: 'EdDSA',
              kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
              typ: 'vc+sd-jwt',
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
                transaction_data_hashes: ['XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s'],
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
              university: 'utrecht',
            },
          },
        ],
      },
    })
  })

  it('e2e flow with verifier endpoints verifying two sd-jwt-vcs with selective disclosure', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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

    const dcqlQuery = {
      credentials: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: 'dc+sd-jwt',
          meta: {
            vct_values: ['OpenBadgeCredential'],
          },
          claims: [
            {
              path: ['university'],
            },
          ],
        },
        {
          id: 'OpenBadgeCredentialDescriptor2',
          format: 'dc+sd-jwt',
          meta: {
            vct_values: ['OpenBadgeCredential2'],
          },
          claims: [
            {
              path: ['name'],
            },
          ],
        },
      ],
    } satisfies DcqlQuery

    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        verifierId: openIdVerifier.verifierId,

        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        dcql: {
          query: dcqlQuery,
        },
        transactionData: [
          { type: 'type1', credential_ids: ['OpenBadgeCredentialDescriptor'] },
          { type: 'type2', credential_ids: ['OpenBadgeCredentialDescriptor2'] },
        ],
        version: 'v1',
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

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

    expect(resolvedAuthorizationRequest.dcql?.queryResult).toEqual({
      can_be_satisfied: true,
      credentials: expect.any(Array),
      credential_sets: undefined,
      credential_matches: {
        OpenBadgeCredentialDescriptor: {
          success: true,
          credential_query_id: 'OpenBadgeCredentialDescriptor',
          failed_credentials: expect.any(Array),
          valid_credentials: [
            {
              input_credential_index: 0,
              success: true,
              claims: {
                failed_claim_sets: undefined,
                failed_claims: undefined,
                valid_claims: expect.any(Array),
                success: true,
                valid_claim_sets: [
                  {
                    claim_set_index: undefined,
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
                    valid_claim_indexes: [0],
                  },
                ],
              },
              trusted_authorities: {
                success: true,
              },
              meta: expect.any(Object),
              record: expect.any(SdJwtVcRecord),
            },
          ],
        },
        OpenBadgeCredentialDescriptor2: {
          success: true,
          credential_query_id: 'OpenBadgeCredentialDescriptor2',
          failed_credentials: expect.any(Array),
          valid_credentials: [
            {
              input_credential_index: 2,
              success: true,
              claims: {
                failed_claim_sets: undefined,
                failed_claims: undefined,
                valid_claims: expect.any(Array),
                success: true,
                valid_claim_sets: [
                  {
                    claim_set_index: undefined,
                    success: true,
                    output: {
                      cnf: {
                        kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
                      },
                      degree: 'bachelor2',
                      iat: expect.any(Number),
                      iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
                      name: 'John Doe2',
                      vct: 'OpenBadgeCredential2',
                    },
                    valid_claim_indexes: [0],
                  },
                ],
              },
              trusted_authorities: {
                success: true,
              },
              meta: expect.any(Object),
              record: expect.any(SdJwtVcRecord),
            },
          ],
        },
      },
    })

    if (!resolvedAuthorizationRequest.dcql) {
      throw new Error('DCQL not defined')
    }

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        dcql: {
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

    expect(authorizationResponsePayload).toEqual({
      state: expect.any(String),
      vp_token: {
        OpenBadgeCredentialDescriptor: [expect.any(String)],
        OpenBadgeCredentialDescriptor2: [expect.any(String)],
      },
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
    const { dcql, transactionData: tdResult } =
      await verifier.agent.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession.id)

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

    const presentation = dcql?.presentations.OpenBadgeCredentialDescriptor[0] as SdJwtVc
    const presentation2 = dcql?.presentations.OpenBadgeCredentialDescriptor2[0] as SdJwtVc
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
    expect(presentation2.kbJwt?.payload).toMatchObject(signedTransactionDataHashes2)

    // university and name SHOULD NOT be in the signed payload
    expect(presentation.payload).not.toHaveProperty('university')
    expect(presentation.payload).not.toHaveProperty('name')

    expect(dcql).toEqual({
      query: expect.any(Object),
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
      presentations: {
        OpenBadgeCredentialDescriptor: [
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
                transaction_data_hashes: ['TU8fKqfA_X6SXn3RCGR9ENeO1h4KXacyAPpxxhzBwJ4'],
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
        OpenBadgeCredentialDescriptor2: [
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
            // university SHOULD be disclosed
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
      },
    })
  })

  it('e2e flow with verifier endpoints verifying a mdoc allowed with direct_post', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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

    const dcqlQuery = {
      credentials: [
        {
          format: 'mso_mdoc',
          id: 'university',
          meta: { doctype_value: 'org.eu.university' },
          claims: [
            {
              path: ['eu.europa.ec.eudi.pid.1', 'name'],
            },
            {
              path: ['eu.europa.ec.eudi.pid.1', 'degree'],
            },
          ],
        },
      ],
    } satisfies DcqlQuery

    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        responseMode: 'direct_post',
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        dcql: { query: dcqlQuery },
        version: 'v1',
      })

    const resolvedAuthorizationRequest =
      await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    if (!resolvedAuthorizationRequest.dcql) {
      throw new Error('DCQL not defined')
    }

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const result = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
      dcql: {
        credentials: selectedCredentials,
      },
    })

    expect(result.ok).toBe(true)
    expect(result.serverResponse).toMatchObject({
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
  })

  it('e2e flow with verifier endpoints verifying a mdoc and sd-jwt (jarm)', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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

    const dcqlQuery = {
      credentials: [
        {
          id: 'OpenBadgeCredentialDescriptor',
          format: 'dc+sd-jwt',
          meta: {
            vct_values: ['OpenBadgeCredential'],
          },
          claims: [
            {
              path: ['university'],
            },
          ],
        },
        {
          format: 'mso_mdoc',
          id: 'university',
          meta: { doctype_value: 'org.eu.university' },
          claims: [
            {
              path: ['eu.europa.ec.eudi.pid.1', 'name'],
            },
            {
              path: ['eu.europa.ec.eudi.pid.1', 'degree'],
            },
          ],
        },
      ],
    } satisfies DcqlQuery

    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        responseMode: 'direct_post.jwt',
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [certificate],
        },
        dcql: {
          query: dcqlQuery,
        },
        version: 'v1',
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=x509_san_dns%3Alocalhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}`
    )

    const resolvedAuthorizationRequest =
      await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.dcql?.queryResult).toEqual({
      credentials: [
        {
          multiple: false,
          require_cryptographic_holder_binding: true,
          id: 'OpenBadgeCredentialDescriptor',
          format: 'dc+sd-jwt',
          claims: [{ path: ['university'] }],
          meta: { vct_values: ['OpenBadgeCredential'] },
        },
        {
          multiple: false,
          require_cryptographic_holder_binding: true,
          id: 'university',
          format: 'mso_mdoc',
          claims: [{ path: ['eu.europa.ec.eudi.pid.1', 'name'] }, { path: ['eu.europa.ec.eudi.pid.1', 'degree'] }],
          meta: { doctype_value: 'org.eu.university' },
        },
      ],
      can_be_satisfied: true,
      credential_matches: {
        university: {
          credential_query_id: 'university',
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
                    valid_claim_indexes: [0, 1],
                    output: {
                      'eu.europa.ec.eudi.pid.1': {
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
    })

    if (!resolvedAuthorizationRequest.dcql) {
      throw new Error('DCQL not defined')
    }

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
        dcql: {
          credentials: selectedCredentials,
        },
      })

    // path_nested should not be used for sd-jwt
    expect(authorizationResponsePayload.presentation_submission?.descriptor_map[0].path_nested).toBeUndefined()
    expect(authorizationResponsePayload).toEqual({
      state: expect.any(String),
      vp_token: {
        OpenBadgeCredentialDescriptor: [expect.any(String)],
        university: [expect.any(String)],
      },
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
    const { dcql } = await verifier.agent.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession.id)

    const mdocPresentation = dcql?.presentations.university[0] as MdocDeviceResponse
    expect(mdocPresentation.documents).toHaveLength(1)

    const mdocResponse = mdocPresentation.documents[0]

    // name SHOULD NOT be disclosed
    expect(mdocResponse.issuerSignedNamespaces).toStrictEqual({
      'eu.europa.ec.eudi.pid.1': {
        degree: 'bachelor',
        name: 'John Doe',
      },
    })

    expect(dcql).toEqual({
      query: expect.any(Object),
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
      presentations: {
        OpenBadgeCredentialDescriptor: [
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
        university: [
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
        ],
      },
    })
  })

  it('e2e flow with verifier endpoints verifying a mdoc and sd-jwt (jarm) (dcql) (transaction data)', async () => {
    const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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
          id: 'university',
          format: ClaimFormat.MsoMdoc,
          meta: { doctype_value: 'org.eu.university' },
          claims: [
            { path: ['eu.europa.ec.eudi.pid.1', 'name'] },
            { path: ['eu.europa.ec.eudi.pid.1', 'degree'] },
            { path: ['eu.europa.ec.eudi.pid.1', 'date'] },
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
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
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
        version: 'v1',
      })

    const resolvedAuthorizationRequest =
      await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)

    expect(resolvedAuthorizationRequest.dcql).toEqual({
      queryResult: {
        credentials: [
          {
            multiple: false,
            require_cryptographic_holder_binding: true,
            id: 'university',
            format: 'mso_mdoc',
            claims: [
              { path: ['eu.europa.ec.eudi.pid.1', 'name'] },
              { path: ['eu.europa.ec.eudi.pid.1', 'degree'] },
              { path: ['eu.europa.ec.eudi.pid.1', 'date'] },
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
          university: {
            credential_query_id: 'university',
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
                          name: 'John Doe',
                          degree: 'bachelor',
                          date,
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

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const { serverResponse, authorizationResponsePayload } =
      await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
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

    const { dcql, transactionData } = await verifier.agent.openid4vc.verifier.getVerifiedAuthorizationResponse(
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
        presentations: [
          {
            presentationHashIndex: 0,
            hash: 'XwyVd7wFREdVWLpni5QNHggNWXo2J4Ln58t2_ecJ73s',
            hashAlg: 'sha-256',
          },
        ],
        transactionDataIndex: 0,
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

    const presentation = dcql?.presentations.university?.[0] as MdocDeviceResponse
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

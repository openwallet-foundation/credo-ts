import type { DcqlQuery, X509Certificate } from '@credo-ts/core'
import { OpenId4VcModule, type OpenId4VcVerifierModuleConfigOptions, OpenId4VcVerifierRecord } from '../src'
import type { AgentType } from './utils'

import {
  ClaimFormat,
  DateOnly,
  Kms,
  MdocDeviceResponse,
  MdocRecord,
  SdJwtVcRecord,
  X509Service,
  parseDid,
} from '@credo-ts/core'
import { TenantsModule } from '../../tenants/src'
import { OpenId4VcVerificationSessionState } from '../src'

import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { createAgentFromModules } from './utils'

const baseUrl = 'http://localhost:1234'
const verificationBaseUrl = `${baseUrl}/oid4vp`

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

const expectedDcqlResult = {
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
        multiple: false,
        require_cryptographic_holder_binding: true,
        meta: { doctype_value: 'org.eu.university' },
      },
      {
        id: 'OpenBadgeCredentialDescriptor',
        format: 'dc+sd-jwt',
        claims: [{ path: ['university'] }],
        meta: { vct_values: ['OpenBadgeCredential'] },
        multiple: false,
        require_cryptographic_holder_binding: true,
      },
    ],
    can_be_satisfied: true,
    credential_matches: {
      orgeuuniversity: {
        success: true,
        failed_credentials: expect.any(Array),
        valid_credentials: [
          {
            success: true,
            input_credential_index: 0,
            trusted_authorities: {
              success: true,
            },
            record: expect.any(MdocRecord),
            meta: {
              success: true,
              output: {
                cryptographic_holder_binding: true,
                doctype: 'org.eu.university',
                credential_format: 'mso_mdoc',
              },
            },
            claims: {
              valid_claim_sets: [
                {
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

        valid_credentials: [
          {
            meta: {
              output: {
                credential_format: 'dc+sd-jwt',
                vct: 'OpenBadgeCredential',
              },
            },
            claims: {
              valid_claim_sets: [
                {
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
            input_credential_index: 1,
            record: expect.any(SdJwtVcRecord),
          },
        ],
      },
    },
    credential_sets: undefined,
  },
}

describe('OpenId4VP DC API', () => {
  let holder: AgentType<{
    openid4vc: OpenId4VcModule
    tenants: TenantsModule<{ openid4vc: OpenId4VcModule }>
  }>

  let verifier: AgentType<{
    openid4vc: OpenId4VcModule<undefined, OpenId4VcVerifierModuleConfigOptions>
    tenants: TenantsModule<{ openid4vc: OpenId4VcModule<undefined, OpenId4VcVerifierModuleConfigOptions> }>
  }>
  let openIdVerifier: OpenId4VcVerifierRecord
  let verifierCertificate: X509Certificate

  beforeEach(async () => {
    holder = (await createAgentFromModules(
      {
        openid4vc: new OpenId4VcModule(),
        inMemory: new InMemoryWalletModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598e'
    )) as unknown as typeof holder

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
      '96213c3d7fc8d4d6754c7a0fd969598f'
    )) as unknown as typeof verifier

    openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

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
        commonName: 'Credo',
        countryName: 'DE',
      },
    })

    verifier.agent.x509.config.setTrustedCertificates([selfSignedCertificate.toString('pem')])

    const parsedDid = parseDid(verifier.kid)
    if (!parsedDid.fragment) {
      throw new Error(`didUrl '${parsedDid.didUrl}' does not contain a '#'. Unable to derive key from did document.`)
    }

    const holderKey = await holder.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const date = new DateOnly()
    const signedMdoc = await verifier.agent.mdoc.sign({
      docType: 'org.eu.university',
      holderKey: Kms.PublicJwk.fromPublicJwk(holderKey.publicJwk),
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

    verifierCertificate = await verifier.agent.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
      ),
      extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'localhost' }] } },
      issuer: { commonName: 'Something', countryName: 'Something' },
    })

    await holder.agent.mdoc.store(signedMdoc)

    holder.agent.x509.config.addTrustedCertificate(verifierCertificate)
    verifier.agent.x509.config.addTrustedCertificate(verifierCertificate)
  })

  afterEach(async () => {
    await holder.agent.shutdown()
    await verifier.agent.shutdown()
  })

  it('Digital Credentials API v1 with dcql, mdoc, sd-jwt, transaction data. unsigned, unencrypted', async () => {
    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        responseMode: 'dc_api',
        expectedOrigins: ['https://example.com'],
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'none',
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

    const resolvedAuthorizationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequest,
      {
        origin: 'https://example.com',
      }
    )

    expect(resolvedAuthorizationRequest.dcql).toMatchObject(expectedDcqlResult)
    if (!resolvedAuthorizationRequest.dcql) throw new Error('Dcql not defined')
    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const result = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
      dcql: {
        credentials: selectedCredentials,
      },
      origin: resolvedAuthorizationRequest.origin,
      transactionData: [
        {
          // Sign with first possible credential
          credentialId: resolvedAuthorizationRequest.transactionData?.[0].matchedCredentialIds[0] as string,
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      serverResponse: undefined,
      authorizationResponse: expect.any(Object),
      authorizationResponsePayload: expect.objectContaining({
        vp_token: {
          orgeuuniversity: [expect.any(String)],
          OpenBadgeCredentialDescriptor: [expect.any(String)],
        },
      }),
    })

    const { verificationSession: updatedVerificationSession, dcql } =
      await verifier.agent.openid4vc.verifier.verifyAuthorizationResponse({
        verificationSessionId: verificationSession.id,
        origin: resolvedAuthorizationRequest.origin,
        authorizationResponse: result.authorizationResponse,
      })

    expect(updatedVerificationSession.state).toEqual(OpenId4VcVerificationSessionState.ResponseVerified)
    expect(dcql).toEqual({
      query: expect.any(Object),
      presentations: {
        orgeuuniversity: [expect.any(MdocDeviceResponse)],
        OpenBadgeCredentialDescriptor: [
          expect.objectContaining({
            compact: expect.stringContaining('~'),
            kbJwt: expect.objectContaining({
              payload: expect.objectContaining({
                aud: 'origin:https://example.com',
              }),
            }),
          }),
        ],
      },
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
    })
  })

  it('Digital Credentials API v1 with dcql, mdoc, sd-jwt, transaction data. signed, encrypted', async () => {
    const { authorizationRequestObject, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        responseMode: 'dc_api.jwt',
        expectedOrigins: ['https://example.com'],
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [verifierCertificate],
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

    const resolvedAuthorizationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequestObject,
      {
        origin: 'https://example.com',
      }
    )

    expect(resolvedAuthorizationRequest.dcql).toMatchObject(expectedDcqlResult)
    if (!resolvedAuthorizationRequest.dcql) throw new Error('Dcql not defined')
    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const result = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
      dcql: {
        credentials: selectedCredentials,
      },
      origin: resolvedAuthorizationRequest.origin,
      transactionData: [
        {
          // Sign with first possible credential
          credentialId: resolvedAuthorizationRequest.transactionData?.[0].matchedCredentialIds[0] as string,
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      serverResponse: undefined,
      authorizationResponsePayload: expect.objectContaining({
        vp_token: {
          orgeuuniversity: [expect.any(String)],
          OpenBadgeCredentialDescriptor: [expect.any(String)],
        },
      }),
      authorizationResponse: {
        response: expect.any(String),
      },
    })

    const {
      verificationSession: updatedVerificationSession,
      dcql,
      transactionData,
    } = await verifier.agent.openid4vc.verifier.verifyAuthorizationResponse({
      verificationSessionId: verificationSession.id,
      origin: resolvedAuthorizationRequest.origin,
      authorizationResponse: result.authorizationResponse,
    })

    expect(updatedVerificationSession.state).toEqual(OpenId4VcVerificationSessionState.ResponseVerified)
    expect(dcql).toEqual({
      query: expect.any(Object),
      presentations: {
        orgeuuniversity: [expect.any(MdocDeviceResponse)],
        OpenBadgeCredentialDescriptor: [
          expect.objectContaining({
            compact: expect.stringContaining('~'),
            kbJwt: expect.objectContaining({
              payload: expect.objectContaining({
                // Should be origin: even though x509_san_dns client id is used
                aud: 'origin:https://example.com',
              }),
            }),
          }),
        ],
      },
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
    })
    expect(transactionData).toEqual([
      {
        decoded: {
          type: 'OpenBadgeTx',
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          transaction_data_hashes_alg: ['sha-256'],
        },
        credentialId: 'OpenBadgeCredentialDescriptor',
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
  })

  it('Digital Credentials API v1.draft24 with dcql, mdoc, sd-jwt, transaction data. unsigned, unencrypted', async () => {
    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        responseMode: 'dc_api',
        expectedOrigins: ['https://example.com'],
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'none',
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
        version: 'v1.draft24',
      })

    const resolvedAuthorizationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequest,
      {
        origin: 'https://example.com',
      }
    )

    expect(resolvedAuthorizationRequest.dcql).toMatchObject(expectedDcqlResult)
    if (!resolvedAuthorizationRequest.dcql) throw new Error('Dcql not defined')
    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const result = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
      dcql: {
        credentials: selectedCredentials,
      },
      origin: resolvedAuthorizationRequest.origin,
      transactionData: [
        {
          // Sign with first possible credential
          credentialId: resolvedAuthorizationRequest.transactionData?.[0].matchedCredentialIds[0] as string,
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      serverResponse: undefined,
      authorizationResponse: expect.any(Object),
      authorizationResponsePayload: expect.objectContaining({
        vp_token: {
          orgeuuniversity: expect.any(String),
          OpenBadgeCredentialDescriptor: expect.any(String),
        },
      }),
    })

    const { verificationSession: updatedVerificationSession, dcql } =
      await verifier.agent.openid4vc.verifier.verifyAuthorizationResponse({
        verificationSessionId: verificationSession.id,
        origin: resolvedAuthorizationRequest.origin,
        authorizationResponse: result.authorizationResponse,
      })

    expect(updatedVerificationSession.state).toEqual(OpenId4VcVerificationSessionState.ResponseVerified)
    expect(dcql).toEqual({
      query: expect.any(Object),
      presentations: {
        orgeuuniversity: [expect.any(MdocDeviceResponse)],
        OpenBadgeCredentialDescriptor: [
          expect.objectContaining({
            compact: expect.stringContaining('~'),
            kbJwt: expect.objectContaining({
              payload: expect.objectContaining({
                aud: 'web-origin:https://example.com',
              }),
            }),
          }),
        ],
      },
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
    })
  })

  it('Digital Credentials API v1.draft24 with dcql, mdoc, sd-jwt, transaction data. signed, encrypted', async () => {
    const { authorizationRequestObject, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        responseMode: 'dc_api.jwt',
        expectedOrigins: ['https://example.com'],
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [verifierCertificate],
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
        version: 'v1.draft24',
      })

    const resolvedAuthorizationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequestObject,
      {
        origin: 'https://example.com',
      }
    )

    expect(resolvedAuthorizationRequest.dcql).toMatchObject(expectedDcqlResult)
    if (!resolvedAuthorizationRequest.dcql) throw new Error('Dcql not defined')
    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const result = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedAuthorizationRequest.authorizationRequestPayload,
      dcql: {
        credentials: selectedCredentials,
      },
      origin: resolvedAuthorizationRequest.origin,
      transactionData: [
        {
          // Sign with first possible credential
          credentialId: resolvedAuthorizationRequest.transactionData?.[0].matchedCredentialIds[0] as string,
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      serverResponse: undefined,
      authorizationResponsePayload: expect.objectContaining({
        vp_token: {
          orgeuuniversity: expect.any(String),
          OpenBadgeCredentialDescriptor: expect.any(String),
        },
      }),
      authorizationResponse: {
        response: expect.any(String),
      },
    })

    const {
      verificationSession: updatedVerificationSession,
      dcql,
      transactionData,
    } = await verifier.agent.openid4vc.verifier.verifyAuthorizationResponse({
      verificationSessionId: verificationSession.id,
      origin: resolvedAuthorizationRequest.origin,
      authorizationResponse: result.authorizationResponse,
    })

    expect(updatedVerificationSession.state).toEqual(OpenId4VcVerificationSessionState.ResponseVerified)
    expect(dcql).toEqual({
      query: expect.any(Object),
      presentations: {
        orgeuuniversity: [expect.any(MdocDeviceResponse)],
        OpenBadgeCredentialDescriptor: [
          expect.objectContaining({
            compact: expect.stringContaining('~'),
            kbJwt: expect.objectContaining({
              payload: expect.objectContaining({
                aud: 'x509_san_dns:localhost',
              }),
            }),
          }),
        ],
      },
      presentationResult: expect.objectContaining({
        can_be_satisfied: true,
      }),
    })
    expect(transactionData).toEqual([
      {
        decoded: {
          type: 'OpenBadgeTx',
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          transaction_data_hashes_alg: ['sha-256'],
        },
        credentialId: 'OpenBadgeCredentialDescriptor',
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
  })
})

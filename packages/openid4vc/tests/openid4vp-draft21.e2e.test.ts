import type { DifPresentationExchangeDefinitionV2, MdocDeviceResponse, SdJwtVc } from '@credo-ts/core'
import type { AgentType } from './utils'

import { ClaimFormat, Kms, X509Service, parseDid } from '@credo-ts/core'
import express, { type Express } from 'express'
import { TenantsModule } from '../../tenants/src'
import { OpenId4VcHolderModule, OpenId4VcVerificationSessionState, OpenId4VcVerifierModule } from '../src'

import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import { createAgentFromModules, waitForVerificationSessionRecordSubject } from './utils'

const serverPort = 1236
const baseUrl = `http://localhost:${serverPort}`
const verificationBaseUrl = `${baseUrl}/oid4vp`

describe('OpenID4VP Draft 21', () => {
  let expressApp: Express
  let clearNock: () => void

  let holder: AgentType<{
    openId4VcHolder: OpenId4VcHolderModule
  }>

  let verifier: AgentType<{
    openId4VcVerifier: OpenId4VcVerifierModule
  }>

  beforeEach(async () => {
    expressApp = express()

    holder = (await createAgentFromModules(
      {
        openId4VcHolder: new OpenId4VcHolderModule(),
        inMemory: new InMemoryWalletModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598e',
      global.fetch
    )) as unknown as typeof holder

    verifier = (await createAgentFromModules(
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

    // We let AFJ create the router, so we have a fresh one each time
    expressApp.use('/oid4vp', verifier.agent.modules.openId4VcVerifier.config.router)
    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()

    await holder.agent.shutdown()
    await verifier.agent.shutdown()
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

    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)

    holder.agent.x509.config.addTrustedCertificate(certificate)
    verifier.agent.x509.config.addTrustedCertificate(certificate)

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
        presentationExchange: {
          definition: presentationDefinition,
        },
        version: 'v1.draft21',
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=localhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}&client_id_scheme=x509_san_dns`
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
            kid: '#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            typ: 'dc+sd-jwt',
          },
          kbJwt: {
            header: {
              alg: 'EdDSA',
              typ: 'kb+jwt',
            },
            payload: {
              aud: 'localhost',
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

    verifier.agent.x509.config.setTrustedCertificates([issuerCertificate])

    const parsedDid = parseDid(verifier.kid)
    if (!parsedDid.fragment) {
      throw new Error(`didUrl '${parsedDid.didUrl}' does not contain a '#'. Unable to derive key from did document.`)
    }

    const holderKey = Kms.PublicJwk.fromPublicJwk(
      (await holder.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
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
        version: 'v1.draft21',
      })

    expect(authorizationRequest).toEqual(
      `openid4vp://?client_id=localhost&request_uri=${encodeURIComponent(
        verificationSession.authorizationRequestUri as string
      )}&client_id_scheme=x509_san_dns`
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
          claimFormat: ClaimFormat.SdJwtVc,
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
              aud: 'localhost',
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

  it('throws error when creating request with transaction data', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    await expect(
      verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        responseMode: 'direct_post.jwt',
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [],
        },
        presentationExchange: {
          definition: {
            id: '',
            input_descriptors: [],
          },
        },
        version: 'v1.draft21',
        transactionData: [{ credential_ids: ['one'], type: 'something' }],
      })
    ).rejects.toThrow(
      `OpenID4VP version 'v1.draft21' cannot be used with transactionData. Use version 'v1' or 'v1.draft24' instead.`
    )
  })

  it('throws error when creating request with dcql', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    await expect(
      verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        responseMode: 'direct_post.jwt',
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [],
        },
        dcql: {
          query: {
            credentials: [],
          },
        },
        version: 'v1.draft21',
      })
    ).rejects.toThrow(
      `OpenID4VP version 'v1.draft21' cannot be used with dcql. Use version 'v1' or 'v1.draft24' instead.`
    )
  })

  it('throws error when creating request with dc_api', async () => {
    const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    await expect(
      verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        responseMode: 'dc_api.jwt',
        verifierId: openIdVerifier.verifierId,
        requestSigner: {
          method: 'x5c',
          x5c: [],
        },
        presentationExchange: {
          definition: {
            id: '',
            input_descriptors: [],
          },
        },
        version: 'v1.draft21',
      })
    ).rejects.toThrow(
      "OpenID4VP version 'v1.draft21' cannot be used with responseMode 'dc_api.jwt'. Use version 'v1' or 'v1.draft24' instead."
    )
  })
})

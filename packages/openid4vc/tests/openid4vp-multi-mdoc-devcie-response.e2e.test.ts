import { Kms, MdocDeviceResponse, TypedArrayEncoder } from '@credo-ts/core'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { OpenId4VcVerificationSessionState, OpenId4VcVerifierModule } from '../src'
import type { AgentType } from './utils'
import { createAgentFromModules } from './utils'

const baseUrl = 'https://credo.com/oid4vp'

describe('OpenId4Vc', () => {
  let verifier: AgentType<{
    openId4VcVerifier: OpenId4VcVerifierModule
  }>

  beforeEach(async () => {
    verifier = (await createAgentFromModules({
      openId4VcVerifier: new OpenId4VcVerifierModule({
        baseUrl,
      }),
      inMemory: new InMemoryWalletModule(),
    })) as unknown as typeof verifier
  })

  afterEach(async () => {
    await verifier.agent.shutdown()
  })

  it('can succesfully verify a device response containing multiple mdoc documents', async () => {
    const openid4vcVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const certificate = await verifier.agent.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })).publicJwk
      ),
      issuer: {
        commonName: 'Credo',
        countryName: 'Country',
      },
      extensions: {
        subjectAlternativeName: {
          name: [{ type: 'dns', value: 'credo.com' }],
        },
      },
    })
    verifier.agent.x509.config.addTrustedCertificate(certificate.toString('pem'))

    const holderKey = Kms.PublicJwk.fromPublicJwk(
      (
        await verifier.agent.kms.createKey({
          type: {
            kty: 'EC',
            crv: 'P-256',
          },
        })
      ).publicJwk
    )
    const mdocOne = await verifier.agent.mdoc.sign({
      docType: 'one',
      holderKey,
      issuerCertificate: certificate,
      namespaces: {
        one: {
          name: 'hello',
        },
      },
    })

    const holderKey2 = Kms.PublicJwk.fromPublicJwk(
      (
        await verifier.agent.kms.createKey({
          type: {
            kty: 'EC',
            crv: 'P-256',
          },
        })
      ).publicJwk
    )
    const mdocTwo = await verifier.agent.mdoc.sign({
      docType: 'two',
      holderKey: holderKey2,
      issuerCertificate: certificate,
      namespaces: {
        two: {
          notName: 'notHello',
        },
      },
    })

    const { verificationSession } = await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
      verifierId: openid4vcVerifier.verifierId,
      requestSigner: {
        method: 'x5c',
        x5c: [certificate],
      },
      expectedOrigins: ['https://credo.com'],
      responseMode: 'dc_api',
      version: 'v1.draft24',
      presentationExchange: {
        definition: {
          id: 'random',
          input_descriptors: [
            {
              id: 'one',
              constraints: {
                limit_disclosure: 'required',
                fields: [
                  {
                    path: ["$['one']['name']"],
                    intent_to_retain: false,
                  },
                ],
              },
            },
            {
              id: 'two',
              constraints: {
                limit_disclosure: 'required',
                fields: [
                  {
                    path: ["$['two']['notName']"],
                    intent_to_retain: false,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    const deviceResponse = await MdocDeviceResponse.createDeviceResponse(verifier.agent.context, {
      mdocs: [mdocOne, mdocTwo],
      sessionTranscriptOptions: {
        type: 'openId4VpDcApiDraft24',
        clientId: verificationSession.requestPayload.client_id as string,
        origin: 'https://credo.com',
        verifierGeneratedNonce: verificationSession.requestPayload.nonce,
      },
      documentRequests: [
        { docType: 'one', nameSpaces: { one: { name: false } } },
        { docType: 'two', nameSpaces: { two: { notName: false } } },
      ],
    })

    const verified = await verifier.agent.modules.openId4VcVerifier.verifyAuthorizationResponse({
      verificationSessionId: verificationSession.id,
      authorizationResponse: {
        vp_token: TypedArrayEncoder.toBase64URL(deviceResponse),
        presentation_submission: {
          id: 'submission_id',
          definition_id: 'random',
          descriptor_map: [
            { id: 'one', format: 'mso_mdoc', path: '$' },
            { id: 'two', format: 'mso_mdoc', path: '$' },
          ],
        },
      },
      origin: 'https://credo.com',
    })

    expect(verified.verificationSession.state).toEqual(OpenId4VcVerificationSessionState.ResponseVerified)
  })

  it('does not verify when a device response with multiple documents does not match the presentation definition', async () => {
    const openid4vcVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const certificate = await verifier.agent.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })).publicJwk
      ),
      issuer: {
        commonName: 'Credo',
        countryName: 'Country',
      },
      extensions: {
        subjectAlternativeName: {
          name: [{ type: 'dns', value: 'credo.com' }],
        },
      },
    })
    verifier.agent.x509.config.addTrustedCertificate(certificate)

    const mdocOne = await verifier.agent.mdoc.sign({
      docType: 'one',
      holderKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })).publicJwk
      ),
      issuerCertificate: certificate,
      namespaces: {
        one: {
          name: 'hello',
        },
      },
    })

    const mdocTwo = await verifier.agent.mdoc.sign({
      docType: 'two',
      holderKey: Kms.PublicJwk.fromPublicJwk(
        (await verifier.agent.kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })).publicJwk
      ),
      issuerCertificate: certificate,
      namespaces: {
        two: {
          notName: 'notHello',
        },
      },
    })

    const { verificationSession } = await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
      verifierId: openid4vcVerifier.verifierId,
      requestSigner: {
        method: 'x5c',
        x5c: [certificate],
      },
      expectedOrigins: ['https://credo.com'],
      responseMode: 'dc_api',
      version: 'v1.draft24',
      presentationExchange: {
        definition: {
          id: 'random',
          input_descriptors: [
            {
              id: 'one',
              constraints: {
                limit_disclosure: 'required',
                fields: [
                  {
                    path: ["$['one']['name']"],
                    intent_to_retain: false,
                  },
                ],
              },
            },
            {
              id: 'two',
              constraints: {
                limit_disclosure: 'required',
                fields: [
                  {
                    // Path does match with mdoc
                    path: ["$['two']['notNameNotName']"],
                    intent_to_retain: false,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    const deviceResponse = await MdocDeviceResponse.createDeviceResponse(verifier.agent.context, {
      mdocs: [mdocOne, mdocTwo],
      sessionTranscriptOptions: {
        type: 'openId4VpDcApiDraft24',
        clientId: verificationSession.requestPayload.client_id as string,
        origin: 'https://credo.com',
        verifierGeneratedNonce: verificationSession.requestPayload.nonce,
      },
      documentRequests: [
        { docType: 'one', nameSpaces: { one: { name: false } } },
        { docType: 'two', nameSpaces: { two: { notName: false } } },
      ],
    })

    await expect(
      verifier.agent.modules.openId4VcVerifier.verifyAuthorizationResponse({
        verificationSessionId: verificationSession.id,
        authorizationResponse: {
          vp_token: TypedArrayEncoder.toBase64URL(deviceResponse),
          presentation_submission: {
            id: 'submission_id',
            definition_id: 'random',
            descriptor_map: [
              { id: 'one', format: 'mso_mdoc', path: '$' },
              { id: 'two', format: 'mso_mdoc', path: '$' },
            ],
          },
        },
        origin: 'https://credo.com',
      })
    ).rejects.toThrow('Invalid presentation')
  })
})

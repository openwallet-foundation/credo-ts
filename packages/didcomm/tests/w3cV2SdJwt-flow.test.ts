import type {
  DidRepository,
  IDisclosureFrame,
  JsonObject,
  JwsDetachedFormat,
  PeerDidNumAlgo2CreateOptions,
  SdJwtVcHolderBinding,
} from '@credo-ts/core'
import {
  AgentContext,
  CacheModuleConfig,
  ClaimFormat,
  DidDocumentBuilder,
  DidResolverService,
  DidsApi,
  DidsModuleConfig,
  getEd25519VerificationKey2018,
  InjectionSymbols,
  InMemoryLruCache,
  JsonEncoder,
  JsonLdModule,
  JsonTransformer,
  KeyDidRegistrar,
  KeyDidResolver,
  Kms,
  PeerDidNumAlgo,
  W3cDataIntegrityModule,
  W3cV2Credential,
  W3cV2CredentialService,
  W3cV2CredentialsModule,
  W3cV2SdJwtVerifiableCredential,
  X509ModuleConfig,
} from '@credo-ts/core'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../tests/InMemoryStorageService'
import type { CreateDidKidVerificationMethodReturn } from '../../core/tests'
import {
  agentDependencies,
  createDidKidVerificationMethod,
  getAgentConfig,
  getAgentContext,
  testLogger,
} from '../../core/tests'
import {
  DidCommAttachment,
  DidCommAttachmentData,
  DidCommCredentialExchangeRecord,
  DidCommCredentialFormatSpec,
  DidCommCredentialProblemReportReason,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommCredentialV2Preview,
  DidCommMessageRepository,
  DidCommMessageRole,
  DidCommOfferCredentialV2Message,
  DidCommProblemReportError,
  DidCommW3cV2SdJwtCredentialFormatService,
  V2CredentialProblemReportError,
} from '../src'
import { createDidCommSignedAttachment } from '../src/modules/credentials/util/didCommSignedAttachment'

const agentConfig = getAgentConfig('W3cV2SdJwt format service test')
const inMemoryStorageService = new InMemoryStorageService()

const didsModuleConfig = new DidsModuleConfig({
  registrars: [new KeyDidRegistrar()],
  resolvers: [new KeyDidResolver()],
})

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.FileSystem, new agentDependencies.FileSystem()],
    [InjectionSymbols.StorageService, inMemoryStorageService],
    [InjectionSymbols.Logger, testLogger],
    [DidsModuleConfig, didsModuleConfig],
    [DidResolverService, new DidResolverService(testLogger, didsModuleConfig, {} as unknown as DidRepository)],
    [X509ModuleConfig, new X509ModuleConfig()],
    [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
  ],
  agentConfig,
})

agentContext.dependencyManager.registerInstance(AgentContext, agentContext)
agentContext.dependencyManager.registerModules({
  jsonLd: new JsonLdModule(),
  w3cDataIntegrity: new W3cDataIntegrityModule(),
  w3cV2Credentials: new W3cV2CredentialsModule(),
})

const formatService = new DidCommW3cV2SdJwtCredentialFormatService()

const attachment = (json: unknown) =>
  new DidCommAttachment({
    id: 'attachment-id',
    mimeType: 'application/json',
    data: new DidCommAttachmentData({ json: json as JsonObject }),
  })

describe('W3C VCDM 2.0 SD-JWT credential format service', () => {
  let issuerKdv: CreateDidKidVerificationMethodReturn
  let holderKdv: CreateDidKidVerificationMethodReturn

  beforeAll(async () => {
    issuerKdv = await createDidKidVerificationMethod(agentContext, '96213c3d7fc8d4d6754c7a0fd969598g')
    holderKdv = await createDidKidVerificationMethod(agentContext, '96213c3d7fc8d4d6754c7a0fd969598f')
  })

  test('issuance flow without binding (bearer credential)', async () => {
    await issuanceFlowTest({ issuerKdv, holderKdv, bindingRequired: false })
  })

  test('issuance flow with didcomm_signed_attachment binding', async () => {
    await issuanceFlowTest({ issuerKdv, holderKdv, bindingRequired: true })
  })

  test('sets the credential subject id from the credentialSubjectId option for a bearer credential', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv)

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      credentialFormats: { w3cV2SdJwt: { credentialSubjectId: holderKdv.did } },
    })

    const { credential } = credentialAttachment.getDataAsJson<{ credential: string }>()
    const verifiableCredential = W3cV2SdJwtVerifiableCredential.fromCompact(credential)

    expect(verifiableCredential.resolvedCredential.credentialSubject).toMatchObject({ id: holderKdv.did })
    // A bearer credential is not bound to a holder key
    expect(verifiableCredential.sdJwt.prettyClaims.cnf).toBeUndefined()
  })

  test('rejects a credentialSubjectId conflicting with the subject id of the offered credential', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv, {
      credentialSubjectId: holderKdv.did,
    })

    await expect(
      formatService.acceptRequest(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        requestAttachment,
        offerAttachment,
        credentialFormats: { w3cV2SdJwt: { credentialSubjectId: 'did:key:zSomeoneElse' } },
      })
    ).rejects.toThrow(/does not match expected id/)
  })

  test('createOffer rejects a disclosure frame naming a non-discloseable field', async () => {
    await expect(
      formatService.createOffer(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.OfferSent,
          threadId: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
          role: DidCommCredentialRole.Issuer,
        }),
        credentialFormats: {
          w3cV2SdJwt: {
            credential: {
              '@context': ['https://www.w3.org/ns/credentials/v2'],
              type: ['VerifiableCredential'],
              issuer: issuerKdv.did,
              validFrom: new Date().toISOString(),
              credentialSubject: { name: 'John' },
            },
            disclosureFrame: { _sd: ['type'] },
          },
        },
      })
    ).rejects.toThrow("'type' property cannot be selectively disclosed")
  })

  test('createOffer accepts a nested claim sharing a name with a non-discloseable field', async () => {
    const { attachment } = await formatService.createOffer(agentContext, {
      credentialExchangeRecord: new DidCommCredentialExchangeRecord({
        protocolVersion: 'v2',
        state: DidCommCredentialState.OfferSent,
        threadId: '6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e',
        role: DidCommCredentialRole.Issuer,
      }),
      credentialFormats: {
        w3cV2SdJwt: {
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: issuerKdv.did,
            validFrom: new Date().toISOString(),
            credentialSubject: { type: 'Person', name: 'John' },
          },
          disclosureFrame: { credentialSubject: { _sd: ['type'] } },
        },
      },
    })

    expect(attachment.getDataAsJson()).toMatchObject({
      selectively_disclosable_claims: ['$.credentialSubject.type'],
    })
  })

  test('processOffer abandons issuance when a required binding method is missing', async () => {
    const offerAttachment = new DidCommAttachment({
      id: 'offer-attachment-id',
      mimeType: 'application/json',
      data: new DidCommAttachmentData({
        json: {
          binding_required: true,
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: issuerKdv.did,
            validFrom: new Date().toISOString(),
            credentialSubject: { name: 'John' },
          },
        },
      }),
    })

    const processOffer = formatService.processOffer(agentContext, {
      credentialExchangeRecord: new DidCommCredentialExchangeRecord({
        protocolVersion: 'v2',
        state: DidCommCredentialState.OfferReceived,
        threadId: '8d9e0f1a-2b3c-4d4e-8f5a-6b7c8d9e0f1a',
        role: DidCommCredentialRole.Holder,
      }),
      attachment: offerAttachment,
    })

    // A problem report is sent to the issuer, rather than only failing locally on the holder
    await expect(processOffer).rejects.toThrow(DidCommProblemReportError)
    await expect(processOffer).rejects.toMatchObject({
      problemReport: { description: { code: DidCommCredentialProblemReportReason.IssuanceAbandoned } },
    })
  })

  test('processOffer rejects an offer naming a non-discloseable field', async () => {
    // An offer a conformant issuer would not send, but a remote one might
    const offerAttachment = new DidCommAttachment({
      id: 'offer-attachment-id',
      mimeType: 'application/json',
      data: new DidCommAttachmentData({
        json: {
          selectively_disclosable_claims: ['$.type'],
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: issuerKdv.did,
            validFrom: new Date().toISOString(),
            credentialSubject: { name: 'John' },
          },
        },
      }),
    })

    await expect(
      formatService.processOffer(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.OfferReceived,
          threadId: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
          role: DidCommCredentialRole.Holder,
        }),
        attachment: offerAttachment,
      })
    ).rejects.toThrow("'type' property cannot be selectively disclosed")
  })

  test('processCredential rejects a credential whose subject claims differ from the offer', async () => {
    await expect(
      processTamperedCredential({
        issuer: issuerKdv,
        tamper: (credential) => ({
          ...credential,
          credentialSubject: { ...(credential.credentialSubject as object), name: 'Jane' },
        }),
      })
    ).rejects.toThrow('Received credential subject does not match the offered credential subject')
  })

  test('processCredential rejects a credential with a type that was not offered', async () => {
    await expect(
      processTamperedCredential({
        issuer: issuerKdv,
        tamper: (credential) => ({ ...credential, type: ['VerifiableCredential', 'SurpriseCredential'] }),
      })
    ).rejects.toThrow('Received credential does not match the offered credential')
  })

  test('processCredential rejects a credential with a field that was not offered', async () => {
    await expect(
      processTamperedCredential({
        issuer: issuerKdv,
        tamper: (credential) => ({ ...credential, validUntil: '2030-01-01T00:00:00Z' }),
      })
    ).rejects.toThrow('Received credential does not match the offered credential')
  })

  test('processCredential accepts an issuer and validFrom that the offer omitted', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv, {
      omitIssuer: true,
      omitValidFrom: true,
    })

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      // The offer has no issuer, so it is supplied at time of issuance
      credentialFormats: { w3cV2SdJwt: { issuer: issuerKdv.did } },
    })

    const { credential } = credentialAttachment.getDataAsJson<{ credential: string }>()
    expect(W3cV2SdJwtVerifiableCredential.fromCompact(credential).resolvedCredential.issuerId).toBe(issuerKdv.did)

    const holderCredentialRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommCredentialState.CredentialReceived,
      threadId: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
      role: DidCommCredentialRole.Holder,
    })

    await expect(
      formatService.processCredential(agentContext, {
        credentialExchangeRecord: holderCredentialRecord,
        attachment: credentialAttachment,
        requestAttachment,
        offerAttachment,
      })
    ).resolves.toBeUndefined()
  })

  test('acceptRequest requires an issuer when the offer omitted one', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv, {
      omitIssuer: true,
    })

    await expect(
      formatService.acceptRequest(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        requestAttachment,
        offerAttachment,
        credentialFormats: { w3cV2SdJwt: {} },
      })
    ).rejects.toThrow('The offered credential has no issuer')
  })

  test('acceptRequest keeps the issuer of the offered credential over the supplied one', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv)

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      credentialFormats: { w3cV2SdJwt: { issuer: 'did:key:zSomeoneElse' } },
    })

    const { credential } = credentialAttachment.getDataAsJson<{ credential: string }>()
    expect(W3cV2SdJwtVerifiableCredential.fromCompact(credential).resolvedCredential.issuerId).toBe(issuerKdv.did)
  })

  test('issuance flow with an optional binding the holder chooses to use', async () => {
    // The issuer offers a binding method without requiring it
    const issuerCredentialRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommCredentialState.OfferSent,
      threadId: '2b3c4d5e-6f7a-4b8c-8d9e-0f1a2b3c4d5e',
      role: DidCommCredentialRole.Issuer,
    })

    const { attachment: offerAttachment } = await formatService.createOffer(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      credentialFormats: {
        w3cV2SdJwt: {
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: issuerKdv.did,
            validFrom: new Date().toISOString(),
            credentialSubject: { name: 'John' },
          },
          bindingRequired: false,
          didCommSignedAttachmentBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['key'] },
        },
      },
    })

    expect(offerAttachment.getDataAsJson()).toMatchObject({
      binding_required: false,
      binding_method: { didcomm_signed_attachment: { algs_supported: ['EdDSA'] } },
    })

    // The holder opts in, even though the issuer did not require it
    const { attachment: requestAttachment, appendAttachments: requestAppendAttachments } =
      await formatService.acceptOffer(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        offerAttachment,
        credentialFormats: { w3cV2SdJwt: { didCommSignedAttachment: { kid: holderKdv.kid } } },
      })

    expect(requestAttachment.getDataAsJson()).toMatchObject({
      binding_proof: { didcomm_signed_attachment: { attachment_id: expect.any(String) } },
    })

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      requestAppendAttachments,
      credentialFormats: { w3cV2SdJwt: {} },
    })

    const { credential } = credentialAttachment.getDataAsJson<{ credential: string }>()
    const verifiableCredential = W3cV2SdJwtVerifiableCredential.fromCompact(credential)

    // The credential is bound to the holder key despite the binding being optional
    expect(verifiableCredential.sdJwt.prettyClaims.cnf).toBeDefined()
    expect(verifiableCredential.resolvedCredential.credentialSubject).toMatchObject({ id: holderKdv.did })
  })

  test('acceptOffer ignores an optional binding the holder does not use', async () => {
    const { requestAttachment } = await offerAndRequest(issuerKdv, {
      didCommSignedAttachmentBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['key'] },
    })

    expect(requestAttachment.getDataAsJson()).toEqual({})
  })

  test('createOffer requires binding options when binding is required', async () => {
    await expect(
      formatService.createOffer(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.OfferSent,
          threadId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
          role: DidCommCredentialRole.Issuer,
        }),
        credentialFormats: {
          w3cV2SdJwt: {
            credential: {
              '@context': ['https://www.w3.org/ns/credentials/v2'],
              type: ['VerifiableCredential'],
              issuer: issuerKdv.did,
              validFrom: new Date().toISOString(),
              credentialSubject: { name: 'John' },
            },
            bindingRequired: true,
          },
        },
      })
    ).rejects.toThrow('Missing required binding method.')
  })

  test('acceptOffer rejects a binding method that was not offered', async () => {
    const { offerAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv)

    await expect(
      formatService.acceptOffer(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        offerAttachment,
        credentialFormats: { w3cV2SdJwt: { didCommSignedAttachment: { kid: holderKdv.kid } } },
      })
    ).rejects.toThrow('Cannot request credential with a binding method that was not offered.')
  })

  test('acceptOffer requires a binding proof when binding is required', async () => {
    const issuerCredentialRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommCredentialState.OfferSent,
      threadId: '4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a',
      role: DidCommCredentialRole.Issuer,
    })

    const { attachment: offerAttachment } = await formatService.createOffer(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      credentialFormats: {
        w3cV2SdJwt: {
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: issuerKdv.did,
            validFrom: new Date().toISOString(),
            credentialSubject: { name: 'John' },
          },
          bindingRequired: true,
          didCommSignedAttachmentBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['key'] },
        },
      },
    })

    await expect(
      formatService.acceptOffer(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        offerAttachment,
        credentialFormats: { w3cV2SdJwt: {} },
      })
    ).rejects.toThrow('Missing required binding proof')
  })

  test('processCredential accepts a credential disclosing an array element', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv, {
      credentialSubject: { name: 'John', result: ['a', 'b', 'c'] },
      disclosureFrame: { credentialSubject: { result: { _sd: [0] } } },
    })

    expect(offerAttachment.getDataAsJson()).toMatchObject({
      selectively_disclosable_claims: ['$.credentialSubject.result[0]'],
    })

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      credentialFormats: { w3cV2SdJwt: {} },
    })

    // A disclosable array element keeps its position in the payload, replaced by a digest, unlike a
    // disclosable object property which is removed entirely
    const { credential } = credentialAttachment.getDataAsJson<{ credential: string }>()
    const verifiableCredential = W3cV2SdJwtVerifiableCredential.fromCompact(credential)
    const payloadSubject = verifiableCredential.sdJwt.payload.credentialSubject as { result: unknown[] }
    expect(payloadSubject.result[0]).toEqual({ '...': expect.any(String) })
    expect(verifiableCredential.sdJwt.prettyClaims.credentialSubject).toMatchObject({ result: ['a', 'b', 'c'] })

    await expect(
      formatService.processCredential(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.CredentialReceived,
          threadId: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          role: DidCommCredentialRole.Holder,
        }),
        attachment: credentialAttachment,
        requestAttachment,
        offerAttachment,
      })
    ).resolves.toBeUndefined()
  })

  test('processCredential rejects a credential that did not make an offered array element disclosable', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv, {
      credentialSubject: { name: 'John', result: ['a', 'b', 'c'] },
      disclosureFrame: { credentialSubject: { result: { _sd: [0] } } },
    })

    // The issuer advertised `$.credentialSubject.result[0]` as selectively disclosable, then hard baked it
    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      credentialFormats: { w3cV2SdJwt: { disclosureFrame: {} } },
    })

    await expect(
      formatService.processCredential(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.CredentialReceived,
          threadId: '6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c',
          role: DidCommCredentialRole.Holder,
        }),
        attachment: credentialAttachment,
        requestAttachment,
        offerAttachment,
      })
    ).rejects.toThrow("Claim '$.credentialSubject.result[0]' was offered as selectively disclosable")
  })

  test('processCredential rejects a credential that did not make an offered claim selectively disclosable', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv, {
      disclosureFrame: { credentialSubject: { _sd: ['name'] } },
    })

    // The issuer advertised `$.credentialSubject.name` as selectively disclosable, then hard baked it
    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      credentialFormats: { w3cV2SdJwt: { disclosureFrame: {} } },
    })

    await expect(
      formatService.processCredential(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.CredentialReceived,
          threadId: '0f1a2b3c-4d5e-4f6a-8b7c-8d9e0f1a2b3c',
          role: DidCommCredentialRole.Holder,
        }),
        attachment: credentialAttachment,
        requestAttachment,
        offerAttachment,
      })
    ).rejects.toThrow("Claim '$.credentialSubject.name' was offered as selectively disclosable")
  })

  test('processCredential accepts falsy claim values', async () => {
    const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuerKdv, {
      credentialSubject: { name: 'John', minimumAge: 0, verified: false, nickname: '' },
    })

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
      credentialFormats: { w3cV2SdJwt: {} },
    })

    await expect(
      formatService.processCredential(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.CredentialReceived,
          threadId: '1a2b3c4d-5e6f-4a7b-8c8d-9e0f1a2b3c4d',
          role: DidCommCredentialRole.Holder,
        }),
        attachment: credentialAttachment,
        requestAttachment,
        offerAttachment,
      })
    ).resolves.toBeUndefined()
  })

  test.each<[string, { algsSupported?: string[]; didMethodsSupported?: string[] }, JsonObject, string]>([
    [
      'an alg',
      { algsSupported: ['ES256'] },
      { algs_supported: ['EdDSA'] },
      "alg 'EdDSA' is not one of the supported algorithms ES256",
    ],
    ['a nonce', {}, { nonce: 'another-nonce' }, 'Invalid nonce in signed attachment'],
    [
      'a DID method',
      { didMethodsSupported: ['peer'] },
      { did_methods_supported: ['key'] },
      "DID method 'key' is not supported by the issuer",
    ],
  ])(
    'abandons issuance for a binding proof with %s that was not offered',
    async (_, offerBinding, holderOffer, error) => {
      const { issuerCredentialRecord, offerAttachment, requestAttachment, requestAppendAttachments } =
        await offerAndBoundRequest({
          kid: holderKdv.kid,
          offerBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['key'], ...offerBinding },
          tamperHolderOffer: (bindingMethod) => ({ ...bindingMethod, ...holderOffer }),
        })

      const processRequest = formatService.processRequest(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        attachment: requestAttachment,
        requestAppendAttachments,
      })
      await expect(processRequest).rejects.toThrow(V2CredentialProblemReportError)
      await expect(processRequest).rejects.toThrow(error)
      await expect(processRequest).rejects.toMatchObject({
        problemReport: { description: { code: DidCommCredentialProblemReportReason.IssuanceAbandoned } },
      })

      const acceptRequest = formatService.acceptRequest(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        offerAttachment,
        requestAttachment,
        requestAppendAttachments,
      })
      await expect(acceptRequest).rejects.toThrow(V2CredentialProblemReportError)
      await expect(acceptRequest).rejects.toThrow(error)
    }
  )

  test('acceptOffer does not sign a binding proof with a DID method the offer does not support', async () => {
    await expect(
      offerAndBoundRequest({
        kid: holderKdv.kid,
        offerBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['peer'] },
      })
    ).rejects.toThrow("DID method 'key' is not supported by the issuer")
  })

  test('rejects a binding key that is not in the authentication relationship', async () => {
    const kid = await createPeerDidKid('assertionMethod')

    await expect(offerAndBoundRequest({ kid })).rejects.toThrow(`'${kid}' in purposes authentication`)

    const { issuerCredentialRecord, offerAttachment } = await offerAndBoundRequest({ kid: holderKdv.kid })
    const offer = offerAttachment.getDataAsJson<{ binding_method: { didcomm_signed_attachment: { nonce: string } } }>()
    const signedAttachment = await createDidCommSignedAttachment(
      agentContext,
      { nonce: offer.binding_method.didcomm_signed_attachment.nonce },
      { kid },
      ['EdDSA']
    )

    const processRequest = formatService.processRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      attachment: attachment({ binding_proof: { didcomm_signed_attachment: { attachment_id: signedAttachment.id } } }),
      requestAppendAttachments: [signedAttachment],
    })
    await expect(processRequest).rejects.toThrow(V2CredentialProblemReportError)
    await expect(processRequest).rejects.toThrow(`'${kid}' in purposes authentication`)
  })

  test('issues a credential bound to a DID key that is only in authentication', async () => {
    const kid = await createPeerDidKid('authentication')
    const { issuerCredentialRecord, offerAttachment, requestAttachment, requestAppendAttachments } =
      await offerAndBoundRequest({ kid })

    await formatService.processRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      attachment: requestAttachment,
      requestAppendAttachments,
    })
    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    const { credential } = credentialAttachment.getDataAsJson<{ credential: string }>()
    expect(W3cV2SdJwtVerifiableCredential.fromCompact(credential).sdJwt.payload.cnf).toEqual({ kid })
  })

  test.each<[string, (jwk: JsonObject) => JsonObject, string]>([
    ['both kid and jwk', (jwk) => ({ kid: holderKdv.kid, jwk }), "must not have both 'kid' and 'jwk'"],
    [
      'a jwk when the offer has no jwk_supported',
      (jwk) => ({ jwk }),
      "The offer does not accept a 'jwk' binding proof",
    ],
  ])('abandons issuance for a binding proof header with %s', async (_, header, error) => {
    const { issuerCredentialRecord, offerAttachment } = await offerAndBoundRequest({ kid: holderKdv.kid })
    const offer = offerAttachment.getDataAsJson<{ binding_method: { didcomm_signed_attachment: { nonce: string } } }>()
    const signedAttachment = await createDidCommSignedAttachment(
      agentContext,
      { nonce: offer.binding_method.didcomm_signed_attachment.nonce },
      { jwk: holderKdv.publicJwk },
      ['EdDSA']
    )
    const jws = signedAttachment.data.jws as JwsDetachedFormat
    const { jwk, ...protectedHeader } = JsonEncoder.fromBase64Url(jws.protected)
    if (header(jwk).kid) jws.protected = JsonEncoder.toBase64Url({ ...protectedHeader, ...header(jwk) })

    const processRequest = formatService.processRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      attachment: attachment({ binding_proof: { didcomm_signed_attachment: { attachment_id: signedAttachment.id } } }),
      requestAppendAttachments: [signedAttachment],
    })
    await expect(processRequest).rejects.toThrow(V2CredentialProblemReportError)
    await expect(processRequest).rejects.toThrow(error)
  })

  test('acceptRequest rejects a holder that is not the key of the binding proof', async () => {
    const { issuerCredentialRecord, offerAttachment, requestAttachment, requestAppendAttachments } =
      await offerAndBoundRequest({ kid: holderKdv.kid })

    await expect(
      formatService.acceptRequest(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        offerAttachment,
        requestAttachment,
        requestAppendAttachments,
        credentialFormats: { w3cV2SdJwt: { holder: { method: 'did', didUrl: issuerKdv.kid } } },
      })
    ).rejects.toThrow('The holder must be the key of the binding proof in the request')
  })

  test.each<[string, () => SdJwtVcHolderBinding | undefined]>([
    ['no cnf', () => undefined],
    ['the cnf of another key', () => ({ method: 'did', didUrl: issuerKdv.kid })],
  ])('processCredential rejects a credential with %s for a request with a binding proof', async (_, holder) => {
    const { offerAttachment, requestAttachment, requestAppendAttachments } = await offerAndBoundRequest({
      kid: holderKdv.kid,
    })

    const signedCredential = await agentContext.dependencyManager
      .resolve(W3cV2CredentialService)
      .signCredential(agentContext, {
        format: ClaimFormat.SdJwtW3cVc,
        credential: JsonTransformer.fromJSON(
          offerAttachment.getDataAsJson<{ credential: JsonObject }>().credential,
          W3cV2Credential
        ),
        verificationMethod: issuerKdv.verificationMethod.id,
        alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
        holder: holder(),
      })

    await expect(
      formatService.processCredential(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.CredentialReceived,
          threadId: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
          role: DidCommCredentialRole.Holder,
        }),
        attachment: attachment({ credential: signedCredential.encoded }),
        offerAttachment,
        requestAttachment,
        requestAppendAttachments,
      })
    ).rejects.toThrow("The credential must have a 'cnf' claim with only the 'kid' of the binding proof")
  })

  /**
   * Offers an optional `didcomm_signed_attachment` binding, saves the sent offer for `processRequest`,
   * and has the holder sign a binding proof with `kid` against its own copy of the offer.
   */
  async function offerAndBoundRequest({
    kid,
    offerBinding = { algsSupported: ['EdDSA'], didMethodsSupported: ['key', 'peer'] },
    tamperHolderOffer = (bindingMethod) => bindingMethod,
  }: {
    kid: string
    offerBinding?: { algsSupported?: string[]; didMethodsSupported?: string[] }
    tamperHolderOffer?: (bindingMethod: JsonObject) => JsonObject
  }) {
    const issuerCredentialRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommCredentialState.OfferSent,
      threadId: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
      role: DidCommCredentialRole.Issuer,
    })

    const { format, attachment: offerAttachment } = await formatService.createOffer(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      credentialFormats: {
        w3cV2SdJwt: {
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: issuerKdv.did,
            validFrom: new Date().toISOString(),
            credentialSubject: { name: 'John' },
          },
          didCommSignedAttachmentBinding: offerBinding,
        },
      },
    })
    await saveSentOffer(issuerCredentialRecord, format, offerAttachment)

    const offer = offerAttachment.getDataAsJson<{ binding_method: { didcomm_signed_attachment: JsonObject } }>()
    const { attachment: requestAttachment, appendAttachments: requestAppendAttachments } =
      await formatService.acceptOffer(agentContext, {
        credentialExchangeRecord: issuerCredentialRecord,
        offerAttachment: attachment({
          ...offer,
          binding_method: {
            didcomm_signed_attachment: tamperHolderOffer(offer.binding_method.didcomm_signed_attachment),
          },
        }),
        credentialFormats: { w3cV2SdJwt: { didCommSignedAttachment: { kid } } },
      })

    return { issuerCredentialRecord, offerAttachment, requestAttachment, requestAppendAttachments }
  }
})

async function saveSentOffer(
  credentialExchangeRecord: DidCommCredentialExchangeRecord,
  format: DidCommCredentialFormatSpec,
  offerAttachment: DidCommAttachment
) {
  await agentContext.dependencyManager.resolve(DidCommMessageRepository).saveAgentMessage(agentContext, {
    agentMessage: new DidCommOfferCredentialV2Message({
      formats: [format],
      offerAttachments: [offerAttachment],
      credentialPreview: new DidCommCredentialV2Preview({ attributes: [] }),
    }),
    role: DidCommMessageRole.Sender,
    associatedRecordId: credentialExchangeRecord.id,
  })
}

async function createPeerDidKid(purpose: 'authentication' | 'assertionMethod') {
  const { keyId, publicJwk } = await agentContext.dependencyManager
    .resolve(Kms.KeyManagementApi)
    .createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
  const verificationMethod = getEd25519VerificationKey2018({
    id: '#key-1',
    controller: '#id',
    publicJwk: Kms.PublicJwk.fromPublicJwk(publicJwk),
  })

  const didDocument = new DidDocumentBuilder('').addVerificationMethod(verificationMethod)
  if (purpose === 'authentication') didDocument.addAuthentication(verificationMethod.id)
  else didDocument.addAssertionMethod(verificationMethod.id)

  const { didState } = await agentContext.dependencyManager.resolve(DidsApi).create<PeerDidNumAlgo2CreateOptions>({
    method: 'peer',
    didDocument: didDocument.build(),
    options: {
      numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
      keys: [{ didDocumentRelativeKeyId: '#key-1', kmsKeyId: keyId }],
    },
  })

  return `${didState.did}#key-1`
}

/**
 * Issues a credential for an unbound offer, rewrites the issued credential with `tamper`, re-signs it as
 * the issuer, and hands the result to `processCredential`. Re-signing keeps the signature valid so that
 * the offer comparison is what rejects the credential, rather than the signature check.
 */
async function processTamperedCredential({
  issuer,
  tamper,
}: {
  issuer: CreateDidKidVerificationMethodReturn
  tamper: (credential: JsonObject) => JsonObject
}) {
  const { offerAttachment, requestAttachment, issuerCredentialRecord } = await offerAndRequest(issuer)

  const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)
  const offeredCredential = offerAttachment.getDataAsJson<{ credential: JsonObject }>().credential

  const tamperedCredential = await w3cV2CredentialService.signCredential(agentContext, {
    format: ClaimFormat.SdJwtW3cVc,
    credential: JsonTransformer.fromJSON(tamper(offeredCredential), W3cV2Credential),
    verificationMethod: issuer.verificationMethod.id,
    alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
  })

  const credentialAttachment = new DidCommAttachment({
    id: 'credential-attachment-id',
    mimeType: 'application/json',
    data: new DidCommAttachmentData({ json: { credential: tamperedCredential.encoded } }),
  })

  return formatService.processCredential(agentContext, {
    credentialExchangeRecord: new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommCredentialState.CredentialReceived,
      threadId: issuerCredentialRecord.threadId,
      role: DidCommCredentialRole.Holder,
    }),
    attachment: credentialAttachment,
    requestAttachment,
    offerAttachment,
  })
}

/**
 * Runs the offer and request steps for an unbound credential issued by `issuer`.
 */
async function offerAndRequest(
  issuer: CreateDidKidVerificationMethodReturn,
  {
    credentialSubjectId,
    credentialSubject = { name: 'John' },
    disclosureFrame,
    omitValidFrom,
    omitIssuer,
    didCommSignedAttachmentBinding,
  }: {
    credentialSubjectId?: string
    credentialSubject?: JsonObject
    disclosureFrame?: IDisclosureFrame
    omitValidFrom?: boolean
    omitIssuer?: boolean
    didCommSignedAttachmentBinding?: { algsSupported?: string[]; didMethodsSupported?: string[] }
  } = {}
) {
  const issuerCredentialRecord = new DidCommCredentialExchangeRecord({
    protocolVersion: 'v2',
    state: DidCommCredentialState.OfferSent,
    threadId: '0b6f6a05-9d3e-4f0a-8a3f-2c1d4e5b6a7c',
    role: DidCommCredentialRole.Issuer,
  })

  const { attachment: offerAttachment } = await formatService.createOffer(agentContext, {
    credentialExchangeRecord: issuerCredentialRecord,
    credentialFormats: {
      w3cV2SdJwt: {
        credential: {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          ...(omitIssuer ? {} : { issuer: issuer.did }),
          ...(omitValidFrom ? {} : { validFrom: new Date().toISOString() }),
          credentialSubject: { ...(credentialSubjectId ? { id: credentialSubjectId } : {}), ...credentialSubject },
        },
        bindingRequired: false,
        disclosureFrame,
        didCommSignedAttachmentBinding,
      },
    },
  })

  const { attachment: requestAttachment } = await formatService.acceptOffer(agentContext, {
    credentialExchangeRecord: issuerCredentialRecord,
    offerAttachment,
    credentialFormats: { w3cV2SdJwt: {} },
  })

  return { issuerCredentialRecord, offerAttachment, requestAttachment }
}

async function issuanceFlowTest(options: {
  issuerKdv: CreateDidKidVerificationMethodReturn
  holderKdv: CreateDidKidVerificationMethodReturn
  bindingRequired: boolean
}) {
  const { issuerKdv: issuer, holderKdv: holder, bindingRequired } = options

  const holderCredentialRecord = new DidCommCredentialExchangeRecord({
    protocolVersion: 'v2',
    state: DidCommCredentialState.OfferReceived,
    threadId: 'f365c1a5-2baf-4873-9432-fa87c888a0aa',
    role: DidCommCredentialRole.Holder,
  })

  const issuerCredentialRecord = new DidCommCredentialExchangeRecord({
    protocolVersion: 'v2',
    state: DidCommCredentialState.OfferSent,
    threadId: 'f365c1a5-2baf-4873-9432-fa87c888a0aa',
    role: DidCommCredentialRole.Issuer,
  })

  const credentialJson = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'],
    issuer: issuer.did,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: holder.did,
      name: 'John',
      age: '25',
    },
  }

  // --- Issuer creates offer ---
  const { format: offerFormat, attachment: offerAttachment } = await formatService.createOffer(agentContext, {
    credentialExchangeRecord: issuerCredentialRecord,
    credentialFormats: {
      w3cV2SdJwt: {
        credential: credentialJson,
        bindingRequired,
        ...(bindingRequired && {
          didCommSignedAttachmentBinding: {
            algsSupported: ['EdDSA'],
            didMethodsSupported: ['key'],
          },
        }),
      },
    },
  })
  await saveSentOffer(issuerCredentialRecord, offerFormat, offerAttachment)

  // --- Holder processes offer ---
  await formatService.processOffer(agentContext, {
    credentialExchangeRecord: holderCredentialRecord,
    attachment: offerAttachment,
  })

  // --- Holder accepts offer ---
  const { attachment: requestAttachment, appendAttachments: requestAppendAttachments } =
    await formatService.acceptOffer(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      offerAttachment,
      credentialFormats: bindingRequired
        ? { w3cV2SdJwt: { didCommSignedAttachment: { kid: holder.kid } } }
        : { w3cV2SdJwt: {} },
    })

  // --- Issuer processes request ---
  await formatService.processRequest(agentContext, {
    credentialExchangeRecord: issuerCredentialRecord,
    attachment: requestAttachment,
    requestAppendAttachments,
  })

  // --- Issuer accepts request (issues credential) ---
  const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
    credentialExchangeRecord: issuerCredentialRecord,
    requestAttachment,
    offerAttachment,
    requestAppendAttachments,
    credentialFormats: {
      w3cV2SdJwt: {
        alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      },
    },
  })

  // --- Holder processes credential ---
  await formatService.processCredential(agentContext, {
    offerAttachment,
    credentialExchangeRecord: holderCredentialRecord,
    attachment: credentialAttachment,
    requestAttachment,
    requestAppendAttachments,
  })

  // --- Assertions ---
  expect(holderCredentialRecord.credentials).toEqual([
    { credentialRecordType: 'w3c-v2', credentialRecordId: expect.any(String) },
  ])

  const credentialRecordId = holderCredentialRecord.credentials[0].credentialRecordId
  const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)
  const storedRecord = await w3cV2CredentialService.getCredentialRecordById(agentContext, credentialRecordId)

  expect(storedRecord).toBeDefined()
  expect(storedRecord.firstCredential.resolvedCredential.type).toContain('VerifiableCredential')

  if (bindingRequired) {
    const credential = storedRecord.firstCredential
    expect(credential).toBeInstanceOf(W3cV2SdJwtVerifiableCredential)
    if (credential instanceof W3cV2SdJwtVerifiableCredential) {
      expect(credential.sdJwt.prettyClaims.cnf).toBeDefined()
    }
  }
}

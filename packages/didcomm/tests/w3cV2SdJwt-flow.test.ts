import type { DidRepository, IDisclosureFrame, JsonObject } from '@credo-ts/core'
import {
  AgentContext,
  ClaimFormat,
  DidResolverService,
  DidsModuleConfig,
  InjectionSymbols,
  JsonTransformer,
  KeyDidRegistrar,
  KeyDidResolver,
  Kms,
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
  DidCommCredentialProblemReportReason,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommProblemReportError,
  DidCommW3cV2SdJwtCredentialFormatService,
} from '../src'

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
  ],
  agentConfig,
})

agentContext.dependencyManager.registerInstance(AgentContext, agentContext)
agentContext.dependencyManager.registerModules({
  w3cDataIntegrity: new W3cDataIntegrityModule(),
  w3cV2Credentials: new W3cV2CredentialsModule(),
})

const formatService = new DidCommW3cV2SdJwtCredentialFormatService()

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
})

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
  const { attachment: offerAttachment } = await formatService.createOffer(agentContext, {
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

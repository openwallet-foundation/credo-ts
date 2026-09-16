import type { DidRepository } from '@credo-ts/core'
import {
  AgentContext,
  DidResolverService,
  DidsModuleConfig,
  InjectionSymbols,
  KeyDidRegistrar,
  KeyDidResolver,
  Kms,
  W3cDataIntegrityModule,
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
})

/**
 * Runs the offer and request steps for an unbound credential issued by `issuer`, optionally with a
 * subject id already set on the offered credential.
 */
async function offerAndRequest(
  issuer: CreateDidKidVerificationMethodReturn,
  { credentialSubjectId }: { credentialSubjectId?: string } = {}
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
          issuer: issuer.did,
          validFrom: new Date().toISOString(),
          credentialSubject: { ...(credentialSubjectId ? { id: credentialSubjectId } : {}), name: 'John' },
        },
        bindingRequired: false,
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

import { PresentationSubmissionLocation } from '@animo-id/pex'
import { Agent } from '../../../../../../../core/src/agent/Agent'
import type { DifPresentationExchangeDefinitionV1 } from '../../../../../../../core/src/index'
import {
  DifPresentationExchangeModule,
  DifPresentationExchangeService,
} from '../../../../../../../core/src/modules/dif-presentation-exchange'
import {
  CREDENTIALS_CONTEXT_V1_URL,
  AnonCredsVc1BridgeServiceSymbol,
  W3cCredentialRecord,
  W3cCredentialRepository,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
  W3cJsonLdVerifiablePresentation,
} from '../../../../../../../core/src/modules/vc'
import { getAgentOptions } from '../../../../../../../core/tests'
import { DidCommProofsModule } from '../../../DidCommProofsModule'
import { DidCommProofRole, DidCommProofState } from '../../../models'
import { DidCommProofV2Protocol } from '../../../protocol'
import { DidCommProofExchangeRecord } from '../../../repository'
import type { DidCommProofFormatService } from '../../DidCommProofFormatService'
import type { DidCommDifPresentationExchangeProofFormat } from '../DidCommDifPresentationExchangeProofFormat'
import { DidCommDifPresentationExchangeProofFormatService } from '../DidCommDifPresentationExchangeProofFormatService'

const mockProofRecord = () =>
  new DidCommProofExchangeRecord({
    state: DidCommProofState.ProposalSent,
    threadId: 'add7e1a0-109e-4f37-9caa-cfd0fcdfe540',
    protocolVersion: 'v2',
    role: DidCommProofRole.Prover,
  })

const mockPresentationDefinition = (): DifPresentationExchangeDefinitionV1 => ({
  id: '32f54163-7166-48f1-93d8-ff217bdb0653',
  input_descriptors: [
    {
      schema: [{ uri: 'https://www.w3.org/2018/credentials/examples/v1' }],
      id: 'wa_driver_license',
      name: 'Washington State Business License',
      purpose: 'We can only allow licensed Washington State business representatives into the WA Business Conference',
      constraints: {
        fields: [
          {
            path: ['$.credentialSubject.id'],
          },
        ],
      },
    },
  ],
})

const mockCredentialRecord = W3cCredentialRecord.fromCredential(
  new W3cJsonLdVerifiableCredential({
    id: 'did:some:id',
    context: [CREDENTIALS_CONTEXT_V1_URL, 'https://www.w3.org/2018/credentials/examples/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
    },
    proof: {
      type: 'Ed25519Signature2020',
      created: '2021-11-13T18:19:39Z',
      verificationMethod: 'https://example.edu/issuers/14#key-1',
      proofPurpose: 'assertionMethod',
      proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
    },
  })
)

const presentationSubmission = { id: 'did:id', definition_id: 'my-id', descriptor_map: [] }
const verifiablePresentation = new W3cJsonLdVerifiablePresentation({
  verifiableCredential: [mockCredentialRecord.firstCredential],
  proof: {
    type: 'Ed25519Signature2020',
    created: '2021-11-13T18:19:39Z',
    verificationMethod: 'https://example.edu/issuers/14#key-1',
    proofPurpose: 'assertionMethod',
    proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
  },
})
vi.spyOn(W3cCredentialRepository.prototype, 'findByQuery').mockResolvedValue([mockCredentialRecord])
vi.spyOn(DifPresentationExchangeService.prototype, 'createPresentation').mockResolvedValue({
  presentationSubmission,
  verifiablePresentations: [verifiablePresentation],
  presentationSubmissionLocation: PresentationSubmissionLocation.PRESENTATION,
  encodedVerifiablePresentations: [verifiablePresentation.toJSON()],
})

describe('Presentation Exchange ProofFormatService', () => {
  let pexFormatService: DidCommProofFormatService<DidCommDifPresentationExchangeProofFormat>
  let agent: Agent

  beforeAll(async () => {
    agent = new Agent(
      getAgentOptions(
        'PresentationExchangeProofFormatService',
        {},
        {},
        {
          pex: new DifPresentationExchangeModule(),
          proofs: new DidCommProofsModule({
            proofProtocols: [
              new DidCommProofV2Protocol({ proofFormats: [new DidCommDifPresentationExchangeProofFormatService()] }),
            ],
          }),
        },
        { requireDidcomm: true }
      )
    )

    await agent.initialize()

    pexFormatService = agent.dependencyManager.resolve(DidCommDifPresentationExchangeProofFormatService)
  })

  describe('Create Presentation Exchange Proof Proposal / Request', () => {
    test('Creates Presentation Exchange Proposal', async () => {
      const presentationDefinition = mockPresentationDefinition()
      const { format, attachment } = await pexFormatService.createProposal(agent.context, {
        proofRecord: mockProofRecord(),
        proofFormats: { presentationExchange: { presentationDefinition } },
      })

      expect(attachment).toMatchObject({
        id: expect.any(String),
        mimeType: 'application/json',
        data: {
          json: presentationDefinition,
        },
      })

      expect(format).toMatchObject({
        attachmentId: expect.any(String),
        format: 'dif/presentation-exchange/definitions@v1.0',
      })
    })

    test('Creates Presentation Exchange Request', async () => {
      const presentationDefinition = mockPresentationDefinition()
      const { format, attachment } = await pexFormatService.createRequest(agent.context, {
        proofRecord: mockProofRecord(),
        proofFormats: { presentationExchange: { presentationDefinition } },
      })

      expect(attachment).toMatchObject({
        id: expect.any(String),
        mimeType: 'application/json',
        data: {
          json: {
            options: {
              challenge: expect.any(String),
            },
            presentation_definition: presentationDefinition,
          },
        },
      })

      expect(format).toMatchObject({
        attachmentId: expect.any(String),
        format: 'dif/presentation-exchange/definitions@v1.0',
      })
    })
  })

  describe('Accept Proof Request', () => {
    test('Accept a Presentation Exchange Proof Request', async () => {
      const presentationDefinition = mockPresentationDefinition()
      const { attachment: requestAttachment } = await pexFormatService.createRequest(agent.context, {
        proofRecord: mockProofRecord(),
        proofFormats: { presentationExchange: { presentationDefinition } },
      })

      const { attachment, format } = await pexFormatService.acceptRequest(agent.context, {
        proofRecord: mockProofRecord(),
        requestAttachment,
      })

      expect(attachment).toMatchObject({
        id: expect.any(String),
        mimeType: 'application/json',
        data: {
          json: {
            '@context': expect.any(Array),
            type: expect.any(Array),
            verifiableCredential: [
              {
                '@context': expect.any(Array),
                id: expect.any(String),
                type: expect.any(Array),
                issuer: expect.any(String),
                issuanceDate: expect.any(String),
                credentialSubject: {
                  id: expect.any(String),
                },
                proof: expect.any(Object),
              },
            ],
          },
        },
      })

      expect(format).toMatchObject({
        attachmentId: expect.any(String),
        format: 'dif/presentation-exchange/submission@v1.0',
      })
    })
  })

  describe('Process Presentation', () => {
    test('routes anoncreds VC1 bridge presentations through the anoncreds bridge service', async () => {
      const requestAttachment = {
        getDataAsJson: () => ({
          options: { challenge: 'challenge' },
          presentation_definition: mockPresentationDefinition(),
        }),
      }

      const presentation = new W3cJsonLdVerifiablePresentation({
        verifiableCredential: [mockCredentialRecord.firstCredential],
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'anoncreds-2023',
          proofPurpose: 'authentication',
          verificationMethod: 'did:example:holder#keys-1',
          proofValue: 'zProofValue',
          challenge: 'challenge',
        },
      })

      const attachment = {
        getDataAsJson: () => ({
          ...presentation.toJSON(),
          presentation_submission: {
            id: 'presentation-submission-id',
            definition_id: 'definition-id',
            descriptor_map: [
              {
                id: 'wa_driver_license',
                format: 'di_vp',
                path: '$.verifiableCredential[0]',
              },
            ],
          },
        }),
      }

      const validatePresentationDefinitionSpy = vi
        .spyOn(DifPresentationExchangeService.prototype, 'validatePresentationDefinition')
        .mockReturnValue(undefined)
      const validatePresentationSubmissionSpy = vi
        .spyOn(DifPresentationExchangeService.prototype, 'validatePresentationSubmission')
        .mockReturnValue(undefined)
      const validatePresentationSpy = vi
        .spyOn(DifPresentationExchangeService.prototype, 'validatePresentation')
        .mockReturnValue(undefined)
      const genericVerifySpy = vi
        .spyOn(W3cCredentialService.prototype, 'verifyPresentation')
        .mockResolvedValue({ isValid: true, validations: {}, error: undefined } as any)

      const originalResolve = agent.dependencyManager.resolve.bind(agent.dependencyManager)
      const anoncredsBridgeService = {
        verifyPresentation: vi.fn().mockResolvedValue(true),
      }
      const resolveSpy = vi.spyOn(agent.dependencyManager, 'resolve').mockImplementation((token: unknown) => {
        if (token === AnonCredsVc1BridgeServiceSymbol) {
          return anoncredsBridgeService as never
        }

        return originalResolve(token as never)
      })

      try {
        const result = await pexFormatService.processPresentation(agent.context, {
          requestAttachment: requestAttachment as any,
          attachment: attachment as any,
          proofRecord: mockProofRecord(),
        })

        expect(result).toBe(true)
        expect(anoncredsBridgeService.verifyPresentation).toHaveBeenCalledTimes(1)
        expect(genericVerifySpy).not.toHaveBeenCalled()
      } finally {
        resolveSpy.mockRestore()
        validatePresentationDefinitionSpy.mockRestore()
        validatePresentationSubmissionSpy.mockRestore()
        validatePresentationSpy.mockRestore()
        genericVerifySpy.mockRestore()
      }
    })
  })
})

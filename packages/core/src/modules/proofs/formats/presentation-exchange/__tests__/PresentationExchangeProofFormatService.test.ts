import type { PresentationDefinition } from '../../../../presentation-exchange'
import type { ProofFormatService } from '../../ProofFormatService'
import type { PresentationExchangeProofFormat } from '../PresentationExchangeProofFormat'

import { PresentationSubmissionLocation } from '@sphereon/pex'

import { getIndySdkModules } from '../../../../../../../indy-sdk/tests/setupIndySdkModule'
import { agentDependencies, getAgentConfig } from '../../../../../../tests'
import { Agent } from '../../../../../agent/Agent'
import { PresentationExchangeModule, PresentationExchangeService } from '../../../../presentation-exchange'
import {
  W3cJsonLdVerifiableCredential,
  W3cCredentialRecord,
  W3cCredentialRepository,
  CREDENTIALS_CONTEXT_V1_URL,
  W3cJsonLdVerifiablePresentation,
} from '../../../../vc'
import { ProofsModule } from '../../../ProofsModule'
import { ProofState } from '../../../models'
import { V2ProofProtocol } from '../../../protocol'
import { ProofExchangeRecord } from '../../../repository'
import { PresentationExchangeProofFormatService } from '../PresentationExchangeProofFormatService'

const mockProofRecord = () =>
  new ProofExchangeRecord({
    state: ProofState.ProposalSent,
    threadId: 'add7e1a0-109e-4f37-9caa-cfd0fcdfe540',
    protocolVersion: 'v2',
  })

const mockPresentationDefinition = (): PresentationDefinition => ({
  id: '32f54163-7166-48f1-93d8-ff217bdb0653',
  input_descriptors: [
    {
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

const mockCredentialRecord = new W3cCredentialRecord({
  tags: {},
  credential: new W3cJsonLdVerifiableCredential({
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
  }),
})

const presentationSubmission = { id: 'did:id', definition_id: 'my-id', descriptor_map: [] }
jest.spyOn(W3cCredentialRepository.prototype, 'getAll').mockResolvedValue([mockCredentialRecord])
jest.spyOn(PresentationExchangeService.prototype, 'createPresentation').mockResolvedValue({
  presentationSubmission,
  verifiablePresentations: [
    new W3cJsonLdVerifiablePresentation({
      presentationSubmission,
      verifiableCredential: [mockCredentialRecord.credential],
      proof: {
        type: 'Ed25519Signature2020',
        created: '2021-11-13T18:19:39Z',
        verificationMethod: 'https://example.edu/issuers/14#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
      },
    }),
  ],
  presentationSubmissionLocation: PresentationSubmissionLocation.PRESENTATION,
})

describe('Presentation Exchange ProofFormatService', () => {
  let pexFormatService: ProofFormatService<PresentationExchangeProofFormat>
  let agent: Agent

  beforeAll(async () => {
    agent = new Agent({
      config: getAgentConfig('PresentationExchangeProofFormatService'),
      modules: {
        someModule: new PresentationExchangeModule(),
        proofs: new ProofsModule({
          proofProtocols: [new V2ProofProtocol({ proofFormats: [new PresentationExchangeProofFormatService()] })],
        }),
        ...getIndySdkModules(),
      },
      dependencies: agentDependencies,
    })

    await agent.initialize()

    pexFormatService = agent.dependencyManager.resolve(PresentationExchangeProofFormatService)
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
            presentation_submission: {
              id: expect.any(String),
              definition_id: expect.any(String),
              descriptor_map: [],
            },
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
})

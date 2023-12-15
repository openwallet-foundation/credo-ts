import type { AgentContext } from '../../../../../agent'
import type { ProofFormatService } from '../../ProofFormatService'
import type { PresentationExchangeProofFormat } from '../PresentationExchangeProofFormat'
import type { PresentationDefinition } from '@aries-framework/presentation-exchange'

import { PresentationExchangeModule } from '@aries-framework/presentation-exchange'

import { getIndySdkModules } from '../../../../../../../indy-sdk/tests/setupIndySdkModule'
import { getAgentOptions } from '../../../../../../tests'
import { Agent } from '../../../../../agent/Agent'
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
            path: [
              '$.credentialSubject.dateOfBirth',
              '$.credentialSubject.dob',
              '$.vc.credentialSubject.dateOfBirth',
              '$.vc.credentialSubject.dob',
            ],
          },
        ],
      },
    },
  ],
})

describe('Presentation Exchange ProofFormatService', () => {
  let pexFormatService: ProofFormatService<PresentationExchangeProofFormat>
  let agentContext: AgentContext

  beforeEach(async () => {
    const agent = new Agent(
      getAgentOptions(
        'PresentationExchangeProofFormatService',
        {},
        {
          pex: new PresentationExchangeModule(),
          proofs: new ProofsModule({
            proofProtocols: [new V2ProofProtocol({ proofFormats: [new PresentationExchangeProofFormatService()] })],
          }),
          ...getIndySdkModules(),
        }
      )
    )

    await agent.initialize()

    agentContext = agent.context
    pexFormatService = agent.dependencyManager.resolve(PresentationExchangeProofFormatService)
  })

  describe('Create Presentation Exchange Proof Proposal / Request', () => {
    test('Creates Presentation Exchange Proposal', async () => {
      const presentationDefinition = mockPresentationDefinition()
      const { format, attachment } = await pexFormatService.createProposal(agentContext, {
        proofRecord: mockProofRecord(),
        proofFormats: { presentationExchange: { presentationDefinition: presentationDefinition } },
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
      const { format, attachment } = await pexFormatService.createRequest(agentContext, {
        proofRecord: mockProofRecord(),
        proofFormats: { presentationExchange: { presentationDefinition: presentationDefinition } },
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
  })

  describe('Accept Proof Request', () => {
    test('Accept a Presentation Exchange Proof Request', async () => {
      const presentationDefinition = mockPresentationDefinition()
      const { attachment: requestAttachment } = await pexFormatService.createRequest(agentContext, {
        proofRecord: mockProofRecord(),
        proofFormats: { presentationExchange: { presentationDefinition: presentationDefinition } },
      })

      const { attachment, format } = await pexFormatService.acceptRequest(agentContext, {
        proofRecord: mockProofRecord(),
        requestAttachment,
        proofFormats: { presentationExchange: { credentials: { none: [] } } },
      })

      expect(attachment).toMatchObject({
        id: expect.any(String),
        mimeType: 'application/json',
        data: {
          json: {},
        },
      })

      expect(format).toMatchObject({
        attachmentId: expect.any(String),
        format: 'dif/presentation-exchange/definitions@v1.0',
      })
    })
  })
})

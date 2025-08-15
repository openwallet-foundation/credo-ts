import type { DidCommProofStateChangedEvent } from '../../../DidCommProofEvents'
import type { ProofFormatService } from '../../../formats'
import type { CustomDidCommProofExchangeTags } from '../../../repository/DidCommProofExchangeRecord'

import { Subject } from 'rxjs'

import { EventEmitter } from '../../../../../../../core/src/agent/EventEmitter'
import { uuid } from '../../../../../../../core/src/utils/uuid'
import {
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../../../../../core/tests/helpers'
import {
  Attachment,
  AttachmentData,
  DidCommDidExchangeState,
  InboundDidCommMessageContext,
} from '../../../../../../src'
import { DidCommMessageRepository } from '../../../../../repository/DidCommMessageRepository'
import { DidCommConnectionService } from '../../../../connections/services/DidCommConnectionService'
import { DidCommProofEventTypes } from '../../../DidCommProofEvents'
import { PresentationProblemReportReason } from '../../../errors/PresentationProblemReportReason'
import { DidCommProofRole } from '../../../models'
import { ProofFormatSpec } from '../../../models/DidCommProofFormatSpec'
import { DidCommProofState } from '../../../models/DidCommProofState'
import { DidCommProofExchangeRecord } from '../../../repository/DidCommProofExchangeRecord'
import { DidCommProofExchangeRepository } from '../../../repository/DidCommProofExchangeRepository'
import { V2DidCommProofProtocol } from '../V2DidCommProofProtocol'
import { V2PresentationProblemReportMessage, V2RequestPresentationMessage } from '../messages'

// Mock classes
jest.mock('../../../repository/DidCommProofExchangeRepository')
jest.mock('../../../../connections/services/DidCommConnectionService')
jest.mock('../../../../../repository/DidCommMessageRepository')

// Mock typed object
const ProofRepositoryMock = DidCommProofExchangeRepository as jest.Mock<DidCommProofExchangeRepository>
const connectionServiceMock = DidCommConnectionService as jest.Mock<DidCommConnectionService>
const didCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>

const proofRepository = new ProofRepositoryMock()
const connectionService = new connectionServiceMock()
const didCommMessageRepository = new didCommMessageRepositoryMock()
const proofFormatService = {
  supportsFormat: () => true,
  processRequest: jest.fn(),
} as unknown as ProofFormatService

const agentConfig = getAgentConfig('V2ProofProtocolTest')
const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

const agentContext = getAgentContext({
  registerInstances: [
    [DidCommProofExchangeRepository, proofRepository],
    [DidCommMessageRepository, didCommMessageRepository],
    [DidCommConnectionService, connectionService],
    [EventEmitter, eventEmitter],
  ],
  agentConfig,
})

const proofProtocol = new V2DidCommProofProtocol({ proofFormats: [proofFormatService] })

const connection = getMockConnection({
  id: '123',
  state: DidCommDidExchangeState.Completed,
})

const requestAttachment = new Attachment({
  id: 'abdc8b63-29c6-49ad-9e10-98f9d85db9a2',
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJuYW1lIjogIlByb29mIHJlcXVlc3QiLCAibm9uX3Jldm9rZWQiOiB7ImZyb20iOiAxNjQwOTk1MTk5LCAidG8iOiAxNjQwOTk1MTk5fSwgIm5vbmNlIjogIjEiLCAicmVxdWVzdGVkX2F0dHJpYnV0ZXMiOiB7ImFkZGl0aW9uYWxQcm9wMSI6IHsibmFtZSI6ICJmYXZvdXJpdGVEcmluayIsICJub25fcmV2b2tlZCI6IHsiZnJvbSI6IDE2NDA5OTUxOTksICJ0byI6IDE2NDA5OTUxOTl9LCAicmVzdHJpY3Rpb25zIjogW3siY3JlZF9kZWZfaWQiOiAiV2dXeHF6dHJOb29HOTJSWHZ4U1RXdjozOkNMOjIwOnRhZyJ9XX19LCAicmVxdWVzdGVkX3ByZWRpY2F0ZXMiOiB7fSwgInZlcnNpb24iOiAiMS4wIn0=',
  }),
})

// A record is deserialized to JSON when it's stored into the storage. We want to simulate this behaviour for `offer`
// object to test our service would behave correctly. We use type assertion for `offer` attribute to `any`.
const mockProofExchangeRecord = ({
  state,
  role,
  threadId,
  connectionId,
  tags,
  id,
}: {
  state?: DidCommProofState
  role?: DidCommProofRole
  tags?: CustomDidCommProofExchangeTags
  threadId?: string
  connectionId?: string
  id?: string
} = {}) => {
  const proofRecord = new DidCommProofExchangeRecord({
    protocolVersion: 'v2',
    id,
    state: state || DidCommProofState.RequestSent,
    role: role || DidCommProofRole.Verifier,
    threadId: threadId ?? uuid(),
    connectionId: connectionId ?? '123',
    tags,
  })

  return proofRecord
}

describe('V2DidCommProofProtocol', () => {
  describe('processProofRequest', () => {
    let presentationRequest: V2RequestPresentationMessage
    let messageContext: InboundDidCommMessageContext<V2RequestPresentationMessage>

    beforeEach(() => {
      presentationRequest = new V2RequestPresentationMessage({
        formats: [
          new ProofFormatSpec({
            attachmentId: 'abdc8b63-29c6-49ad-9e10-98f9d85db9a2',
            format: 'hlindy/proof-req@v2.0',
          }),
        ],
        requestAttachments: [requestAttachment],
        comment: 'Proof Request',
      })

      messageContext = new InboundDidCommMessageContext(presentationRequest, { agentContext, connection })
    })

    test(`creates and return proof record in ${DidCommProofState.PresentationReceived} state with offer, without thread ID`, async () => {
      const repositorySaveSpy = jest.spyOn(proofRepository, 'save')

      // when
      const returnedProofExchangeRecord = await proofProtocol.processRequest(messageContext)

      // then
      const expectedProofExchangeRecord = {
        type: DidCommProofExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: DidCommProofState.RequestReceived,
        threadId: presentationRequest.id,
        connectionId: connection.id,
      }
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)
      const [[, createdProofExchangeRecord]] = repositorySaveSpy.mock.calls
      expect(createdProofExchangeRecord).toMatchObject(expectedProofExchangeRecord)
      expect(returnedProofExchangeRecord).toMatchObject(expectedProofExchangeRecord)
    })

    test(`emits stateChange event with ${DidCommProofState.RequestReceived}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommProofStateChangedEvent>(DidCommProofEventTypes.ProofStateChanged, eventListenerMock)

      // when
      await proofProtocol.processRequest(messageContext)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommProofStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: null,
          proofRecord: expect.objectContaining({
            state: DidCommProofState.RequestReceived,
          }),
        },
      })
    })
  })

  describe('createProblemReport', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    let proof: DidCommProofExchangeRecord

    beforeEach(() => {
      proof = mockProofExchangeRecord({
        state: DidCommProofState.RequestReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test('returns problem report message base once get error', async () => {
      // given
      mockFunction(proofRepository.getById).mockReturnValue(Promise.resolve(proof))

      // when
      const presentationProblemReportMessage = await new V2PresentationProblemReportMessage({
        description: {
          en: 'Indy error',
          code: PresentationProblemReportReason.Abandoned,
        },
      })

      presentationProblemReportMessage.setThread({ threadId })
      // then
      expect(presentationProblemReportMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/present-proof/2.0/problem-report',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
      })
    })
  })

  describe('processProblemReport', () => {
    let proof: DidCommProofExchangeRecord
    let messageContext: InboundDidCommMessageContext<V2PresentationProblemReportMessage>
    beforeEach(() => {
      proof = mockProofExchangeRecord({
        state: DidCommProofState.RequestReceived,
      })

      const presentationProblemReportMessage = new V2PresentationProblemReportMessage({
        description: {
          en: 'Indy error',
          code: PresentationProblemReportReason.Abandoned,
        },
      })
      presentationProblemReportMessage.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundDidCommMessageContext(presentationProblemReportMessage, { agentContext, connection })
    })

    test('updates problem report error message and returns proof record', async () => {
      const repositoryUpdateSpy = jest.spyOn(proofRepository, 'update')

      // given
      mockFunction(proofRepository.getSingleByQuery).mockReturnValue(Promise.resolve(proof))

      // when
      const returnedCredentialRecord = await proofProtocol.processProblemReport(messageContext)

      // then
      const expectedCredentialRecord = {
        errorMessage: 'abandoned: Indy error',
      }
      expect(proofRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
      })
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[, updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
    })
  })
})

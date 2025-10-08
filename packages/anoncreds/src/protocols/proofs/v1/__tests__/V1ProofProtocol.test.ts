import type { AgentConfig, AgentContext } from '../../../../../../core/src'
import type { CustomDidCommProofExchangeTags, DidCommProofStateChangedEvent } from '../../../../../../didcomm/src'

import { Subject } from 'rxjs'

import type { MockedClassConstructor } from '../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../core/src'
import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../core/tests'
import {
  DidCommAttachment,
  DidCommAttachmentData,
  DidCommDidExchangeState,
  DidCommInboundMessageContext,
  DidCommPresentationProblemReportReason,
  DidCommProofEventTypes,
  DidCommProofExchangeRecord,
  DidCommProofRole,
  DidCommProofState,
} from '../../../../../../didcomm/src'
import { DidCommConnectionService } from '../../../../../../didcomm/src/modules/connections/services/DidCommConnectionService'
import { DidCommProofExchangeRepository } from '../../../../../../didcomm/src/modules/proofs/repository/DidCommProofExchangeRepository'
import { DidCommMessageRepository } from '../../../../../../didcomm/src/repository/DidCommMessageRepository'
import { LegacyIndyDidCommProofFormatService } from '../../../../formats/LegacyIndyDidCommProofFormatService'
import { DidCommProofV1Protocol } from '../DidCommProofV1Protocol'
import { DidCommRequestPresentationV1Message, INDY_PROOF_REQUEST_ATTACHMENT_ID } from '../messages'
import { DidCommPresentationV1ProblemReportMessage } from '../messages/DidCommPresentationV1ProblemReportMessage'

// Mock classes
vi.mock('../../../../../../didcomm/src/modules/proofs/repository/DidCommProofExchangeRepository')
vi.mock('../../../../formats/LegacyIndyDidCommProofFormatService')
vi.mock('../../../../../../didcomm/src/repository/DidCommMessageRepository')
vi.mock('../../../../../../didcomm/src/modules/connections/services/DidCommConnectionService')

// Mock typed object
const ProofRepositoryMock = DidCommProofExchangeRepository as MockedClassConstructor<
  typeof DidCommProofExchangeRepository
>
const connectionServiceMock = DidCommConnectionService as MockedClassConstructor<typeof DidCommConnectionService>
const didCommMessageRepositoryMock = DidCommMessageRepository as MockedClassConstructor<typeof DidCommMessageRepository>
const indyProofFormatServiceMock = LegacyIndyDidCommProofFormatService as MockedClassConstructor<
  typeof LegacyIndyDidCommProofFormatService
>

const proofRepository = new ProofRepositoryMock()
const connectionService = new connectionServiceMock()
const didCommMessageRepository = new didCommMessageRepositoryMock()
const indyProofFormatService = new indyProofFormatServiceMock()

const connection = getMockConnection({
  id: '123',
  state: DidCommDidExchangeState.Completed,
})

const requestAttachment = new DidCommAttachment({
  id: INDY_PROOF_REQUEST_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new DidCommAttachmentData({
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
  requestMessage?: DidCommRequestPresentationV1Message
  tags?: CustomDidCommProofExchangeTags
  threadId?: string
  connectionId?: string
  id?: string
} = {}) => {
  const requestPresentationMessage = new DidCommRequestPresentationV1Message({
    comment: 'some comment',
    requestAttachments: [requestAttachment],
  })

  const proofRecord = new DidCommProofExchangeRecord({
    protocolVersion: 'v1',
    id,
    state: state || DidCommProofState.RequestSent,
    role: role || DidCommProofRole.Verifier,
    threadId: threadId ?? requestPresentationMessage.id,
    connectionId: connectionId ?? '123',
    tags,
  })

  return proofRecord
}

describe('DidCommProofV1Protocol', () => {
  let eventEmitter: EventEmitter
  let agentConfig: AgentConfig
  let agentContext: AgentContext
  let proofProtocol: DidCommProofV1Protocol

  beforeEach(() => {
    // real objects
    agentConfig = getAgentConfig('V1ProofProtocolTest')
    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

    agentContext = getAgentContext({
      registerInstances: [
        [DidCommProofExchangeRepository, proofRepository],
        [DidCommMessageRepository, didCommMessageRepository],
        [EventEmitter, eventEmitter],
        [DidCommConnectionService, connectionService],
      ],
      agentConfig,
    })
    proofProtocol = new DidCommProofV1Protocol({ indyProofFormat: indyProofFormatService })
  })

  describe('processRequest', () => {
    let presentationRequest: DidCommRequestPresentationV1Message
    let messageContext: DidCommInboundMessageContext<DidCommRequestPresentationV1Message>

    beforeEach(() => {
      presentationRequest = new DidCommRequestPresentationV1Message({
        comment: 'abcd',
        requestAttachments: [requestAttachment],
      })
      messageContext = new DidCommInboundMessageContext(presentationRequest, {
        connection,
        agentContext,
      })
    })

    test(`creates and return proof record in ${DidCommProofState.PresentationReceived} state with offer, without thread ID`, async () => {
      const repositorySaveSpy = vi.spyOn(proofRepository, 'save')

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
      const eventListenerMock = vi.fn()
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
      const presentationProblemReportMessage = await new DidCommPresentationV1ProblemReportMessage({
        description: {
          en: 'Indy error',
          code: DidCommPresentationProblemReportReason.Abandoned,
        },
      })

      presentationProblemReportMessage.setThread({ threadId })
      // then
      expect(presentationProblemReportMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/present-proof/1.0/problem-report',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
      })
    })
  })

  describe('processProblemReport', () => {
    let proof: DidCommProofExchangeRecord
    let messageContext: DidCommInboundMessageContext<DidCommPresentationV1ProblemReportMessage>

    beforeEach(() => {
      proof = mockProofExchangeRecord({
        state: DidCommProofState.RequestReceived,
      })

      const presentationProblemReportMessage = new DidCommPresentationV1ProblemReportMessage({
        description: {
          en: 'Indy error',
          code: DidCommPresentationProblemReportReason.Abandoned,
        },
      })
      presentationProblemReportMessage.setThread({ threadId: 'somethreadid' })
      messageContext = new DidCommInboundMessageContext(presentationProblemReportMessage, {
        connection,
        agentContext,
      })
    })

    test('updates problem report error message and returns proof record', async () => {
      const repositoryUpdateSpy = vi.spyOn(proofRepository, 'update')

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

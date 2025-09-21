import type { AgentContext } from '../../../../../../../core/src/agent'
import type { GetAgentMessageOptions } from '../../../../../repository'
import type { DidCommPlaintextMessage } from '../../../../../types'
import type { DidCommCredentialStateChangedEvent } from '../../../DidCommCredentialEvents'
import type {
  CredentialFormatAcceptRequestOptions,
  CredentialFormatCreateOfferOptions,
  DidCommCredentialFormat,
  DidCommCredentialFormatService,
} from '../../../formats'
import type { DidCommCredentialPreviewAttribute } from '../../../models/DidCommCredentialPreviewAttribute'
import type { CustomDidCommCredentialExchangeTags } from '../../../repository/DidCommCredentialExchangeRecord'

import { Subject } from 'rxjs'

import { EventEmitter } from '../../../../../../../core/src/agent/EventEmitter'
import { CredoError } from '../../../../../../../core/src/error'
import { JsonTransformer } from '../../../../../../../core/src/utils'
import { JsonEncoder } from '../../../../../../../core/src/utils/JsonEncoder'
import {
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../../../../../core/tests/helpers'
import { DidCommAttachment, DidCommAttachmentData } from '../../../../../decorators/attachment/DidCommAttachment'
import { AckStatus } from '../../../../../messages'
import { DidCommInboundMessageContext } from '../../../../../models'
import { DidCommMessageRecord, DidCommMessageRepository, DidCommMessageRole } from '../../../../../repository'
import { DidCommDidExchangeState } from '../../../../connections'
import { DidCommConnectionService } from '../../../../connections/services/DidCommConnectionService'
import { DidCommCredentialEventTypes } from '../../../DidCommCredentialEvents'
import { credReq } from '../../../__tests__/fixtures'
import { DidCommCredentialFormatSpec, DidCommCredentialRole } from '../../../models'
import { DidCommCredentialProblemReportReason } from '../../../models/DidCommCredentialProblemReportReason'
import { DidCommCredentialState } from '../../../models/DidCommCredentialState'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import { DidCommCredentialExchangeRepository } from '../../../repository/DidCommCredentialExchangeRepository'
import { DidCommCredentialV2Protocol } from '../DidCommCredentialV2Protocol'
import { DidCommCredentialV2Preview, DidCommProposeCredentialV2Message } from '../messages'
import { DidCommCredentialV2AckMessage } from '../messages/DidCommCredentialV2AckMessage'
import { DidCommCredentialV2ProblemReportMessage } from '../messages/DidCommCredentialV2ProblemReportMessage'
import { DidCommIssueCredentialV2Message } from '../messages/DidCommIssueCredentialV2Message'
import { DidCommOfferCredentialV2Message } from '../messages/DidCommOfferCredentialV2Message'
import { DidCommRequestCredentialV2Message } from '../messages/DidCommRequestCredentialV2Message'
// Mock classes

jest.mock('../../../repository/DidCommCredentialExchangeRepository')
jest.mock('../../../../../repository/DidCommMessageRepository')
jest.mock('../../../../connections/services/DidCommConnectionService')
jest.mock('../../../../../DidCommDispatcher')

// Mock typed object
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as jest.Mock<DidCommCredentialExchangeRepository>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const ConnectionServiceMock = DidCommConnectionService as jest.Mock<DidCommConnectionService>

const credentialRepository = new CredentialRepositoryMock()
const didCommMessageRepository = new DidCommMessageRepositoryMock()
const connectionService = new ConnectionServiceMock()

const agentConfig = getAgentConfig('V2CredentialProtocolCredTest')
const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

const agentContext = getAgentContext({
  registerInstances: [
    [DidCommCredentialExchangeRepository, credentialRepository],
    [DidCommMessageRepository, didCommMessageRepository],
    [DidCommConnectionService, connectionService],
    [EventEmitter, eventEmitter],
  ],
  agentConfig,
})

const connection = getMockConnection({
  id: '123',
  state: DidCommDidExchangeState.Completed,
})

const offerAttachment = new DidCommAttachment({
  id: 'offer-attachment-id',
  mimeType: 'application/json',
  data: new DidCommAttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

const requestAttachment = new DidCommAttachment({
  id: 'request-attachment-id',
  mimeType: 'application/json',
  data: new DidCommAttachmentData({
    base64: JsonEncoder.toBase64(credReq),
  }),
})

const credentialAttachment = new DidCommAttachment({
  id: 'credential-attachment-id',
  mimeType: 'application/json',
  data: new DidCommAttachmentData({
    base64: JsonEncoder.toBase64({
      values: {},
    }),
  }),
})

const requestFormat = new DidCommCredentialFormatSpec({
  attachmentId: 'request-attachment-id',
  format: 'hlindy/cred-filter@v2.0',
})

const proposalAttachment = new DidCommAttachment({
  id: 'proposal-attachment-id',
  data: new DidCommAttachmentData({
    json: {
      any: 'value',
    },
  }),
})

const offerFormat = new DidCommCredentialFormatSpec({
  attachmentId: 'offer-attachment-id',
  format: 'hlindy/cred-abstract@v2.0',
})

const proposalFormat = new DidCommCredentialFormatSpec({
  attachmentId: 'proposal-attachment-id',
  format: 'hlindy/cred-abstract@v2.0',
})

const credentialFormat = new DidCommCredentialFormatSpec({
  attachmentId: 'credential-attachment-id',
  format: 'hlindy/cred@v2.0',
})

const credentialProposalMessage = new DidCommProposeCredentialV2Message({
  formats: [proposalFormat],
  proposalAttachments: [proposalAttachment],
})
const credentialRequestMessage = new DidCommRequestCredentialV2Message({
  formats: [requestFormat],
  requestAttachments: [requestAttachment],
})
credentialRequestMessage.setThread({ threadId: 'somethreadid' })

const credentialOfferMessage = new DidCommOfferCredentialV2Message({
  formats: [offerFormat],
  comment: 'some comment',
  credentialPreview: new DidCommCredentialV2Preview({
    attributes: [],
  }),
  offerAttachments: [offerAttachment],
})
const credentialIssueMessage = new DidCommIssueCredentialV2Message({
  credentialAttachments: [credentialAttachment],
  formats: [credentialFormat],
})
credentialIssueMessage.setThread({ threadId: 'somethreadid' })

const didCommMessageRecord = new DidCommMessageRecord({
  associatedRecordId: '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
  message: {} as DidCommPlaintextMessage,
  role: DidCommMessageRole.Receiver,
})

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const getAgentMessageMock = async (_agentContext: AgentContext, options: GetAgentMessageOptions<any>) => {
  if (options.messageClass === DidCommProposeCredentialV2Message) {
    return credentialProposalMessage
  }
  if (options.messageClass === DidCommOfferCredentialV2Message) {
    return credentialOfferMessage
  }
  if (options.messageClass === DidCommRequestCredentialV2Message) {
    return credentialRequestMessage
  }
  if (options.messageClass === DidCommIssueCredentialV2Message) {
    return credentialIssueMessage
  }

  throw new CredoError('Could not find message')
}

// A record is deserialized to JSON when it's stored into the storage. We want to simulate this behaviour for `offer`
// object to test our service would behave correctly. We use type assertion for `offer` attribute to `any`.
const mockCredentialRecord = ({
  state,
  role,
  threadId,
  connectionId,
  tags,
  id,
  credentialAttributes,
}: {
  state?: DidCommCredentialState
  role?: DidCommCredentialRole
  tags?: CustomDidCommCredentialExchangeTags
  threadId?: string
  connectionId?: string
  id?: string
  credentialAttributes?: DidCommCredentialPreviewAttribute[]
} = {}) => {
  const credentialExchangeRecord = new DidCommCredentialExchangeRecord({
    id,
    credentialAttributes: credentialAttributes,
    state: state || DidCommCredentialState.OfferSent,
    role: role || DidCommCredentialRole.Issuer,
    threadId: threadId || 'thread-id',
    connectionId: connectionId ?? '123',
    credentials: [
      {
        credentialRecordType: 'test',
        credentialRecordId: '123456',
      },
    ],
    tags,
    protocolVersion: 'v2',
  })

  return credentialExchangeRecord
}

interface TestCredentialFormat extends DidCommCredentialFormat {
  formatKey: 'test'
  credentialRecordType: 'test'
}

type TestCredentialFormatService = DidCommCredentialFormatService<TestCredentialFormat>

// biome-ignore lint/suspicious/noExportsInTest: <explanation>
export const testCredentialFormatService = {
  credentialRecordType: 'test',
  formatKey: 'test',
  supportsFormat: (_format: string) => true,
  createOffer: async (
    _agentContext: AgentContext,
    _options: CredentialFormatCreateOfferOptions<TestCredentialFormat>
  ) => ({
    attachment: offerAttachment,
    format: offerFormat,
  }),
  acceptRequest: async (
    _agentContext: AgentContext,
    _options: CredentialFormatAcceptRequestOptions<TestCredentialFormat>
  ) => ({ attachment: credentialAttachment, format: credentialFormat }),
  deleteCredentialById: jest.fn(),
  processCredential: jest.fn(),
  acceptOffer: () => ({ attachment: requestAttachment, format: requestFormat }),
  processRequest: jest.fn(),
} as unknown as TestCredentialFormatService

describe('credentialProtocol', () => {
  let credentialProtocol: DidCommCredentialV2Protocol

  beforeEach(async () => {
    // mock function implementations
    mockFunction(connectionService.getById).mockResolvedValue(connection)
    mockFunction(didCommMessageRepository.findAgentMessage).mockImplementation(getAgentMessageMock)
    mockFunction(didCommMessageRepository.getAgentMessage).mockImplementation(getAgentMessageMock)
    mockFunction(didCommMessageRepository.findByQuery).mockResolvedValue([
      didCommMessageRecord,
      didCommMessageRecord,
      didCommMessageRecord,
    ])

    credentialProtocol = new DidCommCredentialV2Protocol({
      credentialFormats: [testCredentialFormatService],
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('acceptOffer', () => {
    test(`updates state to ${DidCommCredentialState.RequestSent}`, async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // when
      await credentialProtocol.acceptOffer(agentContext, {
        credentialExchangeRecord,
        credentialFormats: {},
      })

      // then
      expect(credentialRepository.update).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          state: DidCommCredentialState.RequestSent,
        })
      )
    })

    test('returns credential request message base on existing credential offer message', async () => {
      // given
      const comment = 'credential request comment'

      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // when
      const { message: credentialRequest } = await credentialProtocol.acceptOffer(agentContext, {
        credentialExchangeRecord,
        comment,
      })

      // then
      expect(credentialRequest.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/request-credential',
        '~thread': {
          thid: credentialExchangeRecord.threadId,
        },
        formats: [JsonTransformer.toJSON(requestFormat)],
        comment,
        'requests~attach': [JsonTransformer.toJSON(requestAttachment)],
      })
    })

    const validState = DidCommCredentialState.OfferReceived
    const invalidCredentialStates = Object.values(DidCommCredentialState).filter((state) => state !== validState)
    test('throws an error when state transition is invalid', async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(
            credentialProtocol.acceptOffer(agentContext, { credentialExchangeRecord: mockCredentialRecord({ state }) })
          ).rejects.toThrow(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processRequest', () => {
    test(`updates state to ${DidCommCredentialState.RequestReceived}, set request and returns credential record`, async () => {
      const credentialExchangeRecord = mockCredentialRecord({ state: DidCommCredentialState.OfferSent })
      const messageContext = new DidCommInboundMessageContext(credentialRequestMessage, {
        connection,
        agentContext,
      })

      // given
      mockFunction(credentialRepository.findSingleByQuery).mockResolvedValue(credentialExchangeRecord)

      // when
      const returnedCredentialRecord = await credentialProtocol.processRequest(messageContext)

      // then
      expect(credentialRepository.findSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
        role: DidCommCredentialRole.Issuer,
      })
      expect(credentialRepository.update).toHaveBeenCalledTimes(1)
      expect(returnedCredentialRecord.state).toEqual(DidCommCredentialState.RequestReceived)
    })

    test(`emits stateChange event from ${DidCommCredentialState.OfferSent} to ${DidCommCredentialState.RequestReceived}`, async () => {
      const credentialExchangeRecord = mockCredentialRecord({ state: DidCommCredentialState.OfferSent })
      const messageContext = new DidCommInboundMessageContext(credentialRequestMessage, {
        connection,
        agentContext,
      })

      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(
        DidCommCredentialEventTypes.DidCommCredentialStateChanged,
        eventListenerMock
      )

      mockFunction(credentialRepository.findSingleByQuery).mockResolvedValue(credentialExchangeRecord)

      const returnedCredentialRecord = await credentialProtocol.processRequest(messageContext)

      // then
      expect(credentialRepository.findSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
        role: DidCommCredentialRole.Issuer,
      })
      expect(eventListenerMock).toHaveBeenCalled()
      expect(returnedCredentialRecord.state).toEqual(DidCommCredentialState.RequestReceived)
    })

    const validState = DidCommCredentialState.OfferSent
    const invalidCredentialStates = Object.values(DidCommCredentialState).filter((state) => state !== validState)
    test('throws an error when state transition is invalid', async () => {
      const messageContext = new DidCommInboundMessageContext(credentialRequestMessage, {
        connection,
        agentContext,
      })

      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          mockFunction(credentialRepository.findSingleByQuery).mockReturnValue(
            Promise.resolve(mockCredentialRecord({ state }))
          )
          await expect(credentialProtocol.processRequest(messageContext)).rejects.toThrow(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          )
        })
      )
    })
  })

  describe('acceptRequest', () => {
    test(`updates state to ${DidCommCredentialState.CredentialIssued}`, async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.RequestReceived,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      await credentialProtocol.acceptRequest(agentContext, {
        credentialExchangeRecord,
        comment: 'credential response comment',
      })

      // then
      expect(credentialRepository.update).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          state: DidCommCredentialState.CredentialIssued,
        })
      )
    })

    test(`emits stateChange event from ${DidCommCredentialState.RequestReceived} to ${DidCommCredentialState.CredentialIssued}`, async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.RequestReceived,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      const eventListenerMock = jest.fn()

      // given
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialExchangeRecord)
      eventEmitter.on<DidCommCredentialStateChangedEvent>(
        DidCommCredentialEventTypes.DidCommCredentialStateChanged,
        eventListenerMock
      )

      // when
      await credentialProtocol.acceptRequest(agentContext, {
        credentialExchangeRecord,
        comment: 'credential response comment',
      })

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommCredentialStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: DidCommCredentialState.RequestReceived,
          credentialExchangeRecord: expect.objectContaining({
            state: DidCommCredentialState.CredentialIssued,
          }),
        },
      })
    })

    test('returns credential response message base on credential request message', async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.RequestReceived,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // given
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialExchangeRecord)
      const comment = 'credential response comment'

      // when
      const { message: credentialResponse } = await credentialProtocol.acceptRequest(agentContext, {
        comment: 'credential response comment',
        credentialExchangeRecord,
      })

      // then
      expect(credentialResponse.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/issue-credential',
        '~thread': {
          thid: credentialExchangeRecord.threadId,
        },
        comment,
        formats: [JsonTransformer.toJSON(credentialFormat)],
        'credentials~attach': [JsonTransformer.toJSON(credentialAttachment)],
        '~please_ack': expect.any(Object),
      })
    })
  })

  describe('processCredential', () => {
    test('finds credential record by thread ID and saves credential attachment into the wallet', async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.RequestSent,
      })

      const messageContext = new DidCommInboundMessageContext(credentialIssueMessage, {
        connection,
        agentContext,
      })

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialExchangeRecord)

      await credentialProtocol.processCredential(messageContext)
    })
  })

  describe('acceptCredential', () => {
    test(`updates state to ${DidCommCredentialState.Done}`, async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.CredentialReceived,
        threadId: 'somethreadid',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // when
      await credentialProtocol.acceptCredential(agentContext, { credentialExchangeRecord })

      // then
      expect(credentialRepository.update).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          state: DidCommCredentialState.Done,
        })
      )
    })

    test(`emits stateChange event from ${DidCommCredentialState.CredentialReceived} to ${DidCommCredentialState.Done}`, async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.CredentialReceived,
        threadId: 'somethreadid',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(
        DidCommCredentialEventTypes.DidCommCredentialStateChanged,
        eventListenerMock
      )

      // when
      await credentialProtocol.acceptCredential(agentContext, { credentialExchangeRecord })

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommCredentialStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: DidCommCredentialState.CredentialReceived,
          credentialExchangeRecord: expect.objectContaining({
            state: DidCommCredentialState.Done,
          }),
        },
      })
    })

    test('returns ack message base on credential issue message', async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.CredentialReceived,
        threadId: 'somethreadid',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // given
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialExchangeRecord)

      // when
      const { message: ackMessage } = await credentialProtocol.acceptCredential(agentContext, {
        credentialExchangeRecord,
      })

      // then
      expect(ackMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/ack',
        '~thread': {
          thid: 'somethreadid',
        },
      })
    })

    const validState = DidCommCredentialState.CredentialReceived
    const invalidCredentialStates = Object.values(DidCommCredentialState).filter((state) => state !== validState)
    test('throws an error when state transition is invalid', async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(
            credentialProtocol.acceptCredential(agentContext, {
              credentialExchangeRecord: mockCredentialRecord({
                state,
                threadId: 'somethreadid',
                connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
              }),
            })
          ).rejects.toThrow(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processAck', () => {
    const credentialRequest = new DidCommCredentialV2AckMessage({
      status: AckStatus.OK,
      threadId: 'somethreadid',
    })
    const messageContext = new DidCommInboundMessageContext(credentialRequest, { agentContext, connection })

    test(`updates state to ${DidCommCredentialState.Done} and returns credential record`, async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.CredentialIssued,
      })

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialExchangeRecord)

      // when
      const returnedCredentialRecord = await credentialProtocol.processAck(messageContext)

      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
        connectionId: '123',
        role: DidCommCredentialRole.Issuer,
      })

      expect(returnedCredentialRecord.state).toBe(DidCommCredentialState.Done)
    })
  })

  describe('createProblemReport', () => {
    test('returns problem report message base once get error', async () => {
      // given
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.OfferReceived,
        threadId: 'somethreadid',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
      const description = 'Indy error'
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialExchangeRecord)

      // when
      const { message } = await credentialProtocol.createProblemReport(agentContext, {
        description,
        credentialExchangeRecord,
      })

      message.setThread({ threadId: 'somethreadid' })
      // then
      expect(message.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/problem-report',
        '~thread': {
          thid: 'somethreadid',
        },
        description: {
          code: DidCommCredentialProblemReportReason.IssuanceAbandoned,
          en: description,
        },
      })
    })
  })

  describe('processProblemReport', () => {
    const message = new DidCommCredentialV2ProblemReportMessage({
      description: {
        en: 'Indy error',
        code: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      },
    })
    message.setThread({ threadId: 'somethreadid' })
    const messageContext = new DidCommInboundMessageContext(message, {
      connection,
      agentContext,
    })

    test('updates problem report error message and returns credential record', async () => {
      const credentialExchangeRecord = mockCredentialRecord({
        state: DidCommCredentialState.OfferReceived,
      })

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialExchangeRecord)

      // when
      const returnedCredentialRecord = await credentialProtocol.processProblemReport(messageContext)

      // then

      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
      })
      expect(credentialRepository.update).toHaveBeenCalled()
      expect(returnedCredentialRecord.errorMessage).toBe('issuance-abandoned: Indy error')
    })
  })

  describe('repository methods', () => {
    it('getById should return value from credentialRepository.getById', async () => {
      const expected = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(expected))
      const result = await credentialProtocol.getById(agentContext, expected.id)
      expect(credentialRepository.getById).toHaveBeenCalledWith(agentContext, expected.id)

      expect(result).toBe(expected)
    })

    it('getById should return value from credentialRepository.getSingleByQuery', async () => {
      const expected = mockCredentialRecord()
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(expected))

      const result = await credentialProtocol.getByProperties(agentContext, {
        threadId: 'threadId',
        role: DidCommCredentialRole.Issuer,
        connectionId: 'connectionId',
      })

      expect(credentialRepository.getSingleByQuery).toHaveBeenCalledWith(agentContext, {
        threadId: 'threadId',
        role: DidCommCredentialRole.Issuer,
        connectionId: 'connectionId',
      })

      expect(result).toBe(expected)
    })

    it('findById should return value from credentialRepository.findById', async () => {
      const expected = mockCredentialRecord()
      mockFunction(credentialRepository.findById).mockReturnValue(Promise.resolve(expected))
      const result = await credentialProtocol.findById(agentContext, expected.id)
      expect(credentialRepository.findById).toHaveBeenCalledWith(agentContext, expected.id)

      expect(result).toBe(expected)
    })

    it('getAll should return value from credentialRepository.getAll', async () => {
      const expected = [mockCredentialRecord(), mockCredentialRecord()]

      mockFunction(credentialRepository.getAll).mockReturnValue(Promise.resolve(expected))
      const result = await credentialProtocol.getAll(agentContext)
      expect(credentialRepository.getAll).toHaveBeenCalledWith(agentContext)

      expect(result).toEqual(expect.arrayContaining(expected))
    })

    it('findAllByQuery should return value from credentialRepository.findByQuery', async () => {
      const expected = [mockCredentialRecord(), mockCredentialRecord()]

      mockFunction(credentialRepository.findByQuery).mockReturnValue(Promise.resolve(expected))
      const result = await credentialProtocol.findAllByQuery(
        agentContext,
        { state: DidCommCredentialState.OfferSent },
        {}
      )
      expect(credentialRepository.findByQuery).toHaveBeenCalledWith(
        agentContext,
        { state: DidCommCredentialState.OfferSent },
        {}
      )

      expect(result).toEqual(expect.arrayContaining(expected))
    })
  })

  describe('deleteCredential', () => {
    it('should call delete from repository', async () => {
      const credentialExchangeRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credentialExchangeRecord))

      const repositoryDeleteSpy = jest.spyOn(credentialRepository, 'delete')
      await credentialProtocol.delete(agentContext, credentialExchangeRecord)
      expect(repositoryDeleteSpy).toHaveBeenNthCalledWith(1, agentContext, credentialExchangeRecord)
    })

    it('should call deleteCredentialById in testCredentialFormatService if deleteAssociatedCredential is true', async () => {
      const deleteCredentialMock = mockFunction(testCredentialFormatService.deleteCredentialById)

      const credentialExchangeRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialExchangeRecord)

      await credentialProtocol.delete(agentContext, credentialExchangeRecord, {
        deleteAssociatedCredentials: true,
        deleteAssociatedDidCommMessages: false,
      })

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(
        1,
        agentContext,
        credentialExchangeRecord.credentials[0].credentialRecordId
      )
    })

    it('should not call deleteCredentialById in testCredentialFormatService if deleteAssociatedCredential is false', async () => {
      const deleteCredentialMock = mockFunction(testCredentialFormatService.deleteCredentialById)

      const credentialExchangeRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialExchangeRecord)

      await credentialProtocol.delete(agentContext, credentialExchangeRecord, {
        deleteAssociatedCredentials: false,
        deleteAssociatedDidCommMessages: false,
      })

      expect(deleteCredentialMock).not.toHaveBeenCalled()
    })

    it('deleteAssociatedCredentials should default to true', async () => {
      const deleteCredentialMock = mockFunction(testCredentialFormatService.deleteCredentialById)

      const credentialExchangeRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialExchangeRecord)

      await credentialProtocol.delete(agentContext, credentialExchangeRecord)

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(
        1,
        agentContext,
        credentialExchangeRecord.credentials[0].credentialRecordId
      )
    })
    it('deleteAssociatedDidCommMessages should default to true', async () => {
      const deleteCredentialMock = mockFunction(testCredentialFormatService.deleteCredentialById)

      const credentialExchangeRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialExchangeRecord)

      await credentialProtocol.delete(agentContext, credentialExchangeRecord)

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(
        1,
        agentContext,
        credentialExchangeRecord.credentials[0].credentialRecordId
      )
      expect(didCommMessageRepository.delete).toHaveBeenCalledTimes(3)
    })
  })
})

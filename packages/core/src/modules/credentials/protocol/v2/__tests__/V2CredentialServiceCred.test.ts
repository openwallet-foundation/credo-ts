import type { IndyCredentialViewMetadata } from '../../../../..'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { GetAgentMessageOptions } from '../../../../../storage'
import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttribute'
import type { CustomCredentialTags } from '../../../repository/CredentialExchangeRecord'

import { AriesFrameworkError, CredentialFormatSpec } from '../../../../..'
import { getAgentConfig, getMockConnection, mockFunction } from '../../../../../../tests/helpers'
import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { DidCommMessageRecord, DidCommMessageRole, DidCommMessageRepository } from '../../../../../storage'
import { JsonTransformer } from '../../../../../utils'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { AckStatus } from '../../../../common/messages/AckMessage'
import { DidExchangeState } from '../../../../connections'
import { ConnectionService } from '../../../../connections/services/ConnectionService'
import { MediationRecipientService } from '../../../../routing/services/MediationRecipientService'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { credReq } from '../../../__tests__/fixtures'
import { CredentialProblemReportReason } from '../../../errors/CredentialProblemReportReason'
import { IndyCredentialFormatService } from '../../../formats'
import { IndyCredentialUtils } from '../../../formats/indy/IndyCredentialUtils'
import { CredentialState } from '../../../models/CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { CredentialMetadataKeys } from '../../../repository/CredentialMetadataTypes'
import { CredentialRepository } from '../../../repository/CredentialRepository'
import { V1CredentialPreview } from '../../v1/messages/V1CredentialPreview'
import { V2CredentialService } from '../V2CredentialService'
import { V2ProposeCredentialMessage } from '../messages'
import { V2CredentialAckMessage } from '../messages/V2CredentialAckMessage'
import { V2CredentialProblemReportMessage } from '../messages/V2CredentialProblemReportMessage'
import { V2IssueCredentialMessage } from '../messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

// Mock classes
jest.mock('../../../repository/CredentialRepository')
jest.mock('../../../formats/indy/IndyCredentialFormatService')
jest.mock('../../../../../storage/didcomm/DidCommMessageRepository')
jest.mock('../../../../routing/services/MediationRecipientService')
jest.mock('../../../../connections/services/ConnectionService')
jest.mock('../../../../../agent/Dispatcher')

// Mock typed object
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const IndyCredentialFormatServiceMock = IndyCredentialFormatService as jest.Mock<IndyCredentialFormatService>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const MediationRecipientServiceMock = MediationRecipientService as jest.Mock<MediationRecipientService>
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>

const credentialRepository = new CredentialRepositoryMock()
const didCommMessageRepository = new DidCommMessageRepositoryMock()
const mediationRecipientService = new MediationRecipientServiceMock()
const indyCredentialFormatService = new IndyCredentialFormatServiceMock()
const dispatcher = new DispatcherMock()
const connectionService = new ConnectionServiceMock()

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
indyCredentialFormatService.formatKey = 'indy'

const connection = getMockConnection({
  id: '123',
  state: DidExchangeState.Completed,
})

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const offerAttachment = new Attachment({
  id: 'offer-attachment-id',
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

const requestAttachment = new Attachment({
  id: 'request-attachment-id',
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64(credReq),
  }),
})

const credentialAttachment = new Attachment({
  id: 'credential-attachment-id',
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64({
      values: IndyCredentialUtils.convertAttributesToValues(credentialPreview.attributes),
    }),
  }),
})

const requestFormat = new CredentialFormatSpec({
  attachId: 'request-attachment-id',
  format: 'hlindy/cred-filter@v2.0',
})

const proposalAttachment = new Attachment({
  id: 'proposal-attachment-id',
  data: new AttachmentData({
    json: {
      any: 'value',
    },
  }),
})

const offerFormat = new CredentialFormatSpec({
  attachId: 'offer-attachment-id',
  format: 'hlindy/cred-abstract@v2.0',
})

const proposalFormat = new CredentialFormatSpec({
  attachId: 'proposal-attachment-id',
  format: 'hlindy/cred-abstract@v2.0',
})

const credentialFormat = new CredentialFormatSpec({
  attachId: 'credential-attachment-id',
  format: 'hlindy/cred@v2.0',
})

const credentialProposalMessage = new V2ProposeCredentialMessage({
  formats: [proposalFormat],
  proposalAttachments: [proposalAttachment],
})
const credentialRequestMessage = new V2RequestCredentialMessage({
  formats: [requestFormat],
  requestAttachments: [requestAttachment],
})
credentialRequestMessage.setThread({ threadId: 'somethreadid' })

const credentialOfferMessage = new V2OfferCredentialMessage({
  formats: [offerFormat],
  comment: 'some comment',
  credentialPreview: credentialPreview,
  offerAttachments: [offerAttachment],
})
const credentialIssueMessage = new V2IssueCredentialMessage({
  credentialAttachments: [credentialAttachment],
  formats: [credentialFormat],
})
credentialIssueMessage.setThread({ threadId: 'somethreadid' })

const didCommMessageRecord = new DidCommMessageRecord({
  associatedRecordId: '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
  message: {},
  role: DidCommMessageRole.Receiver,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAgentMessageMock = async (options: GetAgentMessageOptions<any>) => {
  if (options.messageClass === V2ProposeCredentialMessage) {
    return credentialProposalMessage
  }
  if (options.messageClass === V2OfferCredentialMessage) {
    return credentialOfferMessage
  }
  if (options.messageClass === V2RequestCredentialMessage) {
    return credentialRequestMessage
  }
  if (options.messageClass === V2IssueCredentialMessage) {
    return credentialIssueMessage
  }

  throw new AriesFrameworkError('Could not find message')
}

// A record is deserialized to JSON when it's stored into the storage. We want to simulate this behaviour for `offer`
// object to test our service would behave correctly. We use type assertion for `offer` attribute to `any`.
const mockCredentialRecord = ({
  state,
  metadata,
  threadId,
  connectionId,
  tags,
  id,
  credentialAttributes,
}: {
  state?: CredentialState
  metadata?: IndyCredentialViewMetadata & { indyRequest: Record<string, unknown> }
  tags?: CustomCredentialTags
  threadId?: string
  connectionId?: string
  id?: string
  credentialAttributes?: CredentialPreviewAttribute[]
} = {}) => {
  const credentialRecord = new CredentialExchangeRecord({
    id,
    credentialAttributes: credentialAttributes || credentialPreview.attributes,
    state: state || CredentialState.OfferSent,
    threadId: threadId || 'thread-id',
    connectionId: connectionId ?? '123',
    credentials: [
      {
        credentialRecordType: 'indy',
        credentialRecordId: '123456',
      },
    ],
    tags,
    protocolVersion: 'v2',
  })

  if (metadata?.indyRequest) {
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, { ...metadata.indyRequest })
  }

  if (metadata?.schemaId) {
    credentialRecord.metadata.add(CredentialMetadataKeys.IndyCredential, {
      schemaId: metadata.schemaId,
    })
  }

  if (metadata?.credentialDefinitionId) {
    credentialRecord.metadata.add(CredentialMetadataKeys.IndyCredential, {
      credentialDefinitionId: metadata.credentialDefinitionId,
    })
  }

  return credentialRecord
}

describe('CredentialService', () => {
  let eventEmitter: EventEmitter
  let agentConfig: AgentConfig
  let credentialService: V2CredentialService

  beforeEach(async () => {
    agentConfig = getAgentConfig('V2CredentialServiceCredTest')
    eventEmitter = new EventEmitter(agentConfig)

    // mock function implementations
    mockFunction(connectionService.getById).mockResolvedValue(connection)
    mockFunction(didCommMessageRepository.findAgentMessage).mockImplementation(getAgentMessageMock)
    mockFunction(didCommMessageRepository.getAgentMessage).mockImplementation(getAgentMessageMock)
    mockFunction(didCommMessageRepository.findByQuery).mockResolvedValue([
      didCommMessageRecord,
      didCommMessageRecord,
      didCommMessageRecord,
    ])

    credentialService = new V2CredentialService(
      connectionService,
      didCommMessageRepository,
      agentConfig,
      mediationRecipientService,
      dispatcher,
      eventEmitter,
      credentialRepository,
      indyCredentialFormatService
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('acceptOffer', () => {
    test(`updates state to ${CredentialState.RequestSent}, set request metadata`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)
      mockFunction(indyCredentialFormatService.acceptOffer).mockResolvedValue({
        attachment: requestAttachment,
        format: requestFormat,
      })

      // when
      await credentialService.acceptOffer({
        credentialRecord,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          },
        },
      })

      // then
      expect(credentialRepository.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          state: CredentialState.RequestSent,
        })
      )
    })

    test('returns credential request message base on existing credential offer message', async () => {
      // given
      const comment = 'credential request comment'

      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)
      mockFunction(indyCredentialFormatService.acceptOffer).mockResolvedValue({
        attachment: requestAttachment,
        format: requestFormat,
      })

      // when
      const { message: credentialRequest } = await credentialService.acceptOffer({ credentialRecord, comment })

      // then
      expect(credentialRequest.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/request-credential',
        '~thread': {
          thid: credentialRecord.threadId,
        },
        formats: [JsonTransformer.toJSON(requestFormat)],
        comment,
        'requests~attach': [JsonTransformer.toJSON(requestAttachment)],
      })
    })

    const validState = CredentialState.OfferReceived
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(
            credentialService.acceptOffer({ credentialRecord: mockCredentialRecord({ state }) })
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processRequest', () => {
    test(`updates state to ${CredentialState.RequestReceived}, set request and returns credential record`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)

      const credentialRecord = mockCredentialRecord({ state: CredentialState.OfferSent })
      const messageContext = new InboundMessageContext(credentialRequestMessage, {
        connection,
      })

      // given
      mockFunction(credentialRepository.findSingleByQuery).mockResolvedValue(credentialRecord)

      // when
      const returnedCredentialRecord = await credentialService.processRequest(messageContext)

      // then
      expect(credentialRepository.findSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })
      expect(credentialRepository.update).toHaveBeenCalledTimes(1)
      expect(returnedCredentialRecord.state).toEqual(CredentialState.RequestReceived)
    })

    test(`emits stateChange event from ${CredentialState.OfferSent} to ${CredentialState.RequestReceived}`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)

      const credentialRecord = mockCredentialRecord({ state: CredentialState.OfferSent })
      const messageContext = new InboundMessageContext(credentialRequestMessage, {
        connection,
      })

      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      mockFunction(credentialRepository.findSingleByQuery).mockResolvedValue(credentialRecord)

      const returnedCredentialRecord = await credentialService.processRequest(messageContext)

      // then
      expect(credentialRepository.findSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })
      expect(eventListenerMock).toHaveBeenCalled()
      expect(returnedCredentialRecord.state).toEqual(CredentialState.RequestReceived)
    })

    const validState = CredentialState.OfferSent
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)

      const messageContext = new InboundMessageContext(credentialRequestMessage, {
        connection,
      })

      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          mockFunction(credentialRepository.findSingleByQuery).mockReturnValue(
            Promise.resolve(mockCredentialRecord({ state }))
          )
          await expect(credentialService.processRequest(messageContext)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          )
        })
      )
    })
  })

  describe('acceptRequest', () => {
    test(`updates state to ${CredentialState.CredentialIssued}`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)
      mockFunction(indyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: credentialFormat,
      })

      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      await credentialService.acceptRequest({
        credentialRecord,
        comment: 'credential response comment',
      })

      // then
      expect(credentialRepository.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          state: CredentialState.CredentialIssued,
        })
      )
    })

    test(`emits stateChange event from ${CredentialState.RequestReceived} to ${CredentialState.CredentialIssued}`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)
      mockFunction(indyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: credentialFormat,
      })

      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      const eventListenerMock = jest.fn()

      // given
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      await credentialService.acceptRequest({
        credentialRecord,
        comment: 'credential response comment',
      })

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        payload: {
          previousState: CredentialState.RequestReceived,
          credentialRecord: expect.objectContaining({
            state: CredentialState.CredentialIssued,
          }),
        },
      })
    })

    test('returns credential response message base on credential request message', async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)
      mockFunction(indyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: credentialFormat,
      })

      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // given
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)
      const comment = 'credential response comment'

      // when
      const { message: credentialResponse } = await credentialService.acceptRequest({
        comment: 'credential response comment',
        credentialRecord,
      })

      // then
      expect(credentialResponse.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/issue-credential',
        '~thread': {
          thid: credentialRecord.threadId,
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
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)

      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestSent,
      })

      const messageContext = new InboundMessageContext(credentialIssueMessage, {
        connection,
      })

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialRecord)

      // when
      const record = await credentialService.processCredential(messageContext)

      expect(record.credentialAttributes?.length).toBe(2)
    })
  })

  describe('acceptCredential', () => {
    test(`updates state to ${CredentialState.Done}`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.CredentialReceived,
        threadId: 'somethreadid',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // when
      await credentialService.acceptCredential({ credentialRecord })

      // then
      expect(credentialRepository.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          state: CredentialState.Done,
        })
      )
    })

    test(`emits stateChange event from ${CredentialState.CredentialReceived} to ${CredentialState.Done}`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.CredentialReceived,
        threadId: 'somethreadid',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      await credentialService.acceptCredential({ credentialRecord })

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        payload: {
          previousState: CredentialState.CredentialReceived,
          credentialRecord: expect.objectContaining({
            state: CredentialState.Done,
          }),
        },
      })
    })

    test('returns ack message base on credential issue message', async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.CredentialReceived,
        threadId: 'somethreadid',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // given
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      // when
      const { message: ackMessage } = await credentialService.acceptCredential({ credentialRecord })

      // then
      expect(ackMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/ack',
        '~thread': {
          thid: 'somethreadid',
        },
      })
    })

    const validState = CredentialState.CredentialReceived
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(
            credentialService.acceptCredential({
              credentialRecord: mockCredentialRecord({
                state,
                threadId: 'somethreadid',
                connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
              }),
            })
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processAck', () => {
    const credentialRequest = new V2CredentialAckMessage({
      status: AckStatus.OK,
      threadId: 'somethreadid',
    })
    const messageContext = new InboundMessageContext(credentialRequest, {
      connection,
    })

    test(`updates state to ${CredentialState.Done} and returns credential record`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.CredentialIssued,
      })

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialRecord)

      // when
      const returnedCredentialRecord = await credentialService.processAck(messageContext)

      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })

      expect(returnedCredentialRecord.state).toBe(CredentialState.Done)
    })
  })

  describe('createProblemReport', () => {
    test('returns problem report message base once get error', async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'somethreadid',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      // when
      const credentialProblemReportMessage = new V2CredentialProblemReportMessage({
        description: {
          en: 'Indy error',
          code: CredentialProblemReportReason.IssuanceAbandoned,
        },
      })

      credentialProblemReportMessage.setThread({ threadId: 'somethreadid' })
      // then
      expect(credentialProblemReportMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/problem-report',
        '~thread': {
          thid: 'somethreadid',
        },
      })
    })
  })

  describe('processProblemReport', () => {
    const credentialProblemReportMessage = new V2CredentialProblemReportMessage({
      description: {
        en: 'Indy error',
        code: CredentialProblemReportReason.IssuanceAbandoned,
      },
    })
    credentialProblemReportMessage.setThread({ threadId: 'somethreadid' })
    const messageContext = new InboundMessageContext(credentialProblemReportMessage, {
      connection,
    })

    test(`updates problem report error message and returns credential record`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
      })

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialRecord)

      // when
      const returnedCredentialRecord = await credentialService.processProblemReport(messageContext)

      // then

      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })
      expect(credentialRepository.update).toHaveBeenCalled()
      expect(returnedCredentialRecord.errorMessage).toBe('issuance-abandoned: Indy error')
    })
  })

  describe('repository methods', () => {
    it('getById should return value from credentialRepository.getById', async () => {
      const expected = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(expected))
      const result = await credentialService.getById(expected.id)
      expect(credentialRepository.getById).toBeCalledWith(expected.id)

      expect(result).toBe(expected)
    })

    it('getById should return value from credentialRepository.getSingleByQuery', async () => {
      const expected = mockCredentialRecord()
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(expected))
      const result = await credentialService.getByThreadAndConnectionId('threadId', 'connectionId')
      expect(credentialRepository.getSingleByQuery).toBeCalledWith({
        threadId: 'threadId',
        connectionId: 'connectionId',
      })

      expect(result).toBe(expected)
    })

    it('findById should return value from credentialRepository.findById', async () => {
      const expected = mockCredentialRecord()
      mockFunction(credentialRepository.findById).mockReturnValue(Promise.resolve(expected))
      const result = await credentialService.findById(expected.id)
      expect(credentialRepository.findById).toBeCalledWith(expected.id)

      expect(result).toBe(expected)
    })

    it('getAll should return value from credentialRepository.getAll', async () => {
      const expected = [mockCredentialRecord(), mockCredentialRecord()]

      mockFunction(credentialRepository.getAll).mockReturnValue(Promise.resolve(expected))
      const result = await credentialService.getAll()
      expect(credentialRepository.getAll).toBeCalledWith()

      expect(result).toEqual(expect.arrayContaining(expected))
    })
  })

  describe('deleteCredential', () => {
    it('should call delete from repository', async () => {
      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credentialRecord))

      const repositoryDeleteSpy = jest.spyOn(credentialRepository, 'delete')
      await credentialService.delete(credentialRecord)
      expect(repositoryDeleteSpy).toHaveBeenNthCalledWith(1, credentialRecord)
    })

    it('should call deleteCredentialById in indyCredentialFormatService if deleteAssociatedCredential is true', async () => {
      const deleteCredentialMock = mockFunction(indyCredentialFormatService.deleteCredentialById)

      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      await credentialService.delete(credentialRecord, {
        deleteAssociatedCredentials: true,
        deleteAssociatedDidCommMessages: false,
      })

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(1, credentialRecord.credentials[0].credentialRecordId)
    })

    it('should not call deleteCredentialById in indyCredentialFormatService if deleteAssociatedCredential is false', async () => {
      const deleteCredentialMock = mockFunction(indyCredentialFormatService.deleteCredentialById)

      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      await credentialService.delete(credentialRecord, {
        deleteAssociatedCredentials: false,
        deleteAssociatedDidCommMessages: false,
      })

      expect(deleteCredentialMock).not.toHaveBeenCalled()
    })

    it('deleteAssociatedCredentials should default to true', async () => {
      const deleteCredentialMock = mockFunction(indyCredentialFormatService.deleteCredentialById)

      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      await credentialService.delete(credentialRecord)

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(1, credentialRecord.credentials[0].credentialRecordId)
    })
    it('deleteAssociatedDidCommMessages should default to true', async () => {
      const deleteCredentialMock = mockFunction(indyCredentialFormatService.deleteCredentialById)

      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      await credentialService.delete(credentialRecord)

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(1, credentialRecord.credentials[0].credentialRecordId)
    })
  })

  describe('declineOffer', () => {
    test(`updates state to ${CredentialState.Declined}`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
      })

      // when
      await credentialService.declineOffer(credentialRecord)

      // then

      expect(credentialRepository.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          state: CredentialState.Declined,
        })
      )
    })

    test(`emits stateChange event from ${CredentialState.OfferReceived} to ${CredentialState.Declined}`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
      })

      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialRecord)

      // when
      await credentialService.declineOffer(credentialRecord)

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        type: 'CredentialStateChanged',
        payload: {
          previousState: CredentialState.OfferReceived,
          credentialRecord: expect.objectContaining({
            state: CredentialState.Declined,
          }),
        },
      })
    })

    const validState = CredentialState.OfferReceived
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(credentialService.declineOffer(mockCredentialRecord({ state }))).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          )
        })
      )
    })
  })
})

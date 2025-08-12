import type { AgentConfig, AgentContext } from '@credo-ts/core'
import type { DidCommCredentialPreviewAttribute, DidCommCredentialStateChangedEvent, CustomDidCommCredentialExchangeTags } from '@credo-ts/didcomm'

import { CredoError, EventEmitter, JsonEncoder, JsonTransformer } from '@credo-ts/core'
import {
  AckStatus,
  Attachment,
  AttachmentData,
  DidCommAutoAcceptCredential,
  DidCommCredentialEventTypes,
  DidCommCredentialExchangeRecord,
  DidCommCredentialFormatSpec,
  DidCommCredentialProblemReportReason,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommMessageRecord,
  DidCommMessageRole,
  DidCommDidExchangeState,
  InboundDidCommMessageContext,
} from '@credo-ts/didcomm'
import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../core/tests/helpers'
import { DidCommConnectionService } from '../../../../../../didcomm/src/modules/connections/services/DidCommConnectionService'
import { DidCommCredentialExchangeRepository } from '../../../../../../didcomm/src/modules/credentials/repository/DidCommCredentialExchangeRepository'
import { DidCommMessageRepository } from '../../../../../../didcomm/src/repository/DidCommMessageRepository'
import { LegacyIndyCredentialFormatService } from '../../../../formats/LegacyIndyCredentialFormatService'
import { convertAttributesToCredentialValues } from '../../../../utils/credential'
import { V1CredentialProtocol } from '../V1DidCommCredentialProtocol'
import {
  INDY_CREDENTIAL_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  V1CredentialAckMessage,
  V1CredentialPreview,
  V1CredentialProblemReportMessage,
  V1IssueCredentialMessage,
  V1OfferCredentialMessage,
  V1ProposeCredentialMessage,
  V1RequestCredentialMessage,
} from '../messages'

// Mock classes
jest.mock('../../../../../../didcomm/src/modules/credentials/repository/DidCommCredentialExchangeRepository')
jest.mock('../../../../formats/LegacyIndyCredentialFormatService')
jest.mock('../../../../../../didcomm/src/repository/DidCommMessageRepository')
jest.mock('../../../../../../didcomm/src/modules/connections/services/DidCommConnectionService')

// Mock typed object
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as jest.Mock<DidCommCredentialExchangeRepository>
const LegacyIndyCredentialFormatServiceMock =
  LegacyIndyCredentialFormatService as jest.Mock<LegacyIndyCredentialFormatService>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const ConnectionServiceMock = DidCommConnectionService as jest.Mock<DidCommConnectionService>

const credentialRepository = new CredentialRepositoryMock()
const didCommMessageRepository = new DidCommMessageRepositoryMock()
const legacyIndyCredentialFormatService = new LegacyIndyCredentialFormatServiceMock()
const connectionService = new ConnectionServiceMock()

// @ts-ignore
legacyIndyCredentialFormatService.credentialRecordType = 'w3c'

const connection = getMockConnection({
  id: '123',
  state: DidCommDidExchangeState.Completed,
})

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const offerAttachment = new Attachment({
  id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

const requestAttachment = new Attachment({
  id: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64({}),
  }),
})

const credentialAttachment = new Attachment({
  id: INDY_CREDENTIAL_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64({
      values: convertAttributesToCredentialValues(credentialPreview.attributes),
    }),
  }),
})

const credentialProposalMessage = new V1ProposeCredentialMessage({
  comment: 'comment',
  credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
})
const credentialRequestMessage = new V1RequestCredentialMessage({
  comment: 'abcd',
  requestAttachments: [requestAttachment],
})
const credentialOfferMessage = new V1OfferCredentialMessage({
  comment: 'some comment',
  credentialPreview: credentialPreview,
  offerAttachments: [offerAttachment],
})
const credentialIssueMessage = new V1IssueCredentialMessage({
  comment: 'some comment',
  credentialAttachments: [offerAttachment],
})

const didCommMessageRecord = new DidCommMessageRecord({
  associatedRecordId: '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
  message: { '@id': '123', '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential' },
  role: DidCommMessageRole.Receiver,
})

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const getAgentMessageMock = async (_agentContext: AgentContext, options: { messageClass: any }) => {
  if (options.messageClass === V1ProposeCredentialMessage) {
    return credentialProposalMessage
  }
  if (options.messageClass === V1OfferCredentialMessage) {
    return credentialOfferMessage
  }
  if (options.messageClass === V1RequestCredentialMessage) {
    return credentialRequestMessage
  }
  if (options.messageClass === V1IssueCredentialMessage) {
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
  credentialId?: string
  id?: string
  credentialAttributes?: DidCommCredentialPreviewAttribute[]
} = {}) => {
  const credentialRecord = new DidCommCredentialExchangeRecord({
    id,
    credentialAttributes: credentialAttributes || credentialPreview.attributes,
    state: state || DidCommCredentialState.OfferSent,
    role: role || DidCommCredentialRole.Issuer,
    threadId: threadId ?? '809dd7ec-f0e7-4b97-9231-7a3615af6139',
    connectionId: connectionId ?? '123',
    credentials: [
      {
        credentialRecordType: 'w3c',
        credentialRecordId: '123456',
      },
    ],
    tags,
    protocolVersion: 'v1',
  })

  return credentialRecord
}

describe('V1CredentialProtocol', () => {
  let eventEmitter: EventEmitter
  let agentConfig: AgentConfig
  let agentContext: AgentContext
  let credentialProtocol: V1CredentialProtocol

  beforeEach(async () => {
    // real objects
    agentConfig = getAgentConfig('V1CredentialProtocolCredTest')
    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

    agentContext = getAgentContext({
      registerInstances: [
        [DidCommCredentialExchangeRepository, credentialRepository],
        [DidCommMessageRepository, didCommMessageRepository],
        [EventEmitter, eventEmitter],
        [DidCommConnectionService, connectionService],
      ],
      agentConfig,
    })

    // mock function implementations
    mockFunction(connectionService.getById).mockResolvedValue(connection)
    mockFunction(didCommMessageRepository.findAgentMessage).mockImplementation(getAgentMessageMock)
    mockFunction(didCommMessageRepository.getAgentMessage).mockImplementation(getAgentMessageMock)
    mockFunction(didCommMessageRepository.findByQuery).mockResolvedValue([
      didCommMessageRecord,
      didCommMessageRecord,
      didCommMessageRecord,
    ])

    credentialProtocol = new V1CredentialProtocol({ indyCredentialFormat: legacyIndyCredentialFormatService })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('acceptOffer', () => {
    test(`calls the format service and updates state to ${DidCommCredentialState.RequestSent}`, async () => {
      const credentialRecord = mockCredentialRecord({
        id: '84353745-8bd9-42e1-8d81-238ca77c29d2',
        state: DidCommCredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // mock resolved format call
      mockFunction(legacyIndyCredentialFormatService.acceptOffer).mockResolvedValue({
        attachment: requestAttachment,
        format: new DidCommCredentialFormatSpec({
          format: 'indy',
          attachmentId: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
        }),
      })

      // when
      const { message } = await credentialProtocol.acceptOffer(agentContext, {
        comment: 'hello',
        autoAcceptCredential: DidCommAutoAcceptCredential.Never,
        credentialRecord,
      })

      // then
      expect(credentialRecord).toMatchObject({
        state: DidCommCredentialState.RequestSent,
        autoAcceptCredential: DidCommAutoAcceptCredential.Never,
      })
      expect(message).toBeInstanceOf(V1RequestCredentialMessage)
      expect(message.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/request-credential',
        comment: 'hello',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
        'requests~attach': [JsonTransformer.toJSON(requestAttachment)],
      })
      expect(credentialRepository.update).toHaveBeenCalledTimes(1)
      expect(legacyIndyCredentialFormatService.acceptOffer).toHaveBeenCalledWith(agentContext, {
        credentialRecord,
        attachmentId: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
        offerAttachment,
      })
      expect(didCommMessageRepository.saveOrUpdateAgentMessage).toHaveBeenCalledWith(agentContext, {
        agentMessage: message,
        associatedRecordId: '84353745-8bd9-42e1-8d81-238ca77c29d2',
        role: DidCommMessageRole.Sender,
      })
    })

    test(`calls updateState to update the state to ${DidCommCredentialState.RequestSent}`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: DidCommCredentialState.OfferReceived,
      })

      const updateStateSpy = jest.spyOn(credentialProtocol, 'updateState')

      // mock resolved format call
      mockFunction(legacyIndyCredentialFormatService.acceptOffer).mockResolvedValue({
        attachment: requestAttachment,
        format: new DidCommCredentialFormatSpec({
          format: 'indy',
          attachmentId: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
        }),
      })

      // when
      await credentialProtocol.acceptOffer(agentContext, {
        credentialRecord,
      })

      // then
      expect(updateStateSpy).toHaveBeenCalledWith(agentContext, credentialRecord, DidCommCredentialState.RequestSent)
    })

    const validState = DidCommCredentialState.OfferReceived
    const invalidCredentialStates = Object.values(DidCommCredentialState).filter((state) => state !== validState)
    test('throws an error when state transition is invalid', async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(
            credentialProtocol.acceptOffer(agentContext, { credentialRecord: mockCredentialRecord({ state }) })
          ).rejects.toThrow(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processRequest', () => {
    let credential: DidCommCredentialExchangeRecord
    let messageContext: InboundDidCommMessageContext<V1RequestCredentialMessage>
    beforeEach(() => {
      credential = mockCredentialRecord({ state: DidCommCredentialState.OfferSent })

      const credentialRequest = new V1RequestCredentialMessage({
        comment: 'abcd',
        requestAttachments: [requestAttachment],
      })
      credentialRequest.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundDidCommMessageContext(credentialRequest, {
        agentContext,
        connection,
      })
    })

    test(`updates state to ${DidCommCredentialState.RequestReceived}, set request and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // when
      const returnedCredentialRecord = await credentialProtocol.processRequest(messageContext)

      // then
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
        role: DidCommCredentialRole.Issuer,
      })
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      expect(returnedCredentialRecord.state).toEqual(DidCommCredentialState.RequestReceived)
    })

    test(`emits stateChange event from ${DidCommCredentialState.OfferSent} to ${DidCommCredentialState.RequestReceived}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(DidCommCredentialEventTypes.DidCommCredentialStateChanged, eventListenerMock)
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // mock offer so that the request works
      const returnedCredentialRecord = await credentialProtocol.processRequest(messageContext)

      // then
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
        role: DidCommCredentialRole.Issuer,
      })
      expect(returnedCredentialRecord.state).toEqual(DidCommCredentialState.RequestReceived)
    })

    const validState = DidCommCredentialState.OfferSent
    const invalidCredentialStates = Object.values(DidCommCredentialState).filter((state) => state !== validState)
    test('throws an error when state transition is invalid', async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(
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
      // given
      const credentialRecord = mockCredentialRecord({
        state: DidCommCredentialState.RequestReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(legacyIndyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: new DidCommCredentialFormatSpec({
          format: 'the-format',
          attachmentId: 'the-attach-id',
        }),
      })

      // when
      await credentialProtocol.acceptRequest(agentContext, { credentialRecord })

      // then
      expect(credentialRepository.update).toHaveBeenCalledWith(
        agentContext,
        expect.objectContaining({
          state: DidCommCredentialState.CredentialIssued,
        })
      )
    })

    test(`emits stateChange event from ${DidCommCredentialState.RequestReceived} to ${DidCommCredentialState.CredentialIssued}`, async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: DidCommCredentialState.RequestReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      mockFunction(legacyIndyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: new DidCommCredentialFormatSpec({
          format: 'the-format',
          attachmentId: 'the-attach-id',
        }),
      })

      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(DidCommCredentialEventTypes.DidCommCredentialStateChanged, eventListenerMock)

      // when
      await credentialProtocol.acceptRequest(agentContext, { credentialRecord })

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

    test('returns credential response message based on credential request message', async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: DidCommCredentialState.RequestReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)
      const comment = 'credential response comment'

      mockFunction(legacyIndyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: new DidCommCredentialFormatSpec({
          format: 'the-format',
          attachmentId: 'the-attach-id',
        }),
      })

      // when
      const { message } = await credentialProtocol.acceptRequest(agentContext, { credentialRecord, comment })

      // then
      expect(message.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/issue-credential',
        '~thread': {
          thid: credentialRecord.threadId,
        },
        comment,
        'credentials~attach': [JsonTransformer.toJSON(credentialAttachment)],
        '~please_ack': expect.any(Object),
      })

      expect(legacyIndyCredentialFormatService.acceptRequest).toHaveBeenCalledWith(agentContext, {
        credentialRecord,
        requestAttachment,
        offerAttachment,
        attachmentId: INDY_CREDENTIAL_ATTACHMENT_ID,
      })
    })
  })

  describe('processCredential', () => {
    test('finds credential record by thread id and calls processCredential on indyCredentialFormatService', async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: DidCommCredentialState.RequestSent,
      })
      const credentialResponse = new V1IssueCredentialMessage({
        comment: 'abcd',
        credentialAttachments: [credentialAttachment],
      })
      credentialResponse.setThread({ threadId: 'somethreadid' })
      const messageContext = new InboundDidCommMessageContext(credentialResponse, { agentContext, connection })

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialRecord)

      // when
      await credentialProtocol.processCredential(messageContext)

      // then
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
        connectionId: connection.id,
        role: DidCommCredentialRole.Holder,
      })

      expect(didCommMessageRepository.saveAgentMessage).toHaveBeenCalledWith(agentContext, {
        agentMessage: credentialResponse,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })

      expect(legacyIndyCredentialFormatService.processCredential).toHaveBeenNthCalledWith(1, agentContext, {
        attachment: credentialAttachment,
        credentialRecord,
        requestAttachment: expect.any(Attachment),
        offerAttachment: expect.any(Attachment),
      })
    })
  })

  describe('acceptCredential', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    let credential: DidCommCredentialExchangeRecord

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: DidCommCredentialState.CredentialReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test(`updates state to ${DidCommCredentialState.Done}`, async () => {
      // given
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // when
      await credentialProtocol.acceptCredential(agentContext, { credentialRecord: credential })

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[, updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject({
        state: DidCommCredentialState.Done,
      })
    })

    test(`emits stateChange event from ${DidCommCredentialState.CredentialReceived} to ${DidCommCredentialState.Done}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(DidCommCredentialEventTypes.DidCommCredentialStateChanged, eventListenerMock)

      // when
      await credentialProtocol.acceptCredential(agentContext, { credentialRecord: credential })

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

    test('returns credential response message base on credential request message', async () => {
      // given
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))

      // when
      const { message: ackMessage } = await credentialProtocol.acceptCredential(agentContext, {
        credentialRecord: credential,
      })

      // then
      expect(ackMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/ack',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
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
              credentialRecord: mockCredentialRecord({
                state,
                threadId,
                connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
              }),
            })
          ).rejects.toThrow(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processAck', () => {
    let credential: DidCommCredentialExchangeRecord
    let messageContext: InboundDidCommMessageContext<V1CredentialAckMessage>

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: DidCommCredentialState.CredentialIssued,
      })

      const credentialRequest = new V1CredentialAckMessage({
        status: AckStatus.OK,
        threadId: 'somethreadid',
      })
      messageContext = new InboundDidCommMessageContext(credentialRequest, { agentContext, connection })
    })

    test(`updates state to ${DidCommCredentialState.Done} and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // when
      const returnedCredentialRecord = await credentialProtocol.processAck(messageContext)

      // then
      const expectedCredentialRecord = {
        state: DidCommCredentialState.Done,
      }
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
        connectionId: connection.id,
        role: DidCommCredentialRole.Issuer,
      })
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[, updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
    })
  })

  describe('createProblemReport', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    let credential: DidCommCredentialExchangeRecord

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: DidCommCredentialState.OfferReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test('returns problem report message base once get error', async () => {
      // given
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))

      // when
      const { message } = await credentialProtocol.createProblemReport(agentContext, {
        description: 'Indy error',
        credentialRecord: credential,
      })

      message.setThread({ threadId })
      // then
      expect(message.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/problem-report',
        '~thread': {
          thid: threadId,
        },
        description: {
          code: DidCommCredentialProblemReportReason.IssuanceAbandoned,
          en: 'Indy error',
        },
      })
    })
  })

  describe('processProblemReport', () => {
    let credential: DidCommCredentialExchangeRecord
    let messageContext: InboundDidCommMessageContext<V1CredentialProblemReportMessage>

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: DidCommCredentialState.OfferReceived,
      })

      const credentialProblemReportMessage = new V1CredentialProblemReportMessage({
        description: {
          en: 'Indy error',
          code: DidCommCredentialProblemReportReason.IssuanceAbandoned,
        },
      })
      credentialProblemReportMessage.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundDidCommMessageContext(credentialProblemReportMessage, { agentContext, connection })
    })

    test('updates problem report error message and returns credential record', async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // when
      const returnedCredentialRecord = await credentialProtocol.processProblemReport(messageContext)

      // then
      const expectedCredentialRecord = {
        errorMessage: 'issuance-abandoned: Indy error',
      }
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, agentContext, {
        threadId: 'somethreadid',
      })
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[, updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
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
        connectionId: 'connectionId',
        role: DidCommCredentialRole.Issuer,
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
      const result = await credentialProtocol.findAllByQuery(agentContext, { state: DidCommCredentialState.OfferSent }, {})
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
      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credentialRecord))

      const repositoryDeleteSpy = jest.spyOn(credentialRepository, 'delete')
      await credentialProtocol.delete(agentContext, credentialRecord)
      expect(repositoryDeleteSpy).toHaveBeenNthCalledWith(1, agentContext, credentialRecord)
    })

    it('should call deleteCredentialById in indyCredentialFormatService if deleteAssociatedCredential is true', async () => {
      const deleteCredentialMock = mockFunction(legacyIndyCredentialFormatService.deleteCredentialById)

      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      await credentialProtocol.delete(agentContext, credentialRecord, {
        deleteAssociatedCredentials: true,
        deleteAssociatedDidCommMessages: false,
      })

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(
        1,
        agentContext,
        credentialRecord.credentials[0].credentialRecordId
      )
    })

    it('should not call deleteCredentialById in indyCredentialFormatService if deleteAssociatedCredential is false', async () => {
      const deleteCredentialMock = mockFunction(legacyIndyCredentialFormatService.deleteCredentialById)

      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      await credentialProtocol.delete(agentContext, credentialRecord, {
        deleteAssociatedCredentials: false,
        deleteAssociatedDidCommMessages: false,
      })

      expect(deleteCredentialMock).not.toHaveBeenCalled()
    })

    it('deleteAssociatedCredentials should default to true', async () => {
      const deleteCredentialMock = mockFunction(legacyIndyCredentialFormatService.deleteCredentialById)

      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      await credentialProtocol.delete(agentContext, credentialRecord)

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(
        1,
        agentContext,
        credentialRecord.credentials[0].credentialRecordId
      )
    })
    it('deleteAssociatedDidCommMessages should default to true', async () => {
      const deleteCredentialMock = mockFunction(legacyIndyCredentialFormatService.deleteCredentialById)

      const credentialRecord = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      await credentialProtocol.delete(agentContext, credentialRecord)

      expect(deleteCredentialMock).toHaveBeenNthCalledWith(
        1,
        agentContext,
        credentialRecord.credentials[0].credentialRecordId
      )
      expect(didCommMessageRepository.delete).toHaveBeenCalledTimes(3)
    })
  })
})

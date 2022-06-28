import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { GetAgentMessageOptions } from '../../../../../storage/didcomm/DidCommMessageRepository'
import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type { IndyCredentialViewMetadata } from '../../../formats/indy/models'
import type { CredentialPreviewAttribute } from '../../../models'
import type { CustomCredentialTags } from '../../../repository/CredentialExchangeRecord'

import { getAgentConfig, getMockConnection, mockFunction } from '../../../../../../tests/helpers'
import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../../error'
import { DidCommMessageRecord, DidCommMessageRole } from '../../../../../storage'
import { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import { JsonTransformer } from '../../../../../utils'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { uuid } from '../../../../../utils/uuid'
import { AckStatus } from '../../../../common'
import { DidExchangeState } from '../../../../connections'
import { ConnectionService } from '../../../../connections/services/ConnectionService'
import { RoutingService } from '../../../../routing/services/RoutingService'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { credDef, credReq } from '../../../__tests__/fixtures'
import { CredentialProblemReportReason } from '../../../errors/CredentialProblemReportReason'
import { IndyCredentialFormatService } from '../../../formats/indy/IndyCredentialFormatService'
import { IndyCredentialUtils } from '../../../formats/indy/IndyCredentialUtils'
import { CredentialState, AutoAcceptCredential, CredentialFormatSpec } from '../../../models'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { CredentialMetadataKeys } from '../../../repository/CredentialMetadataTypes'
import { CredentialRepository } from '../../../repository/CredentialRepository'
import { V1CredentialService } from '../V1CredentialService'
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
jest.mock('../../../repository/CredentialRepository')
jest.mock('../../../formats/indy/IndyCredentialFormatService')
jest.mock('../../../../../storage/didcomm/DidCommMessageRepository')
jest.mock('../../../../routing/services/RoutingService')
jest.mock('../../../../connections/services/ConnectionService')
jest.mock('../../../../../agent/Dispatcher')

// Mock typed object
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const IndyCredentialFormatServiceMock = IndyCredentialFormatService as jest.Mock<IndyCredentialFormatService>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const RoutingServiceMock = RoutingService as jest.Mock<RoutingService>
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>

const credentialRepository = new CredentialRepositoryMock()
const didCommMessageRepository = new DidCommMessageRepositoryMock()
const routingService = new RoutingServiceMock()
const indyCredentialFormatService = new IndyCredentialFormatServiceMock()
const dispatcher = new DispatcherMock()
const connectionService = new ConnectionServiceMock()

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
indyCredentialFormatService.credentialRecordType = 'indy'

const connection = getMockConnection({
  id: '123',
  state: DidExchangeState.Completed,
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
    base64: JsonEncoder.toBase64(credReq),
  }),
})

const credentialAttachment = new Attachment({
  id: INDY_CREDENTIAL_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64({
      values: IndyCredentialUtils.convertAttributesToValues(credentialPreview.attributes),
    }),
  }),
})

const credentialProposalMessage = new V1ProposeCredentialMessage({
  comment: 'comment',
  credentialDefinitionId: credDef.id,
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
  message: {},
  role: DidCommMessageRole.Receiver,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAgentMessageMock = async (options: GetAgentMessageOptions<any>) => {
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
  indyRevocationRegistryId,
  indyCredentialRevocationId,
}: {
  state?: CredentialState
  metadata?: IndyCredentialViewMetadata & { indyRequest: Record<string, unknown> }
  tags?: CustomCredentialTags
  threadId?: string
  connectionId?: string
  credentialId?: string
  id?: string
  credentialAttributes?: CredentialPreviewAttribute[]
  indyRevocationRegistryId?: string
  indyCredentialRevocationId?: string
} = {}) => {
  const credentialRecord = new CredentialExchangeRecord({
    id,
    credentialAttributes: credentialAttributes || credentialPreview.attributes,
    state: state || CredentialState.OfferSent,
    threadId: threadId ?? uuid(),
    connectionId: connectionId ?? '123',
    credentials: [
      {
        credentialRecordType: 'indy',
        credentialRecordId: '123456',
      },
    ],
    tags,
    protocolVersion: 'v1',
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

  if (indyCredentialRevocationId || indyRevocationRegistryId) {
    credentialRecord.metadata.add(CredentialMetadataKeys.IndyCredential, {
      indyCredentialRevocationId,
      indyRevocationRegistryId,
    })
  }

  return credentialRecord
}

describe('V1CredentialService', () => {
  let eventEmitter: EventEmitter
  let agentConfig: AgentConfig
  let credentialService: V1CredentialService

  beforeEach(async () => {
    // real objects
    agentConfig = getAgentConfig('V1CredentialServiceCredTest')
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

    credentialService = new V1CredentialService(
      connectionService,
      didCommMessageRepository,
      agentConfig,
      routingService,
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
    test(`calls the format service and updates state to ${CredentialState.RequestSent}`, async () => {
      const credentialRecord = mockCredentialRecord({
        id: '84353745-8bd9-42e1-8d81-238ca77c29d2',
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      const credentialFormats = {
        indy: {
          holderDid: 'did:sov:123456789abcdefghi',
        },
      }

      // mock resolved format call
      mockFunction(indyCredentialFormatService.acceptOffer).mockResolvedValue({
        attachment: requestAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachId: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
        }),
      })

      // when
      const { message } = await credentialService.acceptOffer({
        comment: 'hello',
        autoAcceptCredential: AutoAcceptCredential.Never,
        credentialRecord,
        credentialFormats,
      })

      // then
      expect(credentialRecord).toMatchObject({
        state: CredentialState.RequestSent,
        autoAcceptCredential: AutoAcceptCredential.Never,
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
      expect(indyCredentialFormatService.acceptOffer).toHaveBeenCalledWith({
        credentialRecord,
        attachId: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
        offerAttachment,
        credentialFormats: {
          indy: {
            holderDid: 'did:sov:123456789abcdefghi',
          },
        },
      })
      expect(didCommMessageRepository.saveOrUpdateAgentMessage).toHaveBeenCalledWith({
        agentMessage: message,
        associatedRecordId: '84353745-8bd9-42e1-8d81-238ca77c29d2',
        role: DidCommMessageRole.Sender,
      })
    })

    test(`calls updateState to update the state to ${CredentialState.RequestSent}`, async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
      })

      const updateStateSpy = jest.spyOn(credentialService, 'updateState')

      // mock resolved format call
      mockFunction(indyCredentialFormatService.acceptOffer).mockResolvedValue({
        attachment: requestAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachId: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
        }),
      })

      // when
      await credentialService.acceptOffer({
        credentialRecord,
      })

      // then
      expect(updateStateSpy).toHaveBeenCalledWith(credentialRecord, CredentialState.RequestSent)
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
    let credential: CredentialExchangeRecord
    let messageContext: InboundMessageContext<V1RequestCredentialMessage>
    beforeEach(() => {
      credential = mockCredentialRecord({ state: CredentialState.OfferSent })

      const credentialRequest = new V1RequestCredentialMessage({
        comment: 'abcd',
        requestAttachments: [requestAttachment],
      })
      credentialRequest.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundMessageContext(credentialRequest, {
        connection,
      })
    })

    test(`updates state to ${CredentialState.RequestReceived}, set request and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // when
      const returnedCredentialRecord = await credentialService.processRequest(messageContext)

      // then
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      expect(returnedCredentialRecord.state).toEqual(CredentialState.RequestReceived)
    })

    test(`emits stateChange event from ${CredentialState.OfferSent} to ${CredentialState.RequestReceived}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // mock offer so that the request works
      const returnedCredentialRecord = await credentialService.processRequest(messageContext)

      // then
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })
      expect(returnedCredentialRecord.state).toEqual(CredentialState.RequestReceived)
    })

    const validState = CredentialState.OfferSent
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(
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
      // given
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(indyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: new CredentialFormatSpec({
          format: 'the-format',
          attachId: 'the-attach-id',
        }),
      })

      // when
      await credentialService.acceptRequest({ credentialRecord })

      // then
      expect(credentialRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          state: CredentialState.CredentialIssued,
        })
      )
    })

    test(`emits stateChange event from ${CredentialState.RequestReceived} to ${CredentialState.CredentialIssued}`, async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)

      mockFunction(indyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: new CredentialFormatSpec({
          format: 'the-format',
          attachId: 'the-attach-id',
        }),
      })

      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      await credentialService.acceptRequest({ credentialRecord })

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

    test('returns credential response message based on credential request message', async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(credentialRepository.getById).mockResolvedValue(credentialRecord)
      const comment = 'credential response comment'

      mockFunction(indyCredentialFormatService.acceptRequest).mockResolvedValue({
        attachment: credentialAttachment,
        format: new CredentialFormatSpec({
          format: 'the-format',
          attachId: 'the-attach-id',
        }),
      })

      // when
      const { message } = await credentialService.acceptRequest({ credentialRecord, comment })

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

      expect(indyCredentialFormatService.acceptRequest).toHaveBeenCalledWith({
        credentialRecord,
        requestAttachment,
        offerAttachment,
        attachId: INDY_CREDENTIAL_ATTACHMENT_ID,
      })
    })
  })

  describe('processCredential', () => {
    test('finds credential record by thread id and calls processCredential on indyCredentialFormatService', async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestSent,
      })
      const credentialResponse = new V1IssueCredentialMessage({
        comment: 'abcd',
        credentialAttachments: [credentialAttachment],
      })
      credentialResponse.setThread({ threadId: 'somethreadid' })
      const messageContext = new InboundMessageContext(credentialResponse, {
        connection,
      })

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialRecord)

      // when
      await credentialService.processCredential(messageContext)

      // then
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })

      expect(didCommMessageRepository.saveAgentMessage).toHaveBeenCalledWith({
        agentMessage: credentialResponse,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })

      expect(indyCredentialFormatService.processCredential).toHaveBeenNthCalledWith(1, {
        attachment: credentialAttachment,
        credentialRecord,
      })
    })
  })

  describe('acceptCredential', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    let credential: CredentialExchangeRecord

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.CredentialReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test(`updates state to ${CredentialState.Done}`, async () => {
      // given
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // when
      await credentialService.acceptCredential({ credentialRecord: credential })

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject({
        state: CredentialState.Done,
      })
    })

    test(`emits stateChange event from ${CredentialState.CredentialReceived} to ${CredentialState.Done}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      await credentialService.acceptCredential({ credentialRecord: credential })

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

    test('returns credential response message base on credential request message', async () => {
      // given
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))

      // when
      const { message: ackMessage } = await credentialService.acceptCredential({ credentialRecord: credential })

      // then
      expect(ackMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/ack',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
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
                threadId,
                connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
              }),
            })
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processAck', () => {
    let credential: CredentialExchangeRecord
    let messageContext: InboundMessageContext<V1CredentialAckMessage>

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.CredentialIssued,
      })

      const credentialRequest = new V1CredentialAckMessage({
        status: AckStatus.OK,
        threadId: 'somethreadid',
      })
      messageContext = new InboundMessageContext(credentialRequest, {
        connection,
      })
    })

    test(`updates state to ${CredentialState.Done} and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // when
      const returnedCredentialRecord = await credentialService.processAck(messageContext)

      // then
      const expectedCredentialRecord = {
        state: CredentialState.Done,
      }
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
    })
  })

  describe('createProblemReport', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    const message = 'Indy error'
    let credential: CredentialExchangeRecord

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test('returns problem report message base once get error', () => {
      // given
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))

      // when
      const credentialProblemReportMessage = credentialService.createProblemReport({ message })

      credentialProblemReportMessage.setThread({ threadId })
      // then
      expect(credentialProblemReportMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/problem-report',
        '~thread': {
          thid: threadId,
        },
        description: {
          code: CredentialProblemReportReason.IssuanceAbandoned,
          en: message,
        },
      })
    })
  })

  describe('processProblemReport', () => {
    let credential: CredentialExchangeRecord
    let messageContext: InboundMessageContext<V1CredentialProblemReportMessage>

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.OfferReceived,
      })

      const credentialProblemReportMessage = new V1CredentialProblemReportMessage({
        description: {
          en: 'Indy error',
          code: CredentialProblemReportReason.IssuanceAbandoned,
        },
      })
      credentialProblemReportMessage.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundMessageContext(credentialProblemReportMessage, {
        connection,
      })
    })

    test(`updates problem report error message and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // when
      const returnedCredentialRecord = await credentialService.processProblemReport(messageContext)

      // then
      const expectedCredentialRecord = {
        errorMessage: 'issuance-abandoned: Indy error',
      }
      expect(credentialRepository.getSingleByQuery).toHaveBeenNthCalledWith(1, {
        threadId: 'somethreadid',
        connectionId: connection.id,
      })
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
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
      expect(didCommMessageRepository.delete).toHaveBeenCalledTimes(3)
    })
  })

  describe('declineOffer', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249754'
    let credential: CredentialExchangeRecord

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        tags: { threadId },
      })
    })

    test(`updates state to ${CredentialState.Declined}`, async () => {
      // given
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // when
      await credentialService.declineOffer(credential)

      // then
      const expectedCredentialState = {
        state: CredentialState.Declined,
      }
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      expect(repositoryUpdateSpy).toHaveBeenNthCalledWith(1, expect.objectContaining(expectedCredentialState))
    })

    test(`emits stateChange event from ${CredentialState.OfferReceived} to ${CredentialState.Declined}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // given
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))

      // when
      await credentialService.declineOffer(credential)

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
          await expect(
            credentialService.declineOffer(mockCredentialRecord({ state, tags: { threadId } }))
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })
})

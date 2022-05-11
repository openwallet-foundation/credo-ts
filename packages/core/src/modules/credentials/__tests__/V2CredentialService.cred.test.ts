import type { AgentConfig } from '../../../../src/agent/AgentConfig'
import type { ConnectionService } from '../../connections/services/ConnectionService'
import type { CredentialStateChangedEvent } from '../CredentialEvents'
import type { AcceptRequestOptions, RequestCredentialOptions } from '../CredentialsModuleOptions'
import type {
  CredentialFormatSpec,
  FormatServiceRequestCredentialFormats,
} from '../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../models/CredentialPreviewAttributes'
import type { IndyCredentialMetadata } from '../protocol/v1/models/CredentialInfo'
import type { V2IssueCredentialMessageProps } from '../protocol/v2/messages/V2IssueCredentialMessage'
import type { V2OfferCredentialMessageOptions } from '../protocol/v2/messages/V2OfferCredentialMessage'
import type { V2RequestCredentialMessageOptions } from '../protocol/v2/messages/V2RequestCredentialMessage'
import type { CustomCredentialTags } from '../repository/CredentialExchangeRecord'

import { getAgentConfig, getBaseConfig, getMockConnection, mockFunction } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { Dispatcher } from '../../../agent/Dispatcher'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../storage'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { AckStatus } from '../../common/messages/AckMessage'
import { ConnectionState } from '../../connections'
import { IndyHolderService } from '../../indy/services/IndyHolderService'
import { IndyIssuerService } from '../../indy/services/IndyIssuerService'
import { IndyLedgerService } from '../../ledger/services'
import { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import { CredentialEventTypes } from '../CredentialEvents'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialState } from '../CredentialState'
import { CredentialUtils } from '../CredentialUtils'
import { CredentialFormatType } from '../CredentialsModuleOptions'
import { CredentialProblemReportReason } from '../errors/CredentialProblemReportReason'
import { IndyCredentialFormatService } from '../formats'
import { V1CredentialPreview } from '../protocol/v1/V1CredentialPreview'
import {
  INDY_CREDENTIAL_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  V1OfferCredentialMessage,
} from '../protocol/v1/messages'
import { V2CredentialService } from '../protocol/v2/V2CredentialService'
import { V2CredentialAckMessage } from '../protocol/v2/messages/V2CredentialAckMessage'
import { V2CredentialProblemReportMessage } from '../protocol/v2/messages/V2CredentialProblemReportMessage'
import { V2IssueCredentialMessage } from '../protocol/v2/messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from '../protocol/v2/messages/V2OfferCredentialMessage'
import { V2RequestCredentialMessage } from '../protocol/v2/messages/V2RequestCredentialMessage'
import { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'
import { CredentialMetadataKeys } from '../repository/CredentialMetadataTypes'
import { CredentialRepository } from '../repository/CredentialRepository'
import { RevocationService } from '../services'

import { credDef, credReq, credOffer } from './fixtures'

// Mock classes
jest.mock('../repository/CredentialRepository')
jest.mock('../../../modules/ledger/services/IndyLedgerService')
jest.mock('../../indy/services/IndyHolderService')
jest.mock('../../indy/services/IndyIssuerService')
jest.mock('../../../../src/storage/didcomm/DidCommMessageRepository')
jest.mock('../../routing/services/MediationRecipientService')

// Mock typed object
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const IndyHolderServiceMock = IndyHolderService as jest.Mock<IndyHolderService>
const IndyIssuerServiceMock = IndyIssuerService as jest.Mock<IndyIssuerService>
const MediationRecipientServiceMock = MediationRecipientService as jest.Mock<MediationRecipientService>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>

const connection = getMockConnection({
  id: '123',
  state: ConnectionState.Complete,
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
      values: CredentialUtils.convertAttributesToValues(credentialPreview.attributes),
    }),
  }),
})

const v2CredentialRequest: FormatServiceRequestCredentialFormats = {
  indy: {
    attributes: credentialPreview.attributes,
    credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
  },
}

const offerOptions: V2OfferCredentialMessageOptions = {
  id: '',
  formats: [
    {
      attachId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      format: 'hlindy/cred-abstract@v2.0',
    },
  ],
  comment: 'some comment',
  credentialPreview: credentialPreview,
  offerAttachments: [offerAttachment],
  replacementId: undefined,
}
const requestFormat: CredentialFormatSpec = {
  attachId: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  format: 'hlindy/cred-req@v2.0',
}

const requestOptions: V2RequestCredentialMessageOptions = {
  id: '',
  formats: [requestFormat],
  requestsAttach: [requestAttachment],
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
  metadata?: IndyCredentialMetadata & { indyRequest: Record<string, unknown> }
  tags?: CustomCredentialTags
  threadId?: string
  connectionId?: string
  id?: string
  credentialAttributes?: CredentialPreviewAttribute[]
} = {}) => {
  const offerMessage = new V1OfferCredentialMessage({
    comment: 'some comment',
    credentialPreview: credentialPreview,
    offerAttachments: [offerAttachment],
  })

  const credentialRecord = new CredentialExchangeRecord({
    id,
    credentialAttributes: credentialAttributes || credentialPreview.attributes,
    state: state || CredentialState.OfferSent,
    threadId: threadId ?? offerMessage.id,
    connectionId: connectionId ?? '123',
    credentials: [
      {
        credentialRecordType: CredentialFormatType.Indy,
        credentialRecordId: '123456',
      },
    ],
    tags,
    protocolVersion: CredentialProtocolVersion.V2,
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

const { config, agentDependencies: dependencies } = getBaseConfig('Agent Class Test V2 Cred')

let credentialRequestMessage: V2RequestCredentialMessage
let credentialOfferMessage: V2OfferCredentialMessage
describe('CredentialService', () => {
  let agent: Agent
  let credentialRepository: CredentialRepository
  let indyLedgerService: IndyLedgerService
  let indyIssuerService: IndyIssuerService
  let indyHolderService: IndyHolderService
  let eventEmitter: EventEmitter
  let didCommMessageRepository: DidCommMessageRepository
  let mediationRecipientService: MediationRecipientService
  let agentConfig: AgentConfig

  let dispatcher: Dispatcher
  let credentialService: V2CredentialService
  let revocationService: RevocationService

  const initMessages = () => {
    credentialRequestMessage = new V2RequestCredentialMessage(requestOptions)
    credentialOfferMessage = new V2OfferCredentialMessage(offerOptions)
    mockFunction(didCommMessageRepository.findAgentMessage).mockImplementation(async (options) => {
      if (options.messageClass === V2OfferCredentialMessage) {
        return credentialOfferMessage
      }
      if (options.messageClass === V2RequestCredentialMessage) {
        return credentialRequestMessage
      }
      return null
    })
  }
  beforeEach(async () => {
    credentialRepository = new CredentialRepositoryMock()
    indyIssuerService = new IndyIssuerServiceMock()
    mediationRecipientService = new MediationRecipientServiceMock()
    indyHolderService = new IndyHolderServiceMock()
    indyLedgerService = new IndyLedgerServiceMock()
    mockFunction(indyLedgerService.getCredentialDefinition).mockReturnValue(Promise.resolve(credDef))
    agent = new Agent(config, dependencies)
    agentConfig = getAgentConfig('CredentialServiceTest')
    eventEmitter = new EventEmitter(agentConfig)
    dispatcher = agent.injectionContainer.resolve<Dispatcher>(Dispatcher)
    didCommMessageRepository = new DidCommMessageRepositoryMock()
    revocationService = new RevocationService(credentialRepository, eventEmitter, agentConfig)

    credentialService = new V2CredentialService(
      {
        getById: () => Promise.resolve(connection),
        assertConnectionOrServiceDecorator: () => true,
      } as unknown as ConnectionService,
      credentialRepository,
      eventEmitter,
      dispatcher,
      agentConfig,
      mediationRecipientService,
      didCommMessageRepository,
      new IndyCredentialFormatService(
        credentialRepository,
        eventEmitter,
        indyIssuerService,
        indyLedgerService,
        indyHolderService,
        agentConfig
      ),
      revocationService
    )
  })

  describe('createCredentialRequest', () => {
    let credentialRecord: CredentialExchangeRecord
    let credentialOfferMessage: V2OfferCredentialMessage
    beforeEach(() => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
      initMessages()
    })

    test(`updates state to ${CredentialState.RequestSent}, set request metadata`, async () => {
      mediationRecipientService = agent.injectionContainer.resolve(MediationRecipientService)
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // mock offer so that the request works

      await didCommMessageRepository.saveAgentMessage({
        agentMessage: credentialOfferMessage,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })

      const requestOptions: RequestCredentialOptions = {
        credentialFormats: v2CredentialRequest,
      }

      // when

      await credentialService.createRequest(credentialRecord, requestOptions, 'holderDid')

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord.toJSON()).toMatchObject({
        metadata: { '_internal/indyRequest': { cred_req: 'meta-data' } },
        state: CredentialState.RequestSent,
      })
    })

    test('returns credential request message base on existing credential offer message', async () => {
      // given
      const comment = 'credential request comment'
      const options: RequestCredentialOptions = {
        connectionId: credentialRecord.connectionId,
        comment: 'credential request comment',
      }
      // when
      const { message: credentialRequest } = await credentialService.createRequest(
        credentialRecord,
        options,
        'holderDid'
      )

      // then
      expect(credentialRequest.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/request-credential',
        '~thread': {
          thid: credentialRecord.threadId,
        },
        comment,
        'requests~attach': [
          {
            '@id': expect.any(String),
            'mime-type': 'application/json',
            data: {
              base64: expect.any(String),
            },
          },
        ],
      })
    })

    const validState = CredentialState.OfferReceived
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(
            credentialService.createRequest(mockCredentialRecord({ state }), {}, 'mockDid')
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processCredentialRequest', () => {
    let credential: CredentialExchangeRecord
    let messageContext: InboundMessageContext<V2RequestCredentialMessage>
    beforeEach(() => {
      credential = mockCredentialRecord({ state: CredentialState.OfferSent })
      initMessages()
      credentialRequestMessage.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundMessageContext(credentialRequestMessage, {
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

  describe('createCredential', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    let credential: CredentialExchangeRecord

    beforeEach(() => {
      initMessages()
      credential = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test(`updates state to ${CredentialState.CredentialIssued}`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')
      // when

      const acceptRequestOptions: AcceptRequestOptions = {
        credentialRecordId: credential.id,
        comment: 'credential response comment',
      }
      await credentialService.createCredential(credential, acceptRequestOptions)

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject({
        state: CredentialState.CredentialIssued,
      })
    })

    test(`emits stateChange event from ${CredentialState.RequestReceived} to ${CredentialState.CredentialIssued}`, async () => {
      const eventListenerMock = jest.fn()

      // given
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      const acceptRequestOptions: AcceptRequestOptions = {
        credentialRecordId: credential.id,
        comment: 'credential response comment',
      }
      await credentialService.createCredential(credential, acceptRequestOptions)

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
      // given
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))
      const comment = 'credential response comment'

      // when
      const options: AcceptRequestOptions = {
        comment: 'credential response comment',
        credentialRecordId: credential.id,
      }
      const { message: credentialResponse } = await credentialService.createCredential(credential, options)

      const v2CredentialResponse = credentialResponse as V2IssueCredentialMessage
      // then
      expect(credentialResponse.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/issue-credential',
        '~thread': {
          thid: credential.threadId,
        },
        comment,
        'credentials~attach': [
          {
            '@id': expect.any(String),
            'mime-type': 'application/json',
            data: {
              base64: expect.any(String),
            },
          },
        ],
        '~please_ack': expect.any(Object),
      })

      // Value of `cred` should be as same as in the credential response message.
      const [cred] = await indyIssuerService.createCredential({
        credentialOffer: credOffer,
        credentialRequest: credReq,
        credentialValues: {},
      })
      const [responseAttachment] = v2CredentialResponse.messageAttachment
      expect(responseAttachment.getDataAsJson()).toEqual(cred)
    })
  })

  describe('processCredential', () => {
    let credential: CredentialExchangeRecord
    let messageContext: InboundMessageContext<V2IssueCredentialMessage>
    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.RequestSent,
        metadata: { indyRequest: { cred_req: 'meta-data' } },
      })

      const props: V2IssueCredentialMessageProps = {
        comment: 'abcd',
        credentialsAttach: [credentialAttachment],
        formats: [],
      }

      const credentialResponse = new V2IssueCredentialMessage(props)
      credentialResponse.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundMessageContext(credentialResponse, {
        connection,
      })
      initMessages()
    })

    test('finds credential record by thread ID and saves credential attachment into the wallet', async () => {
      // given
      mockFunction(credentialRepository.getSingleByQuery).mockReturnValue(Promise.resolve(credential))
      // when
      const record = await credentialService.processCredential(messageContext)

      expect(record.credentialAttributes?.length).toBe(2)
    })
  })

  describe('createAck', () => {
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
      await credentialService.createAck(credential)

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
      await credentialService.createAck(credential)

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
      const { message: ackMessage } = await credentialService.createAck(credential)

      // then
      expect(ackMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/ack',
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
            credentialService.createAck(
              mockCredentialRecord({ state, threadId, connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190' })
            )
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processAck', () => {
    let credential: CredentialExchangeRecord
    let messageContext: InboundMessageContext<V2CredentialAckMessage>
    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.CredentialIssued,
      })

      const credentialRequest = new V2CredentialAckMessage({
        status: AckStatus.OK,
        threadId: 'somethreadid',
      })
      messageContext = new InboundMessageContext(credentialRequest, {
        connection,
      })
    })

    test(`updates state to ${CredentialState.Done} and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      initMessages()
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
    let credential: CredentialExchangeRecord

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test('returns problem report message base once get error', async () => {
      // given
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))

      // when
      const credentialProblemReportMessage = new V2CredentialProblemReportMessage({
        description: {
          en: 'Indy error',
          code: CredentialProblemReportReason.IssuanceAbandoned,
        },
      })

      credentialProblemReportMessage.setThread({ threadId })
      // then
      expect(credentialProblemReportMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/problem-report',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
      })
    })
  })

  describe('processProblemReport', () => {
    let credential: CredentialExchangeRecord
    let messageContext: InboundMessageContext<V2CredentialProblemReportMessage>

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.OfferReceived,
      })

      const credentialProblemReportMessage = new V2CredentialProblemReportMessage({
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
      const credential = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))

      const repositoryDeleteSpy = jest.spyOn(credentialRepository, 'delete')
      await credentialService.deleteById(credential.id)
      expect(repositoryDeleteSpy).toHaveBeenNthCalledWith(1, credential)
    })

    it('deleteAssociatedCredential parameter should call deleteCredential in indyHolderService with credentialId', async () => {
      const storeCredentialMock = indyHolderService.deleteCredential as jest.Mock<Promise<void>, [string]>

      const credential = mockCredentialRecord()
      mockFunction(credentialRepository.getById).mockReturnValue(Promise.resolve(credential))

      await credentialService.deleteById(credential.id, {
        deleteAssociatedCredentials: true,
      })
      expect(storeCredentialMock).toHaveBeenNthCalledWith(1, credential.credentials[0].credentialRecordId)
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

import type { AgentConfig } from '../../../agent/AgentConfig'
import type { ConnectionService } from '../../connections/services/ConnectionService'
import type { CredentialStateChangedEvent } from '../CredentialEvents'
import type { OfferCredentialOptions } from '../interfaces'

import { getAgentConfig, getBaseConfig, getMockConnection, mockFunction } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { Dispatcher } from '../../../agent/Dispatcher'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { DidCommMessageRepository } from '../../../storage'
import { ConnectionState } from '../../connections'
import { IndyHolderService } from '../../indy/services/IndyHolderService'
import { IndyIssuerService } from '../../indy/services/IndyIssuerService'
import { IndyLedgerService } from '../../ledger/services'
import { MediationRecipientService } from '../../routing'
import { CredentialEventTypes } from '../CredentialEvents'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialState } from '../CredentialState'
import { V1CredentialPreview } from '../protocol/v1/V1CredentialPreview'
import { V1CredentialService } from '../protocol/v1/V1CredentialService'
import { INDY_CREDENTIAL_OFFER_ATTACHMENT_ID, V1OfferCredentialMessage } from '../protocol/v1/messages'
import { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'
import { CredentialRepository } from '../repository/CredentialRepository'

import { credDef } from './fixtures'

// Mock classes
jest.mock('../repository/CredentialRepository')
jest.mock('../../../../src/storage/didcomm/DidCommMessageRepository')
jest.mock('../../../modules/ledger/services/IndyLedgerService')
jest.mock('../../indy/services/IndyHolderService')
jest.mock('../../indy/services/IndyIssuerService')

// Mock typed object
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const IndyHolderServiceMock = IndyHolderService as jest.Mock<IndyHolderService>
const IndyIssuerServiceMock = IndyIssuerService as jest.Mock<IndyIssuerService>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>
const MediationRecipientServiceMock = MediationRecipientService as jest.Mock<MediationRecipientService>

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

const { config, agentDependencies: dependencies } = getBaseConfig('Agent Class Test V2 Offer')

describe('CredentialService', () => {
  let agent: Agent
  let credentialRepository: CredentialRepository
  let indyLedgerService: IndyLedgerService
  let indyIssuerService: IndyIssuerService
  let indyHolderService: IndyHolderService
  let eventEmitter: EventEmitter
  let didCommMessageRepository: DidCommMessageRepository
  let mediationRecipientService: MediationRecipientService
  let messageSender: MessageSender
  let agentConfig: AgentConfig

  let dispatcher: Dispatcher
  let credentialService: V1CredentialService
  beforeEach(async () => {
    credentialRepository = new CredentialRepositoryMock()
    indyIssuerService = new IndyIssuerServiceMock()
    didCommMessageRepository = new DidCommMessageRepositoryMock()
    messageSender = new MessageSenderMock()
    mediationRecipientService = new MediationRecipientServiceMock()
    indyHolderService = new IndyHolderServiceMock()
    indyLedgerService = new IndyLedgerServiceMock()
    mockFunction(indyLedgerService.getCredentialDefinition).mockReturnValue(Promise.resolve(credDef))
    agentConfig = getAgentConfig('CredentialServiceTest')
    eventEmitter = new EventEmitter(agentConfig)

    dispatcher = new Dispatcher(messageSender, eventEmitter, agentConfig)

    credentialService = new V1CredentialService(
      {
        getById: () => Promise.resolve(connection),
        assertConnectionOrServiceDecorator: () => true,
      } as unknown as ConnectionService,
      didCommMessageRepository,
      agentConfig,
      mediationRecipientService,
      dispatcher,
      eventEmitter,
      credentialRepository,
      indyIssuerService,
      indyLedgerService,
      indyHolderService
    )
  })

  describe('createCredentialOffer', () => {
    let offerOptions: OfferCredentialOptions

    beforeEach(async () => {
      offerOptions = {
        comment: 'some comment',
        connectionId: connection.id,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          },
        },
        protocolVersion: CredentialProtocolVersion.V1,
      }
    })

    test(`creates credential record in ${CredentialState.OfferSent} state with offer, thread ID`, async () => {
      // given
      // agent = new Agent(config, dependencies)
      // await agent.initialize()
      // expect(agent.isInitialized).toBe(true)
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')

      await credentialService.createOffer(offerOptions)

      // then
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)

      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls
      expect(createdCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: createdCredentialRecord.threadId,
        connectionId: connection.id,
        state: CredentialState.OfferSent,
      })
    })

    test(`emits stateChange event with a new credential in ${CredentialState.OfferSent} state`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      await credentialService.createOffer(offerOptions)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        payload: {
          previousState: null,
          credentialRecord: expect.objectContaining({
            state: CredentialState.OfferSent,
          }),
        },
      })
    })

    //   test('returns credential offer message', async () => {
    //     const { message: credentialOffer } = await credentialService.createOffer(offerOptions)

    //     expect(credentialOffer.toJSON()).toMatchObject({
    //       '@id': expect.any(String),
    //       '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
    //       comment: 'some comment',
    //       credential_preview: {
    //         '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
    //         attributes: [
    //           {
    //             name: 'name',
    //             'mime-type': 'text/plain',
    //             value: 'John',
    //           },
    //           {
    //             name: 'age',
    //             'mime-type': 'text/plain',
    //             value: '99',
    //           },
    //         ],
    //       },
    //       'offers~attach': [
    //         {
    //           '@id': expect.any(String),
    //           'mime-type': 'application/json',
    //           data: {
    //             base64: expect.any(String),
    //           },
    //         },
    //       ],
    //     })
    //   })
    // })
  })
  describe('processCredentialOffer', () => {
    let messageContext: InboundMessageContext<V1OfferCredentialMessage>
    let credentialOfferMessage: V1OfferCredentialMessage

    beforeEach(async () => {
      credentialOfferMessage = new V1OfferCredentialMessage({
        comment: 'some comment',
        credentialPreview: credentialPreview,
        offerAttachments: [offerAttachment],
      })
      messageContext = new InboundMessageContext(credentialOfferMessage, {
        connection,
      })
      messageContext.connection = connection
    })

    test(`creates and return credential record in ${CredentialState.OfferReceived} state with offer, thread ID`, async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')
      agent = new Agent(config, dependencies)
      await agent.initialize()
      expect(agent.isInitialized).toBe(true)
      const agentConfig = getAgentConfig('CredentialServiceTest')
      eventEmitter = new EventEmitter(agentConfig)

      const dispatcher = agent.injectionContainer.resolve<Dispatcher>(Dispatcher)
      const mediationRecipientService = agent.injectionContainer.resolve(MediationRecipientService)

      credentialService = new V1CredentialService(
        {
          getById: () => Promise.resolve(connection),
          assertConnectionOrServiceDecorator: () => true,
        } as unknown as ConnectionService,
        didCommMessageRepository,
        agentConfig,
        mediationRecipientService,
        dispatcher,
        eventEmitter,
        credentialRepository,
        indyIssuerService,
        indyLedgerService,
        indyHolderService
      )
      // when
      const returnedCredentialRecord = await credentialService.processOffer(messageContext)

      // then
      const expectedCredentialRecord = {
        type: CredentialExchangeRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: credentialOfferMessage.id,
        connectionId: connection.id,
        state: CredentialState.OfferReceived,
      }
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)
      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls
      expect(createdCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
    })

    test(`emits stateChange event with ${CredentialState.OfferReceived}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      await credentialService.processOffer(messageContext)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        payload: {
          previousState: null,
          credentialRecord: expect.objectContaining({
            state: CredentialState.OfferReceived,
          }),
        },
      })
    })
  })
})

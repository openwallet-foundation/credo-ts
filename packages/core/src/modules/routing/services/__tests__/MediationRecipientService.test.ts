import type { AgentContext } from '../../../../agent'
import type { Wallet } from '../../../../wallet/Wallet'
import type { Routing } from '../../../connections/services/ConnectionService'

import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../tests/helpers'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../../agent/Events'
import { MessageSender } from '../../../../agent/MessageSender'
import { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import { Key } from '../../../../crypto'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error'
import { IndyWallet } from '../../../../wallet/IndyWallet'
import { DidExchangeState } from '../../../connections'
import { ConnectionRepository } from '../../../connections/repository/ConnectionRepository'
import { ConnectionService } from '../../../connections/services/ConnectionService'
import { DidRepository } from '../../../dids/repository/DidRepository'
import { DeliveryRequestMessage, MessageDeliveryMessage, MessagesReceivedMessage, StatusMessage } from '../../messages'
import { MediationRole, MediationState } from '../../models'
import { MediationRecord } from '../../repository/MediationRecord'
import { MediationRepository } from '../../repository/MediationRepository'
import { MediationRecipientService } from '../MediationRecipientService'

jest.mock('../../repository/MediationRepository')
const MediationRepositoryMock = MediationRepository as jest.Mock<MediationRepository>

jest.mock('../../../connections/repository/ConnectionRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>

jest.mock('../../../dids/repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

jest.mock('../../../../agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>

jest.mock('../../../../agent/MessageSender')
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>

const connectionImageUrl = 'https://example.com/image.png'

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

describe('MediationRecipientService', () => {
  const config = getAgentConfig('MediationRecipientServiceTest', {
    endpoints: ['http://agent.com:8080'],
    connectionImageUrl,
  })

  let wallet: Wallet
  let mediationRepository: MediationRepository
  let didRepository: DidRepository
  let eventEmitter: EventEmitter
  let connectionService: ConnectionService
  let connectionRepository: ConnectionRepository
  let messageSender: MessageSender
  let mediationRecipientService: MediationRecipientService
  let mediationRecord: MediationRecord
  let agentContext: AgentContext

  beforeAll(async () => {
    wallet = new IndyWallet(config.agentDependencies, config.logger)
    agentContext = getAgentContext({
      agentConfig: config,
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  beforeEach(async () => {
    eventEmitter = new EventEmitterMock()
    connectionRepository = new ConnectionRepositoryMock()
    didRepository = new DidRepositoryMock()
    connectionService = new ConnectionService(config.logger, connectionRepository, didRepository, eventEmitter)
    mediationRepository = new MediationRepositoryMock()
    messageSender = new MessageSenderMock()

    // Mock default return value
    mediationRecord = new MediationRecord({
      connectionId: 'connectionId',
      role: MediationRole.Recipient,
      state: MediationState.Granted,
      threadId: 'threadId',
    })
    mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

    mediationRecipientService = new MediationRecipientService(
      connectionService,
      messageSender,
      mediationRepository,
      eventEmitter
    )
  })

  describe('createStatusRequest', () => {
    it('creates a status request message', async () => {
      const statusRequestMessage = await mediationRecipientService.createStatusRequest(mediationRecord, {
        recipientKey: 'a-key',
      })

      expect(statusRequestMessage).toMatchObject({
        id: expect.any(String),
        recipientKey: 'a-key',
      })
    })

    it('it throws an error when the mediation record has incorrect role or state', async () => {
      mediationRecord.role = MediationRole.Mediator
      await expect(mediationRecipientService.createStatusRequest(mediationRecord)).rejects.toThrowError(
        'Mediation record has invalid role MEDIATOR. Expected role RECIPIENT.'
      )

      mediationRecord.role = MediationRole.Recipient
      mediationRecord.state = MediationState.Requested

      await expect(mediationRecipientService.createStatusRequest(mediationRecord)).rejects.toThrowError(
        'Mediation record is not ready to be used. Expected granted, found invalid state requested'
      )
    })
  })

  describe('processStatus', () => {
    it('if status request has a message count of zero returns nothing', async () => {
      const status = new StatusMessage({
        messageCount: 0,
      })

      const messageContext = new InboundMessageContext(status, { connection: mockConnection, agentContext })
      const deliveryRequestMessage = await mediationRecipientService.processStatus(messageContext)
      expect(deliveryRequestMessage).toBeNull()
    })

    it('if it has a message count greater than zero return a valid delivery request', async () => {
      const status = new StatusMessage({
        messageCount: 1,
      })
      const messageContext = new InboundMessageContext(status, { connection: mockConnection, agentContext })

      const deliveryRequestMessage = await mediationRecipientService.processStatus(messageContext)
      expect(deliveryRequestMessage)
      expect(deliveryRequestMessage).toEqual(new DeliveryRequestMessage({ id: deliveryRequestMessage?.id, limit: 1 }))
    })

    it('it throws an error when the mediation record has incorrect role or state', async () => {
      const status = new StatusMessage({
        messageCount: 1,
      })
      const messageContext = new InboundMessageContext(status, { connection: mockConnection, agentContext })

      mediationRecord.role = MediationRole.Mediator
      await expect(mediationRecipientService.processStatus(messageContext)).rejects.toThrowError(
        'Mediation record has invalid role MEDIATOR. Expected role RECIPIENT.'
      )

      mediationRecord.role = MediationRole.Recipient
      mediationRecord.state = MediationState.Requested

      await expect(mediationRecipientService.processStatus(messageContext)).rejects.toThrowError(
        'Mediation record is not ready to be used. Expected granted, found invalid state requested'
      )
    })
  })

  describe('processDelivery', () => {
    it('if the delivery has no attachments expect an error', async () => {
      const messageContext = new InboundMessageContext({} as MessageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      await expect(mediationRecipientService.processDelivery(messageContext)).rejects.toThrowError(
        new AriesFrameworkError('Error processing attachments')
      )
    })

    it('should return a message received with an message id list in it', async () => {
      const messageDeliveryMessage = new MessageDeliveryMessage({
        attachments: [
          new Attachment({
            id: '1',
            data: {
              json: {
                a: 'value',
              },
            },
          }),
        ],
      })
      const messageContext = new InboundMessageContext(messageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      const messagesReceivedMessage = await mediationRecipientService.processDelivery(messageContext)

      expect(messagesReceivedMessage).toEqual(
        new MessagesReceivedMessage({
          id: messagesReceivedMessage.id,
          messageIdList: ['1'],
        })
      )
    })

    it('calls the event emitter for each message', async () => {
      const messageDeliveryMessage = new MessageDeliveryMessage({
        attachments: [
          new Attachment({
            id: '1',
            data: {
              json: {
                first: 'value',
              },
            },
          }),
          new Attachment({
            id: '2',
            data: {
              json: {
                second: 'value',
              },
            },
          }),
        ],
      })
      const messageContext = new InboundMessageContext(messageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      await mediationRecipientService.processDelivery(messageContext)

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2)
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(1, agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: { first: 'value' },
        },
      })
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(2, agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: { second: 'value' },
        },
      })
    })

    it('it throws an error when the mediation record has incorrect role or state', async () => {
      const messageDeliveryMessage = new MessageDeliveryMessage({
        attachments: [
          new Attachment({
            id: '1',
            data: {
              json: {
                a: 'value',
              },
            },
          }),
        ],
      })
      const messageContext = new InboundMessageContext(messageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      mediationRecord.role = MediationRole.Mediator
      await expect(mediationRecipientService.processDelivery(messageContext)).rejects.toThrowError(
        'Mediation record has invalid role MEDIATOR. Expected role RECIPIENT.'
      )

      mediationRecord.role = MediationRole.Recipient
      mediationRecord.state = MediationState.Requested

      await expect(mediationRecipientService.processDelivery(messageContext)).rejects.toThrowError(
        'Mediation record is not ready to be used. Expected granted, found invalid state requested'
      )
    })
  })

  describe('addMediationRouting', () => {
    const routingKey = Key.fromFingerprint('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')
    const recipientKey = Key.fromFingerprint('z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th')
    const routing: Routing = {
      routingKeys: [routingKey],
      recipientKey,
      endpoints: [],
    }

    const mediationRecord = new MediationRecord({
      connectionId: 'connection-id',
      role: MediationRole.Recipient,
      state: MediationState.Granted,
      threadId: 'thread-id',
      endpoint: 'https://a-mediator-endpoint.com',
      routingKeys: [routingKey.publicKeyBase58],
    })

    beforeEach(() => {
      jest.spyOn(mediationRecipientService, 'keylistUpdateAndAwait').mockResolvedValue(mediationRecord)
    })

    test('adds mediation routing id mediator id is passed', async () => {
      mockFunction(mediationRepository.getById).mockResolvedValue(mediationRecord)

      const extendedRouting = await mediationRecipientService.addMediationRouting(agentContext, routing, {
        mediatorId: 'mediator-id',
      })

      expect(extendedRouting).toMatchObject({
        endpoints: ['https://a-mediator-endpoint.com'],
        routingKeys: [routingKey],
      })
      expect(mediationRepository.getById).toHaveBeenCalledWith(agentContext, 'mediator-id')
    })

    test('adds mediation routing if useDefaultMediator is true and default mediation is found', async () => {
      mockFunction(mediationRepository.findSingleByQuery).mockResolvedValue(mediationRecord)

      jest.spyOn(mediationRecipientService, 'keylistUpdateAndAwait').mockResolvedValue(mediationRecord)
      const extendedRouting = await mediationRecipientService.addMediationRouting(agentContext, routing, {
        useDefaultMediator: true,
      })

      expect(extendedRouting).toMatchObject({
        endpoints: ['https://a-mediator-endpoint.com'],
        routingKeys: [routingKey],
      })
      expect(mediationRepository.findSingleByQuery).toHaveBeenCalledWith(agentContext, { default: true })
    })

    test('does not add mediation routing if no mediation is found', async () => {
      mockFunction(mediationRepository.findSingleByQuery).mockResolvedValue(mediationRecord)

      jest.spyOn(mediationRecipientService, 'keylistUpdateAndAwait').mockResolvedValue(mediationRecord)
      const extendedRouting = await mediationRecipientService.addMediationRouting(agentContext, routing, {
        useDefaultMediator: false,
      })

      expect(extendedRouting).toMatchObject(routing)
      expect(mediationRepository.findSingleByQuery).not.toHaveBeenCalled()
      expect(mediationRepository.getById).not.toHaveBeenCalled()
    })
  })
})

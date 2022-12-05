import type { AgentContext } from '../../../../agent'
import type { Wallet } from '../../../../wallet/Wallet'
import type { Routing } from '../../../connections/services/ConnectionService'

import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../tests/helpers'
import { Dispatcher } from '../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { MessageSender } from '../../../../agent/MessageSender'
import { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import { Key } from '../../../../crypto'
import { KeyProviderRegistry } from '../../../../crypto/key-provider'
import { uuid } from '../../../../utils/uuid'
import { IndyWallet } from '../../../../wallet/IndyWallet'
import { DidExchangeState } from '../../../connections'
import { ConnectionMetadataKeys } from '../../../connections/repository/ConnectionMetadataTypes'
import { ConnectionRepository } from '../../../connections/repository/ConnectionRepository'
import { ConnectionService } from '../../../connections/services/ConnectionService'
import { DidRepository } from '../../../dids/repository/DidRepository'
import { DidRegistrarService } from '../../../dids/services/DidRegistrarService'
import { RecipientModuleConfig } from '../../RecipientModuleConfig'
import { RoutingEventTypes } from '../../RoutingEvents'
import { MediationRole, MediationState } from '../../models'
import { DeliveryRequestMessage, StatusMessage } from '../../protocol'
import { MediationRecipientService } from '../../protocol/coordinate-mediation/v1/MediationRecipientService'
import {
  KeylistUpdateAction,
  KeylistUpdateResponseMessage,
  KeylistUpdateResult,
  MediationGrantMessage,
} from '../../protocol/coordinate-mediation/v1/messages'
import { MediationRecord } from '../../repository/MediationRecord'
import { MediationRepository } from '../../repository/MediationRepository'

jest.mock('../../repository/MediationRepository')
const MediationRepositoryMock = MediationRepository as jest.Mock<MediationRepository>

jest.mock('../../../connections/repository/ConnectionRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>

jest.mock('../../../dids/repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

jest.mock('../../../../agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>

jest.mock('../../../../agent/Dispatcher')
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>

jest.mock('../../../../agent/MessageSender')
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>

jest.mock('../../../dids/services/DidRegistrarService')
const DidRegistrarServiceMock = DidRegistrarService as jest.Mock<DidRegistrarService>

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
  let didRegistrarService: DidRegistrarService
  let eventEmitter: EventEmitter
  let dispatcher: Dispatcher
  let connectionService: ConnectionService
  let connectionRepository: ConnectionRepository
  let messageSender: MessageSender
  let mediationRecipientService: MediationRecipientService
  let mediationRecord: MediationRecord
  let agentContext: AgentContext

  beforeAll(async () => {
    wallet = new IndyWallet(config.agentDependencies, config.logger, new KeyProviderRegistry([]))
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
    dispatcher = new DispatcherMock()
    connectionRepository = new ConnectionRepositoryMock()
    didRepository = new DidRepositoryMock()
    didRegistrarService = new DidRegistrarServiceMock()
    connectionService = new ConnectionService(
      config.logger,
      connectionRepository,
      didRepository,
      didRegistrarService,
      eventEmitter
    )
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
      eventEmitter,
      dispatcher,
      new RecipientModuleConfig()
    )
  })

  describe('processMediationGrant', () => {
    test('should process base58 encoded routing keys', async () => {
      mediationRecord.state = MediationState.Requested
      const mediationGrant = new MediationGrantMessage({
        endpoint: 'http://agent.com:8080',
        routingKeys: ['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'],
        threadId: 'threadId',
      })

      const connection = getMockConnection({
        state: DidExchangeState.Completed,
      })

      const messageContext = new InboundMessageContext(mediationGrant, { connection, agentContext })

      await mediationRecipientService.processMediationGrant(messageContext)

      expect(connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol)).toEqual({
        'https://didcomm.org/coordinate-mediation/1.0': false,
      })
      expect(mediationRecord.routingKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
    })

    test('should process did:key encoded routing keys', async () => {
      mediationRecord.state = MediationState.Requested
      const mediationGrant = new MediationGrantMessage({
        endpoint: 'http://agent.com:8080',
        routingKeys: ['did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
        threadId: 'threadId',
      })

      const connection = getMockConnection({
        state: DidExchangeState.Completed,
      })

      const messageContext = new InboundMessageContext(mediationGrant, { connection, agentContext })

      await mediationRecipientService.processMediationGrant(messageContext)

      expect(connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol)).toEqual({
        'https://didcomm.org/coordinate-mediation/1.0': true,
      })
      expect(mediationRecord.routingKeys).toEqual(['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'])
    })
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

  describe('processKeylistUpdateResults', () => {
    it('it stores did:key-encoded keys in base58 format', async () => {
      const spyAddRecipientKey = jest.spyOn(mediationRecord, 'addRecipientKey')

      const connection = getMockConnection({
        state: DidExchangeState.Completed,
      })

      const keylist = [
        {
          result: KeylistUpdateResult.Success,
          recipientKey: 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
          action: KeylistUpdateAction.add,
        },
      ]

      const keyListUpdateResponse = new KeylistUpdateResponseMessage({
        threadId: uuid(),
        keylist,
      })

      const messageContext = new InboundMessageContext(keyListUpdateResponse, { connection, agentContext })

      expect(connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol)).toBeNull()

      await mediationRecipientService.processKeylistUpdateResults(messageContext)

      expect(connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol)).toEqual({
        'https://didcomm.org/coordinate-mediation/1.0': true,
      })

      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: RoutingEventTypes.RecipientKeylistUpdated,
        payload: {
          mediationRecord,
          keylist,
        },
      })
      expect(spyAddRecipientKey).toHaveBeenCalledWith('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K')
      spyAddRecipientKey.mockClear()
    })
  })

  describe('processStatus', () => {
    it('if status request has a message count of zero returns nothing', async () => {
      const status = new StatusMessage({
        threadId: uuid(),
        messageCount: 0,
      })

      const messageContext = new InboundMessageContext(status, { connection: mockConnection, agentContext })
      const deliveryRequestMessage = await mediationRecipientService.processStatus(messageContext)
      expect(deliveryRequestMessage).toBeNull()
    })

    it('if it has a message count greater than zero return a valid delivery request', async () => {
      const status = new StatusMessage({
        threadId: uuid(),
        messageCount: 1,
      })
      const messageContext = new InboundMessageContext(status, { connection: mockConnection, agentContext })

      const deliveryRequestMessage = await mediationRecipientService.processStatus(messageContext)
      expect(deliveryRequestMessage)
      expect(deliveryRequestMessage).toEqual(new DeliveryRequestMessage({ id: deliveryRequestMessage?.id, limit: 1 }))
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

import type { AgentContext } from '../../../../../../core/src/agent'
import type { DidCommRouting } from '../../../../models'

import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { EventEmitter } from '../../../../../../core/src/agent/EventEmitter'
import { DidRepository } from '../../../../../../core/src/modules/dids/repository/DidRepository'
import { uuid } from '../../../../../../core/src/utils/uuid'
import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../core/tests/helpers'
import { DidCommMessageSender } from '../../../../DidCommMessageSender'
import { InboundDidCommMessageContext } from '../../../../models/InboundDidCommMessageContext'
import { DidExchangeState } from '../../../connections'
import { ConnectionMetadataKeys } from '../../../connections/repository/ConnectionMetadataTypes'
import { ConnectionRepository } from '../../../connections/repository/ConnectionRepository'
import { ConnectionService } from '../../../connections/services/ConnectionService'
import { RoutingEventTypes } from '../../RoutingEvents'
import {
  KeylistUpdateAction,
  KeylistUpdateResponseMessage,
  KeylistUpdateResult,
  MediationGrantMessage,
} from '../../messages'
import { MediationRole, MediationState } from '../../models'
import { MediationRecord } from '../../repository/MediationRecord'
import { MediationRepository } from '../../repository/MediationRepository'
import { MediationRecipientService } from '../MediationRecipientService'

jest.mock('../../repository/MediationRepository')
const MediationRepositoryMock = MediationRepository as jest.Mock<MediationRepository>

jest.mock('../../../connections/repository/ConnectionRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>

jest.mock('../../../../../../core/src/modules/dids/repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

jest.mock('../../../../../../core/src/agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>

jest.mock('../../../../DidCommMessageSender')
const MessageSenderMock = DidCommMessageSender as jest.Mock<DidCommMessageSender>

const connectionImageUrl = 'https://example.com/image.png'

describe('MediationRecipientService', () => {
  const config = getAgentConfig('MediationRecipientServiceTest', {
    endpoints: ['http://agent.com:8080'],
    connectionImageUrl,
  })

  let mediationRepository: MediationRepository
  let didRepository: DidRepository
  let eventEmitter: EventEmitter
  let connectionService: ConnectionService
  let connectionRepository: ConnectionRepository
  let messageSender: DidCommMessageSender
  let mediationRecipientService: MediationRecipientService
  let mediationRecord: MediationRecord
  let agentContext: AgentContext

  beforeAll(async () => {
    agentContext = getAgentContext({
      agentConfig: config,
    })
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

      const messageContext = new InboundDidCommMessageContext(mediationGrant, { connection, agentContext })

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

      const messageContext = new InboundDidCommMessageContext(mediationGrant, { connection, agentContext })

      await mediationRecipientService.processMediationGrant(messageContext)

      expect(connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol)).toEqual({
        'https://didcomm.org/coordinate-mediation/1.0': true,
      })
      expect(mediationRecord.routingKeys).toEqual(['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'])
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

      const messageContext = new InboundDidCommMessageContext(keyListUpdateResponse, { connection, agentContext })

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

  describe('addMediationRouting', () => {
    const routingKey = Kms.PublicJwk.fromFingerprint(
      'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL'
    ) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
    const recipientKey = Kms.PublicJwk.fromFingerprint(
      'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'
    ) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
    const routing: DidCommRouting = {
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
      routingKeys: [TypedArrayEncoder.toBase58(routingKey.publicKey.publicKey)],
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
        routingKeys: routing.routingKeys,
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

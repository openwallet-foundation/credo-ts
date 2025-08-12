import { Subject } from 'rxjs'

import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { EventEmitter } from '../../../../../../core/src/agent/EventEmitter'
import { isDidKey } from '../../../../../../core/src/modules/dids/helpers'
import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../core/tests/helpers'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { InboundDidCommMessageContext } from '../../../../models/InboundDidCommMessageContext'
import { ConnectionService, DidExchangeState } from '../../../connections'
import { MessagePickupApi } from '../../../message-pickup'
import { KeylistUpdateAction, KeylistUpdateMessage, KeylistUpdateResult } from '../../messages'
import { MediationRole, MediationState } from '../../models'
import { MediationRecord, MediatorRoutingRecord } from '../../repository'
import { MediationRepository } from '../../repository/MediationRepository'
import { MediatorRoutingRepository } from '../../repository/MediatorRoutingRepository'
import { MediatorService } from '../MediatorService'

jest.mock('../../repository/MediationRepository')
const MediationRepositoryMock = MediationRepository as jest.Mock<MediationRepository>

jest.mock('../../repository/MediatorRoutingRepository')
const MediatorRoutingRepositoryMock = MediatorRoutingRepository as jest.Mock<MediatorRoutingRepository>

jest.mock('../../../connections/services/ConnectionService')
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>

jest.mock('../../../connections/services/ConnectionService')
const MessagePickupApiMock = MessagePickupApi as jest.Mock<MessagePickupApi>

const mediationRepository = new MediationRepositoryMock()
const mediatorRoutingRepository = new MediatorRoutingRepositoryMock()
const connectionService = new ConnectionServiceMock()
const mediationPickupApi = new MessagePickupApiMock()

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

describe('MediatorService - default config', () => {
  const agentConfig = getAgentConfig('MediatorService')

  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [[DidCommModuleConfig, new DidCommModuleConfig()]],
  })

  const mediatorService = new MediatorService(
    mediationRepository,
    mediatorRoutingRepository,
    mediationPickupApi,
    new EventEmitter(agentConfig.agentDependencies, new Subject()),
    agentConfig.logger,
    connectionService
  )

  describe('createGrantMediationMessage', () => {
    test('sends did:key encoded recipient keys by default', async () => {
      const mediationRecord = new MediationRecord({
        connectionId: 'connectionId',
        role: MediationRole.Mediator,
        state: MediationState.Requested,
        threadId: 'threadId',
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      mockFunction(mediatorRoutingRepository.findById).mockResolvedValue(
        new MediatorRoutingRecord({
          routingKeys: [
            {
              routingKeyFingerprint: Kms.PublicJwk.fromPublicKey({
                kty: 'OKP',
                crv: 'Ed25519',
                publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
              }).fingerprint,
              kmsKeyId: 'some-key-id',
            },
          ],
        })
      )

      const { message } = await mediatorService.createGrantMediationMessage(agentContext, mediationRecord)

      expect(message.routingKeys.length).toBe(1)
      expect(isDidKey(message.routingKeys[0])).toBeTruthy()
    })
  })

  describe('processKeylistUpdateRequest', () => {
    test('processes base58 encoded recipient keys', async () => {
      const mediationRecord = new MediationRecord({
        connectionId: 'connectionId',
        role: MediationRole.Mediator,
        state: MediationState.Granted,
        threadId: 'threadId',
        recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const keyListUpdate = new KeylistUpdateMessage({
        updates: [
          {
            action: KeylistUpdateAction.add,
            recipientKey: '79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ',
          },
          {
            action: KeylistUpdateAction.remove,
            recipientKey: '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K',
          },
        ],
      })

      const messageContext = new InboundDidCommMessageContext(keyListUpdate, { connection: mockConnection, agentContext })
      const response = await mediatorService.processKeylistUpdateRequest(messageContext)

      expect(mediationRecord.recipientKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
      expect(response.updated).toEqual([
        {
          action: KeylistUpdateAction.add,
          recipientKey: '79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ',
          result: KeylistUpdateResult.Success,
        },
        {
          action: KeylistUpdateAction.remove,
          recipientKey: '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K',
          result: KeylistUpdateResult.Success,
        },
      ])
    })
  })

  test('processes did:key encoded recipient keys', async () => {
    const mediationRecord = new MediationRecord({
      connectionId: 'connectionId',
      role: MediationRole.Mediator,
      state: MediationState.Granted,
      threadId: 'threadId',
      recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
    })

    mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

    const keyListUpdate = new KeylistUpdateMessage({
      updates: [
        {
          action: KeylistUpdateAction.add,
          recipientKey: 'did:key:z6MkkbTaLstV4fwr1rNf5CSxdS2rGbwxi3V5y6NnVFTZ2V1w',
        },
        {
          action: KeylistUpdateAction.remove,
          recipientKey: 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
        },
      ],
    })

    const messageContext = new InboundDidCommMessageContext(keyListUpdate, { connection: mockConnection, agentContext })
    const response = await mediatorService.processKeylistUpdateRequest(messageContext)

    expect(mediationRecord.recipientKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
    expect(response.updated).toEqual([
      {
        action: KeylistUpdateAction.add,
        recipientKey: 'did:key:z6MkkbTaLstV4fwr1rNf5CSxdS2rGbwxi3V5y6NnVFTZ2V1w',
        result: KeylistUpdateResult.Success,
      },
      {
        action: KeylistUpdateAction.remove,
        recipientKey: 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
        result: KeylistUpdateResult.Success,
      },
    ])
  })
})

describe('MediatorService - useDidKeyInProtocols set to false', () => {
  const agentConfig = getAgentConfig('MediatorService', { useDidKeyInProtocols: false })

  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [[DidCommModuleConfig, new DidCommModuleConfig({ useDidKeyInProtocols: false })]],
  })

  const mediatorService = new MediatorService(
    mediationRepository,
    mediatorRoutingRepository,
    mediationPickupApi,
    new EventEmitter(agentConfig.agentDependencies, new Subject()),
    agentConfig.logger,
    connectionService
  )

  describe('createGrantMediationMessage', () => {
    test('sends base58 encoded recipient keys when config is set', async () => {
      const mediationRecord = new MediationRecord({
        connectionId: 'connectionId',
        role: MediationRole.Mediator,
        state: MediationState.Requested,
        threadId: 'threadId',
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const routingRecord = new MediatorRoutingRecord({
        routingKeys: [
          {
            routingKeyFingerprint: Kms.PublicJwk.fromPublicKey({
              kty: 'OKP',
              crv: 'Ed25519',
              publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
            }).fingerprint,
            kmsKeyId: 'some-key-id',
          },
        ],
      })

      mockFunction(mediatorRoutingRepository.findById).mockResolvedValue(routingRecord)

      const { message } = await mediatorService.createGrantMediationMessage(agentContext, mediationRecord)

      expect(message.routingKeys.length).toBe(1)
      expect(isDidKey(message.routingKeys[0])).toBeFalsy()
    })
  })
})

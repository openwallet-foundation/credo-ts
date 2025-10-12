import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../core/src/agent/EventEmitter'
import { isDidKey } from '../../../../../../core/src/modules/dids/helpers'
import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../core/tests/helpers'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { DidCommInboundMessageContext } from '../../../../models/DidCommInboundMessageContext'
import { DidCommConnectionService, DidCommDidExchangeState } from '../../../connections'
import { DidCommMessagePickupApi } from '../../../message-pickup'
import { DidCommKeylistUpdateAction, DidCommKeylistUpdateMessage, DidCommKeylistUpdateResult } from '../../messages'
import { DidCommMediationRole, DidCommMediationState } from '../../models'
import { DidCommMediationRecord, DidCommMediatorRoutingRecord } from '../../repository'
import { DidCommMediationRepository } from '../../repository/DidCommMediationRepository'
import { DidCommMediatorRoutingRepository } from '../../repository/DidCommMediatorRoutingRepository'
import { DidCommMediatorService } from '../DidCommMediatorService'

vi.mock('../../repository/DidCommMediationRepository')
const MediationRepositoryMock = DidCommMediationRepository as MockedClassConstructor<typeof DidCommMediationRepository>

vi.mock('../../repository/DidCommMediatorRoutingRepository')
const MediatorRoutingRepositoryMock = DidCommMediatorRoutingRepository as MockedClassConstructor<
  typeof DidCommMediatorRoutingRepository
>

vi.mock('../../../connections/services/DidCommConnectionService')
const ConnectionServiceMock = DidCommConnectionService as MockedClassConstructor<typeof DidCommConnectionService>

vi.mock('../../../connections/services/DidCommConnectionService')
const MessagePickupApiMock = DidCommMessagePickupApi as MockedClassConstructor<typeof DidCommMessagePickupApi>

const mediationRepository = new MediationRepositoryMock()
const mediatorRoutingRepository = new MediatorRoutingRepositoryMock()
const connectionService = new ConnectionServiceMock()
const mediationPickupApi = new MessagePickupApiMock()

const mockConnection = getMockConnection({
  state: DidCommDidExchangeState.Completed,
})

describe('MediatorService - default config', () => {
  const agentConfig = getAgentConfig('MediatorService')

  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [
      [DidCommModuleConfig, new DidCommModuleConfig()],
      [DidCommMessagePickupApi, mediationPickupApi],
    ],
  })

  const mediatorService = new DidCommMediatorService(
    mediationRepository,
    mediatorRoutingRepository,
    new EventEmitter(agentConfig.agentDependencies, new Subject()),
    agentConfig.logger,
    connectionService
  )

  describe('createGrantMediationMessage', () => {
    test('sends did:key encoded recipient keys by default', async () => {
      const mediationRecord = new DidCommMediationRecord({
        connectionId: 'connectionId',
        role: DidCommMediationRole.Mediator,
        state: DidCommMediationState.Requested,
        threadId: 'threadId',
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      mockFunction(mediatorRoutingRepository.findById).mockResolvedValue(
        new DidCommMediatorRoutingRecord({
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
      const mediationRecord = new DidCommMediationRecord({
        connectionId: 'connectionId',
        role: DidCommMediationRole.Mediator,
        state: DidCommMediationState.Granted,
        threadId: 'threadId',
        recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const keyListUpdate = new DidCommKeylistUpdateMessage({
        updates: [
          {
            action: DidCommKeylistUpdateAction.add,
            recipientKey: '79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ',
          },
          {
            action: DidCommKeylistUpdateAction.remove,
            recipientKey: '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K',
          },
        ],
      })

      const messageContext = new DidCommInboundMessageContext(keyListUpdate, {
        connection: mockConnection,
        agentContext,
      })
      const response = await mediatorService.processKeylistUpdateRequest(messageContext)

      expect(mediationRecord.recipientKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
      expect(response.updated).toEqual([
        {
          action: DidCommKeylistUpdateAction.add,
          recipientKey: '79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ',
          result: DidCommKeylistUpdateResult.Success,
        },
        {
          action: DidCommKeylistUpdateAction.remove,
          recipientKey: '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K',
          result: DidCommKeylistUpdateResult.Success,
        },
      ])
    })
  })

  test('processes did:key encoded recipient keys', async () => {
    const mediationRecord = new DidCommMediationRecord({
      connectionId: 'connectionId',
      role: DidCommMediationRole.Mediator,
      state: DidCommMediationState.Granted,
      threadId: 'threadId',
      recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
    })

    mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

    const keyListUpdate = new DidCommKeylistUpdateMessage({
      updates: [
        {
          action: DidCommKeylistUpdateAction.add,
          recipientKey: 'did:key:z6MkkbTaLstV4fwr1rNf5CSxdS2rGbwxi3V5y6NnVFTZ2V1w',
        },
        {
          action: DidCommKeylistUpdateAction.remove,
          recipientKey: 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
        },
      ],
    })

    const messageContext = new DidCommInboundMessageContext(keyListUpdate, { connection: mockConnection, agentContext })
    const response = await mediatorService.processKeylistUpdateRequest(messageContext)

    expect(mediationRecord.recipientKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
    expect(response.updated).toEqual([
      {
        action: DidCommKeylistUpdateAction.add,
        recipientKey: 'did:key:z6MkkbTaLstV4fwr1rNf5CSxdS2rGbwxi3V5y6NnVFTZ2V1w',
        result: DidCommKeylistUpdateResult.Success,
      },
      {
        action: DidCommKeylistUpdateAction.remove,
        recipientKey: 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
        result: DidCommKeylistUpdateResult.Success,
      },
    ])
  })
})

describe('MediatorService - useDidKeyInProtocols set to false', () => {
  const agentConfig = getAgentConfig('MediatorService', { useDidKeyInProtocols: false })

  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [
      [DidCommModuleConfig, new DidCommModuleConfig({ useDidKeyInProtocols: false })],
      [DidCommMessagePickupApi, mediationPickupApi],
    ],
  })

  const mediatorService = new DidCommMediatorService(
    mediationRepository,
    mediatorRoutingRepository,
    new EventEmitter(agentConfig.agentDependencies, new Subject()),
    agentConfig.logger,
    connectionService
  )

  describe('createGrantMediationMessage', () => {
    test('sends base58 encoded recipient keys when config is set', async () => {
      const mediationRecord = new DidCommMediationRecord({
        connectionId: 'connectionId',
        role: DidCommMediationRole.Mediator,
        state: DidCommMediationState.Requested,
        threadId: 'threadId',
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const routingRecord = new DidCommMediatorRoutingRecord({
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

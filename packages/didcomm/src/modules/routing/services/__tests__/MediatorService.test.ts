import { Kms, RecordDuplicateError, TypedArrayEncoder } from '@credo-ts/core'
import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../core/src/agent/EventEmitter'
import { isDidKey } from '../../../../../../core/src/modules/dids/helpers'
import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../core/tests/helpers'
import { DummyTransportSession } from '../../../../__tests__/stubs'
import { DidCommMessageSender } from '../../../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { DidCommTransportService } from '../../../../DidCommTransportService'
import { MessageSendingError } from '../../../../errors'
import type { DidCommOutboundMessageContext } from '../../../../models'
import { DidCommInboundMessageContext } from '../../../../models/DidCommInboundMessageContext'
import { DidCommConnectionService, DidCommDidExchangeState } from '../../../connections'
import {
  DidCommMessagePickupApi,
  DidCommMessagePickupSessionRole,
  DidCommMessagePickupSessionService,
} from '../../../message-pickup'
import { DidCommMediatorModuleConfig } from '../../DidCommMediatorModuleConfig'
import { DidCommMessageForwardingStrategy } from '../../DidCommMessageForwardingStrategy'
import { DidCommMediationRole, DidCommMediationState } from '../../models'
import {
  DidCommForwardMessage,
  DidCommKeylistUpdateAction,
  DidCommKeylistUpdateMessage,
  DidCommKeylistUpdateResult,
} from '../../protocol/v1/messages'
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

  describe('createMediatorRoutingRecord', () => {
    test('deletes its routing keys and returns the stored record if another instance saved first', async () => {
      const storedRecord = new DidCommMediatorRoutingRecord({ routingKeys: [] })
      mockFunction(mediatorRoutingRepository.save).mockRejectedValueOnce(
        new RecordDuplicateError('Record already exists', { recordType: DidCommMediatorRoutingRecord.type })
      )
      mockFunction(mediatorRoutingRepository.getById).mockResolvedValueOnce(storedRecord)

      await expect(mediatorService.createMediatorRoutingRecord(agentContext)).resolves.toBe(storedRecord)

      const [, unsavedRecord] = mockFunction(mediatorRoutingRepository.save).mock.calls[0]
      await expect(
        agentContext.resolve(Kms.KeyManagementApi).getPublicKey({ keyId: unsavedRecord.routingKeysWithKeyId[0].keyId })
      ).rejects.toThrow(Kms.KeyManagementKeyNotFoundError)
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

describe('MediatorService - QueueAndLiveModeDelivery', () => {
  const agentConfig = getAgentConfig('MediatorService')
  const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
  const sessionService = new DidCommMessagePickupSessionService()
  const transportService = new DidCommTransportService(getAgentContext(), eventEmitter)

  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [
      [EventEmitter, eventEmitter],
      [DidCommModuleConfig, new DidCommModuleConfig()],
      [DidCommMessagePickupApi, mediationPickupApi],
      [DidCommMessagePickupSessionService, sessionService],
      [DidCommMessageSender, {}],
      [DidCommTransportService, transportService],
      [
        DidCommMediatorModuleConfig,
        new DidCommMediatorModuleConfig({
          messageForwardingStrategy: DidCommMessageForwardingStrategy.QueueAndLiveModeDelivery,
        }),
      ],
    ],
  })

  const mediatorService = new DidCommMediatorService(
    mediationRepository,
    mediatorRoutingRepository,
    eventEmitter,
    agentConfig.logger,
    connectionService
  )

  const recipientKey = '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'
  const sendError = new MessageSendingError('Message is undeliverable', {
    outboundMessageContext: {} as DidCommOutboundMessageContext,
  })

  function saveLiveSession(transportSessionId: string): void {
    sessionService.saveLiveSession(agentContext, {
      connectionId: mockConnection.id,
      protocolVersion: 'v2',
      role: DidCommMessagePickupSessionRole.MessageHolder,
      transportSessionId,
    })
  }

  function liveTransportSessionId(): string | undefined {
    return sessionService.getLiveSessionByConnectionId(agentContext, { connectionId: mockConnection.id })
      ?.transportSessionId
  }

  async function forward(): Promise<void> {
    const message = new DidCommForwardMessage({
      to: recipientKey,
      message: { protected: 'base64url', iv: 'base64url', ciphertext: 'base64url', tag: 'base64url' },
    })
    await mediatorService.processForwardMessage(new DidCommInboundMessageContext(message, { agentContext }))
  }

  let transportSession: DummyTransportSession

  beforeEach(() => {
    transportSession = new DummyTransportSession('transportSessionId')
    vi.spyOn(transportSession, 'close').mockResolvedValue()
    transportService.saveSession(transportSession)
    mockFunction(mediationRepository.getSingleByRecipientKey).mockResolvedValue(
      new DidCommMediationRecord({
        connectionId: mockConnection.id,
        role: DidCommMediationRole.Mediator,
        state: DidCommMediationState.Granted,
        threadId: 'threadId',
        recipientKeys: [recipientKey],
      })
    )
    mockFunction(connectionService.getById).mockResolvedValue(mockConnection)
    saveLiveSession('transportSessionId')
    vi.spyOn(mediationPickupApi, 'queueMessage').mockResolvedValue(undefined)
    vi.spyOn(mediationPickupApi, 'getLiveModeSession').mockImplementation(async (options) =>
      sessionService.getLiveSessionByConnectionId(agentContext, options)
    )
  })

  test('ends the live mode session, closes its transport and completes the forward when the live delivery send fails', async () => {
    vi.spyOn(mediationPickupApi, 'deliverMessagesFromQueue').mockRejectedValue(sendError)
    const warnSpy = vi.spyOn(agentConfig.logger, 'warn')

    await forward()

    expect(transportSession.close).toHaveBeenCalledTimes(1)
    expect(liveTransportSessionId()).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(`'${mockConnection.id}'`), {
      error: 'Message is undeliverable',
    })
  })

  test('completes the forward when closing the transport throws', async () => {
    vi.spyOn(mediationPickupApi, 'deliverMessagesFromQueue').mockRejectedValue(sendError)
    vi.spyOn(transportSession, 'close').mockRejectedValue(new Error('close failed'))

    await expect(forward()).resolves.toBeUndefined()

    expect(liveTransportSessionId()).toBeUndefined()
  })

  test('keeps a live mode session that replaced the failed one', async () => {
    vi.spyOn(mediationPickupApi, 'deliverMessagesFromQueue').mockImplementation(async () => {
      saveLiveSession('newTransportSessionId')
      throw sendError
    })

    await forward()

    expect(transportSession.close).not.toHaveBeenCalled()
    expect(liveTransportSessionId()).toBe('newTransportSessionId')
  })

  test('keeps the live mode session when live delivery fails before sending', async () => {
    vi.spyOn(mediationPickupApi, 'deliverMessagesFromQueue').mockRejectedValue(new Error('storage unavailable'))

    await forward()

    expect(transportSession.close).not.toHaveBeenCalled()
    expect(liveTransportSessionId()).toBe('transportSessionId')
  })
})

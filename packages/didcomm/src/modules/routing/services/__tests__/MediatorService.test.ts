import {
  CachedStorageService,
  CacheModuleConfig,
  didToNumAlgo2DidDocument,
  InMemoryLruCache,
  Kms,
  RecordNotFoundError,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../../tests/InMemoryStorageService'
import type { MockedClassConstructor } from '../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../core/src/agent/EventEmitter'
import { isDidKey } from '../../../../../../core/src/modules/dids/helpers'
import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../core/tests/helpers'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { DidCommAttachment } from '../../../../decorators/attachment/DidCommAttachment'
import { DidCommInboundMessageContext } from '../../../../models/DidCommInboundMessageContext'
import { DidCommConnectionService, DidCommDidExchangeState } from '../../../connections'
import { DidCommMessagePickupApi } from '../../../message-pickup'
import { DidCommMediatorModuleConfig } from '../../DidCommMediatorModuleConfig'
import { DidCommMediationRole, DidCommMediationState } from '../../models'
import {
  DidCommKeylistUpdateAction,
  DidCommKeylistUpdateMessage,
  DidCommKeylistUpdateResult,
} from '../../protocol/v1/messages'
import {
  DidCommForwardV2Message,
  DidCommKeylistQueryV2Message,
  DidCommKeylistUpdateV2Message,
  DidCommMediateRequestV2Message,
  KeylistUpdateActionV2,
} from '../../protocol/v2/messages'
import {
  DidCommMediationRecord,
  DidCommMediatorRoutingRecord,
  type DidCommMediatorRoutingRecordRoutingKey,
} from '../../repository'
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

describe('MediatorService - v2 (Coordinate Mediation 2.0)', () => {
  const agentConfig = getAgentConfig('MediatorService')
  const mediatorModuleConfig = new DidCommMediatorModuleConfig({
    mediatorRoutingDid:
      'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOltdLCJhIjoibm9uZSMxIn0',
  })

  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [
      [DidCommModuleConfig, new DidCommModuleConfig()],
      [DidCommMessagePickupApi, mediationPickupApi],
      [DidCommMediatorModuleConfig, mediatorModuleConfig],
    ],
  })

  const mediatorService = new DidCommMediatorService(
    mediationRepository,
    mediatorRoutingRepository,
    new EventEmitter(agentConfig.agentDependencies, new Subject()),
    agentConfig.logger,
    connectionService
  )

  const ed25519RoutingKey = {
    routingKeyFingerprint: Kms.PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'Ed25519',
      publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
    }).fingerprint,
    kmsKeyId: 'some-key-id',
  }
  const x25519RoutingKey = {
    routingKeyFingerprint: Kms.PublicJwk.fromPublicJwk({
      kty: 'OKP',
      crv: 'X25519',
      x: 'hSDwCYkwp1R0i33ctD73Wg2_Og0mOBr066SpjqqbTmo',
    }).fingerprint,
    kmsKeyId: 'some-x25519-key-id',
  }

  const createServiceWithStorage = async (
    storageService: InMemoryStorageService<DidCommMediatorRoutingRecord>
  ): Promise<{ repository: DidCommMediatorRoutingRepository; service: DidCommMediatorService }> => {
    const { DidCommMediatorRoutingRepository: ActualMediatorRoutingRepository } = await vi.importActual<
      typeof import('../../repository/DidCommMediatorRoutingRepository')
    >('../../repository/DidCommMediatorRoutingRepository')
    const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    const repository = new ActualMediatorRoutingRepository(storageService, eventEmitter)
    return {
      repository,
      service: new DidCommMediatorService(
        mediationRepository,
        repository,
        eventEmitter,
        agentConfig.logger,
        connectionService
      ),
    }
  }

  describe('processMediationRequestV2', () => {
    test('creates mediation record with protocol version 2.0', async () => {
      const mediateRequest = new DidCommMediateRequestV2Message({})
      const messageContext = new DidCommInboundMessageContext(mediateRequest, {
        connection: mockConnection,
        agentContext,
      })

      mockFunction(mediationRepository.save).mockResolvedValue(undefined)

      const { mediationRecord: record } = await mediatorService.processMediationRequestV2(messageContext)

      expect(record.protocolVersion).toBe('v2')
      expect(record.threadId).toBe(mediateRequest.id)
      expect(record.role).toBe(DidCommMediationRole.Mediator)
      expect(record.state).toBe(DidCommMediationState.Requested)
    })

    test('looks up the connection by the authenticated sender DID, never by message.from', async () => {
      const mediateRequest = new DidCommMediateRequestV2Message({})
      mediateRequest.from = 'did:example:victim'
      mockFunction(connectionService.findByTheirDidOrSender).mockResolvedValue(mockConnection)

      await expect(
        mediatorService.processMediationRequestV2(new DidCommInboundMessageContext(mediateRequest, { agentContext }))
      ).rejects.toThrow('No connection associated')
      expect(connectionService.findByTheirDidOrSender).not.toHaveBeenCalled()

      await mediatorService.processMediationRequestV2(
        new DidCommInboundMessageContext(mediateRequest, { agentContext, senderDid: 'did:example:sender' })
      )
      expect(connectionService.findByTheirDidOrSender).toHaveBeenCalledWith(agentContext, {
        theirDid: 'did:example:sender',
        senderKey: undefined,
      })
    })
  })

  describe('createGrantMediationMessageV2', () => {
    test('returns DidCommMediateGrantV2Message with routing_did', async () => {
      const mediationRecord = new DidCommMediationRecord({
        connectionId: 'connectionId',
        role: DidCommMediationRole.Mediator,
        state: DidCommMediationState.Requested,
        threadId: 'threadId',
        protocolVersion: 'v2',
      })

      mockFunction(mediationRepository.update).mockResolvedValue(undefined)

      const { message } = await mediatorService.createGrantMediationMessageV2(agentContext, mediationRecord)

      expect(message.routingDid).toBe(mediatorModuleConfig.mediatorRoutingDid)
      expect(message.threadId).toBe('threadId')
    })

    const generatedRoutingDidContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [DidCommModuleConfig, new DidCommModuleConfig({ endpoints: ['wss://mediator.example'] })],
        [DidCommMediatorModuleConfig, new DidCommMediatorModuleConfig()],
      ],
    })
    const requestedMediationRecord = () =>
      new DidCommMediationRecord({
        connectionId: 'connectionId',
        role: DidCommMediationRole.Mediator,
        state: DidCommMediationState.Requested,
        threadId: 'threadId',
        protocolVersion: 'v2',
      })

    test('publishes the DIDCommMessaging endpoint of a generated routing DID as an object', async () => {
      mockFunction(mediatorRoutingRepository.findById).mockResolvedValue(
        new DidCommMediatorRoutingRecord({ routingKeys: [ed25519RoutingKey, x25519RoutingKey] })
      )

      const { message } = await mediatorService.createGrantMediationMessageV2(
        generatedRoutingDidContext,
        requestedMediationRecord()
      )

      const [service] = didToNumAlgo2DidDocument(message.routingDid).service ?? []
      expect(service.type).toBe('DIDCommMessaging')
      expect(service.serviceEndpoint).toMatchObject({ uri: 'wss://mediator.example' })
    })

    test('publishes the X25519 routing key of the record as the keyAgreement key of the routing DID', async () => {
      mockFunction(mediatorRoutingRepository.findById).mockResolvedValue(
        new DidCommMediatorRoutingRecord({ routingKeys: [ed25519RoutingKey, x25519RoutingKey] })
      )

      const { message } = await mediatorService.createGrantMediationMessageV2(
        generatedRoutingDidContext,
        requestedMediationRecord()
      )

      // did:peer:2 encodes a keyAgreement key as .E<multibase key> and an authentication key as .V<multibase key>
      expect(message.routingDid).toContain(`.E${x25519RoutingKey.routingKeyFingerprint}`)
      expect(message.routingDid).toContain(`.V${ed25519RoutingKey.routingKeyFingerprint}`)
    })

    test('fails to grant mediation v2 when the routing record has no X25519 routing key', async () => {
      mockFunction(mediatorRoutingRepository.findById).mockResolvedValue(
        new DidCommMediatorRoutingRecord({ routingKeys: [ed25519RoutingKey] })
      )

      await expect(
        mediatorService.createGrantMediationMessageV2(generatedRoutingDidContext, requestedMediationRecord())
      ).rejects.toThrow('no X25519 routing key')
    })
  })

  describe('addV2RoutingKeyIfMissing', () => {
    const v2AgentContext = getAgentContext({
      agentConfig,
      registerInstances: [[DidCommModuleConfig, new DidCommModuleConfig({ didcommVersions: ['v1', 'v2'] })]],
    })
    const kms = v2AgentContext.resolve(Kms.KeyManagementApi)
    const routingRecord = (...routingKeys: DidCommMediatorRoutingRecordRoutingKey[]): DidCommMediatorRoutingRecord =>
      new DidCommMediatorRoutingRecord({ id: 'MEDIATOR_ROUTING_RECORD', routingKeys })
    const x25519KeyIds = (record: DidCommMediatorRoutingRecord): string[] =>
      record.routingKeysWithKeyId.filter((routingKey) => routingKey.is(Kms.X25519PublicJwk)).map(({ keyId }) => keyId)

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('two instances that upgrade at once without a lock end with one X25519 routing key that both use', async () => {
      const storageService = new InMemoryStorageService<DidCommMediatorRoutingRecord>()
      storageService.createRecordsForContext(v2AgentContext)
      const { repository, service } = await createServiceWithStorage(storageService)
      await repository.save(v2AgentContext, routingRecord(ed25519RoutingKey))
      const startupRecords = await Promise.all(
        [1, 2].map(() => repository.getById(v2AgentContext, 'MEDIATOR_ROUTING_RECORD'))
      )

      const upgradedRecords = await Promise.all(
        startupRecords.map((startupRecord) => service.addV2RoutingKeyIfMissing(v2AgentContext, startupRecord))
      )

      const storedKeyIds = x25519KeyIds(await repository.getById(v2AgentContext, 'MEDIATOR_ROUTING_RECORD'))
      expect(storedKeyIds).toHaveLength(1)
      expect(upgradedRecords.map(x25519KeyIds)).toEqual([storedKeyIds, storedKeyIds])
    })

    test('does not write the record if another instance already stored an X25519 routing key', async () => {
      const storageService = new InMemoryStorageService<DidCommMediatorRoutingRecord>()
      storageService.createRecordsForContext(v2AgentContext)
      const { repository, service } = await createServiceWithStorage(storageService)
      await repository.save(v2AgentContext, routingRecord(ed25519RoutingKey, x25519RoutingKey))
      const update = vi.spyOn(storageService, 'update')

      const upgradedRecord = await service.addV2RoutingKeyIfMissing(v2AgentContext, routingRecord(ed25519RoutingKey))

      expect(update).not.toHaveBeenCalled()
      expect(x25519KeyIds(upgradedRecord)).toEqual([x25519RoutingKey.kmsKeyId])
    })

    test('deletes its own X25519 key and uses the stored record if another instance wrote after it', async () => {
      const recordInCallback = routingRecord(ed25519RoutingKey)
      const storedRecord = routingRecord(ed25519RoutingKey, x25519RoutingKey)
      mockFunction(mediatorRoutingRepository.updateByIdWithLock).mockImplementationOnce(
        async (_agentContext, _id, callback) => callback(recordInCallback)
      )
      mockFunction(mediatorRoutingRepository.getById).mockResolvedValueOnce(storedRecord)

      await expect(
        mediatorService.addV2RoutingKeyIfMissing(v2AgentContext, routingRecord(ed25519RoutingKey))
      ).resolves.toBe(storedRecord)

      const [ownKeyId] = x25519KeyIds(recordInCallback)
      await expect(kms.getPublicKey({ keyId: ownKeyId })).rejects.toThrow(Kms.KeyManagementKeyNotFoundError)
    })

    test('keeps the first X25519 key and warns if the stored record holds more than one', async () => {
      const warn = vi.spyOn(agentConfig.logger, 'warn')
      const recordInCallback = routingRecord(ed25519RoutingKey)
      mockFunction(mediatorRoutingRepository.updateByIdWithLock).mockImplementationOnce(
        async (_agentContext, _id, callback) => callback(recordInCallback)
      )
      mockFunction(mediatorRoutingRepository.getById).mockImplementationOnce(async () => {
        const storedRecord = recordInCallback.clone()
        storedRecord.routingKeys.splice(1, 0, x25519RoutingKey)
        return storedRecord
      })

      const upgradedRecord = await mediatorService.addV2RoutingKeyIfMissing(
        v2AgentContext,
        routingRecord(ed25519RoutingKey)
      )

      const [ownKeyId] = x25519KeyIds(recordInCallback)
      expect(x25519KeyIds(upgradedRecord)).toEqual([x25519RoutingKey.kmsKeyId, ownKeyId])
      await expect(kms.getPublicKey({ keyId: ownKeyId })).resolves.toBeDefined()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('more than one X25519 routing key'))
    })
  })

  describe('findMediatorRoutingRecord', () => {
    test('reads the routing record from storage when the cache is enabled', async () => {
      const storageService = new InMemoryStorageService<DidCommMediatorRoutingRecord>()
      const cachedAgentContext = getAgentContext({
        agentConfig,
        registerInstances: [
          [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 10 }) })],
          [CachedStorageService, new CachedStorageService(storageService)],
        ],
      })
      storageService.createRecordsForContext(cachedAgentContext)
      const { repository, service } = await createServiceWithStorage(storageService)
      const id = 'MEDIATOR_ROUTING_RECORD'
      await repository.save(
        cachedAgentContext,
        new DidCommMediatorRoutingRecord({ id, routingKeys: [ed25519RoutingKey] })
      )
      await storageService.update(
        cachedAgentContext,
        new DidCommMediatorRoutingRecord({ id, routingKeys: [ed25519RoutingKey, x25519RoutingKey] })
      )

      const routingRecord = await service.findMediatorRoutingRecord(cachedAgentContext)

      expect(routingRecord?.routingKeys).toEqual([ed25519RoutingKey, x25519RoutingKey])
    })
  })

  describe('processKeylistUpdateV2', () => {
    test('adds and removes recipient DIDs', async () => {
      const mediationRecord = new DidCommMediationRecord({
        connectionId: 'connectionId',
        role: DidCommMediationRole.Mediator,
        state: DidCommMediationState.Granted,
        threadId: 'threadId',
        protocolVersion: 'v2',
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)
      mockFunction(mediationRepository.update).mockResolvedValue(undefined)

      const keylistUpdate = new DidCommKeylistUpdateV2Message({
        updates: [
          { recipientDid: 'did:peer:2.abc', action: KeylistUpdateActionV2.add },
          { recipientDid: 'did:peer:2.xyz', action: KeylistUpdateActionV2.remove },
        ],
      })
      keylistUpdate.setThread({ threadId: 'threadId' })

      const messageContext = new DidCommInboundMessageContext(keylistUpdate, {
        connection: mockConnection,
        agentContext,
      })
      const response = await mediatorService.processKeylistUpdateV2(messageContext)

      expect(mediationRecord.recipientDids).toContain('did:peer:2.abc')
      expect(response.updated).toHaveLength(2)
      expect(response.updated[0].recipientDid).toBe('did:peer:2.abc')
      expect(response.updated[0].action).toBe(KeylistUpdateActionV2.add)
      expect(response.updated[1].recipientDid).toBe('did:peer:2.xyz')
    })
  })

  describe('processKeylistQueryV2', () => {
    test('returns DidCommKeylistV2Message with recipient DIDs', async () => {
      const mediationRecord = new DidCommMediationRecord({
        connectionId: 'connectionId',
        role: DidCommMediationRole.Mediator,
        state: DidCommMediationState.Granted,
        threadId: 'threadId',
        protocolVersion: 'v2',
        recipientDids: ['did:peer:2.abc', 'did:peer:2.xyz'],
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const keylistQuery = new DidCommKeylistQueryV2Message({})
      keylistQuery.setThread({ threadId: 'threadId' })

      const messageContext = new DidCommInboundMessageContext(keylistQuery, {
        connection: mockConnection,
        agentContext,
      })
      const response = await mediatorService.processKeylistQueryV2(messageContext)

      expect(response.keys).toHaveLength(2)
      expect(response.keys.map((k) => k.recipientDid)).toEqual(['did:peer:2.abc', 'did:peer:2.xyz'])
    })
  })

  describe('processForwardMessage (v2)', () => {
    test('looks up mediation record by DID only, never by verkey', async () => {
      mockFunction(mediationRepository.findSingleByRecipientKey).mockClear()
      mockFunction(mediationRepository.findSingleByRecipientDid).mockResolvedValue(null)

      const recipientDid = 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc'
      const forward = new DidCommForwardV2Message({
        to: [mediatorModuleConfig.mediatorRoutingDid as string],
        next: recipientDid,
      })
      forward.appendedAttachments = [
        new DidCommAttachment({ id: 'msg-1', data: { json: { ciphertext: '', iv: '', protected: '', tag: '' } } }),
      ]

      const messageContext = new DidCommInboundMessageContext(forward, {
        connection: mockConnection,
        agentContext,
      })

      await expect(mediatorService.processForwardMessage(messageContext)).rejects.toThrow(RecordNotFoundError)

      expect(mediationRepository.findSingleByRecipientKey).not.toHaveBeenCalled()
      expect(mediationRepository.findSingleByRecipientDid).toHaveBeenCalledWith(agentContext, recipientDid)
    })
  })
})

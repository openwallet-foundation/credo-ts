import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../../../tests/types'
import type { AgentContext } from '../../../../../core/src/agent'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { Kms, TypedArrayEncoder } from '../../../../../core/src/index'
import { DidDocumentRole } from '../../../../../core/src/modules/dids/domain/DidDocumentRole'
import { DidRecord, DidRepository } from '../../../../../core/src/modules/dids/repository'
import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../core/tests/helpers'
import { DidCommMessage } from '../../../DidCommMessage'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import type { DidCommRouting } from '../../../models'
import { DidCommInboundMessageContext } from '../../../models'
import { DidCommOutOfBandService } from '../../oob/DidCommOutOfBandService'
import { DidCommOutOfBandRepository } from '../../oob/repository/DidCommOutOfBandRepository'
import { DidCommTrustPingMessage } from '../messages'
import { DidCommDidExchangeState } from '../models'
import { DidCommConnectionRepository } from '../repository'
import { DidCommConnectionService } from '../services'

vi.mock('../repository/DidCommConnectionRepository')
vi.mock('../../oob/repository/DidCommOutOfBandRepository')
vi.mock('../../oob/DidCommOutOfBandService')
vi.mock('../../../../../core/src/modules/dids/repository/DidRepository')
const ConnectionRepositoryMock = DidCommConnectionRepository as MockedClassConstructor<
  typeof DidCommConnectionRepository
>
const OutOfBandRepositoryMock = DidCommOutOfBandRepository as MockedClassConstructor<typeof DidCommOutOfBandRepository>
const OutOfBandServiceMock = DidCommOutOfBandService as MockedClassConstructor<typeof DidCommOutOfBandService>
const DidRepositoryMock = DidRepository as MockedClassConstructor<typeof DidRepository>

const _connectionImageUrl = 'https://example.com/image.png'

const endpoint = 'http://agent.com:8080'
const agentConfig = getAgentConfig('ConnectionServiceTest', {
  endpoints: [endpoint],
})

const outOfBandRepository = new OutOfBandRepositoryMock()
const outOfBandService = new OutOfBandServiceMock()
const didRepository = new DidRepositoryMock()

describe('DidCommConnectionService', () => {
  let connectionRepository: DidCommConnectionRepository

  let connectionService: DidCommConnectionService
  let eventEmitter: EventEmitter
  let _myRouting: DidCommRouting
  let agentContext: AgentContext
  let _kms: Kms.KeyManagementApi

  beforeAll(async () => {
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [DidCommOutOfBandRepository, outOfBandRepository],
        [DidCommOutOfBandService, outOfBandService],
        [DidRepository, didRepository],
        [DidCommModuleConfig, new DidCommModuleConfig({ endpoints: [endpoint] })],
      ],
    })
    _kms = agentContext.resolve(Kms.KeyManagementApi)
  })

  beforeEach(async () => {
    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    connectionRepository = new ConnectionRepositoryMock()
    connectionService = new DidCommConnectionService(
      agentConfig.logger,
      connectionRepository,
      didRepository,
      eventEmitter
    )

    const recipientKey = Kms.PublicJwk.fromFingerprint(
      'z6MkwFkSP4uv5PhhKJCGehtjuZedkotC7VF64xtMsxuM8R3W'
    ) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
    recipientKey.keyId = 'something-random'

    _myRouting = {
      recipientKey,
      endpoints: [endpoint],
      routingKeys: [],
      mediatorId: 'fakeMediatorId',
    }

    mockFunction(didRepository.getById).mockResolvedValue(
      new DidRecord({
        did: 'did:peer:123',
        role: DidDocumentRole.Created,
      })
    )
    mockFunction(didRepository.findByQuery).mockResolvedValue([])
  })

  afterEach(() => {
    vitest.clearAllMocks()
  })

  describe('createTrustPing', () => {
    it('returns a trust ping message', async () => {
      expect.assertions(2)

      const mockConnection = getMockConnection({ state: DidCommDidExchangeState.ResponseReceived })

      const { message, connectionRecord } = await connectionService.createTrustPing(agentContext, mockConnection)

      expect(connectionRecord.state).toBe(DidCommDidExchangeState.Completed)
      expect(message).toEqual(expect.any(DidCommTrustPingMessage))
    })

    const invalidConnectionStates = [
      DidCommDidExchangeState.InvitationSent,
      DidCommDidExchangeState.InvitationReceived,
      DidCommDidExchangeState.RequestSent,
      DidCommDidExchangeState.RequestReceived,
      DidCommDidExchangeState.ResponseSent,
      DidCommDidExchangeState.Abandoned,
      DidCommDidExchangeState.Start,
    ]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${DidCommDidExchangeState.ResponseReceived} or ${DidCommDidExchangeState.Completed}`,
      (state) => {
        expect.assertions(1)
        const connection = getMockConnection({ state })

        return expect(connectionService.createTrustPing(agentContext, connection)).rejects.toThrow(
          `Connection record is in invalid state ${state}. Valid states are: ${DidCommDidExchangeState.ResponseReceived}, ${DidCommDidExchangeState.Completed}.`
        )
      }
    )
  })

  describe('assertConnectionOrOutOfBandExchange', () => {
    it('should throw an error when a expectedConnectionId is present, but no connection is present in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new DidCommInboundMessageContext(new DidCommMessage(), {
        agentContext,
      })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          expectedConnectionId: '123',
        })
      ).rejects.toThrow('Expected incoming message to be from connection 123 but no connection found.')
    })

    it('should throw an error when a expectedConnectionId is present, but does not match with connection id present in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new DidCommInboundMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidCommDidExchangeState.InvitationReceived, id: 'something' }),
      })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          expectedConnectionId: 'something-else',
        })
      ).rejects.toThrow('Expected incoming message to be from connection something-else but connection is something.')
    })

    it('should not throw an error when a connection record with state complete is present in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new DidCommInboundMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidCommDidExchangeState.Completed }),
      })

      await expect(connectionService.assertConnectionOrOutOfBandExchange(messageContext)).resolves.not.toThrow()
    })

    it('should throw an error when a connection record is present and state not complete in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new DidCommInboundMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidCommDidExchangeState.InvitationReceived }),
      })

      await expect(connectionService.assertConnectionOrOutOfBandExchange(messageContext)).rejects.toThrow(
        'Connection record is not ready to be used'
      )
    })

    it('should not throw an error when no connection record is present in the messageContext and no additional data, but the message has a ~service decorator', async () => {
      expect.assertions(1)

      mockFunction(outOfBandRepository.findSingleByQuery).mockResolvedValue(null)

      const message = new DidCommMessage()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new DidCommInboundMessageContext(message, { agentContext })

      await expect(connectionService.assertConnectionOrOutOfBandExchange(messageContext)).resolves.not.toThrow()
    })

    it('should not throw when a fully valid connection-less input is passed', async () => {
      expect.assertions(1)

      const recipientKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
      })
      const senderKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
      })

      const lastSentMessage = new DidCommMessage()
      lastSentMessage.setService({
        recipientKeys: [TypedArrayEncoder.toBase58(recipientKey.publicKey.publicKey)],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const lastReceivedMessage = new DidCommMessage()
      lastReceivedMessage.setService({
        recipientKeys: [TypedArrayEncoder.toBase58(senderKey.publicKey.publicKey)],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      message.setService({
        recipientKeys: [TypedArrayEncoder.toBase58(senderKey.publicKey.publicKey)],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new DidCommInboundMessageContext(message, { agentContext, recipientKey, senderKey })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastReceivedMessage,
          lastSentMessage,
        })
      ).resolves.not.toThrow()
    })

    it('should throw an error when lastSentMessage is present, but recipientVerkey is not ', async () => {
      expect.assertions(1)

      const lastSentMessage = new DidCommMessage()
      lastSentMessage.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new DidCommInboundMessageContext(message, { agentContext })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastSentMessage,
        })
      ).rejects.toThrow(
        'Incoming message must have recipientKey and senderKey (so cannot be AuthCrypt or unpacked) if there are lastSentMessage or lastReceivedMessage.'
      )
    })

    it('should throw an error when lastSentMessage and recipientKey are present, but recipient key is not present in recipientKeys of previously sent message ~service decorator', async () => {
      expect.assertions(1)

      const recipientKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
      })
      const senderKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
      })

      const lastSentMessage = new DidCommMessage()
      lastSentMessage.setService({
        recipientKeys: ['anotherKey'],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new DidCommInboundMessageContext(message, { agentContext, recipientKey, senderKey })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastSentMessage,
        })
      ).rejects.toThrow('Recipient key z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th not found in our service')
    })

    it('should throw an error when lastReceivedMessage is present, but senderVerkey is not ', async () => {
      expect.assertions(1)

      const lastReceivedMessage = new DidCommMessage()
      lastReceivedMessage.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      const messageContext = new DidCommInboundMessageContext(message, { agentContext })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastReceivedMessage,
        })
      ).rejects.toThrow(
        'No keys on our side to use for encrypting messages, and previous messages found (in which case our keys MUST also be present).'
      )
    })

    it('should throw an error when lastReceivedMessage and senderKey are present, but sender key is not present in recipientKeys of previously received message ~service decorator', async () => {
      expect.assertions(1)

      const senderKey = 'senderKey'

      const lastReceivedMessage = new DidCommMessage()
      lastReceivedMessage.setService({
        recipientKeys: ['anotherKey'],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const lastSentMessage = new DidCommMessage()
      lastSentMessage.setService({
        recipientKeys: [senderKey],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      const messageContext = new DidCommInboundMessageContext(message, {
        agentContext,
        senderKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('randomKey'),
        }),
        recipientKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58(senderKey),
        }),
      })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastReceivedMessage,
          lastSentMessage,
        })
      ).rejects.toThrow('Sender key z41yMxWDBqGD2Z not found in their service.')
    })
  })

  describe('repository methods', () => {
    it('getById should return value from connectionRepository.getById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getById(agentContext, expected.id)
      expect(connectionRepository.getById).toHaveBeenCalledWith(agentContext, expected.id)

      expect(result).toBe(expected)
    })

    it('getByThreadId should return value from connectionRepository.getSingleByQuery', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getByThreadId).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getByThreadId(agentContext, 'threadId')
      expect(connectionRepository.getByThreadId).toHaveBeenCalledWith(agentContext, 'threadId')

      expect(result).toBe(expected)
    })

    it('findById should return value from connectionRepository.findById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.findById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findById(agentContext, expected.id)
      expect(connectionRepository.findById).toHaveBeenCalledWith(agentContext, expected.id)

      expect(result).toBe(expected)
    })

    it('getAll should return value from connectionRepository.getAll', async () => {
      const expected = [getMockConnection(), getMockConnection()]

      mockFunction(connectionRepository.getAll).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getAll(agentContext)
      expect(connectionRepository.getAll).toHaveBeenCalledWith(agentContext)

      expect(result).toEqual(expect.arrayContaining(expected))
    })

    it('findAllByQuery should return value from connectionRepository.findByQuery', async () => {
      const expected = [getMockConnection(), getMockConnection()]

      mockFunction(connectionRepository.findByQuery).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findAllByQuery(
        agentContext,
        {
          state: DidCommDidExchangeState.InvitationReceived,
        },
        undefined
      )
      expect(connectionRepository.findByQuery).toHaveBeenCalledWith(
        agentContext,
        {
          state: DidCommDidExchangeState.InvitationReceived,
        },
        undefined
      )

      expect(result).toEqual(expect.arrayContaining(expected))
    })
  })

  describe('connectionType', () => {
    it('addConnectionType', async () => {
      const connection = getMockConnection()

      await connectionService.addConnectionType(agentContext, connection, 'type-1')
      let connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes).toMatchObject(['type-1'])

      await connectionService.addConnectionType(agentContext, connection, 'type-2')
      await connectionService.addConnectionType(agentContext, connection, 'type-3')

      connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes.sort()).toMatchObject(['type-1', 'type-2', 'type-3'].sort())
    })

    it('removeConnectionType - existing type', async () => {
      const connection = getMockConnection()
      connection.connectionTypes = ['type-1', 'type-2', 'type-3']
      let connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes.sort()).toMatchObject(['type-1', 'type-2', 'type-3'].sort())

      await connectionService.removeConnectionType(agentContext, connection, 'type-2')
      connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes.sort()).toMatchObject(['type-1', 'type-3'].sort())
    })

    it('removeConnectionType - type not existent', async () => {
      const connection = getMockConnection()
      connection.connectionTypes = ['type-1', 'type-2', 'type-3']
      let connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes).toMatchObject(['type-1', 'type-2', 'type-3'])

      await connectionService.removeConnectionType(agentContext, connection, 'type-4')
      connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes.sort()).toMatchObject(['type-1', 'type-2', 'type-3'].sort())
    })

    it('removeConnectionType - no previous types', async () => {
      const connection = getMockConnection()

      let connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes).toMatchObject([])

      await connectionService.removeConnectionType(agentContext, connection, 'type-4')
      connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes).toMatchObject([])
    })
  })
})

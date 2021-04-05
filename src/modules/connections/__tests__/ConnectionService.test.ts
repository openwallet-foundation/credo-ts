import indy from 'indy-sdk'
import { v4 as uuid } from 'uuid'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { Wallet } from '../../../wallet/Wallet'
import { ConnectionService } from '../services/ConnectionService'
import { ConnectionRecord, ConnectionStorageProps } from '../repository/ConnectionRecord'
import { AgentConfig } from '../../../agent/AgentConfig'
import { Connection, ConnectionState, ConnectionRole, DidDoc, IndyAgentService } from '../models'
import { InitConfig } from '../../../types'
import {
  ConnectionInvitationMessage,
  ConnectionRequestMessage,
  ConnectionResponseMessage,
  TrustPingMessage,
} from '../messages'
import { AckMessage, AckStatus } from '../../common'
import { Repository } from '../../../storage/Repository'
import { signData, unpackAndVerifySignatureDecorator } from '../../../decorators/signature/SignatureDecoratorUtils'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { SignatureDecorator } from '../../../decorators/signature/SignatureDecorator'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import testLogger from '../../../__tests__/logger'

jest.mock('./../../../storage/Repository')
const ConnectionRepository = <jest.Mock<Repository<ConnectionRecord>>>(<unknown>Repository)

export function getMockConnection({
  state = ConnectionState.Invited,
  role = ConnectionRole.Invitee,
  id = 'test',
  did = 'test-did',
  verkey = 'key-1',
  didDoc = new DidDoc({
    id: did,
    publicKey: [],
    authentication: [],
    service: [
      new IndyAgentService({
        id: `${did};indy`,
        serviceEndpoint: 'https://endpoint.com',
        recipientKeys: [verkey],
      }),
    ],
  }),
  tags = {},
  invitation = new ConnectionInvitationMessage({
    label: 'test',
    recipientKeys: [verkey],
    serviceEndpoint: 'https:endpoint.com/msg',
  }),
  theirDid = 'their-did',
  theirDidDoc = new DidDoc({
    id: theirDid,
    publicKey: [],
    authentication: [],
    service: [
      new IndyAgentService({
        id: `${did};indy`,
        serviceEndpoint: 'https://endpoint.com',
        recipientKeys: [verkey],
      }),
    ],
  }),
}: Partial<ConnectionStorageProps> = {}) {
  return new ConnectionRecord({
    did,
    didDoc,
    theirDid,
    theirDidDoc,
    id,
    role,
    state,
    tags,
    verkey,
    invitation,
  })
}

describe('ConnectionService', () => {
  const walletConfig = { id: 'test-wallet' + '-ConnectionServiceTest' }
  const walletCredentials = { key: 'key' }
  const initConfig: InitConfig = {
    label: 'agent label',
    host: 'http://agent.com',
    port: 8080,
    walletConfig,
    walletCredentials,
    indy,
    logger: testLogger,
  }

  let wallet: Wallet
  let agentConfig: AgentConfig
  let connectionRepository: Repository<ConnectionRecord>
  let connectionService: ConnectionService

  beforeAll(async () => {
    agentConfig = new AgentConfig(initConfig)
    wallet = new IndyWallet(agentConfig)
    await wallet.init()
  })

  afterAll(async () => {
    await wallet.close()
    await wallet.delete()
  })

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    ConnectionRepository.mockClear()

    connectionRepository = new ConnectionRepository()
    connectionService = new ConnectionService(wallet, agentConfig, connectionRepository)
  })

  describe('createConnectionWithInvitation', () => {
    it('returns a connection record with values set', async () => {
      expect.assertions(6)

      const { connectionRecord: connectionRecord } = await connectionService.createInvitation()

      expect(connectionRecord.role).toBe(ConnectionRole.Inviter)
      expect(connectionRecord.state).toBe(ConnectionState.Invited)
      expect(connectionRecord.autoAcceptConnection).toBeUndefined()
      expect(connectionRecord.id).toEqual(expect.any(String))
      expect(connectionRecord.verkey).toEqual(expect.any(String))
      expect(connectionRecord.tags).toEqual(
        expect.objectContaining({
          verkey: connectionRecord.verkey,
        })
      )
    })

    it('returns a connection record with invitation', async () => {
      expect.assertions(1)

      const { message: invitation } = await connectionService.createInvitation()

      expect(invitation).toEqual(
        expect.objectContaining({
          label: initConfig.label,
          recipientKeys: [expect.any(String)],
          routingKeys: [],
          serviceEndpoint: `${initConfig.host}:${initConfig.port}/msg`,
        })
      )
    })

    it('saves the connection record in the connection repository', async () => {
      expect.assertions(1)

      const saveSpy = jest.spyOn(connectionRepository, 'save')

      await connectionService.createInvitation()

      expect(saveSpy).toHaveBeenCalledWith(expect.any(ConnectionRecord))
    })

    it('returns a connection record with the autoAcceptConnection parameter from the config', async () => {
      expect.assertions(3)

      const { connectionRecord: connectionTrue } = await connectionService.createInvitation({
        autoAcceptConnection: true,
      })
      const { connectionRecord: connectionFalse } = await connectionService.createInvitation({
        autoAcceptConnection: false,
      })
      const { connectionRecord: connectionUndefined } = await connectionService.createInvitation()

      expect(connectionTrue.autoAcceptConnection).toBe(true)
      expect(connectionFalse.autoAcceptConnection).toBe(false)
      expect(connectionUndefined.autoAcceptConnection).toBeUndefined()
    })

    it('returns a connection record with the alias parameter from the config', async () => {
      expect.assertions(2)

      const { connectionRecord: aliasDefined } = await connectionService.createInvitation({ alias: 'test-alias' })
      const { connectionRecord: aliasUndefined } = await connectionService.createInvitation()

      expect(aliasDefined.alias).toBe('test-alias')
      expect(aliasUndefined.alias).toBeUndefined()
    })
  })

  describe('processInvitation', () => {
    it('returns a connection record containing the information from the connection invitation', async () => {
      expect.assertions(9)

      const recipientKey = 'key-1'
      const invitation = new ConnectionInvitationMessage({
        label: 'test label',
        recipientKeys: [recipientKey],
        serviceEndpoint: 'https://test.com/msg',
      })

      const connection = await connectionService.processInvitation(invitation)
      const connectionAlias = await connectionService.processInvitation(invitation, { alias: 'test-alias' })

      expect(connection.role).toBe(ConnectionRole.Invitee)
      expect(connection.state).toBe(ConnectionState.Invited)
      expect(connection.autoAcceptConnection).toBeUndefined()
      expect(connection.id).toEqual(expect.any(String))
      expect(connection.verkey).toEqual(expect.any(String))
      expect(connection.tags).toEqual(
        expect.objectContaining({
          verkey: connection.verkey,
          invitationKey: recipientKey,
        })
      )
      expect(connection.invitation).toMatchObject(invitation)
      expect(connection.alias).toBeUndefined()
      expect(connectionAlias.alias).toBe('test-alias')
    })

    it('returns a connection record with the autoAcceptConnection parameter from the config', async () => {
      expect.assertions(3)

      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test',
        label: 'test label',
      })

      const connectionTrue = await connectionService.processInvitation(invitation, { autoAcceptConnection: true })
      const connectionFalse = await connectionService.processInvitation(invitation, {
        autoAcceptConnection: false,
      })
      const connectionUndefined = await connectionService.processInvitation(invitation)

      expect(connectionTrue.autoAcceptConnection).toBe(true)
      expect(connectionFalse.autoAcceptConnection).toBe(false)
      expect(connectionUndefined.autoAcceptConnection).toBeUndefined()
    })

    it('returns a connection record with the alias parameter from the config', async () => {
      expect.assertions(2)

      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test',
        label: 'test label',
      })

      const aliasDefined = await connectionService.processInvitation(invitation, { alias: 'test-alias' })
      const aliasUndefined = await connectionService.processInvitation(invitation)

      expect(aliasDefined.alias).toBe('test-alias')
      expect(aliasUndefined.alias).toBeUndefined()
    })
  })

  describe('createRequest', () => {
    it('returns a connection request message containing the information from the connection record', async () => {
      expect.assertions(4)

      const connection = getMockConnection()

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>
      mockFind.mockReturnValue(Promise.resolve(connection))

      const { connectionRecord: connectionRecord, message } = await connectionService.createRequest('test')

      expect(connectionRecord.state).toBe(ConnectionState.Requested)
      expect(message.label).toBe(initConfig.label)
      expect(message.connection.did).toBe('test-did')
      expect(message.connection.didDoc).toEqual(connection.didDoc)
    })

    it(`throws an error when connection role is ${ConnectionRole.Inviter} and not ${ConnectionRole.Invitee}`, async () => {
      expect.assertions(1)

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>

      mockFind.mockReturnValue(Promise.resolve(getMockConnection({ role: ConnectionRole.Inviter })))
      return expect(connectionService.createRequest('test')).rejects.toThrowError(
        `Connection record has invalid role ${ConnectionRole.Inviter}. Expected role ${ConnectionRole.Invitee}.`
      )
    })

    const invalidConnectionStates = [
      ConnectionState.Init,
      ConnectionState.Requested,
      ConnectionState.Responded,
      ConnectionState.Complete,
    ]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${ConnectionState.Invited}`,
      (state) => {
        expect.assertions(1)

        // make separate mockFind variable to get the correct jest mock typing
        const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>

        mockFind.mockReturnValue(Promise.resolve(getMockConnection({ state })))
        return expect(connectionService.createRequest('test')).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${ConnectionState.Invited}.`
        )
      }
    )
  })

  describe('processRequest', () => {
    it('returns a connection record containing the information from the connection request', async () => {
      expect.assertions(5)

      const connectionRecord = getMockConnection({
        state: ConnectionState.Invited,
        verkey: 'my-key',
        role: ConnectionRole.Inviter,
      })

      const theirDid = 'their-did'
      const theirVerkey = 'their-verkey'
      const theirDidDoc = new DidDoc({
        id: theirDid,
        publicKey: [],
        authentication: [],
        service: [
          new IndyAgentService({
            id: `${theirDid};indy`,
            serviceEndpoint: 'https://endpoint.com',
            recipientKeys: [theirVerkey],
          }),
        ],
      })

      const connectionRequest = new ConnectionRequestMessage({
        did: theirDid,
        didDoc: theirDidDoc,
        label: 'test-label',
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        connection: connectionRecord,
        senderVerkey: theirVerkey,
        recipientVerkey: 'my-key',
      })

      const processedConnection = await connectionService.processRequest(messageContext)

      expect(processedConnection.state).toBe(ConnectionState.Requested)
      expect(processedConnection.theirDid).toBe(theirDid)
      // TODO: we should transform theirDidDoc to didDoc instance after retrieving from persistence
      expect(processedConnection.theirDidDoc).toEqual(theirDidDoc)
      expect(processedConnection.tags.theirKey).toBe(theirVerkey)
      expect(processedConnection.tags.threadId).toBe(connectionRequest.id)
    })

    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1)

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        recipientVerkey: 'test-verkey',
      })

      return expect(connectionService.processRequest(messageContext)).rejects.toThrowError(
        'Connection for verkey test-verkey not found!'
      )
    })

    it('throws an error when the message does not contain a connection parameter', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        role: ConnectionRole.Inviter,
      })

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      })

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete connectionRequest.connection

      const messageContext = new InboundMessageContext(connectionRequest, {
        connection,
        recipientVerkey: 'test-verkey',
      })

      return expect(connectionService.processRequest(messageContext)).rejects.toThrowError('Invalid message')
    })

    it(`throws an error when connection role is ${ConnectionRole.Invitee} and not ${ConnectionRole.Inviter}`, async () => {
      expect.assertions(1)

      const inboundMessage = new InboundMessageContext(jest.fn()(), {
        connection: getMockConnection({ role: ConnectionRole.Invitee }),
      })

      return expect(connectionService.processRequest(inboundMessage)).rejects.toThrowError(
        `Connection record has invalid role ${ConnectionRole.Invitee}. Expected role ${ConnectionRole.Inviter}.`
      )
    })

    it('throws an error when the message does not contain a did doc with any recipientKeys', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        role: ConnectionRole.Inviter,
      })

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        connection,
        recipientVerkey: 'test-verkey',
      })

      return expect(connectionService.processRequest(messageContext)).rejects.toThrowError(
        `Connection with id ${connection.id} has no recipient keys.`
      )
    })
  })

  describe('createResponse', () => {
    it('returns a connection response message containing the information from the connection record', async () => {
      expect.assertions(2)

      // Needed for signing connection~sig
      const [did, verkey] = await wallet.createDid()
      const mockConnection = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
        role: ConnectionRole.Inviter,
      })

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>
      mockFind.mockReturnValue(Promise.resolve(mockConnection))

      const { message, connectionRecord: connectionRecord } = await connectionService.createResponse('test')

      const connection = new Connection({
        did: mockConnection.did,
        didDoc: mockConnection.didDoc,
      })
      const plainConnection = JsonTransformer.toJSON(connection)

      expect(connectionRecord.state).toBe(ConnectionState.Responded)
      expect(await unpackAndVerifySignatureDecorator(message.connectionSig, wallet)).toEqual(plainConnection)
    })

    it(`throws an error when connection role is ${ConnectionRole.Invitee} and not ${ConnectionRole.Inviter}`, async () => {
      expect.assertions(1)

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>

      mockFind.mockReturnValue(
        Promise.resolve(
          getMockConnection({
            role: ConnectionRole.Invitee,
            state: ConnectionState.Requested,
          })
        )
      )
      return expect(connectionService.createResponse('test')).rejects.toThrowError(
        `Connection record has invalid role ${ConnectionRole.Invitee}. Expected role ${ConnectionRole.Inviter}.`
      )
    })

    const invalidConnectionStates = [
      ConnectionState.Init,
      ConnectionState.Invited,
      ConnectionState.Responded,
      ConnectionState.Complete,
    ]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${ConnectionState.Requested}`,
      async (state) => {
        expect.assertions(1)

        // make separate mockFind variable to get the correct jest mock typing
        const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>
        mockFind.mockReturnValue(Promise.resolve(getMockConnection({ state })))

        return expect(connectionService.createResponse('test')).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${ConnectionState.Requested}.`
        )
      }
    )
  })

  describe('processResponse', () => {
    it('returns a connection record containing the information from the connection response', async () => {
      expect.assertions(3)

      const [did, verkey] = await wallet.createDid()
      const [theirDid, theirVerkey] = await wallet.createDid()

      const connectionRecord = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
        role: ConnectionRole.Invitee,
        tags: {
          // processResponse checks wether invitation key is same as signing key for connetion~sig
          invitationKey: theirVerkey,
        },
      })

      const otherPartyConnection = new Connection({
        did: theirDid,
        didDoc: new DidDoc({
          id: theirDid,
          publicKey: [],
          authentication: [],
          service: [
            new IndyAgentService({
              id: `${did};indy`,
              serviceEndpoint: 'https://endpoint.com',
              recipientKeys: [theirVerkey],
            }),
          ],
        }),
      })

      const plainConnection = JsonTransformer.toJSON(otherPartyConnection)
      const connectionSig = await signData(plainConnection, wallet, theirVerkey)

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
        senderVerkey: connectionRecord.theirKey!,
        recipientVerkey: connectionRecord.myKey!,
      })

      const processedConnection = await connectionService.processResponse(messageContext)

      expect(processedConnection.state).toBe(ConnectionState.Responded)
      expect(processedConnection.theirDid).toBe(theirDid)
      // TODO: we should transform theirDidDoc to didDoc instance after retrieving from persistence
      expect(processedConnection.theirDidDoc).toEqual(otherPartyConnection.didDoc)
    })

    it(`throws an error when connection role is ${ConnectionRole.Inviter} and not ${ConnectionRole.Invitee}`, async () => {
      expect.assertions(1)

      const inboundMessage = new InboundMessageContext(jest.fn()(), {
        connection: getMockConnection({
          role: ConnectionRole.Inviter,
          state: ConnectionState.Requested,
        }),
      })

      return expect(connectionService.processResponse(inboundMessage)).rejects.toThrowError(
        `Connection record has invalid role ${ConnectionRole.Inviter}. Expected role ${ConnectionRole.Invitee}.`
      )
    })

    it('throws an error when the connection sig is not signed with the same key as the recipient key from the invitation', async () => {
      expect.assertions(1)

      const [did, verkey] = await wallet.createDid()
      const [theirDid, theirVerkey] = await wallet.createDid()
      const connectionRecord = getMockConnection({
        did,
        verkey,
        role: ConnectionRole.Invitee,
        state: ConnectionState.Requested,
        tags: {
          // processResponse checks wether invitation key is same as signing key for connetion~sig
          invitationKey: 'some-random-key',
        },
      })

      const otherPartyConnection = new Connection({
        did: theirDid,
        didDoc: new DidDoc({
          id: theirDid,
          publicKey: [],
          authentication: [],
          service: [
            new IndyAgentService({
              id: `${did};indy`,
              serviceEndpoint: 'https://endpoint.com',
              recipientKeys: [theirVerkey],
            }),
          ],
        }),
      })
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection)
      const connectionSig = await signData(plainConnection, wallet, theirVerkey)

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
        senderVerkey: connectionRecord.theirKey!,
        recipientVerkey: connectionRecord.myKey!,
      })

      return expect(connectionService.processResponse(messageContext)).rejects.toThrowError(
        'Connection in connection response is not signed with same key as recipient key in invitation'
      )
    })

    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1)

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig: new SignatureDecorator({
          signature: '',
          signatureData: '',
          signatureType: '',
          signer: '',
        }),
      })

      const messageContext = new InboundMessageContext(connectionResponse, {
        recipientVerkey: 'test-verkey',
      })

      return expect(connectionService.processResponse(messageContext)).rejects.toThrowError(
        'Connection for verkey test-verkey not found!'
      )
    })

    it('throws an error when the message does not contain a did doc with any recipientKeys', async () => {
      expect.assertions(1)

      const [did, verkey] = await wallet.createDid()
      const [theirDid, theirVerkey] = await wallet.createDid()
      const connectionRecord = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
        tags: {
          // processResponse checks wether invitation key is same as signing key for connetion~sig
          invitationKey: theirVerkey,
        },
        theirDid: undefined,
        theirDidDoc: undefined,
      })

      const otherPartyConnection = new Connection({
        did: theirDid,
      })
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection)
      const connectionSig = await signData(plainConnection, wallet, theirVerkey)

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
      })

      return expect(connectionService.processResponse(messageContext)).rejects.toThrowError(
        `Connection with id ${connectionRecord.id} has no recipient keys.`
      )
    })
  })

  describe('createTrustPing', () => {
    it('returns a trust ping message', async () => {
      expect.assertions(2)

      const mockConnection = getMockConnection({
        state: ConnectionState.Responded,
      })

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>
      mockFind.mockReturnValue(Promise.resolve(mockConnection))

      const { message, connectionRecord: connectionRecord } = await connectionService.createTrustPing('test')

      expect(connectionRecord.state).toBe(ConnectionState.Complete)
      expect(message).toEqual(expect.any(TrustPingMessage))
    })

    const invalidConnectionStates = [ConnectionState.Init, ConnectionState.Invited, ConnectionState.Requested]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${ConnectionState.Responded} or ${ConnectionState.Complete}`,
      (state) => {
        expect.assertions(1)

        // make separate mockFind variable to get the correct jest mock typing
        const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>

        mockFind.mockReturnValue(Promise.resolve(getMockConnection({ state })))
        return expect(connectionService.createTrustPing('test')).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${ConnectionState.Responded}, ${ConnectionState.Complete}.`
        )
      }
    )
  })

  describe('processAck', () => {
    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1)

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundMessageContext(ack, {
        recipientVerkey: 'test-verkey',
      })

      return expect(connectionService.processAck(messageContext)).rejects.toThrowError(
        'Connection for verkey test-verkey not found!'
      )
    })

    it('updates the state to Completed when the state is Responded and role is Inviter', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        state: ConnectionState.Responded,
        role: ConnectionRole.Inviter,
      })

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundMessageContext(ack, {
        recipientVerkey: 'test-verkey',
        connection,
      })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(ConnectionState.Complete)
    })

    it('does not update the state when the state is not Responded or the role is not Inviter', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        state: ConnectionState.Responded,
        role: ConnectionRole.Invitee,
      })

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundMessageContext(ack, {
        recipientVerkey: 'test-verkey',
        connection,
      })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(ConnectionState.Responded)
    })
  })

  describe('getConnections', () => {
    it('returns the connections from the connections repository', async () => {
      expect.assertions(2)

      const expectedConnections = [getMockConnection(), getMockConnection(), getMockConnection()]

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindAll = connectionRepository.findAll as jest.Mock<Promise<ConnectionRecord[]>, []>
      mockFindAll.mockReturnValue(Promise.resolve(expectedConnections))

      const connections = await connectionService.getConnections()

      expect(connections).toEqual(expectedConnections)
      expect(mockFindAll).toBeCalled()
    })
  })

  describe('find', () => {
    it('returns the connection from the connections repository', async () => {
      expect.assertions(2)

      const id = 'test-id'

      const expectedConnection = getMockConnection({
        id,
      })

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>
      mockFind.mockReturnValue(Promise.resolve(expectedConnection))

      const connection = await connectionService.find(id)

      expect(connection).toEqual(expectedConnection)
      expect(mockFind).toBeCalledWith(id)
    })

    it('returns null when the connections repository throws an error', async () => {
      expect.assertions(2)

      const id = 'test-id'

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>
      mockFind.mockReturnValue(Promise.reject())

      const connection = await connectionService.find(id)

      expect(connection).toBeNull()
      expect(mockFind).toBeCalledWith(id)
    })
  })

  describe('findByVerkey', () => {
    it('returns the connection from the connections repository', async () => {
      expect.assertions(2)

      const verkey = 'test-verkey'

      const expectedConnection = getMockConnection({
        verkey,
      })

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >
      mockFindByQuery.mockReturnValue(Promise.resolve([expectedConnection]))

      const connection = await connectionService.findByVerkey(verkey)

      expect(connection).toEqual(expectedConnection)
      expect(mockFindByQuery).toBeCalledWith({ verkey })
    })

    it('returns null when the connection repository does not return any connections', async () => {
      expect.assertions(2)

      const verkey = 'test-verkey'

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >
      mockFindByQuery.mockReturnValue(Promise.resolve([]))

      const connection = await connectionService.findByVerkey(verkey)

      expect(connection).toBeNull()
      expect(mockFindByQuery).toBeCalledWith({ verkey })
    })

    it('throws an error when the connection repository returns more than one connection', async () => {
      expect.assertions(2)

      const verkey = 'test-verkey'

      const expectedConnections = [getMockConnection({ verkey }), getMockConnection({ verkey })]

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >
      mockFindByQuery.mockReturnValue(Promise.resolve(expectedConnections))

      expect(connectionService.findByVerkey(verkey)).rejects.toThrowError(
        'There is more than one connection for given verkey test-verkey'
      )

      expect(mockFindByQuery).toBeCalledWith({ verkey })
    })
  })

  describe('findByTheirKey', () => {
    it('returns the connection from the connections repository', async () => {
      expect.assertions(2)

      const theirKey = 'test-theirVerkey'

      const expectedConnection = getMockConnection()

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >
      mockFindByQuery.mockReturnValue(Promise.resolve([expectedConnection]))

      const connection = await connectionService.findByTheirKey(theirKey)

      expect(connection).toEqual(expectedConnection)
      expect(mockFindByQuery).toBeCalledWith({ theirKey })
    })

    it('returns null when the connection repository does not return any connections', async () => {
      expect.assertions(2)

      const theirKey = 'test-theirVerkey'

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >
      mockFindByQuery.mockReturnValue(Promise.resolve([]))

      const connection = await connectionService.findByTheirKey(theirKey)

      expect(connection).toBeNull()
      expect(mockFindByQuery).toBeCalledWith({ theirKey })
    })

    it('throws an error when the connection repository returns more than one connection', async () => {
      expect.assertions(2)

      const theirKey = 'test-theirVerkey'

      const expectedConnections = [getMockConnection(), getMockConnection()]

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >
      mockFindByQuery.mockReturnValue(Promise.resolve(expectedConnections))

      expect(connectionService.findByTheirKey(theirKey)).rejects.toThrowError(
        'There is more than one connection for given verkey test-theirVerkey'
      )

      expect(mockFindByQuery).toBeCalledWith({ theirKey })
    })
  })
})

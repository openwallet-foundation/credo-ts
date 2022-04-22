import type { Wallet } from '../../../wallet/Wallet'
import type { Routing } from '../services/ConnectionService'

import { getAgentConfig, getMockConnection, mockFunction } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { DIDCommV1Message } from '../../../agent/didcomm/v1/DIDCommV1Message'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { SignatureDecorator } from '../../../decorators/signature/SignatureDecorator'
import { signData, unpackAndVerifySignatureDecorator } from '../../../decorators/signature/SignatureDecoratorUtils'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { uuid } from '../../../utils/uuid'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { AckMessage, AckStatus } from '../../common'
import { DidCommService } from '../../dids/domain/service/DidCommService'
import {
  ConnectionInvitationMessage,
  ConnectionRequestMessage,
  ConnectionResponseMessage,
  TrustPingMessage,
} from '../messages'
import { Connection, ConnectionState, ConnectionRole, DidDoc } from '../models'
import { ConnectionRecord } from '../repository/ConnectionRecord'
import { ConnectionRepository } from '../repository/ConnectionRepository'
import { ConnectionService } from '../services/ConnectionService'

jest.mock('../repository/ConnectionRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>

const connectionImageUrl = 'https://example.com/image.png'

describe('ConnectionService', () => {
  const config = getAgentConfig('ConnectionServiceTest', {
    endpoints: ['http://agent.com:8080'],
    connectionImageUrl,
  })

  let wallet: Wallet
  let connectionRepository: ConnectionRepository
  let connectionService: ConnectionService
  let eventEmitter: EventEmitter
  let myRouting: Routing

  beforeAll(async () => {
    wallet = new IndyWallet(config)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  beforeEach(async () => {
    eventEmitter = new EventEmitter(config)
    connectionRepository = new ConnectionRepositoryMock()
    connectionService = new ConnectionService(wallet, config, connectionRepository, eventEmitter)
    myRouting = {
      did: 'fakeDid',
      verkey: 'fakeVerkey',
      endpoints: config.endpoints ?? [],
      routingKeys: [],
      mediatorId: 'fakeMediatorId',
    }
  })

  describe('createInvitation', () => {
    it('returns a connection record with values set', async () => {
      expect.assertions(9)
      const { connectionRecord, message } = await connectionService.createInvitation({ routing: myRouting })

      expect(connectionRecord.type).toBe('ConnectionRecord')
      expect(connectionRecord.role).toBe(ConnectionRole.Inviter)
      expect(connectionRecord.state).toBe(ConnectionState.Invited)
      expect(connectionRecord.autoAcceptConnection).toBeUndefined()
      expect(connectionRecord.id).toEqual(expect.any(String))
      expect(connectionRecord.verkey).toEqual(expect.any(String))
      expect(connectionRecord.mediatorId).toEqual('fakeMediatorId')
      expect(message.imageUrl).toBe(connectionImageUrl)
      expect(connectionRecord.getTags()).toEqual(
        expect.objectContaining({
          verkey: connectionRecord.verkey,
        })
      )
    })

    it('returns a connection record with invitation', async () => {
      expect.assertions(1)

      const { message: invitation } = await connectionService.createInvitation({ routing: myRouting })

      expect(invitation).toEqual(
        expect.objectContaining({
          label: config.label,
          recipientKeys: [expect.any(String)],
          routingKeys: [],
          serviceEndpoint: config.endpoints[0],
        })
      )
    })

    it('saves the connection record in the connection repository', async () => {
      expect.assertions(1)

      const saveSpy = jest.spyOn(connectionRepository, 'save')

      await connectionService.createInvitation({ routing: myRouting })

      expect(saveSpy).toHaveBeenCalledWith(expect.any(ConnectionRecord))
    })

    it('returns a connection record with the autoAcceptConnection parameter from the config', async () => {
      expect.assertions(3)

      const { connectionRecord: connectionTrue } = await connectionService.createInvitation({
        autoAcceptConnection: true,
        routing: myRouting,
      })
      const { connectionRecord: connectionFalse } = await connectionService.createInvitation({
        autoAcceptConnection: false,
        routing: myRouting,
      })
      const { connectionRecord: connectionUndefined } = await connectionService.createInvitation({ routing: myRouting })

      expect(connectionTrue.autoAcceptConnection).toBe(true)
      expect(connectionFalse.autoAcceptConnection).toBe(false)
      expect(connectionUndefined.autoAcceptConnection).toBeUndefined()
    })

    it('returns a connection record with the alias parameter from the config', async () => {
      expect.assertions(2)

      const { connectionRecord: aliasDefined } = await connectionService.createInvitation({
        alias: 'test-alias',
        routing: myRouting,
      })
      const { connectionRecord: aliasUndefined } = await connectionService.createInvitation({ routing: myRouting })

      expect(aliasDefined.alias).toBe('test-alias')
      expect(aliasUndefined.alias).toBeUndefined()
    })

    it('returns a connection record with the multiUseInvitation parameter from the config', async () => {
      expect.assertions(2)

      const { connectionRecord: multiUseDefined } = await connectionService.createInvitation({
        multiUseInvitation: true,
        routing: myRouting,
      })
      const { connectionRecord: multiUseUndefined } = await connectionService.createInvitation({ routing: myRouting })

      expect(multiUseDefined.multiUseInvitation).toBe(true)
      // Defaults to false
      expect(multiUseUndefined.multiUseInvitation).toBe(false)
    })

    it('returns a connection record with the custom label from the config', async () => {
      expect.assertions(1)

      const { message: invitation } = await connectionService.createInvitation({
        routing: myRouting,
        myLabel: 'custom-label',
      })

      expect(invitation).toEqual(
        expect.objectContaining({
          label: 'custom-label',
          recipientKeys: [expect.any(String)],
          routingKeys: [],
          serviceEndpoint: config.endpoints[0],
        })
      )
    })

    it('returns a connection record with the custom image url from the config', async () => {
      expect.assertions(1)

      const { message: invitation } = await connectionService.createInvitation({
        routing: myRouting,
        myImageUrl: 'custom-image-url',
      })

      expect(invitation).toEqual(
        expect.objectContaining({
          label: config.label,
          imageUrl: 'custom-image-url',
          recipientKeys: [expect.any(String)],
          routingKeys: [],
          serviceEndpoint: config.endpoints[0],
        })
      )
    })
  })

  describe('processInvitation', () => {
    it('returns a connection record containing the information from the connection invitation', async () => {
      expect.assertions(12)

      const recipientKey = 'key-1'
      const invitation = new ConnectionInvitationMessage({
        label: 'test label',
        recipientKeys: [recipientKey],
        serviceEndpoint: 'https://test.com/msg',
        imageUrl: connectionImageUrl,
      })

      const connection = await connectionService.processInvitation(invitation, { routing: myRouting })
      const connectionAlias = await connectionService.processInvitation(invitation, {
        alias: 'test-alias',
        routing: myRouting,
      })

      expect(connection.role).toBe(ConnectionRole.Invitee)
      expect(connection.state).toBe(ConnectionState.Invited)
      expect(connection.autoAcceptConnection).toBeUndefined()
      expect(connection.id).toEqual(expect.any(String))
      expect(connection.verkey).toEqual(expect.any(String))
      expect(connection.mediatorId).toEqual('fakeMediatorId')
      expect(connection.getTags()).toEqual(
        expect.objectContaining({
          verkey: connection.verkey,
          invitationKey: recipientKey,
        })
      )
      expect(connection.invitation).toMatchObject(invitation)
      expect(connection.alias).toBeUndefined()
      expect(connectionAlias.alias).toBe('test-alias')
      expect(connection.theirLabel).toBe('test label')
      expect(connection.imageUrl).toBe(connectionImageUrl)
    })

    it('returns a connection record with the autoAcceptConnection parameter from the config', async () => {
      expect.assertions(3)

      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test',
        label: 'test label',
      })

      const connectionTrue = await connectionService.processInvitation(invitation, {
        autoAcceptConnection: true,
        routing: myRouting,
      })
      const connectionFalse = await connectionService.processInvitation(invitation, {
        autoAcceptConnection: false,
        routing: myRouting,
      })
      const connectionUndefined = await connectionService.processInvitation(invitation, { routing: myRouting })

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

      const aliasDefined = await connectionService.processInvitation(invitation, {
        alias: 'test-alias',
        routing: myRouting,
      })
      const aliasUndefined = await connectionService.processInvitation(invitation, { routing: myRouting })

      expect(aliasDefined.alias).toBe('test-alias')
      expect(aliasUndefined.alias).toBeUndefined()
    })
  })

  describe('createRequest', () => {
    it('returns a connection request message containing the information from the connection record', async () => {
      expect.assertions(5)

      const connection = getMockConnection()
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(connection))

      const { connectionRecord: connectionRecord, message } = await connectionService.createRequest('test')

      expect(connectionRecord.state).toBe(ConnectionState.Requested)
      expect(message.label).toBe(config.label)
      expect(message.connection.did).toBe('test-did')
      expect(message.connection.didDoc).toEqual(connection.didDoc)
      expect(message.imageUrl).toBe(connectionImageUrl)
    })

    it('returns a connection request message containing a custom label', async () => {
      expect.assertions(1)

      const connection = getMockConnection()
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(connection))

      const { message } = await connectionService.createRequest('test', { myLabel: 'custom-label' })

      expect(message.label).toBe('custom-label')
    })

    it('returns a connection request message containing a custom image url', async () => {
      expect.assertions(1)

      const connection = getMockConnection()
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(connection))

      const { message } = await connectionService.createRequest('test', { myImageUrl: 'custom-image-url' })

      expect(message.imageUrl).toBe('custom-image-url')
    })

    it(`throws an error when connection role is ${ConnectionRole.Inviter} and not ${ConnectionRole.Invitee}`, async () => {
      expect.assertions(1)

      mockFunction(connectionRepository.getById).mockReturnValue(
        Promise.resolve(getMockConnection({ role: ConnectionRole.Inviter }))
      )
      return expect(connectionService.createRequest('test')).rejects.toThrowError(
        `Connection record has invalid role ${ConnectionRole.Inviter}. Expected role ${ConnectionRole.Invitee}.`
      )
    })

    const invalidConnectionStates = [ConnectionState.Requested, ConnectionState.Responded, ConnectionState.Complete]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${ConnectionState.Invited}`,
      (state) => {
        expect.assertions(1)

        mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(getMockConnection({ state })))
        return expect(connectionService.createRequest('test')).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${ConnectionState.Invited}.`
        )
      }
    )
  })

  describe('processRequest', () => {
    it('returns a connection record containing the information from the connection request', async () => {
      expect.assertions(7)

      const connectionRecord = getMockConnection({
        state: ConnectionState.Invited,
        verkey: 'my-key',
        role: ConnectionRole.Inviter,
      })
      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(connectionRecord))

      const theirDid = 'their-did'
      const theirVerkey = 'their-verkey'
      const theirDidDoc = new DidDoc({
        id: theirDid,
        publicKey: [],
        authentication: [],
        service: [
          new DidCommService({
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
        imageUrl: connectionImageUrl,
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        senderKid: theirVerkey,
        recipientKid: 'my-key',
      })

      const processedConnection = await connectionService.processRequest(messageContext)

      expect(processedConnection.state).toBe(ConnectionState.Requested)
      expect(processedConnection.theirDid).toBe(theirDid)
      expect(processedConnection.theirDidDoc).toEqual(theirDidDoc)
      expect(processedConnection.theirKey).toBe(theirVerkey)
      expect(processedConnection.theirLabel).toBe('test-label')
      expect(processedConnection.threadId).toBe(connectionRequest.id)
      expect(processedConnection.imageUrl).toBe(connectionImageUrl)
    })

    it('throws an error when the connection cannot be found by verkey', async () => {
      expect.assertions(1)

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        recipientKid: 'test-verkey',
        senderKid: 'sender-verkey',
      })

      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(null))
      return expect(connectionService.processRequest(messageContext)).rejects.toThrowError(
        'Unable to process connection request: connection for verkey test-verkey not found'
      )
    })

    it('returns a new connection record containing the information from the connection request when multiUseInvitation is enabled on the connection', async () => {
      expect.assertions(10)

      const connectionRecord = getMockConnection({
        id: 'test',
        state: ConnectionState.Invited,
        verkey: 'my-key',
        role: ConnectionRole.Inviter,
        multiUseInvitation: true,
      })
      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(connectionRecord))

      const theirDid = 'their-did'
      const theirVerkey = 'their-verkey'
      const theirDidDoc = new DidDoc({
        id: theirDid,
        publicKey: [],
        authentication: [],
        service: [
          new DidCommService({
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
        senderKid: theirVerkey,
        recipientKid: 'my-key',
      })

      const processedConnection = await connectionService.processRequest(messageContext, myRouting)

      expect(processedConnection.state).toBe(ConnectionState.Requested)
      expect(processedConnection.theirDid).toBe(theirDid)
      expect(processedConnection.theirDidDoc).toEqual(theirDidDoc)
      expect(processedConnection.theirKey).toBe(theirVerkey)
      expect(processedConnection.theirLabel).toBe('test-label')
      expect(processedConnection.threadId).toBe(connectionRequest.id)

      expect(connectionRepository.save).toHaveBeenCalledTimes(1)
      expect(processedConnection.id).not.toBe(connectionRecord.id)
      expect(connectionRecord.id).toBe('test')
      expect(connectionRecord.state).toBe(ConnectionState.Invited)
    })

    it(`throws an error when connection role is ${ConnectionRole.Invitee} and not ${ConnectionRole.Inviter}`, async () => {
      expect.assertions(1)

      mockFunction(connectionRepository.findByVerkey).mockReturnValue(
        Promise.resolve(getMockConnection({ role: ConnectionRole.Invitee }))
      )

      const inboundMessage = new InboundMessageContext(jest.fn()(), {
        senderKid: 'senderVerkey',
        recipientKid: 'recipientVerkey',
      })

      return expect(connectionService.processRequest(inboundMessage)).rejects.toThrowError(
        `Connection record has invalid role ${ConnectionRole.Invitee}. Expected role ${ConnectionRole.Inviter}.`
      )
    })

    it('throws an error when the message does not contain a did doc with any recipientKeys', async () => {
      expect.assertions(1)

      const recipientVerkey = 'test-verkey'

      const connection = getMockConnection({
        role: ConnectionRole.Inviter,
        verkey: recipientVerkey,
      })

      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(connection))

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
        didDoc: new DidDoc({
          id: 'did:test',
          publicKey: [],
          service: [],
          authentication: [],
        }),
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        recipientKid: recipientVerkey,
        senderKid: 'sender-verkey',
      })

      return expect(connectionService.processRequest(messageContext)).rejects.toThrowError(
        `Connection with id ${connection.id} has no recipient keys.`
      )
    })

    it('throws an error when a request for a multi use invitation is processed without routing provided', async () => {
      const connectionRecord = getMockConnection({
        state: ConnectionState.Invited,
        verkey: 'my-key',
        role: ConnectionRole.Inviter,
        multiUseInvitation: true,
      })
      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(connectionRecord))

      const theirDidDoc = new DidDoc({
        id: 'their-did',
        publicKey: [],
        authentication: [],
        service: [],
      })

      const connectionRequest = new ConnectionRequestMessage({
        did: 'their-did',
        didDoc: theirDidDoc,
        label: 'test-label',
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        connection: connectionRecord,
        senderKid: 'their-verkey',
        recipientKid: 'my-key',
      })

      expect(connectionService.processRequest(messageContext)).rejects.toThrowError(
        'Cannot process request for multi-use invitation without routing object. Make sure to call processRequest with the routing parameter provided.'
      )
    })
  })

  describe('createResponse', () => {
    it('returns a connection response message containing the information from the connection record', async () => {
      expect.assertions(2)

      // Needed for signing connection~sig
      const { did, verkey } = await wallet.createDid()
      const mockConnection = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
        role: ConnectionRole.Inviter,
        tags: {
          threadId: 'test',
        },
      })
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(mockConnection))

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

      mockFunction(connectionRepository.getById).mockReturnValue(
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

    const invalidConnectionStates = [ConnectionState.Invited, ConnectionState.Responded, ConnectionState.Complete]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${ConnectionState.Requested}`,
      async (state) => {
        expect.assertions(1)

        mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(getMockConnection({ state })))

        return expect(connectionService.createResponse('test')).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${ConnectionState.Requested}.`
        )
      }
    )
  })

  describe('processResponse', () => {
    it('returns a connection record containing the information from the connection response', async () => {
      expect.assertions(3)

      const { did, verkey } = await wallet.createDid()
      const { did: theirDid, verkey: theirVerkey } = await wallet.createDid()

      const connectionRecord = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
        role: ConnectionRole.Invitee,
        invitation: new ConnectionInvitationMessage({
          label: 'test',
          // processResponse checks wether invitation key is same as signing key for connetion~sig
          recipientKeys: [theirVerkey],
          serviceEndpoint: 'test',
        }),
      })
      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(connectionRecord))

      const otherPartyConnection = new Connection({
        did: theirDid,
        didDoc: new DidDoc({
          id: theirDid,
          publicKey: [],
          authentication: [],
          service: [
            new DidCommService({
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        senderKid: connectionRecord.theirKey!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        recipientKid: connectionRecord.myKey!,
      })

      const processedConnection = await connectionService.processResponse(messageContext)

      expect(processedConnection.state).toBe(ConnectionState.Responded)
      expect(processedConnection.theirDid).toBe(theirDid)
      expect(processedConnection.theirDidDoc).toEqual(otherPartyConnection.didDoc)
    })

    it(`throws an error when connection role is ${ConnectionRole.Inviter} and not ${ConnectionRole.Invitee}`, async () => {
      expect.assertions(1)

      const inboundMessage = new InboundMessageContext(jest.fn()(), {
        senderKid: 'senderVerkey',
        recipientKid: 'recipientVerkey',
      })

      mockFunction(connectionRepository.findByVerkey).mockReturnValue(
        Promise.resolve(
          getMockConnection({
            role: ConnectionRole.Inviter,
            state: ConnectionState.Requested,
          })
        )
      )

      return expect(connectionService.processResponse(inboundMessage)).rejects.toThrowError(
        `Connection record has invalid role ${ConnectionRole.Inviter}. Expected role ${ConnectionRole.Invitee}.`
      )
    })

    it('throws an error when the connection sig is not signed with the same key as the recipient key from the invitation', async () => {
      expect.assertions(1)

      const { did, verkey } = await wallet.createDid()
      const { did: theirDid, verkey: theirVerkey } = await wallet.createDid()
      const connectionRecord = getMockConnection({
        did,
        verkey,
        role: ConnectionRole.Invitee,
        state: ConnectionState.Requested,
      })
      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(connectionRecord))

      const otherPartyConnection = new Connection({
        did: theirDid,
        didDoc: new DidDoc({
          id: theirDid,
          publicKey: [],
          authentication: [],
          service: [
            new DidCommService({
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        senderKid: connectionRecord.theirKey!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        recipientKid: connectionRecord.myKey!,
      })

      return expect(connectionService.processResponse(messageContext)).rejects.toThrowError(
        new RegExp(
          'Connection object in connection response message is not signed with same key as recipient key in invitation'
        )
      )
    })

    it('throws an error when the connection cannot be found by verkey', async () => {
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
        recipientKid: 'test-verkey',
        senderKid: 'sender-verkey',
      })
      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(null))

      return expect(connectionService.processResponse(messageContext)).rejects.toThrowError(
        'Unable to process connection response: connection for verkey test-verkey not found'
      )
    })

    it('throws an error when the message does not contain a did doc with any recipientKeys', async () => {
      expect.assertions(1)

      const { did, verkey } = await wallet.createDid()
      const { did: theirDid, verkey: theirVerkey } = await wallet.createDid()
      const connectionRecord = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
        invitation: new ConnectionInvitationMessage({
          label: 'test',
          // processResponse checks wether invitation key is same as signing key for connetion~sig
          recipientKeys: [theirVerkey],
          serviceEndpoint: 'test',
        }),
        theirDid: undefined,
        theirDidDoc: undefined,
      })
      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(connectionRecord))

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
        senderKid: 'senderVerkey',
        recipientKid: 'recipientVerkey',
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
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(mockConnection))

      const { message, connectionRecord: connectionRecord } = await connectionService.createTrustPing('test')

      expect(connectionRecord.state).toBe(ConnectionState.Complete)
      expect(message).toEqual(expect.any(TrustPingMessage))
    })

    const invalidConnectionStates = [ConnectionState.Invited, ConnectionState.Requested]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${ConnectionState.Responded} or ${ConnectionState.Complete}`,
      (state) => {
        expect.assertions(1)

        mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(getMockConnection({ state })))
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
        recipientKid: 'test-verkey',
      })

      return expect(connectionService.processAck(messageContext)).rejects.toThrowError(
        'Unable to process connection ack: connection for verkey test-verkey not found'
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
        recipientKid: 'test-verkey',
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
        recipientKid: 'test-verkey',
        connection,
      })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(ConnectionState.Responded)
    })
  })

  describe('assertConnectionOrServiceDecorator', () => {
    it('should not throw an error when a connection record with state complete is present in the messageContext', () => {
      expect.assertions(1)

      const messageContext = new InboundMessageContext(new DIDCommV1Message(), {
        connection: getMockConnection({ state: ConnectionState.Complete }),
      })

      expect(() => connectionService.assertConnectionOrServiceDecorator(messageContext)).not.toThrow()
    })

    it('should throw an error when a connection record is present and state not complete in the messageContext', () => {
      expect.assertions(1)

      const messageContext = new InboundMessageContext(new DIDCommV1Message(), {
        connection: getMockConnection({ state: ConnectionState.Invited }),
      })

      expect(() => connectionService.assertConnectionOrServiceDecorator(messageContext)).toThrowError(
        'Connection record is not ready to be used'
      )
    })

    it('should not throw an error when no connection record is present in the messageContext and no additional data, but the message has a ~service decorator', () => {
      expect.assertions(1)

      const message = new DIDCommV1Message()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new InboundMessageContext(message)

      expect(() => connectionService.assertConnectionOrServiceDecorator(messageContext)).not.toThrow()
    })

    it('should not throw when a fully valid connection-less input is passed', () => {
      expect.assertions(1)

      const senderKey = 'senderKey'
      const recipientKey = 'recipientKey'

      const previousSentMessage = new DIDCommV1Message()
      previousSentMessage.setService({
        recipientKeys: [recipientKey],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const previousReceivedMessage = new DIDCommV1Message()
      previousReceivedMessage.setService({
        recipientKeys: [senderKey],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DIDCommV1Message()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new InboundMessageContext(message, {
        recipientKid: recipientKey,
        senderKid: senderKey,
      })

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousReceivedMessage,
          previousSentMessage,
        })
      ).not.toThrow()
    })

    it('should throw an error when previousSentMessage is present, but recipientKid is not ', () => {
      expect.assertions(1)

      const previousSentMessage = new DIDCommV1Message()
      previousSentMessage.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DIDCommV1Message()
      const messageContext = new InboundMessageContext(message)

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousSentMessage,
        })
      ).toThrowError('Cannot verify service without recipientKey on incoming message')
    })

    it('should throw an error when previousSentMessage and recipientKey are present, but recipient key is not present in recipientKeys of previously sent message ~service decorator', () => {
      expect.assertions(1)

      const recipientKey = 'recipientKey'

      const previousSentMessage = new DIDCommV1Message()
      previousSentMessage.setService({
        recipientKeys: ['anotherKey'],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DIDCommV1Message()
      const messageContext = new InboundMessageContext(message, {
        recipientKid: recipientKey,
      })

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousSentMessage,
        })
      ).toThrowError(
        'Previously sent message ~service recipientKeys does not include current received message recipient key'
      )
    })

    it('should throw an error when previousReceivedMessage is present, but senderKid is not ', () => {
      expect.assertions(1)

      const previousReceivedMessage = new DIDCommV1Message()
      previousReceivedMessage.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DIDCommV1Message()
      const messageContext = new InboundMessageContext(message)

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousReceivedMessage,
        })
      ).toThrowError('Cannot verify service without senderKey on incoming message')
    })

    it('should throw an error when previousReceivedMessage and senderKey are present, but sender key is not present in recipientKeys of previously received message ~service decorator', () => {
      expect.assertions(1)

      const senderKey = 'senderKey'

      const previousReceivedMessage = new DIDCommV1Message()
      previousReceivedMessage.setService({
        recipientKeys: ['anotherKey'],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DIDCommV1Message()
      const messageContext = new InboundMessageContext(message, {
        senderKid: senderKey,
      })

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousReceivedMessage,
        })
      ).toThrowError(
        'Previously received message ~service recipientKeys does not include current received message sender key'
      )
    })
  })

  describe('repository methods', () => {
    it('getById should return value from connectionRepository.getById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getById(expected.id)
      expect(connectionRepository.getById).toBeCalledWith(expected.id)

      expect(result).toBe(expected)
    })

    it('getByThreadId should return value from connectionRepository.getSingleByQuery', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getByThreadId).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getByThreadId('threadId')
      expect(connectionRepository.getByThreadId).toBeCalledWith('threadId')

      expect(result).toBe(expected)
    })

    it('findById should return value from connectionRepository.findById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.findById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findById(expected.id)
      expect(connectionRepository.findById).toBeCalledWith(expected.id)

      expect(result).toBe(expected)
    })

    it('findByVerkey should return value from connectionRepository.findSingleByQuery', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.findByVerkey).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findByVerkey('verkey')
      expect(connectionRepository.findByVerkey).toBeCalledWith('verkey')

      expect(result).toBe(expected)
    })

    it('findByTheirKey should return value from connectionRepository.findSingleByQuery', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.findByTheirKey).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findByTheirKey('theirKey')
      expect(connectionRepository.findByTheirKey).toBeCalledWith('theirKey')

      expect(result).toBe(expected)
    })

    it('getAll should return value from connectionRepository.getAll', async () => {
      const expected = [getMockConnection(), getMockConnection()]

      mockFunction(connectionRepository.getAll).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getAll()
      expect(connectionRepository.getAll).toBeCalledWith()

      expect(result).toEqual(expect.arrayContaining(expected))
    })
  })
})

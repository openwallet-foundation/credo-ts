import indy from 'indy-sdk';
import { v4 as uuid } from 'uuid';
import { IndyWallet } from '../../wallet/IndyWallet';
import { Wallet } from '../../wallet/Wallet';
import { ConnectionService } from './ConnectionService';
import { ConnectionRecord, ConnectionStorageProps } from '../../storage/ConnectionRecord';
import { AgentConfig } from '../../agent/AgentConfig';
import { ConnectionState } from './domain/ConnectionState';
import { InitConfig } from '../../types';
import { ConnectionRole } from './domain/ConnectionRole';
import { ConnectionInvitationMessage } from './ConnectionInvitationMessage';

import { Repository } from '../../storage/Repository';
import { DidDoc, Service } from './domain/DidDoc';
import { Connection } from './domain/Connection';
import { signData, unpackAndVerifySignatureDecorator } from '../../decorators/signature/SignatureDecoratorUtils';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';
import { ConnectionResponseMessage } from './ConnectionResponseMessage';
import { SignatureDecorator } from '../../decorators/signature/SignatureDecorator';
import { ConnectionRequestMessage } from './ConnectionRequestMessage';
import { TrustPingMessage } from '../trustping/TrustPingMessage';
import { AckMessage, AckStatus } from './AckMessage';
import { JsonTransformer } from '../../utils/JsonTransformer';
jest.mock('./../../storage/Repository');
const ConnectionRepository = <jest.Mock<Repository<ConnectionRecord>>>(<unknown>Repository);

export function getMockConnection({
  state = ConnectionState.Invited,
  role = ConnectionRole.Invitee,
  id = 'test',
  did = 'test-did',
  verkey = 'key-1',
  didDoc = new DidDoc(did, [], [], [new Service(`${did};indy`, 'https://endpoint.com', [verkey], [], 0, 'IndyAgent')]),
  tags = {},
  invitation = new ConnectionInvitationMessage({
    label: 'test',
    recipientKeys: [verkey],
    serviceEndpoint: 'https:endpoint.com/msg',
  }),
  theirDid = 'their-did',
  theirDidDoc = new DidDoc(
    theirDid,
    [],
    [],
    [new Service(`${did};indy`, 'https://endpoint.com', [verkey], [], 0, 'IndyAgent')]
  ),
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
  });
}

describe('ConnectionService', () => {
  const walletConfig = { id: 'test-wallet' + '-ConnectionServiceTest' };
  const walletCredentials = { key: 'key' };
  const initConfig: InitConfig = {
    label: 'agent label',
    host: 'http://agent.com',
    port: 8080,
    walletConfig,
    walletCredentials,
  };

  let wallet: Wallet;
  let agentConfig: AgentConfig;
  let connectionRepository: Repository<ConnectionRecord>;
  let connectionService: ConnectionService;

  beforeAll(async () => {
    wallet = new IndyWallet(walletConfig, walletCredentials, indy);
    await wallet.init();
    agentConfig = new AgentConfig(initConfig);
  });

  afterAll(async () => {
    await wallet.close();
    await wallet.delete();
  });

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    ConnectionRepository.mockClear();

    connectionRepository = new ConnectionRepository();
    connectionService = new ConnectionService(wallet, agentConfig, connectionRepository);
  });

  describe('createConnectionWithInvitation', () => {
    it('returns a connection record with values set', async () => {
      expect.assertions(6);

      const connection = await connectionService.createConnectionWithInvitation();

      expect(connection.role).toBe(ConnectionRole.Inviter);
      expect(connection.state).toBe(ConnectionState.Invited);
      expect(connection.autoAcceptConnection).toBeUndefined();
      expect(connection.id).toEqual(expect.any(String));
      expect(connection.verkey).toEqual(expect.any(String));
      expect(connection.tags).toEqual(
        expect.objectContaining({
          verkey: connection.verkey,
        })
      );
    });

    it('returns a connection record with invitation', async () => {
      expect.assertions(1);

      const connection = await connectionService.createConnectionWithInvitation();

      expect(connection.invitation).toEqual(
        expect.objectContaining({
          label: initConfig.label,
          recipientKeys: [expect.any(String)],
          routingKeys: [],
          serviceEndpoint: `${initConfig.host}:${initConfig.port}/msg`,
        })
      );
    });

    it('saves the connection record in the connection repository', async () => {
      expect.assertions(1);

      const saveSpy = jest.spyOn(connectionRepository, 'save');

      await connectionService.createConnectionWithInvitation();

      expect(saveSpy).toHaveBeenCalledWith(expect.any(ConnectionRecord));
    });

    it('returns a connection record with the autoAcceptConnection parameter from the config', async () => {
      expect.assertions(3);

      const connectionTrue = await connectionService.createConnectionWithInvitation({ autoAcceptConnection: true });
      const connectionFalse = await connectionService.createConnectionWithInvitation({ autoAcceptConnection: false });
      const connectionUndefined = await connectionService.createConnectionWithInvitation();

      expect(connectionTrue.autoAcceptConnection).toBe(true);
      expect(connectionFalse.autoAcceptConnection).toBe(false);
      expect(connectionUndefined.autoAcceptConnection).toBeUndefined();
    });

    it('returns a connection record with the alias parameter from the config', async () => {
      expect.assertions(2);

      const aliasDefined = await connectionService.createConnectionWithInvitation({ alias: 'test-alias' });
      const aliasUndefined = await connectionService.createConnectionWithInvitation();

      expect(aliasDefined.alias).toBe('test-alias');
      expect(aliasUndefined.alias).toBeUndefined();
    });
  });

  describe('processInvitation', () => {
    it('returns a connection record containing the information from the connection invitation', async () => {
      expect.assertions(9);

      const recipientKey = 'key-1';
      const invitation = new ConnectionInvitationMessage({
        label: 'test label',
        recipientKeys: [recipientKey],
        serviceEndpoint: 'https://test.com/msg',
      });

      const connection = await connectionService.processInvitation(invitation);
      const connectionAlias = await connectionService.processInvitation(invitation, { alias: 'test-alias' });

      expect(connection.role).toBe(ConnectionRole.Invitee);
      expect(connection.state).toBe(ConnectionState.Invited);
      expect(connection.autoAcceptConnection).toBeUndefined();
      expect(connection.id).toEqual(expect.any(String));
      expect(connection.verkey).toEqual(expect.any(String));
      expect(connection.tags).toEqual(
        expect.objectContaining({
          verkey: connection.verkey,
          invitationKey: recipientKey,
        })
      );
      expect(connection.invitation).toMatchObject(invitation);
      expect(connection.alias).toBeUndefined();
      expect(connectionAlias.alias).toBe('test-alias');
    });

    it('returns a connection record with the autoAcceptConnection parameter from the config', async () => {
      expect.assertions(3);

      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test',
        label: 'test label',
      });

      const connectionTrue = await connectionService.processInvitation(invitation, { autoAcceptConnection: true });
      const connectionFalse = await connectionService.processInvitation(invitation, {
        autoAcceptConnection: false,
      });
      const connectionUndefined = await connectionService.processInvitation(invitation);

      expect(connectionTrue.autoAcceptConnection).toBe(true);
      expect(connectionFalse.autoAcceptConnection).toBe(false);
      expect(connectionUndefined.autoAcceptConnection).toBeUndefined();
    });

    it('returns a connection record with the alias parameter from the config', async () => {
      expect.assertions(2);

      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test',
        label: 'test label',
      });

      const aliasDefined = await connectionService.processInvitation(invitation, { alias: 'test-alias' });
      const aliasUndefined = await connectionService.processInvitation(invitation);

      expect(aliasDefined.alias).toBe('test-alias');
      expect(aliasUndefined.alias).toBeUndefined();
    });
  });

  describe('createRequest', () => {
    it('returns a connection request message containing the information from the connection record', async () => {
      expect.assertions(4);

      const connection = getMockConnection();

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>;
      mockFind.mockReturnValue(Promise.resolve(connection));

      const outboundMessage = await connectionService.createRequest('test');

      expect(outboundMessage.connection.state).toBe(ConnectionState.Requested);
      expect(outboundMessage.payload.label).toBe(initConfig.label);
      expect(outboundMessage.payload.connection.did).toBe('test-did');
      expect(outboundMessage.payload.connection.didDoc).toEqual(connection.didDoc);
    });

    const invalidConnectionStates = [
      ConnectionState.Init,
      ConnectionState.Requested,
      ConnectionState.Responded,
      ConnectionState.Complete,
    ];
    test.each(invalidConnectionStates)('throws an error when connection state is %s and not INVITED', state => {
      expect.assertions(1);

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>;

      mockFind.mockReturnValue(Promise.resolve(getMockConnection({ state })));
      expect(connectionService.createRequest('test')).rejects.toThrowError(
        'Connection must be in Invited state to send connection request message'
      );
    });
  });

  describe('processRequest', () => {
    it('returns a connection record containing the information from the connection request', async () => {
      expect.assertions(5);

      const connectionRecord = getMockConnection({
        state: ConnectionState.Invited,
        verkey: 'my-key',
      });

      const theirDid = 'their-did';
      const theirVerkey = 'their-verkey';
      const theirDidDoc = new DidDoc(
        theirDid,
        [],
        [],
        [new Service(`${theirDid};indy`, 'https://endpoint.com', [theirVerkey], [], 0, 'IndyAgent')]
      );

      const connectionRequest = new ConnectionRequestMessage({
        did: theirDid,
        didDoc: theirDidDoc,
        label: 'test-label',
      });

      const messageContext = new InboundMessageContext(connectionRequest, {
        connection: connectionRecord,
        senderVerkey: theirVerkey,
        recipientVerkey: 'my-key',
      });

      const processedConnection = await connectionService.processRequest(messageContext);

      expect(processedConnection.state).toBe(ConnectionState.Requested);
      expect(processedConnection.theirDid).toBe(theirDid);
      // TODO: we should transform theirDidDoc to didDoc instance after retrieving from persistence
      expect(processedConnection.theirDidDoc).toEqual(theirDidDoc);
      expect(processedConnection.tags.theirKey).toBe(theirVerkey);
      expect(processedConnection.tags.threadId).toBe(connectionRequest.id);
    });

    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1);

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      });

      const messageContext = new InboundMessageContext(connectionRequest, {
        recipientVerkey: 'test-verkey',
      });

      expect(connectionService.processRequest(messageContext)).rejects.toThrowError(
        'Connection for verkey test-verkey not found!'
      );
    });

    it('throws an error when the message does not contain a connection parameter', async () => {
      expect.assertions(1);

      const connection = getMockConnection();

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete connectionRequest.connection;

      const messageContext = new InboundMessageContext(connectionRequest, {
        connection,
        recipientVerkey: 'test-verkey',
      });

      expect(connectionService.processRequest(messageContext)).rejects.toThrowError('Invalid message');
    });

    it('throws an error when the message does not contain a did doc with any recipientKeys', async () => {
      expect.assertions(1);

      const connection = getMockConnection();

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      });

      const messageContext = new InboundMessageContext(connectionRequest, {
        connection,
        recipientVerkey: 'test-verkey',
      });

      expect(connectionService.processRequest(messageContext)).rejects.toThrowError(
        `Connection with id ${connection.id} has no recipient keys.`
      );
    });
  });

  describe('createResponse', () => {
    it('returns a connection response message containing the information from the connection record', async () => {
      expect.assertions(2);

      // Needed for signing connection~sig
      const [did, verkey] = await wallet.createDid();
      const connectionRecord = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
      });

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>;
      mockFind.mockReturnValue(Promise.resolve(connectionRecord));

      const outboundMessage = await connectionService.createResponse('test');

      const connection = new Connection({
        did: connectionRecord.did,
        didDoc: connectionRecord.didDoc,
      });
      const plainConnection = JsonTransformer.toJSON(connection);

      expect(outboundMessage.connection.state).toBe(ConnectionState.Responded);
      expect(await unpackAndVerifySignatureDecorator(outboundMessage.payload.connectionSig, wallet)).toEqual(
        plainConnection
      );
    });

    const invalidConnectionStates = [
      ConnectionState.Init,
      ConnectionState.Invited,
      ConnectionState.Responded,
      ConnectionState.Complete,
    ];
    test.each(invalidConnectionStates)('throws an error when connection state is %s and not REQUESTED', state => {
      expect.assertions(1);

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>;
      mockFind.mockReturnValue(Promise.resolve(getMockConnection({ state })));

      expect(connectionService.createResponse('test')).rejects.toThrowError(
        'Connection must be in Requested state to send connection response message'
      );
    });
  });

  describe('processResponse', () => {
    it('returns a connection record containing the information from the connection response', async () => {
      expect.assertions(3);

      const [did, verkey] = await wallet.createDid();
      const [theirDid, theirVerkey] = await wallet.createDid();
      const connectionRecord = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
        tags: {
          // processResponse checks wether invitation key is same as signing key for connetion~sig
          invitationKey: theirVerkey,
        },
      });

      const otherPartyConnection = new Connection({
        did: theirDid,
        didDoc: new DidDoc(
          theirDid,
          [],
          [],
          [new Service(`${did};indy`, 'https://endpoint.com', [theirVerkey], [], 0, 'IndyAgent')]
        ),
      });
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection);
      const connectionSig = await signData(plainConnection, wallet, theirVerkey);

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      });

      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
        senderVerkey: connectionRecord.theirKey!,
        recipientVerkey: connectionRecord.myKey!,
      });

      const processedConnection = await connectionService.processResponse(messageContext);

      expect(processedConnection.state).toBe(ConnectionState.Responded);
      expect(processedConnection.theirDid).toBe(theirDid);
      // TODO: we should transform theirDidDoc to didDoc instance after retrieving from persistence
      expect(processedConnection.theirDidDoc).toEqual(otherPartyConnection.didDoc);
    });

    it('throws an error when the connection sig is not signed with the same key as the recipient key from the invitation', async () => {
      expect.assertions(1);

      const [did, verkey] = await wallet.createDid();
      const [theirDid, theirVerkey] = await wallet.createDid();
      const connectionRecord = getMockConnection({
        did,
        verkey,
        state: ConnectionState.Requested,
        tags: {
          // processResponse checks wether invitation key is same as signing key for connetion~sig
          invitationKey: 'some-random-key',
        },
      });

      const otherPartyConnection = new Connection({
        did: theirDid,
        didDoc: new DidDoc(
          theirDid,
          [],
          [],
          [new Service(`${did};indy`, 'https://endpoint.com', [theirVerkey], [], 0, 'IndyAgent')]
        ),
      });
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection);
      const connectionSig = await signData(plainConnection, wallet, theirVerkey);

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      });

      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
        senderVerkey: connectionRecord.theirKey!,
        recipientVerkey: connectionRecord.myKey!,
      });

      // For some reason expect(connectionService.processResponse(messageContext)).rejects.toThrowError()
      // doesn't work here.
      try {
        await connectionService.processResponse(messageContext);
      } catch (error) {
        expect(error.message).toBe(
          'Connection in connection response is not signed with same key as recipient key in invitation'
        );
      }
    });

    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1);

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig: new SignatureDecorator({
          signature: '',
          signatureData: '',
          signatureType: '',
          signer: '',
        }),
      });

      const messageContext = new InboundMessageContext(connectionResponse, {
        recipientVerkey: 'test-verkey',
      });

      expect(connectionService.processResponse(messageContext)).rejects.toThrowError(
        'Connection for verkey test-verkey not found!'
      );
    });

    it('throws an error when the message does not contain a did doc with any recipientKeys', async () => {
      expect.assertions(1);

      const [did, verkey] = await wallet.createDid();
      const [theirDid, theirVerkey] = await wallet.createDid();
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
      });

      const otherPartyConnection = new Connection({
        did: theirDid,
      });
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection);
      const connectionSig = await signData(plainConnection, wallet, theirVerkey);

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      });

      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
      });

      try {
        await connectionService.processResponse(messageContext);
      } catch (error) {
        expect(error.message).toBe(`Connection with id ${connectionRecord.id} has no recipient keys.`);
      }
    });
  });

  describe('createTrustPing', () => {
    it('returns a trust ping message', async () => {
      expect.assertions(2);

      const connection = getMockConnection({
        state: ConnectionState.Responded,
      });

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>;
      mockFind.mockReturnValue(Promise.resolve(connection));

      const outboundMessage = await connectionService.createTrustPing('test');

      expect(outboundMessage.connection.state).toBe(ConnectionState.Complete);
      expect(outboundMessage.payload).toEqual(expect.any(TrustPingMessage));
    });

    const invalidConnectionStates = [ConnectionState.Init, ConnectionState.Invited, ConnectionState.Requested];
    test.each(invalidConnectionStates)(
      'throws an error when connection state is %s and not RESPONDED or COMPLETED',
      state => {
        expect.assertions(1);

        // make separate mockFind variable to get the correct jest mock typing
        const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>;

        mockFind.mockReturnValue(Promise.resolve(getMockConnection({ state })));
        expect(connectionService.createTrustPing('test')).rejects.toThrowError(
          'Connection must be in Responded or Complete state to send ack message'
        );
      }
    );
  });

  describe('processAck', () => {
    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1);

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      });

      const messageContext = new InboundMessageContext(ack, {
        recipientVerkey: 'test-verkey',
      });

      expect(connectionService.processAck(messageContext)).rejects.toThrowError(
        'Connection for verkey test-verkey not found!'
      );
    });

    it('updates the state to Completed when the state is Responded and role is Inviter', async () => {
      expect.assertions(1);

      const connection = getMockConnection({
        state: ConnectionState.Responded,
        role: ConnectionRole.Inviter,
      });

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      });

      const messageContext = new InboundMessageContext(ack, {
        recipientVerkey: 'test-verkey',
        connection,
      });

      const updatedConnection = await connectionService.processAck(messageContext);

      expect(updatedConnection.state).toBe(ConnectionState.Complete);
    });

    it('does not update the state when the state is not Responded or the role is not Inviter', async () => {
      expect.assertions(1);

      const connection = getMockConnection({
        state: ConnectionState.Responded,
        role: ConnectionRole.Invitee,
      });

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      });

      const messageContext = new InboundMessageContext(ack, {
        recipientVerkey: 'test-verkey',
        connection,
      });

      const updatedConnection = await connectionService.processAck(messageContext);

      expect(updatedConnection.state).toBe(ConnectionState.Responded);
    });
  });

  describe('getConnections', () => {
    it('returns the connections from the connections repository', async () => {
      expect.assertions(2);

      const expectedConnections = [getMockConnection(), getMockConnection(), getMockConnection()];

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindAll = connectionRepository.findAll as jest.Mock<Promise<ConnectionRecord[]>, []>;
      mockFindAll.mockReturnValue(Promise.resolve(expectedConnections));

      const connections = await connectionService.getConnections();

      expect(connections).toEqual(expectedConnections);
      expect(mockFindAll).toBeCalled();
    });
  });

  describe('find', () => {
    it('returns the connection from the connections repository', async () => {
      expect.assertions(2);

      const id = 'test-id';

      const expectedConnection = getMockConnection({
        id,
      });

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>;
      mockFind.mockReturnValue(Promise.resolve(expectedConnection));

      const connection = await connectionService.find(id);

      expect(connection).toEqual(expectedConnection);
      expect(mockFind).toBeCalledWith(id);
    });

    it('returns null when the connections repository throws an error', async () => {
      expect.assertions(2);

      const id = 'test-id';

      // make separate mockFind variable to get the correct jest mock typing
      const mockFind = connectionRepository.find as jest.Mock<Promise<ConnectionRecord>, [string]>;
      mockFind.mockReturnValue(Promise.reject());

      const connection = await connectionService.find(id);

      expect(connection).toBeNull();
      expect(mockFind).toBeCalledWith(id);
    });
  });

  describe('findByVerkey', () => {
    it('returns the connection from the connections repository', async () => {
      expect.assertions(2);

      const verkey = 'test-verkey';

      const expectedConnection = getMockConnection({
        verkey,
      });

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >;
      mockFindByQuery.mockReturnValue(Promise.resolve([expectedConnection]));

      const connection = await connectionService.findByVerkey(verkey);

      expect(connection).toEqual(expectedConnection);
      expect(mockFindByQuery).toBeCalledWith({ verkey });
    });

    it('returns null when the connection repository does not return any connections', async () => {
      expect.assertions(2);

      const verkey = 'test-verkey';

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >;
      mockFindByQuery.mockReturnValue(Promise.resolve([]));

      const connection = await connectionService.findByVerkey(verkey);

      expect(connection).toBeNull();
      expect(mockFindByQuery).toBeCalledWith({ verkey });
    });

    it('throws an error when the connection repository returns more than one connection', async () => {
      expect.assertions(2);

      const verkey = 'test-verkey';

      const expectedConnections = [getMockConnection({ verkey }), getMockConnection({ verkey })];

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >;
      mockFindByQuery.mockReturnValue(Promise.resolve(expectedConnections));

      expect(connectionService.findByVerkey(verkey)).rejects.toThrowError(
        'There is more than one connection for given verkey test-verkey'
      );

      expect(mockFindByQuery).toBeCalledWith({ verkey });
    });
  });

  describe('findByTheirKey', () => {
    it('returns the connection from the connections repository', async () => {
      expect.assertions(2);

      const theirKey = 'test-theirVerkey';

      const expectedConnection = getMockConnection();

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >;
      mockFindByQuery.mockReturnValue(Promise.resolve([expectedConnection]));

      const connection = await connectionService.findByTheirKey(theirKey);

      expect(connection).toEqual(expectedConnection);
      expect(mockFindByQuery).toBeCalledWith({ theirKey });
    });

    it('returns null when the connection repository does not return any connections', async () => {
      expect.assertions(2);

      const theirKey = 'test-theirVerkey';

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >;
      mockFindByQuery.mockReturnValue(Promise.resolve([]));

      const connection = await connectionService.findByTheirKey(theirKey);

      expect(connection).toBeNull();
      expect(mockFindByQuery).toBeCalledWith({ theirKey });
    });

    it('throws an error when the connection repository returns more than one connection', async () => {
      expect.assertions(2);

      const theirKey = 'test-theirVerkey';

      const expectedConnections = [getMockConnection(), getMockConnection()];

      // make separate mockFind variable to get the correct jest mock typing
      const mockFindByQuery = connectionRepository.findByQuery as jest.Mock<
        Promise<ConnectionRecord[]>,
        [Record<string, unknown>]
      >;
      mockFindByQuery.mockReturnValue(Promise.resolve(expectedConnections));

      expect(connectionService.findByTheirKey(theirKey)).rejects.toThrowError(
        'There is more than one connection for given verkey test-theirVerkey'
      );

      expect(mockFindByQuery).toBeCalledWith({ theirKey });
    });
  });
});

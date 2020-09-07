import indy from 'indy-sdk';
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
import { classToPlain } from 'class-transformer';
import { unpackAndVerifySignatureDecorator } from '../../decorators/signature/SignatureDecoratorUtils';
jest.mock('./../../storage/Repository');
const ConnectionRepository = <jest.Mock<Repository<ConnectionRecord>>>(<unknown>Repository);

function getMockConnection({
  state = ConnectionState.Invited,
  role = ConnectionRole.Invitee,
  id = 'test',
  did = 'test-did',
  didDoc = new DidDoc(did, [], [], []),
  tags = {},
  verkey = 'key-1',
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
    url: 'http://agent.com',
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
      const connection = await connectionService.createConnectionWithInvitation();

      expect(connection.invitation).toEqual(
        expect.objectContaining({
          label: initConfig.label,
          recipientKeys: [expect.any(String)],
          routingKeys: [],
          serviceEndpoint: `${initConfig.url}:${initConfig.port}/msg`,
        })
      );
    });

    it('saves the connection record in the connection repository', async () => {
      const saveSpy = jest.spyOn(connectionRepository, 'save');

      await connectionService.createConnectionWithInvitation();

      expect(saveSpy).toHaveBeenCalledWith(expect.any(ConnectionRecord));
    });

    it('returns a connection record with the autoAcceptConnection parameter from the config', async () => {
      const connectionTrue = await connectionService.createConnectionWithInvitation({ autoAcceptConnection: true });
      const connectionFalse = await connectionService.createConnectionWithInvitation({ autoAcceptConnection: false });
      const connectionUndefined = await connectionService.createConnectionWithInvitation();

      expect(connectionTrue.autoAcceptConnection).toBe(true);
      expect(connectionFalse.autoAcceptConnection).toBe(false);
      expect(connectionUndefined.autoAcceptConnection).toBeUndefined();
    });
  });

  describe('processInvitation', () => {
    it('returns a connection record containing the information from the connection invitation', async () => {
      const recipientKey = 'key-1';
      const invitation = new ConnectionInvitationMessage({
        label: 'test label',
        recipientKeys: [recipientKey],
        serviceEndpoint: 'https://test.com/msg',
      });

      const connection = await connectionService.processInvitation(invitation);

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
    });

    it('returns a connection record with the autoAcceptConnection parameter from the config', async () => {
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
  });

  describe('createRequest', () => {
    it('returns a connection request message containing the information from the connection record', async () => {
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
    //
  });

  describe('createResponse', () => {
    it('returns a connection response message containing the information from the connection record', async () => {
      // Needed for signing connection~sig
      const [did, verkey] = await wallet.createDid({ method_name: 'sov' });
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
      const plainConnection = classToPlain(connection);

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
    //
  });

  describe('createTrustPing', () => {
    //
  });
});

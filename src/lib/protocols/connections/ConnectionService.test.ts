/* eslint-disable no-console */
import indy from 'indy-sdk';
import { IndyWallet } from '../../wallet/IndyWallet';
import { Wallet } from '../../wallet/Wallet';
import { Repository } from '../../storage/Repository';
import { StorageService } from '../../storage/StorageService';
import { IndyStorageService } from '../../storage/IndyStorageService';
import { ConnectionService } from './ConnectionService';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { AgentConfig } from '../../agent/AgentConfig';
import { ConnectionState } from './domain/ConnectionState';

describe('ConnectionService', () => {
  const walletConfig = { id: 'test-wallet' + '-ConnectionServiceTest' };
  const walletCredentials = { key: 'key' };

  let wallet: Wallet;
  let storageService: StorageService<ConnectionRecord>;
  let agentConfig: AgentConfig;

  beforeAll(async () => {
    wallet = new IndyWallet(walletConfig, walletCredentials, indy);
    await wallet.init();
    storageService = new IndyStorageService(wallet);
    agentConfig = new AgentConfig({ label: 'agent label', walletConfig, walletCredentials });
  });

  afterAll(async () => {
    await wallet.close();
    await wallet.delete();
  });

  describe('createConnectionWithInvitation', () => {
    let connectionRepository: Repository<ConnectionRecord>;
    let connectionService: ConnectionService;

    beforeEach(() => {
      connectionRepository = new Repository<ConnectionRecord>(ConnectionRecord, storageService);
      connectionService = new ConnectionService(wallet, agentConfig, connectionRepository);
    });

    it('returns connection record with invitation', async () => {
      const connectionRecord = await connectionService.createConnectionWithInvitation();

      expect(connectionRecord.invitation).toEqual(
        expect.objectContaining({
          '@id': expect.any(String),
          '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/invitation',
          label: 'agent label',
          recipientKeys: [expect.any(String)],
          routingKeys: [],
          serviceEndpoint: 'undefined:undefined/msg',
        })
      );
    });

    it(`returns connection record with state INVITED`, async () => {
      const connectionRecord = await connectionService.createConnectionWithInvitation();

      expect(connectionRecord.state).toEqual(ConnectionState.INVITED);
    });

    it(`emits stateChange with INVITED`, async () => {
      const eventListenerMock = jest.fn();
      connectionService.on('stateChange', eventListenerMock);

      await connectionService.createConnectionWithInvitation();

      expect(eventListenerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: 1,
          verkey: expect.any(String),
        })
      );
    });
  });
});

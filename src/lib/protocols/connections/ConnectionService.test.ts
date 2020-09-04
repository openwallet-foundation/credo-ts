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
      const connection = await connectionService.createConnectionWithInvitation();

      expect(connection.invitation).toEqual(
        expect.objectContaining({
          label: 'agent label',
          recipientKeys: [expect.any(String)],
          routingKeys: [],
          serviceEndpoint: 'undefined:undefined/msg',
        })
      );
    });

    it(`returns connection record with state INVITED`, async () => {
      const connection = await connectionService.createConnectionWithInvitation();

      expect(connection.state).toEqual(ConnectionState.Invited);
    });
  });
});

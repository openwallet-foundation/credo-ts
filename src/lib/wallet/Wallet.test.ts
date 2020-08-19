import { IndyWallet } from './IndyWallet';
import indy from 'indy-sdk';

describe('Wallet', () => {
  const wallet = new IndyWallet({ id: 'test_wallet' }, { key: 'test_key' }, indy);

  test('initialize public did', async () => {
    await wallet.init();

    await wallet.initPublicDid({ seed: '00000000000000000000000Forward01' });

    expect(wallet.getPublicDid()).toEqual({
      did: 'DtWRdd6C5dN5vpcN6XRAvu',
      verkey: '82RBSn3heLgXzZd74UsMC8Q8YRfEEhQoAM7LUqE6bevJ',
    });
  });

  afterEach(async () => {
    await wallet.close();
    await wallet.delete();
  });
});

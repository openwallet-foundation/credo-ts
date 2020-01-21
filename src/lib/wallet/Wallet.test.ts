/* eslint-disable @typescript-eslint/no-var-requires */
import 'reflect-metadata';
import { Container } from 'inversify';
import { WalletConfig, WalletCredentials, Wallet } from './Wallet';
import { IndyWallet } from './IndyWallet';
import { TYPES } from '../types';

describe('Wallet', () => {
  const container = new Container();
  container.bind<WalletConfig>(TYPES.WalletConfig).toConstantValue({ id: 'test_wallet' });
  container.bind<WalletCredentials>(TYPES.WalletCredentials).toConstantValue({ key: 'test_key' });
  container.bind<Wallet>(TYPES.Wallet).to(IndyWallet);

  const wallet = container.get<Wallet>(TYPES.Wallet);

  test('initialize public did', async () => {
    await wallet.init();

    await wallet.initPublicDid('DtWRdd6C5dN5vpcN6XRAvu', '00000000000000000000000Forward01');

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

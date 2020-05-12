import indy from 'indy-sdk';

import { EnvelopeService } from './EnvelopeService';
import { IndyWallet } from '../wallet/IndyWallet';
import { Wallet } from '../wallet/Wallet';

describe('EnvelopeService', () => {
  const walletConfig = { id: 'test-wallet' + '-EnvelopeServiceTest' };
  const walletCredentials = { key: 'key' };

  let wallet: Wallet;
  let aliceVerkey: Verkey;

  beforeAll(async () => {
    wallet = new IndyWallet(walletConfig, walletCredentials, indy);
    await wallet.init();
    const [did, verkey] = await wallet.createDid();
    aliceVerkey = verkey;
  });

  afterAll(async () => {
    await wallet.close();
    await wallet.delete();
  });

  test('pack message with recepient key', async () => {
    const envelopeService = new EnvelopeService(wallet);
    const outboundMessage = {
      connection: {},
      recipientKeys: [aliceVerkey],
      routingKeys: [],
      senderVk: null,
      payload: { some: 'message ' },
    };
    // const result = envelopeService.pack(outboundMessage);
    // expect(result).toEqual({});
  });
});

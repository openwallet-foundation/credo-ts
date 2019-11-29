/* eslint-disable @typescript-eslint/no-var-requires */
import indy from 'indy-sdk';
import { sign } from './decorators';

describe('decorators', () => {
  const walletConfig = { id: 'wallet-1' + 'test1' };
  const walletCredentials = { key: 'key' };
  let wh: WalletHandle;

  beforeAll(async () => {
    await indy.createWallet(walletConfig, walletCredentials);
    wh = await indy.openWallet(walletConfig, walletCredentials);
  });

  afterAll(async () => {
    await indy.closeWallet(wh);
    await indy.deleteWallet(walletConfig, walletCredentials);
  });

  test('sign decorator signs data in given field', async () => {
    const seed1 = '00000000000000000000000000000My1';
    const verkey = await indy.createKey(wh, { seed: seed1 });

    const message = {
      '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response',
      '@id': '12345678900987654321',
      '~thread': {
        thid: 'thread1',
      },
      connection: {
        did: 'did',
        did_doc: {
          '@context': 'https://w3id.org/did/v1',
          service: [
            {
              id: 'did:example:123456789abcdefghi#did-communication',
              type: 'did-communication',
              priority: 0,
              recipientKeys: [verkey],
              routingKeys: [],
              serviceEndpoint: 'https://agent.example.com/',
            },
          ],
        },
      },
    };

    const signedMessage = await sign(wh, message, 'connection', verkey);

    const expectedMessage = {
      '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response',
      '@id': '12345678900987654321',
      '~thread': { thid: 'thread1' },
      'connection~sig': {
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/signature/1.0/ed25519Sha512_single',
        signature: '6sblL1+OMlTFB3KhIQ8HKKZga8te7NAJAmBVPg2WzNYjMHVjfm+LJP6ZS1GUc2FRtfczRyLEfXrXb86SnzBmBA==',
        sig_data:
          'eyJkaWQiOiJkaWQiLCJkaWRfZG9jIjp7IkBjb250ZXh0IjoiaHR0cHM6Ly93M2lkLm9yZy9kaWQvdjEiLCJzZXJ2aWNlIjpbeyJpZCI6ImRpZDpleGFtcGxlOjEyMzQ1Njc4OWFiY2RlZmdoaSNkaWQtY29tbXVuaWNhdGlvbiIsInR5cGUiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIkdqWldzQkxnWkNSMThhTDQ2OEpBVDd3OUNaUmlCbnB4VVBQZ3lReGg0dm9hIl0sInJvdXRpbmdLZXlzIjpbXSwic2VydmljZUVuZHBvaW50IjoiaHR0cHM6Ly9hZ2VudC5leGFtcGxlLmNvbS8ifV19fQ==',
        signers: 'GjZWsBLgZCR18aL468JAT7w9CZRiBnpxUPPgyQxh4voa',
      },
    };

    expect(signedMessage).toEqual(expectedMessage);
  });
});

/* eslint-disable @typescript-eslint/no-var-requires */
import indy from 'indy-sdk';
import { sign, verify } from './decorators';

describe('decorators', () => {
  const walletConfig = { id: 'wallet-1' + 'test1' };
  const walletCredentials = { key: 'key' };

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
            recipientKeys: ['someVerkey'],
            routingKeys: [],
            serviceEndpoint: 'https://agent.example.com/',
          },
        ],
      },
    },
  };

  const signedMessage = {
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response',
    '@id': '12345678900987654321',
    '~thread': { thid: 'thread1' },
    'connection~sig': {
      '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/signature/1.0/ed25519Sha512_single',
      signature: 'FnVvO/NJqmDM9OiIdg3zN4yCZ7dowDjARymMSpO1ngX0f4ehPQzkweNdHwvInm9QfMhNoWgXz4esHpayuhVbDQ==',
      sig_data:
        'AAAAAAAAAAB7ImRpZCI6ImRpZCIsImRpZF9kb2MiOnsiQGNvbnRleHQiOiJodHRwczovL3czaWQub3JnL2RpZC92MSIsInNlcnZpY2UiOlt7ImlkIjoiZGlkOmV4YW1wbGU6MTIzNDU2Nzg5YWJjZGVmZ2hpI2RpZC1jb21tdW5pY2F0aW9uIiwidHlwZSI6ImRpZC1jb21tdW5pY2F0aW9uIiwicHJpb3JpdHkiOjAsInJlY2lwaWVudEtleXMiOlsic29tZVZlcmtleSJdLCJyb3V0aW5nS2V5cyI6W10sInNlcnZpY2VFbmRwb2ludCI6Imh0dHBzOi8vYWdlbnQuZXhhbXBsZS5jb20vIn1dfX0=',
      signers: 'GjZWsBLgZCR18aL468JAT7w9CZRiBnpxUPPgyQxh4voa',
    },
  };

  let wh: WalletHandle;

  beforeAll(async () => {
    await indy.createWallet(walletConfig, walletCredentials);
    wh = await indy.openWallet(walletConfig, walletCredentials);
  });

  afterAll(async () => {
    await indy.closeWallet(wh);
    await indy.deleteWallet(walletConfig, walletCredentials);
  });

  test('sign decorator signs data in a given field of message', async () => {
    const seed1 = '00000000000000000000000000000My1';
    const verkey = await indy.createKey(wh, { seed: seed1 });

    const result = await sign(wh, message, 'connection', verkey, true);
    expect(result).toEqual(signedMessage);
  });

  test('verify decorator verifies data in a given field of message', async () => {
    const result = await verify(signedMessage, 'connection');
    expect(result).toEqual(message);
  });

  test('verify decorator throws when signature is not valid', async () => {
    const wrongSignature = '6sblL1+OMlTFB3KhIQ8HKKZga8te7NAJAmBVPg2WzNYjMHVjfm+LJP6ZS1GUc2FRtfczRyLEfXrXb86SnzBmBA==';
    const wronglySignedMessage = {
      ...signedMessage,
      'connection~sig': {
        ...signedMessage['connection~sig'],
        signature: wrongSignature,
      },
    };

    expect.assertions(1);
    try {
      await verify(wronglySignedMessage, 'connection');
    } catch (error) {
      expect(error.message).toEqual('Signature is not valid!');
    }
  });
});

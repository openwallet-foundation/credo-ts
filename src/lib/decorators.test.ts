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
        'eyJkaWQiOiJkaWQiLCJkaWRfZG9jIjp7IkBjb250ZXh0IjoiaHR0cHM6Ly93M2lkLm9yZy9kaWQvdjEiLCJzZXJ2aWNlIjpbeyJpZCI6ImRpZDpleGFtcGxlOjEyMzQ1Njc4OWFiY2RlZmdoaSNkaWQtY29tbXVuaWNhdGlvbiIsInR5cGUiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbInNvbWVWZXJrZXkiXSwicm91dGluZ0tleXMiOltdLCJzZXJ2aWNlRW5kcG9pbnQiOiJodHRwczovL2FnZW50LmV4YW1wbGUuY29tLyJ9XX19',
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

    const result = await sign(wh, message, 'connection', verkey);
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

import type { Wallet } from '../../wallet'

import { InMemoryWallet } from '../../../../../tests/InMemoryWallet'
import { getAgentConfig } from '../../../tests/helpers'
import { KeyType } from '../../crypto'
import { TypedArrayEncoder } from '../../utils'

import { SignatureDecorator } from './SignatureDecorator'
import { signData, unpackAndVerifySignatureDecorator } from './SignatureDecoratorUtils'

jest.mock('../../utils/timestamp', () => {
  return {
    __esModule: true,
    default: jest.fn(() => Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0)),
  }
})

describe('Decorators | Signature | SignatureDecoratorUtils', () => {
  const data = {
    did: 'did',
    did_doc: {
      '@context': 'https://www.w3.org/ns/did/v1',
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
  }

  const signedData = new SignatureDecorator({
    signatureType: 'https://didcomm.org/signature/1.0/ed25519Sha512_single',
    signature: 'TeVQ7m4v7y4Gg80JZWN50H9GjWc3XFDQJ3QpoY2kuAK1ZzX9a_7Tls-X-GI9-JLCysPKzB5EnzAy3EIPi082BA',
    signatureData:
      'AAAAAAAAAAB7ImRpZCI6ImRpZCIsImRpZF9kb2MiOnsiQGNvbnRleHQiOiJodHRwczovL3d3dy53My5vcmcvbnMvZGlkL3YxIiwic2VydmljZSI6W3siaWQiOiJkaWQ6ZXhhbXBsZToxMjM0NTY3ODlhYmNkZWZnaGkjZGlkLWNvbW11bmljYXRpb24iLCJ0eXBlIjoiZGlkLWNvbW11bmljYXRpb24iLCJwcmlvcml0eSI6MCwicmVjaXBpZW50S2V5cyI6WyJzb21lVmVya2V5Il0sInJvdXRpbmdLZXlzIjpbXSwic2VydmljZUVuZHBvaW50IjoiaHR0cHM6Ly9hZ2VudC5leGFtcGxlLmNvbS8ifV19fQ',
    signer: 'GjZWsBLgZCR18aL468JAT7w9CZRiBnpxUPPgyQxh4voa',
  })

  let wallet: Wallet

  beforeAll(async () => {
    const config = getAgentConfig('SignatureDecoratorUtilsTest')
    wallet = new InMemoryWallet()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  test('signData signs json object and returns SignatureDecorator', async () => {
    const privateKey = TypedArrayEncoder.fromString('00000000000000000000000000000My1')
    const key = await wallet.createKey({ privateKey, keyType: KeyType.Ed25519 })

    const result = await signData(data, wallet, key.publicKeyBase58)

    expect(result).toEqual(signedData)
  })

  test('unpackAndVerifySignatureDecorator unpacks signature decorator and verifies signature', async () => {
    const result = await unpackAndVerifySignatureDecorator(signedData, wallet)
    expect(result).toEqual(data)
  })

  test('unpackAndVerifySignatureDecorator throws when signature is not valid', async () => {
    const wrongSignature = '6sblL1+OMlTFB3KhIQ8HKKZga8te7NAJAmBVPg2WzNYjMHVjfm+LJP6ZS1GUc2FRtfczRyLEfXrXb86SnzBmBA=='

    const wronglySignedData = new SignatureDecorator({
      ...signedData,
      signature: wrongSignature,
    })

    expect.assertions(1)
    try {
      await unpackAndVerifySignatureDecorator(wronglySignedData, wallet)
    } catch (error) {
      expect(error.message).toEqual('Signature is not valid')
    }
  })
})

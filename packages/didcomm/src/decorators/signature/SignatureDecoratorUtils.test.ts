import { transformPrivateKeyToPrivateJwk } from '../../../../askar/src'
import { Kms, TypedArrayEncoder } from '../../../../core/src/index'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'

import { SignatureDecorator } from './SignatureDecorator'
import { signData, unpackAndVerifySignatureDecorator } from './SignatureDecoratorUtils'

vi.mock('../../../../core/src/utils/timestamp', () => {
  return {
    __esModule: true,
    default: vi.fn(() => Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0)),
  }
})

const agentContext = getAgentContext({
  agentConfig: getAgentConfig('SignatureDecoratorUtilsTest'),
})
const kms = agentContext.resolve(Kms.KeyManagementApi)

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

  test('signData signs json object and returns SignatureDecorator', async () => {
    const privateJwk = transformPrivateKeyToPrivateJwk({
      privateKey: TypedArrayEncoder.fromString('00000000000000000000000000000My1'),
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    }).privateJwk
    const createdKey = await kms.importKey({ privateJwk })
    const publicJwk = Kms.PublicJwk.fromPublicJwk(createdKey.publicJwk)

    const result = await signData(agentContext, data, publicJwk)

    expect(result).toEqual(signedData)
  })

  test('unpackAndVerifySignatureDecorator unpacks signature decorator and verifies signature', async () => {
    const result = await unpackAndVerifySignatureDecorator(agentContext, signedData)
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
      await unpackAndVerifySignatureDecorator(agentContext, wronglySignedData)
    } catch (error) {
      expect(error.message).toEqual('Signature is not valid')
    }
  })
})

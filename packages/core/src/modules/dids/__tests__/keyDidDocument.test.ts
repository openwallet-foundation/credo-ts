import { JsonTransformer } from '../../../utils/JsonTransformer'
import { getDidDocumentForPublicJwk } from '../domain/keyDidDocument'
import { DidKey } from '../methods/key'
import didKeyEd25519Fixture from './__fixtures__/didKeyEd25519.json'
import didKeyX25519Fixture from './__fixtures__/didKeyX25519.json'

const TEST_X25519_DID = 'did:key:z6LShLeXRTzevtwcfehaGEzCMyL3bNsAeKCwcqwJxyCo63yE'
const TEST_ED25519_DID = 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'

describe('getDidDocumentForPublicJwk', () => {
  it('should return a valid did:key did document for and x25519 key', () => {
    const didKey = DidKey.fromDid(TEST_X25519_DID)
    const didDocument = getDidDocumentForPublicJwk(TEST_X25519_DID, didKey.publicJwk)

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject(didKeyX25519Fixture)
  })

  it('should return a valid did:key did document for and ed25519 key', () => {
    const didKey = DidKey.fromDid(TEST_ED25519_DID)
    const didDocument = getDidDocumentForPublicJwk(TEST_ED25519_DID, didKey.publicJwk)

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject(didKeyEd25519Fixture)
  })
})

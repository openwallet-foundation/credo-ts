import { JsonTransformer, TypedArrayEncoder } from '../../../../../utils'
import { Ed25519PublicJwk, PublicJwk } from '../../../../kms'
import didKeyEd25519Fixture from '../../../__tests__/__fixtures__//didKeyEd25519.json'
import { VerificationMethod } from '../../../domain/verificationMethod'
import { keyDidEd25519 } from '../ed25519'

const TEST_ED25519_FINGERPRINT = 'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'
const TEST_ED25519_DID = `did:key:${TEST_ED25519_FINGERPRINT}`

describe('ed25519', () => {
  it('should return a valid verification method', async () => {
    const key = PublicJwk.fromFingerprint(TEST_ED25519_FINGERPRINT) as PublicJwk<Ed25519PublicJwk>
    const verificationMethods = keyDidEd25519.getVerificationMethods(TEST_ED25519_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject([didKeyEd25519Fixture.verificationMethod[0]])
  })

  it('supports Ed25519VerificationKey2018 verification method type', () => {
    expect(keyDidEd25519.supportedVerificationMethodTypes).toMatchObject([
      'Ed25519VerificationKey2018',
      'Ed25519VerificationKey2020',
      'JsonWebKey2020',
      'Multikey',
    ])
  })

  it('returns key for Ed25519VerificationKey2018 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyEd25519Fixture.verificationMethod[0], VerificationMethod)

    const key = keyDidEd25519.getPublicJwkFromVerificationMethod(verificationMethod)

    expect(key.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
  })

  it('returns key for Ed25519VerificationKey2020 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(
      {
        id: 'did:example:123',
        type: 'Ed25519VerificationKey2020',
        controller: 'did:example:123',
        publicKeyMultibase: 'z6MkkBWg1AnNxxWiq77gJDeHsLhGN6JV9Y3d6WiTifUs1sZi',
      },
      VerificationMethod
    )

    const key = keyDidEd25519.getPublicJwkFromVerificationMethod(verificationMethod) as PublicJwk<Ed25519PublicJwk>

    expect(TypedArrayEncoder.toBase58(key.publicKey.publicKey)).toBe('6jFdQvXwdR2FicGycegT2F9GYX2djeoGQVoXtPWr6enL')
  })

  it('throws an error if an invalid verification method is passed', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyEd25519Fixture.verificationMethod[0], VerificationMethod)

    verificationMethod.type = 'SomeRandomType'

    expect(() => keyDidEd25519.getPublicJwkFromVerificationMethod(verificationMethod)).toThrow(
      "Verification method with type 'SomeRandomType' not supported for key type Ed25519"
    )
  })
})

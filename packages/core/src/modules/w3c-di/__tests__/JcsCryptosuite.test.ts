import { getAgentConfig, getAgentContext } from '../../../../tests/helpers'
import { Hasher } from '../../../crypto'
import { MultiBaseEncoder, TypedArrayEncoder } from '../../../utils'
import { DidKey, DidsApi, parseDid } from '../../dids'
import { P256PublicJwk, type PublicJwk } from '../../kms'
import { JcsCryptosuite, type JcsCryptosuiteKeyParameters } from '../cryptosuites/JcsCryptosuite'
import { W3cDataIntegrityProcessingError, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'
import type { W3cDataIntegrityCryptosuiteProofOptions } from '../W3cDataIntegrityProof'

// SHA-384 with a P-256 key, which no real suite uses, so the tests show the parameters come from the subclass
const testKeyParameters: JcsCryptosuiteKeyParameters = {
  hashName: 'sha-384',
  signatureAlgorithm: 'ES256',
  signatureLength: 64,
}

class TestJcsCryptosuite extends JcsCryptosuite {
  public readonly cryptosuite = 'test-jcs-2026'
  protected readonly supportedKeys = 'P-256'

  protected getKeyParameters(publicJwk: PublicJwk) {
    return publicJwk.is(P256PublicJwk) ? testKeyParameters : undefined
  }
}

const p256Fingerprint = 'zDnaepBuvsQ8cpsWrVKw8fbpGpvPeNSjVPTWoq6cRqaYzBKVP'
const ed25519Fingerprint = 'z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2'
const kmsKeyId = 'test-kms-key-id'
const kmsBackend = 'test-kms-backend'

const proofOptions: W3cDataIntegrityCryptosuiteProofOptions = {
  type: 'DataIntegrityProof',
  cryptosuite: 'test-jcs-2026',
  created: '2026-11-17T00:00:00Z',
  verificationMethod: `did:key:${p256Fingerprint}#${p256Fingerprint}`,
  proofPurpose: 'assertionMethod',
}
const ed25519ProofOptions = {
  ...proofOptions,
  verificationMethod: `did:key:${ed25519Fingerprint}#${ed25519Fingerprint}`,
}
const document = { '@context': ['https://www.w3.org/ns/credentials/v2'], id: 'urn:example:jcs' }

const unsupportedKeyMessage =
  "The 'test-jcs-2026' cryptosuite only supports P-256 keys, found OKP key with crv 'Ed25519'"

async function expectProcessingError(
  promise: Promise<unknown>,
  errorCode: W3cDataIntegrityProcessingErrorCode,
  message: string
) {
  const error = await promise.then(
    () => undefined,
    (error: unknown) => error
  )
  expect(error).toBeInstanceOf(W3cDataIntegrityProcessingError)
  expect((error as W3cDataIntegrityProcessingError).issue.type).toBe(errorCode)
  expect((error as W3cDataIntegrityProcessingError).message).toContain(message)
}

describe('JcsCryptosuite', () => {
  let cryptosuite: TestJcsCryptosuite
  const keyManagementApi = {
    sign: vi.fn(),
    verify: vi.fn(),
  }

  beforeEach(() => {
    keyManagementApi.sign.mockReset().mockResolvedValue({ signature: new Uint8Array(64).fill(1), backend: 'node' })
    keyManagementApi.verify.mockReset().mockResolvedValue({ verified: true })

    const didsApi = {
      resolveDidDocument: vi.fn(async (didUrl: string) => DidKey.fromDid(parseDid(didUrl).did).didDocument),
      getCreatedDids: vi.fn(async () => [
        { keys: [{ didDocumentRelativeKeyId: `#${p256Fingerprint}`, kmsKeyId, kmsBackend }] },
      ]),
    }
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('JcsCryptosuiteTest'),
      registerInstances: [[DidsApi, didsApi]],
    })
    cryptosuite = new TestJcsCryptosuite(agentContext)
    // getAgentContext registers its own KeyManagementApi, so the mock is set on the instance (as in the eddsa tests)
    ;(cryptosuite as unknown as { keyManagementApi: unknown }).keyManagementApi = keyManagementApi
  })

  it('signs the hashes from the hash of the key parameters with their signature algorithm', async () => {
    const proof = await cryptosuite.createProof(document, proofOptions)

    const proofConfigHash = Hasher.hash(
      cryptosuite.proofConfiguration({ ...proofOptions, '@context': document['@context'] }),
      'sha-384'
    )
    const documentHash = Hasher.hash(cryptosuite.transformation(document, proofOptions), 'sha-384')

    expect(keyManagementApi.sign).toHaveBeenCalledWith({
      keyId: kmsKeyId,
      backend: kmsBackend,
      expectedPublicJwk: expect.objectContaining({ kty: 'EC', crv: 'P-256' }),
      algorithm: 'ES256',
      data: new Uint8Array([...proofConfigHash, ...documentHash]),
    })
    expect(MultiBaseEncoder.decode(proof.proofValue).data).toHaveLength(64)
  })

  it('verifies with the signature algorithm of the key parameters', async () => {
    const proof = await cryptosuite.createProof(document, proofOptions)

    await expect(cryptosuite.verifyProof({ unsecuredDocument: document, proof })).resolves.toEqual({
      verified: true,
      verifiedDocument: document,
    })
    expect(keyManagementApi.verify).toHaveBeenCalledWith({
      key: { publicJwk: expect.objectContaining({ kty: 'EC', crv: 'P-256' }) },
      algorithm: 'ES256',
      signature: MultiBaseEncoder.decode(proof.proofValue).data,
      data: keyManagementApi.sign.mock.calls[0][0].data,
    })
  })

  it('checks the proof type and the cryptosuite of the subclass', async () => {
    await expectProcessingError(
      cryptosuite.createProof(document, { ...proofOptions, cryptosuite: 'eddsa-jcs-2022' }),
      W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
      "cryptosuite must be 'test-jcs-2026'"
    )
  })

  it('rejects keys the subclass does not support, on create and on verify', async () => {
    await expectProcessingError(
      cryptosuite.createProof(document, ed25519ProofOptions),
      W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
      unsupportedKeyMessage
    )
    await expectProcessingError(
      cryptosuite.verifyProof({
        unsecuredDocument: document,
        proof: { ...ed25519ProofOptions, proofValue: MultiBaseEncoder.encode(new Uint8Array(64), 'base58btc') },
      }),
      W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
      unsupportedKeyMessage
    )
    expect(keyManagementApi.sign).not.toHaveBeenCalled()
    expect(keyManagementApi.verify).not.toHaveBeenCalled()
  })

  it('enforces the signature length of the key parameters', async () => {
    keyManagementApi.sign.mockResolvedValueOnce({ signature: new Uint8Array(63), backend: 'node' })

    await expectProcessingError(
      cryptosuite.createProof(document, proofOptions),
      W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
      'ES256 signature must be exactly 64 bytes, got 63'
    )

    const proof = await cryptosuite.createProof(document, proofOptions)
    const shortProofValue = MultiBaseEncoder.encode(TypedArrayEncoder.fromHex('01'.repeat(63)), 'base58btc')
    await expect(
      cryptosuite.verifyProof({ unsecuredDocument: document, proof: { ...proof, proofValue: shortProofValue } })
    ).resolves.toEqual({ verified: false, verifiedDocument: null })
    expect(keyManagementApi.verify).not.toHaveBeenCalled()
  })
})

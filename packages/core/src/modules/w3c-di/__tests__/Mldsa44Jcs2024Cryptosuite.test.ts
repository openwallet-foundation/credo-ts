import { getAgentConfig, getAgentContext } from '../../../../tests/helpers'
import type { AgentContext } from '../../../agent/context'
import { Hasher } from '../../../crypto'
import { MultiBaseEncoder, TypedArrayEncoder } from '../../../utils'
import { DidsApi } from '../../dids'
import { KeyManagementApi } from '../../kms'
import { Mldsa44Jcs2024Cryptosuite } from '../cryptosuites/mldsa44-jcs-2024/Mldsa44Jcs2024Cryptosuite'
import type { W3cDataIntegrityCryptosuiteProofOptions } from '../W3cDataIntegrityProof'

const verificationMethod = 'did:key:z6Mkexample#z6Mkexample'
const publicJwk = {
  kty: 'AKP',
  alg: 'ML-DSA-44',
  pub: TypedArrayEncoder.toBase64Url(new Uint8Array(1312).fill(1)),
}
const proofOptions: W3cDataIntegrityCryptosuiteProofOptions = {
  type: 'DataIntegrityProof',
  cryptosuite: 'mldsa44-jcs-2024',
  proofPurpose: 'assertionMethod',
  verificationMethod,
}

describe('Mldsa44Jcs2024Cryptosuite', () => {
  let agentContext: AgentContext
  let cryptosuite: Mldsa44Jcs2024Cryptosuite
  let keyManagementApi: { sign: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    const didsApi = {
      resolveDidDocument: vi.fn().mockResolvedValue({
        dereferenceVerificationMethod: vi.fn().mockReturnValue({
          id: verificationMethod,
          type: 'JsonWebKey2020',
          controller: 'did:key:z6Mkexample',
          publicKeyJwk: publicJwk,
        }),
      }),
      getCreatedDids: vi
        .fn()
        .mockResolvedValue([{ keys: [{ didDocumentRelativeKeyId: '#z6Mkexample', kmsKeyId: 'mldsa-key' }] }]),
    }
    keyManagementApi = {
      sign: vi.fn().mockResolvedValue({ signature: new Uint8Array(2420).fill(7) }),
      verify: vi.fn().mockResolvedValue({ verified: true }),
    }
    agentContext = getAgentContext({
      agentConfig: getAgentConfig('Mldsa44Jcs2024CryptosuiteTest'),
      registerInstances: [
        [DidsApi, didsApi],
        [KeyManagementApi, keyManagementApi],
      ],
    })
    cryptosuite = new Mldsa44Jcs2024Cryptosuite(agentContext)
    ;(cryptosuite as unknown as { keyManagementApi: KeyManagementApi }).keyManagementApi =
      keyManagementApi as unknown as KeyManagementApi
  })

  test('canonicalizes documents and hashes proof configuration before document data', () => {
    const document = cryptosuite.transformation({ b: 2, a: 1 }, proofOptions)
    const proofConfig = cryptosuite.proofConfiguration(proofOptions)
    expect(document).toBe('{"a":1,"b":2}')
    const expectedHashData = new Uint8Array(64)
    expectedHashData.set(Hasher.hash(TypedArrayEncoder.fromUtf8String(proofConfig), 'sha-256'), 0)
    expectedHashData.set(Hasher.hash(TypedArrayEncoder.fromUtf8String(document), 'sha-256'), 32)
    expect(cryptosuite.hashing(document, proofConfig)).toEqual(expectedHashData)
  })

  test('creates and verifies a 2420-byte ML-DSA-44 signature', async () => {
    const document = { id: 'urn:example:1', value: 'signed' }
    const proof = await cryptosuite.createProof(document, proofOptions)
    const decodedProof = MultiBaseEncoder.decode(proof.proofValue)

    expect(decodedProof.baseName).toBe('base64url')
    expect(decodedProof.data).toHaveLength(2420)
    expect(keyManagementApi.sign).toHaveBeenCalledWith(
      expect.objectContaining({ algorithm: 'ML-DSA-44', keyId: 'mldsa-key' })
    )

    const result = await cryptosuite.verifyProof({ unsecuredDocument: document, proof })
    expect(result).toEqual({ verified: true, verifiedDocument: document })
    expect(keyManagementApi.verify).toHaveBeenCalledWith(
      expect.objectContaining({ algorithm: 'ML-DSA-44', signature: decodedProof.data })
    )
  })

  test('verifies structurally equivalent inline contexts and preserves repeated object references', async () => {
    const context = { name: 'https://example.org/name' }
    const shared = { value: 'shared' }
    const document = {
      '@context': ['https://www.w3.org/ns/credentials/v2', context],
      id: 'urn:example:1',
      first: shared,
      second: shared,
    }
    const proof = await cryptosuite.createProof(document, proofOptions)
    const parsedDocument = JSON.parse(JSON.stringify(document))

    await expect(cryptosuite.verifyProof({ unsecuredDocument: parsedDocument, proof })).resolves.toMatchObject({
      verified: true,
    })
  })

  test('rejects signatures with an invalid encoding or length without calling verification', async () => {
    const document = { id: 'urn:example:1' }
    const invalidProofs = [
      { ...proofOptions, proofValue: MultiBaseEncoder.encode(new Uint8Array(2420), 'base58btc') },
      { ...proofOptions, proofValue: MultiBaseEncoder.encode(new Uint8Array(2419), 'base64url') },
    ]

    for (const proof of invalidProofs) {
      const result = await cryptosuite.verifyProof({ unsecuredDocument: document, proof })
      expect(result).toEqual({ verified: false, verifiedDocument: null })
    }

    expect(keyManagementApi.verify).not.toHaveBeenCalled()
  })

  test('rejects ML-DSA-65 keys', async () => {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    vi.spyOn(didsApi, 'resolveDidDocument').mockResolvedValue({
      dereferenceVerificationMethod: vi.fn().mockReturnValue({
        id: verificationMethod,
        type: 'JsonWebKey2020',
        controller: 'did:key:z6Mkexample',
        publicKeyJwk: {
          ...publicJwk,
          alg: 'ML-DSA-65',
          pub: TypedArrayEncoder.toBase64Url(new Uint8Array(1952).fill(1)),
        },
      }),
    } as never)

    await expect(cryptosuite.createProof({ id: 'urn:example:1' }, proofOptions)).rejects.toThrow(
      'verification method must use an ML-DSA-44 public key'
    )
    expect(keyManagementApi.sign).not.toHaveBeenCalled()
  })
})

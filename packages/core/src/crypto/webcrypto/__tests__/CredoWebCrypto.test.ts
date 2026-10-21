import { p521 } from '@noble/curves/nist.js'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import type { KeyManagementService } from '../../../modules/kms'
import { TypedArrayEncoder } from '../../../utils'
import { Hasher } from '../../hashes'
import { CredoWebCrypto } from '../CredoWebCrypto'
import type { KeyGenAlgorithm, KeySignParams } from '../types'

const algorithmToTestName = (algorithm: Record<string, unknown> | string) =>
  typeof algorithm === 'string' ? algorithm : `${algorithm.name} - ${algorithm.namedCurve} - ${algorithm.hash}`

describe('CredoWebCrypto', () => {
  let webCrypto: CredoWebCrypto

  const supportedAlgorithms: Array<Partial<KeyGenAlgorithm & KeySignParams>> = [
    { hash: 'SHA-256', name: 'ECDSA', namedCurve: 'P-256' },
    { hash: 'SHA-384', name: 'ECDSA', namedCurve: 'P-384' },
    { hash: 'SHA-256', name: 'ECDSA', namedCurve: 'K-256' },
    { name: 'Ed25519' },
  ]

  beforeAll(async () => {
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('X509Service'),
    })

    webCrypto = new CredoWebCrypto(agentContext)
  })

  it('Generate random values', async () => {
    expect(webCrypto.getRandomValues(null)).toBeNull()
    expect(webCrypto.getRandomValues(new Uint8Array(100)).length).not.toStrictEqual(0)
    expect(webCrypto.getRandomValues(new Uint8Array(100)).every((v) => v === 0)).toBeFalsy()
  })

  describe('key creation', () => {
    supportedAlgorithms.forEach((algorithm) => {
      it(`should create key with: ${algorithmToTestName(algorithm)}`, async () => {
        await expect(webCrypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])).resolves.toBeDefined()
      })
    })
  })

  describe('key signing', () => {
    supportedAlgorithms.forEach((algorithm) => {
      it(`should create signature with: ${algorithmToTestName(algorithm)}`, async () => {
        const message = new Uint8Array(10).fill(10)
        const key = await webCrypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])

        const signature = await webCrypto.subtle.sign(algorithm, key.privateKey, message)
        expect(signature).toBeTruthy()
      })
    })
  })

  describe('signature verification', () => {
    supportedAlgorithms.forEach((algorithm) => {
      it(`should verify signature with: ${algorithmToTestName(algorithm)}`, async () => {
        const message = new Uint8Array(10).fill(10)
        const key = await webCrypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])
        const signature = await webCrypto.subtle.sign(algorithm, key.privateKey, message)

        const isValid = await webCrypto.subtle.verify(algorithm, key.publicKey, signature, message)

        expect(isValid).toBeTruthy()
      })
    })

    it.each(['SHA-256', 'SHA-384', 'SHA-512'] as const)(
      'verifies P-521 signatures with %s locally when the KMS does not support ES512 verification',
      async (hash) => {
        const verify = vi.fn()
        const isOperationSupported = vi.fn(
          (_agentContext: unknown, operation: { operation: string; algorithm?: string }) =>
            operation.operation !== 'verify' || operation.algorithm !== 'ES512'
        )
        const backend = {
          backend: 'no-es512',
          isOperationSupported,
          verify,
        } as unknown as KeyManagementService
        const p521WebCrypto = new CredoWebCrypto(getAgentContext({ kmsBackends: [backend] }))
        const secretKey = p521.utils.randomSecretKey()
        const publicKey = p521.getPublicKey(secretKey, false)
        const message = new TextEncoder().encode(`P-521 verification with ${hash}`)
        const digest = Hasher.hash(message, hash.toLowerCase())
        const signature = p521.sign(digest, secretKey, { prehash: false, lowS: false })
        const key = await p521WebCrypto.subtle.importKey(
          'jwk',
          {
            kty: 'EC',
            crv: 'P-521',
            x: TypedArrayEncoder.toBase64Url(publicKey.subarray(1, 67)),
            y: TypedArrayEncoder.toBase64Url(publicKey.subarray(67)),
          },
          { name: 'ECDSA', namedCurve: 'P-521' },
          true,
          ['verify']
        )

        await expect(p521WebCrypto.subtle.verify({ name: 'ECDSA', hash }, key, signature, message)).resolves.toBe(true)

        const tamperedMessage = new Uint8Array(message)
        tamperedMessage[0] ^= 1
        await expect(
          p521WebCrypto.subtle.verify({ name: 'ECDSA', hash }, key, signature, tamperedMessage)
        ).resolves.toBe(false)

        const tamperedSignature = new Uint8Array(signature)
        tamperedSignature[0] ^= 1
        await expect(
          p521WebCrypto.subtle.verify({ name: 'ECDSA', hash }, key, tamperedSignature, message)
        ).resolves.toBe(false)

        expect(isOperationSupported).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ operation: 'verify', algorithm: 'ES512' })
        )
        expect(verify).not.toHaveBeenCalled()
      }
    )
  })
})

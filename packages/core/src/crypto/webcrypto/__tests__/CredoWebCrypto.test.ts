import { p521 } from '@noble/curves/nist.js'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { PublicJwk } from '../../../modules/kms'
import { Hasher } from '../../hashes'
import { CredoWalletWebCrypto } from '../CredoWalletWebCrypto'
import { CredoWebCrypto } from '../CredoWebCrypto'
import { CredoWebCryptoKey } from '../CredoWebCryptoKey'
import type { KeyGenAlgorithm, KeySignParams, KeyVerifyParams } from '../types'

const algorithmToTestName = (algorithm: Record<string, unknown> | string) =>
  typeof algorithm === 'string' ? algorithm : `${algorithm.name} - ${algorithm.namedCurve} - ${algorithm.hash}`

describe('CredoWebCrypto', () => {
  let webCrypto: CredoWebCrypto
  let walletWebCrypto: CredoWalletWebCrypto

  const supportedAlgorithms: Array<Partial<KeyGenAlgorithm & KeySignParams>> = [
    { hash: 'SHA-256', name: 'ECDSA', namedCurve: 'P-256' },
    { hash: 'SHA-384', name: 'ECDSA', namedCurve: 'P-384' },
    { hash: 'SHA-512', name: 'ECDSA', namedCurve: 'P-521' },
    { hash: 'SHA-256', name: 'ECDSA', namedCurve: 'K-256' },
    { name: 'Ed25519' },
  ]

  beforeAll(async () => {
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('X509Service'),
    })

    webCrypto = new CredoWebCrypto(agentContext)
    walletWebCrypto = new CredoWalletWebCrypto(agentContext)
  })

  it('Generate random values', async () => {
    expect(webCrypto.getRandomValues(null)).toBeNull()
    expect(webCrypto.getRandomValues(new Uint8Array(100)).length).not.toStrictEqual(0)
    expect(webCrypto.getRandomValues(new Uint8Array(100)).every((v) => v === 0)).toBeFalsy()

    const array = new Uint8Array(100)
    expect(webCrypto.getRandomValues(array)).toBe(array)
    expect(array.every((v) => v === 0)).toBeFalsy()
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

    it.each(['SHA-256', 'SHA-384'] as const)(
      'verifies P-521 signatures with non-standard %s hashing in CredoWalletWebCrypto',
      async (hash) => {
        const algorithm = { name: 'ECDSA', hash } as const satisfies KeyVerifyParams
        const message = new Uint8Array([1, 2, 3, 4])
        const privateKey = p521.utils.randomSecretKey()
        const publicKey = p521.getPublicKey(privateKey)
        const publicJwk = PublicJwk.fromPublicKey({ kty: 'EC', crv: 'P-521', publicKey })
        const key = new CredoWebCryptoKey(publicJwk, { name: 'ECDSA', namedCurve: 'P-521' }, true, 'public', ['verify'])
        const signature = p521.sign(Hasher.hash(message, hash.toLowerCase()), privateKey, {
          prehash: false,
          lowS: false,
        })

        await expect(walletWebCrypto.verify(key, algorithm, message, signature)).resolves.toBe(true)

        signature[0] ^= 1
        await expect(walletWebCrypto.verify(key, algorithm, message, signature)).resolves.toBe(false)
      }
    )
  })
})

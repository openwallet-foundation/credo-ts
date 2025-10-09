import type { KeyGenAlgorithm, KeySignParams } from '../types'

import { InMemoryWallet } from '../../../../../../tests/InMemoryWallet'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { CredoWebCrypto } from '../CredoWebCrypto'

const algorithmToTestName = (algorithm: Record<string, unknown> | string) =>
  typeof algorithm === 'string' ? algorithm : `${algorithm.name} - ${algorithm.namedCurve} - ${algorithm.hash}`

describe('CredoWebCrypto', () => {
  let webCrypto: CredoWebCrypto

  const supportedAlgorithms: Array<Partial<KeyGenAlgorithm & KeySignParams>> = [
    { hash: 'SHA-256', name: 'ECDSA', namedCurve: 'P-256' },
    { hash: 'SHA-256', name: 'ECDSA', namedCurve: 'P-384' },
    { hash: 'SHA-256', name: 'ECDSA', namedCurve: 'K-256' },
    'Ed25519',
  ]

  beforeAll(async () => {
    const agentConfig = getAgentConfig('X509Service')
    const wallet = new InMemoryWallet()
    const agentContext = getAgentContext({ wallet })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)

    webCrypto = new CredoWebCrypto(agentContext)
  })

  it('Generate random values', async () => {
    expect(webCrypto.getRandomValues(null)).toBeNull()
    expect(webCrypto.getRandomValues(new Uint8Array(100)).length).not.toStrictEqual(0)
    expect(webCrypto.getRandomValues(new Uint8Array(100)).every((v) => v === 0)).toBeFalsy()
  })

  describe('key creation', () => {
    supportedAlgorithms.map((algorithm) => {
      it(`should create key with: ${algorithmToTestName(algorithm)}`, async () => {
        expect(async () => await await webCrypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])).resolves
      })
    })
  })

  describe('key signing', () => {
    supportedAlgorithms.map((algorithm) => {
      it(`should create signature with: ${algorithmToTestName(algorithm)}`, async () => {
        const message = new Uint8Array(10).fill(10)
        const key = await webCrypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])

        expect(async () => await webCrypto.subtle.sign(algorithm, key.privateKey, message)).resolves
      })
    })
  })

  describe('signature verification', () => {
    supportedAlgorithms.map((algorithm) => {
      it(`should verify signature with: ${algorithmToTestName(algorithm)}`, async () => {
        const message = new Uint8Array(10).fill(10)
        const key = await webCrypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])
        const signature = await webCrypto.subtle.sign(algorithm, key.privateKey, message)

        const isValid = await webCrypto.subtle.verify(algorithm, key.publicKey, signature, message)

        expect(isValid).toBeTruthy()
      })
    })
  })
})

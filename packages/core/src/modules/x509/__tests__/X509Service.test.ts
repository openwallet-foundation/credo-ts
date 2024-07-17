import type { AgentContext } from '../../../agent'
import type { KeyGenAlgorithm, KeySignParams } from '../../../crypto/webcrypto/types'

import * as x509 from '@peculiar/x509'

import { InMemoryWallet } from '../../../../../../tests/InMemoryWallet'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyType } from '../../../crypto/KeyType'
import { CredoWebCrypto, CredoWebCryptoKey } from '../../../crypto/webcrypto'
import { X509Error } from '../X509Error'
import { X509Service } from '../X509Service'

/**
 *
 * Get the next month, accounting for a new year
 *
 */
const getNextMonth = () => {
  const now = new Date()
  let nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  if (now.getMonth() == 11) {
    nextMonth = new Date(now.getFullYear() + 1, 0, 1)
  }

  return nextMonth
}

/**
 *
 * Get the last month, accounting for a new year
 *
 */
const getLastMonth = () => {
  const now = new Date()
  let lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  if (now.getMonth() == 0) {
    lastMonth = new Date(now.getFullYear() - 1, 0, 1)
  }
  return lastMonth
}

describe('X509Service', () => {
  let wallet: InMemoryWallet
  let agentContext: AgentContext
  let x5c: Array<string>

  beforeAll(async () => {
    const agentConfig = getAgentConfig('X509Service')
    wallet = new InMemoryWallet()
    agentContext = getAgentContext({ wallet })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)

    const algorithm: KeyGenAlgorithm = { name: 'ECDSA', namedCurve: 'P-256' }
    const signingAlgorithm: KeySignParams = { name: 'ECDSA', hash: 'SHA-256' }

    const rootKey = await wallet.createKey({ keyType: KeyType.P256 })
    const webCryptoRootKeys = {
      publicKey: new CredoWebCryptoKey(rootKey, algorithm, true, 'public', ['verify']),
      privateKey: new CredoWebCryptoKey(rootKey, algorithm, false, 'private', ['sign']),
    }

    const intermediateKey = await wallet.createKey({ keyType: KeyType.P256 })
    const webCryptoIntermediateKeys = {
      publicKey: new CredoWebCryptoKey(intermediateKey, algorithm, true, 'public', ['verify']),
      privateKey: new CredoWebCryptoKey(intermediateKey, algorithm, false, 'private', ['sign']),
    }

    const leafKey = await wallet.createKey({ keyType: KeyType.P256 })
    const webCryptoLeafKeys = {
      publicKey: new CredoWebCryptoKey(leafKey, algorithm, true, 'public', ['verify']),
      privateKey: new CredoWebCryptoKey(leafKey, algorithm, false, 'private', ['sign']),
    }

    x509.cryptoProvider.set(new CredoWebCrypto(agentContext))

    const rootCert = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: '01',
      name: 'CN=Root',
      notBefore: getLastMonth(),
      notAfter: getNextMonth(),
      keys: webCryptoRootKeys,
      signingAlgorithm,
    })

    const intermediateCert = await x509.X509CertificateGenerator.create({
      serialNumber: '02',
      subject: 'CN=Intermediate',
      issuer: rootCert.subject,
      notBefore: getLastMonth(),
      notAfter: getNextMonth(),
      signingKey: webCryptoRootKeys.privateKey,
      publicKey: webCryptoIntermediateKeys.publicKey,
      signingAlgorithm,
    })

    const leafCert = await x509.X509CertificateGenerator.create({
      serialNumber: '03',
      subject: 'CN=Leaf',
      issuer: intermediateCert.subject,
      notBefore: getLastMonth(),
      notAfter: getNextMonth(),
      signingKey: webCryptoIntermediateKeys.privateKey,
      publicKey: webCryptoLeafKeys.publicKey,
      signingAlgorithm,
    })

    const chain = new x509.X509ChainBuilder({
      certificates: [rootCert, intermediateCert, leafCert],
    })

    x5c = (await chain.build(leafCert)).map((cert) => cert.toString('base64'))

    x509.cryptoProvider.clear()
  })

  afterAll(async () => {
    await wallet.close()
  })

  it('should correctly parse x5c chain provided as a test-vector', async () => {
    const x5c = [
      'MIICaTCCAg+gAwIBAgIUShyxcIZGiPV3wBRp4YOlNp1I13YwCgYIKoZIzj0EAwIwgYkxCzAJBgNVBAYTAkRFMQ8wDQYDVQQIDAZiZHIuZGUxDzANBgNVBAcMBkJlcmxpbjEMMAoGA1UECgwDQkRSMQ8wDQYDVQQLDAZNYXVyZXIxHTAbBgNVBAMMFGlzc3VhbmNlLXRlc3QuYmRyLmRlMRowGAYJKoZIhvcNAQkBFgt0ZXN0QGJkci5kZTAeFw0yNDA1MjgwODIyMjdaFw0zNDA0MDYwODIyMjdaMIGJMQswCQYDVQQGEwJERTEPMA0GA1UECAwGYmRyLmRlMQ8wDQYDVQQHDAZCZXJsaW4xDDAKBgNVBAoMA0JEUjEPMA0GA1UECwwGTWF1cmVyMR0wGwYDVQQDDBRpc3N1YW5jZS10ZXN0LmJkci5kZTEaMBgGCSqGSIb3DQEJARYLdGVzdEBiZHIuZGUwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASygZ1Ma0m9uif4n8g3CiCP+E1r2KWFxVmS6LRWqUBMgn5fODKIBftdzVSbv/38gujy5qxh/q5bLcT+yLilazCao1MwUTAdBgNVHQ4EFgQUMGdPNMIdo3iHfqt2jlTnBNCfRNAwHwYDVR0jBBgwFoAUMGdPNMIdo3iHfqt2jlTnBNCfRNAwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiAu2h5xulXReb5IhgpkYiYR1BONTtsjT7nfzQAhL4ISOQIhAK6jKwwf6fTTSZwvJUOAu7dz1Dy/DmH19Lef0zqaNNht',
    ]

    const chain = await X509Service.validateCertificateChain(agentContext, { certificateChain: x5c })

    expect(chain.length).toStrictEqual(1)
    expect(chain[0].sanDnsNames).toStrictEqual([])
    expect(chain[0].sanUriNames).toStrictEqual([])
  })

  it('should parse a valid X.509 certificate', async () => {
    const key = await agentContext.wallet.createKey({ keyType: KeyType.P256 })
    const certificate = await X509Service.createSelfSignedCertificate(agentContext, {
      key,
      extensions: [
        [
          { type: 'url', value: 'animo.id' },
          { type: 'dns', value: 'paradym.id' },
        ],
        [
          { type: 'dns', value: 'wallet.paradym.id' },
          { type: 'dns', value: 'animo.id' },
        ],
      ],
    })
    const encodedCertificate = certificate.toString('base64')

    const x509Certificate = X509Service.parseCertificate(agentContext, { encodedCertificate })

    expect(x509Certificate).toMatchObject({
      sanDnsNames: expect.arrayContaining(['paradym.id', 'wallet.paradym.id', 'animo.id']),
      sanUriNames: expect.arrayContaining(['animo.id']),
    })

    expect(x509Certificate.publicKey.publicKey.length).toStrictEqual(33)
  })

  it('should validate a valid certificate chain', async () => {
    const validatedChain = await X509Service.validateCertificateChain(agentContext, { certificateChain: x5c })

    expect(validatedChain.length).toStrictEqual(3)

    const leafCertificate = validatedChain[validatedChain.length - 1]

    expect(leafCertificate).toMatchObject({
      publicKey: expect.objectContaining({
        keyType: KeyType.P256,
      }),
      privateKey: undefined,
    })
  })

  it('should generate a self-signed X509 Certificate', async () => {
    const key = await agentContext.wallet.createKey({ keyType: KeyType.P256 })

    const selfSignedCertificate = await X509Service.createSelfSignedCertificate(agentContext, {
      key,
    })

    expect(selfSignedCertificate.publicKey.publicKeyBase58).toStrictEqual(key.publicKeyBase58)
    expect(selfSignedCertificate.sanDnsNames).toStrictEqual([])
    expect(selfSignedCertificate.sanUriNames).toStrictEqual([])

    const pemCertificate = selfSignedCertificate.toString('pem')

    expect(pemCertificate.startsWith('-----BEGIN CERTIFICATE-----\n')).toBeTruthy()
    expect(pemCertificate.endsWith('\n-----END CERTIFICATE-----')).toBeTruthy()
  })

  it('should generate a self-signed X509 Certificate with extensions', async () => {
    const key = await agentContext.wallet.createKey({ keyType: KeyType.P256 })

    const selfSignedCertificate = await X509Service.createSelfSignedCertificate(agentContext, {
      key,
      extensions: [
        [
          { type: 'dns', value: 'dns:me' },
          { type: 'url', value: 'some://scheme' },
        ],
      ],
    })

    expect(selfSignedCertificate.publicKey).toMatchObject({
      publicKeyBase58: key.publicKeyBase58,
    })

    expect(selfSignedCertificate).toMatchObject({
      sanDnsNames: expect.arrayContaining(['dns:me']),
      sanUriNames: expect.arrayContaining(['some://scheme']),
    })
  })

  it('should not validate a certificate with a `notBefore` of > Date.now', async () => {
    const key = await agentContext.wallet.createKey({ keyType: KeyType.P256 })

    const selfSignedCertificate = (
      await X509Service.createSelfSignedCertificate(agentContext, {
        key,
        notBefore: getNextMonth(),
      })
    ).toString('base64')

    expect(
      async () =>
        await X509Service.validateCertificateChain(agentContext, {
          certificateChain: [selfSignedCertificate],
        })
    ).rejects.toThrow(X509Error)
  })

  it('should not validate a certificate with a `notAfter` of < Date.now', async () => {
    const key = await agentContext.wallet.createKey({ keyType: KeyType.P256 })

    const selfSignedCertificate = (
      await X509Service.createSelfSignedCertificate(agentContext, {
        key,
        notAfter: getLastMonth(),
      })
    ).toString('base64')

    expect(
      async () =>
        await X509Service.validateCertificateChain(agentContext, {
          certificateChain: [selfSignedCertificate],
        })
    ).rejects.toThrow(X509Error)
  })

  it('should not validate a certificate chain if incorrect signing order', async () => {
    const certificateChain = [x5c[1], x5c[2], x5c[0]]

    expect(
      async () =>
        await X509Service.validateCertificateChain(agentContext, {
          certificateChain,
        })
    ).rejects.toThrow(X509Error)
  })
})

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { AgentContext } from '../../../agent'

import { id_ce_basicConstraints, id_ce_extKeyUsage, id_ce_keyUsage } from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'

import { InMemoryWallet } from '../../../../../../tests/InMemoryWallet'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyType } from '../../../crypto/KeyType'
import { getJwkFromKey, P256Jwk } from '../../../crypto/jose/jwk'
import { CredoWebCrypto } from '../../../crypto/webcrypto'
import { X509Error } from '../X509Error'
import { X509Service } from '../X509Service'

import { X509KeyUsage, TypedArrayEncoder, X509ExtendedKeyUsage, Key } from '@credo-ts/core'

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
  let certificateChain: Array<string>

  beforeAll(async () => {
    const agentConfig = getAgentConfig('X509Service')
    wallet = new InMemoryWallet()
    agentContext = getAgentContext({ wallet })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)

    const rootKey = await wallet.createKey({ keyType: KeyType.P256 })
    const intermediateKey = await wallet.createKey({ keyType: KeyType.P256 })
    const leafKey = await wallet.createKey({ keyType: KeyType.P256 })

    x509.cryptoProvider.set(new CredoWebCrypto(agentContext))

    const rootCert = await X509Service.createCertificate(agentContext, {
      serialNumber: '01',
      issuer: { commonName: 'Root' },
      authorityKey: rootKey,
      validity: {
        notBefore: getLastMonth(),
        notAfter: getNextMonth(),
      },
    })

    const intermediateCert = await X509Service.createCertificate(agentContext, {
      serialNumber: '02',
      issuer: rootCert.subject,
      authorityKey: rootKey,
      subject: { commonName: 'Intermediate' },
      subjectPublicKey: intermediateKey,
      validity: {
        notBefore: getLastMonth(),
        notAfter: getNextMonth(),
      },
    })

    const leafCert = await X509Service.createCertificate(agentContext, {
      serialNumber: '03',
      issuer: intermediateCert.subject,
      authorityKey: intermediateKey,
      subject: { commonName: 'Leaf' },
      subjectPublicKey: leafKey,
      validity: {
        notBefore: getLastMonth(),
        notAfter: getNextMonth(),
      },
    })

    const builder = new x509.X509ChainBuilder({
      certificates: [
        new x509.X509Certificate(rootCert.rawCertificate),
        new x509.X509Certificate(intermediateCert.rawCertificate),
      ],
    })
    certificateChain = (await builder.build(new x509.X509Certificate(leafCert.rawCertificate))).map((c) =>
      c.toString('base64')
    )

    x509.cryptoProvider.clear()
  })

  afterAll(async () => {
    await wallet.close()
  })

  it('should create a valid self-signed certificate', async () => {
    const authorityKey = await wallet.createKey({ keyType: KeyType.P256 })
    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey,
      issuer: { commonName: 'credo' },
    })

    expect(certificate.publicKey.keyType).toStrictEqual(KeyType.P256)
    expect(certificate.publicKey.publicKey.length).toStrictEqual(65)
    expect(certificate.subject).toStrictEqual('CN=credo')
  })

  it('should create a valid self-signed certificate with a critical extension', async () => {
    const authorityKey = await wallet.createKey({ keyType: KeyType.P256 })
    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey,
      issuer: { commonName: 'credo' },
      extensions: {
        keyUsage: {
          usages: [X509KeyUsage.CrlSign, X509KeyUsage.KeyCertSign],
          markAsCritical: true,
        },
        extendedKeyUsage: {
          usages: [X509ExtendedKeyUsage.MdlDs],
          markAsCritical: false,
        },
      },
    })

    expect(certificate.isExtensionCritical(id_ce_keyUsage)).toStrictEqual(true)
    expect(certificate.isExtensionCritical(id_ce_extKeyUsage)).toStrictEqual(false)
  })

  it('should create a valid self-signed certifcate with extensions', async () => {
    const authorityKey = await wallet.createKey({ keyType: KeyType.P256 })
    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey,
      issuer: { commonName: 'credo' },
      extensions: {
        subjectAlternativeName: {
          name: [
            { type: 'url', value: 'animo.id' },
            { type: 'dns', value: 'paradym.id' },
          ],
        },
        keyUsage: {
          usages: [X509KeyUsage.DigitalSignature],
        },
        extendedKeyUsage: {
          usages: [X509ExtendedKeyUsage.MdlDs],
        },
        subjectKeyIdentifier: {
          include: true,
        },
      },
    })

    expect(certificate).toMatchObject({
      sanDnsNames: expect.arrayContaining(['paradym.id']),
      sanUriNames: expect.arrayContaining(['animo.id']),
      keyUsage: expect.arrayContaining([X509KeyUsage.DigitalSignature]),
      extendedKeyUsage: expect.arrayContaining([X509ExtendedKeyUsage.MdlDs]),
      subjectKeyIdentifier: TypedArrayEncoder.toHex(authorityKey.publicKey),
    })
  })

  it('should create a valid self-signed certifcate as IACA Root + DCS for mDoc', async () => {
    const authorityKey = await wallet.createKey({ keyType: KeyType.P256 })
    const documentSignerKey = await wallet.createKey({ keyType: KeyType.P256 })

    const mdocRootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey,
      issuer: { commonName: 'credo', countryName: 'NL' },
      validity: {
        notBefore: getLastMonth(),
        notAfter: getNextMonth(),
      },
      extensions: {
        subjectKeyIdentifier: {
          include: true,
        },
        keyUsage: {
          usages: [X509KeyUsage.KeyCertSign, X509KeyUsage.CrlSign],
          markAsCritical: true,
        },
        issuerAlternativeName: {
          name: [{ type: 'url', value: 'animo.id' }],
        },
        basicConstraints: {
          ca: true,
          pathLenConstraint: 0,
          markAsCritical: true,
        },
        crlDistributionPoints: {
          urls: ['https://animo.id'],
        },
      },
    })

    expect(mdocRootCertificate.isExtensionCritical(id_ce_basicConstraints)).toStrictEqual(true)
    expect(mdocRootCertificate.isExtensionCritical(id_ce_keyUsage)).toStrictEqual(true)

    expect(mdocRootCertificate).toMatchObject({
      ianUriNames: expect.arrayContaining(['animo.id']),
      keyUsage: expect.arrayContaining([X509KeyUsage.KeyCertSign, X509KeyUsage.CrlSign]),
      subjectKeyIdentifier: TypedArrayEncoder.toHex(authorityKey.publicKey),
    })

    const mdocDocumentSignerCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey,
      subjectPublicKey: new Key(documentSignerKey.publicKey, KeyType.P256),
      issuer: mdocRootCertificate.issuer,
      subject: { commonName: 'credo dcs', countryName: 'NL' },
      validity: {
        notBefore: getLastMonth(),
        notAfter: getNextMonth(),
      },
      extensions: {
        authorityKeyIdentifier: {
          include: true,
        },
        subjectKeyIdentifier: {
          include: true,
        },
        keyUsage: {
          usages: [X509KeyUsage.DigitalSignature],
          markAsCritical: true,
        },
        subjectAlternativeName: {
          name: [{ type: 'url', value: 'paradym.id' }],
        },
        issuerAlternativeName: {
          name: mdocRootCertificate.issuerAlternativeNames!,
        },
        extendedKeyUsage: {
          usages: [X509ExtendedKeyUsage.MdlDs],
          markAsCritical: true,
        },
        crlDistributionPoints: {
          urls: ['https://animo.id'],
        },
      },
    })

    expect(mdocDocumentSignerCertificate.isExtensionCritical(id_ce_keyUsage)).toStrictEqual(true)
    expect(mdocDocumentSignerCertificate.isExtensionCritical(id_ce_extKeyUsage)).toStrictEqual(true)

    expect(mdocDocumentSignerCertificate).toMatchObject({
      ianUriNames: expect.arrayContaining(['animo.id']),
      sanUriNames: expect.arrayContaining(['paradym.id']),
      keyUsage: expect.arrayContaining([X509KeyUsage.DigitalSignature]),
      extendedKeyUsage: expect.arrayContaining([X509ExtendedKeyUsage.MdlDs]),
      subjectKeyIdentifier: TypedArrayEncoder.toHex(documentSignerKey.publicKey),
      authorityKeyIdentifier: TypedArrayEncoder.toHex(authorityKey.publicKey),
    })
  })

  it('should create a valid leaf certificate', async () => {
    const authorityKey = await wallet.createKey({ keyType: KeyType.P256 })
    const subjectKey = await wallet.createKey({ keyType: KeyType.P256 })

    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey,
      subjectPublicKey: new Key(subjectKey.publicKey, KeyType.P256),
      issuer: { commonName: 'credo' },
      subject: { commonName: 'DCS credo' },
      extensions: {
        subjectKeyIdentifier: { include: true },
        authorityKeyIdentifier: { include: true },
      },
    })

    expect(certificate.subjectKeyIdentifier).toStrictEqual(TypedArrayEncoder.toHex(subjectKey.publicKey))
    expect(certificate.authorityKeyIdentifier).toStrictEqual(TypedArrayEncoder.toHex(authorityKey.publicKey))
    expect(certificate.publicKey.keyType).toStrictEqual(KeyType.P256)
    expect(certificate.publicKey.publicKey.length).toStrictEqual(65)
    expect(certificate.subject).toStrictEqual('CN=DCS credo')
    expect(certificate).toMatchObject({
      subjectKeyIdentifier: TypedArrayEncoder.toHex(subjectKey.publicKey),
      authorityKeyIdentifier: TypedArrayEncoder.toHex(authorityKey.publicKey),
    })
  })

  it('should correctly parse an X.509 certificate with an uncompressed key to a JWK', async () => {
    const encodedCertificate =
      'MIICKjCCAdCgAwIBAgIUV8bM0wi95D7KN0TyqHE42ru4hOgwCgYIKoZIzj0EAwIwUzELMAkGA1UEBhMCVVMxETAPBgNVBAgMCE5ldyBZb3JrMQ8wDQYDVQQHDAZBbGJhbnkxDzANBgNVBAoMBk5ZIERNVjEPMA0GA1UECwwGTlkgRE1WMB4XDTIzMDkxNDE0NTUxOFoXDTMzMDkxMTE0NTUxOFowUzELMAkGA1UEBhMCVVMxETAPBgNVBAgMCE5ldyBZb3JrMQ8wDQYDVQQHDAZBbGJhbnkxDzANBgNVBAoMBk5ZIERNVjEPMA0GA1UECwwGTlkgRE1WMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEiTwtg0eQbcbNabf2Nq9L/VM/lhhPCq2s0Qgw2kRx29tgrBcNHPxTT64tnc1Ij3dH/fl42SXqMenpCDw4K6ntU6OBgTB/MB0GA1UdDgQWBBSrbS4DuR1JIkAzj7zK3v2TM+r2xzAfBgNVHSMEGDAWgBSrbS4DuR1JIkAzj7zK3v2TM+r2xzAPBgNVHRMBAf8EBTADAQH/MCwGCWCGSAGG+EIBDQQfFh1PcGVuU1NMIEdlbmVyYXRlZCBDZXJ0aWZpY2F0ZTAKBggqhkjOPQQDAgNIADBFAiAJ/Qyrl7A+ePZOdNfc7ohmjEdqCvxaos6//gfTvncuqQIhANo4q8mKCA9J8k/+zh//yKbN1bLAtdqPx7dnrDqV3Lg+'

    const x509Certificate = X509Service.parseCertificate(agentContext, { encodedCertificate })

    expect(x509Certificate.publicKey.keyType).toStrictEqual(KeyType.P256)
    expect(x509Certificate.publicKey.publicKey.length).toStrictEqual(65)
    expect(x509Certificate.publicKey.publicKeyBase58).toStrictEqual(
      'QDaLvg9KroUnpuviZ9W7Q3DauqAuKiJN4sKC6cLo4HtxnpJCwwayNBLzRpsCHfHsLJsiKDeTCV8LqmCBSPkmiJNe'
    )

    const jwk = getJwkFromKey(x509Certificate.publicKey)

    expect(jwk).toBeInstanceOf(P256Jwk)
    expect(jwk.toJson()).toMatchObject({
      x: 'iTwtg0eQbcbNabf2Nq9L_VM_lhhPCq2s0Qgw2kRx29s',
      y: 'YKwXDRz8U0-uLZ3NSI93R_35eNkl6jHp6Qg8OCup7VM',
    })
  })

  it('should correctly parse x5c chain provided as a test-vector', async () => {
    const certificateChain = [
      'MIICaTCCAg+gAwIBAgIUShyxcIZGiPV3wBRp4YOlNp1I13YwCgYIKoZIzj0EAwIwgYkxCzAJBgNVBAYTAkRFMQ8wDQYDVQQIDAZiZHIuZGUxDzANBgNVBAcMBkJlcmxpbjEMMAoGA1UECgwDQkRSMQ8wDQYDVQQLDAZNYXVyZXIxHTAbBgNVBAMMFGlzc3VhbmNlLXRlc3QuYmRyLmRlMRowGAYJKoZIhvcNAQkBFgt0ZXN0QGJkci5kZTAeFw0yNDA1MjgwODIyMjdaFw0zNDA0MDYwODIyMjdaMIGJMQswCQYDVQQGEwJERTEPMA0GA1UECAwGYmRyLmRlMQ8wDQYDVQQHDAZCZXJsaW4xDDAKBgNVBAoMA0JEUjEPMA0GA1UECwwGTWF1cmVyMR0wGwYDVQQDDBRpc3N1YW5jZS10ZXN0LmJkci5kZTEaMBgGCSqGSIb3DQEJARYLdGVzdEBiZHIuZGUwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASygZ1Ma0m9uif4n8g3CiCP+E1r2KWFxVmS6LRWqUBMgn5fODKIBftdzVSbv/38gujy5qxh/q5bLcT+yLilazCao1MwUTAdBgNVHQ4EFgQUMGdPNMIdo3iHfqt2jlTnBNCfRNAwHwYDVR0jBBgwFoAUMGdPNMIdo3iHfqt2jlTnBNCfRNAwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiAu2h5xulXReb5IhgpkYiYR1BONTtsjT7nfzQAhL4ISOQIhAK6jKwwf6fTTSZwvJUOAu7dz1Dy/DmH19Lef0zqaNNht',
    ]

    const chain = await X509Service.validateCertificateChain(agentContext, { certificateChain })

    expect(chain.length).toStrictEqual(1)
    expect(chain[0].sanDnsNames).toStrictEqual([])
    expect(chain[0].sanUriNames).toStrictEqual([])
  })

  it('should validate a valid certificate chain', async () => {
    const validatedChain = await X509Service.validateCertificateChain(agentContext, { certificateChain })

    expect(validatedChain.length).toStrictEqual(3)

    const leafCertificate = validatedChain[validatedChain.length - 1]

    expect(leafCertificate).toMatchObject({
      publicKey: expect.objectContaining({
        keyType: KeyType.P256,
      }),
      privateKey: undefined,
    })
  })

  it('should not validate a certificate with a `notBefore` of > Date.now', async () => {
    const authorityKey = await agentContext.wallet.createKey({ keyType: KeyType.P256 })

    const certificate = (
      await X509Service.createCertificate(agentContext, {
        authorityKey,
        issuer: 'CN=credo',
        validity: {
          notBefore: getNextMonth(),
        },
      })
    ).toString('base64')

    expect(
      async () =>
        await X509Service.validateCertificateChain(agentContext, {
          certificateChain: [certificate],
        })
    ).rejects.toThrow(X509Error)
  })

  it('should not validate a certificate with a `notAfter` of < Date.now', async () => {
    const authorityKey = await agentContext.wallet.createKey({ keyType: KeyType.P256 })

    const certificate = (
      await X509Service.createCertificate(agentContext, {
        authorityKey,
        issuer: 'CN=credo',
        validity: {
          notAfter: getLastMonth(),
        },
      })
    ).toString('base64')

    expect(
      async () =>
        await X509Service.validateCertificateChain(agentContext, {
          certificateChain: [certificate],
        })
    ).rejects.toThrow(X509Error)
  })

  it('should not validate a certificate chain if incorrect signing order', async () => {
    expect(
      async () =>
        await X509Service.validateCertificateChain(agentContext, {
          certificateChain: [certificateChain[1], certificateChain[2], certificateChain[0]],
        })
    ).rejects.toThrow(X509Error)
  })
})

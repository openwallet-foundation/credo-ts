import { id_ce_basicConstraints, id_ce_extKeyUsage, id_ce_keyUsage } from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'

import { getAgentConfig, getAgentContext } from '../../../../tests'
import { X509Error } from '../X509Error'
import { X509Service } from '../X509Service'

import { CredoWebCrypto, Hasher, TypedArrayEncoder, X509ExtendedKeyUsage, X509KeyUsage } from '@credo-ts/core'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { KeyManagementApi, KeyManagementModuleConfig, type KmsJwkPublicEc, P256PublicJwk, PublicJwk } from '../../kms'

/**
 *
 * Get the next month, accounting for a new year
 *
 */
const getNextMonth = () => {
  const now = new Date()
  let nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  if (now.getMonth() === 11) {
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
  if (now.getMonth() === 0) {
    lastMonth = new Date(now.getFullYear() - 1, 0, 1)
  }
  return lastMonth
}

const agentConfig = getAgentConfig('X509Service')
const agentContext = getAgentContext({
  agentConfig,
})

const kmsApi = new KeyManagementApi(
  new KeyManagementModuleConfig({
    backends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
  }),
  agentContext
)
agentContext.dependencyManager.registerInstance(KeyManagementApi, kmsApi)

describe('X509Service', () => {
  let certificateChain: Array<string>

  beforeAll(async () => {
    const rootKey = PublicJwk.fromPublicJwk((await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
    const intermediateKey = PublicJwk.fromPublicJwk(
      (await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
    )
    const leafKey = PublicJwk.fromPublicJwk((await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)

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

  it('should create a valid self-signed certificate', async () => {
    const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
      issuer: { commonName: 'credo' },
    })

    expect(certificate.publicJwk.toJson()).toMatchObject({ kty: 'EC', crv: 'P-256', kid: expect.any(String) })
    expect((certificate.publicJwk as PublicJwk<P256PublicJwk>).publicKey.publicKey.length).toStrictEqual(65)
    expect(certificate.subject).toStrictEqual('CN=credo')
  })

  it('should create a valid self-signed certificate with a critical extension', async () => {
    const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
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
    const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
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

    expect(certificate.sanDnsNames).toStrictEqual(expect.arrayContaining(['paradym.id']))
    expect(certificate.sanUriNames).toStrictEqual(expect.arrayContaining(['animo.id']))
    expect(certificate.keyUsage).toStrictEqual(expect.arrayContaining([X509KeyUsage.DigitalSignature]))
    expect(certificate.extendedKeyUsage).toStrictEqual(expect.arrayContaining([X509ExtendedKeyUsage.MdlDs]))
    expect(certificate.subjectKeyIdentifier).toStrictEqual(
      TypedArrayEncoder.toHex(
        Hasher.hash((certificate.publicJwk as PublicJwk<P256PublicJwk>).publicKey.publicKey, 'SHA-1')
      )
    )
  })

  it('should create a valid self-signed certifcate as IACA Root + DCS for mDoc', async () => {
    const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const documentSignerKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const mdocRootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
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
      subjectKeyIdentifier: TypedArrayEncoder.toHex(
        Hasher.hash((mdocRootCertificate.publicJwk as PublicJwk<P256PublicJwk>).publicKey.publicKey, 'SHA-1')
      ),
    })

    const authorityJwk = PublicJwk.fromPublicJwk(authorityKey.publicJwk)
    const authorityPublicKey = authorityJwk.publicKey
    const documentSignerJwk = PublicJwk.fromPublicJwk(documentSignerKey.publicJwk)
    const documentSignerPublicKey = documentSignerJwk.publicKey

    if (authorityPublicKey.kty !== 'EC' || documentSignerPublicKey.kty !== 'EC') {
      throw new Error('invalid kty')
    }

    const mdocDocumentSignerCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(documentSignerKey.publicJwk),
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
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
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
      subjectKeyIdentifier: TypedArrayEncoder.toHex(Hasher.hash(documentSignerPublicKey.publicKey, 'SHA-1')),
      authorityKeyIdentifier: TypedArrayEncoder.toHex(Hasher.hash(authorityPublicKey.publicKey, 'SHA-1')),
    })

    // Verify chain where the root cert is trusted, but not in the chain
    // This is the case in ISO 18013-5 mDL
    await expect(
      X509Service.validateCertificateChain(agentContext, {
        certificateChain: [mdocDocumentSignerCertificate.toString('pem'), mdocRootCertificate.toString('pem')],
        trustedCertificates: [mdocRootCertificate.toString('pem')],
      })
    ).resolves.toHaveLength(2)

    // Can verify it with only the signer certificate trusted.
    await expect(
      X509Service.validateCertificateChain(agentContext, {
        certificateChain: [mdocDocumentSignerCertificate.toString('pem')],
        trustedCertificates: [mdocDocumentSignerCertificate.toString('pem')],
      })
    ).resolves.toHaveLength(1)
  })

  it('should create a valid leaf certificate', async () => {
    const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const authorityJwk = PublicJwk.fromPublicJwk(authorityKey.publicJwk)
    const authorityPublicKey = authorityJwk.publicKey
    const subjectJwk = PublicJwk.fromPublicJwk(subjectKey.publicJwk)
    const subjectPublicKey = subjectJwk.publicKey

    if (authorityPublicKey.kty !== 'EC' || subjectPublicKey.kty !== 'EC') {
      throw new Error('invalid kty')
    }

    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
      issuer: { commonName: 'credo' },
      subject: { commonName: 'DCS credo' },
      extensions: {
        subjectKeyIdentifier: { include: true },
        authorityKeyIdentifier: { include: true },
      },
    })

    expect(certificate.subjectKeyIdentifier).toStrictEqual(
      TypedArrayEncoder.toHex(Hasher.hash(subjectPublicKey.publicKey, 'SHA-1'))
    )
    expect(certificate.authorityKeyIdentifier).toStrictEqual(
      TypedArrayEncoder.toHex(Hasher.hash(authorityPublicKey.publicKey, 'SHA-1'))
    )
    expect(authorityPublicKey.crv).toStrictEqual('P-256')
    expect(authorityPublicKey.publicKey.length).toStrictEqual(65)
    expect(certificate.subject).toStrictEqual('CN=DCS credo')
  })

  it('should correctly parse an X.509 certificate with an uncompressed key to a JWK', async () => {
    const encodedCertificate =
      'MIICKjCCAdCgAwIBAgIUV8bM0wi95D7KN0TyqHE42ru4hOgwCgYIKoZIzj0EAwIwUzELMAkGA1UEBhMCVVMxETAPBgNVBAgMCE5ldyBZb3JrMQ8wDQYDVQQHDAZBbGJhbnkxDzANBgNVBAoMBk5ZIERNVjEPMA0GA1UECwwGTlkgRE1WMB4XDTIzMDkxNDE0NTUxOFoXDTMzMDkxMTE0NTUxOFowUzELMAkGA1UEBhMCVVMxETAPBgNVBAgMCE5ldyBZb3JrMQ8wDQYDVQQHDAZBbGJhbnkxDzANBgNVBAoMBk5ZIERNVjEPMA0GA1UECwwGTlkgRE1WMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEiTwtg0eQbcbNabf2Nq9L/VM/lhhPCq2s0Qgw2kRx29tgrBcNHPxTT64tnc1Ij3dH/fl42SXqMenpCDw4K6ntU6OBgTB/MB0GA1UdDgQWBBSrbS4DuR1JIkAzj7zK3v2TM+r2xzAfBgNVHSMEGDAWgBSrbS4DuR1JIkAzj7zK3v2TM+r2xzAPBgNVHRMBAf8EBTADAQH/MCwGCWCGSAGG+EIBDQQfFh1PcGVuU1NMIEdlbmVyYXRlZCBDZXJ0aWZpY2F0ZTAKBggqhkjOPQQDAgNIADBFAiAJ/Qyrl7A+ePZOdNfc7ohmjEdqCvxaos6//gfTvncuqQIhANo4q8mKCA9J8k/+zh//yKbN1bLAtdqPx7dnrDqV3Lg+'

    const x509Certificate = X509Service.parseCertificate(agentContext, { encodedCertificate })

    const publicKey = x509Certificate.publicJwk.publicKey
    if (publicKey.kty !== 'EC') {
      throw new Error('uexpected kty value')
    }

    expect(publicKey.crv).toStrictEqual('P-256')
    expect(publicKey.publicKey.length).toStrictEqual(65)
    expect(TypedArrayEncoder.toBase58(publicKey.publicKey)).toStrictEqual(
      'QDaLvg9KroUnpuviZ9W7Q3DauqAuKiJN4sKC6cLo4HtxnpJCwwayNBLzRpsCHfHsLJsiKDeTCV8LqmCBSPkmiJNe'
    )

    expect(x509Certificate.publicJwk.toJson()).toMatchObject({
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
    expect(leafCertificate.publicJwk.is(P256PublicJwk)).toBe(true)
  })

  it('should verify a certificate chain where the root certificate is not in the provided chain, but is in trusted certificates', async () => {
    const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const documentSignerKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const mdocRootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
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

    const mdocDocumentSignerCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(documentSignerKey.publicJwk),
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
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
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

    await X509Service.validateCertificateChain(agentContext, {
      certificateChain: [mdocDocumentSignerCertificate.toString('base64url')],
      trustedCertificates: [mdocRootCertificate.toString('pem')],
    })
  })

  it('should not validate a certificate with a `notBefore` of > Date.now', async () => {
    const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const certificate = (
      await X509Service.createCertificate(agentContext, {
        authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
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
    const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const certificate = (
      await X509Service.createCertificate(agentContext, {
        authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
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

  it('should correctly parse test vector from verifier.eudiw.dev', async () => {
    const x5c = [
      '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',
    ]

    // Works without trusted certificates
    const chain = await X509Service.validateCertificateChain(agentContext, {
      certificateChain: x5c,
    })
    expect(chain.length).toStrictEqual(2)
    expect((chain[0].publicJwk.toJson() as KmsJwkPublicEc).crv).toStrictEqual('P-384')
    expect((chain[1].publicJwk.toJson() as KmsJwkPublicEc).crv).toStrictEqual('P-256')

    // Works with root certificate as trusted certificate
    await expect(
      X509Service.validateCertificateChain(agentContext, {
        certificateChain: x5c,
        trustedCertificates: [x5c[1]],
      })
    ).resolves.toHaveLength(2)

    // Errors when trusted certificates is empty
    await expect(
      X509Service.validateCertificateChain(agentContext, {
        certificateChain: x5c,
        trustedCertificates: [],
      })
    ).rejects.toThrow('No trusted certificate was found while validating the X.509 chain')

    // Works with leaf certificate as trusted certificate
    await expect(
      X509Service.validateCertificateChain(agentContext, {
        certificateChain: x5c,
        trustedCertificates: [x5c[0]],
      })
    ).resolves.toHaveLength(1)
  })

  it('should correctly parse test vector from ws.davidz25.net', async () => {
    const x5c = [
      'MIIBvTCCAUOgAwIBAgIBATAKBggqhkjOPQQDAzAlMSMwIQYDVQQDDBpPV0YgSUMgVGVzdEFwcCBSZWFkZXIgUm9vdDAeFw0yNTAzMjEyMjEyNDBaFw0yNTAzMjEyMjMyNDBaMDcxNTAzBgNVBAMMLE9XRiBJQyBPbmxpbmUgVmVyaWZpZXIgU2luZ2xlLVVzZSBSZWFkZXIgS2V5MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEuDXThD1zImM3KfAzJqFVrMT7a0Io0vNfv4/ZaD9inUib9BGPgZ/QbDaTzB71td8hwl8ao2YuQs1BZJTDaVPqh6NSMFAwHwYDVR0jBBgwFoAUq2Ub4FbCkFPx3X9s5Ie+aN5gyfUwDgYDVR0PAQH/BAQDAgeAMB0GA1UdDgQWBBS7v3hFCgJmXtpqJY8xCroK+aD8OjAKBggqhkjOPQQDAwNoADBlAjAa+qdP84Gv4MeSzfOGaKaJYQ2lQuVMFgJBl/Fwh5VtJKFnxs1tRSXilzG0/957xY0CMQDPChxTVcGYaroaOm2XPYTfrwcMBSnGIuz4IbgWQVsx9EI0jFR2XeoHIP9LkEu6wUo=',
      'MIIBujCCAUGgAwIBAgIBATAKBggqhkjOPQQDAzAlMSMwIQYDVQQDDBpPV0YgSUMgVGVzdEFwcCBSZWFkZXIgUm9vdDAeFw0yNDEyMDEwMDAwMDBaFw0zNDEyMDEwMDAwMDBaMCUxIzAhBgNVBAMMGk9XRiBJQyBUZXN0QXBwIFJlYWRlciBSb290MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE+QDye70m2O0llPXMjVjxVZz3m5k6agT+wih+L79b7jyqUl99sbeUnpxaLD+cmB3HK3twkA7fmVJSobBc+9CDhkh3mx6n+YoH5RulaSWThWBfMyRjsfVODkosHLCDnbPVo0UwQzAOBgNVHQ8BAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUq2Ub4FbCkFPx3X9s5Ie+aN5gyfUwCgYIKoZIzj0EAwMDZwAwZAIweZ71amQTYTv5uegmHkKYNdgfJvWk7Dbuh+YSiUL/yMNDORurXjmmio4mxxHR+wudAjAfQr1dk9vigdhlE4dsglgYtsBbGl/1hCqigHVjZQqS/bpV3aj9zgpAypcYI13vUUU=',
    ]

    const chain = await X509Service.validateCertificateChain(agentContext, {
      certificateChain: x5c,
      verificationDate: new Date('2025-03-21T22:30Z'),
    })

    expect(chain.length).toStrictEqual(2)
    expect((chain[0].publicJwk.toJson() as KmsJwkPublicEc).crv).toStrictEqual('P-384')
    expect((chain[1].publicJwk.toJson() as KmsJwkPublicEc).crv).toStrictEqual('P-256')
  })
})

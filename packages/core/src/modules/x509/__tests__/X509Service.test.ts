import {
  CredoWebCrypto,
  Hasher,
  TypedArrayEncoder,
  X509ExtendedKeyUsage,
  X509ExtensionIdentifier,
  X509KeyUsage,
} from '@credo-ts/core'
import * as x509 from '@peculiar/x509'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyManagementApi, KeyManagementModuleConfig, type KmsJwkPublicEc, P256PublicJwk, PublicJwk } from '../../kms'
import { X509Error } from '../X509Error'
import { X509ModuleConfig } from '../X509ModuleConfig'
import { X509Service } from '../X509Service'

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

// Register X509ModuleConfig
const x509ModuleConfig = new X509ModuleConfig({})
agentContext.dependencyManager.registerInstance(X509ModuleConfig, x509ModuleConfig)

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
      extensions: {
        basicConstraints: {
          ca: true,
          pathLenConstraint: 2,
        },
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
      extensions: {
        basicConstraints: {
          ca: true,
          pathLenConstraint: 1,
        },
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
    // The builder returns [Root, Intermediate, Leaf]
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

    expect(certificate.isExtensionCritical(X509ExtensionIdentifier.KeyUsage)).toStrictEqual(true)
    expect(certificate.isExtensionCritical(X509ExtensionIdentifier.ExtendedKeyUsage)).toStrictEqual(false)
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

  it('should create a valid self-signed certificate as IACA Root + DCS for mDoc', async () => {
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

    // Verify CRL distribution points structure
    expect(mdocRootCertificate.crlDistributionPoints).toHaveLength(1)
    expect(mdocRootCertificate.crlDistributionPoints[0]).toMatchObject({
      urls: ['https://animo.id'],
      reasons: undefined, // Full distribution point (covers all reasons)
      crlIssuer: undefined,
    })

    expect(mdocRootCertificate.isExtensionCritical(X509ExtensionIdentifier.BasicConstraints)).toStrictEqual(true)
    expect(mdocRootCertificate.isExtensionCritical(X509ExtensionIdentifier.KeyUsage)).toStrictEqual(true)

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
          // biome-ignore lint/style/noNonNullAssertion: no explanation
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

    expect(mdocDocumentSignerCertificate.isExtensionCritical(X509ExtensionIdentifier.KeyUsage)).toStrictEqual(true)
    expect(mdocDocumentSignerCertificate.isExtensionCritical(X509ExtensionIdentifier.ExtendedKeyUsage)).toStrictEqual(
      true
    )

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
    expect(chain[0].sanDnsNames).toEqual([])
    expect(chain[0].sanUriNames).toEqual([])
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
          // biome-ignore lint/style/noNonNullAssertion: no explanation
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

    await expect(
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

    await expect(
      async () =>
        await X509Service.validateCertificateChain(agentContext, {
          certificateChain: [certificate],
        })
    ).rejects.toThrow(X509Error)
  })

  it('should not validate a certificate chain if incorrect signing order', async () => {
    await expect(
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
    expect((chain[0].publicJwk.toJson() as KmsJwkPublicEc).crv).toStrictEqual('P-256')
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

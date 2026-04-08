import { CredoWebCrypto, Hasher, TypedArrayEncoder, X509ExtendedKeyUsage, X509KeyUsage } from '@credo-ts/core'
import { id_ce_basicConstraints, id_ce_extKeyUsage, id_ce_keyUsage } from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import {
  KeyManagementApi,
  KeyManagementModuleConfig,
  type KmsJwkPublicEc,
  type KmsJwkPublicRsa,
  P256PublicJwk,
  PublicJwk,
} from '../../kms'
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
      throw new Error('unexpected kty value')
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

  it('should correctly parse an RSA-signed X.509 certificate', async () => {
    const encodedCertificate = `-----BEGIN CERTIFICATE-----
MIIFRTCCAy2gAwIBAgIBATANBgkqhkiG9w0BAQsFADAqMSgwJgYDVQQDDB9FdXJv
cGVhbiBDb21taXNzaW9uIFJvb3QgQ0EgLSAyMB4XDTE2MTAwNDExMjExN1oXDTQ2
MTAwNDExMjExN1owKjEoMCYGA1UEAwwfRXVyb3BlYW4gQ29tbWlzc2lvbiBSb290
IENBIC0gMjCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAL4JYI9CBISZ
uBOBknpxCRX306sYm4tQPm5H2l5f4fDESYbthbv8FEOFUPu/uh/L5FuCsPgjDkHp
6lQqfWV0QG8550pLWI82B5EgE/tN0F4Iwq5OVzOwK+qkHpcXLwxZATNYmfgTGAb2
mcvVZ8ZkhL4cm6fWqjGzpX9av4R1uqRMKxm/0xuUXx37034g1/fMvzZ3V4rLGOwE
GluagitBcZhpXXnAFZAu6QF07dokW7vgOOm392TlVgJrv94qN73gMfl/CGQd8Sb3
t75HhYQ9kGyXEkFzOyPvwBlvV6hCOvElU+2u/HPYYz5lrC0u3MHPos16XF5/XJ7M
/H9DDtA5mv3B9xO+/67fdaMyXaUJzoiE3decIUgLQC0Qh5hNs1kdkBnufmYRvpe9
sUHWCsk39cNwVX+vp8EKDjtkiQbFuYIqvFckBbm7AcJlUt4jj6SJHVhECM4SCVd+
oUtsaTStKUrrVjvuXgzN65qfzafesiaimXYWD60gRp7OoCiN9QwkCiRD1Iqs9irE
E2DrIz15suuTb2+esrKciiIqyENUeYQolLhPvfdsZhdrtlFsDxM+/IPl7xz0V66k
A97FtQuiVFOrZaj1YdjSpSfUlscpUfJHMebdd36zQ85oFyGERx7VHpjwE8bw4w4n
DfnCKsz4xe7gZZX3CaKBCng6F4KiVXZHAgMBAAGjdjB0MA8GA1UdEwEB/wQFMAMB
Af8wHQYDVR0OBBYEFC+klbkQluW624UvF9NUjFzbrNNXMB8GA1UdIwQYMBaAFC+k
lbkQluW624UvF9NUjFzbrNNXMBEGA1UdIAQKMAgwBgYEVR0gADAOBgNVHQ8BAf8E
BAMCAQYwDQYJKoZIhvcNAQELBQADggIBAFPypMzasOt82j0geV8hJOopri91Jc1d
/fpc6mlubXb8E/scI9qqWQVUMlqiJkCyZl1TVis0bCPFvSlDl/hhwS5vnC0rBmCT
XXEEsQmsEasw/IR4e7bNAF+l/pPmggh7u+Y00kjYt1XweA2Of/+xf4nAk3HiX02I
ToHmY/Y4nlLP3bt1oac01Zv7sHPogmQrFFAvuoC4k+e6vJP0XveSp/vBpfKrdCNj
nViZ3J8gUzrRowi10U812/A5NtZFvKOYXPTFi4vznYMmZsfgejUab5f/j+ycgrFl
svw8vhYwWsJhWM/oPVNGnfYusa/8aovhwOiCe6lnn3o2jIASIPy6ReSzqZpqImKm
UGdARWSFCJw4NX1m2dg4GnMjSlWFv5fEnyF0wZlqniarr2TsRek85N6vIaklzc0k
A5gNgWLTxXMbr8rNta1RtXcN+SH8QgQ8CKgjbq4PSD/WPoOxRcZemGTXBdgxhTjZ
JgwaQU4L810bScOcQ9cI1QB0/Iq+7fQOg9xIl3mvSoEhnP36Dr3uoi+yem1UhnjU
9DHE0uKYpHjlHXP6LHvjfQZyS3ba3S0/nYsVf24b4UEja3PehnHhdzyJx/cHRJpN
T5ibC5pZWL61QgOrDHuSBQnEQUMmYwNoqS+HQvu532NjlSfG6ffmDuEkGuBMM1jY
gTqhM3BGMuf+
-----END CERTIFICATE-----`

    const x509Certificate = X509Service.parseCertificate(agentContext, { encodedCertificate })
    expect(x509Certificate.publicJwk.toJson()).toMatchObject({
      kty: 'RSA',
      e: 'AQAB',
      n: 'AL4JYI9CBISZuBOBknpxCRX306sYm4tQPm5H2l5f4fDESYbthbv8FEOFUPu_uh_L5FuCsPgjDkHp6lQqfWV0QG8550pLWI82B5EgE_tN0F4Iwq5OVzOwK-qkHpcXLwxZATNYmfgTGAb2mcvVZ8ZkhL4cm6fWqjGzpX9av4R1uqRMKxm_0xuUXx37034g1_fMvzZ3V4rLGOwEGluagitBcZhpXXnAFZAu6QF07dokW7vgOOm392TlVgJrv94qN73gMfl_CGQd8Sb3t75HhYQ9kGyXEkFzOyPvwBlvV6hCOvElU-2u_HPYYz5lrC0u3MHPos16XF5_XJ7M_H9DDtA5mv3B9xO-_67fdaMyXaUJzoiE3decIUgLQC0Qh5hNs1kdkBnufmYRvpe9sUHWCsk39cNwVX-vp8EKDjtkiQbFuYIqvFckBbm7AcJlUt4jj6SJHVhECM4SCVd-oUtsaTStKUrrVjvuXgzN65qfzafesiaimXYWD60gRp7OoCiN9QwkCiRD1Iqs9irEE2DrIz15suuTb2-esrKciiIqyENUeYQolLhPvfdsZhdrtlFsDxM-_IPl7xz0V66kA97FtQuiVFOrZaj1YdjSpSfUlscpUfJHMebdd36zQ85oFyGERx7VHpjwE8bw4w4nDfnCKsz4xe7gZZX3CaKBCng6F4KiVXZH',
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

  it('should correctly parse EU certificate chain', async () => {
    const x5c = [
      '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',
    ]

    const trustedCertificates = [
      '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',
    ]

    const chain = await X509Service.validateCertificateChain(agentContext, {
      certificateChain: x5c,
      trustedCertificates,
      verificationDate: new Date('2026-04-01T22:30Z'),
    })

    expect(chain.length).toStrictEqual(3)

    expect((chain[0].publicJwk.toJson() as KmsJwkPublicRsa).kty).toStrictEqual('RSA')
    expect((chain[1].publicJwk.toJson() as KmsJwkPublicRsa).kty).toStrictEqual('RSA')
    expect((chain[2].publicJwk.toJson() as KmsJwkPublicRsa).kty).toStrictEqual('RSA')
  })
})

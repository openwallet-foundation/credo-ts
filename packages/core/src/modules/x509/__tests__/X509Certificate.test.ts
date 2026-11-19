import { X509ExtensionIdentifier } from '@credo-ts/core'
import * as x509 from '@peculiar/x509'
import { validateCriticalExtensions } from '../utils/criticalExtensions'
import { X509Certificate } from '../X509Certificate'

// A self-signed certificate with an issuer alternative name that does not decode
async function createCertificate(extensions: x509.Extension[] = []) {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
  const subjectKeyIdentifier = await x509.SubjectKeyIdentifierExtension.create(keys.publicKey, false, crypto)
  const certificate = await x509.X509CertificateGenerator.createSelfSigned(
    {
      keys,
      name: 'CN=Test',
      signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
      extensions: [
        subjectKeyIdentifier,
        await x509.AuthorityKeyIdentifierExtension.create(keys.publicKey, false, crypto),
        // A SEQUENCE holding an INTEGER, which is not a GeneralName
        new x509.Extension(
          X509ExtensionIdentifier.IssuerAltName,
          false,
          new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x01])
        ),
        ...extensions,
      ],
    },
    crypto
  )

  return {
    certificate: X509Certificate.fromRawCertificate(new Uint8Array(certificate.rawData)),
    keyId: subjectKeyIdentifier.keyId,
  }
}

describe('X509Certificate', () => {
  it('reads extensions when another extension does not decode', async () => {
    const { certificate, keyId } = await createCertificate()

    expect(() => certificate.issuerAlternativeNames).toThrow()
    expect(certificate.authorityKeyIdentifier).toEqual(keyId)
    expect(certificate.subjectKeyIdentifier).toEqual(keyId)
    expect(certificate.hasExtension(X509ExtensionIdentifier.IssuerAltName)).toBe(true)
    expect(certificate.isExtensionCritical(X509ExtensionIdentifier.IssuerAltName)).toBe(false)
    expect(() => certificate.issuerAlternativeNames).toThrow()
  })

  it('finds an unknown critical extension when another extension does not decode', async () => {
    const { certificate } = await createCertificate([new x509.Extension('1.2.3.4', true, new Uint8Array([0x05, 0x00]))])

    expect(certificate.extensions).toEqual([
      { type: X509ExtensionIdentifier.SubjectKeyIdentifier, critical: false },
      { type: X509ExtensionIdentifier.AuthorityKeyIdentifier, critical: false },
      { type: X509ExtensionIdentifier.IssuerAltName, critical: false },
      { type: '1.2.3.4', critical: true },
    ])
    expect(validateCriticalExtensions(certificate).unknownCriticalExtensions).toEqual(['1.2.3.4'])
  })

  it('matches an issuer on its key identifier when another extension does not decode', async () => {
    const { certificate } = await createCertificate()
    const { certificate: sameName } = await createCertificate()

    expect(certificate.isPossiblyIssuedBy(certificate)).toBe(true)
    expect(certificate.isPossiblyIssuedBy(sameName)).toBe(false)
  })
})

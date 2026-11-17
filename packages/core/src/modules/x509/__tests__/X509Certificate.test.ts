import { X509ExtensionIdentifier } from '@credo-ts/core'
import * as x509 from '@peculiar/x509'
import { X509Certificate } from '../X509Certificate'

describe('X509Certificate', () => {
  it('reads extensions when another extension does not decode', async () => {
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
        ],
      },
      crypto
    )

    const x509Certificate = X509Certificate.fromRawCertificate(new Uint8Array(certificate.rawData))

    expect(() => x509Certificate.issuerAlternativeNames).toThrow()
    expect(x509Certificate.authorityKeyIdentifier).toEqual(subjectKeyIdentifier.keyId)
    expect(x509Certificate.subjectKeyIdentifier).toEqual(subjectKeyIdentifier.keyId)
    expect(x509Certificate.hasExtension(X509ExtensionIdentifier.IssuerAltName)).toBe(true)
    expect(() => x509Certificate.issuerAlternativeNames).toThrow()
  })
})

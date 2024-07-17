import type { CredoWebCrypto } from '../../crypto/webcrypto'

import { AsnParser } from '@peculiar/asn1-schema'
import { id_ce_subjectAltName, SubjectPublicKeyInfo } from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'

import { Key } from '../../crypto/Key'
import { CredoWebCryptoKey } from '../../crypto/webcrypto'
import { credoKeyTypeIntoCryptoKeyAlgorithm, spkiAlgorithmIntoCredoKeyType } from '../../crypto/webcrypto/utils'

import { X509Error } from './X509Error'

type Extension = Record<string, undefined | Array<{ type: string; value: string }>>
export type ExtensionInput = Array<Array<{ type: 'dns' | 'url'; value: string }>>

export type X509CertificateOptions = {
  publicKey: Key
  privateKey?: Uint8Array
  extensions?: Array<Extension>
  rawCertificate: Uint8Array
}

export class X509Certificate {
  public publicKey: Key
  public privateKey?: Uint8Array
  public extensions?: Array<Extension>

  public readonly rawCertificate: Uint8Array

  public constructor(options: X509CertificateOptions) {
    this.extensions = options.extensions
    this.publicKey = options.publicKey
    this.privateKey = options.privateKey
    this.rawCertificate = options.rawCertificate
  }

  public static fromRawCertificate(rawCertificate: Uint8Array): X509Certificate {
    const certificate = new x509.X509Certificate(rawCertificate)
    return this.parseCertificate(certificate)
  }

  public static fromEncodedCertificate(encodedCertificate: string): X509Certificate {
    const certificate = new x509.X509Certificate(encodedCertificate)
    return this.parseCertificate(certificate)
  }

  private static parseCertificate(certificate: x509.X509Certificate): X509Certificate {
    const publicKey = AsnParser.parse(certificate.publicKey.rawData, SubjectPublicKeyInfo)
    const privateKey = certificate.privateKey ? new Uint8Array(certificate.privateKey.rawData) : undefined

    const keyType = spkiAlgorithmIntoCredoKeyType(publicKey.algorithm)

    const key = new Key(new Uint8Array(publicKey.subjectPublicKey), keyType)

    return new X509Certificate({
      publicKey: key,
      privateKey,
      extensions: certificate.extensions
        ?.map((e) => JSON.parse(JSON.stringify(e)))
        .map((e) => ({ [e.type]: e.names })) as Array<Extension>,
      rawCertificate: new Uint8Array(certificate.rawData),
    })
  }

  private getMatchingExtensions<T>(name: string, type: string): Array<T> | undefined {
    const extensionsWithName = this.extensions
      ?.filter((e) => e[name])
      ?.flatMap((e) => e[name])
      ?.filter((e): e is Exclude<typeof e, undefined> => e !== undefined && e.type === type)
      ?.map((e) => e.value)

    return extensionsWithName as Array<T>
  }

  public get sanDnsNames() {
    const subjectAlternativeNameExtensionDns = this.getMatchingExtensions<string>(id_ce_subjectAltName, 'dns')
    return subjectAlternativeNameExtensionDns?.filter((e) => typeof e === 'string') ?? []
  }

  public get sanUriNames() {
    const subjectAlternativeNameExtensionUri = this.getMatchingExtensions<string>(id_ce_subjectAltName, 'url')
    return subjectAlternativeNameExtensionUri?.filter((e) => typeof e === 'string') ?? []
  }

  public static async createSelfSigned(
    {
      key,
      extensions,
      notAfter,
      notBefore,
      name,
    }: {
      key: Key
      // For now we only support the SubjectAlternativeName as `dns` or `uri`
      extensions?: ExtensionInput
      notBefore?: Date
      notAfter?: Date
      name?: string
    },
    webCrypto: CredoWebCrypto
  ) {
    const cryptoKeyAlgorithm = credoKeyTypeIntoCryptoKeyAlgorithm(key.keyType)

    const publicKey = new CredoWebCryptoKey(key, cryptoKeyAlgorithm, true, 'public', ['verify'])
    const privateKey = new CredoWebCryptoKey(key, cryptoKeyAlgorithm, false, 'private', ['sign'])

    const certificate = await x509.X509CertificateGenerator.createSelfSigned(
      {
        keys: { publicKey, privateKey },
        name,
        extensions: extensions?.map((extension) => new x509.SubjectAlternativeNameExtension(extension)),
        notAfter,
        notBefore,
      },
      webCrypto
    )

    return X509Certificate.parseCertificate(certificate)
  }

  public get subject() {
    const certificate = new x509.X509Certificate(this.rawCertificate)
    return certificate.subject
  }

  public async verify(
    { verificationDate = new Date(), publicKey }: { verificationDate: Date; publicKey?: Key },
    webCrypto: CredoWebCrypto
  ) {
    const certificate = new x509.X509Certificate(this.rawCertificate)

    let publicCryptoKey: CredoWebCryptoKey | undefined
    if (publicKey) {
      const cryptoKeyAlgorithm = credoKeyTypeIntoCryptoKeyAlgorithm(publicKey.keyType)
      publicCryptoKey = new CredoWebCryptoKey(publicKey, cryptoKeyAlgorithm, true, 'public', ['verify'])
    }

    // We use the library to validate the signature, but the date is manually verified
    const isSignatureValid = await certificate.verify({ signatureOnly: true, publicKey: publicCryptoKey }, webCrypto)
    const time = verificationDate.getTime()

    const isNotBeforeValid = certificate.notBefore.getTime() <= time
    const isNotAfterValid = time <= certificate.notAfter.getTime()

    if (!isSignatureValid) {
      throw new X509Error(`Certificate: '${certificate.subject}' has an invalid signature`)
    }
    if (!isNotBeforeValid) {
      throw new X509Error(`Certificate: '${certificate.subject}' used before it is allowed`)
    }

    if (!isNotAfterValid) {
      throw new X509Error(`Certificate: '${certificate.subject}' used after it is allowed`)
    }
  }

  public toString(format: 'asn' | 'pem' | 'hex' | 'base64' | 'text' | 'base64url') {
    const certificate = new x509.X509Certificate(this.rawCertificate)
    return certificate.toString(format)
  }

  public equal(certificate: X509Certificate) {
    const parsedThis = new x509.X509Certificate(this.rawCertificate)
    const parsedOther = new x509.X509Certificate(certificate.rawCertificate)

    return parsedThis.equal(parsedOther)
  }
}

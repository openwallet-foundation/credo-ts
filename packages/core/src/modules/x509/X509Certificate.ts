import { AsnParser } from '@peculiar/asn1-schema'
import {
  id_ce_authorityKeyIdentifier,
  id_ce_extKeyUsage,
  id_ce_issuerAltName,
  id_ce_keyUsage,
  id_ce_subjectAltName,
  id_ce_subjectKeyIdentifier,
  SubjectPublicKeyInfo,
} from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'
import type { AgentContext } from '../../agent'
import { CredoWebCrypto, CredoWebCryptoKey } from '../../crypto/webcrypto'
import { publicJwkToCryptoKeyAlgorithm, spkiToPublicJwk } from '../../crypto/webcrypto/utils'
import type { AnyUint8Array } from '../../types'
import { TypedArrayEncoder } from '../../utils'
import { asymmetricPublicJwkMatches, PublicJwk } from '../kms'
import {
  convertName,
  createAuthorityKeyIdentifierExtension,
  createBasicConstraintsExtension,
  createCrlDistributionPointsExtension,
  createExtendedKeyUsagesExtension,
  createIssuerAlternativeNameExtension,
  createKeyUsagesExtension,
  createSubjectAlternativeNameExtension,
  createSubjectKeyIdentifierExtension,
} from './utils'
import { X509Error } from './X509Error'
import type { X509CreateCertificateOptions } from './X509ServiceOptions'

export enum X509KeyUsage {
  DigitalSignature = 1,
  NonRepudiation = 2,
  KeyEncipherment = 4,
  DataEncipherment = 8,
  KeyAgreement = 16,
  KeyCertSign = 32,
  CrlSign = 64,
  EncipherOnly = 128,
  DecipherOnly = 256,
}

export enum X509ExtendedKeyUsage {
  ServerAuth = '1.3.6.1.5.5.7.3.1',
  ClientAuth = '1.3.6.1.5.5.7.3.2',
  CodeSigning = '1.3.6.1.5.5.7.3.3',
  EmailProtection = '1.3.6.1.5.5.7.3.4',
  TimeStamping = '1.3.6.1.5.5.7.3.8',
  OcspSigning = '1.3.6.1.5.5.7.3.9',
  MdlDs = '1.0.18013.5.1.2',
}

export type X509CertificateOptions = {
  publicJwk: PublicJwk
  privateKey?: AnyUint8Array
  x509Certificate: x509.X509Certificate
}

export class X509Certificate {
  public publicJwk: PublicJwk
  public privateKey?: AnyUint8Array
  private x509Certificate: x509.X509Certificate

  private constructor(options: X509CertificateOptions) {
    this.publicJwk = options.publicJwk
    this.privateKey = options.privateKey
    this.x509Certificate = options.x509Certificate
  }

  public set keyId(keyId: string) {
    this.publicJwk.keyId = keyId
  }

  public get keyId(): string {
    return this.publicJwk.keyId
  }

  public get hasKeyId(): boolean {
    return this.publicJwk.hasKeyId
  }

  public static fromRawCertificate(rawCertificate: AnyUint8Array): X509Certificate {
    const certificate = new x509.X509Certificate(rawCertificate)
    return X509Certificate.parseCertificate(certificate)
  }

  public static fromEncodedCertificate(encodedCertificate: string): X509Certificate {
    const certificate = new x509.X509Certificate(encodedCertificate)
    return X509Certificate.parseCertificate(certificate)
  }

  private static parseCertificate(certificate: x509.X509Certificate): X509Certificate {
    const spki = AsnParser.parse(certificate.publicKey.rawData, SubjectPublicKeyInfo)
    const privateKey = certificate.privateKey ? new Uint8Array(certificate.privateKey.rawData) : undefined

    const publicJwk = spkiToPublicJwk(spki)

    return new X509Certificate({
      publicJwk,
      privateKey,
      x509Certificate: certificate,
    })
  }

  private getMatchingExtensions<T = { critical: boolean }>(objectIdentifier: string): Array<T> | undefined {
    return this.x509Certificate.extensions.filter((e) => e.type === objectIdentifier) as Array<T> | undefined
  }

  public get rawCertificate() {
    return new Uint8Array(this.x509Certificate.rawData)
  }

  public get subjectAlternativeNames() {
    const san = this.getMatchingExtensions<x509.SubjectAlternativeNameExtension>(id_ce_subjectAltName)
    return san?.flatMap((s) => s.names.items).map((i) => ({ type: i.type, value: i.value })) ?? []
  }

  public get issuerAlternativeNames() {
    const ian = this.getMatchingExtensions<x509.IssuerAlternativeNameExtension>(id_ce_issuerAltName)
    return ian?.flatMap((i) => i.names.items).map((i) => ({ type: i.type, value: i.value })) ?? []
  }

  public get sanDnsNames() {
    return this.subjectAlternativeNames.filter((san) => san.type === 'dns').map((san) => san.value)
  }

  public get sanUriNames() {
    return this.subjectAlternativeNames.filter((ian) => ian.type === 'url').map((ian) => ian.value)
  }

  public get ianDnsNames() {
    return this.issuerAlternativeNames.filter((san) => san.type === 'dns').map((san) => san.value)
  }

  public get ianUriNames() {
    return this.issuerAlternativeNames.filter((ian) => ian.type === 'url').map((ian) => ian.value)
  }

  public get authorityKeyIdentifier() {
    const keyIds = this.getMatchingExtensions<x509.AuthorityKeyIdentifierExtension>(id_ce_authorityKeyIdentifier)?.map(
      (e) => e.keyId
    )

    if (keyIds && keyIds.length > 1) {
      throw new X509Error('Multiple Authority Key Identifiers are not allowed')
    }

    return keyIds?.[0]
  }

  public get subjectKeyIdentifier() {
    const keyIds = this.getMatchingExtensions<x509.SubjectKeyIdentifierExtension>(id_ce_subjectKeyIdentifier)?.map(
      (e) => e.keyId
    )

    if (keyIds && keyIds.length > 1) {
      throw new X509Error('Multiple Subject Key Identifiers are not allowed')
    }

    return keyIds?.[0]
  }

  // biome-ignore lint/suspicious/useGetterReturn: no explanation
  public get keyUsage() {
    const keyUsages = this.getMatchingExtensions<x509.KeyUsagesExtension>(id_ce_keyUsage)?.map((e) => e.usages)

    if (keyUsages && keyUsages.length > 1) {
      throw new X509Error('Multiple Key Usages are not allowed')
    }

    if (keyUsages) {
      return Object.values(X509KeyUsage)
        .filter((key): key is number => typeof key === 'number')
        .filter((flagValue) => (keyUsages[0] & flagValue) === flagValue)
        .map((flagValue) => flagValue as X509KeyUsage)
    }
  }

  public get extendedKeyUsage() {
    const extendedKeyUsages = this.getMatchingExtensions<x509.ExtendedKeyUsageExtension>(id_ce_extKeyUsage)?.map(
      (e) => e.usages
    )

    if (extendedKeyUsages && extendedKeyUsages.length > 1) {
      throw new X509Error('Multiple Key Usages are not allowed')
    }

    return (extendedKeyUsages?.[0] as Array<X509ExtendedKeyUsage> | undefined) ?? []
  }

  public isExtensionCritical(id: string): boolean {
    const extension = this.getMatchingExtensions(id)
    if (!extension) {
      throw new X509Error(`extension with id '${id}' is not found`)
    }

    return !!extension[0].critical
  }

  public static async create(options: X509CreateCertificateOptions, webCrypto: CredoWebCrypto) {
    const subjectPublicKey = options.subjectPublicKey ?? options.authorityKey
    const isSelfSignedCertificate = asymmetricPublicJwkMatches(options.authorityKey.toJson(), subjectPublicKey.toJson())

    const signingKey = new CredoWebCryptoKey(
      options.authorityKey,
      publicJwkToCryptoKeyAlgorithm(options.authorityKey),
      false,
      'private',
      ['sign']
    )
    const publicKey = new CredoWebCryptoKey(
      subjectPublicKey,
      publicJwkToCryptoKeyAlgorithm(options.authorityKey),
      true,
      'public',
      ['verify']
    )

    const issuerName = convertName(options.issuer)

    const extensions: Array<x509.Extension | undefined> = []
    extensions.push(
      createSubjectKeyIdentifierExtension(options.extensions?.subjectKeyIdentifier, { publicJwk: subjectPublicKey })
    )
    extensions.push(createKeyUsagesExtension(options.extensions?.keyUsage))
    extensions.push(createExtendedKeyUsagesExtension(options.extensions?.extendedKeyUsage))
    extensions.push(
      createAuthorityKeyIdentifierExtension(options.extensions?.authorityKeyIdentifier, {
        publicJwk: options.authorityKey,
      })
    )
    extensions.push(createIssuerAlternativeNameExtension(options.extensions?.issuerAlternativeName))
    extensions.push(createSubjectAlternativeNameExtension(options.extensions?.subjectAlternativeName))
    extensions.push(createBasicConstraintsExtension(options.extensions?.basicConstraints))
    extensions.push(createCrlDistributionPointsExtension(options.extensions?.crlDistributionPoints))

    if (isSelfSignedCertificate) {
      if (options.subject) {
        throw new X509Error('Do not provide a subject name when the certificate is supposed to be self signed')
      }

      const certificate = await x509.X509CertificateGenerator.createSelfSigned(
        {
          keys: { publicKey, privateKey: signingKey },
          name: issuerName,
          notBefore: options.validity?.notBefore,
          notAfter: options.validity?.notAfter,
          extensions: extensions.filter((e) => e !== undefined),
          serialNumber: options.serialNumber,
        },
        webCrypto
      )

      const certificateInstance = X509Certificate.parseCertificate(certificate)
      if (subjectPublicKey.hasKeyId) certificateInstance.publicJwk.keyId = subjectPublicKey.keyId
      return certificateInstance
    }

    if (!options.subject) {
      throw new X509Error('Provide a subject name when the certificate is not supposed to be self signed')
    }

    const subjectName = convertName(options.subject)

    const certificate = await x509.X509CertificateGenerator.create(
      {
        signingKey,
        publicKey,
        issuer: issuerName,
        subject: subjectName,
        notBefore: options.validity?.notBefore,
        notAfter: options.validity?.notAfter,
        extensions: extensions.filter((e) => e !== undefined),
      },
      webCrypto
    )

    const certificateInstance = X509Certificate.parseCertificate(certificate)
    if (subjectPublicKey.hasKeyId) certificateInstance.publicJwk.keyId = subjectPublicKey.keyId
    return certificateInstance
  }

  public get subject() {
    return this.x509Certificate.subject
  }

  public get issuer() {
    return this.x509Certificate.issuer
  }

  public async verify(
    {
      verificationDate = new Date(),
      publicJwk,
      skipSignatureVerification = false,
    }: {
      verificationDate: Date
      publicJwk?: PublicJwk

      /**
       * Whether to skip the verification of the signature and only perform other checks (such
       * as whether the certificate is not expired).
       *
       * This can be useful when an non-self-signed certificate is directly trusted, and it may
       * not be possible to verify the certificate as the root/intermediate certificate containing
       * the key of the signer/intermediate is not present.
       *
       * @default false
       */
      skipSignatureVerification?: boolean
    },
    webCrypto: CredoWebCrypto
  ) {
    let publicCryptoKey: CredoWebCryptoKey | undefined
    if (publicJwk) {
      const cryptoKeyAlgorithm = publicJwkToCryptoKeyAlgorithm(publicJwk)
      publicCryptoKey = new CredoWebCryptoKey(publicJwk, cryptoKeyAlgorithm, true, 'public', ['verify'])
    }

    // We use the library to validate the signature, but the date is manually verified
    const isSignatureValid = skipSignatureVerification
      ? true
      : await this.x509Certificate.verify({ signatureOnly: true, publicKey: publicCryptoKey }, webCrypto)
    const time = verificationDate.getTime()

    const isNotBeforeValid = this.x509Certificate.notBefore.getTime() <= time
    const isNotAfterValid = time <= this.x509Certificate.notAfter.getTime()

    if (!isSignatureValid) {
      throw new X509Error(`Certificate: '${this.x509Certificate.subject}' has an invalid signature`)
    }

    if (!isNotBeforeValid) {
      throw new X509Error(`Certificate: '${this.x509Certificate.subject}' used before it is allowed`)
    }

    if (!isNotAfterValid) {
      throw new X509Error(`Certificate: '${this.x509Certificate.subject}' used after it is allowed`)
    }
  }

  /**
   * Get the thumbprint of the X509 certificate in hex format.
   */
  public async getThumbprintInHex(agentContext: AgentContext) {
    const thumbprint = await this.x509Certificate.getThumbprint(new CredoWebCrypto(agentContext))
    const thumbprintHex = TypedArrayEncoder.toHex(new Uint8Array(thumbprint))

    return thumbprintHex
  }

  /**
   * Get the data elements of the x509 certificate
   */
  public get data() {
    return {
      issuerName: this.x509Certificate.issuerName.toString(),
      issuer: this.x509Certificate.issuer,
      subjectName: this.x509Certificate.subjectName.toString(),
      subject: this.x509Certificate.subject,
      serialNumber: this.x509Certificate.serialNumber,
      pem: this.x509Certificate.toString(),
      notBefore: this.x509Certificate.notBefore,
      notAfter: this.x509Certificate.notAfter,
    }
  }

  public getIssuerNameField(field: string) {
    return this.x509Certificate.issuerName.getField(field)
  }

  public getSubjectNameField(field: string) {
    return this.x509Certificate.subjectName.getField(field)
  }

  /**
   * @param format the format to export to, defaults to `pem`
   */
  public toString(format?: 'asn' | 'pem' | 'hex' | 'base64' | 'text' | 'base64url') {
    return this.x509Certificate.toString(format ?? 'pem')
  }

  public equal(certificate: X509Certificate) {
    const parsedOther = new x509.X509Certificate(certificate.rawCertificate)

    return this.x509Certificate.equal(parsedOther)
  }
}

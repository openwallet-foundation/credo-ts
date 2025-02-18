import type { X509CreateCertificateOptions } from './X509ServiceOptions'
import type { AgentContext } from '../../agent'

import { AsnParser } from '@peculiar/asn1-schema'
import {
  id_ce_authorityKeyIdentifier,
  id_ce_extKeyUsage,
  id_ce_keyUsage,
  id_ce_subjectAltName,
  id_ce_subjectKeyIdentifier,
  SubjectPublicKeyInfo,
} from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'

import { Key } from '../../crypto/Key'
import { CredoWebCrypto, CredoWebCryptoKey } from '../../crypto/webcrypto'
import { credoKeyTypeIntoCryptoKeyAlgorithm, spkiAlgorithmIntoCredoKeyType } from '../../crypto/webcrypto/utils'
import { TypedArrayEncoder } from '../../utils'

import { X509Error } from './X509Error'
import {
  convertName,
  createAuthorityKeyIdentifierExtension,
  createBasicConstraintsExtension,
  createExtendedKeyUsagesExtension,
  createIssuerAlternativeNameExtension,
  createKeyUsagesExtension,
  createSubjectAlternativeNameExtension,
  createSubjectKeyIdentifierExtension,
} from './utils'

type ExtensionObjectIdentifier = string
type CanBeCritical<T> = T & { critical?: boolean }

type SubjectAlternativeNameExtension = CanBeCritical<{ name: Array<{ type: 'url' | 'dns'; value: string }> }>
type AuthorityKeyIdentifierExtension = CanBeCritical<{ keyId: string }>
type SubjectKeyIdentifierExtension = CanBeCritical<{ keyId: string }>
type KeyUsageExtension = CanBeCritical<{ usage: number }>
type ExtendedKeyUsageExtension = CanBeCritical<{ usage: Array<X509ExtendedKeyUsage> }>

type ExtensionValues =
  | SubjectAlternativeNameExtension
  | AuthorityKeyIdentifierExtension
  | SubjectKeyIdentifierExtension
  | KeyUsageExtension
  | ExtendedKeyUsageExtension

type Extension = Record<ExtensionObjectIdentifier, ExtensionValues>

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
    const publicKeyBytes = new Uint8Array(publicKey.subjectPublicKey)

    const key = new Key(publicKeyBytes, keyType)

    const extensions = certificate.extensions
      .map((e) => {
        if (e instanceof x509.AuthorityKeyIdentifierExtension) {
          return { [e.type]: { keyId: e.keyId as string, critical: e.critical } }
        } else if (e instanceof x509.SubjectKeyIdentifierExtension) {
          return { [e.type]: { keyId: e.keyId, critical: e.critical } }
        } else if (e instanceof x509.SubjectAlternativeNameExtension) {
          return {
            [e.type]: {
              name: JSON.parse(JSON.stringify(e.names)) as SubjectAlternativeNameExtension['name'],
              critical: e.critical,
            },
          }
        } else if (e instanceof x509.KeyUsagesExtension) {
          return { [e.type]: { usage: e.usages as number, critical: e.critical } }
        } else if (e instanceof x509.ExtendedKeyUsageExtension) {
          return { [e.type]: { usage: e.usages as Array<X509ExtendedKeyUsage>, critical: e.critical } }
        }

        // TODO: We could throw an error when we don't understand the extension?
        // This will break everytime we do not understand an extension though
        return undefined
      })
      .filter((e): e is Exclude<typeof e, undefined> => e !== undefined)

    return new X509Certificate({
      publicKey: key,
      privateKey,
      extensions: extensions.length > 0 ? extensions : undefined,
      rawCertificate: new Uint8Array(certificate.rawData),
    })
  }

  private getMatchingExtensions<T extends ExtensionValues>(objectIdentifier: string): Array<T> | undefined {
    return this.extensions?.map((e) => e[objectIdentifier])?.filter(Boolean) as Array<T> | undefined
  }

  public get sanDnsNames() {
    const san = this.getMatchingExtensions<SubjectAlternativeNameExtension>(id_ce_subjectAltName)
    return (
      san
        ?.flatMap((e) => e.name)
        ?.filter((e) => e.type === 'dns')
        ?.map((e) => e.value) ?? []
    )
  }

  public get sanUriNames() {
    const san = this.getMatchingExtensions<SubjectAlternativeNameExtension>(id_ce_subjectAltName)
    return (
      san
        ?.flatMap((e) => e.name)
        ?.filter((e) => e.type === 'url')
        ?.map((e) => e.value) ?? []
    )
  }

  public get authorityKeyIdentifier() {
    const keyIds = this.getMatchingExtensions<AuthorityKeyIdentifierExtension>(id_ce_authorityKeyIdentifier)?.map(
      (e) => e.keyId
    )

    if (keyIds && keyIds.length > 1) {
      throw new X509Error('Multiple Authority Key Identifiers are not allowed')
    }

    return keyIds?.[0]
  }

  public get subjectKeyIdentifier() {
    const keyIds = this.getMatchingExtensions<SubjectKeyIdentifierExtension>(id_ce_subjectKeyIdentifier)?.map(
      (e) => e.keyId
    )

    if (keyIds && keyIds.length > 1) {
      throw new X509Error('Multiple Subject Key Identifiers are not allowed')
    }

    return keyIds?.[0]
  }

  public get keyUsage(): Array<X509KeyUsage> {
    const keyUsages = this.getMatchingExtensions<KeyUsageExtension>(id_ce_keyUsage)?.map((e) => e.usage)

    if (keyUsages && keyUsages.length > 1) {
      throw new X509Error('Multiple Key Usages are not allowed')
    }

    if (keyUsages) {
      return Object.values(X509KeyUsage)
        .filter((key): key is number => typeof key === 'number')
        .filter((flagValue) => (keyUsages[0] & flagValue) === flagValue)
        .map((flagValue) => flagValue as X509KeyUsage)
    }

    return []
  }

  public get extendedKeyUsage(): Array<X509ExtendedKeyUsage> | undefined {
    const extendedKeyUsages = this.getMatchingExtensions<ExtendedKeyUsageExtension>(id_ce_extKeyUsage)?.map(
      (e) => e.usage
    )

    if (extendedKeyUsages && extendedKeyUsages.length > 1) {
      throw new X509Error('Multiple Key Usages are not allowed')
    }

    return extendedKeyUsages?.[0]
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
    const isSelfSignedCertificate = options.authorityKey.publicKeyBase58 === subjectPublicKey.publicKeyBase58

    const signingKey = new CredoWebCryptoKey(
      options.authorityKey,
      credoKeyTypeIntoCryptoKeyAlgorithm(options.authorityKey.keyType),
      false,
      'private',
      ['sign']
    )
    const publicKey = new CredoWebCryptoKey(
      subjectPublicKey,
      credoKeyTypeIntoCryptoKeyAlgorithm(options.authorityKey.keyType),
      true,
      'public',
      ['verify']
    )

    const issuerName = convertName(options.issuer)

    const extensions: Array<x509.Extension | undefined> = []
    extensions.push(
      createSubjectKeyIdentifierExtension(options.extensions?.subjectKeyIdentifier, { key: subjectPublicKey })
    )
    extensions.push(createKeyUsagesExtension(options.extensions?.keyUsage))
    extensions.push(createExtendedKeyUsagesExtension(options.extensions?.extendedKeyUsage))
    extensions.push(
      createAuthorityKeyIdentifierExtension(options.extensions?.authorityKeyIdentifier, { key: options.authorityKey })
    )
    extensions.push(createIssuerAlternativeNameExtension(options.extensions?.issuerAlternativeName))
    extensions.push(createSubjectAlternativeNameExtension(options.extensions?.subjectAlternativeName))
    extensions.push(createBasicConstraintsExtension(options.extensions?.basicConstraints))

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

      return X509Certificate.parseCertificate(certificate)
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

    return X509Certificate.parseCertificate(certificate)
  }

  public get subject() {
    const certificate = new x509.X509Certificate(this.rawCertificate)
    return certificate.subject
  }

  public get issuer() {
    const certificate = new x509.X509Certificate(this.rawCertificate)
    return certificate.issuer
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

  /**
   * Get the thumprint of the X509 certificate in hex format.
   */
  public async getThumprintInHex(agentContext: AgentContext) {
    const certificate = new x509.X509Certificate(this.rawCertificate)

    const thumbprint = await certificate.getThumbprint(new CredoWebCrypto(agentContext))
    const thumbprintHex = TypedArrayEncoder.toHex(new Uint8Array(thumbprint))

    return thumbprintHex
  }

  /**
   * Get the data elements of the x509 certificate
   */
  public get data() {
    const certificate = new x509.X509Certificate(this.rawCertificate)

    return {
      issuerName: certificate.issuerName.toString(),
      issuer: certificate.issuer,
      subjectName: certificate.subjectName.toString(),
      subject: certificate.subject,
      serialNumber: certificate.serialNumber,
      pem: certificate.toString(),
      notBefore: certificate.notBefore,
      notAfter: certificate.notAfter,
    }
  }

  public getIssuerNameField(field: string) {
    const certificate = new x509.X509Certificate(this.rawCertificate)
    return certificate.issuerName.getField(field)
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

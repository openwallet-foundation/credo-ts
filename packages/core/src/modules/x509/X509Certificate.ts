import type { X509CreateSelfSignedCertificateOptions } from './X509ServiceOptions'
import type { AgentContext } from '../../agent'

import { AsnParser } from '@peculiar/asn1-schema'
import {
  id_ce_authorityKeyIdentifier,
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

type ExtensionObjectIdentifier = string

type SubjectAlternativeNameExtension = Array<{ type: 'url' | 'dns'; value: string }>
type AuthorityKeyIdentifierExtension = { keyId: string }
type SubjectKeyIdentifierExtension = { keyId: string }
type KeyUsageExtension = { usage: number }

type ExtensionValues =
  | SubjectAlternativeNameExtension
  | AuthorityKeyIdentifierExtension
  | SubjectKeyIdentifierExtension
  | KeyUsageExtension

type Extension = Record<ExtensionObjectIdentifier, ExtensionValues>

export type ExtensionInput = Array<Array<{ type: 'dns' | 'url'; value: string }>>

export enum KeyUsage {
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
          return { [e.type]: { keyId: e.keyId as string } }
        } else if (e instanceof x509.SubjectKeyIdentifierExtension) {
          return { [e.type]: { keyId: e.keyId } }
        } else if (e instanceof x509.SubjectAlternativeNameExtension) {
          return { [e.type]: JSON.parse(JSON.stringify(e.names)) as SubjectAlternativeNameExtension }
        } else if (e instanceof x509.KeyUsagesExtension) {
          return { [e.type]: { usage: e.usages as number } }
        }

        // TODO: We could throw an error when we don't understand the extension?
        // This will break everytime we do not understand an extension though
        return undefined
      })
      .filter((e): e is Exclude<typeof e, undefined> => e !== undefined)

    return new X509Certificate({
      publicKey: key,
      privateKey,
      extensions,
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
        ?.flatMap((e) => e)
        ?.filter((e) => e.type === 'dns')
        ?.map((e) => e.value) ?? []
    )
  }

  public get sanUriNames() {
    const san = this.getMatchingExtensions<SubjectAlternativeNameExtension>(id_ce_subjectAltName)
    return (
      san
        ?.flatMap((e) => e)
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

  public get keyUsage(): Array<KeyUsage> {
    const keyUsages = this.getMatchingExtensions<KeyUsageExtension>(id_ce_keyUsage)?.map((e) => e.usage)

    if (keyUsages && keyUsages.length > 1) {
      throw new X509Error('Multiple Key Usages are not allowed')
    }

    if (keyUsages) {
      return Object.values(KeyUsage)
        .filter((key): key is number => typeof key === 'number')
        .filter((flagValue) => (keyUsages[0] & flagValue) === flagValue)
        .map((flagValue) => flagValue as KeyUsage)
    }

    return []
  }

  public static async createSelfSigned(
    {
      key,
      extensions,
      notAfter,
      notBefore,
      name,
      includeAuthorityKeyIdentifier = true,
    }: X509CreateSelfSignedCertificateOptions,
    webCrypto: CredoWebCrypto
  ) {
    const cryptoKeyAlgorithm = credoKeyTypeIntoCryptoKeyAlgorithm(key.keyType)

    const publicKey = new CredoWebCryptoKey(key, cryptoKeyAlgorithm, true, 'public', ['verify'])
    const privateKey = new CredoWebCryptoKey(key, cryptoKeyAlgorithm, false, 'private', ['sign'])

    const hexPublicKey = TypedArrayEncoder.toHex(key.publicKey)

    const x509Extensions: Array<x509.Extension> = [
      new x509.SubjectKeyIdentifierExtension(hexPublicKey),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyCertSign),
    ]

    if (includeAuthorityKeyIdentifier) {
      x509Extensions.push(new x509.AuthorityKeyIdentifierExtension(hexPublicKey))
    }

    for (const extension of extensions ?? []) {
      x509Extensions.push(new x509.SubjectAlternativeNameExtension(extension))
    }

    const certificate = await x509.X509CertificateGenerator.createSelfSigned(
      {
        keys: { publicKey, privateKey },
        name,
        extensions: x509Extensions,
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

  /**
   * Get the thumprint of the X509 certificate in hex format.
   */
  public async getThumprint(agentContext: AgentContext) {
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

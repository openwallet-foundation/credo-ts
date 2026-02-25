import { AsnParser } from '@peculiar/asn1-schema'
import {
  id_ce_extKeyUsage,
  id_ce_keyUsage,
  id_ce_subjectAltName,
  id_ce_subjectKeyIdentifier,
  SubjectPublicKeyInfo,
} from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'
import {
  CredoWebCrypto,
  CredoWebCryptoKey,
  jwaAlgorithmToKeySignParams,
  publicJwkToCryptoKeyAlgorithm,
} from '../../crypto/webcrypto'
import { spkiToPublicJwk } from '../../crypto/webcrypto/utils'
import type { AnyUint8Array } from '../../types'
import { PublicJwk } from '../kms'
import {
  convertName,
  createExtendedKeyUsagesExtension,
  createKeyUsagesExtension,
  createSubjectAlternativeNameExtension,
  createSubjectKeyIdentifierExtension,
} from './utils'
import { X509ExtendedKeyUsage, X509KeyUsage } from './X509Certificate'
import { X509Error } from './X509Error'
import type { X509CreateCertificateSigningRequestOptions } from './X509ServiceOptions'

export type CertificateSigningRequestOptions = {
  publicJwk: PublicJwk
  certificateRequest: x509.Pkcs10CertificateRequest
}

export class CertificateSigningRequest {
  public publicJwk: PublicJwk
  private certificateRequest: x509.Pkcs10CertificateRequest

  private constructor(options: CertificateSigningRequestOptions) {
    this.publicJwk = options.publicJwk
    this.certificateRequest = options.certificateRequest
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

  public static fromRawCertificateRequest(rawCertificateRequest: AnyUint8Array): CertificateSigningRequest {
    const certificateRequest = new x509.Pkcs10CertificateRequest(rawCertificateRequest)
    return CertificateSigningRequest.parseCertificateRequest(certificateRequest)
  }

  public static fromEncodedCertificateRequest(encodedCertificateRequest: string): CertificateSigningRequest {
    const certificateRequest = new x509.Pkcs10CertificateRequest(encodedCertificateRequest)
    return CertificateSigningRequest.parseCertificateRequest(certificateRequest)
  }

  private static parseCertificateRequest(certificateRequest: x509.Pkcs10CertificateRequest): CertificateSigningRequest {
    const spki = AsnParser.parse(certificateRequest.publicKey.rawData, SubjectPublicKeyInfo)
    const publicJwk = spkiToPublicJwk(spki)

    return new CertificateSigningRequest({
      publicJwk,
      certificateRequest,
    })
  }

  private getMatchingExtensions<T = { critical: boolean }>(objectIdentifier: string): Array<T> | undefined {
    const matchingExtensions = this.certificateRequest.extensions.filter((e) => e.type === objectIdentifier)
    if (matchingExtensions.length === 0) return undefined
    return matchingExtensions as Array<T>
  }

  public get rawCertificateRequest() {
    return new Uint8Array(this.certificateRequest.rawData)
  }

  public get subjectAlternativeNames() {
    const san = this.getMatchingExtensions<x509.SubjectAlternativeNameExtension>(id_ce_subjectAltName)
    return san?.flatMap((s) => s.names.items ?? []).map((i) => ({ type: i.type, value: i.value })) ?? []
  }

  public get sanDnsNames() {
    return this.subjectAlternativeNames.filter((san) => san.type === 'dns').map((san) => san.value)
  }

  public get sanUriNames() {
    return this.subjectAlternativeNames.filter((san) => san.type === 'url').map((san) => san.value)
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

  public get keyUsage() {
    const keyUsages = this.getMatchingExtensions<x509.KeyUsagesExtension>(id_ce_keyUsage)?.map((e) => e.usages)

    if (keyUsages && keyUsages.length > 1) {
      throw new X509Error('Multiple Key Usages are not allowed')
    }

    if (keyUsages && keyUsages.length > 0) {
      return Object.values(X509KeyUsage)
        .filter((key): key is number => typeof key === 'number')
        .filter((flagValue) => (keyUsages[0] & flagValue) === flagValue)
        .map((flagValue) => flagValue as X509KeyUsage)
    }

    return []
  }

  public get extendedKeyUsage() {
    const extendedKeyUsages = this.getMatchingExtensions<x509.ExtendedKeyUsageExtension>(id_ce_extKeyUsage)?.map(
      (e) => e.usages
    )

    if (extendedKeyUsages && extendedKeyUsages.length > 1) {
      throw new X509Error('Multiple Extended Key Usages are not allowed')
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

  public static async create(options: X509CreateCertificateSigningRequestOptions, webCrypto: CredoWebCrypto) {
    const signingKey = new CredoWebCryptoKey(
      options.subjectPublicKey,
      publicJwkToCryptoKeyAlgorithm(options.subjectPublicKey),
      false,
      'private',
      ['sign']
    )
    const publicKey = new CredoWebCryptoKey(
      options.subjectPublicKey,
      publicJwkToCryptoKeyAlgorithm(options.subjectPublicKey),
      true,
      'public',
      ['verify']
    )

    const extensions: Array<x509.Extension | undefined> = []
    extensions.push(
      createSubjectKeyIdentifierExtension(options.extensions?.subjectKeyIdentifier, {
        publicJwk: options.subjectPublicKey,
      })
    )
    extensions.push(createKeyUsagesExtension(options.extensions?.keyUsage))
    extensions.push(createExtendedKeyUsagesExtension(options.extensions?.extendedKeyUsage))
    extensions.push(createSubjectAlternativeNameExtension(options.extensions?.subjectAlternativeName))

    const subjectName = convertName(options.subject)

    // Get the JWA signature algorithm from the public key and convert to KeySignParams
    const jwaAlgorithm = options.subjectPublicKey.signatureAlgorithm
    const signingAlgorithm = jwaAlgorithmToKeySignParams(jwaAlgorithm)

    const csr = await x509.Pkcs10CertificateRequestGenerator.create(
      {
        keys: { publicKey, privateKey: signingKey },
        name: subjectName,
        signingAlgorithm,
        extensions: extensions.filter((e) => e !== undefined),
      },
      webCrypto
    )

    const csrInstance = CertificateSigningRequest.parseCertificateRequest(csr)
    if (options.subjectPublicKey.hasKeyId) csrInstance.publicJwk.keyId = options.subjectPublicKey.keyId
    return csrInstance
  }

  public get subject() {
    return this.certificateRequest.subject
  }

  public get subjectName() {
    return this.certificateRequest.subjectName.toString()
  }

  public async verify(webCrypto: CredoWebCrypto) {
    const isValid = await this.certificateRequest.verify(webCrypto)

    if (!isValid) {
      throw new X509Error(
        `Certificate Signing Request for '${this.certificateRequest.subject}' has an invalid signature`
      )
    }
  }

  /**
   * Get the data elements of the certificate signing request
   */
  public get data() {
    return {
      subjectName: this.certificateRequest.subjectName.toString(),
      subject: this.certificateRequest.subject,
      pem: this.certificateRequest.toString(),
    }
  }

  public getSubjectNameField(field: string) {
    return this.certificateRequest.subjectName.getField(field)
  }

  /**
   * @param format the format to export to, defaults to `pem`
   */
  public toString(format?: 'asn' | 'pem' | 'hex' | 'base64' | 'text' | 'base64url') {
    return this.certificateRequest.toString(format ?? 'pem')
  }

  public equal(certificateRequest: CertificateSigningRequest) {
    const parsedOther = new x509.Pkcs10CertificateRequest(certificateRequest.rawCertificateRequest)

    return this.certificateRequest.equal(parsedOther)
  }
}

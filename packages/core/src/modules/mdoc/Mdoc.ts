import type { IssuerSignedDocument } from '@animo-id/mdoc'
import {
  COSEKey,
  cborEncode,
  DeviceSignedDocument,
  Document,
  parseDeviceSigned,
  parseIssuerSigned,
  Verifier,
} from '@animo-id/mdoc'
import type { AgentContext } from '../../agent'
import { TypedArrayEncoder } from './../../utils'
import { type KnownJwaSignatureAlgorithm, PublicJwk } from '../kms'
import { isKnownJwaSignatureAlgorithm } from '../kms/jwk/jwa'
import { ClaimFormat } from '../vc/index'
import { X509Certificate, X509ModuleConfig } from '../x509'
import { getMdocContext } from './MdocContext'
import { MdocError } from './MdocError'
import type { MdocNameSpaces, MdocSignOptions, MdocVerifyOptions } from './MdocOptions'
import { isMdocSupportedSignatureAlgorithm, mdocSupportedSignatureAlgorithms } from './mdocSupportedAlgs'

/**
 * This class represents a IssuerSigned Mdoc Document,
 * which are the actual credentials being issued to holders.
 */
export class Mdoc {
  public base64Url: string
  #deviceKeyId?: string

  private constructor(public issuerSignedDocument: IssuerSignedDocument | DeviceSignedDocument) {
    const issuerSigned = issuerSignedDocument.prepare().get('issuerSigned')
    this.base64Url = TypedArrayEncoder.toBase64URL(cborEncode(issuerSigned))
  }

  /**
   * claim format is convenience method added to all credential instances
   */
  public get claimFormat() {
    return ClaimFormat.MsoMdoc as const
  }

  /**
   * Encoded is convenience method added to all credential instances
   */
  public get encoded() {
    return this.base64Url
  }

  /**
   * Get the device key to which the mdoc is bound
   */
  public get deviceKey(): PublicJwk {
    const deviceKeyRaw = this.issuerSignedDocument.issuerSigned.issuerAuth.decodedPayload.deviceKeyInfo?.deviceKey
    if (!deviceKeyRaw) throw new MdocError('Could not extract device key from mdoc')

    const publicJwk = PublicJwk.fromUnknown(COSEKey.import(deviceKeyRaw).toJWK())
    if (this.#deviceKeyId) publicJwk.keyId = this.#deviceKeyId
    return publicJwk
  }

  public set deviceKeyId(keyId: string | undefined) {
    this.#deviceKeyId = keyId
  }

  public get deviceKeyId() {
    const deviceKey = this.deviceKey

    if (deviceKey.hasKeyId) return deviceKey.keyId
    return undefined
  }

  public static fromBase64Url(mdocBase64Url: string, expectedDocType?: string): Mdoc {
    const issuerSignedDocument = parseIssuerSigned(TypedArrayEncoder.fromBase64(mdocBase64Url), expectedDocType)
    return new Mdoc(issuerSignedDocument)
  }

  public static fromIssuerSignedDocument(issuerSignedBase64Url: string, expectedDocType?: string): Mdoc {
    return new Mdoc(parseIssuerSigned(TypedArrayEncoder.fromBase64(issuerSignedBase64Url), expectedDocType))
  }

  public static fromDeviceSignedDocument(
    issuerSignedBase64Url: string,
    deviceSignedBase64Url: string,
    expectedDocType?: string
  ): Mdoc {
    return new Mdoc(
      parseDeviceSigned(
        TypedArrayEncoder.fromBase64(deviceSignedBase64Url),
        TypedArrayEncoder.fromBase64(issuerSignedBase64Url),
        expectedDocType
      )
    )
  }

  public get docType(): string {
    return this.issuerSignedDocument.docType
  }

  public get alg(): KnownJwaSignatureAlgorithm {
    const algName = this.issuerSignedDocument.issuerSigned.issuerAuth.algName
    if (!algName) {
      throw new MdocError('Cannot extract the signature algorithm from the mdoc.')
    }
    if (isKnownJwaSignatureAlgorithm(algName)) {
      return algName
    }

    throw new MdocError(`Cannot parse mdoc. The signature algorithm '${algName}' is not supported.`)
  }

  public get validityInfo() {
    return this.issuerSignedDocument.issuerSigned.issuerAuth.decodedPayload.validityInfo
  }

  public get deviceSignedNamespaces(): MdocNameSpaces | null {
    if (this.issuerSignedDocument instanceof DeviceSignedDocument === false) {
      return null
    }

    return Object.fromEntries(
      Array.from(this.issuerSignedDocument.allDeviceSignedNamespaces.entries()).map(([namespace, value]) => [
        namespace,
        Object.fromEntries(Array.from(value.entries())),
      ])
    )
  }

  public get issuerSignedCertificateChain() {
    return this.issuerSignedDocument.issuerSigned.issuerAuth.certificateChain
  }

  public get signingCertificate() {
    return this.issuerSignedDocument.issuerSigned.issuerAuth.certificate
  }

  public get issuerSignedNamespaces(): MdocNameSpaces {
    return Object.fromEntries(
      Array.from(this.issuerSignedDocument.allIssuerSignedNamespaces.entries()).map(([namespace, value]) => [
        namespace,
        Object.fromEntries(Array.from(value.entries())),
      ])
    )
  }

  public static async sign(agentContext: AgentContext, options: MdocSignOptions) {
    const { docType, validityInfo, namespaces, holderKey, issuerCertificate } = options
    const mdocContext = getMdocContext(agentContext)

    const document = new Document(docType, mdocContext)
      .useDigestAlgorithm('SHA-256')
      .addValidityInfo(validityInfo)
      .addDeviceKeyInfo({ deviceKey: holderKey.toJson() })

    for (const [namespace, namespaceRecord] of Object.entries(namespaces)) {
      document.addIssuerNameSpace(namespace, namespaceRecord)
    }

    const issuerKey = issuerCertificate.publicJwk
    const alg = issuerKey.supportedSignatureAlgorithms.find(isMdocSupportedSignatureAlgorithm)
    if (!alg) {
      throw new MdocError(
        `Unable to create sign mdoc. No supported signature algorithm found to sign mdoc for jwk with key ${
          issuerKey.jwkTypeHumanDescription
        }. Key supports algs ${issuerKey.supportedSignatureAlgorithms.join(
          ', '
        )}. mdoc supports algs ${mdocSupportedSignatureAlgorithms.join(', ')}`
      )
    }

    const issuerSignedDocument = await document.sign(
      {
        issuerPrivateKey: issuerKey.toJson(),
        alg,
        issuerCertificate: issuerCertificate.rawCertificate,
      },
      mdocContext
    )

    return new Mdoc(issuerSignedDocument)
  }

  public async verify(
    agentContext: AgentContext,
    options?: MdocVerifyOptions
  ): Promise<{ isValid: true } | { isValid: false; error: string }> {
    const x509ModuleConfig = agentContext.dependencyManager.resolve(X509ModuleConfig)
    const certificateChain = this.issuerSignedDocument.issuerSigned.issuerAuth.certificateChain.map((certificate) =>
      X509Certificate.fromRawCertificate(certificate)
    )

    let trustedCertificates = options?.trustedCertificates
    if (!trustedCertificates) {
      trustedCertificates =
        (await x509ModuleConfig.getTrustedCertificatesForVerification?.(agentContext, {
          verification: {
            type: 'credential',
            credential: this,
          },
          certificateChain,
        })) ?? x509ModuleConfig.trustedCertificates
    }

    if (!trustedCertificates) {
      throw new MdocError('No trusted certificates found. Cannot verify mdoc.')
    }

    const mdocContext = getMdocContext(agentContext, {
      now: options?.now,
    })
    try {
      const verifier = new Verifier()
      await verifier.verifyIssuerSignature(
        {
          trustedCertificates: trustedCertificates.map(
            (cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate
          ),
          issuerAuth: this.issuerSignedDocument.issuerSigned.issuerAuth,
          disableCertificateChainValidation: false,
          now: options?.now,
        },
        mdocContext
      )

      await verifier.verifyData({ mdoc: this.issuerSignedDocument }, mdocContext)
      return { isValid: true }
    } catch (error) {
      return { isValid: false, error: error.message }
    }
  }
}

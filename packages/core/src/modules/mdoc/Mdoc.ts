import { DeviceKey, DeviceKeyInfo, Holder, Issuer, IssuerSigned, SignatureAlgorithm } from '@owf/mdoc'
import type { AgentContext } from '../../agent'
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
  public get base64Url() {
    return this.issuerSigned.encodedForOid4Vci
  }

  #deviceKeyId?: string

  public constructor(public issuerSigned: IssuerSigned) {}

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
    return this.issuerSigned.encodedForOid4Vci
  }

  /**
   * Get the device key to which the mdoc is bound
   */
  public get deviceKey(): PublicJwk {
    const publicJwk = PublicJwk.fromUnknown(
      this.issuerSigned.issuerAuth.mobileSecurityObject.deviceKeyInfo.deviceKey.jwk
    )

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

  public static fromBase64Url(mdocBase64Url: string): Mdoc {
    const issuerSigned = IssuerSigned.fromEncodedForOid4Vci(mdocBase64Url)
    return new Mdoc(issuerSigned)
  }

  public get docType(): string {
    return this.issuerSigned.issuerAuth.mobileSecurityObject.docType
  }

  public get alg(): KnownJwaSignatureAlgorithm {
    const algName = this.issuerSigned.issuerAuth.signatureAlgorithmName
    if (isKnownJwaSignatureAlgorithm(algName)) {
      return algName
    }

    throw new MdocError(`Cannot parse mdoc. The signature algorithm '${algName}' is not supported.`)
  }

  public get validityInfo() {
    const { signed, validFrom, validUntil } = this.issuerSigned.issuerAuth.mobileSecurityObject.validityInfo
    return {
      signed,
      validFrom,
      validUntil,
    }
  }

  public get issuerSignedCertificateChain() {
    return this.issuerSigned.issuerAuth.certificateChain
  }

  public get signingCertificate() {
    return this.issuerSigned.issuerAuth.certificate
  }

  public get issuerSignedNamespaces(): MdocNameSpaces {
    if (!this.issuerSigned.issuerNamespaces?.issuerNamespaces) return {}

    return Object.fromEntries(
      Array.from(this.issuerSigned.issuerNamespaces.issuerNamespaces.entries()).map(([namespace, value]) => [
        namespace,
        Object.fromEntries(Array.from(value.values()).map((v) => [v.elementIdentifier, v.elementValue])),
      ])
    )
  }

  public static async sign(agentContext: AgentContext, options: MdocSignOptions) {
    const { docType, validityInfo, namespaces, holderKey, issuerCertificate } = options
    const mdocContext = getMdocContext(agentContext)

    const issuer = new Issuer(docType, mdocContext)

    for (const [namespace, namespaceRecord] of Object.entries(namespaces)) {
      issuer.addIssuerNamespace(namespace, namespaceRecord)
    }

    const issuerKey = Array.isArray(issuerCertificate) ? issuerCertificate[0].publicJwk : issuerCertificate.publicJwk
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

    const now = new Date()
    const issuerSigned = await issuer.sign({
      digestAlgorithm: 'SHA-256',
      validityInfo: {
        ...validityInfo,
        signed: validityInfo.signed ?? now,
        validFrom: validityInfo.validFrom ?? now,
      },
      algorithm: SignatureAlgorithm[alg],
      certificates: Array.isArray(issuerCertificate)
        ? issuerCertificate.map((c) => c.rawCertificate)
        : [issuerCertificate.rawCertificate],
      deviceKeyInfo: DeviceKeyInfo.create({ deviceKey: DeviceKey.fromJwk(holderKey.toJson()) }),
      signingKey: issuerKey.toJson(),
    })

    return new Mdoc(issuerSigned)
  }

  public async verify(
    agentContext: AgentContext,
    options?: MdocVerifyOptions
  ): Promise<{ isValid: true } | { isValid: false; error: string }> {
    const x509ModuleConfig = agentContext.dependencyManager.resolve(X509ModuleConfig)
    const certificateChain = this.issuerSigned.issuerAuth.certificateChain.map((certificate) =>
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
      await Holder.verifyIssuerSigned(
        {
          trustedCertificates: trustedCertificates.map(
            (cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate
          ),
          issuerSigned: this.issuerSigned,
          disableCertificateChainValidation: false,
          now: options?.now,
        },
        mdocContext
      )

      return { isValid: true }
    } catch (error) {
      return { isValid: false, error: error.message }
    }
  }
}

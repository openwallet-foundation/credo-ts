import { DeviceKey, DeviceKeyInfo, Holder, Issuer, IssuerSigned, SignatureAlgorithm } from '@owf/mdoc'
import type { AgentContext } from '../../agent'
import { getMdocContext } from '../../crypto/contexts/mdocContext'
import { type KnownJwaSignatureAlgorithm, PublicJwk } from '../kms'
import { isKnownJwaSignatureAlgorithm } from '../kms/jwk/jwa'
import { ClaimFormat } from '../vc/index'
import { X509Certificate } from '../x509'
import { convertLegacyTrustedCertificates } from '../x509/utils/convertLegacyTrustedCertificates'
import { X509ModuleConfig } from '../x509/X509ModuleConfig'
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
    const jwaAlg = this.issuerSigned.issuerAuth.jwaAlgorithm

    if (!jwaAlg) {
      throw new MdocError('The IssuerAuth does not have a valid signature algorithm in the header')
    }

    if (isKnownJwaSignatureAlgorithm(jwaAlg)) {
      return jwaAlg
    }

    throw new MdocError(`Cannot parse mdoc. The signature algorithm '${jwaAlg}' is not supported.`)
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
      status: options.statusInfo
        ? {
            statusList: {
              idx: options.statusInfo.index,
              uri: options.statusInfo.uri,
              certificate: options.statusInfo.certificate?.rawCertificate,
            },
          }
        : undefined,
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

    const trustedCertificates =
      options?.trustedCertificates ??
      (await x509ModuleConfig.getTrustedCertificatesForVerification?.(agentContext, {
        verification: {
          type: 'credential',
          credential: this,
        },
        certificateChain,
      })) ??
      x509ModuleConfig.trustedCertificates

    if (!trustedCertificates) {
      throw new MdocError('No trusted certificates found. Cannot verify mdoc.')
    }

    const mdocContext = getMdocContext(agentContext, {
      now: options?.now,
    })

    try {
      const convertedTrustedCertificates = convertLegacyTrustedCertificates(trustedCertificates)
      const { trustedIssuanceChain, trustedStatusListChain, trustedIdentifierListChain } =
        await Holder.verifyIssuerSigned(
          {
            trustedCertificates: convertedTrustedCertificates.map(({ issuance, status }) => ({
              issuance: issuance.map((cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate),
              status: status?.map((cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate),
            })),
            issuerSigned: this.issuerSigned,
            disableCertificateChainValidation: false,
            disableStatusValidation: false,
            now: options?.now,
          },
          mdocContext
        )

      const x509ChainsAreEqual = (a: X509Certificate[], b: X509Certificate[]) =>
        a.length === b.length && a.every((cert, i) => cert.equal(b[i]))

      const issuanceChain = trustedIssuanceChain.map((c) => X509Certificate.fromRawCertificate(c))

      if (!x509ChainsAreEqual(certificateChain, issuanceChain)) {
        throw new MdocError('Certificate chain does not match the trusted issuance chain')
      }

      // The matched trusted certificates entry is the one whose `issuance` contains the trust anchor (root) of the issuance chain.
      // When that entry has dedicated `status` certificates, the status/identifier list chains are allowed to use a different
      // trust anchor than the issuance chain. Otherwise the library falls back to the issuance certificates for status/identifier
      // validation, so we require those chains to match the issuance chain.
      const issuanceRoot = issuanceChain[issuanceChain.length - 1]
      const matchedTrustedCertificates = convertedTrustedCertificates.find(({ issuance }) =>
        issuance.some((cert) => X509Certificate.fromEncodedCertificate(cert).equal(issuanceRoot))
      )
      const hasDedicatedStatusCertificates = (matchedTrustedCertificates?.status?.length ?? 0) > 0

      if (!hasDedicatedStatusCertificates) {
        if (
          trustedIdentifierListChain &&
          !x509ChainsAreEqual(
            trustedIdentifierListChain.map((c) => X509Certificate.fromRawCertificate(c)),
            issuanceChain
          )
        ) {
          throw new MdocError('Trusted identifier list chain does not match the trusted issuance chain')
        }

        if (
          trustedStatusListChain &&
          !x509ChainsAreEqual(
            trustedStatusListChain.map((c) => X509Certificate.fromRawCertificate(c)),
            issuanceChain
          )
        ) {
          throw new MdocError('Trusted status list chain does not match the trusted issuance chain')
        }
      }

      return { isValid: true }
    } catch (error) {
      return { isValid: false, error: error.message }
    }
  }
}

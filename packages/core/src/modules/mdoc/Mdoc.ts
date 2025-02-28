import type { IssuerSignedDocument } from '@animo-id/mdoc'
import type { AgentContext } from '../../agent'
import type { MdocNameSpaces, MdocSignOptions, MdocVerifyOptions } from './MdocOptions'

import {
  DeviceSignedDocument,
  Document,
  Verifier,
  cborEncode,
  parseDeviceSigned,
  parseIssuerSigned,
} from '@animo-id/mdoc'

import { JwaSignatureAlgorithm, getJwkFromKey } from '../../crypto'
import { X509Certificate, X509ModuleConfig } from '../x509'

import { TypedArrayEncoder } from './../../utils'
import { getMdocContext } from './MdocContext'
import { MdocError } from './MdocError'
import { isMdocSupportedSignatureAlgorithm, mdocSupporteSignatureAlgorithms } from './mdocSupportedAlgs'

/**
 * This class represents a IssuerSigned Mdoc Document,
 * which are the actual credentials being issued to holders.
 */
export class Mdoc {
  public base64Url: string
  private constructor(private issuerSignedDocument: IssuerSignedDocument) {
    const issuerSigned = issuerSignedDocument.prepare().get('issuerSigned')
    this.base64Url = TypedArrayEncoder.toBase64URL(cborEncode(issuerSigned))
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
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>

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

  public get alg(): JwaSignatureAlgorithm {
    const algName = this.issuerSignedDocument.issuerSigned.issuerAuth.algName
    if (!algName) {
      throw new MdocError('Cannot extract the signature algorithm from the mdoc.')
    }
    if (Object.values(JwaSignatureAlgorithm).includes(algName as JwaSignatureAlgorithm)) {
      return algName as JwaSignatureAlgorithm
    }
    throw new MdocError(`Cannot parse mdoc. The signature algorithm '${algName}' is not supported.`)
  }

  public get validityInfo() {
    return this.issuerSignedDocument.issuerSigned.issuerAuth.decodedPayload.validityInfo
  }

  public get deviceSignedNamespaces(): MdocNameSpaces {
    if (this.issuerSignedDocument instanceof DeviceSignedDocument === false) {
      throw new MdocError(`Cannot get 'device-namespaces from a IssuerSignedDocument. Must be a DeviceSignedDocument.`)
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

    const holderPublicJwk = getJwkFromKey(holderKey)
    const document = new Document(docType, mdocContext)
      .useDigestAlgorithm('SHA-256')
      .addValidityInfo(validityInfo)
      .addDeviceKeyInfo({ deviceKey: holderPublicJwk.toJson() })

    for (const [namespace, namespaceRecord] of Object.entries(namespaces)) {
      document.addIssuerNameSpace(namespace, namespaceRecord)
    }

    const cert = X509Certificate.fromEncodedCertificate(issuerCertificate)
    const issuerKey = getJwkFromKey(cert.publicKey)

    const alg = issuerKey.supportedSignatureAlgorithms.find(isMdocSupportedSignatureAlgorithm)
    if (!alg) {
      throw new MdocError(
        `Unable to create sign mdoc. No supported signature algorithm found to sign mdoc for jwk with key type ${
          issuerKey.keyType
        }. Key supports algs ${issuerKey.supportedSignatureAlgorithms.join(
          ', '
        )}. mdoc supports algs ${mdocSupporteSignatureAlgorithms.join(', ')}`
      )
    }

    const issuerSignedDocument = await document.sign(
      {
        issuerPrivateKey: issuerKey.toJson(),
        alg,
        issuerCertificate,
        kid: cert.publicKey.fingerprint,
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

    const mdocContext = getMdocContext(agentContext)
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

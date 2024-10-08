import type { MdocCreateOptions, MdocNameSpaces, MdocVerifyOptions } from './MdocOptions'
import type { AgentContext } from '../../agent'
import type { IssuerSignedDocument } from '@protokoll/mdoc-client'

import { DeviceSignedDocument, Document, Verifier, cborEncode, parseIssuerSigned } from '@protokoll/mdoc-client'

import { getJwkFromKey, JwaSignatureAlgorithm } from '../../crypto'
import { X509Certificate, X509ModuleConfig } from '../x509'

import { TypedArrayEncoder } from './../../utils'
import { getMdocContext } from './MdocContext'
import { MdocError } from './MdocError'

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

  public static _interalFromIssuerSignedDocument(issuerSignedDocument: IssuerSignedDocument) {
    return new Mdoc(issuerSignedDocument)
  }

  public static fromBase64Url(mdocBase64Url: string, expectedDocType?: string): Mdoc {
    const issuerSignedDocument = parseIssuerSigned(TypedArrayEncoder.fromBase64(mdocBase64Url), expectedDocType)
    return new Mdoc(issuerSignedDocument)
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

    return this.issuerSignedDocument.allDeviceSignedNamespaces
  }

  public get issuerSignedNamespaces(): MdocNameSpaces {
    return this.issuerSignedDocument.allIssuerSignedNamespaces
  }

  public static async create(agentContext: AgentContext, options: MdocCreateOptions) {
    const { docType, validityInfo, namespaces, holderPublicKey, issuerCertificate } = options
    const mdocContext = getMdocContext(agentContext)

    const holderPublicJwk = await getJwkFromKey(holderPublicKey)
    const document = new Document(docType, mdocContext)
      .useDigestAlgorithm('SHA-256')
      .addValidityInfo(validityInfo)
      .addDeviceKeyInfo({ deviceKey: holderPublicJwk.toJson() })

    for (const [namespace, namespaceRecord] of Object.entries(namespaces)) {
      document.addIssuerNameSpace(namespace, namespaceRecord)
    }

    const cert = X509Certificate.fromEncodedCertificate(issuerCertificate)
    const issuerPrivateJwk = await getJwkFromKey(options.issuerKey ?? cert.publicKey)
    const issuerSignedDocument = await document.sign(
      {
        issuerPrivateKey: issuerPrivateJwk.toJson(),
        alg: issuerPrivateJwk.supportedSignatureAlgorithms[0] as 'ES256' | 'ES384' | 'ES512' | 'EdDSA',
        issuerCertificate,
        kid: cert.publicKey.fingerprint,
      },
      mdocContext
    )

    return new Mdoc(issuerSignedDocument)
  }

  public async verify(agentContext: AgentContext, options?: MdocVerifyOptions): Promise<boolean> {
    const trustedCerts =
      options?.trustedCertificates ?? agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates

    if (!trustedCerts) {
      throw new MdocError('No trusted certificates found. Cannot verify mdoc.')
    }

    const mdocContext = getMdocContext(agentContext)
    try {
      const verifier = new Verifier()
      await verifier.verifyIssuerSignature(
        {
          trustedCertificates: trustedCerts.map((cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate),
          issuerAuth: this.issuerSignedDocument.issuerSigned.issuerAuth,
          disableCertificateChainValidation: false,
          now: options?.now,
        },
        getMdocContext(agentContext)
      )

      await verifier.verifyData({ mdoc: this.issuerSignedDocument }, mdocContext)
      return true
    } catch (error) {
      return false
    }
  }
}

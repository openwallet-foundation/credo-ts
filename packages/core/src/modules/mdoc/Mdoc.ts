import type { AgentContext } from '../../agent'

import { com } from '@sphereon/kmp-mdl-mdoc'

import { JwaSignatureAlgorithm } from '../../crypto'
import { TypedArrayEncoder } from '../../utils'

import { MdocCoseCallbackService } from './MdocCoseCallbackService'
import { MdocError } from './MdocError'
import { MdocX509CallbackService } from './MdocX509CallbackService'

type IssuerSignedJson = com.sphereon.mdoc.data.device.IssuerSignedJson
type IssuerSignedCbor = com.sphereon.mdoc.data.device.IssuerSignedCbor

export type MdocIssuerSignedItem<T = unknown> = com.sphereon.mdoc.data.device.IssuerSignedItemJson<T>
export type MdocNamespaceData = Record<string, MdocIssuerSignedItem>
export type MdocNamespace = Record<string, MdocNamespaceData>

export class Mdoc {
  private _docType: string
  private issuerSignedJson: IssuerSignedJson
  private issuerSignedCbor: IssuerSignedCbor
  private _hexEncodedMdoc: string

  private constructor(hexEncodedMdoc: string) {
    this._docType = 'org.iso.18013.5.1.mDL' // TODO: This will be a part of the { ... issuerSigned } structure
    this._hexEncodedMdoc = hexEncodedMdoc

    // TODO: THIS IS WRONG! it should not only be the issuersigned part!
    this.issuerSignedCbor = com.sphereon.mdoc.data.device.IssuerSignedCbor.Companion.cborDecode(
      Int8Array.from(TypedArrayEncoder.fromHex(hexEncodedMdoc))
    )
    this.issuerSignedJson = this.issuerSignedCbor.toJson()
  }

  public get docType() {
    return this._docType
  }

  public get namespaces() {
    const namespaces: MdocNamespace = {}
    const entries = this.issuerSignedJson.nameSpaces?.asJsMapView().entries()

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = entries?.next()
      if (next?.done) break
      if (!next?.value) {
        throw new MdocError('Missing value in Mdoc')
      }

      // TODO: THIS IS NOT SUFFICIENT
      const mdocDataItem = next.value[1]
      const mdocDataItemRecord: Record<string, MdocIssuerSignedItem> = Object.fromEntries(
        mdocDataItem.map((dataItem) => [dataItem.elementIdentifier, dataItem.elementValue])
      )

      namespaces[next.value[0]] = mdocDataItemRecord
    }

    return namespaces
  }

  public get jwaSignatureAlgorithm() {
    const alg = this.issuerSignedJson.issuerAuth.protectedHeader.alg?.name

    if (!alg || !Object.values(JwaSignatureAlgorithm).includes(alg as JwaSignatureAlgorithm)) {
      throw new MdocError(`Invalid Signature Algorithm on MDoc Document. Alg '${alg}'`)
    }

    return alg as JwaSignatureAlgorithm
  }

  public static fromHexEncodedMdoc(hexEncodedMdoc: string) {
    return new Mdoc(hexEncodedMdoc)
  }

  public static fromBase64UrlEncodedMdoc(base64UrlEncodedMdoc: string) {
    const hexEncodedMdoc = TypedArrayEncoder.fromBase64(base64UrlEncodedMdoc).toString('hex')

    return this.fromHexEncodedMdoc(hexEncodedMdoc)
  }

  public get hexEncodedMdoc() {
    return this._hexEncodedMdoc
  }

  public async verify(agentContext: AgentContext, options: { trustedCertificates: [string, ...string[]] }) {
    const { trustedCertificates } = options

    const cryptoServiceJS = com.sphereon.crypto.CryptoServiceJS

    // TODO: This way of of registering and working with the x509/cose services is subject to race-conditions
    // TODO: This is a known issue and beeing worked on by sphereon
    // We register this service with the mDL/mdoc library
    cryptoServiceJS.X509.register(new MdocX509CallbackService(agentContext, trustedCertificates))
    cryptoServiceJS.COSE.register(new MdocCoseCallbackService())

    const verificationResult = await com.sphereon.mdoc.ValidationsJS.fromIssuerAuthAsync(
      this.issuerSignedCbor.issuerAuth,
      null,
      trustedCertificates
    )

    if (verificationResult.error) {
      return {
        isValid: false,
        error: verificationResult.verifications,
      }
    }

    return {
      isValid: true,
    } as const
  }
}

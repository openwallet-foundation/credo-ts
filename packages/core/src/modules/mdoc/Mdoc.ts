import type { AgentContext } from '../../agent'

import { com, kotlin } from '@sphereon/kmp-mdl-mdoc'

import { JwaSignatureAlgorithm } from '../../crypto'
import { CredoError } from '../../error'
import { X509Service } from '../../modules/x509'
import { Buffer, TypedArrayEncoder } from '../../utils'

import { MdocCoseCallbackService } from './MdocCoseCallbackService'
import { MdocError } from './MdocError'
import { MdocX509CallbackService } from './MdocX509CallbackService'

type IssuerSignedJson = com.sphereon.mdoc.data.device.IssuerSignedJson
type IssuerSignedItemJson = com.sphereon.mdoc.data.device.IssuerSignedItemJson
type IssuerSignedCbor = com.sphereon.mdoc.data.device.IssuerSignedCbor

type MdocNamespaceData = Record<string, unknown>
export type MdocNamespaces = Record<string, MdocNamespaceData>

export class Mdoc {
  private issuerSignedCbor: IssuerSignedCbor
  private issuerSignedJson: IssuerSignedJson

  private constructor(buffer: Buffer) {
    // TODO: CONVERSION FROM CBOR TO JSON AND BACK CURRENTLY NOT COMPLETELY WORKING THEREFORE WE STORE BOTH FOR NOW
    this.issuerSignedCbor = com.sphereon.mdoc.data.device.IssuerSignedCbor.Static.cborDecode(Int8Array.from(buffer))
    this.issuerSignedJson = this.issuerSignedCbor.toJson()
  }

  public get docType() {
    const type = this.issuerSignedJson.MSO?.docType
    if (!type) {
      throw new CredoError('Missing required doctype in MDOC.')
    }
    return type
  }

  public get namespaces(): MdocNamespaces {
    const mdocNamespaces = this.issuerSignedCbor.toJsonDTO().nameSpaces
    if (!mdocNamespaces) throw new MdocError(`Failed to retrieve namespaces from the mdoc 'IssuerSigned' structure.`)

    const namespaces: MdocNamespaces = {}
    const namespaceEntries: [string, Record<string, IssuerSignedItemJson>][] = Object.entries(mdocNamespaces)

    for (const [namespace, claims] of namespaceEntries) {
      const claimEntries = Object.entries(claims)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const claimRecord = Object.fromEntries(claimEntries.map(([_, val]) => [val.key, val.value.value as unknown]))
      namespaces[namespace] = claimRecord
    }
    return namespaces
  }

  public get jwaSignatureAlgorithm() {
    const alg = this.issuerSignedJson.issuerAuth.protectedHeader.alg
    if (!alg) {
      throw new MdocError(`Missing Signature Algorithm in Mdoc.`)
    }

    const jwaAlgorithm = com.sphereon.crypto.SignatureAlgorithmMapping.Static.toJose(alg).value as JwaSignatureAlgorithm

    if (!Object.values(JwaSignatureAlgorithm).includes(jwaAlgorithm)) {
      throw new MdocError(`Invalid Signature Algorithm on MDoc Document. Alg '${alg}'`)
    }

    return jwaAlgorithm
  }

  public static fromIssuerSignedHex(hexEncodedMdoc: string) {
    return new Mdoc(TypedArrayEncoder.fromHex(hexEncodedMdoc))
  }

  public static fromIssuerSignedBase64(issuerSignedBase64: string) {
    return new Mdoc(TypedArrayEncoder.fromBase64(issuerSignedBase64))
  }

  public get issuerSignedHex() {
    return TypedArrayEncoder.toHex(Buffer.from(this.issuerSignedCbor.toCbor().cborEncode()))
  }

  public get issuerSignedBase64UrlEncoded() {
    return TypedArrayEncoder.toBase64URL(Buffer.from(this.issuerSignedCbor.toCbor().cborEncode()))
  }

  public async verifyCredential(agentContext: AgentContext, options?: { trustedCertificates?: [string, ...string[]] }) {
    const { trustedCertificates } = options ?? {}

    const cryptoServiceJS = com.sphereon.crypto.CryptoServiceJS

    if (agentContext.contextCorrelationId !== 'default') {
      // TODO: This way of of registering and working with the x509/cose services is subject to race-conditions
      // TODO: This is a known issue and beeing worked on by sphereon
      throw new MdocError('Multitenancy is currently not supported for Mdoc.')
    }

    cryptoServiceJS.X509.register(new MdocX509CallbackService(agentContext, trustedCertificates))
    cryptoServiceJS.COSE.register(new MdocCoseCallbackService(agentContext))

    const certificateChain = this.issuerSignedCbor.issuerAuth.toJson().unprotectedHeader?.x5chain
    if (!certificateChain) {
      return {
        isValid: false,
        error: `The issuer signed structure is missing the 'x5chain' property in the unprotected header.`,
      }
    }

    // TODO: CHECK why this is required
    const _leafCertificate = TypedArrayEncoder.toBase64(TypedArrayEncoder.fromBase64(certificateChain[0]))
    const leafCertificate = X509Service.getLeafCertificate(agentContext, { certificateChain: [_leafCertificate] })

    const verificationResult = await com.sphereon.mdoc.ValidationsJS.fromIssuerAuthAsync(
      this.issuerSignedCbor.issuerAuth,
      // This key is used later on in the cose verification callback for signature verification
      { opts: kotlin.collections.KtMap.fromJsMap(new Map([['publicKey', leafCertificate.publicKey]])) },
      trustedCertificates
    )

    if (verificationResult.error) {
      return {
        isValid: false,
        error: verificationResult.verifications.join(' '),
      }
    }

    return { isValid: true }
  }
}

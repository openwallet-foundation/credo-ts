import type { AgentContext } from '../../agent'
import type {
  DifPresentationExchangeDefinitionV2,
  DifPresentationExchangeSubmission,
} from '../dif-presentation-exchange'
import type { Descriptor } from '@sphereon/pex-models'

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

export type MdocNamespaceData = Record<string, unknown>
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
  private getMdocPresentationDefinition = (presentationDefinition: DifPresentationExchangeDefinitionV2) => {
    const oid4vp = com.sphereon.mdoc.oid4vp
    const mdocInputDescriptors: com.sphereon.mdoc.oid4vp.IOid4VPInputDescriptor[] = []

    for (const inputDescriptor of presentationDefinition.input_descriptors) {
      if (!inputDescriptor.constraints.fields) continue

      const fields = inputDescriptor.constraints.fields?.map((field) => {
        return oid4vp.Oid4VPConstraintField.Static.fromDTO({
          path: field.path,
          // @ts-expect-error type not correct
          intent_to_retain: field.intent_to_retain,
        })
      })

      const constraints = oid4vp.Oid4VPConstraints.Static.fromDTO({
        fields,
        // @ts-expect-error type not correct
        limit_disclosure: oid4vp.Oid4VPLimitDisclosure.REQUIRED,
      })

      const mdocInputDescriptor = oid4vp.Oid4VPInputDescriptor.Static.fromDTO({
        id: inputDescriptor.id,
        constraints,
        format: {
          msoMdoc: {
            alg: [], // TODO
          },
        },
      })

      mdocInputDescriptors.push(mdocInputDescriptor)
    }

    return oid4vp.Oid4VPPresentationDefinition.Static.fromDTO({
      id: presentationDefinition.id,
      // @ts-expect-error type not correct
      input_descriptors: mdocInputDescriptors,
    })
  }

  private mdocSubmissionToSubmission = (
    descriptorMapEntry: com.sphereon.mdoc.oid4vp.Oid4VPPresentationSubmission['descriptorMap'][number]
  ): Descriptor => {
    return {
      id: descriptorMapEntry.id,
      format: descriptorMapEntry.format.value,
      path: descriptorMapEntry.path,
    }
  }

  public async limitDisclosure(presentationDefinition: DifPresentationExchangeDefinitionV2) {
    const mdocPresentationDefinition = this.getMdocPresentationDefinition(presentationDefinition)

    const mdoc = this.issuerSignedCbor.toDocument()
    const limited = mdoc.limitDisclosures(mdocPresentationDefinition.toDocRequest())

    return Mdoc.fromIssuerSignedBase64(TypedArrayEncoder.toBase64(Buffer.from(limited.cborEncode())))
  }

  // todo:
  public async createPresentation(presentationDefinition: DifPresentationExchangeDefinitionV2) {
    const mdocPresentationDefinition = this.getMdocPresentationDefinition(presentationDefinition)

    const Oid4VPPresentationSubmission = com.sphereon.mdoc.oid4vp.Oid4VPPresentationSubmission
    const mdocSubmission = Oid4VPPresentationSubmission.Static.fromPresentationDefinition(
      mdocPresentationDefinition,
      'mdoc-presentation-submission'
    )

    const submission: DifPresentationExchangeSubmission = {
      id: mdocSubmission.id,
      definition_id: mdocSubmission.definitionId,
      // @ts-expect-error type not correct
      descriptor_map: mdocSubmission.descriptor_map.map(this.mdocSubmissionToSubmission),
    }

    const limitedDisclosedMdoc = await this.limitDisclosure(presentationDefinition)
    const limitedDocumentCbor = limitedDisclosedMdoc.issuerSignedCbor.toDocument()

    const deviceResponse = new com.sphereon.mdoc.data.device.DeviceResponseCbor(
      new com.sphereon.cbor.CborString(limitedDisclosedMdoc.docType),
      [limitedDocumentCbor],
      null,
      undefined
    )

    const deviceSigned = TypedArrayEncoder.toBase64(Uint8Array.from(deviceResponse.cborEncode()))
    const deviceSignedBase64Url = JSON.stringify({ nonce: 'nonce', deviceSigned })

    return { submission, deviceSignedBase64Url }
  }

  // TODO:
  public static async verifyDeviceSigned(deviceSigned: string) {
    // Just check if the device response can be parsed for now
    com.sphereon.mdoc.data.device.DeviceResponseCbor.Static.cborDecode(
      Int8Array.from(TypedArrayEncoder.fromBase64(deviceSigned))
    )

    return true
  }

  public static async getDisclosedClaims(deviceSigned: string) {
    // Just check if the device response can be parsed for now
    const deviceResponseCbor = com.sphereon.mdoc.data.device.DeviceResponseCbor.Static.cborDecode(
      Int8Array.from(TypedArrayEncoder.fromBase64(deviceSigned))
    )

    if (!deviceResponseCbor.documents || deviceResponseCbor.documents.length === 0) {
      throw new CredoError('Device response does not contain any documents.')
    }

    return Mdoc.fromIssuerSignedBase64(
      TypedArrayEncoder.toBase64(Uint8Array.from(deviceResponseCbor.documents[0].issuerSigned.cborEncode()))
    ).namespaces
  }
}

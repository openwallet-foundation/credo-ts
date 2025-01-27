import type {
  MdocDeviceResponseOpenId4VpOptions,
  MdocDeviceResponseOptions,
  MdocDeviceResponseVerifyOptions,
} from './MdocOptions'
import type { AgentContext } from '../../agent'
import type { DifPresentationExchangeDefinition } from '../dif-presentation-exchange'
import type { PresentationDefinition } from '@animo-id/mdoc'
import type { InputDescriptorV2 } from '@sphereon/pex-models'

import {
  limitDisclosureToInputDescriptor as mdocLimitDisclosureToInputDescriptor,
  COSEKey,
  DeviceResponse,
  MDoc,
  parseIssuerSigned,
  Verifier,
  MDocStatus,
  cborEncode,
  parseDeviceResponse,
  DeviceRequest,
} from '@animo-id/mdoc'

import { CredoError } from '../../error'
import { uuid } from '../../utils/uuid'
import { X509Certificate } from '../x509/X509Certificate'
import { X509ModuleConfig } from '../x509/X509ModuleConfig'

import { TypedArrayEncoder } from './../../utils'
import { Mdoc } from './Mdoc'
import { getMdocContext } from './MdocContext'
import { MdocError } from './MdocError'

export class MdocDeviceResponse {
  private constructor(public base64Url: string, public documents: Mdoc[]) {}

  public static fromBase64Url(base64Url: string) {
    const parsed = parseDeviceResponse(TypedArrayEncoder.fromBase64(base64Url))
    if (parsed.status !== MDocStatus.OK) {
      throw new MdocError(`Parsing Mdoc Device Response failed.`)
    }

    const documents = parsed.documents.map((doc) => {
      const prepared = doc.prepare()
      const docType = prepared.get('docType') as string
      const issuerSigned = cborEncode(prepared.get('issuerSigned'))
      const deviceSigned = cborEncode(prepared.get('deviceSigned'))

      return Mdoc.fromDeviceSignedDocument(
        TypedArrayEncoder.toBase64URL(issuerSigned),
        TypedArrayEncoder.toBase64URL(deviceSigned),
        docType
      )
    })
    documents[0].deviceSignedNamespaces

    return new MdocDeviceResponse(base64Url, documents)
  }

  private static assertMdocInputDescriptor(inputDescriptor: InputDescriptorV2) {
    if (!inputDescriptor.format || !inputDescriptor.format.mso_mdoc) {
      throw new MdocError(`Input descriptor must contain 'mso_mdoc' format property`)
    }

    if (!inputDescriptor.format.mso_mdoc.alg) {
      throw new MdocError(`Input descriptor mso_mdoc must contain 'alg' property`)
    }

    if (!inputDescriptor.constraints?.limit_disclosure || inputDescriptor.constraints.limit_disclosure !== 'required') {
      throw new MdocError(
        `Input descriptor must contain 'limit_disclosure' constraints property which is set to required`
      )
    }

    if (!inputDescriptor.constraints?.fields?.every((field) => field.intent_to_retain !== undefined)) {
      throw new MdocError(`Input descriptor must contain 'intent_to_retain' constraints property`)
    }

    return {
      ...inputDescriptor,
      format: {
        mso_mdoc: inputDescriptor.format.mso_mdoc,
      },
      constraints: {
        ...inputDescriptor.constraints,
        limit_disclosure: 'required',
        fields: (inputDescriptor.constraints.fields ?? []).map((field) => {
          return {
            ...field,
            intent_to_retain: field.intent_to_retain ?? false,
          }
        }),
      },
    } satisfies PresentationDefinition['input_descriptors'][number]
  }

  public static partitionPresentationDefinition = (pd: DifPresentationExchangeDefinition) => {
    const nonMdocPresentationDefinition: DifPresentationExchangeDefinition = {
      ...pd,
      input_descriptors: pd.input_descriptors.filter(
        (id) => !Object.keys((id as InputDescriptorV2).format ?? {}).includes('mso_mdoc')
      ),
    } as DifPresentationExchangeDefinition

    const mdocPresentationDefinition = {
      ...pd,
      format: { mso_mdoc: pd.format?.mso_mdoc },
      input_descriptors: (pd.input_descriptors as InputDescriptorV2[])
        .filter((id) => Object.keys(id.format ?? {}).includes('mso_mdoc'))
        .map(this.assertMdocInputDescriptor),
    }

    return { mdocPresentationDefinition, nonMdocPresentationDefinition }
  }

  private static createPresentationSubmission(input: {
    id: string
    presentationDefinition: {
      id: string
      input_descriptors: ReturnType<typeof MdocDeviceResponse.assertMdocInputDescriptor>[]
    }
  }) {
    const { id, presentationDefinition } = input
    if (presentationDefinition.input_descriptors.length !== 1) {
      throw new MdocError('Currently Mdoc Presentation Submissions can only be created for a sigle input descriptor')
    }
    return {
      id,
      definition_id: presentationDefinition.id,
      descriptor_map: [
        {
          id: presentationDefinition.input_descriptors[0].id,
          format: 'mso_mdoc',
          path: '$',
        },
      ],
    }
  }

  public static limitDisclosureToInputDescriptor(options: { inputDescriptor: InputDescriptorV2; mdoc: Mdoc }) {
    const { mdoc } = options

    const inputDescriptor = this.assertMdocInputDescriptor(options.inputDescriptor)
    const _mdoc = parseIssuerSigned(TypedArrayEncoder.fromBase64(mdoc.base64Url), mdoc.docType)

    const disclosure = mdocLimitDisclosureToInputDescriptor(_mdoc, inputDescriptor)
    const disclosedPayloadAsRecord = Object.fromEntries(
      Array.from(disclosure.entries()).map(([namespace, issuerSignedItem]) => {
        return [
          namespace,
          Object.fromEntries(issuerSignedItem.map((item) => [item.elementIdentifier, item.elementValue])),
        ]
      })
    )

    return disclosedPayloadAsRecord
  }

  public static async createOpenId4VpDeviceResponse(
    agentContext: AgentContext,
    options: MdocDeviceResponseOpenId4VpOptions
  ) {
    const { sessionTranscriptOptions } = options
    const presentationDefinition = this.partitionPresentationDefinition(
      options.presentationDefinition
    ).mdocPresentationDefinition

    const issuerSignedDocuments = options.mdocs.map((mdoc) =>
      parseIssuerSigned(TypedArrayEncoder.fromBase64(mdoc.base64Url), mdoc.docType)
    )
    const docTypes = issuerSignedDocuments.map((i) => i.docType)

    const combinedDeviceResponseMdoc = new MDoc()

    for (const issuerSignedDocument of issuerSignedDocuments) {
      const deviceKey = issuerSignedDocument.issuerSigned.issuerAuth.decodedPayload.deviceKeyInfo?.deviceKey
      if (!deviceKey) throw new CredoError(`Device key is missing in mdoc with doctype ${issuerSignedDocument.docType}`)

      const publicDeviceJwk = COSEKey.import(deviceKey).toJWK()

      // We do PEX filtering on a different layer, so we only include the needed input descriptor here
      const presentationDefinitionForDocument = {
        ...presentationDefinition,
        input_descriptors: presentationDefinition.input_descriptors.filter(
          (inputDescriptor) => inputDescriptor.id === issuerSignedDocument.docType
        ),
      }

      const deviceResponseBuilder = DeviceResponse.from(new MDoc([issuerSignedDocument]))
        .usingPresentationDefinition(presentationDefinitionForDocument)
        .usingSessionTranscriptForOID4VP(sessionTranscriptOptions)
        .authenticateWithSignature(publicDeviceJwk, 'ES256')

      for (const [nameSpace, nameSpaceValue] of Object.entries(options.deviceNameSpaces ?? {})) {
        deviceResponseBuilder.addDeviceNameSpace(nameSpace, nameSpaceValue)
      }

      const deviceResponseMdoc = await deviceResponseBuilder.sign(getMdocContext(agentContext))
      combinedDeviceResponseMdoc.addDocument(deviceResponseMdoc.documents[0])
    }

    return {
      deviceResponseBase64Url: TypedArrayEncoder.toBase64URL(combinedDeviceResponseMdoc.encode()),
      presentationSubmission: MdocDeviceResponse.createPresentationSubmission({
        id: 'MdocPresentationSubmission ' + uuid(),
        presentationDefinition: {
          ...presentationDefinition,
          input_descriptors: presentationDefinition.input_descriptors.filter((i) => docTypes.includes(i.id)),
        },
      }),
    }
  }

  public static async createDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseOptions) {
    const issuerSignedDocuments = options.mdocs.map((mdoc) =>
      parseIssuerSigned(TypedArrayEncoder.fromBase64(mdoc.base64Url), mdoc.docType)
    )

    const combinedDeviceResponseMdoc = new MDoc()

    for (const issuerSignedDocument of issuerSignedDocuments) {
      const deviceKey = issuerSignedDocument.issuerSigned.issuerAuth.decodedPayload.deviceKeyInfo?.deviceKey
      if (!deviceKey) throw new CredoError(`Device key is missing in mdoc with doctype ${issuerSignedDocument.docType}`)

      const publicDeviceJwk = COSEKey.import(deviceKey).toJWK()
      const deviceRequestForDocument = new DeviceRequest(
        options.deviceRequest.version,
        options.deviceRequest.docRequests.filter(
          (request) => request.itemsRequest.data.docType === issuerSignedDocument.docType
        )
      )

      const deviceResponseBuilder = DeviceResponse.from(new MDoc([issuerSignedDocument]))
        .usingSessionTranscriptBytes(options.sessionTranscriptBytes)
        .usingDeviceRequest(deviceRequestForDocument)
        .authenticateWithSignature(publicDeviceJwk, 'ES256')

      for (const [nameSpace, nameSpaceValue] of Object.entries(options.deviceNameSpaces ?? {})) {
        deviceResponseBuilder.addDeviceNameSpace(nameSpace, nameSpaceValue)
      }

      const deviceResponseMdoc = await deviceResponseBuilder.sign(getMdocContext(agentContext))
      combinedDeviceResponseMdoc.addDocument(deviceResponseMdoc.documents[0])
    }

    return {
      deviceResponseBase64Url: TypedArrayEncoder.toBase64URL(combinedDeviceResponseMdoc.encode()),
    }
  }

  public async verify(agentContext: AgentContext, options: Omit<MdocDeviceResponseVerifyOptions, 'deviceResponse'>) {
    const verifier = new Verifier()
    const mdocContext = getMdocContext(agentContext)
    const x509Config = agentContext.dependencyManager.resolve(X509ModuleConfig)

    // TODO: no way to currently have a per document x509 certificates in a presentation
    // but this also the case for other formats
    // FIXME: we can't pass multiple certificate chains. We should just verify each document separately
    let trustedCertificates = options.trustedCertificates
    if (!trustedCertificates) {
      trustedCertificates = (
        await Promise.all(
          this.documents.map((mdoc) => {
            const certificateChain = mdoc.issuerSignedCertificateChain.map((cert) =>
              X509Certificate.fromRawCertificate(cert)
            )
            return (
              x509Config.getTrustedCertificatesForVerification?.(agentContext, {
                certificateChain,
                verification: {
                  type: 'credential',
                  credential: mdoc,
                },
              }) ?? x509Config.trustedCertificates
            )
          })
        )
      )
        .filter((c): c is string[] => c !== undefined)
        .flatMap((c) => c)
    }

    if (!trustedCertificates) {
      throw new MdocError('No trusted certificates found. Cannot verify mdoc.')
    }

    const result = await verifier.verifyDeviceResponse(
      {
        encodedDeviceResponse: TypedArrayEncoder.fromBase64(this.base64Url),
        //ephemeralReaderKey: options.verifierKey ? getJwkFromKey(options.verifierKey).toJson() : undefined,
        encodedSessionTranscript: DeviceResponse.calculateSessionTranscriptForOID4VP(options.sessionTranscriptOptions),
        trustedCertificates: trustedCertificates.map(
          (cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate
        ),
        now: options.now,
      },
      mdocContext
    )

    if (result.documentErrors.length > 1) {
      throw new MdocError('Device response verification failed.')
    }

    if (result.status !== MDocStatus.OK) {
      throw new MdocError('Device response verification failed. An unknown error occurred.')
    }

    return this.documents
  }
}

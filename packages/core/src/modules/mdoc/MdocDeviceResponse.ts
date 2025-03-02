import type { PresentationDefinition } from '@animo-id/mdoc'
import type { InputDescriptorV2 } from '@sphereon/pex-models'
import type { AgentContext } from '../../agent'
import type { Jwk } from '../../crypto'
import type { DifPresentationExchangeDefinition } from '../dif-presentation-exchange'
import type {
  MdocDeviceResponseOpenId4VpOptions,
  MdocDeviceResponseOptions,
  MdocDeviceResponseVerifyOptions,
} from './MdocOptions'

import {
  DeviceRequest,
  DeviceResponse,
  DeviceSignedDocument,
  MDoc,
  MDocStatus,
  Verifier,
  cborEncode,
  limitDisclosureToInputDescriptor as mdocLimitDisclosureToInputDescriptor,
  defaultCallback as onCheck,
  parseDeviceResponse,
  parseIssuerSigned,
} from '@animo-id/mdoc'
import { uuid } from '../../utils/uuid'

import { TypedArrayEncoder } from './../../utils'
import { Mdoc } from './Mdoc'
import { getMdocContext } from './MdocContext'
import { MdocError } from './MdocError'
import { isMdocSupportedSignatureAlgorithm, mdocSupporteSignatureAlgorithms } from './mdocSupportedAlgs'

export class MdocDeviceResponse {
  private constructor(
    public base64Url: string,
    public documents: Mdoc[]
  ) {}

  public static fromBase64Url(base64Url: string) {
    const parsed = parseDeviceResponse(TypedArrayEncoder.fromBase64(base64Url))
    if (parsed.status !== MDocStatus.OK) {
      throw new MdocError('Parsing Mdoc Device Response failed.')
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

  public static limitDisclosureToInputDescriptor(options: {
    inputDescriptor: InputDescriptorV2
    mdoc: Mdoc
  }) {
    const { mdoc } = options

    const inputDescriptor = MdocDeviceResponse.assertMdocInputDescriptor(options.inputDescriptor)
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
    const presentationDefinition = MdocDeviceResponse.partitionPresentationDefinition(
      options.presentationDefinition
    ).mdocPresentationDefinition

    const docTypes = options.mdocs.map((i) => i.docType)

    const combinedDeviceResponseMdoc = new MDoc()

    for (const document of options.mdocs) {
      const deviceKeyJwk = document.deviceKeyJwk
      if (!deviceKeyJwk) throw new MdocError(`Device key is missing in mdoc with doctype ${document.docType}`)
      const alg = MdocDeviceResponse.getAlgForDeviceKeyJwk(deviceKeyJwk)

      // We do PEX filtering on a different layer, so we only include the needed input descriptor here
      const presentationDefinitionForDocument = {
        ...presentationDefinition,
        input_descriptors: presentationDefinition.input_descriptors.filter(
          (inputDescriptor) => inputDescriptor.id === document.docType
        ),
      }

      const issuerSignedDocument = parseIssuerSigned(TypedArrayEncoder.fromBase64(document.base64Url), document.docType)
      const deviceResponseBuilder = DeviceResponse.from(new MDoc([issuerSignedDocument]))
        .usingPresentationDefinition(presentationDefinitionForDocument)
        .usingSessionTranscriptForOID4VP(sessionTranscriptOptions)
        .authenticateWithSignature(deviceKeyJwk.toJson(), alg)

      for (const [nameSpace, nameSpaceValue] of Object.entries(options.deviceNameSpaces ?? {})) {
        deviceResponseBuilder.addDeviceNameSpace(nameSpace, nameSpaceValue)
      }

      const deviceResponseMdoc = await deviceResponseBuilder.sign(getMdocContext(agentContext))
      combinedDeviceResponseMdoc.addDocument(deviceResponseMdoc.documents[0])
    }

    return {
      deviceResponseBase64Url: TypedArrayEncoder.toBase64URL(combinedDeviceResponseMdoc.encode()),
      presentationSubmission: MdocDeviceResponse.createPresentationSubmission({
        id: `MdocPresentationSubmission ${uuid()}`,
        presentationDefinition: {
          ...presentationDefinition,
          input_descriptors: presentationDefinition.input_descriptors.filter((i) => docTypes.includes(i.id)),
        },
      }),
    }
  }

  public static async createDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseOptions) {
    const combinedDeviceResponseMdoc = new MDoc()

    for (const document of options.mdocs) {
      const deviceKeyJwk = document.deviceKeyJwk
      if (!deviceKeyJwk) throw new MdocError(`Device key is missing in mdoc with doctype ${document.docType}`)
      const alg = MdocDeviceResponse.getAlgForDeviceKeyJwk(deviceKeyJwk)

      const issuerSignedDocument = parseIssuerSigned(TypedArrayEncoder.fromBase64(document.base64Url), document.docType)

      const deviceRequestForDocument = new DeviceRequest(
        options.deviceRequest.version,
        options.deviceRequest.docRequests.filter(
          (request) => request.itemsRequest.data.docType === issuerSignedDocument.docType
        )
      )

      const deviceResponseBuilder = DeviceResponse.from(new MDoc([issuerSignedDocument]))
        .usingSessionTranscriptBytes(options.sessionTranscriptBytes)
        .usingDeviceRequest(deviceRequestForDocument)
        .authenticateWithSignature(deviceKeyJwk.toJson(), alg)

      for (const [nameSpace, nameSpaceValue] of Object.entries(options.deviceNameSpaces ?? {})) {
        deviceResponseBuilder.addDeviceNameSpace(nameSpace, nameSpaceValue)
      }

      const deviceResponseMdoc = await deviceResponseBuilder.sign(getMdocContext(agentContext))
      combinedDeviceResponseMdoc.addDocument(deviceResponseMdoc.documents[0])
    }

    return combinedDeviceResponseMdoc.encode()
  }

  public async verify(agentContext: AgentContext, options: Omit<MdocDeviceResponseVerifyOptions, 'deviceResponse'>) {
    const verifier = new Verifier()
    const mdocContext = getMdocContext(agentContext)

    onCheck({
      status: this.documents.length > 0 ? 'PASSED' : 'FAILED',
      check: 'Device Response must include at least one document.',
      category: 'DOCUMENT_FORMAT',
    })

    const deviceResponse = parseDeviceResponse(TypedArrayEncoder.fromBase64(this.base64Url))

    // NOTE: we do not use the verification from mdoc library, as it checks all documents
    // based on the same trusted certificates. Rather, we want to
    for (const documentIndex in this.documents) {
      const rawDocument = deviceResponse.documents[documentIndex]
      const document = this.documents[documentIndex]

      await document.verify(agentContext, {
        now: options.now,
        trustedCertificates: options.trustedCertificates,
      })

      if (!(rawDocument instanceof DeviceSignedDocument)) {
        onCheck({
          status: 'FAILED',
          category: 'DEVICE_AUTH',
          check: `The document is not signed by the device. ${document.docType}`,
        })
        continue
      }

      await verifier.verifyDeviceSignature(
        {
          sessionTranscriptBytes: await DeviceResponse.calculateSessionTranscriptForOID4VP({
            ...options.sessionTranscriptOptions,
            context: mdocContext,
          }),
          deviceSigned: rawDocument,
        },
        mdocContext
      )
    }

    if (deviceResponse.documentErrors.length > 1) {
      throw new MdocError('Device response verification failed.')
    }

    if (deviceResponse.status !== MDocStatus.OK) {
      throw new MdocError('Device response verification failed. An unknown error occurred.')
    }

    return this.documents
  }

  private static getAlgForDeviceKeyJwk(jwk: Jwk) {
    const signatureAlgorithm = jwk.supportedSignatureAlgorithms.find(isMdocSupportedSignatureAlgorithm)
    if (!signatureAlgorithm) {
      throw new MdocError(
        `Unable to create mdoc device response. No supported signature algorithm found to sign device response for jwk with key type ${
          jwk.keyType
        }. Key supports algs ${jwk.supportedSignatureAlgorithms.join(
          ', '
        )}. mdoc supports algs ${mdocSupporteSignatureAlgorithms.join(', ')}`
      )
    }

    return signatureAlgorithm
  }
}

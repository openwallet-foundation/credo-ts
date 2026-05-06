import {
  CoseKey,
  DeviceNamespaces,
  DeviceRequest,
  DeviceResponse,
  DeviceSignedItems,
  DocRequest,
  Document,
  defaultVerificationCallback,
  IssuerNamespaces,
  ItemsRequest,
  limitDisclosureToDeviceRequestNameSpaces,
  type MdocContext,
  SessionTranscript,
} from '@owf/mdoc'
import type { InputDescriptorV2 } from '@sphereon/pex-models'
import {
  convertDcqlQueryToDeviceRequest,
  convertPresentationDefinitionToDeviceRequest,
  type Field,
  type PresentationDefinition,
} from '@verifiables/request-converter'
import { AgentContext } from '../../agent'
import { TypedArrayEncoder } from './../../utils'
import { PublicJwk } from '../kms'
import { ClaimFormat } from '../vc'
import { X509Certificate } from '../x509'
import type { Mdoc } from './Mdoc'
import { getMdocContext } from './MdocContext'
import { MdocError } from './MdocError'
import type {
  MdocDeviceResponseDcqlQueryOptions,
  MdocDeviceResponseOptions,
  MdocDeviceResponsePresentationDefinitionOptions,
  MdocDeviceResponseVerifyOptions,
  MdocSessionTranscriptOptions,
} from './MdocOptions'
import { isMdocSupportedSignatureAlgorithm, mdocSupportedSignatureAlgorithms } from './mdocSupportedAlgs'
import { nameSpacesRecordToMap } from './mdocUtil'
import { convertDocumentRequest } from './utils/convertDocumentRequest'

export type DeviceAndIssuerClaims = {
  [docType: string]: {
    [namespace: string]: {
      [claimIdentifier: string]: unknown
    }
  }
}

export class MdocDeviceResponse {
  private constructor(public readonly deviceResponse: DeviceResponse) {}

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
    return TypedArrayEncoder.toBase64Url(this.deviceResponse.encode())
  }

  /**
   * To support a single DeviceResponse with multiple documents in OpenID4VP
   */
  public splitIntoSingleDocumentResponses(): MdocDeviceResponse[] {
    const deviceResponses: MdocDeviceResponse[] = []

    if (!this.deviceResponse.documents || this.deviceResponse.documents.length === 0) {
      throw new MdocError('mdoc device response does not contain any mdocs')
    }

    for (const document of this.deviceResponse.documents) {
      deviceResponses.push(
        new MdocDeviceResponse(
          DeviceResponse.createSimple({
            version: this.deviceResponse.version,
            status: this.deviceResponse.status,
            documentErrors: this.deviceResponse.documentErrors,
            documents: [document],
          })
        )
      )
    }

    return deviceResponses
  }

  public static fromBase64Url(base64Url: string) {
    const parsed = DeviceResponse.decode(TypedArrayEncoder.fromBase64Url(base64Url))

    return new MdocDeviceResponse(parsed)
  }

  public static async createDeviceResponseWithPresentationDefinition(
    agentContext: AgentContext,
    options: MdocDeviceResponsePresentationDefinitionOptions
  ) {
    // @ts-expect-error: we need to match the types credo uses and the converter expects
    const { deviceRequest } = convertPresentationDefinitionToDeviceRequest(options.presentationDefinition)
    const documentRequests = convertDocumentRequest(deviceRequest.docRequests)

    return MdocDeviceResponse.createDeviceResponse(agentContext, { ...options, documentRequests })
  }

  public static async createDeviceResponseWithDcqlQuery(
    agentContext: AgentContext,
    options: MdocDeviceResponseDcqlQueryOptions
  ) {
    // @ts-expect-error: we need to match the types credo uses and the converter expects
    const { deviceRequest } = convertDcqlQueryToDeviceRequest(options.dcqlQuery)
    const documentRequests = convertDocumentRequest(deviceRequest.docRequests)

    return MdocDeviceResponse.createDeviceResponse(agentContext, { ...options, documentRequests })
  }

  public static async limitDisclosureToInputDescriptor(
    _agentContext: AgentContext,
    { mdoc, ...options }: { inputDescriptor: InputDescriptorV2; mdoc: Mdoc }
  ) {
    const inputDescriptor = MdocDeviceResponse.assertMdocInputDescriptor(options.inputDescriptor)

    let issuerNamespaces: IssuerNamespaces | undefined

    // First we try with all optional fields enabled, if that results in an error during the `limitDisclosureToDeviceRequestNameSpaces` call, we try again, skipping all optional fields
    try {
      // We take the first document request as we also only input a single input descriptor
      const {
        deviceRequest: {
          docRequests: [convertedDocumentRequest],
        },
      } = convertPresentationDefinitionToDeviceRequest({
        id: '<UNUSED_CREDO_ID>',
        input_descriptors: [inputDescriptor],
      })

      const documentRequest = DocRequest.create({
        itemsRequest: ItemsRequest.create({
          docType: convertedDocumentRequest.itemsRequest.docType,
          namespaces: convertedDocumentRequest.itemsRequest.nameSpaces,
        }),
      })

      issuerNamespaces = limitDisclosureToDeviceRequestNameSpaces(mdoc.issuerSigned, documentRequest)
    } catch (_error) {
      // We take the first document request as we also only input a single input descriptor
      const {
        deviceRequest: {
          docRequests: [convertedDocumentRequest],
        },
      } = convertPresentationDefinitionToDeviceRequest(
        {
          id: '<UNUSED_CREDO_ID>',
          input_descriptors: [inputDescriptor],
        },
        { skipOptionalFields: true }
      )

      const documentRequest = DocRequest.create({
        itemsRequest: ItemsRequest.create({
          docType: convertedDocumentRequest.itemsRequest.docType,
          namespaces: convertedDocumentRequest.itemsRequest.nameSpaces,
        }),
      })

      issuerNamespaces = limitDisclosureToDeviceRequestNameSpaces(mdoc.issuerSigned, documentRequest)
    }

    const disclosedPayloadAsRecord = Object.fromEntries(
      Array.from(issuerNamespaces.issuerNamespaces.entries()).map(([namespace, issuerSignedItem]) => [
        namespace,
        Object.fromEntries(issuerSignedItem.map((isi) => [isi.elementIdentifier, isi.elementValue])),
      ])
    )

    return disclosedPayloadAsRecord
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
        }) as Field[],
      },
    } satisfies PresentationDefinition['input_descriptors'][number]
  }

  public static async createDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseOptions) {
    const documents: Document[] = []

    for (const document of options.mdocs) {
      const deviceKeyJwk = document.deviceKey
      const deviceKeyJwkJson = deviceKeyJwk.toJson()

      if (!deviceKeyJwkJson.alg) {
        // FIXME: we cannot provide alg anymore?
        deviceKeyJwkJson.alg = MdocDeviceResponse.getAlgForDeviceKeyJwk(deviceKeyJwk)
      }

      // Set keyId to legacy key id if it doesn't have a key id set
      if (!deviceKeyJwk.hasKeyId) {
        deviceKeyJwk.keyId = deviceKeyJwk.legacyKeyId
      }

      const deviceRequestForDocument = DeviceRequest.create({
        version: '1.0',
        docRequests: options.documentRequests
          .filter((request) => request.docType === document.docType)
          .map((request) =>
            DocRequest.create({
              itemsRequest: ItemsRequest.create({
                docType: request.docType,
                namespaces: nameSpacesRecordToMap(request.nameSpaces),
              }),
            })
          ),
      })

      const mdocContext = getMdocContext(agentContext)
      const deviceResponse = await DeviceResponse.createWithDeviceRequest(
        {
          deviceRequest: deviceRequestForDocument,
          issuerSigned: [document.issuerSigned],
          sessionTranscript: await MdocDeviceResponse.calculateSessionTranscriptBytes(
            mdocContext,
            options.sessionTranscriptOptions
          ),
          deviceNamespaces: options.deviceNameSpaces
            ? DeviceNamespaces.create({
                deviceNamespaces: new Map(
                  Object.entries(options.deviceNameSpaces).map(([namespace, namespaceValue]) => [
                    namespace,
                    DeviceSignedItems.create({
                      deviceSignedItems: new Map(Object.entries(namespaceValue)),
                    }),
                  ])
                ),
              })
            : undefined,
          signature: {
            signingKey: CoseKey.fromJwk(deviceKeyJwk.toJson()),
          },
        },
        mdocContext
      )

      if (!deviceResponse.documents) {
        throw new MdocError('Device response does not contain any documents')
      }
      documents.push(deviceResponse.documents[0])
    }

    return new MdocDeviceResponse(
      DeviceResponse.createSimple({
        version: '1.0',
        documents,
      })
    )
  }

  public async verify(agentContext: AgentContext, options: Omit<MdocDeviceResponseVerifyOptions, 'deviceResponse'>) {
    const mdocContext = getMdocContext(agentContext)

    defaultVerificationCallback({
      status: this.deviceResponse.documents?.length ? 'PASSED' : 'FAILED',
      check: 'Device Response must include at least one document.',
      category: 'DOCUMENT_FORMAT',
    })

    await this.deviceResponse
      .verify(
        {
          trustedCertificates:
            options.trustedCertificates?.map(
              (certificate) => X509Certificate.fromEncodedCertificate(certificate).rawCertificate
            ) ?? [],
          disableCertificateChainValidation: false,
          now: options.now,
          skewSeconds: agentContext.config.validitySkewSeconds,
          sessionTranscript: await MdocDeviceResponse.calculateSessionTranscriptBytes(
            mdocContext,
            options.sessionTranscriptOptions
          ),
        },
        mdocContext
      )
      .catch((error) => {
        throw new MdocError(`Mdoc with doctype ${this.deviceResponse.documents?.[0].docType} is not valid`, {
          cause: error,
        })
      })
  }

  private static async calculateSessionTranscriptBytes(
    mdocContext: MdocContext,
    options: MdocSessionTranscriptOptions
  ) {
    if (options.type === 'sesionTranscriptBytes') {
      return options.sessionTranscriptBytes
    }

    if (options.type === 'openId4VpDraft18') {
      return SessionTranscript.forOid4VpDraft18(options, mdocContext)
    }

    if (options.type === 'openId4Vp') {
      const { encryptionJwk, verifierGeneratedNonce, ...rest } = options
      return SessionTranscript.forOid4Vp(
        {
          ...rest,
          jwkThumbprint: encryptionJwk ? encryptionJwk.getJwkThumbprint() : undefined,
          nonce: verifierGeneratedNonce,
        },
        mdocContext
      )
    }

    if (options.type === 'openId4VpDcApi') {
      const { encryptionJwk, verifierGeneratedNonce, ...rest } = options
      return SessionTranscript.forOid4VpDcApi(
        {
          ...rest,
          nonce: verifierGeneratedNonce,
          jwkThumbprint: encryptionJwk ? encryptionJwk.getJwkThumbprint() : undefined,
        },
        mdocContext
      )
    }

    if (options.type === 'openId4VpDcApiDraft24') {
      const { verifierGeneratedNonce, ...rest } = options

      return SessionTranscript.forOid4VpDcApiDraft24(
        {
          ...rest,
          nonce: verifierGeneratedNonce,
        },
        mdocContext
      )
    }

    throw new MdocError('Unsupported session transcript option')
  }

  private static getAlgForDeviceKeyJwk(jwk: PublicJwk) {
    const signatureAlgorithm = jwk.supportedSignatureAlgorithms.find(isMdocSupportedSignatureAlgorithm)
    if (!signatureAlgorithm) {
      throw new MdocError(
        `Unable to create mdoc device response. No supported signature algorithm found to sign device response for jwk  ${
          jwk.jwkTypeHumanDescription
        }. Key supports algs ${jwk.supportedSignatureAlgorithms.join(
          ', '
        )}. mdoc supports algs ${mdocSupportedSignatureAlgorithms.join(', ')}`
      )
    }

    return signatureAlgorithm
  }

  public get issuerClaims(): DeviceAndIssuerClaims {
    if (!this.deviceResponse.documents) return {}

    return this.deviceResponse.documents.reduce(
      (prev, document) => ({
        // biome-ignore lint/performance/noAccumulatingSpread: time complexity is not relevant here
        ...prev,
        [document.docType]: Object.fromEntries(
          Array.from(document.issuerSigned.issuerNamespaces.issuerNamespaces.entries()).map(([namespace, claim]) => [
            namespace,
            Object.fromEntries(claim.map((c) => [c.elementIdentifier, c.elementValue])),
          ])
        ),
      }),
      {}
    )
  }

  public get deviceClaims(): DeviceAndIssuerClaims {
    if (!this.deviceResponse.documents) return {}

    return this.deviceResponse.documents.reduce(
      (prev, document) => ({
        // biome-ignore lint/performance/noAccumulatingSpread: time complexity is not relevant here
        ...prev,
        [document.docType]: Object.fromEntries(
          Array.from(document.deviceSigned.deviceNamespaces.deviceNamespaces.entries()).map(([namespace, claim]) => [
            namespace,
            Object.fromEntries(claim.deviceSignedItems),
          ])
        ),
      }),
      {}
    )
  }
}

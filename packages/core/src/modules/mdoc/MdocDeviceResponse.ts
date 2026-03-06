import type { MdocContext } from '@owf/mdoc'
import {
  CoseKey,
  DeviceNamespaces,
  DeviceRequest,
  DeviceResponse,
  DeviceSignedItems,
  DocRequest,
  Document,
  defaultVerificationCallback,
  ItemsRequest,
  SessionTranscript,
} from '@owf/mdoc'
import type { AgentContext } from '../../agent'
import { TypedArrayEncoder } from './../../utils'
import { PublicJwk } from '../kms'
import { ClaimFormat } from '../vc'
import { X509Certificate } from '../x509'
import { getMdocContext } from './MdocContext'
import { MdocError } from './MdocError'
import type {
  MdocDeviceResponseOptions,
  MdocDeviceResponseVerifyOptions,
  MdocSessionTranscriptOptions,
} from './MdocOptions'
import { isMdocSupportedSignatureAlgorithm, mdocSupportedSignatureAlgorithms } from './mdocSupportedAlgs'
import { nameSpacesRecordToMap } from './mdocUtil'

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
    return TypedArrayEncoder.toBase64URL(this.deviceResponse.encode())
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
    const parsed = DeviceResponse.decode(TypedArrayEncoder.fromBase64(base64Url))

    return new MdocDeviceResponse(parsed)
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

    // NOTE: we split so that we can use individual trusted entities for each mdoc
    const splittedDeviceResponses = this.splitIntoSingleDocumentResponses()

    for (const deviceResponse of splittedDeviceResponses) {
      await deviceResponse.deviceResponse
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
          throw new MdocError(
            `Mdoc with doctype ${deviceResponse.deviceResponse.documents?.[0].docType} is not valid`,
            {
              cause: error,
            }
          )
        })
    }
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
}

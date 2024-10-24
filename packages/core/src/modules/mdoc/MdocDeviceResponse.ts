import type { MdocDeviceResponseOpenId4VpOptions, MdocDeviceResponseVerifyOptions } from './MdocOptions'
import type { AgentContext } from '../../agent'
import type { DifPresentationExchangeDefinition } from '../dif-presentation-exchange'
import type { PresentationDefinition } from '@protokoll/mdoc-client'
import type { InputDescriptorV2 } from '@sphereon/pex-models'

import {
  limitDisclosureToInputDescriptor as mdocLimitDisclosureToId,
  COSEKey,
  DeviceResponse,
  MDoc,
  parseIssuerSigned,
  Verifier,
  MDocStatus,
  cborEncode,
} from '@protokoll/mdoc-client'

import { CredoError } from '../../error'
import { uuid } from '../../utils/uuid'
import { X509Certificate } from '../x509/X509Certificate'
import { X509ModuleConfig } from '../x509/X509ModuleConfig'

import { TypedArrayEncoder } from './../../utils'
import { Mdoc } from './Mdoc'
import { getMdocContext } from './MdocContext'
import { MdocError } from './MdocError'

export class MdocDeviceResponse {
  public constructor() {}

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
    return mdocLimitDisclosureToId({ mdoc: _mdoc, inputDescriptor })
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
    const mdoc = new MDoc(issuerSignedDocuments)

    // TODO: we need to implement this differently.
    // TODO: Multiple Mdocs can have different device keys.
    const mso = mdoc.documents[0].issuerSigned.issuerAuth.decodedPayload
    const deviceKeyInfo = mso.deviceKeyInfo
    if (!deviceKeyInfo?.deviceKey) {
      throw new CredoError('Device key info is missing')
    }

    const publicDeviceJwk = COSEKey.import(deviceKeyInfo.deviceKey).toJWK()

    const deviceResponseBuilder = await DeviceResponse.from(mdoc)
      .usingPresentationDefinition(presentationDefinition)
      .usingSessionTranscriptForOID4VP(sessionTranscriptOptions)
      .authenticateWithSignature(publicDeviceJwk, 'ES256')

    for (const [nameSpace, nameSpaceValue] of Object.entries(options.deviceNameSpaces ?? {})) {
      deviceResponseBuilder.addDeviceNameSpace(nameSpace, nameSpaceValue)
    }

    const deviceResponseMdoc = await deviceResponseBuilder.sign(getMdocContext(agentContext))

    return {
      deviceResponseBase64Url: TypedArrayEncoder.toBase64URL(deviceResponseMdoc.encode()),
      presentationSubmission: MdocDeviceResponse.createPresentationSubmission({
        id: 'MdocPresentationSubmission ' + uuid(),
        presentationDefinition,
      }),
    }
  }

  public static async verify(agentContext: AgentContext, options: MdocDeviceResponseVerifyOptions) {
    const verifier = new Verifier()
    const mdocContext = getMdocContext(agentContext)

    let trustedCerts: [string, ...string[]] | undefined
    if (options?.trustedCertificates) {
      trustedCerts = options.trustedCertificates
    } else if (options?.verificationContext) {
      agentContext.dependencyManager.resolve(X509ModuleConfig).getTrustedCertificatesForVerification
      trustedCerts = await agentContext.dependencyManager
        .resolve(X509ModuleConfig)
        .getTrustedCertificatesForVerification?.(agentContext, options.verificationContext)
    } else {
      trustedCerts = agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates
    }

    if (!trustedCerts) {
      throw new MdocError('No trusted certificates found. Cannot verify mdoc.')
    }

    const result = await verifier.verifyDeviceResponse(
      {
        encodedDeviceResponse: TypedArrayEncoder.fromBase64(options.deviceResponse),
        //ephemeralReaderKey: options.verifierKey ? getJwkFromKey(options.verifierKey).toJson() : undefined,
        encodedSessionTranscript: DeviceResponse.calculateSessionTranscriptForOID4VP(options.sessionTranscriptOptions),
        trustedCertificates: trustedCerts.map((cert) => X509Certificate.fromEncodedCertificate(cert).rawCertificate),
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

    return result.documents.map((doc) => {
      const prepared = doc.prepare()
      const docType = prepared.get('docType') as string
      const issuerSigned = cborEncode(prepared.get('issuerSigned'))
      const deviceSigned = cborEncode(prepared.get('deviceSigned'))

      return Mdoc.fromIssuerSignedDocument(
        TypedArrayEncoder.toBase64URL(issuerSigned),
        TypedArrayEncoder.toBase64URL(deviceSigned),
        docType
      )
    })
  }
}

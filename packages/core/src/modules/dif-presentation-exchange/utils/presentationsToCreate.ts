import { CredoError } from '../../../error'
import type { JsonObject } from '../../../types'
import { MdocRecord } from '../../mdoc'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat, W3cCredentialRecord } from '../../vc'
import type {
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeDefinitionV1,
  DifPresentationExchangeDefinitionV2,
} from '../models'

//  - the credentials included in the presentation
export interface SdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtDc
  subjectIds: [] // subject is included in the cnf of the sd-jwt and automatically extracted by PEX
  verifiableCredentials: [
    {
      credential: SdJwtVcRecord
      inputDescriptorId: string

      /**
       * Additional payload to include in the Key Binding JWT
       */
      additionalPayload?: JsonObject
    },
  ] // only one credential supported for SD-JWT-VC
}

export interface JwtVpPresentationToCreate {
  claimFormat: ClaimFormat.JwtVp
  subjectIds: [string] // only one subject id supported for JWT VP
  verifiableCredentials: Array<{
    credential: W3cCredentialRecord
    inputDescriptorId: string
  }> // multiple credentials supported for JWT VP
}

export interface LdpVpPresentationToCreate {
  claimFormat: ClaimFormat.LdpVp
  // NOTE: we only support one subject id at the moment as we don't have proper
  // support yet for adding multiple proofs to an LDP-VP
  subjectIds: undefined | [string]
  verifiableCredentials: Array<{
    credential: W3cCredentialRecord
    inputDescriptorId: string
  }> // multiple credentials supported for LDP VP
}

export interface MdocPresentationToCreate {
  claimFormat: ClaimFormat.MsoMdoc
  subjectIds: []
  verifiableCredentials: [
    {
      credential: MdocRecord
      inputDescriptorId: string
    },
  ] // only one credential supported for MDOC
}

export type PresentationToCreate =
  | SdJwtVcPresentationToCreate
  | JwtVpPresentationToCreate
  | LdpVpPresentationToCreate
  | MdocPresentationToCreate

type PresentationFormatObject =
  | DifPresentationExchangeDefinitionV1['format']
  | DifPresentationExchangeDefinitionV2['format']

const supportedPresentationFormats = new Set<ClaimFormat>([
  ClaimFormat.JwtVp,
  ClaimFormat.LdpVp,
  ClaimFormat.SdJwtDc,
  ClaimFormat.MsoMdoc,
])

const supportedCredentialFormats = new Set<ClaimFormat>([
  ClaimFormat.JwtVc,
  ClaimFormat.LdpVc,
  ClaimFormat.SdJwtDc,
  ClaimFormat.SdJwtW3cVc,
  ClaimFormat.MsoMdoc,
])

function getDeclaredFormats(format: PresentationFormatObject | undefined, supportedFormats: Set<ClaimFormat>) {
  if (!format) return undefined

  if (Object.hasOwn(format, ClaimFormat.SdJwtDc)) {
    throw new CredoError(`PEX format '${ClaimFormat.SdJwtDc}' is not currently supported by the PEX integration.`)
  }

  const declaredFormats = Object.keys(format).filter((formatKey): formatKey is ClaimFormat =>
    supportedFormats.has(formatKey as ClaimFormat)
  )

  return new Set(declaredFormats)
}

function assertSupportedFormats(options: {
  presentationsToCreate: Array<PresentationToCreate>
  credentialsForInputDescriptor: DifPexInputDescriptorToCredentials
  presentationDefinition?: DifPresentationExchangeDefinition
  formatOverride?: PresentationFormatObject
  sdJwtDraft21FormatOverridesByInputDescriptor?: Record<string, ClaimFormat>
}) {
  const {
    presentationsToCreate,
    credentialsForInputDescriptor,
    presentationDefinition,
    formatOverride,
    sdJwtDraft21FormatOverridesByInputDescriptor,
  } = options
  if (!presentationDefinition && !formatOverride) return

  const inputDescriptors = (presentationDefinition?.input_descriptors ?? []) as Array<
    | DifPresentationExchangeDefinitionV1['input_descriptors'][number]
    | DifPresentationExchangeDefinitionV2['input_descriptors'][number]
  >

  for (const presentationToCreate of presentationsToCreate) {
    const supportedPresentationFormatsForRequest = getDeclaredFormats(
      formatOverride ?? presentationDefinition?.format,
      supportedPresentationFormats
    )

    if (
      supportedPresentationFormatsForRequest &&
      !supportedPresentationFormatsForRequest.has(presentationToCreate.claimFormat)
    ) {
      const supportedFormatsAsString = Array.from(supportedPresentationFormatsForRequest).join(', ') || '[none]'
      throw new CredoError(
        [
          `Presentation format '${presentationToCreate.claimFormat}' is not supported by verifier constraints.`,
          `Supported presentation formats: ${supportedFormatsAsString}`,
        ].join('\n')
      )
    }

    for (const { inputDescriptorId } of presentationToCreate.verifiableCredentials) {
      const inputDescriptor = inputDescriptors.find((descriptor) => descriptor.id === inputDescriptorId) as
        | { format?: PresentationFormatObject }
        | undefined
      const declaredCredentialFormatsForDescriptor = getDeclaredFormats(
        inputDescriptor?.format,
        supportedCredentialFormats
      )
      const credentialFormatOverride = sdJwtDraft21FormatOverridesByInputDescriptor?.[inputDescriptorId]
      const supportedCredentialFormatsForDescriptor =
        declaredCredentialFormatsForDescriptor && credentialFormatOverride
          ? new Set(
              Array.from(declaredCredentialFormatsForDescriptor).map((format) =>
                format === ClaimFormat.SdJwtW3cVc ? credentialFormatOverride : format
              )
            )
          : declaredCredentialFormatsForDescriptor

      if (!supportedCredentialFormatsForDescriptor) continue

      for (const selectedCredential of credentialsForInputDescriptor[inputDescriptorId] ?? []) {
        const selectedCredentialFormat = selectedCredential.claimFormat
        const formatForValidation =
          sdJwtDraft21FormatOverridesByInputDescriptor?.[inputDescriptorId] ?? selectedCredentialFormat
        if (!supportedCredentialFormatsForDescriptor.has(formatForValidation)) {
          const supportedFormatsAsString = Array.from(supportedCredentialFormatsForDescriptor).join(', ') || '[none]'
          throw new CredoError(
            [
              `Credential format '${selectedCredentialFormat}' is not supported by input descriptor '${inputDescriptorId}'.`,
              `Supported credential formats: ${supportedFormatsAsString}`,
            ].join('\n')
          )
        }
      }
    }
  }
}

export function getPresentationsToCreate(
  credentialsForInputDescriptor: DifPexInputDescriptorToCredentials,
  options?: {
    presentationDefinition?: DifPresentationExchangeDefinition
    formatOverride?: PresentationFormatObject
    sdJwtDraft21FormatOverridesByInputDescriptor?: Record<string, ClaimFormat>
  }
) {
  const presentationsToCreate: Array<PresentationToCreate> = []
  const inputDescriptorOrder = new Map(
    options?.presentationDefinition?.input_descriptors.map((inputDescriptor, index) => [inputDescriptor.id, index])
  )
  const credentialEntries = Object.entries(credentialsForInputDescriptor).sort(
    ([firstInputDescriptorId], [secondInputDescriptorId]) =>
      (inputDescriptorOrder.get(firstInputDescriptorId) ?? Number.MAX_SAFE_INTEGER) -
      (inputDescriptorOrder.get(secondInputDescriptorId) ?? Number.MAX_SAFE_INTEGER)
  )

  // Map credentials for each input descriptor to presentations grouped by subject.
  // Process descriptor groups in presentation-definition order so submission ordering is stable.
  for (const [inputDescriptorId, credentials] of credentialEntries) {
    for (const credential of credentials) {
      switch (credential.claimFormat) {
        case ClaimFormat.SdJwtDc: {
          if (!(credential.credentialRecord instanceof SdJwtVcRecord)) {
            throw new CredoError(
              `Claim format SdJwtDc requires SdJwtVcRecord for input descriptor '${inputDescriptorId}'.`
            )
          }

          // SD-JWT-VC always needs its own presentation
          presentationsToCreate.push({
            claimFormat: ClaimFormat.SdJwtDc,
            subjectIds: [],
            verifiableCredentials: [
              {
                inputDescriptorId,
                credential: credential.credentialRecord,
                additionalPayload: credential.additionalPayload,
              },
            ],
          })

          break
        }
        case ClaimFormat.MsoMdoc: {
          if (!(credential.credentialRecord instanceof MdocRecord)) {
            throw new CredoError(
              `Claim format MsoMdoc requires MdocRecord for input descriptor '${inputDescriptorId}'.`
            )
          }

          presentationsToCreate.push({
            claimFormat: ClaimFormat.MsoMdoc,
            verifiableCredentials: [{ inputDescriptorId, credential: credential.credentialRecord }],
            subjectIds: [],
          })

          break
        }
        case ClaimFormat.JwtVc:
        case ClaimFormat.LdpVc: {
          if (!(credential.credentialRecord instanceof W3cCredentialRecord)) {
            throw new CredoError(
              `Claim format JwtVc/LdpVc requires W3cCredentialRecord for input descriptor '${inputDescriptorId}'.`
            )
          }

          const subjectId = credential.credentialRecord.firstCredential.credentialSubjectIds[0]

          // NOTE: we only support one subjectId per VP -- once we have proper support
          // for multiple proofs on an LDP-VP we can add multiple subjectIds to a single VP for LDP-vp only
          const expectedClaimFormat =
            credential.credentialRecord.firstCredential.claimFormat === ClaimFormat.LdpVc
              ? ClaimFormat.LdpVp
              : ClaimFormat.JwtVp

          const matchingClaimFormatAndSubject = presentationsToCreate.find(
            (p): p is JwtVpPresentationToCreate | LdpVpPresentationToCreate =>
              p.claimFormat === expectedClaimFormat && Boolean(p.subjectIds?.includes(subjectId))
          )

          if (matchingClaimFormatAndSubject) {
            matchingClaimFormatAndSubject.verifiableCredentials.push({
              inputDescriptorId,
              credential: credential.credentialRecord,
            })
          } else {
            presentationsToCreate.push({
              claimFormat: expectedClaimFormat,
              subjectIds: [subjectId],
              verifiableCredentials: [{ credential: credential.credentialRecord, inputDescriptorId }],
            })
          }

          break
        }
        default: {
          const exhaustiveClaimFormat: never = credential
          void exhaustiveClaimFormat
          throw new CredoError(`Unsupported claim format for input descriptor '${inputDescriptorId}'.`)
        }
      }
    }
  }

  assertSupportedFormats({
    presentationsToCreate,
    credentialsForInputDescriptor,
    presentationDefinition: options?.presentationDefinition,
    formatOverride: options?.formatOverride,
    sdJwtDraft21FormatOverridesByInputDescriptor: options?.sdJwtDraft21FormatOverridesByInputDescriptor,
  })

  return presentationsToCreate
}

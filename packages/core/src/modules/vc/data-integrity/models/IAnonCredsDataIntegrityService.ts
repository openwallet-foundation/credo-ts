import type { W3cJsonLdVerifiablePresentation } from './W3cJsonLdVerifiablePresentation'
import type { AgentContext } from '../../../../agent'
import type { JsonObject } from '../../../../types'
import type { W3cCredentialRecord } from '../../repository'
import type { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models'

export const AnoncredsDataIntegrityCryptosuite = 'anoncreds-2023' as const

export interface AnoncredsDataIntegrityCreatePresentation {
  presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
  presentationSubmission: PresentationSubmission
  selectedCredentials: JsonObject[]
  selectedCredentialRecords: W3cCredentialRecord[]
  challenge: string
}

export interface AnoncredsDataIntegrityVerifyPresentation {
  presentation: W3cJsonLdVerifiablePresentation
  presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
  presentationSubmission: PresentationSubmission
  challenge: string
}

export const AnonCredsDataIntegrityServiceSymbol = Symbol('AnonCredsDataIntegrityService')

/**
 * We keep this standalone and don't integrity it
 * with for example the SignatureSuiteRegistry due
 * to it's unique properties, in order to not pollute,
 * the existing api's.
 */
export interface IAnoncredsDataIntegrityService {
  createPresentation(agentContext: AgentContext, options: AnoncredsDataIntegrityCreatePresentation): Promise<JsonObject>

  verifyPresentation(agentContext: AgentContext, options: AnoncredsDataIntegrityVerifyPresentation): Promise<boolean>
}

import type { AgentContext } from '../../../../agent'
import type { JsonObject } from '../../../../types'
import type { W3cCredentialRecord, W3cJsonLdVerifiablePresentation } from '../../../vc'
import type { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models'

export interface Anoncreds2023SignatureOptions extends Record<string, unknown> {
  presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
  presentationSubmission: PresentationSubmission
  selectedCredentials: JsonObject[]
  selectedCredentialRecords: W3cCredentialRecord[]
}

export interface Anoncreds2023VerificationOptions extends Record<string, unknown> {
  presentation: W3cJsonLdVerifiablePresentation
  presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
  presentationSubmission: PresentationSubmission
}

export const anoncreds2023DataIntegrityServiceSymbol = Symbol('AnonCredsVcDataIntegrityService')

/**
 * We keep this standalone and don't integrity it
 * with for example the SignatureSuiteRegistry due
 * to it's unique properties, in order to not pollute,
 * the existing api's.
 */
export interface Anoncreds2023DataIntegrityService {
  createPresentation(agentContext: AgentContext, options: Anoncreds2023SignatureOptions): Promise<JsonObject>

  verifyPresentation(agentContext: AgentContext, options: Anoncreds2023VerificationOptions): Promise<boolean>
}

import type { AgentContext } from '../../../../agent'
import type { JsonObject } from '../../../../types'
import type { W3cCredentialRecord, W3cJsonLdVerifiablePresentation } from '../../../vc'
import type { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models'

export interface AnonCredsVcSignatureOptions extends Record<string, unknown> {
  presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
  presentationSubmission: PresentationSubmission
  selectedCredentials: JsonObject[]
  selectedCredentialRecords: W3cCredentialRecord[]
}

export interface AnonCredsVcVerificationOptions extends Record<string, unknown> {
  presentation: W3cJsonLdVerifiablePresentation
  presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
  presentationSubmission: PresentationSubmission
}

export const anonCredsVcDataIntegrityServiceSymbol = Symbol('AnonCredsVcDataIntegrityService')

/**
 * We keep this standalone and don't integrity it
 * with for example the SignatureSuiteRegistry due
 * to it's unique properties, in order to not pollute,
 * the existing api's.
 */
export interface AnonCredsVcDataIntegrityService {
  createPresentation(agentContext: AgentContext, options: AnonCredsVcSignatureOptions): Promise<JsonObject>

  verifyPresentation(agentContext: AgentContext, options: AnonCredsVcVerificationOptions): Promise<boolean>
}

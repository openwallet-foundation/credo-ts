import type { AgentContext } from '../../../agent/context'
import type {
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
} from '../../dif-presentation-exchange'
import type { W3cJsonLdVerifiablePresentation } from '../linked-data-proofs/models/W3cJsonLdVerifiablePresentation'
import type { W3cPresentation } from '../models'
import type { W3cCredentialRecord } from '../repository'

export const ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE = 'anoncreds-2023' as const

export interface AnonCredsW3cCredentialCreatePresentation {
  selectedCredentialRecords: W3cCredentialRecord[]
  presentationDefinition: DifPresentationExchangeDefinition
  presentationSubmission: DifPresentationExchangeSubmission
  challenge: string
}

export interface AnonCredsW3cCredentialVerifyPresentation {
  presentation: W3cJsonLdVerifiablePresentation
  presentationDefinition: DifPresentationExchangeDefinition
  presentationSubmission: DifPresentationExchangeSubmission
  challenge: string
}

export const AnonCredsW3cCredentialServiceSymbol = Symbol('AnonCredsW3cCredentialService')

/**
 * We keep this standalone and don't integrate it with for example the SignatureSuiteRegistry
 * due to its unique properties, in order to not pollute the existing apis.
 */
export interface IAnonCredsW3cCredentialService {
  createPresentation(
    agentContext: AgentContext,
    options: AnonCredsW3cCredentialCreatePresentation
  ): Promise<W3cPresentation>

  verifyPresentation(agentContext: AgentContext, options: AnonCredsW3cCredentialVerifyPresentation): Promise<boolean>
}

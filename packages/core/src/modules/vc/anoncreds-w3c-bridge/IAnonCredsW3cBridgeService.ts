import type { AgentContext } from '../../../agent/context'
import type {
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
} from '../../dif-presentation-exchange'
import type { W3cJsonLdVerifiablePresentation } from '../linked-data-proofs/models/W3cJsonLdVerifiablePresentation'
import type { W3cPresentation } from '../models'
import type { W3cCredentialRecord } from '../repository'

export const ANONCREDS_W3C_BRIDGE_CRYPTOSUITE = 'anoncreds-2023' as const

export interface AnonCredsW3cBridgeCreatePresentation {
  selectedCredentialRecords: W3cCredentialRecord[]
  presentationDefinition: DifPresentationExchangeDefinition
  presentationSubmission: DifPresentationExchangeSubmission
  challenge: string
}

export interface AnonCredsW3cBridgeVerifyPresentation {
  presentation: W3cJsonLdVerifiablePresentation
  presentationDefinition: DifPresentationExchangeDefinition
  presentationSubmission: DifPresentationExchangeSubmission
  challenge: string
}

export const AnonCredsW3cBridgeServiceSymbol = Symbol('AnonCredsW3cBridgeService')

/**
 * We keep this standalone and don't integrate it with for example the SignatureSuiteRegistry
 * due to its unique properties, in order to not pollute the existing apis.
 */
export interface IAnonCredsW3cBridgeService {
  createPresentation(
    agentContext: AgentContext,
    options: AnonCredsW3cBridgeCreatePresentation
  ): Promise<W3cPresentation>

  verifyPresentation(agentContext: AgentContext, options: AnonCredsW3cBridgeVerifyPresentation): Promise<boolean>
}

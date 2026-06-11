import type { AgentContext } from '../../../agent/context'
import type {
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
} from '../../dif-presentation-exchange'
import type { W3cJsonLdVerifiablePresentation } from '../linked-data-proofs/models/W3cJsonLdVerifiablePresentation'
import type { W3cPresentation } from '../models'
import type { W3cCredentialRecord } from '../repository'

export const ANONCREDS_VC1_BRIDGE_CRYPTOSUITE = 'anoncreds-2023' as const

export interface AnonCredsVc1BridgeCreatePresentation {
  selectedCredentialRecords: W3cCredentialRecord[]
  presentationDefinition: DifPresentationExchangeDefinition
  presentationSubmission: DifPresentationExchangeSubmission
  challenge: string
}

export interface AnonCredsVc1BridgeVerifyPresentation {
  presentation: W3cJsonLdVerifiablePresentation
  presentationDefinition: DifPresentationExchangeDefinition
  presentationSubmission: DifPresentationExchangeSubmission
  challenge: string
}

export const AnonCredsVc1BridgeServiceSymbol = Symbol('AnonCredsVc1BridgeService')

/**
 * We keep this standalone and don't integrate it with for example the SignatureSuiteRegistry
 * due to its unique properties, in order to not pollute the existing apis.
 */
export interface IAnonCredsVc1BridgeService {
  createPresentation(
    agentContext: AgentContext,
    options: AnonCredsVc1BridgeCreatePresentation
  ): Promise<W3cPresentation>

  verifyPresentation(agentContext: AgentContext, options: AnonCredsVc1BridgeVerifyPresentation): Promise<boolean>
}

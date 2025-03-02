import type { AgentContext } from '../../../../agent'
import type {
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
} from '../../../dif-presentation-exchange'
import type { W3cPresentation } from '../../models'
import type { W3cCredentialRecord } from '../../repository'
import type { W3cJsonLdVerifiablePresentation } from './W3cJsonLdVerifiablePresentation'

export const ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE = 'anoncreds-2023' as const

export interface AnoncredsDataIntegrityCreatePresentation {
  selectedCredentialRecords: W3cCredentialRecord[]
  presentationDefinition: DifPresentationExchangeDefinition
  presentationSubmission: DifPresentationExchangeSubmission
  challenge: string
}

export interface AnoncredsDataIntegrityVerifyPresentation {
  presentation: W3cJsonLdVerifiablePresentation
  presentationDefinition: DifPresentationExchangeDefinition
  presentationSubmission: DifPresentationExchangeSubmission
  challenge: string
}

export const AnonCredsDataIntegrityServiceSymbol = Symbol('AnonCredsDataIntegrityService')

/**
 * We keep this standalone and don't integrity it
 * with for example the SignatureSuiteRegistry due
 * to it's unique properties, in order to not pollute,
 * the existing api's.
 */
export interface IAnonCredsDataIntegrityService {
  createPresentation(
    agentContext: AgentContext,
    options: AnoncredsDataIntegrityCreatePresentation
  ): Promise<W3cPresentation>

  verifyPresentation(agentContext: AgentContext, options: AnoncredsDataIntegrityVerifyPresentation): Promise<boolean>
}

import type { AgentContext } from '@credo-ts/core'
import type { VerifyProofOptions, VerifyW3cPresentationOptions } from './AnonCredsVerifierServiceOptions'

export const AnonCredsVerifierServiceSymbol = Symbol('AnonCredsVerifierService')

export interface AnonCredsVerifierService {
  // TODO: do we want to extend the return type with more info besides a boolean.
  // If the value is false it would be nice to have some extra contexts about why it failed
  verifyProof(agentContext: AgentContext, options: VerifyProofOptions): Promise<boolean>

  verifyW3cPresentation(agentContext: AgentContext, options: VerifyW3cPresentationOptions): Promise<boolean>
}

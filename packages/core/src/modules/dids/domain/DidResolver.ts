import type { AgentContext } from '../../../agent'
import type { ParsedDid, DidResolutionResult, DidResolutionOptions } from '../types'

export interface DidResolver {
  readonly supportedMethods: string[]
  readonly allowsCaching: boolean

  resolve(
    agentContext: AgentContext,
    did: string,
    parsed: ParsedDid,
    didResolutionOptions: DidResolutionOptions
  ): Promise<DidResolutionResult>
}

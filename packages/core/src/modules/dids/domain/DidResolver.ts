import type { AgentContext } from '../../../agent'
import type { DidResolutionOptions, DidResolutionResult, ParsedDid } from '../types'

export interface DidResolver {
  readonly supportedMethods: string[]
  readonly allowsCaching: boolean

  /**
   * Default cache scope; use global only for context-independent resolution.
   * Explicit DidsModuleConfig.publicDidMethods overrides this value.
   *
   * @default 'context'
   */
  readonly cacheScope?: 'global' | 'context'

  /**
   * Whether the resolver allows using a local created did document from
   * a did record to resolve the did document.
   *
   * @default false
   * @todo make required in 0.6.0
   */
  readonly allowsLocalDidRecord?: boolean

  resolve(
    agentContext: AgentContext,
    did: string,
    parsed: ParsedDid,
    didResolutionOptions: DidResolutionOptions
  ): Promise<DidResolutionResult>
}

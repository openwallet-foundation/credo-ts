import type { AgentContext } from '../../../agent'
import type {
  DidCreateOptions,
  DidDeactivateOptions,
  DidUpdateOptions,
  DidCreateResult,
  DidUpdateResult,
  DidDeactivateResult,
} from '../types'

export interface DidRegistrar {
  readonly supportedMethods: string[]

  create(agentContext: AgentContext, options: DidCreateOptions): Promise<DidCreateResult>
  update(agentContext: AgentContext, options: DidUpdateOptions): Promise<DidUpdateResult>
  deactivate(agentContext: AgentContext, options: DidDeactivateOptions): Promise<DidDeactivateResult>
}

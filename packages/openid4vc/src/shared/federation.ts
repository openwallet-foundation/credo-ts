import type { AgentContext, Key } from '@credo-ts/core'

// TODO: Not really sure about this type yet but it's a start.
export type FederationKeyCallback<TContext extends Record<string, unknown> = Record<string, unknown>> = (
  agentContext: AgentContext,
  context: TContext
) => Promise<{
  key: Key
}>

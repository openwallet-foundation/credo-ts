import { type AgentContext, CredoError, DidsModuleConfig } from '@credo-ts/core'

import { WebVhDidResolver } from './WebVhDidResolver'

export function getWebVhDidResolver(agentContext: AgentContext): WebVhDidResolver {
  const resolver = agentContext
    .resolve(DidsModuleConfig)
    .resolvers.find((resolver): resolver is WebVhDidResolver => resolver instanceof WebVhDidResolver)

  if (!resolver) {
    throw new CredoError('No WebVhDidResolver registered on the DidsModule. Make sure the WebVhModule is registered.')
  }

  return resolver
}

import { AgentContext, injectable } from '@credo-ts/core'

import { getWebVhDidResolver } from './dids/getWebVhDidResolver'

@injectable()
export class WebVhApi {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async resolveResource(resourceUrl: string) {
    const webvhDidResolver = getWebVhDidResolver(this.agentContext)
    return await webvhDidResolver.resolveResource(this.agentContext, resourceUrl)
  }
}

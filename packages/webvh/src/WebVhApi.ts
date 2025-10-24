import { AgentContext } from '@credo-ts/core'
import { injectable } from 'tsyringe'

import { WebVhDidResolver } from './dids/WebVhDidResolver'

@injectable()
export class WebVhApi {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async resolveResource(resourceUrl: string) {
    const webvhDidResolver = this.agentContext.dependencyManager.resolve(WebVhDidResolver)
    return await webvhDidResolver.resolveResource(this.agentContext, resourceUrl)
  }
}

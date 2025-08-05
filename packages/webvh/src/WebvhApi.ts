import { AgentContext } from '@credo-ts/core'
import { injectable } from 'tsyringe'

import { WebvhDidResolver } from './dids/WebvhDidResolver'

@injectable()
export class WebvhApi {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async resolveResource(resourceUrl: string) {
    const webvhDidResolver = this.agentContext.dependencyManager.resolve(WebvhDidResolver)
    return await webvhDidResolver.resolveResource(this.agentContext, resourceUrl)
  }
}

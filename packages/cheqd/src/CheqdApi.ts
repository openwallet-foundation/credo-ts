import { AgentContext } from '@credo-ts/core'
import { injectable } from 'tsyringe'

import { type CheqdCreateResourceOptions, CheqdDidRegistrar, CheqdDidResolver } from './dids'

@injectable()
export class CheqdApi {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async createResource(did: string, options: CheqdCreateResourceOptions) {
    const cheqdDidRegistrar = this.agentContext.dependencyManager.resolve(CheqdDidRegistrar)
    return await cheqdDidRegistrar.createResource(this.agentContext, did, options)
  }

  public async resolveResource(resourceUrl: string) {
    const cheqdDidResolver = this.agentContext.dependencyManager.resolve(CheqdDidResolver)
    return await cheqdDidResolver.resolveResource(this.agentContext, resourceUrl)
  }
}

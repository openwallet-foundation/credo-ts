import { AgentContext } from '@credo-ts/core'
import { injectable } from 'tsyringe'

import { CheqdCreateResourceOptions, CheqdDidRegistrar } from './dids'

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
}

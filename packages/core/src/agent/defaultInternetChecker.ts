import type { InternetChecker } from '../types'
import type { AgentDependencies } from './AgentDependencies'

export class DefaultInternetChecker implements InternetChecker {
  public constructor(public readonly pingUrl: string, private readonly agentDependencies: AgentDependencies) {}

  public hasInternetAccess(): Promise<boolean> {
    return this.agentDependencies
      .fetch(this.pingUrl)
      .then(() => true)
      .catch(() => false)
  }
}

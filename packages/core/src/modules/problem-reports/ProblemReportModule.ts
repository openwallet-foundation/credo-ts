import type { DependencyManager } from '../../plugins'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { injectable, module } from '../../plugins'

import { ProblemReportV1Handler, ProblemReportV2Handler } from './handlers'

@module()
@injectable()
export class ProblemReportModule {
  public constructor(dispatcher: Dispatcher, private readonly config: AgentConfig) {
    this.registerHandlers(dispatcher)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new ProblemReportV1Handler(this.config.logger))
    dispatcher.registerHandler(new ProblemReportV2Handler(this.config.logger))
  }

  public static register(dependencyManager: DependencyManager) {
    dependencyManager.registerContextScoped(ProblemReportModule)
  }
}

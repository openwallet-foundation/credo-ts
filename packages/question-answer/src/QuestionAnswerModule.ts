import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { DidCommFeatureRegistry, DidCommMessageHandlerRegistry, DidCommProtocol } from '@credo-ts/didcomm'
import { AnswerMessageHandler, QuestionMessageHandler } from './handlers'
import { QuestionAnswerApi } from './QuestionAnswerApi'
import { QuestionAnswerRole } from './QuestionAnswerRole'
import { QuestionAnswerRepository } from './repository'
import { QuestionAnswerService } from './services'

export class QuestionAnswerModule implements Module {
  public readonly api = QuestionAnswerApi

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(QuestionAnswerService)

    // Repositories
    dependencyManager.registerSingleton(QuestionAnswerRepository)
  }

  public async initialize(agentContext: AgentContext) {
    // Feature Registry
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(DidCommMessageHandlerRegistry)
    const questionAnswerService = agentContext.resolve(QuestionAnswerService)

    messageHandlerRegistry.registerMessageHandlers([
      new QuestionMessageHandler(questionAnswerService),
      new AnswerMessageHandler(questionAnswerService),
    ])

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/questionanswer/1.0',
        roles: [QuestionAnswerRole.Questioner, QuestionAnswerRole.Responder],
      })
    )
  }
}

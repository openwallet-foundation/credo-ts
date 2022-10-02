import type { DependencyManager, FeatureRegistry, Module } from '@aries-framework/core'

import { Protocol } from '@aries-framework/core'

import { QuestionAnswerApi } from './QuestionAnswerApi'
import { QuestionAnswerRole } from './QuestionAnswerRole'
import { QuestionAnswerRepository } from './repository'
import { QuestionAnswerService } from './services'

export class QuestionAnswerModule implements Module {
  public readonly api = QuestionAnswerApi

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(QuestionAnswerApi)

    // Services
    dependencyManager.registerSingleton(QuestionAnswerService)

    // Repositories
    dependencyManager.registerSingleton(QuestionAnswerRepository)

    // Feature Registry
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/questionanswer/1.0',
        roles: [QuestionAnswerRole.Questioner, QuestionAnswerRole.Responder],
      })
    )
  }
}

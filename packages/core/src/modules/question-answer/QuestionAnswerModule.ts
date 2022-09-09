import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { DependencyManager, Module } from '../../plugins'

import { Protocol } from '../../agent/models'

import { QuestionAnswerApi } from './QuestionAnswerApi'
import { QuestionAnswerRole } from './QuestionAnswerRole'
import { QuestionAnswerRepository } from './repository'
import { QuestionAnswerService } from './services'

export class QuestionAnswerModule implements Module {
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

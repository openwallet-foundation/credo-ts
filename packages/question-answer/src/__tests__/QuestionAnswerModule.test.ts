import type { DependencyManager, FeatureRegistry } from '@credo-ts/core'
import type { FeatureRegistry } from '@credo-ts/didcomm'

import { Protocol } from '@credo-ts/didcomm'

import {
  QuestionAnswerModule,
  QuestionAnswerRepository,
  QuestionAnswerRole,
  QuestionAnswerService,
} from '@credo-ts/question-answer'

const featureRegistry = {
  register: jest.fn(),
} as unknown as FeatureRegistry

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: () => {
    return featureRegistry
  },
} as unknown as DependencyManager

describe('QuestionAnswerModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const questionAnswerModule = new QuestionAnswerModule()
    questionAnswerModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(QuestionAnswerService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(QuestionAnswerRepository)

    expect(featureRegistry.register).toHaveBeenCalledTimes(1)
    expect(featureRegistry.register).toHaveBeenCalledWith(
      new Protocol({
        id: 'https://didcomm.org/questionanswer/1.0',
        roles: [QuestionAnswerRole.Questioner, QuestionAnswerRole.Responder],
      })
    )
  })
})

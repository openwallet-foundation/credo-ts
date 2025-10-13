import type { DependencyManager } from '@credo-ts/core'
import { DidCommFeatureRegistry, DidCommMessageHandlerRegistry, DidCommProtocol } from '@credo-ts/didcomm'
import {
  QuestionAnswerModule,
  QuestionAnswerRepository,
  QuestionAnswerRole,
  QuestionAnswerService,
} from '@credo-ts/question-answer'
import { getAgentContext } from '../../../core/tests'

const featureRegistry = {
  register: vi.fn(),
} as unknown as DidCommFeatureRegistry

const messageHandlerRegistry = new DidCommMessageHandlerRegistry()

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: (token: unknown) => {
    if (token === DidCommFeatureRegistry) return featureRegistry
    if (token === DidCommMessageHandlerRegistry) return messageHandlerRegistry
    return {}
  },
} as unknown as DependencyManager

describe('QuestionAnswerModule', () => {
  test('registers dependencies on the dependency manager', async () => {
    const questionAnswerModule = new QuestionAnswerModule()
    questionAnswerModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(QuestionAnswerService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(QuestionAnswerRepository)

    await questionAnswerModule.initialize(getAgentContext({ dependencyManager }))
    expect(featureRegistry.register).toHaveBeenCalledTimes(1)
    expect(featureRegistry.register).toHaveBeenCalledWith(
      new DidCommProtocol({
        id: 'https://didcomm.org/questionanswer/1.0',
        roles: [QuestionAnswerRole.Questioner, QuestionAnswerRole.Responder],
      })
    )
  })
})

import type { DependencyManager } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'

import { DidCommBasicMessagesModule } from '../DidCommBasicMessagesModule'
import { DidCommBasicMessageRepository } from '../repository'
import { DidCommBasicMessageService } from '../services'

const featureRegistry = {
  register: jest.fn(),
} as unknown as DidCommFeatureRegistry

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: () => featureRegistry,
} as unknown as DependencyManager

describe('BasicMessagesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DidCommBasicMessagesModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommBasicMessageService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommBasicMessageRepository)
  })
})

import type { DependencyManager } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'

import { DidCommBasicMessagesModule } from '../DidCommBasicMessagesModule'
import { DidCommBasicMessagesModuleConfig } from '../DidCommBasicMessagesModuleConfig'
import { DidCommBasicMessageV2Service } from '../protocol/v2'
import { DidCommBasicMessageRepository } from '../repository'
import { DidCommBasicMessageService } from '../services'

const featureRegistry = {
  register: vi.fn(),
} as unknown as DidCommFeatureRegistry

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: () => featureRegistry,
} as unknown as DependencyManager

describe('BasicMessagesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DidCommBasicMessagesModule().register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(
      DidCommBasicMessagesModuleConfig,
      expect.any(DidCommBasicMessagesModuleConfig)
    )
    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommBasicMessageService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommBasicMessageV2Service)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommBasicMessageRepository)
  })
})

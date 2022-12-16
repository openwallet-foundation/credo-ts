import type { DependencyManager, FeatureRegistry } from '@aries-framework/core'

import { Protocol } from '@aries-framework/core'

import { ActionMenuApi } from '../ActionMenuApi'
import { ActionMenuModule } from '../ActionMenuModule'
import { ActionMenuRole } from '../ActionMenuRole'
import { ActionMenuRepository } from '../repository'
import { ActionMenuService } from '../services'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
} as unknown as DependencyManager

const featureRegistry = {
  register: jest.fn(),
} as unknown as FeatureRegistry

describe('ActionMenuModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const actionMenuModule = new ActionMenuModule()
    actionMenuModule.register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(ActionMenuApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ActionMenuService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ActionMenuRepository)

    expect(featureRegistry.register).toHaveBeenCalledTimes(1)
    expect(featureRegistry.register).toHaveBeenCalledWith(
      new Protocol({
        id: 'https://didcomm.org/action-menu/1.0',
        roles: [ActionMenuRole.Requester, ActionMenuRole.Responder],
      })
    )
  })
})

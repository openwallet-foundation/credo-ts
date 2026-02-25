import type { DependencyManager } from '@credo-ts/core'

import { OpenId4VcHolderModule } from '../OpenId4VcHolderModule'
import { OpenId4VciHolderService } from '../OpenId4VciHolderService'
import { OpenId4VpHolderService } from '../OpenId4vpHolderService'

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: vi.fn().mockReturnValue({ logger: { warn: vi.fn() } }),
} as unknown as DependencyManager

describe('OpenId4VcHolderModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const openId4VcClientModule = new OpenId4VcHolderModule()
    openId4VcClientModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VciHolderService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VpHolderService)
  })
})

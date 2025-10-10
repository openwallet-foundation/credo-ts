import type { DependencyManager } from '../../../plugins'

import { DcqlModule } from '../DcqlModule'
import { DcqlService } from '../DcqlService'

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: vi.fn().mockReturnValue({ logger: { warn: vi.fn() } }),
} as unknown as DependencyManager

describe('DcqlModule', () => {
  test('registers dependencies on the dependency manager', async () => {
    const dcqlModule = new DcqlModule()

    dcqlModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DcqlService)
  })
})

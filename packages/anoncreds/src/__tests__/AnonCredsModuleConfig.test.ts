import type { AnonCredsRegistry } from '../services'

import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'

describe('AnonCredsModuleConfig', () => {
  test('sets values', () => {
    const registry = {} as AnonCredsRegistry

    const config = new AnonCredsModuleConfig({
      registries: [registry],
    })

    expect(config.registries).toEqual([registry])
  })
})

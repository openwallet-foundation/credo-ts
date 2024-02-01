import type { AnonCredsRegistry } from '../services'

import { anoncreds } from '../../tests/helpers'
import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'

describe('AnonCredsModuleConfig', () => {
  test('sets values', () => {
    const registry = {} as AnonCredsRegistry

    const config = new AnonCredsModuleConfig({
      registries: [registry],
      anoncreds,
    })

    expect(config.registries).toEqual([registry])
  })
})

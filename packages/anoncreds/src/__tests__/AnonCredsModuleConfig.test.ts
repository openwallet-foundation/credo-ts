import { anoncreds } from '../../tests/helpers'
import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'
import type { AnonCredsRegistry } from '../services'

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

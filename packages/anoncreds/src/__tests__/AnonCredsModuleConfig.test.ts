import type { AnonCredsRegistry } from '../services'

import { anoncreds } from '@hyperledger/anoncreds-nodejs'

import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'

describe('AnonCredsModuleConfig', () => {
  test('sets values', () => {
    const registry = {} as AnonCredsRegistry

    const config = new AnonCredsModuleConfig({
      anoncreds,
      registries: [registry],
    })

    expect(config.registries).toEqual([registry])
  })
})

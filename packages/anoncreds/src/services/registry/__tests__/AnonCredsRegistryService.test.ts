import type { AnonCredsRegistry } from '../AnonCredsRegistry'

import { getAgentContext } from '../../../../../core/tests/helpers'
import { AnonCredsModuleConfig } from '../../../AnonCredsModuleConfig'
import { AnonCredsError } from '../../../error'
import { AnonCredsRegistryService } from '../AnonCredsRegistryService'

const registryOne = {
  supportedMethods: [/a/],
} as AnonCredsRegistry

const registryTwo = {
  supportedMethods: [/b/],
} as AnonCredsRegistry

const agentContext = getAgentContext({
  registerInstances: [
    [
      AnonCredsModuleConfig,
      new AnonCredsModuleConfig({
        registries: [registryOne, registryTwo],
      }),
    ],
  ],
})

const anonCredsRegistryService = new AnonCredsRegistryService()

describe('AnonCredsRegistryService', () => {
  test('returns the registry for an identifier based on the supportedMethods regex', async () => {
    await expect(anonCredsRegistryService.getRegistryForIdentifier(agentContext, 'a')).resolves.toEqual(registryOne)
    await expect(anonCredsRegistryService.getRegistryForIdentifier(agentContext, 'b')).resolves.toEqual(registryTwo)
  })

  test('throws AnonCredsError if no registry is found for the given identifier', async () => {
    await expect(anonCredsRegistryService.getRegistryForIdentifier(agentContext, 'c')).rejects.toThrow(AnonCredsError)
  })
})

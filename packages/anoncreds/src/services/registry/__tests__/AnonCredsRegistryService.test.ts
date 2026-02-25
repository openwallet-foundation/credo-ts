import { getAgentContext } from '../../../../../core/tests/helpers'
import { anoncreds } from '../../../../tests/helpers'
import { AnonCredsModuleConfig } from '../../../AnonCredsModuleConfig'
import { AnonCredsError } from '../../../error'
import type { AnonCredsRegistry } from '../AnonCredsRegistry'
import { AnonCredsRegistryService } from '../AnonCredsRegistryService'

const registryOne = {
  supportedIdentifier: /a/,
} as AnonCredsRegistry

const registryTwo = {
  supportedIdentifier: /b/,
} as AnonCredsRegistry

const agentContext = getAgentContext({
  registerInstances: [
    [
      AnonCredsModuleConfig,
      new AnonCredsModuleConfig({
        registries: [registryOne, registryTwo],
        anoncreds,
      }),
    ],
  ],
})

const anonCredsRegistryService = new AnonCredsRegistryService()

describe('AnonCredsRegistryService', () => {
  test('returns the registry for an identifier based on the supportedMethods regex', async () => {
    expect(anonCredsRegistryService.getRegistryForIdentifier(agentContext, 'a')).toEqual(registryOne)
    expect(anonCredsRegistryService.getRegistryForIdentifier(agentContext, 'b')).toEqual(registryTwo)
  })

  test('throws AnonCredsError if no registry is found for the given identifier', async () => {
    expect(() => anonCredsRegistryService.getRegistryForIdentifier(agentContext, 'c')).toThrow(AnonCredsError)
  })
})

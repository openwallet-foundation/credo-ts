import { CacheModuleConfig, InMemoryLruCache } from '@credo-ts/core'
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

  describe('caching', () => {
    const schemaReturn = {
      schema: { attrNames: ['name'], issuerId: 'did:indy:pool:issuer', name: 'schema', version: '1.0' },
      schemaId: 'cached-schema-id',
      resolutionMetadata: {},
      schemaMetadata: {},
    }

    const getContextsSharingCache = (registry: AnonCredsRegistry) => {
      const anonCredsModuleConfig = new AnonCredsModuleConfig({ registries: [registry], anoncreds })
      const cacheModuleConfig = new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 10 }) })

      return {
        contextOne: getAgentContext({
          contextCorrelationId: 'contextOne',
          registerInstances: [
            [AnonCredsModuleConfig, anonCredsModuleConfig],
            [CacheModuleConfig, cacheModuleConfig],
          ],
        }),
        contextTwo: getAgentContext({
          contextCorrelationId: 'contextTwo',
          registerInstances: [
            [AnonCredsModuleConfig, anonCredsModuleConfig],
            [CacheModuleConfig, cacheModuleConfig],
          ],
        }),
      }
    }

    test('shares resolved objects across agent contexts', async () => {
      const registry = {
        supportedIdentifier: /cached/,
        allowsCaching: true,
        getSchema: vi.fn().mockResolvedValue(schemaReturn),
      } as unknown as AnonCredsRegistry

      const { contextOne, contextTwo } = getContextsSharingCache(registry)

      await anonCredsRegistryService.getSchema(contextOne, 'cached-schema-id')
      const result = await anonCredsRegistryService.getSchema(contextTwo, 'cached-schema-id')

      expect(result.resolutionMetadata.servedFromCache).toBe(true)
      expect(registry.getSchema).toHaveBeenCalledTimes(1)
    })
  })
})

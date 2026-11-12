import { DependencyManager } from '@credo-ts/core'
import { DidCommCredentialExchangeRepository } from '@credo-ts/didcomm'
import { getAgentContext } from '../../../../core/tests/helpers'
import { NativeAnoncreds } from '../../../tests/helpers'
import { InMemoryAnonCredsRegistry } from '../../../tests/InMemoryAnonCredsRegistry'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import { AnonCredsDidCommMigrationProvider } from '../../didcomm/AnonCredsDidCommMigrationProvider'
import { resolveAnonCredsMigrationProvider } from '../optionalDependencies'

describe('resolveAnonCredsMigrationProvider', () => {
  function createDependencyManager(provider?: AnonCredsDidCommMigrationProvider) {
    const dependencyManager = new DependencyManager()
    dependencyManager.registerInstance(
      AnonCredsModuleConfig,
      new AnonCredsModuleConfig({
        anoncreds: NativeAnoncreds,
        registries: [new InMemoryAnonCredsRegistry()],
        migrationProvider: provider,
      })
    )
    return dependencyManager
  }

  test('does not discover DIDComm when no provider is configured, even if its repository is registered', () => {
    const dependencyManager = createDependencyManager()
    dependencyManager.registerSingleton(DidCommCredentialExchangeRepository)
    expect(resolveAnonCredsMigrationProvider(dependencyManager)).toEqual({
      provider: undefined,
      unavailableReason: 'no AnonCreds migration provider is configured',
    })
  })

  test('skips an explicit provider when the credentials module is not registered', () => {
    expect(resolveAnonCredsMigrationProvider(createDependencyManager(new AnonCredsDidCommMigrationProvider()))).toEqual(
      {
        provider: undefined,
        unavailableReason: 'the DIDComm credentials module is not registered',
      }
    )
  })

  test('uses the explicit provider when the credentials repository is registered', () => {
    const provider = new AnonCredsDidCommMigrationProvider()
    const dependencyManager = createDependencyManager(provider)
    dependencyManager.registerSingleton(DidCommCredentialExchangeRepository)
    expect(resolveAnonCredsMigrationProvider(dependencyManager)).toEqual({ provider, unavailableReason: undefined })
  })

  test('propagates unexpected availability failures', () => {
    const provider = new AnonCredsDidCommMigrationProvider()
    const error = new Error('Dependency manager failure')
    vi.spyOn(provider, 'isAvailable').mockImplementation(() => {
      throw error
    })
    expect(() => resolveAnonCredsMigrationProvider(createDependencyManager(provider))).toThrow(error)
  })

  test('propagates repository resolution failures', async () => {
    const provider = new AnonCredsDidCommMigrationProvider()
    const dependencyManager = createDependencyManager(provider)
    const error = new Error('Repository dependency is unavailable')
    vi.spyOn(dependencyManager, 'resolve').mockImplementation(() => {
      throw error
    })
    await expect(
      provider.relinkCredentialExchangeRecord(getAgentContext({ dependencyManager }), {
        legacyCredentialId: 'legacy',
        w3cCredentialRecordId: 'w3c',
      })
    ).rejects.toBe(error)
  })
})

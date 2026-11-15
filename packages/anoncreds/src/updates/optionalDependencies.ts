import type { DependencyManager } from '@credo-ts/core'
import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'

export function resolveAnonCredsMigrationProvider(dependencyManager: DependencyManager) {
  const provider = dependencyManager.resolve(AnonCredsModuleConfig).migrationProvider
  if (!provider) {
    return { provider: undefined, unavailableReason: 'no AnonCreds migration provider is configured' } as const
  }

  if (!provider.isAvailable(dependencyManager)) {
    return { provider: undefined, unavailableReason: 'the DIDComm credentials module is not registered' } as const
  }

  return { provider, unavailableReason: undefined } as const
}

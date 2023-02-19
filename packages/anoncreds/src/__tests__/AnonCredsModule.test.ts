import type { AnonCredsRegistry } from '../services'
import type { DependencyManager } from '@aries-framework/core'

import { AnonCredsModule } from '../AnonCredsModule'
import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'
import {
  AnonCredsSchemaRepository,
  AnonCredsCredentialDefinitionRepository,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRepository,
} from '../repository'
import { AnonCredsRegistryService } from '../services/registry/AnonCredsRegistryService'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
} as unknown as DependencyManager

const registry = {} as AnonCredsRegistry

describe('AnonCredsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const anonCredsModule = new AnonCredsModule({
      registries: [registry],
    })
    anonCredsModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(6)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(AnonCredsRegistryService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(AnonCredsSchemaRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(AnonCredsCredentialDefinitionRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(AnonCredsCredentialDefinitionPrivateRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(AnonCredsKeyCorrectnessProofRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(AnonCredsLinkSecretRepository)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(AnonCredsModuleConfig, anonCredsModule.config)
  })
})

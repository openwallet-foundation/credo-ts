import type { CredentialProtocol } from '../protocol/CredentialProtocol'

import { FeatureRegistry } from '../../../agent/FeatureRegistry'
import { Protocol } from '../../../agent/models/features/Protocol'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { CredentialsApi } from '../CredentialsApi'
import { CredentialsModule } from '../CredentialsModule'
import { CredentialsModuleConfig } from '../CredentialsModuleConfig'
import { V2CredentialProtocol } from '../protocol'
import { RevocationNotificationService } from '../protocol/revocation-notification/services'
import { CredentialRepository } from '../repository'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../../agent/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

describe('CredentialsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const credentialsModule = new CredentialsModule({
      credentialProtocols: [],
    })
    credentialsModule.register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(CredentialsApi)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(CredentialsModuleConfig, credentialsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(RevocationNotificationService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(CredentialRepository)

    expect(featureRegistry.register).toHaveBeenCalledTimes(1)
    expect(featureRegistry.register).toHaveBeenCalledWith(
      new Protocol({
        id: 'https://didcomm.org/revocation_notification/1.0',
        roles: ['holder'],
      }),
      new Protocol({
        id: 'https://didcomm.org/revocation_notification/2.0',
        roles: ['holder'],
      })
    )
  })

  test('registers V2CredentialProtocol if no credentialProtocols are configured', () => {
    const credentialsModule = new CredentialsModule()

    expect(credentialsModule.config.credentialProtocols).toEqual([expect.any(V2CredentialProtocol)])
  })

  test('calls register on the provided CredentialProtocols', () => {
    const registerMock = jest.fn()
    const credentialProtocol = {
      register: registerMock,
    } as unknown as CredentialProtocol

    const credentialsModule = new CredentialsModule({
      credentialProtocols: [credentialProtocol],
    })

    expect(credentialsModule.config.credentialProtocols).toEqual([credentialProtocol])

    credentialsModule.register(dependencyManager, featureRegistry)

    expect(registerMock).toHaveBeenCalledTimes(1)
    expect(registerMock).toHaveBeenCalledWith(dependencyManager, featureRegistry)
  })
})

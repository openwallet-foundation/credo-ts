import { DependencyManager } from '../../../plugins/DependencyManager'
import { FeatureRegistry } from '../../discover-features'
import { CredentialsApi } from '../CredentialsApi'
import { CredentialsModule } from '../CredentialsModule'
import { CredentialsModuleConfig } from '../CredentialsModuleConfig'
import { IndyCredentialFormatService } from '../formats'
import { V1CredentialService, V2CredentialService } from '../protocol'
import { RevocationNotificationService } from '../protocol/revocation-notification/services'
import { CredentialRepository } from '../repository'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../discover-features/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

describe('CredentialsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const credentialsModule = new CredentialsModule()
    credentialsModule.register(featureRegistry, dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(CredentialsApi)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(CredentialsModuleConfig, credentialsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V1CredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2CredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(RevocationNotificationService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(CredentialRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyCredentialFormatService)
  })
})

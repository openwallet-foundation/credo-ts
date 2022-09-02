import { DependencyManager } from '../../../plugins/DependencyManager'
import { FeatureRegistry } from '../../discover-features'
import { AnonCredsCredentialDefinitionRepository } from '../../indy/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from '../../indy/repository/AnonCredsSchemaRepository'
import { LedgerApi } from '../LedgerApi'
import { LedgerModule } from '../LedgerModule'
import { IndyLedgerService, IndyPoolService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../discover-features/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()
describe('LedgerModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new LedgerModule().register(featureRegistry, dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(LedgerApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(4)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyLedgerService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyPoolService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(AnonCredsCredentialDefinitionRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(AnonCredsSchemaRepository)
  })
})

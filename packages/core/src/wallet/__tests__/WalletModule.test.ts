import { DependencyManager } from '../../plugins/DependencyManager'
import { WalletModule } from '../WalletModule'

jest.mock('../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('WalletModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new WalletModule().register(dependencyManager)
  })
})

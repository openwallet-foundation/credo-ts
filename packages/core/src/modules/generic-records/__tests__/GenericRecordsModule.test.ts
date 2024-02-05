import { DependencyManager } from '../../../plugins/DependencyManager'
import { GenericRecordsModule } from '../GenericRecordsModule'
import { GenericRecordsRepository } from '../repository/GenericRecordsRepository'
import { GenericRecordService } from '../services/GenericRecordService'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('GenericRecordsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new GenericRecordsModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(GenericRecordService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(GenericRecordsRepository)
  })
})

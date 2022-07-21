import { DependencyManager } from '../../../plugins/DependencyManager'
import { QuestionAnswerApi } from '../QuestionAnswerApi'
import { QuestionAnswerModule } from '../QuestionAnswerModule'
import { QuestionAnswerRepository } from '../repository/QuestionAnswerRepository'
import { QuestionAnswerService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('QuestionAnswerModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new QuestionAnswerModule().register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(QuestionAnswerApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(QuestionAnswerService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(QuestionAnswerRepository)
  })
})

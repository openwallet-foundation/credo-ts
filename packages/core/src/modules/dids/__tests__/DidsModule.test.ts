import type { Constructor } from '../../../utils/mixins'
import type { DidRegistrar, DidResolver } from '../domain'

import { DependencyManager } from '../../../plugins/DependencyManager'
import { DidsApi } from '../DidsApi'
import { DidsModule } from '../DidsModule'
import { DidsModuleConfig } from '../DidsModuleConfig'
import { DidRegistrarToken, DidResolverToken } from '../domain'
import {
  KeyDidRegistrar,
  KeyDidResolver,
  PeerDidRegistrar,
  PeerDidResolver,
  SovDidRegistrar,
  SovDidResolver,
  WebDidResolver,
} from '../methods'
import { DidRepository } from '../repository'
import { DidRegistrarService, DidResolverService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('DidsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const didsModule = new DidsModule()
    didsModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(DidsApi)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(DidsModuleConfig, didsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(10)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRegistrarService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRepository)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverToken, SovDidResolver)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverToken, WebDidResolver)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverToken, KeyDidResolver)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverToken, PeerDidResolver)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRegistrarToken, KeyDidRegistrar)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRegistrarToken, SovDidRegistrar)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRegistrarToken, PeerDidRegistrar)
  })

  test('takes the values from the dids config', () => {
    const registrar = {} as Constructor<DidRegistrar>
    const resolver = {} as Constructor<DidResolver>

    new DidsModule({
      registrars: [registrar],
      resolvers: [resolver],
    }).register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverToken, resolver)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRegistrarToken, registrar)
  })
})

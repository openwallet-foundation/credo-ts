import type { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'
import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import { DidCommProtocol } from '../../../models'
import { DidCommOutOfBandModule } from '../DidCommOutOfBandModule'
import { DidCommOutOfBandService } from '../DidCommOutOfBandService'
import { DidCommOutOfBandRepository } from '../repository/DidCommOutOfBandRepository'

const outOfBandV1Protocol = new DidCommProtocol({
  id: 'https://didcomm.org/out-of-band/1.1',
  roles: ['sender', 'receiver'],
})
const outOfBandV2Protocol = new DidCommProtocol({
  id: 'https://didcomm.org/out-of-band/2.0',
  roles: ['sender', 'receiver'],
})

async function initializeModule(didcommVersions: Array<'v1' | 'v2'>) {
  const featureRegistry = new DidCommFeatureRegistry()
  const agentContext = getAgentContext({
    registerInstances: [
      [DidCommFeatureRegistry, featureRegistry],
      [DidCommMessageHandlerRegistry, new DidCommMessageHandlerRegistry()],
      [DidCommModuleConfig, new DidCommModuleConfig({ didcommVersions })],
      [DidCommOutOfBandService, {} as unknown as DidCommOutOfBandService],
    ],
  })
  await new DidCommOutOfBandModule().initialize(agentContext)

  return featureRegistry.query({ featureType: 'protocol', match: 'https://didcomm.org/out-of-band/*' })
}

describe('DidCommOutOfBandModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const dependencyManager = {
      registerSingleton: vi.fn(),
    } as unknown as DependencyManager

    new DidCommOutOfBandModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommOutOfBandService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommOutOfBandRepository)
  })

  test('advertises only out-of-band 1.1 when DIDComm v2 is not enabled', async () => {
    expect(await initializeModule(['v1'])).toEqual([outOfBandV1Protocol])
  })

  test('advertises out-of-band 1.1 and 2.0 when DIDComm v2 is enabled', async () => {
    expect(await initializeModule(['v1', 'v2'])).toEqual([outOfBandV1Protocol, outOfBandV2Protocol])
  })
})

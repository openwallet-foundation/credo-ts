import { Agent, AgentContext } from '@aries-framework/core'

import { indySdk } from '../../../core/tests'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../core/tests/helpers'
import { IndySdkModule } from '../../../indy-sdk/src'
import { TenantAgent } from '../TenantAgent'

describe('TenantAgent', () => {
  test('possible to construct a TenantAgent instance', () => {
    const agent = new Agent({
      config: {
        label: 'test',
        walletConfig: {
          id: 'Wallet: TenantAgentRoot',
          key: 'Wallet: TenantAgentRoot',
        },
      },
      dependencies: agentDependencies,
      modules: {
        indySdk: new IndySdkModule({ indySdk }),
      },
    })

    const tenantDependencyManager = agent.dependencyManager.createChild()

    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('TenantAgent'),
      dependencyManager: tenantDependencyManager,
    })
    tenantDependencyManager.registerInstance(AgentContext, agentContext)

    const tenantAgent = new TenantAgent(agentContext)

    expect(tenantAgent).toBeInstanceOf(TenantAgent)
  })
})

import { Agent, AgentContext } from '@aries-framework/core'

import { agentDependencies, getAgentConfig, getAgentContext } from '../../../core/tests/helpers'
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

import { Agent, AgentContext } from '@credo-ts/core'

import { getAgentConfig, getAgentContext, getInMemoryAgentOptions } from '../../../core/tests/helpers'
import { TenantAgent } from '../TenantAgent'

describe('TenantAgent', () => {
  test('possible to construct a TenantAgent instance', () => {
    const agent = new Agent(getInMemoryAgentOptions('TenantAgentRoot'))

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

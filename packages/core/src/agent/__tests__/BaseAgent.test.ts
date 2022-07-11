import type { DependencyManager } from '../../plugins'
import type { AgentConfig } from '../AgentConfig'

import { agentDependencies, getAgentConfig, getAgentContext } from '../../../tests/helpers'
import { Agent } from '../Agent'
import { BaseAgent } from '../BaseAgent'
import { AgentContext } from '../context'

class TestBaseAgent extends BaseAgent {
  public constructor(agentConfig: AgentConfig, dependencyManager: DependencyManager) {
    super(agentConfig, dependencyManager)
  }

  public registerDependencies() {
    // Nothing to do here
  }
}

describe('BaseAgent', () => {
  test('shutdown calls dispose on agent context', async () => {
    const agent = new Agent(
      {
        label: 'test',
        walletConfig: {
          id: 'Wallet: BaseAgent',
          key: 'Wallet: BaseAgent',
        },
      },
      agentDependencies
    )

    const tenantDependencyManager = agent.dependencyManager.createChild()

    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('TestBaseAgent'),
      dependencyManager: tenantDependencyManager,
    })
    tenantDependencyManager.registerInstance(AgentContext, agentContext)

    const disposeSpy = jest.spyOn(agentContext, 'dispose').mockResolvedValue()
    const testBaseAgent = new TestBaseAgent(agentContext.config, agentContext.dependencyManager)
    await testBaseAgent.shutdown()

    expect(disposeSpy).toHaveBeenCalled()
  })
})

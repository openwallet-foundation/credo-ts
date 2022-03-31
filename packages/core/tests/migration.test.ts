import type { VersionString } from '../src/storage/migration/version'

import { Agent } from '../src/agent/Agent'
import { UpdateAssistant } from '../src/storage/migration/UpdateAssistant'

import { getBaseConfig } from './helpers'

const { config, agentDependencies } = getBaseConfig('Migration', { publicDidSeed: undefined, indyLedgers: [] })

describe('migration', () => {
  test('manually initiating the update assistant to perform an update', async () => {
    const agent = new Agent(config, agentDependencies)

    const updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: { mediationRoleUpdateStrategy: 'allMediator' },
    })
    await updateAssistant.initialize()

    if (!(await updateAssistant.isUpToDate())) {
      await updateAssistant.update()
    }

    await agent.initialize()

    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('manually initiating the update, but storing the current framework version outside of the agent storage', async () => {
    // The storage version will normally be stored in e.g. persistent storage on a mobile device
    let currentStorageVersion: VersionString = '0.1'

    const agent = new Agent(config, agentDependencies)

    if (currentStorageVersion !== UpdateAssistant.frameworkStorageVersion) {
      const updateAssistant = new UpdateAssistant(agent, {
        v0_1ToV0_2: { mediationRoleUpdateStrategy: 'recipientIfEndpoint' },
      })
      await updateAssistant.initialize()
      await updateAssistant.update()

      // Store the version so we can leverage it during the next agent startup and don't have
      // to initialize the update assistant again until a new version is released
      currentStorageVersion = UpdateAssistant.frameworkStorageVersion
    }

    await agent.initialize()

    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('Automatic update on agent startup', async () => {
    const agent = new Agent({ ...config, autoUpdateStorageOnStartup: true }, agentDependencies)

    await agent.initialize()
    await agent.shutdown()
    await agent.wallet.delete()
  })
})

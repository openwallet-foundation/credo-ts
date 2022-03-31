# Updating

## Using the Update Assistant

There are three options on how to leverage the update assistant on agent startup:

1. Manually instantiating the update assistant on agent startup
2. Storing the agent storage version outside of the agent storage
3. Automatically update on agent startup

### Manually instantiating the update assistant on agent startup

```ts
import { UpdateAssistant, Agent } from '@aries-framework/core'

// or @aries-framework/node
import { agentDependencies } from '@aries-framework/react-native'

// First create the agent
const agent = new Agent(config, agentDependencies)

// Then initialize the update assistant with the update config
const updateAssistant = new UpdateAssistant(agent, {
  v0_1ToV0_2: {
    mediationRoleUpdateStrategy: 'allMediator',
  },
})

// Initialize the update assistant so we can read the current storage version
// from the wallet. If you manually initialize the wallet you should do this _before_
// calling initialize on the update assistant
// await agent.wallet.initialize(walletConfig)
await updateAssistant.initialize()

// Check if the agent is up to date, if not call update
if (!(await updateAssistant.isUpToDate())) {
  await updateAssistant.update()
}

// Once finished initialize the agent. You should do this on every launch of the agent
await agent.initialize()
```

### Storing the agent storage version outside of the agent storage

```ts
import { UpdateAssistant, Agent } from '@aries-framework/core'

// or @aries-framework/node
import { agentDependencies } from '@aries-framework/react-native'

// The storage version will normally be stored in e.g. persistent storage on a mobile device
let currentStorageVersion: VersionString = '0.1'

// First create the agent
const agent = new Agent(config, agentDependencies)

// We only initialize the update assistant if our stored version is not equal
// to the frameworkStorageVersion of the UpdateAssistant. The advantage of this
// is that we don't have to initialize the UpdateAssistant to retrieve the current
// storage version.
if (currentStorageVersion !== UpdateAssistant.frameworkStorageVersion) {
  const updateAssistant = new UpdateAssistant(agent, {
    v0_1ToV0_2: {
      mediationRoleUpdateStrategy: 'recipientIfEndpoint',
    },
  })

  // Same as with the previous strategy, if you normally call agent.wallet.initialize() manually
  // you need to call this before calling updateAssistant.initialize()
  await updateAssistant.initialize()

  await updateAssistant.update()

  // Store the version so we can leverage it during the next agent startup and don't have
  // to initialize the update assistant again until a new version is released
  currentStorageVersion = UpdateAssistant.frameworkStorageVersion
}

// Once finished initialize the agent. You should do this on every launch of the agent
await agent.initialize()
```

### Automatically update on agent startup

This is by far the easiest way to update the agent, but has the least amount of flexibility and is not configurable. This means you will have to use the default update options to update the agent storage.

```ts
import { UpdateAssistant, Agent } from '@aries-framework/core'

// or @aries-framework/node
import { agentDependencies } from '@aries-framework/react-native'

// First create the agent, setting the autoUpdateStorageOnStartup option to true
const agent = new Agent({ ...config, autoUpdateStorageOnStartup: true }, agentDependencies)

// Then we call initialize, which under the hood will call the update assistant if the storage is not update to date.
await agent.initialize()
```

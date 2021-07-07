# Setup React Native

## Prerequisites

To start using Aries Framework JavaScript in React Native some platform specific dependencies are required.

1. Follow the [React Native Setup](https://reactnative.dev/docs/environment-setup) guide to set up your environment.
2. Add `@aries-framework/core` and `@aries-framework/react-native` to your project.

```bash
yarn add @aries-framework/core @aries-framework/react-native
```

3. Install [Libindy](https://github.com/hyperledger/indy-sdk) for iOS and Android:

   - [iOS](../docs/libindy/ios.md)
   - [Android](../docs/libindy/android.md)

4. If you're using React Native > 0.61.5, make sure you have Hermes enabled, as the app will crash on Android when opening a ledger pool. See the React Native [docs](https://reactnative.dev/docs/hermes) on Hermes on how to enable Hermes.

   - Indy SDK [issue](https://github.com/hyperledger/indy-sdk/issues/2346#issuecomment-841000640)

5. Install React Native polyfills and import them in the `index.js` file:

```bash
yarn add react-native-get-random-values @azure/core-asynciterator-polyfill
```

```js
import 'react-native-get-random-values'
import '@azure/core-asynciterator-polyfill'
```

## TypeScript

If you're using TypeScript in your React Native project you need to install `indy-sdk` types both with and without alias. This is to make sure you have types when importing `rn-indy-sdk`, but also for `indy-sdk` types used by the framework.

```
yarn add -D @types/rn-indy-sdk@npm:@types/indy-sdk @types/indy-sdk
```

### Using decorators

If you intend to extend the core framework capabilities good change you will need to use decorators. In this case you need to enable support for decorators in both TypeScript and Babel.

1. Install `babel-plugin-transform-typescript-metadata` and `@babel/plugin-proposal-decorators`

```sh
yarn add babel-plugin-transform-typescript-metadata @babel/plugin-proposal-decorators
```

2. Add them to your babel config

```js
// babel.config.js
module.exports = {
  // ... other config ... //
  plugins: ['babel-plugin-transform-typescript-metadata', ['@babel/plugin-proposal-decorators', { legacy: true }]],
}
```

3. Enable decorators in your `tsconfig.json`

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    // ... other options ... //
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Agent Setup

Initializing the Agent also requires some React Native specific setup, mainly for the Indy SDK and File System. Below is a sample config, see the [README](../README.md#getting-started) for an overview of getting started guides. If you want to jump right in, check the [Getting Started: Agent](./getting-started/0-agent.md) guide.

```ts
import { Agent } from 'aries-framework/core'
import { agentDependencies } from '@aries-framework/react-native'

// This creates an agent with all the specified configuration data
const agent = new Agent(
  {
    label: 'my-agent',
    walletConfig: { id: 'walletId' },
    walletCredentials: { key: 'testkey0000000000000000000000000' },
  },
  agentDependencies
)

// Make sure to initialize the agent before using it.
try {
  await agent.init()
  console.log('Initialized agent!')
} catch (error) {
  console.log(error)
}
```

<h1 align="center"><b>Extension module example</b></h1>

This example shows how an extension module can be written and injected to an Aries Framework Javascript `Agent` instance. Its structure is similar to the one of regular modules, although is not strictly needed to follow it to achieve this goal.

An extension module could be used for different purposes, such as storing data in an Identity Wallet, supporting custom protocols over Didcomm or implementing new [Aries RFCs](https://github.com/hyperledger/aries-rfcs/tree/main/features) without the need of embed them right into AFJ's Core package. Injected modules can access to other core modules and services and trigger events, so in practice they work much in the same way as if they were included statically.

> **Note** the custom module API is in heavy development and can have regular breaking changes. This is an experimental feature, so use it at your own risk. Over time we will provide a stable API for extension modules.

## Dummy module

This example consists of a module that implements a very simple request-response protocol called Dummy. In order to do so and be able to be injected into an AFJ instance, some steps were followed:

- Define Dummy protocol message classes (inherited from `AgentMessage`)
- Create handlers for those messages (inherited from `Handler`)
- Define records (inherited from `BaseRecord`) and a singleton repository (inherited from `Repository`) for state persistance
- Define events (inherited from `BaseEvent`)
- Create a singleton service class that manages records and repository, and also trigger events using Agent's `EventEmitter`
- Create a singleton api class that registers handlers in Agent's `Dispatcher` and provides a simple API to do requests and responses, with the aid of service classes and Agent's `MessageSender`
- Create a module class that registers all the above on the dependency manager so it can be be injected from the `Agent` instance.

## Usage

In order to use this module, you first need to register `DummyModule` on the `Agent` instance. After that you need to resolve the `DummyApi` to interact with the public api of the module. Make sure to register and resolve the api **before** initializing the agent.

```ts
import { DummyModule, DummyApi } from './dummy'

const agent = new Agent(/** agent config... */)

// Register the module with it's dependencies
agent.dependencyManager.registerModules(new DummyModule())

const dummyApi = agent.dependencyManager.resolve(DummyApi)

await agent.initialize()
```

Then, Dummy module API methods can be called, and events listeners can be created:

```ts
agent.events.on(DummyEventTypes.StateChanged, async (event: DummyStateChangedEvent) => {
  if (event.payload.dummyRecord.state === DummyState.RequestReceived) {
    await dummyApi.respond(event.payload.dummyRecord)
  }
})

const record = await dummyApi.request(connection)
```

## Run demo

This repository includes a demonstration of a requester and a responder controller using this module to exchange Dummy protocol messages. For environment set up, make sure you followed instructions for [NodeJS](https:/aries.js.org/guides/getting-started/prerequisites/nodejs).

These are the steps for running it:

Clone the AFJ git repository:

```sh
git clone https://github.com/hyperledger/aries-framework-javascript.git
```

Open two different terminals and go to the extension-module directory:

```sh
cd aries-framework-javascript/samples/extension-module
```

Install the project in one of the terminals:

```sh
yarn install
```

In that terminal run the responder:

```sh
yarn responder
```

Wait for it to finish the startup process (i.e. logger showing 'Responder listening to port ...') and run requester in another terminal:

```sh
yarn requester
```

If everything goes right, requester will connect to responder and, as soon as connection protocol is finished, it will send a Dummy request. Responder will answer with a Dummy response and requester will happily exit.

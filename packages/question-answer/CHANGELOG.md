# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.3.3](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.2...v0.3.3) (2023-01-18)

### Bug Fixes

- fix typing issues with typescript 4.9 ([#1214](https://github.com/hyperledger/aries-framework-javascript/issues/1214)) ([087980f](https://github.com/hyperledger/aries-framework-javascript/commit/087980f1adf3ee0bc434ca9782243a62c6124444))

### Features

- **indy-sdk:** add indy-sdk package ([#1200](https://github.com/hyperledger/aries-framework-javascript/issues/1200)) ([9933b35](https://github.com/hyperledger/aries-framework-javascript/commit/9933b35a6aa4524caef8a885e71b742cd0d7186b))

## [0.3.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.1...v0.3.2) (2023-01-04)

**Note:** Version bump only for package @aries-framework/question-answer

## [0.3.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.0...v0.3.1) (2022-12-27)

**Note:** Version bump only for package @aries-framework/question-answer

# [0.3.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.5...v0.3.0) (2022-12-22)

- refactor!: rename Handler to MessageHandler (#1161) ([5e48696](https://github.com/hyperledger/aries-framework-javascript/commit/5e48696ec16d88321f225628e6cffab243718b4c)), closes [#1161](https://github.com/hyperledger/aries-framework-javascript/issues/1161)
- feat(action-menu)!: move to separate package (#1049) ([e0df0d8](https://github.com/hyperledger/aries-framework-javascript/commit/e0df0d884b1a7816c7c638406606e45f6e169ff4)), closes [#1049](https://github.com/hyperledger/aries-framework-javascript/issues/1049)
- feat(question-answer)!: separate logic to a new module (#1040) ([97d3073](https://github.com/hyperledger/aries-framework-javascript/commit/97d3073aa9300900740c3e8aee8233d38849293d)), closes [#1040](https://github.com/hyperledger/aries-framework-javascript/issues/1040)

### BREAKING CHANGES

- Handler has been renamed to MessageHandler to be more descriptive, along with related types and methods. This means:

Handler is now MessageHandler
HandlerInboundMessage is now MessageHandlerInboundMessage
Dispatcher.registerHandler is now Dispatcher.registerMessageHandlers

- action-menu module has been removed from the core and moved to a separate package. To integrate it in an Agent instance, it can be injected in constructor like this:

```ts
const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    actionMenu: new ActionMenuModule(),
    /* other custom modules */
  },
})
```

Then, module API can be accessed in `agent.modules.actionMenu`.

- question-answer module has been removed from the core and moved to a separate package. To integrate it in an Agent instance, it can be injected in constructor like this:

```ts
const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    questionAnswer: new QuestionAnswerModule(),
    /* other custom modules */
  },
})
```

Then, module API can be accessed in `agent.modules.questionAnswer`.

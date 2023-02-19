<p align="center">
  <br />
  <img
    alt="Hyperledger Aries logo"
    src="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/aa31131825e3331dc93694bc58414d955dcb1129/images/aries-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Aries Framework JavaScript Question Answer Module</b></h1>
<p align="center">
  <a
    href="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"
  /></a>
  <a href="https://www.typescriptlang.org/"
    ><img
      alt="typescript"
      src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg"
  /></a>
    <a href="https://www.npmjs.com/package/@aries-framework/question-answer"
    ><img
      alt="@aries-framework/question-answer version"
      src="https://img.shields.io/npm/v/@aries-framework/question-answer"
  /></a>

</p>
<br />

Question Answer module for [Aries Framework JavaScript](https://github.com/hyperledger/aries-framework-javascript.git). Implements [Aries RFC 0113](https://github.com/hyperledger/aries-rfcs/blob/1795d5c2d36f664f88f5e8045042ace8e573808c/features/0113-question-answer/README.md).

### Installation

Make sure you have set up the correct version of Aries Framework JavaScript according to the AFJ repository. To find out which version of AFJ you need to have installed you can run the following command. This will list the required peer dependency for `@aries-framework/core`.

```sh
npm info "@aries-framework/question-answer" peerDependencies
```

Then add the question-answer module to your project.

```sh
yarn add @aries-framework/question-answer
```

### Quick start

In order for this module to work, we have to inject it into the agent to access agent functionality. See the example for more information.

### Example of usage

```ts
import { QuestionAnswerModule } from '@aries-framework/question-answer'

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

await agent.initialize()

// To send a question to a given connection
await agent.modules.questionAnswer.sendQuestion(connectionId, {
  question: 'Do you want to play?',
  validResponses: [{ text: 'Yes' }, { text: 'No' }],
})

// Questions and Answers are received as QuestionAnswerStateChangedEvent

// To send an answer related to a given question answer record
await agent.modules.questionAnswer.sendAnswer(questionAnswerRecordId, 'Yes')
```

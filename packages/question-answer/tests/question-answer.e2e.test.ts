import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '@aries-framework/core'

import { Agent } from '@aries-framework/core'
import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { getAgentOptions, makeConnection } from '../../core/tests/helpers'
import testLogger from '../../core/tests/logger'

import { waitForQuestionAnswerRecord } from './helpers'

import { QuestionAnswerModule, QuestionAnswerRole, QuestionAnswerState } from '@aries-framework/question-answer'

const bobAgentOptions = getAgentOptions(
  'Bob Question Answer',
  {
    endpoints: ['rxjs:bob'],
  },
  {
    questionAnswer: new QuestionAnswerModule(),
  }
)

const aliceAgentOptions = getAgentOptions(
  'Alice Question Answer',
  {
    endpoints: ['rxjs:alice'],
  },
  {
    questionAnswer: new QuestionAnswerModule(),
  }
)

describe('Question Answer', () => {
  let bobAgent: Agent<{
    questionAnswer: QuestionAnswerModule
  }>
  let aliceAgent: Agent<{
    questionAnswer: QuestionAnswerModule
  }>
  let aliceConnection: ConnectionRecord

  beforeEach(async () => {
    const bobMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:bob': bobMessages,
      'rxjs:alice': aliceMessages,
    }

    bobAgent = new Agent(bobAgentOptions)
    bobAgent.registerInboundTransport(new SubjectInboundTransport(bobMessages))
    bobAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await bobAgent.initialize()

    aliceAgent = new Agent(aliceAgentOptions)

    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()
    ;[aliceConnection] = await makeConnection(aliceAgent, bobAgent)
  })

  afterEach(async () => {
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice sends a question and Bob answers', async () => {
    testLogger.test('Alice sends question to Bob')
    let aliceQuestionAnswerRecord = await aliceAgent.modules.questionAnswer.sendQuestion(aliceConnection.id, {
      question: 'Do you want to play?',
      validResponses: [{ text: 'Yes' }, { text: 'No' }],
    })

    testLogger.test('Bob waits for question from Alice')
    const bobQuestionAnswerRecord = await waitForQuestionAnswerRecord(bobAgent, {
      threadId: aliceQuestionAnswerRecord.threadId,
      state: QuestionAnswerState.QuestionReceived,
    })

    expect(bobQuestionAnswerRecord.questionText).toEqual('Do you want to play?')
    expect(bobQuestionAnswerRecord.validResponses).toEqual([{ text: 'Yes' }, { text: 'No' }])
    testLogger.test('Bob sends answer to Alice')
    await bobAgent.modules.questionAnswer.sendAnswer(bobQuestionAnswerRecord.id, 'Yes')

    testLogger.test('Alice waits until Bob answers')
    aliceQuestionAnswerRecord = await waitForQuestionAnswerRecord(aliceAgent, {
      threadId: aliceQuestionAnswerRecord.threadId,
      state: QuestionAnswerState.AnswerReceived,
    })

    expect(aliceQuestionAnswerRecord.response).toEqual('Yes')

    const retrievedRecord = await aliceAgent.modules.questionAnswer.findById(aliceQuestionAnswerRecord.id)
    expect(retrievedRecord).toMatchObject(
      expect.objectContaining({
        id: aliceQuestionAnswerRecord.id,
        threadId: aliceQuestionAnswerRecord.threadId,
        state: QuestionAnswerState.AnswerReceived,
        role: QuestionAnswerRole.Questioner,
      })
    )
  })
})

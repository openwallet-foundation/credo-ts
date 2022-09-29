import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../../connections/repository'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { getBaseConfig, makeConnection } from '../../../../tests/helpers'
import testLogger from '../../../../tests/logger'
import { Agent } from '../../../agent/Agent'
import { QuestionAnswerRole } from '../QuestionAnswerRole'
import { QuestionAnswerState } from '../models'

import { waitForQuestionAnswerRecord } from './helpers'

const bobConfig = getBaseConfig('Bob Question Answer', {
  endpoints: ['rxjs:bob'],
})

const aliceConfig = getBaseConfig('Alice Question Answer', {
  endpoints: ['rxjs:alice'],
})

describe('Question Answer', () => {
  let bobAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord

  beforeEach(async () => {
    const bobMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:bob': bobMessages,
      'rxjs:alice': aliceMessages,
    }

    bobAgent = new Agent(bobConfig.config, bobConfig.agentDependencies)
    bobAgent.registerInboundTransport(new SubjectInboundTransport(bobMessages))
    bobAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await bobAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
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
    let aliceQuestionAnswerRecord = await aliceAgent.questionAnswer.sendQuestion(aliceConnection.id, {
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
    await bobAgent.questionAnswer.sendAnswer(bobQuestionAnswerRecord.id, 'Yes')

    testLogger.test('Alice waits until Bob answers')
    aliceQuestionAnswerRecord = await waitForQuestionAnswerRecord(aliceAgent, {
      threadId: aliceQuestionAnswerRecord.threadId,
      state: QuestionAnswerState.AnswerReceived,
    })

    expect(aliceQuestionAnswerRecord.response).toEqual('Yes')

    const retrievedRecord = await aliceAgent.questionAnswer.findById(aliceQuestionAnswerRecord.id)
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

import type { ValidResponse } from './models'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { ConnectionService } from '../connections'

import { AnswerMessageHandler, QuestionMessageHandler } from './handlers'
import { QuestionAnswerState } from './models'
import { QuestionAnswerService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class QuestionAnswerModule {
  private questionAnswerService: QuestionAnswerService
  private messageSender: MessageSender
  private connectionService: ConnectionService

  public constructor(
    dispatcher: Dispatcher,
    questionAnswerService: QuestionAnswerService,
    messageSender: MessageSender,
    connectionService: ConnectionService
  ) {
    this.questionAnswerService = questionAnswerService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.registerHandlers(dispatcher)
  }

  /**
   * Create a question message with possible valid responses, then send message to the
   * holder
   * 
   * @param connectionId connection to send the question message to
   * @param question question text included in message
   * @param validResponses array of possible responses to question
   * @param detail optional details for question
   * @returns QuestionAnswer record
   */
  public async sendQuestion(connectionId: string, question: string, validResponses: ValidResponse[], detail?: string) {
    const connection = await this.connectionService.getById(connectionId)

    const { questionMessage, questionAnswerRecord } = await this.questionAnswerService.createQuestion(
      connectionId,
      question,
      validResponses,
      detail
    )
    const outboundMessage = createOutboundMessage(connection, questionMessage)
    await this.messageSender.sendMessage(outboundMessage)

    return questionAnswerRecord
  }

  /**
   * Create an answer message as the holder and send it in response to a question message
   * 
   * @param connectionId connection to send the answer message to
   * @param threadId thread id for the QuestionAnswer record
   * @param response response included in the answer message
   * @returns QuestionAnswer record
   */
  public async sendAnswer(connectionId: string, threadId: string, response: string) {
    const connection = await this.connectionService.getById(connectionId)

    const questionRecord = await this.questionAnswerService.getByThreadAndConnectionId(connectionId, threadId)

    const { answerMessage, questionAnswerRecord } = await this.questionAnswerService.createAnswer(
      questionRecord,
      response
    )

    if (questionAnswerRecord.state === QuestionAnswerState.AnswerSent) {
      const outboundMessage = createOutboundMessage(connection, answerMessage)
      await this.messageSender.sendMessage(outboundMessage)
    } else {
      throw new AriesFrameworkError(`Unable to send message without valid response`)
    }

    return questionAnswerRecord
  }

  /**
   * Get all QuestionAnswer records
   * 
   * @returns list containing all QuestionAnswer records
   */
  public getAll() {
    return this.questionAnswerService.getAll()
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new QuestionMessageHandler(this.questionAnswerService))
    dispatcher.registerHandler(new AnswerMessageHandler(this.questionAnswerService))
  }
}

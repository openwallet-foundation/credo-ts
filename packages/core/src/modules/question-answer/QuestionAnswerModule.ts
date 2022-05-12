import type { ValidResponse } from './models'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections'

import { AnswerMessageHandler, QuestionMessageHandler } from './handlers'
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
   * @param config config for creating question message
   * @returns QuestionAnswer record
   */
  public async sendQuestion(
    connectionId: string,
    config: {
      question: string
      validResponses: ValidResponse[]
      detail?: string
    }
  ) {
    const connection = await this.connectionService.getById(connectionId)

    const { questionMessage, questionAnswerRecord } = await this.questionAnswerService.createQuestion(connectionId, {
      question: config.question,
      validResponses: config.validResponses,
      detail: config?.detail,
    })
    const outboundMessage = createOutboundMessage(connection, questionMessage)
    await this.messageSender.sendMessage(outboundMessage)

    return questionAnswerRecord
  }

  /**
   * Create an answer message as the holder and send it in response to a question message
   *
   * @param questionRecordId the id of the questionAnswer record
   * @param response response included in the answer message
   * @returns QuestionAnswer record
   */
  public async sendAnswer(questionRecordId: string, response: string) {
    const questionRecord = await this.questionAnswerService.getById(questionRecordId)

    const { answerMessage, questionAnswerRecord } = await this.questionAnswerService.createAnswer(
      questionRecord,
      response
    )

    const connection = await this.connectionService.getById(questionRecord.connectionId)

    const outboundMessage = createOutboundMessage(connection, answerMessage)
    await this.messageSender.sendMessage(outboundMessage)

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

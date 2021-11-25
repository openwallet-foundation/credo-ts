import type { QuestionAnswerTags } from './repository/QuestionAnswerRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections'
import { AriesFrameworkError } from '../../error'

import { AnswerMessageHandler, QuestionMessageHandler } from './handlers'
import { QuestionAnswerService } from './services'
import { QuestionAnswerState, ValidResponse } from './models'

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

  public async sendAnswer(connectionId: string, threadId: string, response: string) {
    const connection = await this.connectionService.getById(connectionId)

    const questionRecord = await this.questionAnswerService.getByThreadAndConnectionId(connectionId, threadId)

    const { answerMessage, questionAnswerRecord } = await this.questionAnswerService.createAnswer(
      connectionId,
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
   *
   * @returns
   */
  public getAll() {
    return this.questionAnswerService.getAll()
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new QuestionMessageHandler(this.questionAnswerService))
    dispatcher.registerHandler(new AnswerMessageHandler(this.questionAnswerService))
  }
}

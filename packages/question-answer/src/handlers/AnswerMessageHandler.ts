import type { QuestionAnswerService } from '../services'
import type { Handler, HandlerInboundMessage } from '@aries-framework/core'

import { AnswerMessage } from '../messages'

export class AnswerMessageHandler implements Handler {
  private questionAnswerService: QuestionAnswerService
  public supportedMessages = [AnswerMessage]

  public constructor(questionAnswerService: QuestionAnswerService) {
    this.questionAnswerService = questionAnswerService
  }

  public async handle(messageContext: HandlerInboundMessage<AnswerMessageHandler>) {
    await this.questionAnswerService.receiveAnswer(messageContext)
  }
}

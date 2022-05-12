import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { QuestionAnswerService } from '../services'

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

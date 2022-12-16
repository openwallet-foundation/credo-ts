import type { QuestionAnswerService } from '../services'
import type { MessageHandler, MessageHandlerInboundMessage } from '@aries-framework/core'

import { QuestionMessage } from '../messages'

export class QuestionMessageHandler implements MessageHandler {
  private questionAnswerService: QuestionAnswerService
  public supportedMessages = [QuestionMessage]

  public constructor(questionAnswerService: QuestionAnswerService) {
    this.questionAnswerService = questionAnswerService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<QuestionMessageHandler>) {
    await this.questionAnswerService.processReceiveQuestion(messageContext)
  }
}

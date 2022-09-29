import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { QuestionAnswerService } from '../services'

import { QuestionMessage } from '../messages'

export class QuestionMessageHandler implements Handler {
  private questionAnswerService: QuestionAnswerService
  public supportedMessages = [QuestionMessage]

  public constructor(questionAnswerService: QuestionAnswerService) {
    this.questionAnswerService = questionAnswerService
  }

  public async handle(messageContext: HandlerInboundMessage<QuestionMessageHandler>) {
    await this.questionAnswerService.processReceiveQuestion(messageContext)
  }
}

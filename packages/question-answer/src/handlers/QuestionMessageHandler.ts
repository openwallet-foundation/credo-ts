import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { QuestionAnswerService } from '../services'

import { QuestionMessage } from '../messages'

export class QuestionMessageHandler implements DidCommMessageHandler {
  private questionAnswerService: QuestionAnswerService
  public supportedMessages = [QuestionMessage]

  public constructor(questionAnswerService: QuestionAnswerService) {
    this.questionAnswerService = questionAnswerService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<QuestionMessageHandler>) {
    await this.questionAnswerService.processReceiveQuestion(messageContext)

    return undefined
  }
}

import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { AnswerMessage } from '../messages'
import type { QuestionAnswerService } from '../services'

export class AnswerMessageHandler implements DidCommMessageHandler {
  private questionAnswerService: QuestionAnswerService
  public supportedMessages = [AnswerMessage]

  public constructor(questionAnswerService: QuestionAnswerService) {
    this.questionAnswerService = questionAnswerService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<AnswerMessageHandler>) {
    await this.questionAnswerService.receiveAnswer(messageContext)

    return undefined
  }
}

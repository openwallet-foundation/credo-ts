import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { QuestionAnswerService } from '../services'

import { AriesFrameworkError } from '../../../error'
import { QuestionMessage, AnswerMessage } from '../messages'

export class QuestionMessageHandler implements Handler {
  private questionAnswerService: QuestionAnswerService
  public supportedMessages = [QuestionMessage]

  public constructor(questionAnswerService: QuestionAnswerService) {
    this.questionAnswerService = questionAnswerService
  }

  public async handle(messageContext: HandlerInboundMessage<QuestionMessageHandler>) {
    await this.questionAnswerService.receiveQuestion(messageContext)
  }
}

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

import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'

import { ProblemReportMessage } from '../messages'

export class ProblemReportV1Handler implements Handler {
  private readonly logger: Logger
  public supportedMessages = [ProblemReportMessage]

  public constructor(logger: Logger) {
    this.logger = logger.createContextLogger('ProblemReportV1Handler')
  }

  public async handle(messageContext: HandlerInboundMessage<ProblemReportV1Handler>) {
    this.logger.error('Received problem report message', messageContext.message)
  }
}

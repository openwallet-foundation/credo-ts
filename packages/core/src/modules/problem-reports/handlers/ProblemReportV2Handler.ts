import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'

import { ProblemReportV2Message } from '../messages'

export class ProblemReportV2Handler implements Handler {
  private readonly logger: Logger
  public supportedMessages = [ProblemReportV2Message]

  public constructor(logger: Logger) {
    this.logger = logger.createContextLogger('ProblemReportV2Handler')
  }

  public async handle(messageContext: HandlerInboundMessage<ProblemReportV2Handler>) {
    this.logger.error('Received problem report message', messageContext.message)
  }
}

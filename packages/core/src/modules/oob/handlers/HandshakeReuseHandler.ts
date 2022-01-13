import type { Handler } from '../../../agent/Handler'
import type { Logger } from '../../../logger'

import { HandshakeReuseMessage } from '../messages/HandshakeReuseMessage'

export class HandshakeReuseHandler implements Handler {
  public supportedMessages = [HandshakeReuseMessage]
  private logger: Logger

  public constructor(logger: Logger) {
    this.logger = logger
  }

  public async handle() {
    this.logger.error(`Out of band ${HandshakeReuseMessage.type} message not implemented yet.`)
  }
}

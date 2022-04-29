import type { Handler, HandlerInboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { BasicMessageService } from '../services/BasicMessageService'

import { AriesFrameworkError } from '../../../error'
import { BasicMessage } from '../messages'

export class BasicMessageHandler implements Handler {
  private basicMessageService: BasicMessageService
  public supportedMessages = [BasicMessage]

  public constructor(basicMessageService: BasicMessageService) {
    this.basicMessageService = basicMessageService
  }

  public async handle(messageContext: HandlerInboundMessage<BasicMessageHandler>) {
    const connection = messageContext.connection

    if (!connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipient} not found!`)
    }

    if (!connection.theirKey) {
      throw new AriesFrameworkError(`Connection with verkey ${connection.verkey} has no recipient keys.`)
    }

    await this.basicMessageService.save(messageContext, connection)
  }
}

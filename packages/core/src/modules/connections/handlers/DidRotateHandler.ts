import type { MessageHandler, MessageHandlerInboundMessage } from '../../../agent/MessageHandler'
import type { DidRotateService } from '../services'
import type { ConnectionService } from '../services/ConnectionService'

import { AriesFrameworkError } from '../../../error'
import { DidRotateMessage } from '../messages'

export class DidRotateHandler implements MessageHandler {
  private didRotateService: DidRotateService
  private connectionService: ConnectionService
  public supportedMessages = [DidRotateMessage]

  public constructor(didRotateService: DidRotateService, connectionService: ConnectionService) {
    this.didRotateService = didRotateService
    this.connectionService = connectionService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<DidRotateHandler>) {
    const { connection, recipientKey } = messageContext
    if (!connection) {
      throw new AriesFrameworkError(`Connection for verkey ${recipientKey?.fingerprint} not found!`)
    }

    return this.didRotateService.processRotate(messageContext)
  }
}

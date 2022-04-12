import type { Handler } from '../../../agent/Handler'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { MediatorService } from '../services'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../agent/helpers'
import { StatusMessage } from '../messages/StatusMessage'

export class StatusHandler implements Handler {
  public supportedMessages = [StatusMessage]
  private mediatorService: MediatorService

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: InboundMessageContext<StatusMessage>) {
    const deliveryRequestMessage = this.mediatorService.processStatus(messageContext.message)
    const connection = messageContext.connection

    const websocketSchemes = ['ws', 'wss']
    const websocketServices = connection?.theirDidDoc?.didCommServices.filter((s) =>
      websocketSchemes.includes(s.protocolScheme)
    )

    if (connection && deliveryRequestMessage) {
      // Check to see if websockets are supported and try to use them first
      if (websocketServices && websocketServices[0] && connection.myKey) {
        return createOutboundServiceMessage({
          payload: deliveryRequestMessage,
          service: websocketServices[0],
          senderKey: connection.myKey,
        })
      } else {
        return createOutboundMessage(connection, deliveryRequestMessage)
      }
    }
  }
}

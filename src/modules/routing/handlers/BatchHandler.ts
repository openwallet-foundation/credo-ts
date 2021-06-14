import { EventEmitter } from '../../../agent/EventEmitter'
import { AgentEventTypes, AgentMessageReceivedEvent } from '../../../agent/Events'
import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { AriesFrameworkError } from '../../../error'

import { BatchMessage } from '../messages'

export class BatchHandler implements Handler {
  private eventEmitter: EventEmitter
  public supportedMessages = [BatchMessage]

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public async handle(messageContext: HandlerInboundMessage<BatchHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    const { message } = messageContext
    console.log("batch pickup handler called.",JSON.stringify(message))
    const forwardedMessages = message.messages
    console.log(JSON.stringify(forwardedMessages))
    forwardedMessages.forEach((message) => {
      console.log(JSON.stringify(message.message))
      this.eventEmitter.emit<AgentMessageReceivedEvent>({
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: message.message,
        },
      })
    })
  }
}

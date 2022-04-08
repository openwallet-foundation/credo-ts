import { createOutboundMessage } from '../../../agent/helpers'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext';
import type { Handler } from '../../../agent/Handler'
import { MessageDeliveryMessage } from '../messages'
import { MediatorService } from '../services'
import { MessageReceiver } from 'packages/core/src/agent/MessageReceiver';

export class MessageDeliveryHandler implements Handler{
    public supportedMessages = [MessageDeliveryMessage]
    private mediatorService: MediatorService
    private messageReceiver: MessageReceiver

    public constructor(mediatorService: MediatorService, messageReceiver: MessageReceiver){
        this.mediatorService = mediatorService
        this.messageReceiver = messageReceiver
    }

    public async handle(messageContext: InboundMessageContext<MessageDeliveryMessage>){
        const deliveryReceivedMessage = await this.mediatorService.processDelivery(messageContext.message, this.messageReceiver)
        const connection = messageContext.connection

        if(connection && deliveryReceivedMessage){
            return createOutboundMessage(connection, deliveryReceivedMessage)
        }
    }
}
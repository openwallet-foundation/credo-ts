import type { EncryptedMessage } from '../../../agent/didcomm/types'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { BatchPickupMessageV2 } from '../messages'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { InjectionSymbols } from '../../../constants'
import { MessageRepository } from '../../../storage/MessageRepository'
import { uuid } from '../../../utils/uuid'
import { BatchMessageItemV2, BatchMessageV2 } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class MessagePickupService {
  private messageRepository: MessageRepository

  public constructor(@inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository) {
    this.messageRepository = messageRepository
  }

  public async batch(messageContext: InboundMessageContext<BatchPickupMessageV2>) {
    // Assert ready connection

    const { message } = messageContext
    if (!message.from) return
    const messages = this.messageRepository.takeFromQueue(message.from, message.body.batchSize)

    // TODO: each message should be stored with an id. to be able to conform to the id property
    // of batch message
    const batchMessages = messages.map(
      (msg) =>
        new BatchMessageItemV2({
          message: BatchMessageV2.createJSONAttachment(uuid(), msg),
        })
    )

    const batchMessage = new BatchMessageV2({
      from: message.from,
      body: {
        messages: batchMessages,
      },
    })

    return createOutboundDIDCommV2Message(batchMessage)
  }

  public queueMessage(connectionId: string, message: EncryptedMessage) {
    this.messageRepository.add(connectionId, message)
  }
}

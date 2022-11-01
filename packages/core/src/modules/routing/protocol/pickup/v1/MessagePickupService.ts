import type { EncryptedMessage } from '../../../../../agent/didcomm/types'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { BatchPickupMessageV2 } from './messages'

import { InjectionSymbols } from '../../../../../constants'
import { injectable, inject } from '../../../../../plugins'
import { MessageRepository } from '../../../../../storage/MessageRepository'
import { uuid } from '../../../../../utils/uuid'

import { BatchAckMessageV2, BatchMessageItemV2, BatchMessageV2 } from './messages'

@injectable()
export class MessagePickupService {
  private messageRepository: MessageRepository

  public constructor(@inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository) {
    this.messageRepository = messageRepository
  }

  public async batch(messageContext: InboundMessageContext<BatchPickupMessageV2>) {
    // Assert ready connection

    const { message } = messageContext
    if (!message.from) return
    const messages = await this.messageRepository.takeFromQueue(message.from, message.body.batchSize)

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

    return batchMessage
  }

  public async generateAckResponse(messageContext: InboundMessageContext<BatchMessageV2>) {
    const { message } = messageContext
    if (!message.from || !message.to) return

    const recievedIds = message.body.messages.flatMap((a) => (a.id ? [a.id] : []))
    const ackMessage = new BatchAckMessageV2({
      from: message.to[0],
      to: message.from,
      ack: recievedIds,
    })

    return ackMessage
  }

  public queueMessage(connectionId: string, message: EncryptedMessage) {
    void this.messageRepository.add(connectionId, message)
  }
}

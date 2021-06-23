import type { ConnectionRecord } from '../../connections'
import type{ MessageRepository } from '../../../storage/MessageRepository'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InboundConnection, WireMessage } from '../../../types'
import { createOutboundMessage } from '../../../agent/helpers'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { BatchMessage, BatchMessageMessage, BatchPickupMessage } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class MessagePickupService {
  private messageRepository: MessageRepository

  public constructor(@inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository) {
    this.messageRepository = messageRepository
  }

  public async batchPickup(inboundConnection: InboundConnection) {
    const batchPickupMessage = new BatchPickupMessage({
      batchSize: 10,
    })

    return createOutboundMessage(inboundConnection.connection, batchPickupMessage)
  }

  // TODO: add support for batchSize property
  public async batch(connection: ConnectionRecord) {
    if (!this.messageRepository) {
      throw new AriesFrameworkError('There is no message repository.')
    }
    if (!connection.theirKey) {
      throw new AriesFrameworkError('Trying to find messages to connection without theirKey!')
    }

    const messages = this.messageRepository.findByVerkey(connection.theirKey)
    // TODO: fix race condition, messages can be deleted before they are ever returned from repo.
    // TODO-continue: to fix this each message will need to be removed by id from repo after succesful pick reported
    this.messageRepository.deleteAllByVerkey(connection.theirKey) // TODO Maybe, don't delete, but just marked them as read

    // TODO: each message should be stored with an id. to be able to conform to the id property
    // of batch message
    const batchMessages = messages.map(
      (msg) =>
        new BatchMessageMessage({
          message: msg,
        })
    )

    const batchMessage = new BatchMessage({
      messages: batchMessages,
    })

    return createOutboundMessage(connection, batchMessage)
  }

  public queueMessage(theirKey: string, message: WireMessage) {
    this.messageRepository.save(theirKey, message)
  }
}

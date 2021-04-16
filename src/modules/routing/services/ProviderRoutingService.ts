import type { Verkey } from 'indy-sdk'
import { OutboundMessage } from '../../../types'
import { createOutboundMessage } from '../../../agent/helpers'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { ConnectionRecord } from '../../connections'
import {
  KeylistUpdateMessage,
  KeylistUpdateAction,
  ForwardMessage,
  KeylistUpdated,
  KeylistUpdateResponseMessage,
  KeylistUpdateResult,
} from '../messages'

export interface RoutingTable {
  [recipientKey: string]: ConnectionRecord | undefined
}

class ProviderRoutingService {
  private routingTable: RoutingTable = {}

  public updateRoutes(messageContext: InboundMessageContext<KeylistUpdateMessage>): KeylistUpdateResponseMessage {
    const { connection, message } = messageContext

    if (!connection) {
      // TODO We could eventually remove this check if we do it at some higher level where we create messageContext that must have a connection.
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    const updated = []

    for (const update of message.updates) {
      switch (update.action) {
        case KeylistUpdateAction.add:
          this.saveRoute(update.recipientKey, connection)
          break
        case KeylistUpdateAction.remove:
          this.removeRoute(update.recipientKey, connection)
          break
      }

      updated.push(
        new KeylistUpdated({
          action: update.action,
          recipientKey: update.recipientKey,
          result: KeylistUpdateResult.Success,
        })
      )
    }

    return new KeylistUpdateResponseMessage({ updated })
  }

  public forward(messageContext: InboundMessageContext<ForwardMessage>): OutboundMessage<ForwardMessage> {
    const { message, recipientVerkey } = messageContext

    // TODO: update to class-validator validation
    if (!message.to) {
      throw new Error('Invalid Message: Missing required attribute "to"')
    }

    const connection = this.findRecipient(message.to)

    if (!connection) {
      throw new Error(`Connection for verkey ${recipientVerkey} not found!`)
    }

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`)
    }

    return createOutboundMessage(connection, message)
  }

  public getRoutes() {
    return this.routingTable
  }

  public findRecipient(recipientKey: Verkey) {
    const connection = this.routingTable[recipientKey]

    // TODO: function with find in name should now throw error when not found.
    // It should either be called getRecipient and throw error
    // or findRecipient and return null
    if (!connection) {
      throw new Error(`Routing entry for recipientKey ${recipientKey} does not exists.`)
    }

    return connection
  }

  public saveRoute(recipientKey: Verkey, connection: ConnectionRecord) {
    if (this.routingTable[recipientKey]) {
      throw new Error(`Routing entry for recipientKey ${recipientKey} already exists.`)
    }

    this.routingTable[recipientKey] = connection
  }

  public removeRoute(recipientKey: Verkey, connection: ConnectionRecord) {
    const storedConnection = this.routingTable[recipientKey]

    if (!storedConnection) {
      throw new Error('Cannot remove non-existing routing entry')
    }

    if (storedConnection.id !== connection.id) {
      throw new Error('Cannot remove routing entry for another connection')
    }

    delete this.routingTable[recipientKey]
  }
}

export { ProviderRoutingService }

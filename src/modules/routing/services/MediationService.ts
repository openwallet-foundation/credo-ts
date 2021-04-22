import { Verkey } from 'indy-sdk'
import EventEmitter from 'node:events'
import { Logger } from 'tslog'
import {
  MediationRecord,
  KeylistUpdateMessage,
  KeylistUpdateAction,
  ForwardMessage,
  KeylistUpdateResponseMessage,
  KeylistUpdateResult,
  KeylistUpdated,
} from '..'
import { AgentConfig } from '../../../agent/AgentConfig'
import { createOutboundMessage } from '../../../agent/helpers'
import { MessageSender } from '../../../agent/MessageSender'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { Repository } from '../../../storage/Repository'
import { OutboundMessage } from '../../../types'
import { ConnectionRecord } from '../../connections'

export interface RoutingTable {
  [recipientKey: string]: ConnectionRecord | undefined
}

export class MediationService {
  private agentConfig: AgentConfig
  private mediationRepository: Repository<MediationRecord>
  private messageSender: MessageSender
  // Mediation record is a mapping of connection id to recipient keylist
  // This implies that there's a single mediation record per connection

  // TODO: Review this, placeholder
  public constructor(
    agentConfig: AgentConfig,
    mediationRepository: Repository<MediationRecord>,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.mediationRepository = mediationRepository
    this.messageSender = messageSender
  }

  public create(_provisioningProps: { connectionId: string; recipientKey: string }): string {
    return 'Method not implemented.'
  }

  public async find(mediatorId: string): Promise<string | MediationRecord> {
    try {
      const connection = await this.mediationRepository.find(mediatorId)

      return connection
    } catch {
      return 'No mediator found for ID'
      //  TODO - Make this better
    }
  }

  public fetchMediatorById(mediatorId: string): string {
    const mediator = 'DummyMediator'
    return mediator
  }

  // Copied from old Service

  private routingTable: RoutingTable = {}

  /**
   * @todo use connection from message context
   */
  public updateRoutes(messageContext: InboundMessageContext<KeylistUpdateMessage>, connection: ConnectionRecord) {
    const { message } = messageContext
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

export interface MediationProps {
  connectionRecord: ConnectionRecord
}

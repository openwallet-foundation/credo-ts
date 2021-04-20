import type { Verkey } from 'indy-sdk'
import { createOutboundMessage } from '../../../agent/helpers'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import { KeylistUpdateMessage, KeylistUpdate, KeylistUpdateAction, ForwardMessage } from '../messages'
import { Logger } from '../../../logger'
import { EventEmitter } from 'events'
import { MediationRecipientRecord } from '../repository/MediationRecipientRecord'
import { Repository } from '../../../storage/Repository'
import { ConnectionInvitationMessage, ConnectionRecord } from '../../connections'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { OutboundMessage } from '../../../types'

export enum MediationRecipientEventType {
  Granted = 'GRANTED',
  Denied = 'DENIED',
  KeylistUpdated = 'KEYLIST_UPDATED',
}

export class MediationRecipientService extends EventEmitter {
  // TODO: Review this, placeholder
  private logger: Logger
  private agentConfig: AgentConfig
  private mediationRecipientRepository: Repository<MediationRecipientRecord>
  private messageSender: MessageSender

  // TODO: Review this, placeholder
  public constructor(
    agentConfig: AgentConfig,
    mediationRecipientRepository: Repository<MediationRecipientRecord>,
    messageSender: MessageSender
  ) {
    super()
    this.agentConfig = agentConfig
    this.logger = agentConfig.logger
    this.mediationRecipientRepository = mediationRecipientRepository
    this.messageSender = messageSender
  }

  public async createRoute(verkey: Verkey) {
    this.logger.debug(`Registering route for verkey '${verkey}' at mediator`)

    if (!this.agentConfig.inboundConnection) {
      this.logger.debug(`There is no mediator. Creating route for verkey '${verkey}' skipped.`)
    } else {
      const routingConnection = this.agentConfig.inboundConnection.connection

      const keylistUpdateMessage = new KeylistUpdateMessage({
        updates: [
          new KeylistUpdate({
            action: KeylistUpdateAction.add,
            recipientKey: verkey,
          }),
        ],
      })

      const outboundMessage = createOutboundMessage(routingConnection, keylistUpdateMessage)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }

  // // TODO: Review this, placeholder
  // public async requestMediation(connectionRecord: ConnectionRecord): Promise<MediationRecipientRecord> {
  //   // Ensure that the connection is complete (check state) (validate, assert state)
  //   // Send mediation request message
  //   // create mediation recipient record and then return it.
  //   return new MediationRecipientRecord();
  // }

  // recieve and handle the "granted" response from the mediator
  public handleGranted() {
    this.emit(MediationRecipientEventType.Granted)
  }

  // recieve and handle the "denied" response from the mediator.
  public handleDenied() {
    this.emit(MediationRecipientEventType.Denied)
  }

  // Do we want to create a Mediator type?

  public async find(mediatorId: string): Promise<string | MediationRecipientRecord> {
    try {
      const connection = await this.mediationRecipientRepository.find(mediatorId)

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

    for (const update of message.updates) {
      switch (update.action) {
        case KeylistUpdateAction.add:
          this.saveRoute(update.recipientKey, connection)
          break
        case KeylistUpdateAction.remove:
          this.removeRoute(update.recipientKey, connection)
          break
      }
    }
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

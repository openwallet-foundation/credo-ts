import type { Verkey } from 'indy-sdk'
import { createOutboundMessage } from '../../../agent/helpers'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import { KeylistUpdateMessage, KeylistUpdate, KeylistUpdateAction, ForwardMessage, MediationGrantedMessage, MediationDeniedMessage } from '../messages'
import { Logger } from '../../../logger'
import { EventEmitter } from 'events'
import { Repository } from '../../../storage/Repository'
import { ConnectionInvitationMessage, ConnectionRecord } from '../../connections'
import { RoutingTable } from './MediationService'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { OutboundMessage } from '../../../types'
import { isIndyError } from '../../../utils/indyError'
import { MediationProps, MediationRecord } from '..'

export enum MediationEventType {
  Granted = 'GRANTED',
  Denied = 'DENIED',
  KeylistUpdated = 'KEYLIST_UPDATED',
}

export class MediationRecipientService extends EventEmitter {
  // TODO: Review this, placeholder
  private logger: Logger
  private agentConfig: AgentConfig
  private mediationRecipientRepository: Repository<MediationRecord>
  private messageSender: MessageSender

  // TODO: Review this, placeholder
  public constructor(
    agentConfig: AgentConfig,
    mediationRecipientRepository: Repository<MediationRecord>,
    messageSender: MessageSender
  ) {
    super()
    this.agentConfig = agentConfig
    this.logger = agentConfig.logger
    this.mediationRecipientRepository = mediationRecipientRepository
    this.messageSender = messageSender
    this.provision()
  }
  private provision() {
    // Using agent config, establish connection with mediator.
    // Send mediation request.
    // Upon granting, set as default mediator.
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
    this.emit(MediationEventType.Granted)
  }

  // recieve and handle the "denied" response from the mediator.
  public handleDenied() {
    this.emit(MediationEventType.Denied)
  }

  // Do we want to create a Mediator type?

  public async find(mediatorId: string): Promise<string | MediationRecord | null> {
    try {
      const connection = await this.mediationRecipientRepository.find(mediatorId)

      return connection
    } catch (error) {
      if (isIndyError(error, 'WalletItemNotFound')) {
        this.logger.debug(`Mediation recipient record with id '${mediatorId}' not found.`, {
          indyError: 'WalletItemNotFound',
        })
        return null
      } else {
        throw error
      }
    }
  }

  // Adding empty methods
  public getDefaultMediatorId() {
    // The default mediator id
  }
  public getDefaultMediator() {
    // The default mediator
  }

  public setDefaultMediator(mediatorId: string) {
    // The default mediator
  }

  public clearDefaultMediator() {
    // The default mediator
  }

  public prepareKeylistUpdateMessage(
    action: KeylistUpdateAction,
    recipientKey: Verkey,
    message?: KeylistUpdateMessage
  ) {
    // The default mediator
  }

  public storeKeylistUpdateResults() {
    // Method here
  }
  public prepareKeylistQuery(filter: map, paginateLimit: int = -1, paginateOffset: int = 0){
    // Method here
  }

  public prepareRequest(connectionId: string, mediatorTerms: [string], recipientTerms: [string]) {
    // The default mediator
  }

  public reqeustGranted(mediationRecord: MediationRecord, grant: MediationGrantedMessage) {
    // The default mediator
  }

  public reqeustDenied(mediationRecord: MediationRecord, deny: MediationDeniedMessage) {
    // The default mediator
  }

  public getDefaultMediatorById(mediatorId: string) {
    // The default mediator
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
  // Taken from Provisioning Service
  public async create(connectionRecord: ConnectionRecord): Promise<MediationRecord> {
    const mediationRecord = new MediationRecord({
      connectionRecord,
    })
    await this.mediationRecipientRepository.save(mediationRecord)
    return mediationRecord
  }

  //  Taken from ConsumerRoutingService
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

interface MediationRecipientProps {
  mediatorConnectionId: string
  mediatorPublicVerkey: Verkey
}

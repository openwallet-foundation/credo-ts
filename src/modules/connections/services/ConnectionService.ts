import type { Verkey } from 'indy-sdk'
import { EventEmitter } from 'events'
import { validateOrReject } from 'class-validator'

import { AgentConfig } from '../../../agent/AgentConfig'
import { ConnectionRecord, ConnectionTags } from '../repository/ConnectionRecord'
import { Repository } from '../../../storage/Repository'
import { Wallet } from '../../../wallet/Wallet'
import {
  ConnectionInvitationMessage,
  ConnectionRequestMessage,
  ConnectionResponseMessage,
  TrustPingMessage,
} from '../messages'
import { AckMessage } from '../../common'
import { signData, unpackAndVerifySignatureDecorator } from '../../../decorators/signature/SignatureDecoratorUtils'
import {
  Connection,
  ConnectionState,
  ConnectionRole,
  DidDoc,
  Ed25119Sig2018,
  IndyAgentService,
  authenticationTypes,
  ReferencedAuthentication,
} from '../models'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { AgentMessage } from '../../../agent/AgentMessage'

export enum ConnectionEventType {
  StateChanged = 'stateChanged',
}

export interface ConnectionStateChangedEvent {
  connectionRecord: ConnectionRecord
  previousState: ConnectionState | null
}

export interface ConnectionProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  connectionRecord: ConnectionRecord
}

export class ConnectionService extends EventEmitter {
  private wallet: Wallet
  private config: AgentConfig
  private connectionRepository: Repository<ConnectionRecord>

  public constructor(wallet: Wallet, config: AgentConfig, connectionRepository: Repository<ConnectionRecord>) {
    super()
    this.wallet = wallet
    this.config = config
    this.connectionRepository = connectionRepository
  }

  /**
   * Create a new connection record containing a connection invitation message
   *
   * @param config config for creation of connection and invitation
   * @returns new connection record
   */
  public async createInvitation(config?: {
    autoAcceptConnection?: boolean
    alias?: string
  }): Promise<ConnectionProtocolMsgReturnType<ConnectionInvitationMessage>> {
    // TODO: public did, multi use
    const connectionRecord = await this.createConnection({
      role: ConnectionRole.Inviter,
      state: ConnectionState.Invited,
      alias: config?.alias,
      autoAcceptConnection: config?.autoAcceptConnection,
    })

    const { didDoc } = connectionRecord
    const [service] = didDoc.getServicesByClassType(IndyAgentService)
    const invitation = new ConnectionInvitationMessage({
      label: this.config.label,
      recipientKeys: service.recipientKeys,
      serviceEndpoint: service.serviceEndpoint,
      routingKeys: service.routingKeys,
    })

    connectionRecord.invitation = invitation

    await this.connectionRepository.update(connectionRecord)

    const event: ConnectionStateChangedEvent = {
      connectionRecord: connectionRecord,
      previousState: null,
    }
    this.emit(ConnectionEventType.StateChanged, event)

    return { connectionRecord: connectionRecord, message: invitation }
  }

  /**
   * Process a received invitation message. This will not accept the invitation
   * or send an invitation request message. It will only create a connection record
   * with all the information about the invitation stored. Use {@link ConnectionService#createRequest}
   * after calling this function to create a connection request.
   *
   * @param invitation the invitation message to process
   * @returns new connection record.
   */
  public async processInvitation(
    invitation: ConnectionInvitationMessage,
    config?: {
      autoAcceptConnection?: boolean
      alias?: string
    }
  ): Promise<ConnectionRecord> {
    const connectionRecord = await this.createConnection({
      role: ConnectionRole.Invitee,
      state: ConnectionState.Invited,
      alias: config?.alias,
      autoAcceptConnection: config?.autoAcceptConnection,
      invitation,
      tags: {
        invitationKey: invitation.recipientKeys && invitation.recipientKeys[0],
      },
    })

    await this.connectionRepository.update(connectionRecord)

    const event: ConnectionStateChangedEvent = {
      connectionRecord: connectionRecord,
      previousState: null,
    }
    this.emit(ConnectionEventType.StateChanged, event)

    return connectionRecord
  }

  /**
   * Create a connection request message for the connection with the specified connection id.
   *
   * @param connectionId the id of the connection for which to create a connection request
   * @returns outbound message containing connection request
   */
  public async createRequest(connectionId: string): Promise<ConnectionProtocolMsgReturnType<ConnectionRequestMessage>> {
    const connectionRecord = await this.connectionRepository.find(connectionId)

    connectionRecord.assertState(ConnectionState.Invited)
    connectionRecord.assertRole(ConnectionRole.Invitee)

    const connectionRequest = new ConnectionRequestMessage({
      label: this.config.label,
      did: connectionRecord.did,
      didDoc: connectionRecord.didDoc,
    })

    await this.updateState(connectionRecord, ConnectionState.Requested)

    return {
      connectionRecord: connectionRecord,
      message: connectionRequest,
    }
  }

  /**
   * Process a received connection request message. This will not accept the connection request
   * or send a connection response message. It will only update the existing connection record
   * with all the new information from the connection request message. Use {@link ConnectionService#createResponse}
   * after calling this function to create a connection respone.
   *
   * @param messageContext the message context containing a connetion request message
   * @returns updated connection record
   */
  public async processRequest(
    messageContext: InboundMessageContext<ConnectionRequestMessage>
  ): Promise<ConnectionRecord> {
    const { message, connection: connectionRecord, recipientVerkey } = messageContext

    if (!connectionRecord) {
      throw new Error(`Connection for verkey ${recipientVerkey} not found!`)
    }

    connectionRecord.assertState(ConnectionState.Invited)
    connectionRecord.assertRole(ConnectionRole.Inviter)

    // TODO: validate using class-validator
    if (!message.connection) {
      throw new Error('Invalid message')
    }

    connectionRecord.theirDid = message.connection.did
    connectionRecord.theirDidDoc = message.connection.didDoc

    if (!connectionRecord.theirKey) {
      throw new Error(`Connection with id ${connectionRecord.id} has no recipient keys.`)
    }

    connectionRecord.tags = {
      ...connectionRecord.tags,
      theirKey: connectionRecord.theirKey,
      threadId: message.id,
    }

    await this.updateState(connectionRecord, ConnectionState.Requested)

    return connectionRecord
  }

  /**
   * Create a connection response message for the connection with the specified connection id.
   *
   * @param connectionId the id of the connection for which to create a connection response
   * @returns outbound message contaning connection response
   */
  public async createResponse(
    connectionId: string
  ): Promise<ConnectionProtocolMsgReturnType<ConnectionResponseMessage>> {
    const connectionRecord = await this.connectionRepository.find(connectionId)

    connectionRecord.assertState(ConnectionState.Requested)
    connectionRecord.assertRole(ConnectionRole.Inviter)

    const connection = new Connection({
      did: connectionRecord.did,
      didDoc: connectionRecord.didDoc,
    })

    const connectionJson = JsonTransformer.toJSON(connection)

    const connectionResponse = new ConnectionResponseMessage({
      threadId: connectionRecord.tags.threadId!,
      connectionSig: await signData(connectionJson, this.wallet, connectionRecord.verkey),
    })

    await this.updateState(connectionRecord, ConnectionState.Responded)

    return {
      connectionRecord: connectionRecord,
      message: connectionResponse,
    }
  }

  /**
   * Process a received connection response message. This will not accept the connection request
   * or send a connection acknowledgement message. It will only update the existing connection record
   * with all the new information from the connection response message. Use {@link ConnectionService#createTrustPing}
   * after calling this function to create a trust ping message.
   *
   * @param messageContext the message context containing a connetion response message
   * @returns updated connection record
   */
  public async processResponse(
    messageContext: InboundMessageContext<ConnectionResponseMessage>
  ): Promise<ConnectionRecord> {
    const { message, connection: connectionRecord, recipientVerkey } = messageContext

    if (!connectionRecord) {
      throw new Error(`Connection for verkey ${recipientVerkey} not found!`)
    }
    connectionRecord.assertState(ConnectionState.Requested)
    connectionRecord.assertRole(ConnectionRole.Invitee)

    const connectionJson = await unpackAndVerifySignatureDecorator(message.connectionSig, this.wallet)

    const connection = JsonTransformer.fromJSON(connectionJson, Connection)
    // TODO: throw framework error stating the connection object is invalid
    await validateOrReject(connection)

    // Per the Connection RFC we must check if the key used to sign the connection~sig is the same key
    // as the recipient key(s) in the connection invitation message
    const signerVerkey = message.connectionSig.signer
    const invitationKey = connectionRecord.tags.invitationKey
    if (signerVerkey !== invitationKey) {
      throw new Error('Connection in connection response is not signed with same key as recipient key in invitation')
    }

    connectionRecord.theirDid = connection.did
    connectionRecord.theirDidDoc = connection.didDoc

    if (!connectionRecord.theirKey) {
      throw new Error(`Connection with id ${connectionRecord.id} has no recipient keys.`)
    }

    connectionRecord.tags = {
      ...connectionRecord.tags,
      theirKey: connectionRecord.theirKey,
      threadId: message.threadId,
    }

    await this.updateState(connectionRecord, ConnectionState.Responded)
    return connectionRecord
  }

  /**
   * Create a trust ping message for the connection with the specified connection id.
   *
   * @param connectionId the id of the connection for which to create a trust ping message
   * @returns outbound message contaning trust ping message
   */
  public async createTrustPing(connectionId: string): Promise<ConnectionProtocolMsgReturnType<TrustPingMessage>> {
    const connectionRecord = await this.connectionRepository.find(connectionId)

    connectionRecord.assertState([ConnectionState.Responded, ConnectionState.Complete])

    // TODO:
    //  - create ack message
    //  - allow for options
    //  - maybe this shouldn't be in the connection service?
    const trustPing = new TrustPingMessage()

    await this.updateState(connectionRecord, ConnectionState.Complete)

    return {
      connectionRecord: connectionRecord,
      message: trustPing,
    }
  }

  /**
   * Process a received ack message. This will update the state of the connection
   * to Completed if this is not already the case.
   *
   * @param messageContext the message context containing an ack message
   * @returns updated connection record
   */
  public async processAck(messageContext: InboundMessageContext<AckMessage>): Promise<ConnectionRecord> {
    const connection = messageContext.connection

    if (!connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    // TODO: This is better addressed in a middleware of some kind because
    // any message can transition the state to complete, not just an ack or trust ping
    if (connection.state === ConnectionState.Responded && connection.role === ConnectionRole.Inviter) {
      await this.updateState(connection, ConnectionState.Complete)
    }

    return connection
  }

  public async updateState(connectionRecord: ConnectionRecord, newState: ConnectionState) {
    const previousState = connectionRecord.state
    connectionRecord.state = newState
    await this.connectionRepository.update(connectionRecord)

    const event: ConnectionStateChangedEvent = {
      connectionRecord: connectionRecord,
      previousState,
    }

    this.emit(ConnectionEventType.StateChanged, event)
  }

  private async createConnection(options: {
    role: ConnectionRole
    state: ConnectionState
    invitation?: ConnectionInvitationMessage
    alias?: string
    autoAcceptConnection?: boolean
    tags?: ConnectionTags
  }): Promise<ConnectionRecord> {
    const [did, verkey] = await this.wallet.createDid()

    const publicKey = new Ed25119Sig2018({
      id: `${did}#1`,
      controller: did,
      publicKeyBase58: verkey,
    })

    const service = new IndyAgentService({
      id: `${did};indy`,
      serviceEndpoint: this.config.getEndpoint(),
      recipientKeys: [verkey],
      routingKeys: this.config.getRoutingKeys(),
    })

    // TODO: abstract the second parameter for ReferencedAuthentication away. This can be
    // inferred from the publicKey class instance
    const auth = new ReferencedAuthentication(publicKey, authenticationTypes[publicKey.type])

    const didDoc = new DidDoc({
      id: did,
      authentication: [auth],
      service: [service],
      publicKey: [publicKey],
    })

    const connectionRecord = new ConnectionRecord({
      did,
      didDoc,
      verkey,
      state: options.state,
      role: options.role,
      tags: {
        verkey,
        ...options.tags,
      },
      invitation: options.invitation,
      alias: options.alias,
      autoAcceptConnection: options.autoAcceptConnection,
    })

    await this.connectionRepository.save(connectionRecord)
    return connectionRecord
  }

  public getConnections() {
    return this.connectionRepository.findAll()
  }

  /**
   * Retrieve a connection record by id
   *
   * @param connectionId The connection record id
   * @throws {Error} If no record is found
   * @return The connection record
   *
   */
  public async getById(connectionId: string): Promise<ConnectionRecord> {
    return this.connectionRepository.find(connectionId)
  }

  public async find(connectionId: string): Promise<ConnectionRecord | null> {
    try {
      const connection = await this.connectionRepository.find(connectionId)

      return connection
    } catch {
      // connection not found.
      return null
    }
  }

  public async findByVerkey(verkey: Verkey): Promise<ConnectionRecord | null> {
    const connectionRecords = await this.connectionRepository.findByQuery({
      verkey,
    })

    if (connectionRecords.length > 1) {
      throw new Error(`There is more than one connection for given verkey ${verkey}`)
    }

    if (connectionRecords.length < 1) {
      return null
    }

    return connectionRecords[0]
  }

  public async findByTheirKey(verkey: Verkey): Promise<ConnectionRecord | null> {
    const connectionRecords = await this.connectionRepository.findByQuery({
      theirKey: verkey,
    })

    if (connectionRecords.length > 1) {
      throw new Error(`There is more than one connection for given verkey ${verkey}`)
    }

    if (connectionRecords.length < 1) {
      return null
    }

    return connectionRecords[0]
  }

  public async returnWhenIsConnected(connectionId: string): Promise<ConnectionRecord> {
    const isConnected = (connection: ConnectionRecord) => {
      return connection.id === connectionId && connection.state === ConnectionState.Complete
    }

    const connection = await this.find(connectionId)
    if (connection && isConnected(connection)) return connection

    return new Promise((resolve) => {
      const listener = ({ connectionRecord: connectionRecord }: ConnectionStateChangedEvent) => {
        if (isConnected(connectionRecord)) {
          this.off(ConnectionEventType.StateChanged, listener)
          resolve(connectionRecord)
        }
      }

      this.on(ConnectionEventType.StateChanged, listener)
    })
  }
}

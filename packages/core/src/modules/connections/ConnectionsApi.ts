import type { ConnectionType } from './models'
import type { ConnectionRecord } from './repository/ConnectionRecord'
import type { Routing } from './services'
import type { Query } from '../../storage/StorageService'
import type { OutOfBandRecord } from '../oob/repository'

import { AgentContext } from '../../agent'
import { MessageHandlerRegistry } from '../../agent/MessageHandlerRegistry'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../../error'
import { injectable } from '../../plugins'
import { DidResolverService } from '../dids'
import { DidRepository } from '../dids/repository'
import { OutOfBandService } from '../oob/OutOfBandService'
import { RoutingService } from '../routing/services/RoutingService'

import { ConnectionsModuleConfig } from './ConnectionsModuleConfig'
import { DidExchangeProtocol } from './DidExchangeProtocol'
import {
  AckMessageHandler,
  ConnectionRequestHandler,
  ConnectionResponseHandler,
  DidExchangeCompleteHandler,
  DidExchangeRequestHandler,
  DidExchangeResponseHandler,
  TrustPingMessageHandler,
  TrustPingResponseMessageHandler,
} from './handlers'
import { HandshakeProtocol } from './models'
import { ConnectionService } from './services/ConnectionService'
import { TrustPingService } from './services/TrustPingService'

export interface SendPingOptions {
  responseRequested?: boolean
  withReturnRouting?: boolean
}

@injectable()
export class ConnectionsApi {
  /**
   * Configuration for the connections module
   */
  public readonly config: ConnectionsModuleConfig

  private didExchangeProtocol: DidExchangeProtocol
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService
  private messageSender: MessageSender
  private trustPingService: TrustPingService
  private routingService: RoutingService
  private didRepository: DidRepository
  private didResolverService: DidResolverService
  private agentContext: AgentContext

  public constructor(
    messageHandlerRegistry: MessageHandlerRegistry,
    didExchangeProtocol: DidExchangeProtocol,
    connectionService: ConnectionService,
    outOfBandService: OutOfBandService,
    trustPingService: TrustPingService,
    routingService: RoutingService,
    didRepository: DidRepository,
    didResolverService: DidResolverService,
    messageSender: MessageSender,
    agentContext: AgentContext,
    connectionsModuleConfig: ConnectionsModuleConfig
  ) {
    this.didExchangeProtocol = didExchangeProtocol
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.trustPingService = trustPingService
    this.routingService = routingService
    this.didRepository = didRepository
    this.messageSender = messageSender
    this.didResolverService = didResolverService
    this.agentContext = agentContext
    this.config = connectionsModuleConfig

    this.registerMessageHandlers(messageHandlerRegistry)
  }

  public async acceptOutOfBandInvitation(
    outOfBandRecord: OutOfBandRecord,
    config: {
      autoAcceptConnection?: boolean
      label?: string
      alias?: string
      imageUrl?: string
      protocol: HandshakeProtocol
      routing?: Routing
    }
  ) {
    const { protocol, label, alias, imageUrl, autoAcceptConnection } = config

    const routing =
      config.routing ||
      (await this.routingService.getRouting(this.agentContext, { mediatorId: outOfBandRecord.mediatorId }))

    let result
    if (protocol === HandshakeProtocol.DidExchange) {
      result = await this.didExchangeProtocol.createRequest(this.agentContext, outOfBandRecord, {
        label,
        alias,
        routing,
        autoAcceptConnection,
      })
    } else if (protocol === HandshakeProtocol.Connections) {
      result = await this.connectionService.createRequest(this.agentContext, outOfBandRecord, {
        label,
        alias,
        imageUrl,
        routing,
        autoAcceptConnection,
      })
    } else {
      throw new AriesFrameworkError(`Unsupported handshake protocol ${protocol}.`)
    }

    const { message, connectionRecord } = result
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection: connectionRecord,
      outOfBand: outOfBandRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)
    return connectionRecord
  }

  /**
   * Accept a connection request as inviter (by sending a connection response message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the request
   * @returns connection record
   */
  public async acceptRequest(connectionId: string): Promise<ConnectionRecord> {
    const connectionRecord = await this.connectionService.findById(this.agentContext, connectionId)
    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection record ${connectionId} not found.`)
    }
    if (!connectionRecord.outOfBandId) {
      throw new AriesFrameworkError(`Connection record ${connectionId} does not have out-of-band record.`)
    }

    const outOfBandRecord = await this.outOfBandService.findById(this.agentContext, connectionRecord.outOfBandId)
    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`Out-of-band record ${connectionRecord.outOfBandId} not found.`)
    }

    // If the outOfBandRecord is reusable we need to use new routing keys for the connection, otherwise
    // all connections will use the same routing keys
    const routing = outOfBandRecord.reusable ? await this.routingService.getRouting(this.agentContext) : undefined

    let outboundMessageContext
    if (connectionRecord.protocol === HandshakeProtocol.DidExchange) {
      const message = await this.didExchangeProtocol.createResponse(
        this.agentContext,
        connectionRecord,
        outOfBandRecord,
        routing
      )
      outboundMessageContext = new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection: connectionRecord,
      })
    } else {
      const { message } = await this.connectionService.createResponse(
        this.agentContext,
        connectionRecord,
        outOfBandRecord,
        routing
      )
      outboundMessageContext = new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection: connectionRecord,
      })
    }

    await this.messageSender.sendMessage(outboundMessageContext)
    return connectionRecord
  }

  /**
   * Accept a connection response as invitee (by sending a trust ping message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the response
   * @returns connection record
   */
  public async acceptResponse(connectionId: string): Promise<ConnectionRecord> {
    const connectionRecord = await this.connectionService.getById(this.agentContext, connectionId)

    let outboundMessageContext
    if (connectionRecord.protocol === HandshakeProtocol.DidExchange) {
      if (!connectionRecord.outOfBandId) {
        throw new AriesFrameworkError(`Connection ${connectionRecord.id} does not have outOfBandId!`)
      }
      const outOfBandRecord = await this.outOfBandService.findById(this.agentContext, connectionRecord.outOfBandId)
      if (!outOfBandRecord) {
        throw new AriesFrameworkError(
          `OutOfBand record for connection ${connectionRecord.id} with outOfBandId ${connectionRecord.outOfBandId} not found!`
        )
      }
      const message = await this.didExchangeProtocol.createComplete(
        this.agentContext,
        connectionRecord,
        outOfBandRecord
      )
      // Disable return routing as we don't want to receive a response for this message over the same channel
      // This has led to long timeouts as not all clients actually close an http socket if there is no response message
      message.setReturnRouting(ReturnRouteTypes.none)
      outboundMessageContext = new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection: connectionRecord,
      })
    } else {
      const { message } = await this.connectionService.createTrustPing(this.agentContext, connectionRecord, {
        responseRequested: false,
      })
      // Disable return routing as we don't want to receive a response for this message over the same channel
      // This has led to long timeouts as not all clients actually close an http socket if there is no response message
      message.setReturnRouting(ReturnRouteTypes.none)
      outboundMessageContext = new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection: connectionRecord,
      })
    }

    await this.messageSender.sendMessage(outboundMessageContext)
    return connectionRecord
  }

  /**
   * Send a trust ping to an established connection
   *
   * @param connectionId the id of the connection for which to accept the response
   * @param responseRequested do we want a response to our ping
   * @param withReturnRouting do we want a response at the time of posting
   * @returns TurstPingMessage
   */
  public async sendPing(
    connectionId: string,
    { responseRequested = true, withReturnRouting = undefined }: SendPingOptions
  ) {
    const connection = await this.getById(connectionId)

    const { message } = await this.connectionService.createTrustPing(this.agentContext, connection, {
      responseRequested: responseRequested,
    })

    if (withReturnRouting === true) {
      message.setReturnRouting(ReturnRouteTypes.all)
    }

    // Disable return routing as we don't want to receive a response for this message over the same channel
    // This has led to long timeouts as not all clients actually close an http socket if there is no response message
    if (withReturnRouting === false) {
      message.setReturnRouting(ReturnRouteTypes.none)
    }

    await this.messageSender.sendMessage(
      new OutboundMessageContext(message, { agentContext: this.agentContext, connection })
    )

    return message
  }

  public async returnWhenIsConnected(connectionId: string, options?: { timeoutMs: number }): Promise<ConnectionRecord> {
    return this.connectionService.returnWhenIsConnected(this.agentContext, connectionId, options?.timeoutMs)
  }

  /**
   * Retrieve all connections records
   *
   * @returns List containing all connection records
   */
  public getAll() {
    return this.connectionService.getAll(this.agentContext)
  }

  /**
   * Retrieve all connections records by specified query params
   *
   * @returns List containing all connection records matching specified query paramaters
   */
  public findAllByQuery(query: Query<ConnectionRecord>) {
    return this.connectionService.findAllByQuery(this.agentContext, query)
  }

  /**
   * Allows for the addition of connectionType to the record.
   *  Either updates or creates an array of string connection types
   * @param connectionId
   * @param type
   * @throws {RecordNotFoundError} If no record is found
   */
  public async addConnectionType(connectionId: string, type: ConnectionType | string) {
    const record = await this.getById(connectionId)

    await this.connectionService.addConnectionType(this.agentContext, record, type)

    return record
  }

  /**
   * Removes the given tag from the given record found by connectionId, if the tag exists otherwise does nothing
   * @param connectionId
   * @param type
   * @throws {RecordNotFoundError} If no record is found
   */
  public async removeConnectionType(connectionId: string, type: ConnectionType | string) {
    const record = await this.getById(connectionId)

    await this.connectionService.removeConnectionType(this.agentContext, record, type)

    return record
  }

  /**
   * Gets the known connection types for the record matching the given connectionId
   * @param connectionId
   * @returns An array of known connection types or null if none exist
   * @throws {RecordNotFoundError} If no record is found
   */
  public async getConnectionTypes(connectionId: string) {
    const record = await this.getById(connectionId)

    return this.connectionService.getConnectionTypes(record)
  }

  /**
   *
   * @param connectionTypes An array of connection types to query for a match for
   * @returns a promise of ab array of connection records
   */
  public async findAllByConnectionTypes(connectionTypes: Array<ConnectionType | string>) {
    return this.connectionService.findAllByConnectionTypes(this.agentContext, connectionTypes)
  }

  /**
   * Retrieve a connection record by id
   *
   * @param connectionId The connection record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The connection record
   *
   */
  public getById(connectionId: string): Promise<ConnectionRecord> {
    return this.connectionService.getById(this.agentContext, connectionId)
  }

  /**
   * Find a connection record by id
   *
   * @param connectionId the connection record id
   * @returns The connection record or null if not found
   */
  public findById(connectionId: string): Promise<ConnectionRecord | null> {
    return this.connectionService.findById(this.agentContext, connectionId)
  }

  /**
   * Delete a connection record by id
   *
   * @param connectionId the connection record id
   */
  public async deleteById(connectionId: string) {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)

    if (connection.mediatorId && connection.did) {
      const did = await this.didResolverService.resolve(this.agentContext, connection.did)

      if (did.didDocument) {
        await this.routingService.removeRouting(this.agentContext, {
          recipientKeys: did.didDocument.recipientKeys,
          mediatorId: connection.mediatorId,
        })
      }
    }

    return this.connectionService.deleteById(this.agentContext, connectionId)
  }

  public async findAllByOutOfBandId(outOfBandId: string) {
    return this.connectionService.findAllByOutOfBandId(this.agentContext, outOfBandId)
  }

  /**
   * Retrieve a connection record by thread id
   *
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The connection record
   */
  public getByThreadId(threadId: string): Promise<ConnectionRecord> {
    return this.connectionService.getByThreadId(this.agentContext, threadId)
  }

  public async findByDid(did: string): Promise<ConnectionRecord | null> {
    return this.connectionService.findByTheirDid(this.agentContext, did)
  }

  public async findByInvitationDid(invitationDid: string): Promise<ConnectionRecord[]> {
    return this.connectionService.findByInvitationDid(this.agentContext, invitationDid)
  }

  private registerMessageHandlers(messageHandlerRegistry: MessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(
      new ConnectionRequestHandler(
        this.connectionService,
        this.outOfBandService,
        this.routingService,
        this.didRepository,
        this.config
      )
    )
    messageHandlerRegistry.registerMessageHandler(
      new ConnectionResponseHandler(this.connectionService, this.outOfBandService, this.didResolverService, this.config)
    )
    messageHandlerRegistry.registerMessageHandler(new AckMessageHandler(this.connectionService))
    messageHandlerRegistry.registerMessageHandler(
      new TrustPingMessageHandler(this.trustPingService, this.connectionService)
    )
    messageHandlerRegistry.registerMessageHandler(new TrustPingResponseMessageHandler(this.trustPingService))

    messageHandlerRegistry.registerMessageHandler(
      new DidExchangeRequestHandler(
        this.didExchangeProtocol,
        this.outOfBandService,
        this.routingService,
        this.didRepository,
        this.config
      )
    )

    messageHandlerRegistry.registerMessageHandler(
      new DidExchangeResponseHandler(
        this.didExchangeProtocol,
        this.outOfBandService,
        this.connectionService,
        this.didResolverService,
        this.config
      )
    )
    messageHandlerRegistry.registerMessageHandler(
      new DidExchangeCompleteHandler(this.didExchangeProtocol, this.outOfBandService)
    )
  }
}

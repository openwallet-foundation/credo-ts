import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { ConnectionService } from '../services/ConnectionService'
import { ConnectionRequestMessage } from '../messages'
import { AgentConfig } from '../../../agent/AgentConfig'
import { createOutboundMessage } from '../../../agent/helpers'

export class ConnectionRequestHandler implements Handler {
  private connectionService: ConnectionService
  private agentConfig: AgentConfig
  public supportedMessages = [ConnectionRequestMessage]

  public constructor(connectionService: ConnectionService, agentConfig: AgentConfig) {
    this.connectionService = connectionService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionRequestHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    await this.connectionService.processRequest(messageContext)

    if (messageContext.connection?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createResponse(messageContext.connection.id)
      return createOutboundMessage(messageContext.connection, message)
    }
  }
}

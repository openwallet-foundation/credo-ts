import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { AgentConfig } from '../../../agent/AgentConfig'
import { createOutboundMessage } from '../../../agent/helpers'
import { ConnectionService } from '../services/ConnectionService'
import { ConnectionResponseMessage } from '../messages'

export class ConnectionResponseHandler implements Handler {
  private connectionService: ConnectionService
  private agentConfig: AgentConfig
  public supportedMessages = [ConnectionResponseMessage]

  public constructor(connectionService: ConnectionService, agentConfig: AgentConfig) {
    this.connectionService = connectionService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionResponseHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    await this.connectionService.processResponse(messageContext)

    // TODO: should we only send ping message in case of autoAcceptConnection or always?
    // In AATH we have a separate step to send the ping. So for now we'll only do it
    // if auto accept is enable
    if (messageContext.connection?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createTrustPing(messageContext.connection.id)
      return createOutboundMessage(messageContext.connection, message)
    }
  }
}

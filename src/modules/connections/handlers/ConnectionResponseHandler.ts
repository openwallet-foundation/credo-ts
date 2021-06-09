import { AgentConfig } from '../../../agent/AgentConfig'
import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { ConnectionResponseMessage } from '../messages'
import { ConnectionService } from '../services/ConnectionService'

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
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
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

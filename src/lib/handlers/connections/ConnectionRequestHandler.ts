import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConnectionRequestMessage } from '../../protocols/connections/ConnectionRequestMessage';
import { AgentConfig } from '../../agent/AgentConfig';

export class ConnectionRequestHandler implements Handler {
  private connectionService: ConnectionService;
  private agentConfig: AgentConfig;
  public supportedMessages = [ConnectionRequestMessage];

  public constructor(connectionService: ConnectionService, agentConfig: AgentConfig) {
    this.connectionService = connectionService;
    this.agentConfig = agentConfig;
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionRequestHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    await this.connectionService.processRequest(messageContext);

    if (messageContext.connection?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      return await this.connectionService.createResponse(messageContext.connection.id);
    }
  }
}

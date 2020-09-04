import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConnectionResponseMessage } from '../../protocols/connections/ConnectionResponseMessage';
import { AgentConfig } from '../../agent/AgentConfig';

export class ConnectionResponseHandler implements Handler {
  private connectionService: ConnectionService;
  private agentConfig: AgentConfig;
  public supportedMessages = [ConnectionResponseMessage];

  public constructor(connectionService: ConnectionService, agentConfig: AgentConfig) {
    this.connectionService = connectionService;
    this.agentConfig = agentConfig;
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionResponseHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    await this.connectionService.processResponse(messageContext);

    // TODO: should we only send ack message in case of autoAcceptConnection or always?
    if (messageContext.connection?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      return await this.connectionService.createAck(messageContext.connection.id);
    }
  }
}

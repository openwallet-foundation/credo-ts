import type { Verkey } from 'indy-sdk';
import { EventEmitter } from 'events';

import { AgentConfig } from '../../agent/AgentConfig';
import { MessageSender } from '../../agent/MessageSender';
import { createOutboundMessage } from '../../agent/helpers';
import { Dispatcher } from '../../agent/Dispatcher';
import { ConnectionRecord } from './repository/ConnectionRecord';
import { ConnectionState } from './models';
import { RequestMediationMessage } from './messages';
import { MediationDenyHandler} from './handlers/MediationDeniedHandler';
import { MediationGrantHandler} from './handlers/MediationGrantedHandler';
import { RequestMediationType } from './messages/RequestMediationType';
import { RequestMediationMessage } from './messages/RequestMediationMessage';
import { MediationService } from './services/MediationService';

export class MediationModule {
  private agentConfig: AgentConfig;
  private mediationService: MediationService;

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationService: MediationService,
  ) {
    this.agentConfig = agentConfig;
    this.mediationService = mediationService;
    this.registerHandlers(dispatcher);
  }

  public get events(): EventEmitter {
    return this.mediationService;
  }

// Pass in a connectionRecord, recieve back the connectionRecord and a message
  public async requestMediation(config?: {
    autoAcceptConnection?: boolean;
    alias?: string;
  }): Promise<{ invitation: RequestMediationMessage; connectionRecord: ConnectionRecord }> {
    const { connectionRecord: connectionRecord, message: invitation } = await this.connectionService.createInvitation({
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
    });

    // How does this fit in with mediation?
    if (this.agentConfig.inboundConnection) {
      this.mediationService.createRoute(connectionRecord.verkey);
    }

    return { connectionRecord, invitation };
  }

  public async receiveMediation(
    invitation: ConnectionInvitationMessage,
    config?: {
      autoAcceptConnection?: boolean;
      alias?: string;
    }
  ): Promise<ConnectionRecord> {
    let connection = await this.connectionService.processInvitation(invitation, {
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
    });

    // if auto accept is enabled (either on the record or the global agent config)
    // we directly send a connection request
    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      connection = await this.acceptInvitation(connection.id);
    }

    return connection;
  }

  
  public async acceptRequest(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createResponse(connectionId);

    const outbound = createOutboundMessage(connectionRecord, message);
    await this.messageSender.sendMessage(outbound);

    return connectionRecord;
  }

  /**
   * Accept a connection response as invitee (by sending a trust ping message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the response
   * @returns connection record
   */
  public async acceptResponse(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createTrustPing(connectionId);

    const outbound = createOutboundMessage(connectionRecord, message);
    await this.messageSender.sendMessage(outbound);

    return connectionRecord;
  }

  public async returnWhenIsConnected(connectionId: string): Promise<ConnectionRecord> {
    const isConnected = (connection: ConnectionRecord) => {
      return connection.id === connectionId && connection.state === ConnectionState.Complete;
    };

    const connection = await this.connectionService.find(connectionId);
    if (connection && isConnected(connection)) return connection;

    return new Promise(resolve => {
      const listener = ({ connectionRecord: connectionRecord }: ConnectionStateChangedEvent) => {
        if (isConnected(connectionRecord)) {
          this.events.off(ConnectionEventType.StateChanged, listener);
          resolve(connectionRecord);
        }
      };

      this.events.on(ConnectionEventType.StateChanged, listener);
    });
  }


//   Need to fill this out with the keylist methods 

  public async getMediators() {
    //   TODO - fetch mediators from wallet. I'm guessing that this would have to poll all mediators and get their statuses? 
    // return this.mediationService.getMediators();
  }

//   I removed all but these two 
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new MediationDenyHandler(this.connectionService, this.agentConfig));
    dispatcher.registerHandler(new MediationGrantHandler(this.connectionService, this.agentConfig));
  }
}

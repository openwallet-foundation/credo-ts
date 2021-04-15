import type { Verkey } from 'indy-sdk';
import { createOutboundMessage } from '../../../agent/helpers';
import { AgentConfig } from '../../../agent/AgentConfig';
import { MessageSender } from '../../../agent/MessageSender';
import { RequestMediationMessage, MediationGrantedMessage, MediationDeniedMessage } from '../messages';
import { Logger } from '../../../logger';
import { ConnectionRecord } from '../../connections';

class MediationConsumerService {
  private messageSender: MessageSender;
  private logger: Logger;
  private agentConfig: AgentConfig;

  public constructor(messageSender: MessageSender, agentConfig: AgentConfig) {
    this.messageSender = messageSender;
    this.agentConfig = agentConfig;
    this.logger = agentConfig.logger;
  }

  // public async createMediationRequestMessage(connectionId: string) :   {
  //   this.logger.debug('Requesting mediation');
  //   const message = new RequestMediationMessage({})
  // }

  // public async reqeustMediation(connection: Verkey) {
  //   this.logger.debug(`Registering route for verkey '${verkey}' at mediator`);

  //   if (!this.agentConfig.inboundConnection) {
  //     this.logger.debug(`There is no mediator. Creating route for verkey '${verkey}' skipped.`);
  //   } else {
  //     const routingConnection = this.agentConfig.inboundConnection.connection;

  //     const keylistUpdateMessage = new KeylistUpdateMessage({
  //       updates: [
  //         new KeylistUpdate({
  //           action: KeylistUpdateAction.add,
  //           recipientKey: verkey,
  //         }),
  //       ],
  //     });

  //     const outboundMessage = createOutboundMessage(routingConnection, keylistUpdateMessage);
  //     await this.messageSender.sendMessage(outboundMessage);
  //   }
  // }

  // public async handleResponse(){
  //   // Handle the response
  //   // Cases - granted, denied, error
  //   // Granted: save mediator to the Repoistory, return record for immediate use.
  // }

  // public async
}

export { MediationConsumerService };

import { Verkey } from "indy-sdk";
import EventEmitter from "node:events";
import { Logger } from "tslog";
import { RoutingTable } from ".";
import { MediationRecord, KeylistUpdateMessage, KeylistUpdateAction, ForwardMessage } from "..";
import { AgentConfig } from "../../../agent/AgentConfig";
import { createOutboundMessage } from "../../../agent/helpers";
import { InboundMessageContext } from "../../../agent/models/InboundMessageContext";
import { Repository } from "../../../storage/Repository";
import { OutboundMessage } from "../../../types";
import { ConnectionRecord } from "../../connections";
import { MediationRecordProps } from "../repository/MediationRecipientRecord"

export class MediationService {
    create(provisioningProps: { connectionId: string; recipientKey: string; }): any {
      throw new Error('Method not implemented.');
    }

    private agentConfig: AgentConfig;
    private mediationRepository: Repository<MediationRecord>; 
    // Mediation record is a mapping of connection id to recipient keylist
    // This implies that there's a single mediation record per connection
  
    // TODO: Review this, placeholder
    public constructor(agentConfig: AgentConfig, mediationRepository: Repository<MediationRecord>) {
      this.agentConfig = agentConfig;
      this.mediationRepository = mediationRepository;
    }
  
  
    public async find(mediatorId: string): Promise<string | MediationRecord> {
      try {
        const connection = await this.mediationRepository.find(mediatorId);
  
        return connection;
      } catch {
          return 'No mediator found for ID'
  //  TODO - Make this better
      }
    }
  
    public fetchMediatorById(mediatorId: string): string {
      const mediator = 'DummyMediator';
      return mediator;
    }
  
  // Copied from old Service
  
    private routingTable: RoutingTable = {};
  
    /**
     * @todo use connection from message context
     */
    public updateRoutes(messageContext: InboundMessageContext<KeylistUpdateMessage>, connection: ConnectionRecord) {
      const { message } = messageContext;
  
      for (const update of message.updates) {
        switch (update.action) {
          case KeylistUpdateAction.add:
            const record = new MediationRecord({connectionId: connection.id, recipientKey: update.recipientKey} )
            //   Add save
            break;
          case KeylistUpdateAction.remove:
            //   TODO - Remove from registry
            break;
        }
      }
    }
  
    public forward(messageContext: InboundMessageContext<ForwardMessage>): OutboundMessage<ForwardMessage> {
      const { message, recipientVerkey } = messageContext;
  
      // TODO: update to class-validator validation
      if (!message.to) {
        throw new Error('Invalid Message: Missing required attribute "to"');
      }
  
      const connection = this.findRecipient(message.to);
  
      if (!connection) {
        throw new Error(`Connection for verkey ${recipientVerkey} not found!`);
      }
  
      if (!connection.theirKey) {
        throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
      }
  
      return createOutboundMessage(connection, message);
    }
  
    public findRecipient(recipientKey: Verkey) {
      const connection = this.routingTable[recipientKey];
  
      // TODO: function with find in name should now throw error when not found.
      // It should either be called getRecipient and throw error
      // or findRecipient and return null
      if (!connection) {
        throw new Error(`Routing entry for recipientKey ${recipientKey} does not exists.`);
      }
  
      return connection;
    }
  }
  
  export interface MediationProps {
    conectionId: string
    recipientKey: string
  }
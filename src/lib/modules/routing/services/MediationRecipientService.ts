import type { Verkey } from 'indy-sdk';
import { createOutboundMessage } from '../../../agent/helpers';
import { AgentConfig } from '../../../agent/AgentConfig';
import { MessageSender } from '../../../agent/MessageSender';
import { KeylistUpdateMessage, KeylistUpdate, KeylistUpdateAction } from '../messages';
import { Logger } from '../../../logger';
import { EventEmitter } from 'events';
import { MediationRecipientRecord } from '../repository/MediationRecipientRecord';
import { Repository } from '../../../storage/Repository';
import { ConnectionInvitationMessage, ConnectionRecord } from '../../connections';

export class MediationRecipientService extends EventEmitter {
  // TODO: Review this, placeholder
  private logger: Logger;
  private agentConfig: AgentConfig;
  private mediationRecipientRepository: Repository<MediationRecipientRecord>;

  // TODO: Review this, placeholder
  public constructor(agentConfig: AgentConfig, mediationRecipientRepository: Repository<MediationRecipientRecord>) {
    super();
    this.agentConfig = agentConfig;
    this.logger = agentConfig.logger;
    this.mediationRecipientRepository = mediationRecipientRepository;
  }

  // TODO: Review this, placeholder
  public async requestMediation(connectionRecord: ConnectionRecord): Promise<MediationRecipientRecord> {
    // Ensure that the connection is complete (check state) (validate, assert state)
    // Send mediation request message
    // create mediation recipient record and then return it.
  }

  // recieve and handle the "granted" response from the mediator
  public handleGranted() {
    const event: MediationEventType = {
      message: 'The mediation was granted',
    };

    this.emit(event);
  }

  // recieve and handle the "denied" response from the mediator.
  public handleDenied() {
    const event: MediationEventType = {
      message: 'The mediation denied the request',
    };

    this.emit(event);
  }

  // Do we want to create a Mediator type?

  public async find(mediatorId: string): Promise<MediationRecipientRecord | null> {
    try {
      const connection = await this.mediationRecipientRepository.find(mediatorId);

      return connection;
    } catch {
      // connection not found.
      return null;
    }
  }

  public fetchMediatorById(mediatorId: string): string {
    const mediator: string = 'DummyMediator';
    return mediator;
  }
}

export interface MediationEventType {
  message: string;
}

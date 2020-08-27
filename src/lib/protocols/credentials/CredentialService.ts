import uuid from 'uuid';
import { EventEmitter } from 'events';
import { CredentialRecord } from '../../storage/CredentialRecord';
import { Repository } from '../../storage/Repository';
import { Wallet } from '../../wallet/Wallet';
import { CredentialOfferMessage } from './messages/CredentialOfferMessage';
import { Expose } from 'class-transformer';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';
import logger from '../../logger';
import { CredentialState } from './CredentialState';

export enum EventType {
  StateChanged = 'stateChanged',
}

export class CredentialService extends EventEmitter {
  wallet: Wallet;
  credentialRepository: Repository<CredentialRecord>;

  constructor(wallet: Wallet, credentialRepository: Repository<CredentialRecord>) {
    super();
    this.wallet = wallet;
    this.credentialRepository = credentialRepository;
  }

  async createCredentialOffer({ credDefId, comment }: CredentialOfferTemplate): Promise<CredentialOfferMessage> {
    const credOffer = await this.wallet.createCredentialOffer(credDefId);
    const attachment = new Attachment({
      id: uuid(),
      mimeType: 'application/json',
      data: credOffer,
    });
    const credentialOffer = new CredentialOfferMessage({
      comment,
      offersAttachments: [attachment],
      credentialPreview: {},
    });

    const credential = new CredentialRecord({ offer: credentialOffer, state: CredentialState.OfferSent });
    await this.credentialRepository.save(credential);

    this.emit(EventType.StateChanged, { credentialId: credential.id, newState: credential.state });
    return credentialOffer;
  }

  async acceptCredentialOffer(messageContext: InboundMessageContext<CredentialOfferMessage>): Promise<void> {
    logger.log('messageContext', messageContext);
    const credentialOffer = messageContext.message;
    const credential = new CredentialRecord({ offer: credentialOffer, state: CredentialState.OfferReceived });
    await this.credentialRepository.save(credential);
    this.emit(EventType.StateChanged, { credentialId: credential.id, newState: credential.state });
  }

  async getAll(): Promise<CredentialRecord[]> {
    return this.credentialRepository.findAll();
  }
}

export interface CredentialOfferTemplate {
  credDefId: CredDefId;
  comment: string;
}

export class Attachment {
  constructor(options: Attachment) {
    this.id = options.id;
    this.mimeType = options.mimeType;
    this.data = options.data;
  }

  @Expose({ name: '@id' })
  id: string;

  @Expose({ name: 'mime-type' })
  mimeType: string;

  @Expose({ name: 'data' })
  data: any;
}

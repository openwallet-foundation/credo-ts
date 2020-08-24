import { CredentialRecord } from '../../storage/CredentialRecord';
import { Repository } from '../../storage/Repository';
import { Wallet } from '../../wallet/Wallet';
import { CredentialOfferMessage } from './messages/CredentialOfferMessage';
import uuid from 'uuid';
import { Expose } from 'class-transformer';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';
import logger from '../../logger';

export class CredentialService {
  wallet: Wallet;
  credentialRepository: Repository<CredentialRecord>;

  constructor(wallet: Wallet, credentialRepository: Repository<CredentialRecord>) {
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
    return credentialOffer;
  }

  async acceptCredentialOffer(messageContext: InboundMessageContext<CredentialOfferMessage>): Promise<void> {
    logger.log('messageContext', messageContext);
    const credentialOffer = messageContext.message;
    const credential = new CredentialRecord({ offer: credentialOffer });
    await this.credentialRepository.save(credential);
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

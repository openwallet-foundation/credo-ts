import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { CredentialRecord } from '../../storage/CredentialRecord';
import { Repository } from '../../storage/Repository';
import { Wallet } from '../../wallet/Wallet';
import { CredentialOfferMessage, CredentialPreview, Attachment } from './messages/CredentialOfferMessage';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';
import { CredentialState } from './CredentialState';

export enum EventType {
  StateChanged = 'stateChanged',
}

export class CredentialService extends EventEmitter {
  private wallet: Wallet;
  private credentialRepository: Repository<CredentialRecord>;

  public constructor(wallet: Wallet, credentialRepository: Repository<CredentialRecord>) {
    super();
    this.wallet = wallet;
    this.credentialRepository = credentialRepository;
  }

  public async createCredentialOffer({
    credDefId,
    comment,
    preview,
  }: CredentialOfferTemplate): Promise<CredentialOfferMessage> {
    const credOffer = await this.wallet.createCredentialOffer(credDefId);
    const attachment = new Attachment({
      id: uuid(),
      mimeType: 'application/json',
      data: {
        base64: Buffer.from(JSON.stringify(credOffer)).toString('base64'),
      },
    });
    const credentialOffer = new CredentialOfferMessage({
      comment,
      offersAttachments: [attachment],
      credentialPreview: preview,
    });

    const credential = new CredentialRecord({ offer: credentialOffer, state: CredentialState.OfferSent });
    await this.credentialRepository.save(credential);

    this.emit(EventType.StateChanged, { credentialId: credential.id, newState: credential.state });
    return credentialOffer;
  }

  public async processCredentialOffer(messageContext: InboundMessageContext<CredentialOfferMessage>): Promise<void> {
    const credentialOffer = messageContext.message;
    const credential = new CredentialRecord({ offer: credentialOffer, state: CredentialState.OfferReceived });
    await this.credentialRepository.save(credential);
    this.emit(EventType.StateChanged, { credentialId: credential.id, newState: credential.state });
  }

  public async getAll(): Promise<CredentialRecord[]> {
    return this.credentialRepository.findAll();
  }
}

export interface CredentialOfferTemplate {
  credDefId: CredDefId;
  comment: string;
  preview: CredentialPreview;
}

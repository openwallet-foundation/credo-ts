import { ConnectionRecord } from '../storage/ConnectionRecord';
import { CredentialRecord } from '../storage/CredentialRecord';
import { createOutboundMessage } from '../protocols/helpers';
import { CredentialService, CredentialOfferTemplate } from '../protocols/credentials/CredentialService';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { LedgerService } from '../agent/LedgerService';
import logger from '../logger';
import { CredentialOfferMessage } from '../protocols/credentials/messages/CredentialOfferMessage';
import { MessageTransformer } from '../agent/MessageTransformer';

export class CredentialsModule {
  private connectionService: ConnectionService;
  private credentialService: CredentialService;
  private ledgerService: LedgerService;
  private messageSender: MessageSender;

  public constructor(
    connectionService: ConnectionService,
    credentialService: CredentialService,
    ledgerService: LedgerService,
    messageSender: MessageSender
  ) {
    this.connectionService = connectionService;
    this.credentialService = credentialService;
    this.ledgerService = ledgerService;
    this.messageSender = messageSender;
  }

  public async issueCredential(connection: ConnectionRecord, credentialTemplate: CredentialOfferTemplate) {
    const credentialOfferMessage = await this.credentialService.createCredentialOffer(connection, credentialTemplate);
    const outboundMessage = createOutboundMessage(connection, credentialOfferMessage);
    await this.messageSender.sendMessage(outboundMessage);
  }

  public async acceptCredential(credential: CredentialRecord) {
    logger.log('credential', credential);
    logger.log('credential.offer', credential.offer);
    credential.offer = MessageTransformer.toMessageInstance(credential.offer, CredentialOfferMessage);
    const [offerAttachment] = credential.offer.offersAttachments;
    logger.log('offerAttachment', offerAttachment);
    const credOffer = JSON.parse(Buffer.from(offerAttachment.data.base64, 'base64').toString('utf-8'));
    logger.log('credOffer', credOffer);

    const [, credentialDefinition] = await this.ledgerService.getCredentialDefinition(credOffer.cred_def_id);
    logger.log('credentialDefinition', credentialDefinition);
    const connection = await this.connectionService.find(credential.connectionId);

    if (!connection) {
      throw new Error(`There is no connection with ID ${credential.connectionId}`);
    }

    const credentialRequestMessage = await this.credentialService.acceptCredentialOffer(
      connection,
      credential,
      credentialDefinition
    );

    const outboundMessage = createOutboundMessage(connection, credentialRequestMessage);
    await this.messageSender.sendMessage(outboundMessage);
  }

  public async getCredentials(): Promise<CredentialRecord[]> {
    return this.credentialService.getAll();
  }

  public async find(id: string) {
    return this.credentialService.find(id);
  }
}

interface CredentialTemplate {
  credDefId: string;
}

import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { CredentialRecord } from '../../storage/CredentialRecord';
import { Repository } from '../../storage/Repository';
import { Wallet } from '../../wallet/Wallet';
import { CredentialOfferMessage, CredentialPreview } from './messages/CredentialOfferMessage';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';
import { CredentialState } from './CredentialState';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { CredentialRequestMessage } from './messages/CredentialRequestMessage';
import { Attachment } from './messages/Attachment';
import logger from '../../logger';
import { CredentialResponseMessage } from './messages/CredentialResponseMessage';
import { JsonEncoder } from './JsonEncoder';
import { ThreadDecorator } from '../../decorators/thread/ThreadDecorator';
import { MessageTransformer } from '../../agent/MessageTransformer';
import { CredentialUtils } from './CredentialUtils';

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

  public async createCredentialOffer(
    connection: ConnectionRecord,
    { credDefId, comment, preview }: CredentialOfferTemplate
  ): Promise<CredentialOfferMessage> {
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

    const credential = new CredentialRecord({
      connectionId: connection.id,
      offer: credentialOffer,
      state: CredentialState.OfferSent,
      tags: { threadId: credentialOffer.id },
    });
    await this.credentialRepository.save(credential);

    this.emit(EventType.StateChanged, { credentialId: credential.id, newState: credential.state });
    return credentialOffer;
  }

  public async processCredentialOffer(messageContext: InboundMessageContext<CredentialOfferMessage>): Promise<void> {
    const credentialOffer = messageContext.message;
    logger.log('processCredentialOffer credentialOffer', credentialOffer);
    const connection = messageContext.connection;

    if (!connection) {
      throw new Error('There is no connection in message context.');
    }

    const credential = new CredentialRecord({
      connectionId: connection.id,
      offer: credentialOffer,
      state: CredentialState.OfferReceived,
      tags: { threadId: credentialOffer.id },
    });
    await this.credentialRepository.save(credential);
    this.emit(EventType.StateChanged, { credentialId: credential.id, newState: credential.state });
  }

  public async acceptCredentialOffer(
    connection: ConnectionRecord,
    credential: CredentialRecord,
    credDef: CredDef
  ): Promise<CredentialRequestMessage> {
    const proverDid = connection.did;
    const offer = MessageTransformer.toMessageInstance(credential.offer, CredentialOfferMessage);
    const [offerAttachment] = offer.offersAttachments;
    const credOffer = JSON.parse(Buffer.from(offerAttachment.data.base64, 'base64').toString('utf-8'));
    logger.log('credOffer', credOffer);
    const [credReq, credReqMetadata] = await this.wallet.createCredentialRequest(
      proverDid,
      credOffer,
      credDef,
      'master_secret'
    );
    const attachment = new Attachment({
      id: uuid(),
      mimeType: 'application/json',
      data: {
        base64: Buffer.from(JSON.stringify(credReq)).toString('base64'),
      },
    });
    const credentialRequest = new CredentialRequestMessage({
      comment: 'some credential request comment',
      requestsAttachments: [attachment],
    });
    credentialRequest.setThread(new ThreadDecorator({ threadId: offer.id }));

    logger.log('credential before', credential);

    credential.requestMetadata = credReqMetadata;
    credential.state = CredentialState.RequestSent;

    logger.log('credential before update', credential);
    await this.credentialRepository.update(credential);
    const credential2 = await this.credentialRepository.find(credential.id);
    logger.log('credential after update', credential2);
    return credentialRequest;
  }

  public async processCredentialRequest(
    messageContext: InboundMessageContext<CredentialRequestMessage>,
    { comment }: CredentialResponseOptions
  ): Promise<CredentialResponseMessage> {
    const [requestAttachment] = messageContext.message.requestsAttachments;
    const credReq = JsonEncoder.decode(requestAttachment.data.base64);

    logger.log('messageContext.message', messageContext.message);

    const [credential] = await this.credentialRepository.findByQuery({
      threadId: messageContext.message.thread?.threadId,
    });

    logger.log('credential', credential);

    const offer = MessageTransformer.toMessageInstance(credential.offer, CredentialOfferMessage);
    const [offerAttachment] = offer.offersAttachments;
    const credOffer = JsonEncoder.decode(offerAttachment.data.base64);
    const credValues = CredentialUtils.convertPreviewToValues(offer.credentialPreview);

    const [cred] = await this.wallet.createCredential(credOffer, credReq, credValues);

    logger.log('cred', cred);

    const responseAttachment = new Attachment({
      id: uuid(),
      mimeType: 'application/json',
      data: {
        base64: Buffer.from(JSON.stringify(cred)).toString('base64'),
      },
    });

    const credentialResponse = new CredentialResponseMessage({
      comment,
      attachments: [responseAttachment],
    });

    credential.state = CredentialState.CredentialIssued;
    await this.credentialRepository.update(credential);

    return credentialResponse;
  }

  public async processCredentialResponse(
    messageContext: InboundMessageContext<CredentialResponseMessage>,
    credentialDefinition: CredDef
  ) {
    const [responseAttachment] = messageContext.message.attachments;
    const cred = JsonEncoder.decode(responseAttachment.data.base64);

    const [credential] = await this.credentialRepository.findByQuery({
      threadId: messageContext.message.thread?.threadId,
    });

    logger.log('credential', credential);

    if (!credential.requestMetadata) {
      throw new Error(`Credential does not contain credReqMetadata.`);
    }

    const credentialId = await this.wallet.storeCredential(
      uuid(),
      credential.requestMetadata,
      cred,
      credentialDefinition
    );

    credential.credentialId = credentialId;
    credential.state = CredentialState.CredentialReceived;
    this.credentialRepository.update(credential);
  }

  public async getAll(): Promise<CredentialRecord[]> {
    return this.credentialRepository.findAll();
  }

  public async find(id: string): Promise<CredentialRecord> {
    return this.credentialRepository.find(id);
  }
}

export interface CredentialOfferTemplate {
  credDefId: CredDefId;
  comment: string;
  preview: CredentialPreview;
}

interface CredentialResponseOptions {
  comment: string;
}

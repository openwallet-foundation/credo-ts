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

  /**
   * Create a new credential record and credential offer message to be send by issuer to holder.
   *
   * @param connection Connection to which issuer wants to issue a credential
   * @param credentialOfferTemplate Template for credential offer
   * @returns Credential offer message
   */
  public async createCredentialOffer(
    connection: ConnectionRecord,
    { credDefId, comment, preview }: CredentialOfferTemplate
  ): Promise<CredentialOfferMessage> {
    const credOffer = await this.wallet.createCredentialOffer(credDefId);
    const attachment = new Attachment({
      id: uuid(),
      mimeType: 'application/json',
      data: {
        base64: JsonEncoder.encode(credOffer),
      },
    });
    const credentialOffer = new CredentialOfferMessage({
      comment,
      attachments: [attachment],
      credentialPreview: preview,
    });

    const credential = new CredentialRecord({
      connectionId: connection.id,
      offer: credentialOffer,
      state: CredentialState.OfferSent,
      tags: { threadId: credentialOffer.id },
    });
    await this.credentialRepository.save(credential);
    this.emit(EventType.StateChanged, { credential, prevState: null });
    return credentialOffer;
  }

  /**
   * Creates a new credential record by holder based on incoming credential offer from issuer.
   *
   * It does not accept the credential offer. Holder needs to call `createCredentialRequest` method
   * to accept the credential offer.
   *
   * @param messageContext
   */
  public async processCredentialOffer(messageContext: InboundMessageContext<CredentialOfferMessage>): Promise<void> {
    const credentialOffer = messageContext.message;
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
    this.emit(EventType.StateChanged, { credential, prevState: null });
  }

  /**
   * Creates credential request message by holder to be send to issuer.
   *
   * @param connection Connection between holder and issuer
   * @param credential
   * @param credDef
   */
  public async createCredentialRequest(
    connection: ConnectionRecord,
    credential: CredentialRecord,
    credDef: CredDef
  ): Promise<CredentialRequestMessage> {
    const proverDid = connection.did;
    const offer = MessageTransformer.toMessageInstance(credential.offer, CredentialOfferMessage);
    const [offerAttachment] = offer.attachments;
    const credOffer = JsonEncoder.decode(offerAttachment.data.base64);

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
        base64: JsonEncoder.encode(credReq),
      },
    });
    const credentialRequest = new CredentialRequestMessage({
      comment: 'some credential request comment',
      attachments: [attachment],
    });
    credentialRequest.setThread(new ThreadDecorator({ threadId: credential.tags.threadId }));

    credential.requestMetadata = credReqMetadata;
    await this.updateState(credential, CredentialState.RequestSent);
    return credentialRequest;
  }

  /**
   * Updates credential record by issuer based on incoming credential request from holder.
   *
   * @param messageContext
   */
  public async processCredentialRequest(
    messageContext: InboundMessageContext<CredentialRequestMessage>
  ): Promise<CredentialRecord> {
    const [requestAttachment] = messageContext.message.attachments;
    const credReq = JsonEncoder.decode(requestAttachment.data.base64);

    const [credential] = await this.credentialRepository.findByQuery({
      threadId: messageContext.message.thread?.threadId,
    });
    credential.request = credReq;

    logger.log('Credential record found when processing credential request', credential);

    await this.updateState(credential, CredentialState.RequestReceived);
    return credential;
  }

  /**
   * Creates credential request message by issuer to be send to holder.
   *
   * @param credentialId Credential record ID
   * @param credentialResponseOptions
   */
  public async createCredentialResponse(credentialId: string, { comment }: CredentialResponseOptions) {
    const credential = await this.credentialRepository.find(credentialId);
    const offer = MessageTransformer.toMessageInstance(credential.offer, CredentialOfferMessage);
    const [offerAttachment] = offer.attachments;
    const credOffer = JsonEncoder.decode(offerAttachment.data.base64);
    const credValues = CredentialUtils.convertPreviewToValues(offer.credentialPreview);

    if (!credential.request) {
      throw new Error(`Credential does not contain credReqMetadata.`);
    }

    const [cred] = await this.wallet.createCredential(credOffer, credential.request, credValues);

    const responseAttachment = new Attachment({
      id: uuid(),
      mimeType: 'application/json',
      data: {
        base64: JsonEncoder.encode(cred),
      },
    });

    const credentialResponse = new CredentialResponseMessage({
      comment,
      attachments: [responseAttachment],
    });
    credentialResponse.setThread(new ThreadDecorator({ threadId: credential.tags.threadId }));

    await this.updateState(credential, CredentialState.CredentialIssued);
    return credentialResponse;
  }

  /**
   * Updates credential record by holder based on incoming credential request from issuer.
   *
   * @param messageContext
   * @param credentialDefinition
   */
  public async processCredentialResponse(
    messageContext: InboundMessageContext<CredentialResponseMessage>,
    credentialDefinition: CredDef
  ) {
    const [responseAttachment] = messageContext.message.attachments;
    const cred = JsonEncoder.decode(responseAttachment.data.base64);

    const [credential] = await this.credentialRepository.findByQuery({
      threadId: messageContext.message.thread?.threadId,
    });

    logger.log('Credential record found when processing credential response', credential);

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

  private async updateState(credential: CredentialRecord, newState: CredentialState) {
    const prevState = credential.state;
    credential.state = newState;
    await this.credentialRepository.update(credential);
    this.emit(EventType.StateChanged, { credential, prevState });
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

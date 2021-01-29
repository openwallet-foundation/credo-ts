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
import logger from '../../logger';
import { CredentialResponseMessage } from './messages/CredentialResponseMessage';
import { JsonEncoder } from '../../utils/JsonEncoder';
import { CredentialUtils } from './CredentialUtils';
import { JsonTransformer } from '../../utils/JsonTransformer';
import { CredentialAckMessage } from './messages/CredentialAckMessage';
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment';

export enum EventType {
  StateChanged = 'stateChanged',
}

export interface CredentialStateChangedEvent {
  credential: CredentialRecord;
  prevState: CredentialState;
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
  public async createOffer(
    connection: ConnectionRecord,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialOfferMessage> {
    const { credentialDefinitionId, comment, preview } = credentialTemplate;
    const credOffer = await this.wallet.createCredentialOffer(credentialDefinitionId);
    const attachment = new Attachment({
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credOffer),
      }),
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
  public async processOffer(messageContext: InboundMessageContext<CredentialOfferMessage>): Promise<CredentialRecord> {
    const credentialOffer = messageContext.message;
    const connection = messageContext.connection;

    if (!connection) {
      throw new Error('There is no connection in message context.');
    }

    const credentialRecord = new CredentialRecord({
      connectionId: connection.id,
      offer: credentialOffer,
      state: CredentialState.OfferReceived,
      tags: { threadId: credentialOffer.id },
    });
    await this.credentialRepository.save(credentialRecord);
    this.emit(EventType.StateChanged, { credential: credentialRecord, prevState: null });
    return credentialRecord;
  }

  /**
   * Creates credential request message by holder to be send to issuer.
   *
   * @param connection Connection between holder and issuer
   * @param credential
   * @param credentialDefinition
   */
  public async createRequest(
    connection: ConnectionRecord,
    credential: CredentialRecord,
    credentialDefinition: CredDef,
    options: CredentialRequestOptions = {}
  ): Promise<CredentialRequestMessage> {
    this.assertState(credential.state, CredentialState.OfferReceived);

    const proverDid = connection.did;

    // FIXME: transformation should be handled by credential record
    const offer =
      credential.offer instanceof CredentialOfferMessage
        ? credential.offer
        : JsonTransformer.fromJSON(credential.offer, CredentialOfferMessage);
    const [offerAttachment] = offer.attachments;

    if (!offerAttachment.data.base64) {
      throw new Error('Missing required base64 encoded attachment data');
    }

    const credOffer = JsonEncoder.fromBase64(offerAttachment.data.base64);

    const [credReq, credReqMetadata] = await this.wallet.createCredentialRequest(
      proverDid,
      credOffer,
      credentialDefinition
    );
    const attachment = new Attachment({
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(credReq),
      }),
    });

    const { comment } = options;
    const credentialRequest = new CredentialRequestMessage({ comment, attachments: [attachment] });
    credentialRequest.setThread({ threadId: credential.tags.threadId });

    credential.requestMetadata = credReqMetadata;
    await this.updateState(credential, CredentialState.RequestSent);
    return credentialRequest;
  }

  /**
   * Updates credential record by issuer based on incoming credential request from holder.
   *
   * @param messageContext
   */
  public async processRequest(
    messageContext: InboundMessageContext<CredentialRequestMessage>
  ): Promise<CredentialRecord> {
    const [requestAttachment] = messageContext.message.attachments;

    if (!requestAttachment.data.base64) {
      throw new Error('Missing required base64 encoded attachment data');
    }

    const credReq = JsonEncoder.fromBase64(requestAttachment.data.base64);

    const [credential] = await this.credentialRepository.findByQuery({
      threadId: messageContext.message.threadId,
    });

    this.assertState(credential.state, CredentialState.OfferSent);

    logger.log('Credential record found when processing credential request', credential);

    credential.request = credReq;
    await this.updateState(credential, CredentialState.RequestReceived);
    return credential;
  }

  /**
   * Creates credential request message by issuer to be send to holder.
   *
   * @param credentialId Credential record ID
   * @param credentialResponseOptions
   */
  public async createResponse(
    credentialId: string,
    options: CredentialResponseOptions = {}
  ): Promise<CredentialResponseMessage> {
    const credential = await this.credentialRepository.find(credentialId);

    if (!credential.request) {
      throw new Error(`Credential does not contain request.`);
    }

    this.assertState(credential.state, CredentialState.RequestReceived);

    // FIXME: transformation should be handled by credential record
    const offer =
      credential.offer instanceof CredentialOfferMessage
        ? credential.offer
        : JsonTransformer.fromJSON(credential.offer, CredentialOfferMessage);
    const [offerAttachment] = offer.attachments;

    if (!offerAttachment.data.base64) {
      throw new Error('Missing required base64 encoded attachment data');
    }

    const credOffer = JsonEncoder.fromBase64(offerAttachment.data.base64);
    const credValues = CredentialUtils.convertPreviewToValues(offer.credentialPreview);
    const [cred] = await this.wallet.createCredential(credOffer, credential.request, credValues);

    const responseAttachment = new Attachment({
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(cred),
      }),
    });

    const { comment } = options;
    const credentialResponse = new CredentialResponseMessage({ comment, attachments: [responseAttachment] });
    credentialResponse.setThread({ threadId: credential.tags.threadId });
    credentialResponse.setPleaseAck();

    await this.updateState(credential, CredentialState.CredentialIssued);
    return credentialResponse;
  }

  /**
   * Updates credential record by holder based on incoming credential request from issuer.
   *
   * @param messageContext
   * @param credentialDefinition
   */
  public async processResponse(
    messageContext: InboundMessageContext<CredentialResponseMessage>,
    credentialDefinition: CredDef
  ): Promise<CredentialRecord> {
    const threadId = messageContext.message.threadId;
    const [credential] = await this.credentialRepository.findByQuery({ threadId });

    if (!credential) {
      throw new Error(`No credential found for threadId = ${threadId}`);
    }

    logger.log('Credential record found when processing credential response', credential);

    if (!credential.requestMetadata) {
      throw new Error('Credential does not contain request metadata.');
    }

    this.assertState(credential.state, CredentialState.RequestSent);

    const [responseAttachment] = messageContext.message.attachments;

    if (!responseAttachment.data.base64) {
      throw new Error('Missing required base64 encoded attachment data');
    }

    const cred = JsonEncoder.fromBase64(responseAttachment.data.base64);

    const credentialId = await this.wallet.storeCredential(
      uuid(),
      credential.requestMetadata,
      cred,
      credentialDefinition
    );

    credential.credentialId = credentialId;
    await this.updateState(credential, CredentialState.CredentialReceived);
    return credential;
  }

  public async createAck(credentialId: string): Promise<CredentialAckMessage> {
    const credential = await this.credentialRepository.find(credentialId);

    this.assertState(credential.state, CredentialState.CredentialReceived);

    const ackMessage = new CredentialAckMessage({});
    ackMessage.setThread({ threadId: credential.tags.threadId });

    await this.updateState(credential, CredentialState.Done);
    return ackMessage;
  }

  public async processAck(messageContext: InboundMessageContext<CredentialAckMessage>): Promise<CredentialRecord> {
    const threadId = messageContext.message.threadId;
    const [credential] = await this.credentialRepository.findByQuery({ threadId });

    if (!credential) {
      throw new Error(`No credential found for threadId = ${threadId}`);
    }

    this.assertState(credential.state, CredentialState.CredentialIssued);

    await this.updateState(credential, CredentialState.Done);
    return credential;
  }

  public async getAll(): Promise<CredentialRecord[]> {
    return this.credentialRepository.findAll();
  }

  public async find(id: string): Promise<CredentialRecord> {
    return this.credentialRepository.find(id);
  }

  private assertState(current: CredentialState, expected: CredentialState) {
    if (current !== expected) {
      throw new Error(`Credential record is in invalid state ${current}. Valid states are: ${expected}.`);
    }
  }

  private async updateState(credential: CredentialRecord, newState: CredentialState) {
    const prevState = credential.state;
    credential.state = newState;
    await this.credentialRepository.update(credential);

    const event: CredentialStateChangedEvent = {
      credential: credential,
      prevState,
    };

    this.emit(EventType.StateChanged, event);
  }
}

export interface CredentialOfferTemplate {
  credentialDefinitionId: CredDefId;
  comment?: string;
  preview: CredentialPreview;
}

interface CredentialRequestOptions {
  comment?: string;
}

interface CredentialResponseOptions {
  comment?: string;
}

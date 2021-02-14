import { CredentialRecord } from '../storage/CredentialRecord';
import { createOutboundMessage } from '../protocols/helpers';
import { CredentialService, CredentialOfferTemplate } from '../protocols/issue-credential/CredentialService';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { LedgerService } from '../agent/LedgerService';
import logger from '../logger';
import { EventEmitter } from 'events';

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

  /**
   * Get the event emitter for the credential service. Will emit state changed events
   * when the state of credential records changes.
   *
   * @returns event emitter for credential related state changes
   */
  public get events(): EventEmitter {
    return this.credentialService;
  }

  /**
   * Initiate a new credential exchange by sending a credential offer message
   * to the connection with the specified connection id.
   *
   * @param connectionId The connection to send the credential offer to
   * @param credentialTemplate The credential template to use for the offer
   * @returns Credential record associated with the sent credential offer message
   */
  public async issueCredential(
    connectionId: string,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialRecord> {
    const connection = await this.connectionService.getById(connectionId);

    const { message, credentialRecord } = await this.credentialService.createOffer(connection, credentialTemplate);

    const outboundMessage = createOutboundMessage(connection, message);
    await this.messageSender.sendMessage(outboundMessage);

    return credentialRecord;
  }

  /**
   * Accept a credential offer (by sending a credential request message) to the connection
   * associated with the credential record.
   *
   * @param credentialRecordId The id of the credential record for which to accept the offer
   * @param config Additional configuration to use for the request
   * @returns Credential record associated with the credential request
   *
   */
  public async acceptCredential(credentialRecordId: string, config?: { comment?: string }) {
    const credentialRecord = await this.credentialService.getById(credentialRecordId);
    const connection = await this.connectionService.getById(credentialRecord.connectionId);
    logger.log('acceptCredential credential', credentialRecord);

    const { message, credentialRecord: credRecord } = await this.credentialService.createRequest(
      credentialRecord,
      config
    );

    const outboundMessage = createOutboundMessage(connection, message);
    await this.messageSender.sendMessage(outboundMessage);

    return credRecord;
  }

  /**
   * Retrieve all credential records
   *
   * @returns List containing all credential records
   */
  public async getAll(): Promise<CredentialRecord[]> {
    return this.credentialService.getAll();
  }

  /**
   * Retrieve a credential record by id
   *
   * @param credentialRecordId The credential record id
   * @throws {Error} If no record is found
   * @return The credential record
   *
   */
  public async getById(credentialRecordId: string) {
    return this.credentialService.getById(credentialRecordId);
  }
}

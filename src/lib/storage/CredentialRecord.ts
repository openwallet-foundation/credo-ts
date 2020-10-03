import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType } from './BaseRecord';
import { CredentialOfferMessage } from '../protocols/credentials/messages/CredentialOfferMessage';
import { CredentialState } from '../protocols/credentials/CredentialState';

export interface CredentialStorageProps {
  id?: string;
  offer: CredentialOfferMessage;
  state: CredentialState;
  connectionId: string;
  request?: CredReq;
  requestMetadata?: Record<string, unknown>;
  credentialId?: CredentialId;
  tags: Record<string, unknown>;
}

export class CredentialRecord extends BaseRecord implements CredentialStorageProps {
  public connectionId: string;
  public offer: CredentialOfferMessage;
  public request?: CredReq;
  public requestMetadata?: Record<string, unknown>;
  public credentialId?: CredentialId;

  public type = RecordType.CredentialRecord;
  public static type: RecordType = RecordType.CredentialRecord;

  public state: CredentialState;

  public constructor(props: CredentialStorageProps) {
    super(props.id ? props.id : uuid());
    this.offer = props.offer;
    this.state = props.state;
    this.connectionId = props.connectionId;
    this.request = props.request;
    this.requestMetadata = props.requestMetadata;
    this.credentialId = props.credentialId;
    this.tags = props.tags as { [keys: string]: string };
  }
}

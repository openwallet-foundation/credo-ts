import { v4 as uuid } from 'uuid';
import { BaseRecord, RecordType, Tags } from './BaseRecord';
import { OfferCredentialMessage } from '../protocols/issue-credential/messages/OfferCredentialMessage';
import { CredentialState } from '../protocols/issue-credential/CredentialState';
import { RequestCredentialMessage } from '../protocols/issue-credential/messages/RequestCredentialMessage';
import { IssueCredentialMessage } from '../protocols/issue-credential/messages/IssueCredentialMessage';

export interface CredentialStorageProps {
  id?: string;
  createdAt?: number;
  state: CredentialState;
  connectionId: string;
  offerMessage: OfferCredentialMessage;
  requestMessage?: RequestCredentialMessage;
  requestMetadata?: Record<string, unknown>;
  credentialMessage?: IssueCredentialMessage;
  credentialId?: CredentialId;
  tags: CredentialRecordTags;
}

export interface CredentialRecordTags extends Tags {
  threadId?: string;
}

export class CredentialRecord extends BaseRecord implements CredentialStorageProps {
  public connectionId: string;
  public credentialId?: CredentialId;
  public offerMessage: OfferCredentialMessage;
  public requestMessage?: RequestCredentialMessage;
  public credentialMessage?: IssueCredentialMessage;
  public requestMetadata?: Record<string, unknown>;
  public tags: CredentialRecordTags;

  public type = RecordType.CredentialRecord;
  public static type: RecordType = RecordType.CredentialRecord;

  public state: CredentialState;

  public constructor(props: CredentialStorageProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now());
    this.offerMessage = props.offerMessage;
    this.state = props.state;
    this.connectionId = props.connectionId;
    this.requestMessage = props.requestMessage;
    this.requestMetadata = props.requestMetadata;
    this.credentialId = props.credentialId;
    this.tags = props.tags as { [keys: string]: string };
  }

  public assertState(expectedStates: CredentialState | CredentialState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates];
    }

    if (!expectedStates.includes(this.state)) {
      throw new Error(
        `Credential record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      );
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (this.connectionId !== currentConnectionId) {
      throw new Error(
        `Credential record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      );
    }
  }
}

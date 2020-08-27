import uuid from 'uuid/v4';
import { BaseRecord, RecordType } from './BaseRecord';
import { CredentialOfferMessage } from '../protocols/credentials/messages/CredentialOfferMessage';
import { CredentialState } from '../protocols/credentials/CredentialState';

export interface CredentialStorageProps {
  id?: string;
  offer: CredentialOfferMessage;
  state: CredentialState;
}

export class CredentialRecord extends BaseRecord implements CredentialStorageProps {
  offer: CredentialOfferMessage;

  type = RecordType.CredentialRecord;
  static type: RecordType = RecordType.CredentialRecord;

  state: CredentialState;

  constructor(props: CredentialStorageProps) {
    super(props.id ? props.id : uuid());
    this.offer = props.offer;
    this.state = props.state;
  }
}

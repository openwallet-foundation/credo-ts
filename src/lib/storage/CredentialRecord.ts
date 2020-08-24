import uuid from 'uuid/v4';
import { BaseRecord, RecordType } from './BaseRecord';
import { CredentialOfferMessage } from '../protocols/credentials/messages/CredentialOfferMessage';

export interface CredentialStorageProps {
  id?: string;
  offer: CredentialOfferMessage;
}

export class CredentialRecord extends BaseRecord implements CredentialStorageProps {
  offer: CredentialOfferMessage;

  type = RecordType.CredentialRecord;
  static type: RecordType = RecordType.CredentialRecord;

  constructor(props: CredentialStorageProps) {
    super(props.id ? props.id : uuid());
    this.offer = props.offer;
  }
}

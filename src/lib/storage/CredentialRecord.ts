import uuid from 'uuid/v4';
import { BaseRecord, RecordType } from './BaseRecord';

export interface CredentialStorageProps {
  id?: string;
  offer: string;
}

export class CredentialRecord extends BaseRecord implements CredentialStorageProps {
  offer: string;

  type = RecordType.CredentialRecord;
  static type: RecordType = RecordType.CredentialRecord;

  constructor(props: CredentialStorageProps) {
    super(props.id ? props.id : uuid());
    this.offer = props.offer;
  }
}

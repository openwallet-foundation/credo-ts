import uuid from 'uuid/v4';
import { BaseRecord, RecordTypes } from './BaseRecord';

export interface BasicMessageStorageProps {
  id?: string;
  tags: { [keys: string]: string };

  content: string;
  sent_time: string;
}

export class BasicMessageRecord extends BaseRecord implements BasicMessageStorageProps {
  content: string;
  sent_time: string;

  type = RecordTypes.BASIC_MESSAGE_RECORD;
  static type: RecordTypes = RecordTypes.BASIC_MESSAGE_RECORD;

  constructor(props: BasicMessageStorageProps) {
    super(props.id ? props.id : uuid());
    this.content = props.content;
    this.sent_time = props.sent_time;
    this.tags = props.tags;
  }
}
